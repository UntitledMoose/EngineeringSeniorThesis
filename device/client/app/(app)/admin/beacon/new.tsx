import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';

import { useBeaconsStore } from '@/stores/beacons';
import { useBuildingsStore } from '@/stores/buildings';

export default function NewBeaconScreen() {
  const { hardwareId: paramHardwareId } = useLocalSearchParams<{ hardwareId?: string }>();

  const { createBeacon, isLoading } = useBeaconsStore();
  const { buildings, fetchBuildings, fetchBuildingRooms } = useBuildingsStore();

  const [name, setName] = useState('');
  const [hardwareId, setHardwareId] = useState(paramHardwareId ?? '');
  const [txPower, setTxPower] = useState('-59');
  const [isBridge, setIsBridge] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; floor_level: number }>>([]);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  const handleSelectBuilding = async (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    setSelectedRoomId(null);
    setShowBuildingPicker(false);
    const fetchedRooms = await fetchBuildingRooms(buildingId);
    setRooms(fetchedRooms as typeof rooms);
  };

  const handleSave = async () => {
    if (!hardwareId.trim()) {
      Alert.alert('Validation', 'Hardware ID is required.');
      return;
    }

    const txPowerNum = parseInt(txPower, 10);
    if (isNaN(txPowerNum)) {
      Alert.alert('Validation', 'TX Power must be a number (e.g. -59).');
      return;
    }

    const { error } = await createBeacon({
      hardware_id: hardwareId.trim(),
      name: name.trim() || null,
      tx_power_1m: txPowerNum,
      is_bridge: isBridge,
      room_id: selectedRoomId ?? null,
      floor_level: 0,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
  };

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Beacon Identity</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Hardware ID *</Text>
            <TextInput
              style={[styles.input, paramHardwareId ? styles.inputReadonly : null]}
              value={hardwareId}
              onChangeText={setHardwareId}
              placeholder="e.g. AA:BB:CC:DD:EE:FF"
              placeholderTextColor="#555"
              autoCapitalize="characters"
              editable={!paramHardwareId}
            />
            {paramHardwareId && (
              <Text style={styles.hint}>Detected via BLE scan</Text>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Main Hallway North"
              placeholderTextColor="#555"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calibration</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>TX Power at 1 m (dBm)</Text>
            <TextInput
              style={styles.input}
              value={txPower}
              onChangeText={setTxPower}
              placeholder="-59"
              placeholderTextColor="#555"
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.hint}>
              Measure RSSI at exactly 1 m from the beacon. Default –59 dBm is typical.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>LoRa Bridge Node</Text>
              <Text style={styles.hint}>This beacon bridges BLE mesh to LoRa</Text>
            </View>
            <Switch
              value={isBridge}
              onValueChange={setIsBridge}
              trackColor={{ false: '#0f3460', true: '#9d4edd' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Assignment</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setShowBuildingPicker(!showBuildingPicker)}
          >
            <Text style={styles.label}>Building</Text>
            <View style={styles.pickerValue}>
              <Text style={selectedBuilding ? styles.pickerValueText : styles.pickerPlaceholder}>
                {selectedBuilding?.name ?? 'Select building…'}
              </Text>
              <Text style={styles.pickerChevron}>{showBuildingPicker ? '∧' : '∨'}</Text>
            </View>
          </TouchableOpacity>
          {showBuildingPicker && (
            <View style={styles.pickerList}>
              {buildings.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.pickerItem, b.id === selectedBuildingId && styles.pickerItemActive]}
                  onPress={() => handleSelectBuilding(b.id)}
                >
                  <Text style={styles.pickerItemText}>{b.name}</Text>
                </TouchableOpacity>
              ))}
              {buildings.length === 0 && (
                <Text style={styles.pickerEmpty}>No buildings. Create one first.</Text>
              )}
            </View>
          )}

          {selectedBuildingId && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => setShowRoomPicker(!showRoomPicker)}
              >
                <Text style={styles.label}>Room (optional)</Text>
                <View style={styles.pickerValue}>
                  <Text style={selectedRoom ? styles.pickerValueText : styles.pickerPlaceholder}>
                    {selectedRoom?.name ?? 'Select room…'}
                  </Text>
                  <Text style={styles.pickerChevron}>{showRoomPicker ? '∧' : '∨'}</Text>
                </View>
              </TouchableOpacity>
              {showRoomPicker && (
                <View style={styles.pickerList}>
                  <TouchableOpacity
                    style={[styles.pickerItem, selectedRoomId === null && styles.pickerItemActive]}
                    onPress={() => { setSelectedRoomId(null); setShowRoomPicker(false); }}
                  >
                    <Text style={styles.pickerItemText}>Unassigned</Text>
                  </TouchableOpacity>
                  {rooms.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.pickerItem, r.id === selectedRoomId && styles.pickerItemActive]}
                      onPress={() => { setSelectedRoomId(r.id); setShowRoomPicker(false); }}
                    >
                      <Text style={styles.pickerItemText}>
                        Floor {r.floor_level} – {r.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {rooms.length === 0 && (
                    <Text style={styles.pickerEmpty}>No rooms in this building.</Text>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>{isLoading ? 'Registering…' : 'Register Beacon'}</Text>
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
  inputReadonly: { opacity: 0.7 },
  hint: { fontSize: 12, color: '#666', marginTop: 6 },
  divider: { height: 1, backgroundColor: '#0f3460', marginHorizontal: 16 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  pickerRow: { padding: 16 },
  pickerValue: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  pickerValueText: { fontSize: 15, color: '#ffffff' },
  pickerPlaceholder: { fontSize: 15, color: '#555' },
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
  pickerItemText: { fontSize: 15, color: '#ffffff' },
  pickerEmpty: { padding: 14, color: '#888', fontSize: 14 },
  saveButton: {
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});
