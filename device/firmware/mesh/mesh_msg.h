#ifndef MESH_MSG_H
#define MESH_MSG_H

#include <zephyr/kernel.h>

struct erls_location_msg {
    uint32_t user_id;
    uint32_t beacon_id;
    int8_t   rssi;
    uint32_t timestamp;
} __packed;

#define ERLS_LOCATION_MSG_SIZE 13

struct erls_emergency_msg {
    uint8_t  type;
    uint32_t initiator_id;
    uint32_t beacon_id;
    uint32_t timestamp;
} __packed;

#define ERLS_EMERGENCY_MSG_SIZE 13

struct erls_telemetry_msg {
    uint32_t beacon_id;
    uint16_t battery_mv;
    uint8_t  mesh_neighbors;
    uint32_t uptime_sec;
    uint8_t  msg_queue_depth;
} __packed;

#define ERLS_TELEMETRY_MSG_SIZE 12

int erls_encode_location_msg(uint8_t *buf, const struct erls_location_msg *msg);

int erls_decode_location_msg(const uint8_t *buf, size_t len, struct erls_location_msg *msg);

int erls_encode_emergency_msg(uint8_t *buf, const struct erls_emergency_msg *msg);

int erls_decode_emergency_msg(const uint8_t *buf, size_t len, struct erls_emergency_msg *msg);

int erls_encode_telemetry_msg(uint8_t *buf, const struct erls_telemetry_msg *msg);

int erls_decode_telemetry_msg(const uint8_t *buf, size_t len, struct erls_telemetry_msg *msg);

#endif /* MESH_MSG_H */
