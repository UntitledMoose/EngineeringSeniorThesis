/**
 * useGATT — manages a GATT connection to a single ERLS beacon.
 *
 * Protocol:
 *   1. connect(peripheralId)  — BLE connect + retrieveServices + subscribe status notify
 *                               + read initial status and beacon hardware ID
 *   2. triggerEmergency(type) — read nonce → build HMAC auth packet → write trigger char
 *                               → re-read status so UI reflects hardware state immediately
 *   3. clearEmergency()       — same flow with cmd=0x00
 *
 * This hook is consumed via BLEContext (useGATTContext()), which auto-connects
 * to the nearest beacon and keeps one connection alive app-wide.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import BleManager, {
  BleDisconnectPeripheralEvent,
  BleManagerDidUpdateValueForCharacteristicEvent,
} from 'react-native-ble-manager';

import {
  ERLS_SERVICE_UUID,
  ERLS_AUTH_UUID,
  ERLS_TRIGGER_UUID,
  ERLS_STATUS_UUID,
  ERLS_INFO_UUID,
  ERLS_CMD,
  buildAuthPacket,
} from '@/lib/erls-gatt';
import type { EmergencyType } from '@/types/database';

export interface GATTBeaconStatus {
  /** erls_emergency_type enum value (0=none, 1=fire, 2=lockdown, 3=medical, 4=weather, 5=custom) */
  emergencyType: number;
  /** erls_emergency_status enum value (0=inactive, 1=active, 2=acknowledged, 3=resolved) */
  emergencyStatus: number;
}

export interface UseGATTReturn {
  /** Peripheral ID of the currently connected beacon, or null. */
  connectedId: string | null;
  /** Latest status pushed via notify (or polled on connect / after command). */
  beaconStatus: GATTBeaconStatus | null;
  /** 32-bit hardware ID read from the Beacon Info characteristic. */
  beaconHardwareId: number | null;
  isConnecting: boolean;
  error: string | null;
  connect: (peripheralId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  triggerEmergency: (type: EmergencyType) => Promise<{ error: string | null }>;
  clearEmergency: () => Promise<{ error: string | null }>;
}

export function useGATT(): UseGATTReturn {
  const [connectedId, setConnectedId]           = useState<string | null>(null);
  const [beaconStatus, setBeaconStatus]         = useState<GATTBeaconStatus | null>(null);
  const [beaconHardwareId, setBeaconHardwareId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting]         = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  // Refs are updated SYNCHRONOUSLY so event callbacks always see current state
  // without depending on React's async render cycle.
  const connectedIdRef   = useRef<string | null>(null);
  const isConnectingRef  = useRef(false);

  // ── Event: characteristic value updated (status notifications) ─────────────
  useEffect(() => {
    const sub = BleManager.onDidUpdateValueForCharacteristic(
      (event: BleManagerDidUpdateValueForCharacteristicEvent) => {
        if (
          event.peripheral !== connectedIdRef.current ||
          event.characteristic.toLowerCase() !== ERLS_STATUS_UUID.toLowerCase()
        ) return;
        if (event.value.length >= 2) {
          setBeaconStatus({ emergencyType: event.value[0], emergencyStatus: event.value[1] });
        }
      }
    );
    return () => sub.remove();
  }, []);

  // ── Event: peripheral disconnected ─────────────────────────────────────────
  useEffect(() => {
    const sub = BleManager.onDisconnectPeripheral(
      (event: BleDisconnectPeripheralEvent) => {
        if (event.peripheral !== connectedIdRef.current) return;
        connectedIdRef.current  = null;
        isConnectingRef.current = false;
        setConnectedId(null);
        setBeaconStatus(null);
        setBeaconHardwareId(null);
        setIsConnecting(false);
      }
    );
    return () => sub.remove();
  }, []);

  // ── Periodic status poll (belt-and-suspenders for missed notify events) ────
  useEffect(() => {
    if (!connectedId) return;
    const id = connectedId;
    const timer = setInterval(async () => {
      // Only poll if we are still connected to the same peripheral
      if (connectedIdRef.current !== id) return;
      try {
        const statusBytes = await BleManager.read(id, ERLS_SERVICE_UUID, ERLS_STATUS_UUID);
        if (statusBytes.length >= 2) {
          setBeaconStatus({ emergencyType: statusBytes[0], emergencyStatus: statusBytes[1] });
        }
      } catch (_) {
        // Ignore — disconnect event will clean up if the device is gone
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [connectedId]);

  // ── connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(async (peripheralId: string) => {
    if (connectedIdRef.current === peripheralId) return; // already connected
    if (isConnectingRef.current) return;

    // Disconnect from previous beacon before switching
    if (connectedIdRef.current) {
      const prev = connectedIdRef.current;
      connectedIdRef.current = null;
      try {
        await BleManager.stopNotification(prev, ERLS_SERVICE_UUID, ERLS_STATUS_UUID);
        await BleManager.disconnect(prev);
      } catch (_) {}
      setConnectedId(null);
      setBeaconStatus(null);
      setBeaconHardwareId(null);
    }

    // Mark connecting synchronously so the event listener and re-entrant calls
    // see the updated state before the first await.
    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);

    try {
      await BleManager.connect(peripheralId);
      // retrieveServices is required on Android before any read/write/notify
      await BleManager.retrieveServices(peripheralId);

      // Request a higher MTU so the 49-byte auth packet fits in one ATT write.
      // Default MTU is 23 bytes (20 bytes payload) which would truncate the packet.
      // 64 bytes gives 61 bytes payload, comfortably above 49. Ignore failures —
      // some devices don't support MTU negotiation; the write still works via the
      // Write Long (Prepare/Execute) procedure in that case.
      try {
        await BleManager.requestMTU(peripheralId, 64);
      } catch (_) {}

      // Subscribe to emergency status notifications
      await BleManager.startNotification(peripheralId, ERLS_SERVICE_UUID, ERLS_STATUS_UUID);

      // Read current status
      const statusBytes = await BleManager.read(peripheralId, ERLS_SERVICE_UUID, ERLS_STATUS_UUID);
      if (statusBytes.length >= 2) {
        setBeaconStatus({ emergencyType: statusBytes[0], emergencyStatus: statusBytes[1] });
      }

      // Read hardware beacon ID (uint32_t little-endian)
      const infoBytes = await BleManager.read(peripheralId, ERLS_SERVICE_UUID, ERLS_INFO_UUID);
      if (infoBytes.length >= 4) {
        const hwId =
          (infoBytes[0]) |
          (infoBytes[1] << 8) |
          (infoBytes[2] << 16) |
          (infoBytes[3] << 24);
        setBeaconHardwareId(hwId >>> 0); // treat as unsigned
      }

      // Update ref synchronously before setState so any queued events see it
      connectedIdRef.current = peripheralId;
      setConnectedId(peripheralId);
    } catch (err) {
      connectedIdRef.current = null;
      setError(err instanceof Error ? err.message : 'GATT connection failed');
    } finally {
      isConnectingRef.current = false;
      setIsConnecting(false);
    }
  }, []);

  // ── disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    const id = connectedIdRef.current;
    if (!id) return;
    connectedIdRef.current = null;
    setConnectedId(null);
    setBeaconStatus(null);
    setBeaconHardwareId(null);
    try {
      await BleManager.stopNotification(id, ERLS_SERVICE_UUID, ERLS_STATUS_UUID);
      await BleManager.disconnect(id);
    } catch (_) {}
  }, []);

