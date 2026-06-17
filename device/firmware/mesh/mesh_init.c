#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>
#include <zephyr/sys/byteorder.h>
#include <zephyr/random/random.h>
#include <zephyr/settings/settings.h>
#include <zephyr/drivers/hwinfo.h>

#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/mesh.h>
#include <zephyr/bluetooth/mesh/cfg_cli.h>

#include "mesh_init.h"
#include "mesh_models.h"

#define LOG_MODULE_NAME mesh_init
#include <zephyr/logging/log.h>
LOG_MODULE_REGISTER(LOG_MODULE_NAME, LOG_LEVEL_DBG);

static uint8_t dev_uuid[16];

static void attention_on(const struct bt_mesh_model *mod) {
    LOG_INF("Attention ON");
}

static void attention_off(const struct bt_mesh_model *mod) {
    LOG_INF("Attention OFF");
}

static const struct bt_mesh_health_srv_cb health_srv_cb = {
    .attn_on = attention_on,
    .attn_off = attention_off,
};

static struct bt_mesh_health_srv health_srv = {
    .cb = &health_srv_cb,
};

BT_MESH_HEALTH_PUB_DEFINE(health_pub, 0);

static struct bt_mesh_cfg_cli cfg_cli = {
};

static const struct bt_mesh_model root_models[] = {
    BT_MESH_MODEL_CFG_SRV,
    BT_MESH_MODEL_CFG_CLI(&cfg_cli),
    BT_MESH_MODEL_HEALTH_SRV(&health_srv, &health_pub),
};

static const struct bt_mesh_model vendor_models[] = {
    ERLS_EMERGENCY_MODEL,
    ERLS_LOCATION_MODEL,
};

static const struct bt_mesh_elem elements[] = {
    BT_MESH_ELEM(0, root_models, vendor_models),
};

static const struct bt_mesh_comp comp = {
    .cid = 0xFFFF,
    .elem = elements,
    .elem_count = ARRAY_SIZE(elements),
};

static int output_numeric(bt_mesh_output_action_t action, uint8_t *numeric, size_t size) {
    uint32_t number = 0;
    if (size <= sizeof(number)) {
        memcpy(&number, numeric, size);
    }
    LOG_INF("OOB Number: %u", number);
    return 0;
}

static void prov_complete(uint16_t net_idx, uint16_t addr) {
    LOG_INF("Provisioning complete! Net idx: 0x%04x, Addr: 0x%04x", net_idx, addr);
}

static void prov_reset(void) {
    LOG_INF("Provisioning reset");
    bt_mesh_prov_enable(BT_MESH_PROV_ADV | BT_MESH_PROV_GATT);
}

static const struct bt_mesh_prov prov = {
    .uuid = dev_uuid,
    .output_size = 4,
    .output_actions = BT_MESH_DISPLAY_NUMBER,
    .output_numeric = output_numeric,
    .complete = prov_complete,
    .reset = prov_reset,
};

const struct bt_mesh_comp *mesh_get_comp(void) {
    return &comp;
}

const struct bt_mesh_prov *mesh_get_prov(void) {
    return &prov;
}

bool mesh_is_provisioned(void) {
    return bt_mesh_is_provisioned();
}

int mesh_self_provision(void) {
    static uint8_t net_key[16] = {0};
    static uint8_t dev_key[16] = {0};
    static uint8_t app_key[16] = {0};
    uint16_t addr;
    int err;

    if (bt_mesh_is_provisioned()) {
        LOG_WRN("Already provisioned");
        return -EALREADY;
    }

    addr = sys_get_le16(&dev_uuid[0]) & BIT_MASK(15);
    if (addr == 0) {
        addr = 0x0001;
    }

    LOG_INF("Self-provisioning with address 0x%04x", addr);

    err = bt_mesh_provision(net_key, 0, 0, 0, addr, dev_key);
    if (err) {
        LOG_ERR("Provisioning failed (err %d)", err);
        return err;
    }

    err = bt_mesh_app_key_add(0, 0, app_key);
    if (err) {
        LOG_ERR("App key add failed (err %d)", err);
        return err;
    }

    err = erls_models_bind_app_key(0);
    if (err) {
        LOG_ERR("Model app key bind failed (err %d)", err);
        return err;
    }

    LOG_INF("Self-provisioning complete");
    return 0;
}

void mesh_reset(void) {
    bt_mesh_reset();
    LOG_INF("Mesh reset - node is now unprovisioned");
}

int mesh_init(void) {
    int err;

    err = hwinfo_get_device_id(dev_uuid, sizeof(dev_uuid));
    if (err < 0) {
        LOG_WRN("hwinfo_get_device_id failed (err %d), using random UUID", err);
        sys_rand_get(dev_uuid, sizeof(dev_uuid));
    }

    LOG_INF("Device UUID: %02x%02x%02x%02x-%02x%02x-%02x%02x-""%02x%02x-%02x%02x%02x%02x%02x%02x",
            dev_uuid[0], dev_uuid[1], dev_uuid[2], dev_uuid[3],
            dev_uuid[4], dev_uuid[5], dev_uuid[6], dev_uuid[7],
            dev_uuid[8], dev_uuid[9], dev_uuid[10], dev_uuid[11],
            dev_uuid[12], dev_uuid[13], dev_uuid[14], dev_uuid[15]);

    err = bt_mesh_init(&prov, &comp);
    if (err) {
        LOG_ERR("bt_mesh_init failed (err %d)", err);
        return err;
    }

    LOG_INF("Mesh initialized");

    if (IS_ENABLED(CONFIG_SETTINGS)) {
        settings_load();
    }
    
    if (!bt_mesh_is_provisioned()) {
        bt_mesh_prov_enable(BT_MESH_PROV_ADV | BT_MESH_PROV_GATT);
        LOG_INF("Provisioning enabled (ADV + GATT)");
    } else {
        LOG_INF("Node already provisioned");
    }

    return 0;
}
