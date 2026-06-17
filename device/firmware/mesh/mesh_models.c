#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>
#include <zephyr/bluetooth/mesh.h>

#include "mesh_init.h"
#include "mesh_models.h"
#include "mesh_msg.h"

#define LOG_MODULE_NAME mesh_models
#include <zephyr/logging/log.h>
LOG_MODULE_REGISTER(LOG_MODULE_NAME, LOG_LEVEL_DBG);

static struct {
    enum erls_emergency_type type;
    enum erls_emergency_status status;
    uint32_t initiator_id;
    uint32_t beacon_id;
    uint32_t timestamp;
} current_emergency = {
    .type = ERLS_EMERGENCY_NONE,
    .status = ERLS_STATUS_INACTIVE,
};

static uint32_t local_beacon_id;

void erls_set_beacon_id(uint32_t id) {
    local_beacon_id = id;
    LOG_INF("Beacon ID set to 0x%08x", id);
}

static erls_emergency_cb_t emergency_callback;
static erls_location_cb_t location_callback;

static int emergency_alert_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf);
static int emergency_ack_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf);
static int emergency_clear_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf);
static int emergency_status_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf);
static int location_update_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf);
static int location_request_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf);
static int location_response_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf);

const struct bt_mesh_model_op erls_emergency_ops[] = {
    { ERLS_OP_EMERGENCY_ALERT,  BT_MESH_LEN_EXACT(ERLS_EMERGENCY_MSG_SIZE),
      emergency_alert_handler },
    { ERLS_OP_EMERGENCY_ACK,    BT_MESH_LEN_EXACT(4), emergency_ack_handler },
    { ERLS_OP_EMERGENCY_CLEAR,  BT_MESH_LEN_EXACT(4), emergency_clear_handler },
    { ERLS_OP_EMERGENCY_STATUS, BT_MESH_LEN_EXACT(2), emergency_status_handler },
    BT_MESH_MODEL_OP_END,
};


const struct bt_mesh_model_op erls_location_ops[] = {
    { ERLS_OP_LOCATION_UPDATE,   BT_MESH_LEN_EXACT(ERLS_LOCATION_MSG_SIZE),
      location_update_handler },
    { ERLS_OP_LOCATION_REQUEST,  BT_MESH_LEN_EXACT(4), location_request_handler },
    { ERLS_OP_LOCATION_RESPONSE, BT_MESH_LEN_EXACT(ERLS_LOCATION_MSG_SIZE),
      location_response_handler },
    BT_MESH_MODEL_OP_END,
};

static int emergency_alert_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf) {
    struct erls_emergency_msg msg;
    int err;

    err = erls_decode_emergency_msg(buf->data, buf->len, &msg);
    if (err) {
        LOG_ERR("Failed to decode emergency message: %d", err);
        return err;
    }

    LOG_INF("Emergency alert received: type=%d, initiator=0x%08x, beacon=0x%08x",
            msg.type, msg.initiator_id, msg.beacon_id);

    current_emergency.type = msg.type;
    current_emergency.status = ERLS_STATUS_ACTIVE;
    current_emergency.initiator_id = msg.initiator_id;
    current_emergency.beacon_id = msg.beacon_id;
    current_emergency.timestamp = msg.timestamp;

    if (emergency_callback) {
        emergency_callback(msg.type, msg.initiator_id, msg.beacon_id, msg.timestamp);
    }

    return 0;
}

static int emergency_ack_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf) {
    uint32_t user_id = net_buf_simple_pull_le32(buf);

    LOG_INF("Emergency acknowledged by user 0x%08x", user_id);

    if (current_emergency.status == ERLS_STATUS_ACTIVE) {
        current_emergency.status = ERLS_STATUS_ACKNOWLEDGED;
    }

    return 0;
}

static int emergency_clear_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf) {
    uint32_t user_id = net_buf_simple_pull_le32(buf);

    LOG_INF("Emergency cleared by user 0x%08x", user_id);

    current_emergency.type = ERLS_EMERGENCY_NONE;
    current_emergency.status = ERLS_STATUS_RESOLVED;

    return 0;
}

static int emergency_status_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf) {
    uint8_t type = net_buf_simple_pull_u8(buf);
    uint8_t status = net_buf_simple_pull_u8(buf);

    LOG_INF("Emergency status update: type=%d, status=%d", type, status);

    return 0;
}

