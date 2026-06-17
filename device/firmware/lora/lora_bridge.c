#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/lora.h>
#include <zephyr/sys/byteorder.h>
#include <zephyr/random/random.h>

#include "lora_bridge.h"
#include "../mesh/mesh_msg.h"
#include "../mesh/mesh_models.h"

#define LOG_MODULE_NAME lora_bridge
#include <zephyr/logging/log.h>
LOG_MODULE_REGISTER(LOG_MODULE_NAME, LOG_LEVEL_DBG);

/* LoRa device */
static const struct device *lora_dev;

/* Bridge state */
static bool bridge_enabled;
static uint16_t bridge_id;
static uint16_t sequence_num;

/* Statistics */
static uint32_t tx_count;
static uint32_t rx_count;
static uint32_t tx_errors;

/* Location message queue */
#define LOCATION_QUEUE_SIZE 16
static struct erls_location_msg location_queue[LOCATION_QUEUE_SIZE];
static uint8_t location_queue_head;
static uint8_t location_queue_count;
static struct k_mutex queue_mutex;

/* Receive buffer */
static uint8_t rx_buffer[256];

/* Receive thread */
#define RX_THREAD_STACK_SIZE 2048
#define RX_THREAD_PRIORITY 7
static K_THREAD_STACK_DEFINE(rx_thread_stack, RX_THREAD_STACK_SIZE);
static struct k_thread rx_thread_data;

/* Deduplication - track recent sequence numbers */
#define DEDUP_TABLE_SIZE 32
static struct {
    uint16_t src_bridge;
    uint16_t seq_num;
} dedup_table[DEDUP_TABLE_SIZE];
static uint8_t dedup_index;

static bool is_duplicate(uint16_t src_bridge, uint16_t seq_num)
{
    for (int i = 0; i < DEDUP_TABLE_SIZE; i++) {
        if (dedup_table[i].src_bridge == src_bridge &&
            dedup_table[i].seq_num == seq_num) {
            return true;
        }
    }

    /* Add to dedup table */
    dedup_table[dedup_index].src_bridge = src_bridge;
    dedup_table[dedup_index].seq_num = seq_num;
    dedup_index = (dedup_index + 1) % DEDUP_TABLE_SIZE;

    return false;
}

static int send_packet(enum lora_msg_type type, const uint8_t *payload,
                        size_t payload_len)
{
    uint8_t packet[256];
    struct lora_packet_header *hdr = (struct lora_packet_header *)packet;
    int ret;

    if (!bridge_enabled || !lora_dev) {
        return -ENODEV;
    }

    if (payload_len > LORA_MAX_PAYLOAD) {
        return -EMSGSIZE;
    }

    /* Build packet header */
    hdr->msg_type = type;
    hdr->hop_count = 0;
    hdr->src_bridge = sys_cpu_to_le16(bridge_id);
    hdr->dst_bridge = sys_cpu_to_le16(0xFFFF);  /* Broadcast */
    hdr->seq_num = sys_cpu_to_le16(sequence_num++);

    /* Copy payload */
    memcpy(packet + LORA_HEADER_SIZE, payload, payload_len);

    /* Send */
    ret = lora_send(lora_dev, packet, LORA_HEADER_SIZE + payload_len);
    if (ret < 0) {
        LOG_ERR("LoRa send failed: %d", ret);
        tx_errors++;
        return ret;
    }

    tx_count++;
    LOG_DBG("LoRa TX: type=%d, len=%zu", type, payload_len);
    return 0;
}

static void handle_received_packet(const uint8_t *data, size_t len, int16_t rssi,
                                    int8_t snr)
{
    struct lora_packet_header *hdr;
    const uint8_t *payload;
    size_t payload_len;
    uint16_t src_bridge, seq_num;

    if (len < LORA_HEADER_SIZE) {
        LOG_WRN("LoRa packet too short: %zu", len);
        return;
    }

    hdr = (struct lora_packet_header *)data;
    payload = data + LORA_HEADER_SIZE;
    payload_len = len - LORA_HEADER_SIZE;

    src_bridge = sys_le16_to_cpu(hdr->src_bridge);
    seq_num = sys_le16_to_cpu(hdr->seq_num);

    /* Check for duplicates */
    if (is_duplicate(src_bridge, seq_num)) {
        LOG_DBG("Duplicate packet from bridge 0x%04x, seq %d", src_bridge, seq_num);
        return;
    }

    rx_count++;
    LOG_INF("LoRa RX: type=%d from bridge 0x%04x (RSSI: %d, SNR: %d)",
            hdr->msg_type, src_bridge, rssi, snr);

    /* Process based on message type */
    switch (hdr->msg_type) {
    case LORA_MSG_EMERGENCY: {
        struct erls_emergency_msg msg;
        if (payload_len >= ERLS_EMERGENCY_MSG_SIZE) {
            erls_decode_emergency_msg(payload, payload_len, &msg);
            LOG_WRN("LoRa emergency: type=%d from user 0x%08x",
                    msg.type, msg.initiator_id);
            /* Forward to local mesh network */
            erls_send_emergency_alert(msg.type);
        }
        break;
    }

    case LORA_MSG_LOCATION: {
        struct erls_location_msg msg;
        if (payload_len >= ERLS_LOCATION_MSG_SIZE) {
            erls_decode_location_msg(payload, payload_len, &msg);
            LOG_DBG("LoRa location: user 0x%08x at beacon 0x%08x",
                    msg.user_id, msg.beacon_id);
            /* Forward to local mesh network */
            erls_send_location_update(&msg);
        }
        break;
    }

    case LORA_MSG_TELEMETRY: {
        struct erls_telemetry_msg msg;
        if (payload_len >= ERLS_TELEMETRY_MSG_SIZE) {
            erls_decode_telemetry_msg(payload, payload_len, &msg);
            LOG_DBG("LoRa telemetry: beacon 0x%08x, battery %d mV",
                    msg.beacon_id, msg.battery_mv);
        }
        break;
    }

    case LORA_MSG_HEARTBEAT:
        LOG_DBG("LoRa heartbeat from bridge 0x%04x", src_bridge);
        break;

    default:
        LOG_WRN("Unknown LoRa message type: %d", hdr->msg_type);
        break;
    }
}

