#include <zephyr/sys/byteorder.h>
#include <string.h>
#include "mesh_msg.h"

int erls_encode_location_msg(uint8_t *buf, const struct erls_location_msg *msg) {
    if (!buf || !msg) {
        return -EINVAL;
    }

    sys_put_le32(msg->user_id, &buf[0]);
    sys_put_le32(msg->beacon_id, &buf[4]);
    buf[8] = (uint8_t)msg->rssi;
    sys_put_le32(msg->timestamp, &buf[9]);

    return ERLS_LOCATION_MSG_SIZE;
}

int erls_decode_location_msg(const uint8_t *buf, size_t len, struct erls_location_msg *msg) {
    if (!buf || !msg) {
        return -EINVAL;
    }

    if (len < ERLS_LOCATION_MSG_SIZE) {
        return -EMSGSIZE;
    }

    msg->user_id = sys_get_le32(&buf[0]);
    msg->beacon_id = sys_get_le32(&buf[4]);
    msg->rssi = (int8_t)buf[8];
    msg->timestamp = sys_get_le32(&buf[9]);

    return 0;
}

int erls_encode_emergency_msg(uint8_t *buf, const struct erls_emergency_msg *msg) {
    if (!buf || !msg) {
        return -EINVAL;
    }

    buf[0] = msg->type;
    sys_put_le32(msg->initiator_id, &buf[1]);
    sys_put_le32(msg->beacon_id, &buf[5]);
    sys_put_le32(msg->timestamp, &buf[9]);

    return ERLS_EMERGENCY_MSG_SIZE;
}

int erls_decode_emergency_msg(const uint8_t *buf, size_t len, struct erls_emergency_msg *msg) {
    if (!buf || !msg) {
        return -EINVAL;
    }

    if (len < ERLS_EMERGENCY_MSG_SIZE) {
        return -EMSGSIZE;
    }

    msg->type = buf[0];
    msg->initiator_id = sys_get_le32(&buf[1]);
    msg->beacon_id = sys_get_le32(&buf[5]);
    msg->timestamp = sys_get_le32(&buf[9]);

    return 0;
}

int erls_encode_telemetry_msg(uint8_t *buf, const struct erls_telemetry_msg *msg) {
    if (!buf || !msg) {
        return -EINVAL;
    }

    sys_put_le32(msg->beacon_id, &buf[0]);
    sys_put_le16(msg->battery_mv, &buf[4]);
    buf[6] = msg->mesh_neighbors;
    sys_put_le32(msg->uptime_sec, &buf[7]);
    buf[11] = msg->msg_queue_depth;

    return ERLS_TELEMETRY_MSG_SIZE;
}

int erls_decode_telemetry_msg(const uint8_t *buf, size_t len, struct erls_telemetry_msg *msg) {
    if (!buf || !msg) {
        return -EINVAL;
    }

    if (len < ERLS_TELEMETRY_MSG_SIZE) {
        return -EMSGSIZE;
    }

    msg->beacon_id = sys_get_le32(&buf[0]);
    msg->battery_mv = sys_get_le16(&buf[4]);
    msg->mesh_neighbors = buf[6];
    msg->uptime_sec = sys_get_le32(&buf[7]);
    msg->msg_queue_depth = buf[11];

    return 0;
}
