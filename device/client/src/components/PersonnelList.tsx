import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

import type { UserRole } from '@/types/database';

const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#e63946',
  security: '#f4a261',
  teacher: '#2a9d8f',
  volunteer: '#457b9d',
};

export interface PersonnelLocation {
  user_id: string;
  user_name: string | null;
  user_role: UserRole;
  room_id: string | null;
  room_name: string | null;
  building_name: string | null;
  floor_level: number | null;
  confidence: number | null;
  last_update: string | null;
}

interface PersonnelListProps {
  personnel: PersonnelLocation[];
  compact?: boolean;
  maxItems?: number;
}

function formatLastUpdate(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${Math.floor(diffMins / 60)}h ago`;
}

function PersonnelCard({ person, compact }: { person: PersonnelLocation; compact?: boolean }) {
  const isRecent = person.last_update
    ? new Date().getTime() - new Date(person.last_update).getTime() < 300000
    : false;

  if (compact) {
    return (
      <View style={styles.compactCard}>
        <View style={[styles.statusDot, { backgroundColor: isRecent ? '#2a9d8f' : '#6c757d' }]} />
        <Text style={styles.compactName} numberOfLines={1}>
          {person.user_name ?? 'Unknown'}
        </Text>
        <View style={[styles.roleBadgeSmall, { backgroundColor: ROLE_COLORS[person.user_role] }]}>
          <Text style={styles.roleBadgeTextSmall}>{person.user_role[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.compactLocation} numberOfLines={1}>
          {person.room_name ?? 'Unknown'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: isRecent ? '#2a9d8f' : '#6c757d' }]} />
        <Text style={styles.name}>{person.user_name ?? 'Unknown'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[person.user_role] }]}>
          <Text style={styles.roleBadgeText}>{person.user_role}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.locationInfo}>
          <Text style={styles.roomName}>
            {person.room_name ?? 'Unknown Room'}
            {person.floor_level !== null && ` (Floor ${person.floor_level})`}
          </Text>
          {person.building_name && (
            <Text style={styles.buildingName}>{person.building_name}</Text>
          )}
        </View>
        <Text style={styles.lastUpdate}>{formatLastUpdate(person.last_update)}</Text>
      </View>
      {person.confidence !== null && (
        <View style={styles.confidenceBar}>
          <View style={[styles.confidenceFill, { width: `${person.confidence * 100}%` }]} />
        </View>
      )}
    </View>
  );
}

export function PersonnelList({ personnel, compact = false, maxItems }: PersonnelListProps) {
  const displayPersonnel = maxItems ? personnel.slice(0, maxItems) : personnel;
  const hasMore = maxItems && personnel.length > maxItems;

  return (
    <View style={styles.container}>
      {displayPersonnel.map((person) => (
        <PersonnelCard key={person.user_id} person={person} compact={compact} />
      ))}
      {hasMore && (
        <Text style={styles.moreText}>+{personnel.length - maxItems!} more</Text>
      )}
      {personnel.length === 0 && (
        <Text style={styles.emptyText}>No personnel location data</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  locationInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 14,
    color: '#888',
  },
  buildingName: {
    fontSize: 12,
    color: '#0f3460',
    marginTop: 2,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#0f3460',
  },
  confidenceBar: {
    height: 4,
    backgroundColor: '#0f3460',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#2a9d8f',
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  compactName: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  roleBadgeSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  compactLocation: {
    fontSize: 12,
    color: '#888',
    width: 80,
    textAlign: 'right',
  },
  moreText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    padding: 16,
  },
});
