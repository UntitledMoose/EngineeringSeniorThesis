import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { useBuildingsStore } from '@/stores/buildings';
import { useBeaconsStore } from '@/stores/beacons';

const ROOM_TYPES = ['classroom', 'office', 'hallway', 'stairwell', 'exit', 'other'] as const;
const ROOM_TYPE_ICONS: Record<string, string> = {
  classroom: '📚', office: '💼', hallway: '🚶', stairwell: '🪜', exit: '🚪', other: '📍',
};

export default function EditRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentBuilding, fetchBuilding, updateRoom, isLoading } = useBuildingsStore();
  const { beacons, fetchBeacons, updateBeacon } = useBeaconsStore();

  const [name, setName] = useState('');
  const [floorLevel, setFloorLevel] = useState('0');
  const [roomType, setRoomType] = useState('classroom');
  const [capacity, setCapacity] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [ready, setReady] = useState(false);

  // Find the room in currentBuilding
  const room = currentBuilding?.rooms.find((r) => r.id === id);

  useEffect(() => {
    fetchBeacons();
  }, [fetchBeacons]);

  useEffect(() => {
    if (!room || ready) return;
    setName(room.name);
    setFloorLevel(String(room.floor_level));
    setRoomType(room.room_type ?? 'other');
    setCapacity(room.capacity != null ? String(room.capacity) : '');
    setReady(true);
  }, [room, ready]);

  // If room not found in currentBuilding, it may belong to a different building
  // Attempt to find via beacons' room references
  const assignedBeacons = beacons.filter((b) => b.room_id === id);
  const unassignedBeaconsForBuilding = beacons.filter(
    (b) => b.room_id === null || b.room_id !== id
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Room name is required.');
      return;
    }
    const floor = parseInt(floorLevel, 10);
    if (isNaN(floor)) {
      Alert.alert('Validation', 'Floor must be a number.');
      return;
    }
    const cap = capacity.trim() ? parseInt(capacity, 10) : null;

    setSaving(true);
    const { error } = await updateRoom(id, {
      name: name.trim(),
      floor_level: floor,
      room_type: roomType,
      capacity: cap,
    });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setEditing(false);
      // Refresh the building to get updated room
      if (currentBuilding) fetchBuilding(currentBuilding.id);
    }
  };

  const handleUnassignBeacon = useCallback((beaconId: string, beaconName: string) => {
    Alert.alert('Unassign Beacon', `Remove "${beaconName ?? 'Unnamed'}" from this room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unassign',
        style: 'destructive',
        onPress: async () => {
          const { error } = await updateBeacon(beaconId, { room_id: null });
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  }, [updateBeacon]);

  const handleAssignBeacon = useCallback((beaconId: string, beaconName: string) => {
    Alert.alert('Assign Beacon', `Assign "${beaconName ?? 'Unnamed'}" to this room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Assign',
        onPress: async () => {
          const { error } = await updateBeacon(beaconId, { room_id: id });
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  }, [id, updateBeacon]);

  if (!ready && !room) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#e63946" size="large" />
      </View>
    );
  }

  const displayName = name || room?.name || 'Room';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Room Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Room Details</Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Text style={styles.editToggle}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {editing ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor="#555"
                  autoFocus
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.field}>
                <Text style={styles.label}>Floor Level</Text>
                <TextInput
                  style={styles.input}
                  value={floorLevel}
                  onChangeText={setFloorLevel}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.hint}>0 = ground, 1 = first, −1 = basement</Text>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => setShowTypePicker(!showTypePicker)}
              >
                <Text style={styles.label}>Room Type</Text>
                <View style={styles.pickerValue}>
                  <Text style={styles.pickerValueText}>{roomType}</Text>
                  <Text style={styles.pickerChevron}>{showTypePicker ? '∧' : '∨'}</Text>
                </View>
              </TouchableOpacity>
              {showTypePicker && (
                <View style={styles.pickerList}>
                  {ROOM_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.pickerItem, type === roomType && styles.pickerItemActive]}
                      onPress={() => { setRoomType(type); setShowTypePicker(false); }}
                    >
                      <Text style={styles.pickerItemText}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.field}>
                <Text style={styles.label}>Capacity</Text>
                <TextInput
                  style={styles.input}
                  value={capacity}
                  onChangeText={setCapacity}
                  placeholder="Leave blank if unknown"
                  placeholderTextColor="#555"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.divider} />
              <TouchableOpacity
                style={[styles.saveInlineButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveInlineText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{displayName}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Floor</Text>
                <Text style={styles.infoValue}>
                  {parseInt(floorLevel) === 0
                    ? 'Ground'
                    : parseInt(floorLevel) > 0
                    ? `Floor ${floorLevel}`
                    : `Basement ${Math.abs(parseInt(floorLevel))}`}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type</Text>
                <Text style={styles.infoValue}>
                  {ROOM_TYPE_ICONS[roomType] ?? '📍'} {roomType}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Capacity</Text>
                <Text style={styles.infoValue}>{capacity || '—'}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Assigned Beacons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Assigned Beacons ({assignedBeacons.length})
        </Text>
        {assignedBeacons.length === 0 ? (
          <View style={styles.emptyBeacons}>
            <Text style={styles.emptyBeaconsText}>No beacons assigned to this room.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {assignedBeacons.map((beacon, index) => (
              <View key={beacon.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.beaconRow}>
                  <View style={styles.beaconInfo}>
                    <Text style={styles.beaconName}>{beacon.name ?? 'Unnamed'}</Text>
                    <Text style={styles.beaconId}>{beacon.hardware_id}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unassignButton}
                    onPress={() => handleUnassignBeacon(beacon.id, beacon.name ?? '')}
                  >
                    <Text style={styles.unassignText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Assign more beacons */}
      {unassignedBeaconsForBuilding.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Beacons</Text>
          <Text style={styles.sectionHint}>Tap to assign a beacon to this room</Text>
          <View style={styles.card}>
            {unassignedBeaconsForBuilding.map((beacon, index) => (
              <View key={beacon.id}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.beaconRow}
                  onPress={() => handleAssignBeacon(beacon.id, beacon.name ?? '')}
                >
                  <View style={styles.beaconInfo}>
                    <Text style={styles.beaconName}>{beacon.name ?? 'Unnamed'}</Text>
                    <Text style={styles.beaconId}>{beacon.hardware_id}</Text>
                    <Text style={styles.beaconCurrentRoom}>
                      {beacon.rooms ? `Currently in: ${beacon.rooms.name}` : 'Unassigned'}
                    </Text>
                  </View>
                  <Text style={styles.assignChevron}>+</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16213e' },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#16213e' },
  section: { marginBottom: 24 },
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
  sectionHint: { fontSize: 12, color: '#666', marginTop: -8, marginBottom: 10 },
  editToggle: { fontSize: 14, color: '#e63946', fontWeight: '600' },
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, overflow: 'hidden' },
  field: { padding: 16 },
  label: { fontSize: 14, color: '#aaa', marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#0f3460',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  hint: { fontSize: 12, color: '#666', marginTop: 6 },
  divider: { height: 1, backgroundColor: '#0f3460', marginHorizontal: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  infoLabel: { fontSize: 15, color: '#ffffff' },
  infoValue: { fontSize: 15, color: '#888', textTransform: 'capitalize' },
  saveInlineButton: {
    margin: 16,
    backgroundColor: '#e63946',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveInlineText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  pickerRow: { padding: 16 },
  pickerValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  pickerValueText: { fontSize: 15, color: '#ffffff', textTransform: 'capitalize' },
  pickerChevron: { fontSize: 16, color: '#888' },
  pickerList: {
    backgroundColor: '#0f3460',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickerItem: { padding: 14 },
  pickerItemActive: { backgroundColor: '#163060' },
  pickerItemText: { fontSize: 15, color: '#ffffff', textTransform: 'capitalize' },
  beaconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  beaconInfo: { flex: 1 },
  beaconName: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  beaconId: { fontSize: 12, color: '#888', fontFamily: 'monospace', marginTop: 2 },
  beaconCurrentRoom: { fontSize: 12, color: '#666', marginTop: 2 },
  unassignButton: {
    backgroundColor: '#3a1020',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unassignText: { fontSize: 13, color: '#e63946', fontWeight: '600' },
  assignChevron: { fontSize: 22, color: '#2a9d8f', fontWeight: 'bold' },
  emptyBeacons: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyBeaconsText: { fontSize: 14, color: '#888' },
});