static int location_update_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf) {
    struct erls_location_msg msg;
    int err;

    err = erls_decode_location_msg(buf->data, buf->len, &msg);
    if (err) {
        LOG_ERR("Failed to decode location message: %d", err);
        return err;
    }

    LOG_DBG("Location update: user=0x%08x, beacon=0x%08x, rssi=%d",
            msg.user_id, msg.beacon_id, msg.rssi);

    if (location_callback) {
        location_callback(&msg);
    }

    return 0;
}

static int location_request_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf) {
    uint32_t user_id = net_buf_simple_pull_le32(buf);

    LOG_DBG("Location request for user 0x%08x", user_id);

    /* TODO: If we have location info for this user, send response */

    return 0;
}

static int location_response_handler(const struct bt_mesh_model *model, struct bt_mesh_msg_ctx *ctx, struct net_buf_simple *buf) {
    struct erls_location_msg msg;
    int err;

    err = erls_decode_location_msg(buf->data, buf->len, &msg);
    if (err) {
        LOG_ERR("Failed to decode location response: %d", err);
        return err;
    }

    LOG_DBG("Location response: user=0x%08x at beacon=0x%08x",
            msg.user_id, msg.beacon_id);

    return 0;
}

void erls_set_emergency_callback(erls_emergency_cb_t cb) {
    emergency_callback = cb;
}

void erls_set_location_callback(erls_location_cb_t cb) {
    location_callback = cb;
}

int erls_send_emergency_alert(enum erls_emergency_type type) {
    struct bt_mesh_msg_ctx ctx = {
        .addr = BT_MESH_ADDR_ALL_NODES,
        .send_ttl = BT_MESH_TTL_DEFAULT,
    };
    struct erls_emergency_msg msg = {
        .type = type,
        .initiator_id = 0,  /* TODO: Get from user context */
        .beacon_id = local_beacon_id,
        .timestamp = (uint32_t)(k_uptime_get() / 1000),
    };
    uint8_t payload[ERLS_EMERGENCY_MSG_SIZE];
    int err;

    const struct bt_mesh_comp *comp = mesh_get_comp();
    const struct bt_mesh_model *model = bt_mesh_model_find_vnd(
        &comp->elem[0],
        ERLS_COMPANY_ID, ERLS_EMERGENCY_MODEL_ID);

    if (!model) {
        LOG_ERR("Emergency model not found");
        return -ENOENT;
    }

    if (model->keys[0] == BT_MESH_KEY_UNUSED) {
        LOG_ERR("Emergency model not bound to app key");
        return -ENOENT;
    }

    ctx.app_idx = model->keys[0];

    erls_encode_emergency_msg(payload, &msg);

    BT_MESH_MODEL_BUF_DEFINE(buf, ERLS_OP_EMERGENCY_ALERT, ERLS_EMERGENCY_MSG_SIZE);
    bt_mesh_model_msg_init(&buf, ERLS_OP_EMERGENCY_ALERT);
    net_buf_simple_add_mem(&buf, payload, sizeof(payload));

    err = bt_mesh_model_send(model, &ctx, &buf, NULL, NULL);
    if (err) {
        LOG_ERR("Failed to send emergency alert: %d", err);
        return err;
    }

    current_emergency.type = type;
    current_emergency.status = ERLS_STATUS_ACTIVE;
    current_emergency.beacon_id = local_beacon_id;
    current_emergency.timestamp = msg.timestamp;

    LOG_INF("Emergency alert sent: type=%d", type);
    return 0;
}

