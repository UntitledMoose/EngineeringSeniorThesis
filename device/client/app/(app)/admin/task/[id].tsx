import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { supabase } from '@/lib/supabase';
import { usePlaybookStore, useCurrentPlaybook } from '@/stores/playbooks';
import type { UserRole, Json } from '@/types/database';

const ROLES: { role: UserRole | null; label: string }[] = [
  { role: null, label: 'Anyone' },
  { role: 'admin', label: 'Admin' },
  { role: 'security', label: 'Security' },
  { role: 'teacher', label: 'Teacher' },
  { role: 'volunteer', label: 'Volunteer' },
];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#e63946',
  security: '#f4a261',
  teacher: '#2a9d8f',
  volunteer: '#457b9d',
};

interface TaskCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
}

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playbook = useCurrentPlaybook();
  const { updateTask, deleteTask, isLoading } = usePlaybookStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedRole, setAssignedRole] = useState<UserRole | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [dependsOnTaskId, setDependsOnTaskId] = useState<string | null>(null);
  const [condition, setCondition] = useState<TaskCondition | null>(null);

  const [taskLoading, setTaskLoading] = useState(true);

  // Find the task in current playbook or fetch it
  const task = playbook?.tasks.find((t) => t.id === id);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setAssignedRole(task.assigned_role);
      setEstimatedDuration(task.estimated_duration?.toString() ?? '');
      setDependsOnTaskId(task.depends_on_task_id);
      setCondition(task.condition as TaskCondition | null);
      setTaskLoading(false);
    } else if (id) {
      // Fetch task directly if not in current playbook
      fetchTask();
    }
  }, [task, id]);

  const fetchTask = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('playbook_tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setTitle(data.title);
      setDescription(data.description ?? '');
      setAssignedRole(data.assigned_role);
      setEstimatedDuration(data.estimated_duration?.toString() ?? '');
      setDependsOnTaskId(data.depends_on_task_id);
      setCondition(data.condition as TaskCondition | null);
    } catch (error) {
      console.error('Error fetching task:', error);
      Alert.alert('Error', 'Failed to load task');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !title.trim()) {
      Alert.alert('Error', 'Task title is required');
      return;
    }

    const { error } = await updateTask(id, {
      title: title.trim(),
      description: description.trim() || null,
      assigned_role: assignedRole,
      estimated_duration: estimatedDuration ? parseInt(estimatedDuration, 10) : null,
      depends_on_task_id: dependsOnTaskId,
      condition: condition as Json,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
  };

  const handleDelete = () => {
    if (!id) return;

    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteTask(id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            router.back();
          }
        },
      },
    ]);
  };

  // Get other tasks for dependency selection
  const otherTasks = playbook?.tasks.filter((t) => t.id !== id) ?? [];

  if (taskLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e63946" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Task Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            placeholderTextColor="#888"
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Detailed instructions..."
            placeholderTextColor="#888"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Assigned Role */}
        <View style={styles.field}>
          <Text style={styles.label}>Assigned To</Text>
          <View style={styles.roleButtons}>
            {ROLES.map(({ role, label }) => (
              <TouchableOpacity
                key={role ?? 'anyone'}
                style={[
                  styles.roleButton,
                  assignedRole === role && styles.roleButtonSelected,
                  assignedRole === role && role && { backgroundColor: ROLE_COLORS[role] },
                ]}
                onPress={() => setAssignedRole(role)}
              >
                <Text style={styles.roleButtonText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Estimated Duration */}
        <View style={styles.field}>
          <Text style={styles.label}>Estimated Duration (seconds)</Text>
          <TextInput
            style={styles.input}
            value={estimatedDuration}
            onChangeText={setEstimatedDuration}
            placeholder="e.g., 60 for 1 minute"
            placeholderTextColor="#888"
            keyboardType="numeric"
          />
        </View>

        {/* Dependencies */}
        <View style={styles.field}>
          <Text style={styles.label}>Depends On</Text>
          <Text style={styles.fieldHint}>
            This task will be blocked until the selected task is completed
          </Text>
          <View style={styles.dependencyButtons}>
            <TouchableOpacity
              style={[styles.dependencyButton, !dependsOnTaskId && styles.dependencyButtonSelected]}
              onPress={() => setDependsOnTaskId(null)}
            >
              <Text style={styles.dependencyButtonText}>No Dependency</Text>
            </TouchableOpacity>
            {otherTasks.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.dependencyButton,
                  dependsOnTaskId === t.id && styles.dependencyButtonSelected,
                ]}
                onPress={() => setDependsOnTaskId(t.id)}
              >
                <Text style={styles.dependencyButtonText}>
                  {t.sequence_number}. {t.title.substring(0, 20)}
                  {t.title.length > 20 ? '...' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Conditional Execution */}
        <View style={styles.field}>
          <Text style={styles.label}>Conditional Execution</Text>
          <Text style={styles.fieldHint}>
            Only show this task when certain conditions are met
          </Text>
          <View style={styles.conditionCard}>
            <TouchableOpacity
              style={[styles.conditionToggle, !condition && styles.conditionToggleSelected]}
              onPress={() => setCondition(null)}
            >
              <Text style={styles.conditionToggleText}>Always Show</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.conditionToggle, condition && styles.conditionToggleSelected]}
              onPress={() =>
                setCondition({ field: 'emergency_type', operator: 'equals', value: '' })
              }
            >
              <Text style={styles.conditionToggleText}>Conditional</Text>
            </TouchableOpacity>
          </View>

          {condition && (
            <View style={styles.conditionEditor}>
              <Text style={styles.conditionLabel}>Show when emergency type is:</Text>
              <TextInput
                style={styles.input}
                value={condition.value}
                onChangeText={(value) => setCondition({ ...condition, value })}
                placeholder="e.g., fire, lockdown"
                placeholderTextColor="#888"
              />
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            <Text style={styles.saveButtonText}>{isLoading ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Task</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
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
  fieldHint: {
    fontSize: 12,
    color: '#888',
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
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  roleButtonSelected: {
    backgroundColor: '#2a9d8f',
    borderColor: '#2a9d8f',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  dependencyButtons: {
    gap: 8,
  },
  dependencyButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  dependencyButtonSelected: {
    borderColor: '#2a9d8f',
    backgroundColor: 'rgba(42, 157, 143, 0.1)',
  },
  dependencyButtonText: {
    fontSize: 14,
    color: '#ffffff',
  },
  conditionCard: {
    flexDirection: 'row',
    gap: 8,
  },
  conditionToggle: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  conditionToggleSelected: {
    borderColor: '#2a9d8f',
    backgroundColor: 'rgba(42, 157, 143, 0.1)',
  },
  conditionToggleText: {
    fontSize: 14,
    color: '#ffffff',
  },
  conditionEditor: {
    marginTop: 12,
    gap: 8,
  },
  conditionLabel: {
    fontSize: 12,
    color: '#888',
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#2a9d8f',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteButton: {
    borderWidth: 2,
    borderColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e63946',
  },
});
