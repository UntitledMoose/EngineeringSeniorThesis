import { router } from 'expo-router';
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
import { useProfile } from '@/stores/auth';

export default function NewBuildingScreen() {
  const { createBuilding, isLoading } = useBuildingsStore();
  const profile = useProfile();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Building name is required.');
      return;
    }
    if (!profile?.organization_id) {
      Alert.alert('Error', 'No organization found.');
      return;
    }

    const { data, error } = await createBuilding({
      name: name.trim(),
      address: address.trim() || null,
      organization_id: profile.organization_id,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else if (data) {
      // Navigate to the new building to add rooms
      router.replace(`/(app)/admin/building/${data.id}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Building Details</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Main Campus Building A"
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
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>{isLoading ? 'Creating…' : 'Create Building'}</Text>
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
  divider: { height: 1, backgroundColor: '#0f3460', marginHorizontal: 16 },
  saveButton: {
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});
