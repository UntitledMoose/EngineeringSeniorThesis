import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { BeaconReading } from './useBLE';

interface RoomEstimate {
  roomId: string | null;
  roomName: string | null;
  buildingName: string | null;
  floorLevel: number | null;
  confidence: number;
}

interface BeaconInfo {
  id: string;
  room_id: string | null;
  hardware_id: string;
  tx_power_1m: number;
  room_name: string | null;
  building_name: string | null;
  floor_level: number;
}

interface UseLocationOptions {
  beacons: Map<string, BeaconReading>;
  updateIntervalMs?: number;
  autoReport?: boolean;
}

interface UseLocationReturn {
  currentRoom: RoomEstimate | null;
  isLocating: boolean;
  reportLocation: () => Promise<void>;
  error: string | null;
}

const PATH_LOSS_EXPONENT = 2.5;

// How many dBm stronger the new room's best beacon must be before we switch.
// This prevents oscillation near room boundaries caused by RF noise.
// 4 dBm is enough to block single-reading flips; EMA (alpha=0.7) already
// handles noise within each burst, so a high threshold isn't needed.
const ROOM_SWITCH_HYSTERESIS_DB = 4;

function rssiToDistance(rssi: number, txPower1m: number): number {
  if (rssi === 0) return -1;
  return Math.pow(10, (txPower1m - rssi) / (10 * PATH_LOSS_EXPONENT));
}

type Reading = {
  beaconId: string;
  rssi: number;
  distance: number;
  roomId: string | null;
  roomName: string | null;
  buildingName: string | null;
  floorLevel: number;
};

function estimateRoom(readings: Reading[]): { roomId: string | null; confidence: number } {
  if (readings.length === 0) return { roomId: null, confidence: 0 };

  const sorted = [...readings].sort((a, b) => b.rssi - a.rssi);
  const strongest = sorted[0];

  let confidence = 0.5;
  if (sorted.length > 1) {
    confidence = Math.min(0.95, 0.5 + (strongest.rssi - sorted[1].rssi) / 20);
  } else {
    confidence = strongest.rssi > -70 ? 0.7 : 0.4;
  }

  return { roomId: strongest.roomId, confidence };
}

/** Best smoothed RSSI seen for a given roomId in the current reading set. */
function bestRssiForRoom(readings: Reading[], roomId: string | null): number {
  return readings
    .filter((r) => r.roomId === roomId)
    .reduce((best, r) => (r.rssi > best ? r.rssi : best), -Infinity);
}

