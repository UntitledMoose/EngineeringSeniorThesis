#include <zephyr/kernel.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/bluetooth/gatt.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/drivers/hwinfo.h>
#include <zephyr/random/random.h>

/* mbedTLS for HMAC-SHA256 */
#include <mbedtls/md.h>

#include "gatt_service.h"
#include "../mesh/mesh_models.h"

#define LOG_MODULE_NAME erls_gatt
#include <zephyr/logging/log.h>
LOG_MODULE_REGISTER(LOG_MODULE_NAME, LOG_LEVEL_INF);

static uint32_t beacon_id;
static bool status_notify_enabled;

static uint8_t current_nonce[ERLS_AUTH_NONCE_SIZE];
static bool nonce_valid;

/*
 * shared secret for authentication
 * TODO: this should be provisioned securely per-device
 */
static const uint8_t shared_secret[] = {
    0x45, 0x52, 0x4C, 0x53, 0x5F, 0x53, 0x45, 0x43,  /* "ERLS_SEC" */
    0x52, 0x45, 0x54, 0x5F, 0x4B, 0x45, 0x59, 0x21,  /* "RET_KEY!" */
    0x32, 0x30, 0x32, 0x34, 0x5F, 0x54, 0x45, 0x53,  /* "2024_TES" */
    0x54, 0x5F, 0x4F, 0x4E, 0x4C, 0x59, 0x21, 0x21   /* "T_ONLY!!" */
};

static void status_ccc_cfg_changed(const struct bt_gatt_attr *attr, uint16_t value);

static int compute_hmac_sha256(const uint8_t *key, size_t key_len, const uint8_t *data, size_t data_len, uint8_t *output) {
    const mbedtls_md_info_t *md_info;
    int ret;

    md_info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    if (!md_info) {
        LOG_ERR("SHA256 not available");
        return -ENOTSUP;
    }

    ret = mbedtls_md_hmac(md_info, key, key_len, data, data_len, output);
    if (ret != 0) {
        LOG_ERR("HMAC computation failed: %d", ret);
        return -EIO;
    }

    return 0;
}

static bool verify_auth_packet(const uint8_t *nonce, const uint8_t *hmac, uint8_t cmd) {
    uint8_t computed_hmac[ERLS_AUTH_HMAC_SIZE];
    uint8_t auth_data[ERLS_AUTH_NONCE_SIZE + ERLS_AUTH_CMD_SIZE];
    int ret;

    if (!nonce_valid) {
        LOG_WRN("Auth failed: no valid nonce (read challenge first)");
        return false;
    }

    if (memcmp(nonce, current_nonce, ERLS_AUTH_NONCE_SIZE) != 0) {
        LOG_WRN("Auth failed: nonce mismatch");
        return false;
    }

    nonce_valid = false;

    memcpy(auth_data, nonce, ERLS_AUTH_NONCE_SIZE);
    auth_data[ERLS_AUTH_NONCE_SIZE] = cmd;

    ret = compute_hmac_sha256(shared_secret, sizeof(shared_secret), auth_data, sizeof(auth_data), computed_hmac);

    if (ret != 0) {
        LOG_ERR("HMAC computation failed");
        return false;
    }

    uint8_t diff = 0;
    for (int i = 0; i < ERLS_AUTH_HMAC_SIZE; i++) {
        diff |= computed_hmac[i] ^ hmac[i];
    }

    if (diff != 0) {
        LOG_WRN("Auth failed: HMAC mismatch");
        return false;
    }

    LOG_INF("Authentication successful");
    return true;
}

static ssize_t read_auth_challenge(struct bt_conn *conn, const struct bt_gatt_attr *attr, void *buf, uint16_t len, uint16_t offset) {
    sys_rand_get(current_nonce, sizeof(current_nonce));
    nonce_valid = true;

    LOG_INF("Auth challenge issued (nonce generated)");

    return bt_gatt_attr_read(conn, attr, buf, len, offset,
                             current_nonce, sizeof(current_nonce));
}

static ssize_t read_emergency_status(struct bt_conn *conn, const struct bt_gatt_attr *attr, void *buf, uint16_t len, uint16_t offset) {
    uint8_t status[2];

    status[0] = (uint8_t)erls_get_emergency_type();
    status[1] = (uint8_t)erls_get_emergency_status();

    LOG_DBG("Read emergency status: type=%d, status=%d", status[0], status[1]);

    return bt_gatt_attr_read(conn, attr, buf, len, offset, status, sizeof(status));
}

