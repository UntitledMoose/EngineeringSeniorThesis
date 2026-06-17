import { Redirect, Stack } from 'expo-router';

import { useIsAdmin } from '@/stores/auth';

export default function AdminLayout() {
  const isAdmin = useIsAdmin();

  // Only admins can access admin screens
  if (!isAdmin) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#ffffff',
        contentStyle: { backgroundColor: '#16213e' },
      }}
    >
      <Stack.Screen name="playbooks" options={{ title: 'Playbooks' }} />
      <Stack.Screen name="playbook/[id]" options={{ title: 'Edit Playbook' }} />
      <Stack.Screen name="playbook/new" options={{ title: 'New Playbook' }} />
      <Stack.Screen name="task/[id]" options={{ title: 'Edit Task', presentation: 'modal' }} />

      <Stack.Screen name="beacons" options={{ title: 'Beacon Management' }} />
      <Stack.Screen name="beacon/new" options={{ title: 'Register Beacon' }} />
      <Stack.Screen name="beacon/[id]" options={{ title: 'Edit Beacon' }} />

      <Stack.Screen name="buildings" options={{ title: 'Buildings' }} />
      <Stack.Screen name="building/new" options={{ title: 'New Building' }} />
      <Stack.Screen name="building/[id]" options={{ title: 'Edit Building' }} />
      <Stack.Screen name="room/new" options={{ title: 'New Room' }} />
      <Stack.Screen name="room/[id]" options={{ title: 'Edit Room' }} />
    </Stack>
  );
}
