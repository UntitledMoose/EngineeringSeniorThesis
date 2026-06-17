import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { BLEProvider } from '@/contexts/BLEContext';
import { setupNotifications } from '@/lib/notifications';
import { useAuthStore, useIsAdminOrSecurity } from '@/stores/auth';
import { useEmergencyStore } from '@/stores/emergency';

export default function AppLayout() {
  const { session, profile } = useAuthStore();
  const isAdminOrSecurity = useIsAdminOrSecurity();
  const { subscribeToEmergencies, unsubscribe, fetchActiveEmergency, fetchMyTasks } =
    useEmergencyStore();

  // Subscribe to real-time emergency updates
  useEffect(() => {
    setupNotifications().catch(console.error);
    fetchActiveEmergency();
    fetchMyTasks();
    subscribeToEmergencies();

    return () => {
      unsubscribe();
    };
  }, []);

  // Redirect if not authenticated
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile) {
    return <Redirect href="/(auth)/pending" />;
  }

  return (
    <BLEProvider>
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#0f3460',
        },
        tabBarActiveTintColor: '#e63946',
        tabBarInactiveTintColor: '#888',
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#ffffff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>📋</Text>,
        }}
      />
      {isAdminOrSecurity && (
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>📊</Text>,
          }}
        />
      )}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>⚙️</Text>,
        }}
      />
    </Tabs>
    </BLEProvider>
  );
}
