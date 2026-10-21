import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './query-client';

const PUSH_TOKEN_KEY = 'push_notification_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'application_approved' | 'application_rejected' | 'general';
  applicationId?: string;
  memberNumber?: string;
  title: string;
  body: string;
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android' && isExpoGo()) {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2E7D32',
      });
    }

    return token;
  } catch {
    return null;
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function savePushTokenToServer(userId: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/api/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, token }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to save push token to server:', error);
    return false;
  }
}

export async function sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null,
  });
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: NotificationData
): Promise<boolean> {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}

export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Failed to set badge count:', error);
  }
}

export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await setBadgeCount(0);
  } catch (error) {
    console.error('Failed to clear notifications:', error);
  }
}
