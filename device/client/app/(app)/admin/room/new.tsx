import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';

import { useBuildingsStore } from '@/stores/buildings';

const ROOM_TYPES = ['classroom', 'office', 'hallway', 'stairwell', 'exit', 'other'] as const;

export default function NewRoomScreen() {
  const { buildingId } = useLocalSearchParams<{ buildingId: string }>();
  const { createRoom, isLoading } = useBuildingsStore();

  const [name, setName] = useState('');
  const [floorLevel, setFloorLevel] = useState('0');
  const [roomType, setRoomType] = useState<string>('classroom');
  const [capacity, setCapacity] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Room name is required.');
      return;
    }
    const floor = parseInt(floorLevel, 10);
    if (isNaN(floor)) {
      Alert.alert('Validation', 'Floor must be a number (0 = ground, negative = basement).');
      return;
    }
    if (!buildingId) {
      Alert.alert('Error', 'Building ID missing.');
      return;
    }

    const cap = capacity.trim() ? parseInt(capacity, 10) : null;

    const { error } = await createRoom({
      building_id: buildingId,
      name: name.trim(),
      floor_level: floor,
      room_type: roomType,
      capacity: cap,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Room Details</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Room 201"
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
              placeholder="0"
              placeholderTextColor="#555"
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.hint}>0 = ground floor, 1 = first floor, −1 = basement</Text>
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
            <Text style={styles.label}>Capacity (optional)</Text>
            <TextInput
              style={styles.input}
              value={capacity}
              onChangeText={setCapacity}
              placeholder="e.g. 30"
              placeholderTextColor="#555"
              keyboardType="number-pad"
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>{isLoading ? 'Creating…' : 'Create Room'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16213e' },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
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
  pickerRow: { padding: 16 },
  pickerValue: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
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
  saveButton: {
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});