  // ── sendCommand (internal) ─────────────────────────────────────────────────
  const sendCommand = useCallback(async (cmd: number): Promise<{ error: string | null }> => {
    const id = connectedIdRef.current;
    if (!id) return { error: 'Not connected to a beacon' };

    try {
      // 1. Read 16-byte nonce from auth challenge characteristic
      const nonceBytes = await BleManager.read(id, ERLS_SERVICE_UUID, ERLS_AUTH_UUID);
      if (nonceBytes.length < 16) {
        return { error: 'Beacon returned invalid nonce' };
      }
      const nonce = new Uint8Array(nonceBytes.slice(0, 16));

      // 2. Build 49-byte auth packet: nonce[16] + hmac[32] + cmd[1]
      const packet = buildAuthPacket(nonce, cmd);

      // 3. Write to emergency trigger characteristic.
      // maxByteSize=512 lets the library use Write Long (Prepare/Execute) if
      // the negotiated MTU payload is still < 49 bytes.
      await BleManager.write(id, ERLS_SERVICE_UUID, ERLS_TRIGGER_UUID, packet, 512);

      // 4. Re-read status immediately so UI reflects hardware state without
      //    waiting for the notify event (which may arrive slightly later).
      try {
        const statusBytes = await BleManager.read(id, ERLS_SERVICE_UUID, ERLS_STATUS_UUID);
        if (statusBytes.length >= 2) {
          setBeaconStatus({ emergencyType: statusBytes[0], emergencyStatus: statusBytes[1] });
        }
      } catch (_) {
        // Non-fatal: the notify event will update the UI shortly after
      }

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'GATT command failed' };
    }
  }, []);

  // ── triggerEmergency ───────────────────────────────────────────────────────
  const triggerEmergency = useCallback(
    async (type: EmergencyType): Promise<{ error: string | null }> => {
      const cmd = ERLS_CMD[type] ?? ERLS_CMD.other;
      return sendCommand(cmd);
    },
    [sendCommand]
  );

  // ── clearEmergency ─────────────────────────────────────────────────────────
  const clearEmergency = useCallback(
    async (): Promise<{ error: string | null }> => sendCommand(ERLS_CMD.clear),
    [sendCommand]
  );

  return {
    connectedId,
    beaconStatus,
    beaconHardwareId,
    isConnecting,
    error,
    connect,
    disconnect,
    triggerEmergency,
    clearEmergency,
  };
}