static ssize_t write_emergency_trigger(struct bt_conn *conn, const struct bt_gatt_attr *attr, const void *buf, uint16_t len, uint16_t offset, uint8_t flags) {
    const uint8_t *data = buf;
    int err;

    if (offset != 0) {
        LOG_WRN("Invalid offset %d", offset);
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_OFFSET);
    }

    if (len != ERLS_AUTH_PACKET_SIZE) {
        LOG_WRN("Invalid packet length %d (expected %d)", len, ERLS_AUTH_PACKET_SIZE);
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
    }

    const uint8_t *nonce = &data[0];
    const uint8_t *hmac = &data[ERLS_AUTH_NONCE_SIZE];
    uint8_t cmd = data[ERLS_AUTH_NONCE_SIZE + ERLS_AUTH_HMAC_SIZE];

    LOG_INF("Auth packet received: cmd=0x%02x", cmd);

    if (!verify_auth_packet(nonce, hmac, cmd)) {
        LOG_WRN("Authentication failed - rejecting command");
        return BT_GATT_ERR(BT_ATT_ERR_AUTHORIZATION);
    }

    if (cmd == 0x00) {
        err = erls_clear_emergency();
        if (err && err != -ENOENT) {
            LOG_ERR("Failed to clear emergency: %d", err);
            return BT_GATT_ERR(BT_ATT_ERR_UNLIKELY);
        }
        LOG_INF("Emergency cleared via authenticated GATT command");
    } else if (cmd >= 0x01 && cmd <= 0x05) {
        enum erls_emergency_type type = (enum erls_emergency_type)cmd;
        err = erls_send_emergency_alert(type);
        if (err) {
            LOG_ERR("Failed to send emergency alert: %d", err);
            return BT_GATT_ERR(BT_ATT_ERR_UNLIKELY);
        }
        LOG_WRN("*** EMERGENCY TRIGGERED: type=%d ***", type);
    } else {
        LOG_WRN("Invalid command: 0x%02x", cmd);
        return BT_GATT_ERR(BT_ATT_ERR_VALUE_NOT_ALLOWED);
    }

    erls_gatt_notify_status();

    return len;
}


static ssize_t read_beacon_info(struct bt_conn *conn, const struct bt_gatt_attr *attr, void *buf, uint16_t len, uint16_t offset) {
    LOG_DBG("Read beacon info: 0x%08x", beacon_id);

    return bt_gatt_attr_read(conn, attr, buf, len, offset, &beacon_id, sizeof(beacon_id));
}

static void status_ccc_cfg_changed(const struct bt_gatt_attr *attr, uint16_t value) {
    status_notify_enabled = (value == BT_GATT_CCC_NOTIFY);
    LOG_INF("Status notifications %s", status_notify_enabled ? "enabled" : "disabled");
}

BT_GATT_SERVICE_DEFINE(erls_svc,
    BT_GATT_PRIMARY_SERVICE(ERLS_SERVICE_UUID),

    BT_GATT_CHARACTERISTIC(ERLS_AUTH_CHALLENGE_UUID,
                           BT_GATT_CHRC_READ,
                           BT_GATT_PERM_READ,
                           read_auth_challenge, NULL, NULL),

    BT_GATT_CHARACTERISTIC(ERLS_EMERGENCY_TRIGGER_UUID,
                           BT_GATT_CHRC_WRITE,
                           BT_GATT_PERM_WRITE,
                           NULL, write_emergency_trigger, NULL),

    BT_GATT_CHARACTERISTIC(ERLS_EMERGENCY_STATUS_UUID,
                           BT_GATT_CHRC_READ | BT_GATT_CHRC_NOTIFY,
                           BT_GATT_PERM_READ,
                           read_emergency_status, NULL, NULL),
    BT_GATT_CCC(status_ccc_cfg_changed, BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),

    BT_GATT_CHARACTERISTIC(ERLS_BEACON_INFO_UUID,
                           BT_GATT_CHRC_READ,
                           BT_GATT_PERM_READ,
                           read_beacon_info, NULL, NULL),
);

void erls_gatt_notify_status(void) {
    if (!status_notify_enabled) {
        return;
    }

    uint8_t status[2];
    status[0] = (uint8_t)erls_get_emergency_type();
    status[1] = (uint8_t)erls_get_emergency_status();

    int err = bt_gatt_notify(NULL, &erls_svc.attrs[5], status, sizeof(status));
    if (err) {
        LOG_ERR("Failed to notify status: %d", err);
    } else {
        LOG_DBG("Status notification sent");
    }
}

/* BLE advertisement data: flags + ERLS service UUID */
static const struct bt_data ad[] = {
    BT_DATA_BYTES(BT_DATA_FLAGS, (BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR)),
    BT_DATA_BYTES(BT_DATA_UUID128_ALL, ERLS_SERVICE_UUID_VAL),
};

/* Scan response: device name */
static const struct bt_data sd[] = {
    BT_DATA(BT_DATA_NAME_COMPLETE, CONFIG_BT_DEVICE_NAME, sizeof(CONFIG_BT_DEVICE_NAME) - 1),
};

int erls_gatt_adv_start(void) {
    int err;

    err = bt_le_adv_start(BT_LE_ADV_CONN_FAST_1, ad, ARRAY_SIZE(ad), sd, ARRAY_SIZE(sd));
    if (err) {
        LOG_ERR("Advertising failed to start (err %d)", err);
        return err;
    }

    LOG_INF("GATT advertising started");
    return 0;
}

int erls_gatt_init(void) {
    uint8_t hw_id[4];
    int err = hwinfo_get_device_id(hw_id, sizeof(hw_id));
    if (err > 0) {
        beacon_id = (hw_id[0] << 24) | (hw_id[1] << 16) |
                    (hw_id[2] << 8) | hw_id[3];
    } else {
        beacon_id = 0xDEADBEEF;
    }

    erls_set_beacon_id(beacon_id);

    LOG_INF("ERLS GATT service initialized (beacon ID: 0x%08x)", beacon_id);
    LOG_INF("Service UUID: 12345678-1234-5678-1234-56789abcdef0");
    LOG_INF("  - Auth Challenge (read): ...def4 (16-byte nonce)");
    LOG_INF("  - Emergency Trigger (write): ...def1 (49-byte auth packet)");
    LOG_INF("  - Emergency Status (read/notify): ...def2");
    LOG_INF("  - Beacon Info (read): ...def3");
    LOG_INF("Authentication: HMAC-SHA256 challenge-response enabled");

    return 0;
}
