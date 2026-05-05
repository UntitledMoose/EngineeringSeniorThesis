/**
 * ERLS GATT protocol constants and crypto helpers.
 *
 * Characteristic UUIDs match the firmware (gatt_service.h).
 * Auth flow: read nonce from AUTH_UUID → HMAC-SHA256(secret, nonce||cmd) → write 49-byte
 * auth packet to TRIGGER_UUID.
 *
 * Uses a pure TypeScript HMAC-SHA256 (src/lib/sha256.ts) because Hermes
 * (React Native) does not expose crypto.subtle.
 */

import { hmacSha256 } from './sha256';

// ── UUIDs ─────────────────────────────────────────────────────────────────────
export const ERLS_SERVICE_UUID  = '12345678-1234-5678-1234-56789abcdef0';
export const ERLS_TRIGGER_UUID  = '12345678-1234-5678-1234-56789abcdef1'; // write
export const ERLS_STATUS_UUID   = '12345678-1234-5678-1234-56789abcdef2'; // read/notify
export const ERLS_INFO_UUID     = '12345678-1234-5678-1234-56789abcdef3'; // read
export const ERLS_AUTH_UUID     = '12345678-1234-5678-1234-56789abcdef4'; // read (nonce)

// ── Shared secret ─────────────────────────────────────────────────────────────
// "ERLS_SECRET_KEY!2024_TEST_ONLY!!" — matches firmware shared_secret[]
const SHARED_SECRET = new Uint8Array([
  0x45, 0x52, 0x4c, 0x53, 0x5f, 0x53, 0x45, 0x43,  // ERLS_SEC
  0x52, 0x45, 0x54, 0x5f, 0x4b, 0x45, 0x59, 0x21,  // RET_KEY!
  0x32, 0x30, 0x32, 0x34, 0x5f, 0x54, 0x45, 0x53,  // 2024_TES
  0x54, 0x5f, 0x4f, 0x4e, 0x4c, 0x59, 0x21, 0x21,  // T_ONLY!!
]);

// ── Command codes ─────────────────────────────────────────────────────────────
// Maps EmergencyType string → firmware erls_emergency_type enum value
export const ERLS_CMD: Record<string, number> = {
  clear:      0x00,
  fire:       0x01,
  lockdown:   0x02,
  medical:    0x03,
  weather:    0x04,
  evacuation: 0x05,
  other:      0x05,  // maps to ERLS_EMERGENCY_CUSTOM
};

// ── Human-readable names for firmware enum values ────────────────────────────
export const ERLS_TYPE_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Fire',
  2: 'Lockdown',
  3: 'Medical',
  4: 'Weather',
  5: 'Custom',
};

export const ERLS_STATUS_LABELS: Record<number, string> = {
  0: 'Inactive',
  1: 'Active',
  2: 'Acknowledged',
  3: 'Resolved',
};

// ── Auth packet builder ───────────────────────────────────────────────────────
/**
 * Builds the 49-byte auth packet for the Emergency Trigger characteristic.
 *   Layout: nonce[16] | HMAC-SHA256(secret, nonce || cmd)[32] | cmd[1]
 *
 * Synchronous — uses the pure-JS hmacSha256 (no crypto.subtle needed).
 */
export function buildAuthPacket(nonce: Uint8Array, cmd: number): number[] {
  // auth_data = nonce[16] + cmd[1]  (matches firmware: memcpy + auth_data[16] = cmd)
  const authData = new Uint8Array(17);
  authData.set(nonce, 0);
  authData[16] = cmd;

  const hmac = hmacSha256(SHARED_SECRET, authData);

  // packet = nonce[16] + hmac[32] + cmd[1]  (49 bytes total)
  const packet = new Uint8Array(49);
  packet.set(nonce, 0);
  packet.set(hmac, 16);
  packet[48] = cmd;

  return Array.from(packet);
}
