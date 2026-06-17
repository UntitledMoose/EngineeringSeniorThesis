#ifndef MESH_MODELS_H
#define MESH_MODELS_H

#include <zephyr/bluetooth/mesh.h>
#include "mesh_msg.h"

#define ERLS_COMPANY_ID         0x0000

#define ERLS_EMERGENCY_MODEL_ID 0x0001
#define ERLS_LOCATION_MODEL_ID  0x0002

#define ERLS_OP_EMERGENCY_ALERT     BT_MESH_MODEL_OP_3(0x01, ERLS_COMPANY_ID)
#define ERLS_OP_EMERGENCY_ACK       BT_MESH_MODEL_OP_3(0x02, ERLS_COMPANY_ID)
#define ERLS_OP_EMERGENCY_CLEAR     BT_MESH_MODEL_OP_3(0x03, ERLS_COMPANY_ID)
#define ERLS_OP_EMERGENCY_STATUS    BT_MESH_MODEL_OP_3(0x04, ERLS_COMPANY_ID)

#define ERLS_OP_LOCATION_UPDATE     BT_MESH_MODEL_OP_3(0x10, ERLS_COMPANY_ID)
#define ERLS_OP_LOCATION_REQUEST    BT_MESH_MODEL_OP_3(0x11, ERLS_COMPANY_ID)
#define ERLS_OP_LOCATION_RESPONSE   BT_MESH_MODEL_OP_3(0x12, ERLS_COMPANY_ID)

enum erls_emergency_type {
    ERLS_EMERGENCY_NONE = 0,
    ERLS_EMERGENCY_FIRE,
    ERLS_EMERGENCY_LOCKDOWN,
    ERLS_EMERGENCY_MEDICAL,
    ERLS_EMERGENCY_WEATHER,
    ERLS_EMERGENCY_CUSTOM,
};

enum erls_emergency_status {
    ERLS_STATUS_INACTIVE = 0,
    ERLS_STATUS_ACTIVE,
    ERLS_STATUS_ACKNOWLEDGED,
    ERLS_STATUS_RESOLVED,
};

typedef void (*erls_emergency_cb_t)(uint8_t type, uint32_t initiator_id, uint32_t beacon_id, uint32_t timestamp);

void erls_set_emergency_callback(erls_emergency_cb_t cb);

typedef void (*erls_location_cb_t)(const struct erls_location_msg *msg);

void erls_set_location_callback(erls_location_cb_t cb);

int erls_send_emergency_alert(enum erls_emergency_type type);

int erls_send_location_update(const struct erls_location_msg *msg);

int erls_clear_emergency(void);

enum erls_emergency_status erls_get_emergency_status(void);

enum erls_emergency_type erls_get_emergency_type(void);

void erls_set_beacon_id(uint32_t id);

int erls_models_bind_app_key(uint16_t app_idx);

extern const struct bt_mesh_model_op erls_emergency_ops[];
extern const struct bt_mesh_model_op erls_location_ops[];

#define ERLS_EMERGENCY_MODEL                                           \
    BT_MESH_MODEL_VND(ERLS_COMPANY_ID, ERLS_EMERGENCY_MODEL_ID,       \
                      erls_emergency_ops, NULL, NULL)

#define ERLS_LOCATION_MODEL                                            \
    BT_MESH_MODEL_VND(ERLS_COMPANY_ID, ERLS_LOCATION_MODEL_ID,        \
                      erls_location_ops, NULL, NULL)

#endif /* MESH_MODELS_H */
