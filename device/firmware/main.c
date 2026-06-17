#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>
#include <zephyr/settings/settings.h>
#include <zephyr/bluetooth/bluetooth.h>

#include "mesh/mesh_init.h"
#include "mesh/mesh_models.h"
#include "mesh/mesh_msg.h"
#include "gatt/gatt_service.h"

#define LOG_MODULE_NAME main
#include <zephyr/logging/log.h>
LOG_MODULE_REGISTER(LOG_MODULE_NAME, LOG_LEVEL_INF);

static struct k_work_delayable self_provision_work;

static void on_emergency_alert(uint8_t type, uint32_t initiator_id, uint32_t beacon_id, uint32_t timestamp) {
    LOG_WRN("*** EMERGENCY ALERT ***");
    LOG_WRN("Type: %d, Initiator: 0x%08x, Location: 0x%08x",
            type, initiator_id, beacon_id);

    /* TODO: Forward to LoRa bridge if this is a bridge node */
}

static void on_location_update(const struct erls_location_msg *msg) {
    LOG_DBG("Location update: user=0x%08x at beacon=0x%08x (RSSI: %d)",
            msg->user_id, msg->beacon_id, msg->rssi);

    /* TODO: Store in location table for aggregation */
    /* TODO: Forward to LoRa bridge if this is a bridge node */
}

static void self_provision_handler(struct k_work *work) {
    if (!mesh_is_provisioned()) {
        LOG_INF("Auto self-provisioning for testing...");
        int err = mesh_self_provision();
        if (err) {
            LOG_ERR("Self-provision failed (err %d)", err);
        }
        /* Provisioning state is now saved to flash automatically */
    }
}

static void bt_ready(int err) {
    if (err) {
        LOG_ERR("Bluetooth init failed (err %d)", err);
        return;
    }

    LOG_INF("Bluetooth initialized");

    err = erls_gatt_init();
    if (err) {
        LOG_ERR("GATT service init failed (err %d)", err);
        return;
    }

    err = mesh_init();
    if (err) {
        LOG_ERR("Mesh init failed (err %d)", err);
        return;
    }

    erls_set_emergency_callback(on_emergency_alert);
    erls_set_location_callback(on_location_update);

    LOG_INF("ERLS Beacon ready");

    if (!mesh_is_provisioned()) {
        /* Not provisioned: advertise GATT service so mobile app can find beacon */
        err = erls_gatt_adv_start();
        if (err) {
            LOG_ERR("GATT advertising failed (err %d)", err);
            return;
        }
        LOG_INF("Node not provisioned. Will self-provision in 5 seconds...");
        LOG_INF("(In production, use a provisioner app instead)");
        k_work_schedule(&self_provision_work, K_SECONDS(5));
    } else {
        /* Already provisioned: mesh GATT proxy handles advertising */
        LOG_INF("Loaded provisioning from flash — skipping self-provision");
    }
}

int main(void) {
    int err;

    LOG_INF("ERLS Beacon Firmware Starting");
    LOG_INF("Emergency Response Localization System");

    k_work_init_delayable(&self_provision_work, self_provision_handler);

    err = bt_enable(bt_ready);
    if (err) {
        LOG_ERR("Bluetooth enable failed (err %d)", err);
        return 0;
    }

    while (1) {
        k_sleep(K_SECONDS(1));

        if (mesh_is_provisioned()) {
            enum erls_emergency_status status = erls_get_emergency_status();
            if (status == ERLS_STATUS_ACTIVE) {
                LOG_WRN("Emergency active: type %d", erls_get_emergency_type());
            }
        }
    }

    return 0;
}