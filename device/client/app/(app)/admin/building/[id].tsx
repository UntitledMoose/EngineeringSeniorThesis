import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useCallback, useState } from 'react';
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

import { useCurrentBuilding, useBuildingsStore } from '@/stores/buildings';

const ROOM_TYPE_ICONS: Record<string, string> = {
  classroom: '📚',
  office: '💼',
  hallway: '🚶',
  stairwell: '🪜',
  exit: '🚪',
  other: '📍',
};

export default function EditBuildingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const building = useCurrentBuilding();
  const { fetchBuilding, updateBuilding, deleteRoom, isLoading } = useBuildingsStore();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBuilding(id);
  }, [id, fetchBuilding]);

  useEffect(() => {
    if (building && building.id === id) {
      setName(building.name);
      setAddress(building.address ?? '');
    }
  }, [building, id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Building name is required.');
      return;
    }
    setSaving(true);
    const { error } = await updateBuilding(id, {
      name: name.trim(),
      address: address.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setEditing(false);
    }
  };

  const handleDeleteRoom = useCallback((roomId: string, roomName: string) => {
    Alert.alert('Delete Room', `Delete "${roomName}"? Beacons assigned to this room will become unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteRoom(roomId);
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  }, [deleteRoom]);

  if (!building || building.id !== id) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#e63946" size="large" />
      </View>
    );
  }

  // Group rooms by floor
  const floors = Array.from(new Set(building.rooms.map((r) => r.floor_level))).sort((a, b) => a - b);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Building Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Building Info</Text>
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
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. 123 Campus Drive"
                  placeholderTextColor="#555"
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
                <Text style={styles.infoValue}>{building.name}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{building.address ?? '—'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rooms</Text>
                <Text style={styles.infoValue}>{building.rooms.length}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Rooms by floor */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rooms</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/(app)/admin/room/new', params: { buildingId: id } })
            }
          >
            <Text style={styles.addLink}>+ Add Room</Text>
          </TouchableOpacity>
        </View>

        {floors.length === 0 ? (
          <View style={styles.emptyRooms}>
            <Text style={styles.emptyRoomsText}>No rooms yet. Add a room to get started.</Text>
          </View>
        ) : (
          floors.map((floor) => {
            const floorRooms = building.rooms.filter((r) => r.floor_level === floor);
            return (
              <View key={floor} style={styles.floorSection}>
                <Text style={styles.floorLabel}>
                  {floor === 0 ? 'Ground Floor' : floor > 0 ? `Floor ${floor}` : `Basement ${Math.abs(floor)}`}
                </Text>
                {floorRooms.map((room) => (
                  <TouchableOpacity
                    key={room.id}
                    style={styles.roomCard}
                    onPress={() => router.push(`/(app)/admin/room/${room.id}`)}
                    onLongPress={() => handleDeleteRoom(room.id, room.name)}
                  >
                    <Text style={styles.roomIcon}>
                      {ROOM_TYPE_ICONS[room.room_type ?? 'other'] ?? '📍'}
                    </Text>
                    <View style={styles.roomInfo}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomMeta}>
                        {room.room_type ?? 'room'}
                        {room.capacity ? ` · Cap. ${room.capacity}` : ''}
                        {room.beacons?.length ? ` · ${room.beacons.length} beacon${room.beacons.length !== 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}
      </View>
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
  },
  editToggle: { fontSize: 14, color: '#e63946', fontWeight: '600' },
  addLink: { fontSize: 14, color: '#2a9d8f', fontWeight: '600' },
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
  divider: { height: 1, backgroundColor: '#0f3460', marginHorizontal: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  infoLabel: { fontSize: 15, color: '#ffffff' },
  infoValue: { fontSize: 15, color: '#888' },
  saveInlineButton: {
    margin: 16,
    backgroundColor: '#e63946',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveInlineText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  floorSection: { marginBottom: 16 },
  floorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  roomCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomIcon: { fontSize: 22 },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  roomMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  chevron: { fontSize: 22, color: '#888' },
  emptyRooms: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyRoomsText: { fontSize: 14, color: '#888', textAlign: 'center' },
});
