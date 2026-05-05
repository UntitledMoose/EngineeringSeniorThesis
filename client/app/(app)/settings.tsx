import { router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { useEffect, useState } from 'react';

import { getNotificationsEnabled, setNotificationsEnabled } from '@/lib/notifications';
import { useAuthStore, useProfile, useIsAdmin } from '@/stores/auth';

export default function SettingsScreen() {
  const profile = useProfile();
  const isAdmin = useIsAdmin();
  const { signOut } = useAuthStore();
  const [autoLocationReport, setAutoLocationReport] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);

  useEffect(() => {
    getNotificationsEnabled().then(setNotificationsEnabledState);
  }, []);

  const handleNotificationsToggle = (val: boolean) => {
    setNotificationsEnabledState(val);
    setNotificationsEnabled(val).catch(console.error);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Name</Text>
            <Text style={styles.profileValue}>{profile?.full_name ?? 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Email</Text>
            <Text style={styles.profileValue}>{profile?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Role</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{profile?.role?.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Phone</Text>
            <Text style={styles.profileValue}>{profile?.phone ?? 'Not set'}</Text>
          </View>
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto Location Reporting</Text>
              <Text style={styles.settingDescription}>
                Automatically report your location during emergencies
              </Text>
            </View>
            <Switch
              value={autoLocationReport}
              onValueChange={setAutoLocationReport}
              trackColor={{ false: '#0f3460', true: '#2a9d8f' }}
              thumbColor="#ffffff"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Emergency Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive push notifications for emergency alerts
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: '#0f3460', true: '#2a9d8f' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </View>

      {/* Admin Section */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/(app)/admin/playbooks')}
            >
              <Text style={styles.actionLabel}>Manage Playbooks</Text>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/(app)/admin/beacons')}
            >
              <Text style={styles.actionLabel}>Beacon Management</Text>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/(app)/admin/buildings')}
            >
              <Text style={styles.actionLabel}>Buildings & Rooms</Text>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bluetooth Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bluetooth</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow}>
            <Text style={styles.actionLabel}>Test Beacon Connection</Text>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow}>
            <Text style={styles.actionLabel}>Bluetooth Permissions</Text>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Version</Text>
            <Text style={styles.profileValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Build</Text>
            <Text style={styles.profileValue}>Development</Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>ERLS - Emergency Response & Localization System</Text>
        <Text style={styles.footerText}>Senior Thesis Project</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  section: {
    padding: 16,
    paddingBottom: 0,
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
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  profileLabel: {
    fontSize: 16,
    color: '#ffffff',
  },
  profileValue: {
    fontSize: 16,
    color: '#888',
  },
  roleBadge: {
    backgroundColor: '#e63946',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  divider: {
    height: 1,
    backgroundColor: '#0f3460',
    marginHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#ffffff',
  },
  settingDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  actionLabel: {
    fontSize: 16,
    color: '#ffffff',
  },
  actionChevron: {
    fontSize: 20,
    color: '#888',
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#e63946',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
});
