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
  Switch,
} from 'react-native';

import { usePlaybookStore } from '@/stores/playbooks';
import type { EmergencyType } from '@/types/database';

const EMERGENCY_TYPES: { type: EmergencyType; label: string; icon: string }[] = [
  { type: 'fire', label: 'Fire', icon: '🔥' },
  { type: 'lockdown', label: 'Lockdown', icon: '🔒' },
  { type: 'medical', label: 'Medical', icon: '🏥' },
  { type: 'weather', label: 'Weather', icon: '⛈️' },
  { type: 'evacuation', label: 'Evacuation', icon: '🚨' },
  { type: 'other', label: 'Other', icon: '⚠️' },
];

export default function NewPlaybookScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('fire');
  const [isDefault, setIsDefault] = useState(false);

  const { createPlaybook, isLoading } = usePlaybookStore();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a playbook name');
      return;
    }

    const { id, error } = await createPlaybook({
      name: name.trim(),
      description: description.trim() || undefined,
      emergency_type: emergencyType,
      is_default: isDefault,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else if (id) {
      router.replace(`/(app)/admin/playbook/${id}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Playbook Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Fire Emergency Response"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Brief description of this playbook..."
            placeholderTextColor="#888"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Emergency Type */}
        <View style={styles.field}>
          <Text style={styles.label}>Emergency Type</Text>
          <View style={styles.typeGrid}>
            {EMERGENCY_TYPES.map(({ type, label, icon }) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, emergencyType === type && styles.typeButtonSelected]}
                onPress={() => setEmergencyType(type)}
              >
                <Text style={styles.typeIcon}>{icon}</Text>
                <Text
                  style={[styles.typeLabel, emergencyType === type && styles.typeLabelSelected]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Default Toggle */}
        <View style={styles.toggleField}>
          <View style={styles.toggleInfo}>
            <Text style={styles.label}>Set as Default</Text>
            <Text style={styles.toggleDescription}>
              This playbook will be automatically activated for {emergencyType} emergencies
            </Text>
          </View>
          <Switch
            value={isDefault}
            onValueChange={setIsDefault}
            trackColor={{ false: '#0f3460', true: '#2a9d8f' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          <Text style={styles.createButtonText}>
            {isLoading ? 'Creating...' : 'Create Playbook'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  form: {
    padding: 16,
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    width: '31%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f3460',
  },
  typeButtonSelected: {
    borderColor: '#e63946',
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 12,
    color: '#888',
  },
  typeLabelSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  toggleField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
});
