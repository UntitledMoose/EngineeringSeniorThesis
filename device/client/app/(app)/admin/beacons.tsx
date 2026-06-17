import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';

import { useBLEContext } from '@/contexts/BLEContext';
import { useBeacons, useBeaconsStore } from '@/stores/beacons';

type Tab = 'discovered' | 'registered';

function signalStrength(rssi: number): { label: string; color: string } {
  if (rssi >= -65) return { label: 'Strong', color: '#2a9d8f' };
  if (rssi >= -80) return { label: 'Fair', color: '#f4a261' };
  return { label: 'Weak', color: '#e63946' };
}

function timeSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BeaconsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('discovered');
  const beacons = useBeacons();
  const { fetchBeacons, deleteBeacon, isLoading } = useBeaconsStore();
  // Reuse the shared scanner — no need to start/stop our own
  const { beacons: bleBeacons, isScanning } = useBLEContext();

  useEffect(() => {
    fetchBeacons();
  }, [fetchBeacons]);

  const registeredHardwareIds = new Set(beacons.map((b) => b.hardware_id));
  const discoveredBeacons = Array.from(bleBeacons.values());
  const newDiscovered = discoveredBeacons.filter((b) => !registeredHardwareIds.has(b.hardwareId));
  const alreadyRegistered = discoveredBeacons.filter((b) => registeredHardwareIds.has(b.hardwareId));

  const handleDeleteBeacon = useCallback((id: string, name: string) => {
    Alert.alert('Delete Beacon', `Remove "${name ?? 'Unnamed'}" from the system?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteBeacon(id);
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  }, [deleteBeacon]);

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discovered' && styles.tabActive]}
          onPress={() => setActiveTab('discovered')}
        >
          <Text style={[styles.tabText, activeTab === 'discovered' && styles.tabTextActive]}>
            Discovered {discoveredBeacons.length > 0 ? `(${discoveredBeacons.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'registered' && styles.tabActive]}
          onPress={() => setActiveTab('registered')}
        >
          <Text style={[styles.tabText, activeTab === 'registered' && styles.tabTextActive]}>
            Registered {beacons.length > 0 ? `(${beacons.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'discovered' ? (
        <FlatList
          data={discoveredBeacons}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isScanning} onRefresh={() => {}} tintColor="#888" />
          }
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.scanStatus}>
              <View style={[styles.scanDot, { backgroundColor: isScanning ? '#2a9d8f' : '#888' }]} />
              <Text style={styles.scanStatusText}>
                {isScanning ? 'Scanning for beacons…' : 'Scan complete — pull to refresh'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const sig = signalStrength(item.rssi);
            const isNew = !registeredHardwareIds.has(item.hardwareId);
            return (
              <TouchableOpacity
                style={styles.beaconCard}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/admin/beacon/new',
                    params: { hardwareId: item.hardwareId },
                  })
                }
                disabled={!isNew}
              >
                <View style={styles.beaconLeft}>
                  <Text style={styles.beaconName}>{item.name ?? 'ERLSBeacon'}</Text>
                  <Text style={styles.beaconId}>{item.hardwareId}</Text>
                </View>
                <View style={styles.beaconRight}>
                  <Text style={[styles.signalLabel, { color: sig.color }]}>{sig.label}</Text>
                  <Text style={styles.rssiText}>{item.rssi} dBm</Text>
                  {isNew ? (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>Register</Text>
                    </View>
                  ) : (
                    <View style={styles.registeredBadge}>
                      <Text style={styles.registeredBadgeText}>Registered</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyTitle}>No Beacons Found</Text>
              <Text style={styles.emptySubtitle}>
                Power on ERLS beacons and ensure Bluetooth is enabled.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={beacons}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchBeacons} tintColor="#888" />
          }
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/(app)/admin/beacon/new')}
            >
              <Text style={styles.createButtonIcon}>+</Text>
              <Text style={styles.createButtonText}>Register Beacon Manually</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => {
            const isOnline =
              item.last_seen_at != null &&
              Date.now() - new Date(item.last_seen_at).getTime() < 5 * 60 * 1000;
            return (
              <TouchableOpacity
                style={styles.beaconCard}
                onPress={() => router.push(`/(app)/admin/beacon/${item.id}`)}
                onLongPress={() => handleDeleteBeacon(item.id, item.name ?? '')}
              >
                <View style={styles.beaconLeft}>
                  <View style={styles.nameRow}>
                    <View style={[styles.statusDot, { backgroundColor: isOnline ? '#2a9d8f' : '#888' }]} />
                    <Text style={styles.beaconName}>{item.name ?? 'Unnamed Beacon'}</Text>
                    {item.is_bridge && (
                      <View style={styles.bridgeBadge}>
                        <Text style={styles.bridgeBadgeText}>LoRa</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.beaconId}>{item.hardware_id}</Text>
                  <Text style={styles.beaconLocation}>
                    {item.rooms
                      ? `${item.rooms.buildings?.name ?? '?'} › ${item.rooms.name}`
                      : 'Unassigned'}
                  </Text>
                </View>
                <View style={styles.beaconRight}>
                  {item.battery_level != null && (
                    <Text style={styles.batteryText}>{item.battery_level}%</Text>
                  )}
                  <Text style={styles.lastSeenText}>{timeSince(item.last_seen_at)}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📡</Text>
                <Text style={styles.emptyTitle}>No Registered Beacons</Text>
                <Text style={styles.emptySubtitle}>
                  Switch to the Discovered tab to scan for and register beacons.
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16213e' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    margin: 16,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#0f3460' },
  tabText: { fontSize: 14, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#ffffff', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  scanStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  scanDot: { width: 8, height: 8, borderRadius: 4 },
  scanStatusText: { fontSize: 13, color: '#888' },
  beaconCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  beaconLeft: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  beaconName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  beaconId: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
  beaconLocation: { fontSize: 13, color: '#aaa', marginTop: 2 },
  beaconRight: { alignItems: 'flex-end', gap: 4 },
  signalLabel: { fontSize: 13, fontWeight: '600' },
  rssiText: { fontSize: 12, color: '#888' },
  batteryText: { fontSize: 13, color: '#2a9d8f' },
  lastSeenText: { fontSize: 12, color: '#888' },
  chevron: { fontSize: 20, color: '#888' },
  newBadge: {
    backgroundColor: '#e63946',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  registeredBadge: {
    backgroundColor: '#2a9d8f',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  registeredBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  bridgeBadge: {
    backgroundColor: '#9d4edd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bridgeBadgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  createButtonIcon: { fontSize: 22, color: '#fff', fontWeight: 'bold' },
  createButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  emptyContainer: { padding: 48, alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
