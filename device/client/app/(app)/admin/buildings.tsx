import { router } from 'expo-router';
import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';

import { useBuildings, useBuildingsStore } from '@/stores/buildings';

export default function BuildingsScreen() {
  const buildings = useBuildings();
  const { fetchBuildings, deleteBuilding, isLoading } = useBuildingsStore();

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(
      'Delete Building',
      `Delete "${name}"? All rooms and beacon assignments in this building will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteBuilding(id);
            if (error) Alert.alert('Error', error.message);
          },
        },
      ]
    );
  }, [deleteBuilding]);

  return (
    <View style={styles.container}>
      <FlatList
        data={buildings}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchBuildings} tintColor="#888" />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/(app)/admin/building/new')}
          >
            <Text style={styles.createButtonIcon}>+</Text>
            <Text style={styles.createButtonText}>Add Building</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/admin/building/${item.id}`)}
            onLongPress={() => handleDelete(item.id, item.name)}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.buildingName}>{item.name}</Text>
              {item.address && (
                <Text style={styles.buildingAddress}>{item.address}</Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>No Buildings</Text>
              <Text style={styles.emptySubtitle}>
                Add your first building to start setting up rooms and beacons.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16213e' },
  list: { padding: 16, paddingBottom: 24 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  createButtonIcon: { fontSize: 22, color: '#fff', fontWeight: 'bold' },
  createButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  buildingName: { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  buildingAddress: { fontSize: 13, color: '#888', marginTop: 4 },
  chevron: { fontSize: 24, color: '#888' },
  emptyContainer: { padding: 48, alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