int erls_send_location_update(const struct erls_location_msg *msg) {
    struct bt_mesh_msg_ctx ctx = {
        .addr = BT_MESH_ADDR_ALL_NODES,
        .send_ttl = BT_MESH_TTL_DEFAULT,
    };
    uint8_t payload[ERLS_LOCATION_MSG_SIZE];
    int err;

    if (!msg) {
        return -EINVAL;
    }

    const struct bt_mesh_comp *comp = mesh_get_comp();
    const struct bt_mesh_model *model = bt_mesh_model_find_vnd(
        &comp->elem[0],
        ERLS_COMPANY_ID, ERLS_LOCATION_MODEL_ID);

    if (!model) {
        LOG_ERR("Location model not found");
        return -ENOENT;
    }

    if (model->keys[0] == BT_MESH_KEY_UNUSED) {
        LOG_ERR("Location model not bound to app key");
        return -ENOENT;
    }

    ctx.app_idx = model->keys[0];

    erls_encode_location_msg(payload, msg);

    BT_MESH_MODEL_BUF_DEFINE(buf, ERLS_OP_LOCATION_UPDATE, ERLS_LOCATION_MSG_SIZE);
    bt_mesh_model_msg_init(&buf, ERLS_OP_LOCATION_UPDATE);
    net_buf_simple_add_mem(&buf, payload, sizeof(payload));

    err = bt_mesh_model_send(model, &ctx, &buf, NULL, NULL);
    if (err) {
        LOG_ERR("Failed to send location update: %d", err);
        return err;
    }

    LOG_DBG("Location update sent: user=0x%08x", msg->user_id);
    return 0;
}

int erls_clear_emergency(void) {
    struct bt_mesh_msg_ctx ctx = {
        .addr = BT_MESH_ADDR_ALL_NODES,
        .send_ttl = BT_MESH_TTL_DEFAULT,
    };
    int err;

    const struct bt_mesh_comp *comp = mesh_get_comp();
    const struct bt_mesh_model *model = bt_mesh_model_find_vnd(
        &comp->elem[0],
        ERLS_COMPANY_ID, ERLS_EMERGENCY_MODEL_ID);

    if (!model || model->keys[0] == BT_MESH_KEY_UNUSED) {
        return -ENOENT;
    }

    ctx.app_idx = model->keys[0];

    BT_MESH_MODEL_BUF_DEFINE(buf, ERLS_OP_EMERGENCY_CLEAR, 4);
    bt_mesh_model_msg_init(&buf, ERLS_OP_EMERGENCY_CLEAR);
    net_buf_simple_add_le32(&buf, 0);  /* TODO: user ID */

    err = bt_mesh_model_send(model, &ctx, &buf, NULL, NULL);
    if (err) {
        LOG_ERR("Failed to send emergency clear: %d", err);
        return err;
    }

    current_emergency.type = ERLS_EMERGENCY_NONE;
    current_emergency.status = ERLS_STATUS_RESOLVED;

    LOG_INF("Emergency cleared");
    return 0;
}

enum erls_emergency_status erls_get_emergency_status(void) {
    return current_emergency.status;
}

enum erls_emergency_type erls_get_emergency_type(void) {
    return current_emergency.type;
}

int erls_models_bind_app_key(uint16_t app_idx) {
    const struct bt_mesh_comp *comp = mesh_get_comp();
    const struct bt_mesh_model *emergency_model;
    const struct bt_mesh_model *location_model;
    int i;

    LOG_INF("Binding app key %d to ERLS models", app_idx);

    emergency_model = bt_mesh_model_find_vnd(&comp->elem[0], ERLS_COMPANY_ID, ERLS_EMERGENCY_MODEL_ID);
    if (!emergency_model) {
        LOG_ERR("Emergency model not found");
        return -ENOENT;
    }

    for (i = 0; i < emergency_model->keys_cnt; i++) {
        if (emergency_model->keys[i] == BT_MESH_KEY_UNUSED) {
            emergency_model->keys[i] = app_idx;
            LOG_INF("Bound app key %d to Emergency model (slot %d)", app_idx, i);
            break;
        }
    }
    if (i == emergency_model->keys_cnt) {
        LOG_ERR("No free key slot in Emergency model");
        return -ENOMEM;
    }

    location_model = bt_mesh_model_find_vnd(&comp->elem[0], ERLS_COMPANY_ID, ERLS_LOCATION_MODEL_ID);
    if (!location_model) {
        LOG_ERR("Location model not found");
        return -ENOENT;
    }

    /* Bind app key to location model */
    for (i = 0; i < location_model->keys_cnt; i++) {
        if (location_model->keys[i] == BT_MESH_KEY_UNUSED) {
            location_model->keys[i] = app_idx;
            LOG_INF("Bound app key %d to Location model (slot %d)", app_idx, i);
            break;
        }
    }
    if (i == location_model->keys_cnt) {
        LOG_ERR("No free key slot in Location model");
        return -ENOMEM;
    }

    return 0;
}
