import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { EmergencyType } from '@/types/database';

const PREF_KEY = 'erls.notificationsEnabled';
const CHANNEL_ID = 'emergency-alarm';

const LABELS: Record<EmergencyType, string> = {
  fire:       'Fire Emergency',
  lockdown:   'Lockdown',
  medical:    'Medical Emergency',
  weather:    'Severe Weather Alert',
  evacuation: 'Evacuation',
  other:      'Emergency Alert',
};

// Show heads-up banners even when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Emergency Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#e63946',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
      },
    });
  }

  await Notifications.requestPermissionsAsync();
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(PREF_KEY);
  return val !== 'false'; // default on
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, String(enabled));
}

export async function fireEmergencyNotification(type: EmergencyType): Promise<void> {
  if (!(await getNotificationsEnabled())) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: LABELS[type],
      body: 'Open ERLS to view your assigned tasks.',
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: null,
  });
}
