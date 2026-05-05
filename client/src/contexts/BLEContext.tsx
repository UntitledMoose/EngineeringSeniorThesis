import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import { useBLE, type UseBLEReturn } from '@/hooks/useBLE';
import { useGATT, type UseGATTReturn } from '@/hooks/useGATT';

// Maintain a GATT connection to the nearest beacon when its signal is this
// strong or better. Below this threshold we disconnect to save radio resources.
const GATT_AUTO_CONNECT_RSSI = -80;

interface BLEContextValue {
  ble: UseBLEReturn;
  gatt: UseGATTReturn;
}

const BLEContext = createContext<BLEContextValue | null>(null);

/**
 * Provides a single shared BLE scanner AND GATT connection for the whole app.
 * Mount this at the authenticated app layout level so scanning persists across
 * tab switches and is never duplicated.
 *
 * Scanning runs continuously. GATT auto-connects to the nearest beacon when
 * its signal is adequate and disconnects are handled by onDisconnectPeripheral
 * inside useGATT. The burst scanner avoids calling stopScan() explicitly so
 * that it never resets the BLE adapter state while a GATT connection is live.
 */
export function BLEProvider({ children }: { children: ReactNode }) {
  const ble  = useBLE({ autoStart: true });
  const gatt = useGATT();

  // Keep a ref to the latest gatt object so the effect below doesn't need it
  // as a dependency (avoids reconnecting on every render).
  const gattRef = useRef(gatt);
  gattRef.current = gatt;

  // Auto-connect when a new (or different) beacon becomes visible.
  // Only depends on beacon ID — RSSI fluctuates every burst and would cause
  // constant reconnect cycles if included. RSSI is checked once at connect time.
  // GATT disconnections are handled by onDisconnectPeripheral inside useGATT;
  // we never call disconnect() from here.
  useEffect(() => {
    const nearest = ble.nearestBeacon;
    if (
      nearest &&
      gattRef.current.connectedId !== nearest.id &&
      !gattRef.current.isConnecting &&
      nearest.rssi >= GATT_AUTO_CONNECT_RSSI
    ) {
      gattRef.current.connect(nearest.id);
    }
  }, [ble.nearestBeacon?.id]); // intentionally excludes rssi

  return (
    <BLEContext.Provider value={{ ble, gatt }}>
      {children}
    </BLEContext.Provider>
  );
}

/** Returns the shared BLE scanning state (beacons, isScanning, etc.). */
export function useBLEContext(): UseBLEReturn {
  const ctx = useContext(BLEContext);
  if (!ctx) {
    throw new Error('useBLEContext must be used inside <BLEProvider>');
  }
  return ctx.ble;
}

/** Returns the shared GATT connection state and commands. */
export function useGATTContext(): UseGATTReturn {
  const ctx = useContext(BLEContext);
  if (!ctx) {
    throw new Error('useGATTContext must be used inside <BLEProvider>');
  }
  return ctx.gatt;
}
