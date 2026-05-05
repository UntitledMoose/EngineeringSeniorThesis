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
  Switch,
  ActivityIndicator,
} from 'react-native';

import { usePlaybookStore, useCurrentPlaybook } from '@/stores/playbooks';
import type { UserRole } from '@/types/database';

const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#e63946',
  security: '#f4a261',
  teacher: '#2a9d8f',
  volunteer: '#457b9d',
};

const ROLES: { role: UserRole; label: string }[] = [
  { role: 'admin', label: 'Admin' },
  { role: 'security', label: 'Security' },
  { role: 'teacher', label: 'Teacher' },
  { role: 'volunteer', label: 'Volunteer' },
];

export default function EditPlaybookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playbook = useCurrentPlaybook();
  const {
    fetchPlaybook,
    updatePlaybook,
    deletePlaybook,
    createTask,
    updateTask,
    deleteTask,
    isLoading,
  } = usePlaybookStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskRole, setNewTaskRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (id) {
      fetchPlaybook(id);
    }
  }, [id, fetchPlaybook]);

  useEffect(() => {
    if (playbook) {
      setName(playbook.name);
      setDescription(playbook.description ?? '');
      setIsDefault(playbook.is_default);
    }
  }, [playbook]);

  const handleSave = async () => {
    if (!id || !name.trim()) return;

    const { error } = await updatePlaybook(id, {
      name: name.trim(),
      description: description.trim() || null,
      is_default: isDefault,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setHasChanges(false);
      Alert.alert('Saved', 'Playbook updated successfully');
    }
  };

  const handleDelete = () => {
    if (!id || !playbook) return;

    Alert.alert('Delete Playbook', `Are you sure you want to delete "${playbook.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deletePlaybook(id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            router.back();
          }
        },
      },
    ]);
  };

  const handleAddTask = async () => {
    if (!id || !newTaskTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    const nextSequence = (playbook?.tasks.length ?? 0) + 1;

    const { error } = await createTask({
      playbook_id: id,
      sequence_number: nextSequence,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || undefined,
      assigned_role: newTaskRole ?? undefined,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskRole(null);
      setShowNewTask(false);
    }
  };

  const handleDeleteTask = (taskId: string, taskTitle: string) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${taskTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteTask(taskId);
          if (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  if (isLoading && !playbook) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e63946" />
      </View>
    );
  }

  if (!playbook) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Playbook not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Playbook Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setHasChanges(true);
              }}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setHasChanges(true);
              }}
              multiline
              numberOfLines={3}
              placeholder="Optional description..."
              placeholderTextColor="#888"
            />
          </View>

          <View style={styles.toggleField}>
            <View style={styles.toggleInfo}>
              <Text style={styles.label}>Default Playbook</Text>
              <Text style={styles.toggleDescription}>
                Automatically activate for {playbook.emergency_type} emergencies
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={(value) => {
                setIsDefault(value);
                setHasChanges(true);
              }}
              trackColor={{ false: '#0f3460', true: '#2a9d8f' }}
              thumbColor="#ffffff"
            />
          </View>

          {hasChanges && (
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tasks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tasks ({playbook.tasks.length})</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowNewTask(!showNewTask)}
          >
            <Text style={styles.addButtonText}>{showNewTask ? 'Cancel' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {/* New Task Form */}
        {showNewTask && (
          <View style={styles.newTaskCard}>
            <TextInput
              style={styles.input}
              placeholder="Task title"
              placeholderTextColor="#888"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Task description (optional)"
              placeholderTextColor="#888"
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              multiline
              numberOfLines={2}
            />
            <View style={styles.roleSelector}>
              <Text style={styles.roleSelectorLabel}>Assign to:</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[styles.roleButton, !newTaskRole && styles.roleButtonSelected]}
                  onPress={() => setNewTaskRole(null)}
                >
                  <Text style={styles.roleButtonText}>Anyone</Text>
                </TouchableOpacity>
                {ROLES.map(({ role, label }) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      newTaskRole === role && styles.roleButtonSelected,
                      newTaskRole === role && { backgroundColor: ROLE_COLORS[role] },
                    ]}
                    onPress={() => setNewTaskRole(role)}
                  >
                    <Text style={styles.roleButtonText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleAddTask}>
              <Text style={styles.saveButtonText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Task List */}
        {playbook.tasks.map((task, index) => (
          <TouchableOpacity
            key={task.id}
            style={styles.taskCard}
            onPress={() => router.push(`/(app)/admin/task/${task.id}`)}
          >
            <View style={styles.taskHeader}>
              <View style={styles.taskNumber}>
                <Text style={styles.taskNumberText}>{task.sequence_number}</Text>
              </View>
              <View style={styles.taskContent}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.description && (
                  <Text style={styles.taskDescription} numberOfLines={2}>
                    {task.description}
                  </Text>
                )}
                <View style={styles.taskMeta}>
                  {task.assigned_role && (
                    <View
                      style={[
                        styles.taskRoleBadge,
                        { backgroundColor: ROLE_COLORS[task.assigned_role] },
                      ]}
                    >
                      <Text style={styles.taskRoleBadgeText}>{task.assigned_role}</Text>
                    </View>
                  )}
                  {task.depends_on_task_id && (
                    <Text style={styles.taskDependency}>
                      Depends on task{' '}
                      {playbook.tasks.find((t) => t.id === task.depends_on_task_id)
                        ?.sequence_number ?? '?'}
                    </Text>
                  )}
                  {task.condition && (
                    <Text style={styles.taskConditional}>Conditional</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.taskDeleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteTask(task.id, task.title);
                }}
              >
                <Text style={styles.taskDeleteButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {playbook.tasks.length === 0 && !showNewTask && (
          <View style={styles.emptyTasks}>
            <Text style={styles.emptyTasksText}>No tasks yet. Add your first task above.</Text>
          </View>
        )}
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete Playbook</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#888',
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
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
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    gap: 16,
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
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  toggleField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  saveButton: {
    backgroundColor: '#2a9d8f',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0f3460',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  newTaskCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    borderWidth: 2,
    borderColor: '#2a9d8f',
  },
  roleSelector: {
    gap: 8,
  },
  roleSelectorLabel: {
    fontSize: 14,
    color: '#888',
  },
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0f3460',
  },
  roleButtonSelected: {
    backgroundColor: '#2a9d8f',
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  taskCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  taskHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  taskNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0f3460',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  taskDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  taskRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taskRoleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  taskDependency: {
    fontSize: 12,
    color: '#f4a261',
    fontStyle: 'italic',
  },
  taskConditional: {
    fontSize: 10,
    color: '#9d4edd',
    fontWeight: '600',
    backgroundColor: 'rgba(157, 78, 221, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taskDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(230, 57, 70, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskDeleteButtonText: {
    fontSize: 20,
    color: '#e63946',
    fontWeight: 'bold',
  },
  emptyTasks: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTasksText: {
    fontSize: 14,
    color: '#888',
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
  spacer: {
    height: 48,
  },
});
