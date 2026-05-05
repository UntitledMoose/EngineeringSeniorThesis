import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TaskProgressProps {
  completed: number;
  total: number;
  showPercentage?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function TaskProgress({
  completed,
  total,
  showPercentage = true,
  size = 'medium',
}: TaskProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = completed === total && total > 0;

  const heightMap = { small: 4, medium: 8, large: 12 };
  const height = heightMap[size];

  return (
    <View style={styles.container}>
      <View style={[styles.bar, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: isComplete ? '#2a9d8f' : '#f4a261',
            },
          ]}
        />
      </View>
      {showPercentage && (
        <Text style={[styles.text, isComplete && styles.textComplete]}>
          {completed}/{total} ({percentage}%)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  bar: {
    backgroundColor: '#0f3460',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    color: '#888',
  },
  textComplete: {
    color: '#2a9d8f',
  },
});
