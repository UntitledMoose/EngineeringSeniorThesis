import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Circle, Text as SvgText, G } from 'react-native-svg';

import type { UserRole } from '@/types/database';

const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#e63946',
  security: '#f4a261',
  teacher: '#2a9d8f',
  volunteer: '#457b9d',
};

interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PersonLocation {
  userId: string;
  userName: string | null;
  userRole: UserRole;
  roomId: string | null;
}

interface FloorMapProps {
  floorLevel: number;
  rooms: Room[];
  personnel: PersonLocation[];
  highlightRoomId?: string | null;
  width?: number;
  height?: number;
}

export function FloorMap({
  floorLevel,
  rooms,
  personnel,
  highlightRoomId,
  width = Dimensions.get('window').width - 32,
  height = 300,
}: FloorMapProps) {
  // Group personnel by room
  const personnelByRoom = personnel.reduce<Record<string, PersonLocation[]>>((acc, person) => {
    const roomId = person.roomId ?? 'unknown';
    if (!acc[roomId]) acc[roomId] = [];
    acc[roomId].push(person);
    return acc;
  }, {});

  // Calculate scale to fit rooms in view
  const allX = rooms.flatMap((r) => [r.x, r.x + r.width]);
  const allY = rooms.flatMap((r) => [r.y, r.y + r.height]);
  const minX = Math.min(...allX, 0);
  const maxX = Math.max(...allX, 100);
  const minY = Math.min(...allY, 0);
  const maxY = Math.max(...allY, 100);

  const scaleX = (width - 40) / (maxX - minX || 1);
  const scaleY = (height - 60) / (maxY - minY || 1);
  const scale = Math.min(scaleX, scaleY);

  const transformX = (x: number) => (x - minX) * scale + 20;
  const transformY = (y: number) => (y - minY) * scale + 40;

  return (
    <View style={styles.container}>
      <Text style={styles.floorLabel}>Floor {floorLevel}</Text>
      <Svg width={width} height={height}>
        {/* Rooms */}
        {rooms.map((room) => {
          const roomPersonnel = personnelByRoom[room.id] ?? [];
          const isHighlighted = room.id === highlightRoomId;
          const hasPersonnel = roomPersonnel.length > 0;

          return (
            <G key={room.id}>
              <Rect
                x={transformX(room.x)}
                y={transformY(room.y)}
                width={room.width * scale}
                height={room.height * scale}
                fill={isHighlighted ? 'rgba(230, 57, 70, 0.3)' : hasPersonnel ? 'rgba(42, 157, 143, 0.2)' : '#1a1a2e'}
                stroke={isHighlighted ? '#e63946' : '#0f3460'}
                strokeWidth={isHighlighted ? 2 : 1}
              />
              <SvgText
                x={transformX(room.x + room.width / 2)}
                y={transformY(room.y + room.height / 2) - 5}
                fill="#888"
                fontSize={10}
                textAnchor="middle"
              >
                {room.name.length > 10 ? room.name.substring(0, 10) + '...' : room.name}
              </SvgText>
              {hasPersonnel && (
                <SvgText
                  x={transformX(room.x + room.width / 2)}
                  y={transformY(room.y + room.height / 2) + 10}
                  fill="#2a9d8f"
                  fontSize={12}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {roomPersonnel.length}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Personnel dots in each room */}
        {rooms.map((room) => {
          const roomPersonnel = personnelByRoom[room.id] ?? [];
          const centerX = transformX(room.x + room.width / 2);
          const centerY = transformY(room.y + room.height / 2);

          return roomPersonnel.slice(0, 5).map((person, index) => {
            const angle = (index / Math.min(roomPersonnel.length, 5)) * 2 * Math.PI;
            const radius = Math.min(room.width, room.height) * scale * 0.25;
            const dotX = centerX + Math.cos(angle) * radius;
            const dotY = centerY + Math.sin(angle) * radius + 15;

            return (
              <Circle
                key={person.userId}
                cx={dotX}
                cy={dotY}
                r={4}
                fill={ROLE_COLORS[person.userRole]}
              />
            );
          });
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {(Object.entries(ROLE_COLORS) as [UserRole, string][]).map(([role, color]) => (
          <View key={role} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{role}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 8,
  },
  floorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#888',
    textTransform: 'capitalize',
  },
});
