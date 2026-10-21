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

/** EAS project id from app.json (extra.eas.projectId) or the EAS build config. */
export function getEasProjectId(): string | null {
  const id = (Constants.expoConfig as any)?.extra?.eas?.projectId || (Constants as any)?.easConfig?.projectId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/**
 * Ask for permission and get this phone's Expo push token.
 * Returns null (quietly) on web, simulators, Expo Go on Android, when permission
 * is refused, or when the app has no EAS project id yet.
 */
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
    // Android 13+ only shows the permission prompt once a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Farmers App',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2E7D32',
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = getEasProjectId();
    if (!projectId) {
      console.log('Push notifications: no EAS projectId in app.json yet, skipping push token.');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    return token;
  } catch (error) {
    console.log('Push notifications: could not get a push token', error);
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

/** Save this phone's push token for the signed-in user. The server takes the user from authToken. */
export async function savePushTokenToServer(token: string, authToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/api/me/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });

    return response.ok;
  } catch (error) {
    console.log('Failed to save push token to server:', error);
    return false;
  }
}

/** After sign-in (or app start with a saved session): get the token and send it to the server. Never throws. */
export async function syncPushTokenAfterSignIn(authToken: string | null | undefined): Promise<void> {
  if (!authToken) return;
  try {
    const pushToken = await registerForPushNotificationsAsync();
    if (pushToken) await savePushTokenToServer(pushToken, authToken);
  } catch {}
}

/** On logout: stop pushes for this phone. Never throws. */
export async function removePushTokenFromServer(authToken: string | null | undefined): Promise<void> {
  try {
    const pushToken = await getStoredPushToken();
    if (!pushToken || !authToken) return;
    await fetch(`${getApiUrl()}/api/me/push-tokens`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });
  } catch {}
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
