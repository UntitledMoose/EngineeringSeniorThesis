import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { EmergencyBanner, PersonnelList, StatCard, TaskProgress, FloorMap } from '@/components';
import type { PersonnelLocation } from '@/components';
import { supabase } from '@/lib/supabase';
import { useActiveEmergency, useEmergencyStore } from '@/stores/emergency';
import { useBuildingsStore, useBuildings } from '@/stores/buildings';
import type { UserRole } from '@/types/database';

// Mock room layout data - in production, this would come from the database
const MOCK_ROOMS = [
  { id: '33333333-3333-3333-3333-333333333301', name: 'Entrance', x: 0, y: 0, width: 30, height: 20 },
  { id: '33333333-3333-3333-3333-333333333302', name: 'Office', x: 30, y: 0, width: 25, height: 20 },
  { id: '33333333-3333-3333-3333-333333333303', name: 'Hallway A', x: 55, y: 0, width: 45, height: 10 },
  { id: '33333333-3333-3333-3333-333333333304', name: 'Room 101', x: 55, y: 10, width: 15, height: 20 },
  { id: '33333333-3333-3333-3333-333333333305', name: 'Room 102', x: 70, y: 10, width: 15, height: 20 },
  { id: '33333333-3333-3333-3333-333333333306', name: 'Room 103', x: 85, y: 10, width: 15, height: 20 },
];

export default function DashboardScreen() {
  const activeEmergency = useActiveEmergency();
  const { resolveEmergency } = useEmergencyStore();
  const buildings = useBuildings();
  const { fetchBuildings } = useBuildingsStore();

  const [personnel, setPersonnel] = useState<PersonnelLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const fetchPersonnelLocations = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await (supabase as any).rpc('get_personnel_locations');

      if (fetchError) throw fetchError;

      setPersonnel((data ?? []) as PersonnelLocation[]);
    } catch (err) {
      console.error('Error fetching personnel:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersonnelLocations();
    fetchBuildings();

    // Refresh every 10 seconds during active emergency, 30 seconds otherwise
    const interval = setInterval(
      fetchPersonnelLocations,
      activeEmergency ? 10000 : 30000
    );

    return () => clearInterval(interval);
  }, [fetchPersonnelLocations, fetchBuildings, activeEmergency]);

  const handleResolve = () => {
    if (!activeEmergency) return;

    Alert.alert('Resolve Emergency', 'Are you sure you want to mark this emergency as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: async () => {
          const { error } = await resolveEmergency(activeEmergency.id);
          if (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  // Calculate stats
  const totalPersonnel = personnel.length;
  const activePersonnel = personnel.filter(
    (p) => p.last_update && new Date().getTime() - new Date(p.last_update).getTime() < 300000
  ).length;
  const uniqueRooms = new Set(personnel.map((p) => p.room_id).filter(Boolean)).size;

  // Group personnel by role for breakdown
  const personnelByRole = personnel.reduce<Record<UserRole, number>>(
    (acc, p) => {
      acc[p.user_role] = (acc[p.user_role] || 0) + 1;
      return acc;
    },
    {} as Record<UserRole, number>
  );

  // Get unique floors
  const floors = [...new Set(personnel.map((p) => p.floor_level).filter((f) => f !== null))].sort();

  // Personnel for current floor
  const floorPersonnel = personnel.filter((p) => p.floor_level === selectedFloor);

  // Convert to FloorMap format
  const mapPersonnel = floorPersonnel.map((p) => ({
    userId: p.user_id,
    userName: p.user_name,
    userRole: p.user_role,
    roomId: p.room_id,
  }));

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={fetchPersonnelLocations} tintColor="#888" />
      }
    >
      {/* Emergency Banner */}
      {activeEmergency && (
        <EmergencyBanner
          emergencyType={activeEmergency.emergency_type}
          buildingName={activeEmergency.building_name}
          completedTasks={activeEmergency.completed_tasks}
          totalTasks={activeEmergency.total_tasks}
          onResolve={handleResolve}
          showResolve
        />
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatCard value={totalPersonnel} label="Total Personnel" icon="👥" />
        <StatCard
          value={activePersonnel}
          label="Active (5m)"
          icon="📍"
          color={activePersonnel > 0 ? '#2a9d8f' : undefined}
        />
        <StatCard value={uniqueRooms} label="Occupied Rooms" icon="🏢" />
      </View>

      {/* Task Progress (during emergency) */}
      {activeEmergency && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Playbook Progress</Text>
          <View style={styles.card}>
            <Text style={styles.playbookName}>{activeEmergency.playbook_name ?? 'No Playbook'}</Text>
            <TaskProgress
              completed={activeEmergency.completed_tasks}
              total={activeEmergency.total_tasks}
              size="large"
            />
          </View>
        </View>
      )}

      {/* View Toggle */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personnel Locations</Text>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
              onPress={() => setViewMode('map')}
            >
              <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>
                Map
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
                List
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'map' ? (
          <>
            {/* Floor Selector */}
            {floors.length > 1 && (
              <View style={styles.floorSelector}>
                {floors.map((floor) => (
                  <TouchableOpacity
                    key={floor}
                    style={[
                      styles.floorButton,
                      selectedFloor === floor && styles.floorButtonActive,
                    ]}
                    onPress={() => setSelectedFloor(floor!)}
                  >
                    <Text
                      style={[
                        styles.floorButtonText,
                        selectedFloor === floor && styles.floorButtonTextActive,
                      ]}
                    >
                      Floor {floor}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Floor Map */}
            <FloorMap
              floorLevel={selectedFloor}
              rooms={MOCK_ROOMS}
              personnel={mapPersonnel}
            />

            {/* Personnel on this floor */}
            <View style={styles.floorPersonnel}>
              <Text style={styles.floorPersonnelTitle}>
                On Floor {selectedFloor} ({floorPersonnel.length})
              </Text>
              <PersonnelList personnel={floorPersonnel} compact maxItems={5} />
            </View>
          </>
        ) : (
          <PersonnelList personnel={personnel} />
        )}
      </View>

      {/* Role Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By Role</Text>
        <View style={styles.roleBreakdown}>
          {(Object.entries(personnelByRole) as [UserRole, number][]).map(([role, count]) => (
            <View key={role} style={styles.roleItem}>
              <Text style={styles.roleCount}>{count}</Text>
              <Text style={styles.roleLabel}>{role}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  section: {
    padding: 16,
    paddingTop: 0,
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
  },
  playbookName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#0f3460',
  },
  toggleText: {
    fontSize: 12,
    color: '#888',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  floorSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  floorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  floorButtonActive: {
    backgroundColor: '#0f3460',
  },
  floorButtonText: {
    fontSize: 14,
    color: '#888',
  },
  floorButtonTextActive: {
    color: '#ffffff',
  },
  floorPersonnel: {
    marginTop: 12,
  },
  floorPersonnelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  roleBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  roleItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 80,
  },
  roleCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  roleLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  errorContainer: {
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#e63946',
    textAlign: 'center',
  },
  spacer: {
    height: 24,
  },
});
