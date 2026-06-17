import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

import type { EmergencyType } from '@/types/database';

const EMERGENCY_INFO: Record<EmergencyType, { icon: string; color: string }> = {
  fire: { icon: '🔥', color: '#e63946' },
  lockdown: { icon: '🔒', color: '#9d4edd' },
  medical: { icon: '🏥', color: '#2a9d8f' },
  weather: { icon: '⛈️', color: '#457b9d' },
  evacuation: { icon: '🚨', color: '#f4a261' },
  other: { icon: '⚠️', color: '#6c757d' },
};

interface EmergencyBannerProps {
  emergencyType: EmergencyType;
  buildingName?: string | null;
  completedTasks: number;
  totalTasks: number;
  onResolve?: () => void;
  showResolve?: boolean;
}

export function EmergencyBanner({
  emergencyType,
  buildingName,
  completedTasks,
  totalTasks,
  onResolve,
  showResolve = false,
}: EmergencyBannerProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const info = EMERGENCY_INFO[emergencyType];

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: info.color, opacity: pulseAnim }]}>
      <Text style={styles.icon}>{info.icon}</Text>
      <View style={styles.content}>
        <Text style={styles.title}>{emergencyType.toUpperCase()} EMERGENCY</Text>
        <Text style={styles.subtitle}>
          {buildingName ?? 'All Buildings'} • {completedTasks}/{totalTasks} tasks
        </Text>
      </View>
      {showResolve && onResolve && (
        <TouchableOpacity style={styles.resolveButton} onPress={onResolve}>
          <Text style={styles.resolveText}>Resolve</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  icon: {
    fontSize: 32,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  resolveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resolveText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
