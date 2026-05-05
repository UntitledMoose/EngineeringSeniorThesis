#ifndef LORA_BRIDGE_H
#define LORA_BRIDGE_H

#include <zephyr/kernel.h>
#include "../mesh/mesh_msg.h"

#define LORA_FREQUENCY          915000000
#define LORA_BANDWIDTH          0
#define LORA_SPREADING_FACTOR   7
#define LORA_CODING_RATE        1
#define LORA_TX_POWER           14

enum lora_msg_type {
    LORA_MSG_EMERGENCY = 0x01,
    LORA_MSG_LOCATION  = 0x02,
    LORA_MSG_TELEMETRY = 0x03,
    LORA_MSG_HEARTBEAT = 0x04,
};

struct lora_packet_header {
    uint8_t  msg_type;
    uint8_t  hop_count;
    uint16_t src_bridge;
    uint16_t dst_bridge;
    uint16_t seq_num;
} __packed;

#define LORA_HEADER_SIZE 8
#define LORA_MAX_PAYLOAD 240

int lora_bridge_init(void);

bool lora_bridge_is_enabled(void);

int lora_bridge_send_emergency(const struct erls_emergency_msg *msg);

int lora_bridge_queue_location(const struct erls_location_msg *msg);

int lora_bridge_send_telemetry(const struct erls_telemetry_msg *msg);

int lora_bridge_flush_locations(void);

void lora_bridge_get_stats(uint32_t *tx_count, uint32_t *rx_count, uint32_t *tx_errors);

#endif /* LORA_BRIDGE_H */
