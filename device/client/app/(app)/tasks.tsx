import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';

import { useEmergencyStore, useActiveEmergency, useMyTasks } from '@/stores/emergency';
import type { TaskStatus } from '@/types/database';

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#888',
  in_progress: '#f4a261',
  completed: '#2a9d8f',
  skipped: '#6c757d',
};

export default function TasksScreen() {
  const activeEmergency = useActiveEmergency();
  const myTasks = useMyTasks();
  const { completeTask, fetchMyTasks } = useEmergencyStore();

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  const handleCompleteTask = async (taskInstanceId: string, title: string) => {
    Alert.alert('Complete Task', `Mark "${title}" as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          const { error } = await completeTask(taskInstanceId);
          if (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  if (!activeEmergency) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>✓</Text>
        <Text style={styles.emptyTitle}>No Active Emergency</Text>
        <Text style={styles.emptySubtitle}>
          When an emergency is triggered, your assigned tasks will appear here.
        </Text>
      </View>
    );
  }

  const pendingTasks = myTasks.filter((t) => t.status === 'pending');
  const completedTasks = myTasks.filter((t) => t.status === 'completed');

  return (
    <View style={styles.container}>
      {/* Emergency Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{activeEmergency.playbook_name ?? 'Emergency'}</Text>
        <Text style={styles.headerProgress}>
          {activeEmergency.completed_tasks} of {activeEmergency.total_tasks} tasks complete
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(activeEmergency.completed_tasks / activeEmergency.total_tasks) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Task List */}
      <FlatList
        data={myTasks}
        keyExtractor={(item) => item.task_instance_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          pendingTasks.length > 0 ? (
            <Text style={styles.sectionHeader}>Your Tasks ({pendingTasks.length} pending)</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const isBlocked = !item.depends_on_completed;
          const isCompleted = item.status === 'completed';

          return (
            <View
              style={[
                styles.taskCard,
                isCompleted && styles.taskCardCompleted,
                isBlocked && styles.taskCardBlocked,
              ]}
            >
              <View style={styles.taskHeader}>
                <View
                  style={[styles.taskNumber, { backgroundColor: STATUS_COLORS[item.status] }]}
                >
                  <Text style={styles.taskNumberText}>{item.sequence_number}</Text>
                </View>
                <View style={styles.taskContent}>
                  <Text style={[styles.taskTitle, isCompleted && styles.taskTitleCompleted]}>
                    {item.title}
                  </Text>
                  {item.description && (
                    <Text style={styles.taskDescription}>{item.description}</Text>
                  )}
                  {isBlocked && (
                    <Text style={styles.blockedText}>Waiting for previous task</Text>
                  )}
                </View>
              </View>

              {!isCompleted && !isBlocked && (
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => handleCompleteTask(item.task_instance_id, item.title)}
                >
                  <Text style={styles.completeButtonText}>Complete</Text>
                </TouchableOpacity>
              )}

              {isCompleted && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>✓ Done</Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyListText}>No tasks assigned to you</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerProgress: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#0f3460',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2a9d8f',
    borderRadius: 4,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  taskCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0f3460',
  },
  taskCardCompleted: {
    opacity: 0.6,
    borderLeftColor: '#2a9d8f',
  },
  taskCardBlocked: {
    opacity: 0.5,
    borderLeftColor: '#888',
  },
  taskHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  taskNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  taskDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    lineHeight: 20,
  },
  blockedText: {
    fontSize: 12,
    color: '#f4a261',
    marginTop: 8,
    fontStyle: 'italic',
  },
  completeButton: {
    backgroundColor: '#2a9d8f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  completedBadge: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  completedBadgeText: {
    color: '#2a9d8f',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyList: {
    padding: 24,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    color: '#888',
  },
});
