import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import BleManager, {
  BleDiscoverPeripheralEvent,
  BleManagerDidUpdateStateEvent,
  BleStopScanEvent,
} from 'react-native-ble-manager';

// ERLS GATT Service UUID (matches firmware)
const ERLS_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';

// Short burst scanning: 3 s on / 3 s off = 6 s cycle.
// Android allows at most 5 scan starts per 30 s before throttling,
// so a 6 s cycle (5 starts / 30 s) is right at the safe limit.
const SCAN_BURST_MS = 3000;
const SCAN_PAUSE_MS = 3000;
const SCAN_THROTTLE_RETRY_MS = 10000; // back-off on throttle error
const STALE_BEACON_MS = 12000;        // drop beacon if not seen in 2 cycles

// Exponential moving average weight for new RSSI readings.
// Higher = more responsive to movement, lower = smoother noise filtering.
// 0.7 converges to the true RSSI within the first burst (allowDuplicates:true
// gives many readings per burst, so noise is already averaged within each burst).
const RSSI_EMA_ALPHA = 0.7;

export interface BeaconReading {
  id: string;
  hardwareId: string;
  name: string | null;
  rssi: number;
  lastSeen: Date;
}

interface UseBLEOptions {
  autoStart?: boolean;
}

export interface UseBLEReturn {
  isScanning: boolean;
  isBluetoothOn: boolean;
  hasPermissions: boolean;
  beacons: Map<string, BeaconReading>;
  nearestBeacon: BeaconReading | null;
  startScan: () => void;
  stopScan: () => void;
  requestPermissions: () => Promise<boolean>;
  error: string | null;
}

