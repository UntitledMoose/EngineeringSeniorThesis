import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  value: number | string;
  label: string;
  icon?: string;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
}

export function StatCard({ value, label, icon, color, trend }: StatCardProps) {
  return (
    <View style={styles.container}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.value, color && { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {trend && (
        <Text style={[styles.trend, trend === 'up' && styles.trendUp, trend === 'down' && styles.trendDown]}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  trend: {
    fontSize: 14,
    marginTop: 4,
    color: '#888',
  },
  trendUp: {
    color: '#2a9d8f',
  },
  trendDown: {
    color: '#e63946',
  },
});
