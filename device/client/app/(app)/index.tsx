import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Modal, FlatList, ActivityIndicator,
} from 'react-native';

import { useBLEContext, useGATTContext } from '@/contexts/BLEContext';
import { useLocation } from '@/hooks/useLocation';
import { useAuthStore, useIsAdminOrSecurity } from '@/stores/auth';
import { useEmergencyStore, useActiveEmergency, useHasActiveEmergency } from '@/stores/emergency';
import { usePlaybookStore } from '@/stores/playbooks';
import { ERLS_TYPE_LABELS, ERLS_STATUS_LABELS } from '@/lib/erls-gatt';
import type { EmergencyType } from '@/types/database';

const EMERGENCY_TYPES: { type: EmergencyType; label: string; icon: string }[] = [
  { type: 'fire',       label: 'Fire',       icon: '🔥' },
  { type: 'lockdown',   label: 'Lockdown',   icon: '🔒' },
  { type: 'medical',    label: 'Medical',    icon: '🏥' },
  { type: 'weather',    label: 'Weather',    icon: '⛈️' },
  { type: 'evacuation', label: 'Evacuation', icon: '🚨' },
  { type: 'other',      label: 'Other',      icon: '⚠️' },
];

// Sentinel value meaning "trigger without a playbook"
const NO_PLAYBOOK = '__none__';

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const isAdminOrSecurity = useIsAdminOrSecurity();
  const activeEmergency = useActiveEmergency();
  const hasActiveEmergency = useHasActiveEmergency();
  const { triggerEmergency, resolveEmergency, isLoading } = useEmergencyStore();

  // BLE scanning state from the shared provider in the app layout
  const { beacons, nearestBeacon, isScanning, error: bleError } = useBLEContext();

  // GATT connection state from the shared provider
  const gatt = useGATTContext();

  // Location tracking
  const { currentRoom } = useLocation({ beacons, autoReport: true });

  // Playbooks for the picker
  const { playbooks, fetchPlaybooks } = usePlaybookStore();
  useEffect(() => {
    if (playbooks.length === 0) fetchPlaybooks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trigger modal state ───────────────────────────────────────────────────
  const [pendingType, setPendingType]               = useState<EmergencyType | null>(null);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>(NO_PLAYBOOK);
  const [isFiring, setIsFiring]                     = useState(false);

  const openTriggerModal = (type: EmergencyType) => {
    // Pre-select the default playbook for this type, if one exists
    const defaultBook = playbooks.find(
      (p) => p.emergency_type === type && p.is_default
    );
    setSelectedPlaybookId(defaultBook?.id ?? NO_PLAYBOOK);
    setPendingType(type);
  };

  const closeTriggerModal = () => {
    if (isFiring) return;
    setPendingType(null);
  };

  const confirmTrigger = async () => {
    if (!pendingType || isFiring) return;
    setIsFiring(true);

    const playbookId = selectedPlaybookId === NO_PLAYBOOK ? null : selectedPlaybookId;
    const typeLabel  = pendingType.toUpperCase();

    // Dual-path: GATT mesh (offline-capable) first, Supabase fallback
    if (gatt.connectedId) {
      const { error: gattError } = await gatt.triggerEmergency(pendingType);
      if (!gattError) {
        // Mesh broadcast succeeded — also sync to Supabase in background
        triggerEmergency(pendingType, undefined, undefined, undefined, playbookId).catch(() => {});
        setIsFiring(false);
        setPendingType(null);
        return;
      }
      console.warn(`[GATT] ${typeLabel} trigger failed, falling back to Supabase:`, gattError);
    }

    // Supabase path (requires network)
    const { error } = await triggerEmergency(
      pendingType, undefined, undefined, undefined, playbookId
    );
    setIsFiring(false);
    setPendingType(null);
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleResolveEmergency = () => {
    if (!activeEmergency) return;

    Alert.alert('Resolve Emergency', 'Mark this emergency as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: async () => {
          if (gatt.connectedId) {
            const { error: gattError } = await gatt.clearEmergency();
            if (!gattError) {
              resolveEmergency(activeEmergency.id).catch(() => {});
              return;
            }
          }
          const { error } = await resolveEmergency(activeEmergency.id);
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  };

  // ── Derived GATT display values ───────────────────────────────────────────
  const gattConnected   = gatt.connectedId !== null;
  const gattConnecting  = gatt.isConnecting;
  const hwEmergencyType = gatt.beaconStatus?.emergencyType ?? 0;
  const hwStatus        = gatt.beaconStatus?.emergencyStatus ?? 0;
  const showHwAlert     = gattConnected && hwEmergencyType !== 0 && hwStatus !== 0;

  // Playbooks for the currently selected emergency type
  const typePlaybooks = pendingType
    ? playbooks.filter((p) => p.emergency_type === pendingType)
    : [];

  const pendingTypeInfo = EMERGENCY_TYPES.find((t) => t.type === pendingType);

  return (
    <ScrollView style={styles.container}>
      {/* Active Emergency Banner */}
      {hasActiveEmergency && activeEmergency && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyBannerIcon}>
            {EMERGENCY_TYPES.find((t) => t.type === activeEmergency.emergency_type)?.icon ?? '⚠️'}
          </Text>
          <View style={styles.emergencyBannerContent}>
            <Text style={styles.emergencyBannerTitle}>
              {activeEmergency.emergency_type.toUpperCase()} EMERGENCY
            </Text>
            <Text style={styles.emergencyBannerSubtitle}>
              {activeEmergency.building_name ?? 'All Buildings'} •{' '}
              {activeEmergency.completed_tasks}/{activeEmergency.total_tasks} tasks complete
            </Text>
          </View>
          {isAdminOrSecurity && (
            <TouchableOpacity style={styles.resolveButton} onPress={handleResolveEmergency}>
              <Text style={styles.resolveButtonText}>Resolve</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Hardware beacon alert (from GATT notify) */}
      {showHwAlert && (
        <View style={styles.hwAlertBanner}>
          <Text style={styles.hwAlertText}>
            Beacon hardware: {ERLS_TYPE_LABELS[hwEmergencyType]} — {ERLS_STATUS_LABELS[hwStatus]}
          </Text>
        </View>
      )}

      {/* Location Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Location</Text>
        <View style={styles.locationCard}>
          {currentRoom ? (
            <>
              <Text style={styles.locationRoom}>{currentRoom.roomName ?? 'Unknown Room'}</Text>
              <Text style={styles.locationBuilding}>
                {currentRoom.buildingName ?? 'Unknown Building'}
                {currentRoom.floorLevel !== null && ` • Floor ${currentRoom.floorLevel}`}
              </Text>
              <Text style={styles.locationConfidence}>
                Confidence: {Math.round(currentRoom.confidence * 100)}%
              </Text>
            </>
          ) : (
            <Text style={styles.locationUnknown}>
              {isScanning ? 'Scanning for beacons...' : 'Location unknown'}
            </Text>
          )}
          {bleError && <Text style={styles.errorText}>{bleError}</Text>}
        </View>
      </View>

      {/* Beacon Status */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Beacons ({beacons.size})</Text>
          <View style={styles.scanIndicator}>
            <View style={[styles.scanDot, { backgroundColor: isScanning ? '#2a9d8f' : '#444' }]} />
            <Text style={styles.scanIndicatorText}>{isScanning ? 'Scanning' : 'Paused'}</Text>
          </View>
        </View>

        {nearestBeacon && (
          <View style={styles.beaconCard}>
            <View style={styles.beaconCardLeft}>
              <Text style={styles.beaconName}>{nearestBeacon.name ?? nearestBeacon.hardwareId}</Text>
              <Text style={styles.beaconRssi}>Signal: {nearestBeacon.rssi} dBm</Text>
            </View>
            <View style={[
              styles.gattBadge,
              gattConnected
                ? styles.gattBadgeConnected
                : gattConnecting
                  ? styles.gattBadgeConnecting
                  : styles.gattBadgeDisconnected,
            ]}>
              <Text style={[
                styles.gattBadgeText,
                gattConnecting && { color: '#f4a261' },
                !gattConnected && !gattConnecting && { color: '#666' },
              ]}>
                {gattConnected ? 'GATT' : gattConnecting ? 'Connecting…' : 'Not linked'}
              </Text>
            </View>
          </View>
        )}

        {gattConnected && gatt.beaconStatus && (
          <View style={styles.gattStatusRow}>
            <Text style={styles.gattStatusLabel}>Beacon status:</Text>
            <Text style={styles.gattStatusValue}>
              {ERLS_TYPE_LABELS[hwEmergencyType]} / {ERLS_STATUS_LABELS[hwStatus]}
            </Text>
            {gatt.beaconHardwareId != null && (
              <Text style={styles.gattHwId}>
                HW: 0x{gatt.beaconHardwareId.toString(16).toUpperCase().padStart(8, '0')}
              </Text>
            )}
          </View>
        )}

        {gatt.error && <Text style={styles.errorText}>{gatt.error}</Text>}

        {beacons.size === 0 && (
          <Text style={styles.noBeacons}>
            {isScanning ? 'Scanning for beacons…' : 'No beacons in range'}
          </Text>
        )}
      </View>

      {/* Emergency Trigger */}
      {!hasActiveEmergency && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Emergency</Text>
          <View style={styles.emergencyGrid}>
            {EMERGENCY_TYPES.map(({ type, label, icon }) => (
              <TouchableOpacity
                key={type}
                style={styles.emergencyButton}
                onPress={() => openTriggerModal(type)}
                disabled={isLoading}
              >
                <Text style={styles.emergencyButtonIcon}>{icon}</Text>
                <Text style={styles.emergencyButtonLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {gattConnected && (
            <Text style={styles.gattNote}>
              Connected to beacon — emergency will broadcast over mesh
            </Text>
          )}
        </View>
      )}

      {/* User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{profile?.full_name ?? profile?.email}</Text>
          <Text style={styles.profileRole}>{profile?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {/* ── Emergency Trigger Modal ─────────────────────────────────────────── */}
      <Modal
        visible={pendingType !== null}
        transparent
        animationType="fade"
        onRequestClose={closeTriggerModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>{pendingTypeInfo?.icon ?? '⚠️'}</Text>
              <Text style={styles.modalTitle}>
                Trigger {pendingTypeInfo?.label ?? ''} Emergency
              </Text>
            </View>

            {/* Playbook picker */}
            <Text style={styles.modalSectionLabel}>Select Playbook</Text>

            <FlatList
              data={[
                // Always include a "no playbook" option
                { id: NO_PLAYBOOK, name: 'No playbook (trigger only)', is_default: false },
                ...typePlaybooks,
              ]}
              keyExtractor={(item) => item.id}
              style={styles.playbookList}
              renderItem={({ item }) => {
                const selected = selectedPlaybookId === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.playbookRow, selected && styles.playbookRowSelected]}
                    onPress={() => setSelectedPlaybookId(item.id)}
                    disabled={isFiring}
                  >
                    <View style={[styles.radioCircle, selected && styles.radioCircleFilled]} />
                    <View style={styles.playbookRowContent}>
                      <Text style={[styles.playbookName, selected && styles.playbookNameSelected]}>
                        {item.name}
                      </Text>
                      {item.id !== NO_PLAYBOOK && item.is_default && (
                        <Text style={styles.defaultBadge}>default</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {gattConnected && (
              <Text style={styles.modalGattNote}>
                Will broadcast over BLE mesh
              </Text>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeTriggerModal}
                disabled={isFiring}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, isFiring && styles.confirmButtonDisabled]}
                onPress={confirmTrigger}
                disabled={isFiring}
              >
                {isFiring ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Trigger</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e63946',
    padding: 16,
    gap: 12,
  },
  emergencyBannerIcon: { fontSize: 32 },
  emergencyBannerContent: { flex: 1 },
  emergencyBannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  emergencyBannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  resolveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resolveButtonText: { color: '#ffffff', fontWeight: '600' },
  hwAlertBanner: {
    backgroundColor: '#f4a261',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hwAlertText: {
    color: '#16213e',
    fontWeight: '600',
    fontSize: 14,
  },
  section: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  scanIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scanDot: { width: 8, height: 8, borderRadius: 4 },
  scanIndicatorText: { fontSize: 12, color: '#888' },
  locationCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  locationRoom: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  locationBuilding: { fontSize: 16, color: '#888', marginTop: 4 },
  locationConfidence: { fontSize: 14, color: '#0f3460', marginTop: 8 },
  locationUnknown: { fontSize: 18, color: '#888' },
  errorText: { fontSize: 14, color: '#e63946', marginTop: 8 },
  beaconCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beaconCardLeft: { flex: 1 },
  beaconName: { fontSize: 16, color: '#ffffff' },
  beaconRssi: { fontSize: 14, color: '#888', marginTop: 2 },
  gattBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  gattBadgeConnected:    { backgroundColor: 'rgba(42, 157, 143, 0.25)' },
  gattBadgeConnecting:   { backgroundColor: 'rgba(244, 162, 97, 0.25)' },
  gattBadgeDisconnected: { backgroundColor: 'rgba(136, 136, 136, 0.15)' },
  gattBadgeText: { fontSize: 12, fontWeight: '600', color: '#2a9d8f' },
  gattStatusRow: {
    marginTop: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    gap: 2,
  },
  gattStatusLabel: { fontSize: 12, color: '#888' },
  gattStatusValue: { fontSize: 14, color: '#ffffff' },
  gattHwId: {
    fontSize: 11,
    color: '#555',
    marginTop: 4,
  },
  noBeacons: { fontSize: 14, color: '#888', textAlign: 'center', padding: 16 },
  emergencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  emergencyButton: {
    width: '30%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f3460',
  },
  emergencyButtonIcon: { fontSize: 32, marginBottom: 8 },
  emergencyButtonLabel: { fontSize: 14, color: '#ffffff', fontWeight: '500' },
  gattNote: { marginTop: 10, fontSize: 12, color: '#2a9d8f', textAlign: 'center' },
  profileCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileName: { fontSize: 16, color: '#ffffff' },
  profileRole: {
    fontSize: 12,
    color: '#e63946',
    fontWeight: '600',
    backgroundColor: 'rgba(230, 57, 70, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  modalIcon: { fontSize: 28 },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  playbookList: { maxHeight: 220 },
  playbookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#0f3460',
    gap: 12,
  },
  playbookRowSelected: {
    backgroundColor: 'rgba(42, 157, 143, 0.2)',
    borderWidth: 1,
    borderColor: '#2a9d8f',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#555',
  },
  radioCircleFilled: {
    borderColor: '#2a9d8f',
    backgroundColor: '#2a9d8f',
  },
  playbookRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playbookName: { fontSize: 15, color: '#aaa' },
  playbookNameSelected: { color: '#ffffff', fontWeight: '600' },
  defaultBadge: {
    fontSize: 11,
    color: '#2a9d8f',
    backgroundColor: 'rgba(42, 157, 143, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalGattNote: {
    fontSize: 12,
    color: '#2a9d8f',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0f3460',
    alignItems: 'center',
  },
  cancelButtonText: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: { opacity: 0.6 },
  confirmButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