export function useBLE({ autoStart = false }: UseBLEOptions = {}): UseBLEReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [isBluetoothOn, setIsBluetoothOn] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [beacons, setBeacons] = useState<Map<string, BeaconReading>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Refs let the burst loop read current values without being in dependency arrays
  const burstActiveRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isBluetoothOnRef = useRef(false);
  const hasPermissionsRef = useRef(false);
  const isInitialized = useRef(false);

  // Keep refs in sync
  useEffect(() => { isBluetoothOnRef.current = isBluetoothOn; }, [isBluetoothOn]);
  useEffect(() => { hasPermissionsRef.current = hasPermissions; }, [hasPermissions]);

  // ── Burst loop ───────────────────────────────────────────────────────────
  // Uses only refs and stable values so it can have an empty dep array.
  const runBurst = useCallback(() => {
    if (!burstActiveRef.current) return;

    if (!isBluetoothOnRef.current || !hasPermissionsRef.current) {
      // Not ready yet — check again after a short delay
      timerRef.current = setTimeout(runBurst, 2000);
      return;
    }

    BleManager.scan({
      serviceUUIDs: [],
      seconds: SCAN_BURST_MS / 1000,
      allowDuplicates: true,
    })
      .then(() => {
        setIsScanning(true);
        setError(null);
        // Let the scan expire naturally via the 'seconds' parameter — do NOT
        // call BleManager.stopScan() here. An explicit stopScan() can reset
        // the BLE adapter state on Android and drop active GATT connections.
        // The onStopScan listener below will clear isScanning when the OS ends
        // the scan. We just schedule the next burst after the window.
        timerRef.current = setTimeout(() => {
          setIsScanning(false);
          if (burstActiveRef.current) {
            timerRef.current = setTimeout(runBurst, SCAN_PAUSE_MS);
          }
        }, SCAN_BURST_MS);
      })
      .catch((err: Error) => {
        const msg = err?.message ?? String(err);
        console.warn('[BLE] Scan burst failed, backing off:', msg);
        setIsScanning(false);
        setError(msg);
        // Back off significantly on throttle / permission errors
        if (burstActiveRef.current) {
          timerRef.current = setTimeout(runBurst, SCAN_THROTTLE_RETRY_MS);
        }
      });
  }, []); // intentionally empty — reads everything through refs

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Public controls ──────────────────────────────────────────────────────
  const startScan = useCallback(() => {
    if (burstActiveRef.current) return; // already running
    burstActiveRef.current = true;
    runBurst();
  }, [runBurst]);

  const stopScan = useCallback(() => {
    burstActiveRef.current = false;
    clearTimer();
    BleManager.stopScan();
    setIsScanning(false);
  }, [clearTimer]);

  // ── Permissions ──────────────────────────────────────────────────────────
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setHasPermissions(true);
      return true;
    }
    try {
      if (typeof Platform.Version === 'number' && Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        const ok = Object.values(granted).every(
          (s) => s === PermissionsAndroid.RESULTS.GRANTED
        );
        setHasPermissions(ok);
        return ok;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermissions(ok);
        return ok;
      }
    } catch (err) {
      console.error('[BLE] Permission error:', err);
      return false;
    }
  }, []);

  // ── BleManager init + event subscriptions ────────────────────────────────
  useEffect(() => {
    BleManager.start({ showAlert: false })
      .then(() => {
        isInitialized.current = true;
        BleManager.checkState();
      })
      .catch((err: Error) => console.error('[BLE] Init error:', err));

    const subs = [
      BleManager.onDidUpdateState(({ state }: BleManagerDidUpdateStateEvent) => {
        const on = state === 'on';
        setIsBluetoothOn(on);
        isBluetoothOnRef.current = on;
        if (!on && burstActiveRef.current) {
          // BT turned off mid-loop — pause; runBurst will retry when it comes back
          clearTimer();
          BleManager.stopScan().catch(() => {});
          setIsScanning(false);
          timerRef.current = setTimeout(runBurst, 2000);
        }
      }),

      BleManager.onDiscoverPeripheral((peripheral: BleDiscoverPeripheralEvent) => {
        const advServiceUUIDs: string[] = peripheral.advertising?.serviceUUIDs ?? [];
        const isErlsBeacon =
          peripheral.name === 'ERLSBeacon' ||
          advServiceUUIDs.some(
            (uuid) => uuid.toLowerCase() === ERLS_SERVICE_UUID.toLowerCase()
          );

        if (!isErlsBeacon || peripheral.rssi == null) return;

        setBeacons((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(peripheral.id);
          const rawRssi = peripheral.rssi!;
          // Blend new reading with previous using EMA to dampen RF noise.
          // On first sight use the raw value directly.
          const smoothedRssi = existing != null
            ? Math.round(RSSI_EMA_ALPHA * rawRssi + (1 - RSSI_EMA_ALPHA) * existing.rssi)
            : rawRssi;
          updated.set(peripheral.id, {
            id: peripheral.id,
            hardwareId: peripheral.id,
            name: peripheral.name ?? null,
            rssi: smoothedRssi,
            lastSeen: new Date(),
          });
          return updated;
        });
      }),

      // onStopScan fires when the BLE stack reports the scan finished.
      // We don't use it to drive the loop (the setTimeout does that) but we
      // keep the state consistent in case the OS stops the scan early.
      BleManager.onStopScan((_event: BleStopScanEvent) => {
        setIsScanning(false);
      }),
    ];

    return () => {
      subs.forEach((s) => s.remove());
    };
  }, [clearTimer, runBurst]);

  // ── Auto-start ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoStart) return;

    const bootstrap = async () => {
      const ok = await requestPermissions();
      if (ok) startScan();
    };
    bootstrap();

    return () => stopScan();
  }, [autoStart]); // only runs once on mount / unmount

  // ── Stale beacon cleanup ─────────────────────────────────────────────────
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - STALE_BEACON_MS;
      setBeacons((prev) => {
        let changed = false;
        const updated = new Map(prev);
        for (const [id, beacon] of updated) {
          if (beacon.lastSeen.getTime() < cutoff) {
            updated.delete(id);
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, SCAN_BURST_MS + SCAN_PAUSE_MS); // run every full cycle

    return () => clearInterval(cleanupInterval);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const nearestBeacon = Array.from(beacons.values()).reduce<BeaconReading | null>(
    (nearest, beacon) => (!nearest || beacon.rssi > nearest.rssi ? beacon : nearest),
    null
  );

  return {
    isScanning,
    isBluetoothOn,
    hasPermissions,
    beacons,
    nearestBeacon,
    startScan,
    stopScan,
    requestPermissions,
    error,
  };
}
