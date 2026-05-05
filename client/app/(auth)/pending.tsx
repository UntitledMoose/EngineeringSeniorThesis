import { router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { useAuthStore } from '@/stores/auth';

export default function PendingScreen() {
  const { signOut, refreshProfile, isLoading } = useAuthStore();

  const handleRefresh = async () => {
    await refreshProfile();
    router.replace('/');
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Account Pending</Text>
        <Text style={styles.message}>
          Your account has been created, but you haven't been added to an organization yet.
        </Text>
        <Text style={styles.message}>
          Please contact your administrator to be added to your organization's emergency response
          system.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={isLoading}
          >
            <Text style={styles.refreshButtonText}>
              {isLoading ? 'Checking...' : 'Check Again'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  actions: {
    marginTop: 32,
    gap: 16,
    width: '100%',
  },
  refreshButton: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e63946',
  },
  signOutButtonText: {
    color: '#e63946',
    fontSize: 16,
    fontWeight: '600',
  },
});