static void rx_thread_entry(void *p1, void *p2, void *p3)
{
    int ret;
    int16_t rssi;
    int8_t snr;

    LOG_INF("LoRa RX thread started");

    while (bridge_enabled) {
        /* Receive with timeout */
        ret = lora_recv(lora_dev, rx_buffer, sizeof(rx_buffer),
                        K_SECONDS(10), &rssi, &snr);
        if (ret > 0) {
            handle_received_packet(rx_buffer, ret, rssi, snr);
        } else if (ret < 0 && ret != -EAGAIN) {
            LOG_ERR("LoRa receive error: %d", ret);
            k_sleep(K_MSEC(100));
        }
    }

    LOG_INF("LoRa RX thread stopped");
}

int lora_bridge_init(void)
{
    struct lora_modem_config config = {
        .frequency = LORA_FREQUENCY,
        .bandwidth = LORA_BANDWIDTH,
        .datarate = LORA_SPREADING_FACTOR,
        .coding_rate = LORA_CODING_RATE,
        .preamble_len = 8,
        .tx_power = LORA_TX_POWER,
        .tx = true,
    };
    int ret;

    /* Get LoRa device */
    lora_dev = DEVICE_DT_GET(DT_ALIAS(lora0));
    if (!device_is_ready(lora_dev)) {
        LOG_WRN("LoRa device not ready - bridge disabled");
        return -ENODEV;
    }

    /* Configure LoRa modem */
    ret = lora_config(lora_dev, &config);
    if (ret < 0) {
        LOG_ERR("LoRa config failed: %d", ret);
        return ret;
    }

    /* Initialize queue mutex */
    k_mutex_init(&queue_mutex);

    /* Generate bridge ID from random */
    bridge_id = (uint16_t)sys_rand32_get();
    sequence_num = 0;

    bridge_enabled = true;

    /* Start receive thread */
    k_thread_create(&rx_thread_data, rx_thread_stack,
                    K_THREAD_STACK_SIZEOF(rx_thread_stack),
                    rx_thread_entry, NULL, NULL, NULL,
                    RX_THREAD_PRIORITY, 0, K_NO_WAIT);
    k_thread_name_set(&rx_thread_data, "lora_rx");

    LOG_INF("LoRa bridge initialized (ID: 0x%04x)", bridge_id);
    return 0;
}

bool lora_bridge_is_enabled(void)
{
    return bridge_enabled;
}

int lora_bridge_send_emergency(const struct erls_emergency_msg *msg)
{
    uint8_t payload[ERLS_EMERGENCY_MSG_SIZE];

    if (!msg) {
        return -EINVAL;
    }

    erls_encode_emergency_msg(payload, msg);
    return send_packet(LORA_MSG_EMERGENCY, payload, sizeof(payload));
}

int lora_bridge_queue_location(const struct erls_location_msg *msg)
{
    if (!msg) {
        return -EINVAL;
    }

    k_mutex_lock(&queue_mutex, K_FOREVER);

    if (location_queue_count >= LOCATION_QUEUE_SIZE) {
        k_mutex_unlock(&queue_mutex);
        LOG_WRN("Location queue full, dropping message");
        return -ENOMEM;
    }

    uint8_t idx = (location_queue_head + location_queue_count) % LOCATION_QUEUE_SIZE;
    memcpy(&location_queue[idx], msg, sizeof(*msg));
    location_queue_count++;

    k_mutex_unlock(&queue_mutex);
    return 0;
}

int lora_bridge_send_telemetry(const struct erls_telemetry_msg *msg)
{
    uint8_t payload[ERLS_TELEMETRY_MSG_SIZE];

    if (!msg) {
        return -EINVAL;
    }

    erls_encode_telemetry_msg(payload, msg);
    return send_packet(LORA_MSG_TELEMETRY, payload, sizeof(payload));
}

int lora_bridge_flush_locations(void)
{
    int sent = 0;
    uint8_t payload[ERLS_LOCATION_MSG_SIZE];

    k_mutex_lock(&queue_mutex, K_FOREVER);

    while (location_queue_count > 0) {
        struct erls_location_msg *msg = &location_queue[location_queue_head];

        erls_encode_location_msg(payload, msg);
        if (send_packet(LORA_MSG_LOCATION, payload, sizeof(payload)) == 0) {
            sent++;
        }

        location_queue_head = (location_queue_head + 1) % LOCATION_QUEUE_SIZE;
        location_queue_count--;

        /* Small delay between transmissions */
        k_sleep(K_MSEC(50));
    }

    k_mutex_unlock(&queue_mutex);

    if (sent > 0) {
        LOG_DBG("Flushed %d location updates", sent);
    }

    return sent;
}

void lora_bridge_get_stats(uint32_t *tx, uint32_t *rx, uint32_t *errors)
{
    if (tx) *tx = tx_count;
    if (rx) *rx = rx_count;
    if (errors) *errors = tx_errors;
}
