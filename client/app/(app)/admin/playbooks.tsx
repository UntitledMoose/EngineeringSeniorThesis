import { Link, router } from 'expo-router';
import { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';

import { usePlaybookStore, usePlaybooks } from '@/stores/playbooks';
import type { EmergencyType } from '@/types/database';

const EMERGENCY_TYPE_INFO: Record<EmergencyType, { icon: string; label: string; color: string }> = {
  fire: { icon: '🔥', label: 'Fire', color: '#e63946' },
  lockdown: { icon: '🔒', label: 'Lockdown', color: '#9d4edd' },
  medical: { icon: '🏥', label: 'Medical', color: '#2a9d8f' },
  weather: { icon: '⛈️', label: 'Weather', color: '#457b9d' },
  evacuation: { icon: '🚨', label: 'Evacuation', color: '#f4a261' },
  other: { icon: '⚠️', label: 'Other', color: '#6c757d' },
};

export default function PlaybooksScreen() {
  const playbooks = usePlaybooks();
  const { fetchPlaybooks, deletePlaybook, isLoading } = usePlaybookStore();

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Playbook', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deletePlaybook(id);
          if (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  // Group playbooks by emergency type
  const groupedPlaybooks = playbooks.reduce<Record<EmergencyType, typeof playbooks>>(
    (acc, playbook) => {
      if (!acc[playbook.emergency_type]) {
        acc[playbook.emergency_type] = [];
      }
      acc[playbook.emergency_type].push(playbook);
      return acc;
    },
    {} as Record<EmergencyType, typeof playbooks>
  );

  const sections = Object.entries(groupedPlaybooks) as [EmergencyType, typeof playbooks][];

  return (
    <View style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={([type]) => type}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchPlaybooks} tintColor="#888" />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/(app)/admin/playbook/new')}
          >
            <Text style={styles.createButtonIcon}>+</Text>
            <Text style={styles.createButtonText}>Create New Playbook</Text>
          </TouchableOpacity>
        }
        renderItem={({ item: [type, typePlaybooks] }) => {
          const typeInfo = EMERGENCY_TYPE_INFO[type];
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>{typeInfo.icon}</Text>
                <Text style={styles.sectionTitle}>{typeInfo.label}</Text>
                <Text style={styles.sectionCount}>{typePlaybooks.length}</Text>
              </View>

              {typePlaybooks.map((playbook) => (
                <TouchableOpacity
                  key={playbook.id}
                  style={styles.playbookCard}
                  onPress={() => router.push(`/(app)/admin/playbook/${playbook.id}`)}
                  onLongPress={() => handleDelete(playbook.id, playbook.name)}
                >
                  <View style={styles.playbookInfo}>
                    <View style={styles.playbookHeader}>
                      <Text style={styles.playbookName}>{playbook.name}</Text>
                      {playbook.is_default && (
                        <View style={[styles.defaultBadge, { backgroundColor: typeInfo.color }]}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    {playbook.description && (
                      <Text style={styles.playbookDescription} numberOfLines={2}>
                        {playbook.description}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Playbooks</Text>
              <Text style={styles.emptySubtitle}>
                Create your first emergency response playbook to get started.
              </Text>
            </View>
          ) : null
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
  list: {
    padding: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  createButtonIcon: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    color: '#888',
  },
  playbookCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playbookInfo: {
    flex: 1,
  },
  playbookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playbookName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  playbookDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  chevron: {
    fontSize: 24,
    color: '#888',
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});