export function useLocation(options: UseLocationOptions): UseLocationReturn {
  const { beacons, updateIntervalMs = 5000, autoReport = true } = options;

  const [currentRoom, setCurrentRoom] = useState<RoomEstimate | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beaconInfoCache = useRef<Map<string, BeaconInfo>>(new Map());
  const lastReportTime = useRef<number>(0);
  // Tracks the room currently displayed so hysteresis can compare against it.
  const committedRoomId = useRef<string | null | undefined>(undefined);

  // ── DB fetch ─────────────────────────────────────────────────────────────
  const fetchBeaconInfo = useCallback(async (hardwareIds: string[]): Promise<void> => {
    const uncached = hardwareIds.filter((id) => !beaconInfoCache.current.has(id));
    if (uncached.length === 0) return;

    const { data, error: fetchError } = await supabase
      .from('beacons')
      .select(`
        id,
        room_id,
        hardware_id,
        tx_power_1m,
        rooms!left (
          name,
          floor_level,
          buildings!inner ( name )
        )
      `)
      .in('hardware_id', uncached);

    if (fetchError) throw fetchError;

    data?.forEach((beacon: any) => {
      beaconInfoCache.current.set(beacon.hardware_id, {
        id: beacon.id,
        room_id: beacon.room_id,
        hardware_id: beacon.hardware_id,
        tx_power_1m: beacon.tx_power_1m ?? -59,
        room_name: beacon.rooms?.name ?? null,
        building_name: beacon.rooms?.buildings?.name ?? null,
        floor_level: beacon.rooms?.floor_level ?? 0,
      });
    });
  }, []);

  // ── Core logic ────────────────────────────────────────────────────────────
  const buildReadings = useCallback((): Reading[] => {
    return Array.from(beacons.values())
      .map((beacon) => {
        const info = beaconInfoCache.current.get(beacon.hardwareId);
        if (!info) return null;
        return {
          beaconId: info.id,
          rssi: beacon.rssi,
          distance: rssiToDistance(beacon.rssi, info.tx_power_1m),
          roomId: info.room_id,
          roomName: info.room_name,
          buildingName: info.building_name,
          floorLevel: info.floor_level,
        };
      })
      .filter((r): r is Reading => r !== null);
  }, [beacons]);

  /**
   * Commit a new room estimate, applying hysteresis to avoid oscillation.
   *
   * We only switch away from the current room if the new room's best beacon
   * beats the current room's best beacon by ROOM_SWITCH_HYSTERESIS_DB dBm.
   * If the current room has no visible beacons at all we switch freely.
   */
  const commitEstimate = useCallback((readings: Reading[]): boolean => {
    if (readings.length === 0) return false;

    const estimate = estimateRoom(readings);
    const prevRoomId = committedRoomId.current;

    // Apply hysteresis when switching away from an established room.
    if (
      prevRoomId !== undefined &&   // we have a committed room
      prevRoomId !== null &&        // it isn't "unknown"
      estimate.roomId !== prevRoomId
    ) {
      const prevBest = bestRssiForRoom(readings, prevRoomId);
      const newBest  = bestRssiForRoom(readings, estimate.roomId);

      // Current room beacon still visible: require a clear lead to switch.
      if (prevBest > -Infinity && newBest - prevBest < ROOM_SWITCH_HYSTERESIS_DB) {
        return false; // hold position
      }
    }

    const strongest = [...readings].sort((a, b) => b.rssi - a.rssi)[0];
    committedRoomId.current = estimate.roomId;
    setCurrentRoom({
      roomId: estimate.roomId,
      roomName: strongest.roomName,
      buildingName: strongest.buildingName,
      floorLevel: strongest.floorLevel,
      confidence: estimate.confidence,
    });
    return true;
  }, []);

  const calculateLocation = useCallback(async (): Promise<void> => {
    if (beacons.size === 0) {
      committedRoomId.current = null;
      setCurrentRoom(null);
      return;
    }

    // Pass 1: update immediately from whatever is already cached (zero latency).
    const cachedReadings = buildReadings();
    const hadCachedHit = cachedReadings.length > 0;
    if (hadCachedHit) {
      commitEstimate(cachedReadings);
    } else {
      setIsLocating(true);
    }

    // Pass 2: fetch any missing beacon info, then re-run with the full picture.
    try {
      const hardwareIds = Array.from(beacons.values()).map((b) => b.hardwareId);
      const uncached = hardwareIds.filter((id) => !beaconInfoCache.current.has(id));
      if (uncached.length > 0) {
        await fetchBeaconInfo(hardwareIds);
        const fullReadings = buildReadings();
        if (!commitEstimate(fullReadings) && !hadCachedHit) {
          setCurrentRoom(null);
        }
      }
    } catch (err) {
      console.error('[Location] Error fetching beacon info:', err);
      setError((err as Error).message);
    } finally {
      setIsLocating(false);
    }
  }, [beacons, fetchBeaconInfo, buildReadings, commitEstimate]);

  // ── Report to server ──────────────────────────────────────────────────────
  const reportLocation = useCallback(async (): Promise<void> => {
    if (!currentRoom) return;

    const now = Date.now();
    if (now - lastReportTime.current < updateIntervalMs) return;
    lastReportTime.current = now;

    try {
      const beaconReadings = Array.from(beacons.values()).map((b) => ({
        hardware_id: b.hardwareId,
        rssi: b.rssi,
        timestamp: b.lastSeen.toISOString(),
      }));

      // @ts-expect-error - Custom RPC function not in generated types
      await supabase.rpc('record_location', {
        p_room_id: currentRoom.roomId,
        p_floor_level: currentRoom.floorLevel,
        p_confidence: currentRoom.confidence,
        p_beacon_readings: beaconReadings,
      });
    } catch (err) {
      console.error('[Location] Error reporting:', err);
      setError((err as Error).message);
    }
  }, [currentRoom, beacons, updateIntervalMs]);

  // Re-run whenever the beacons Map reference changes (new reading arrived)
  useEffect(() => {
    calculateLocation();
  }, [calculateLocation]);

  // Periodic server report
  useEffect(() => {
    if (!autoReport || !currentRoom) return;
    reportLocation();
    const interval = setInterval(reportLocation, updateIntervalMs);
    return () => clearInterval(interval);
  }, [autoReport, currentRoom, reportLocation, updateIntervalMs]);

  return { currentRoom, isLocating, reportLocation, error };
}
