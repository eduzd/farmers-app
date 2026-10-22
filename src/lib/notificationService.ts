import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './query-client';

const PUSH_TOKEN_KEY = 'push_notification_token';
const PREFS_KEY = 'farmers:notificationPrefs';

/**
 * Android notification channels. Since Android 8 the CHANNEL decides whether a
 * notification vibrates (a per-notification vibrate flag is ignored), and a channel's
 * vibration can't be changed by the app once it exists. So there are two channels:
 *  - "default": sound + vibration (the original channel, unchanged)
 *  - "quiet":   sound, no vibration
 * The server picks the channel for each phone from the prefs we send it
 * (POST /api/me/push-tokens {vibrate}), so pushes that arrive while the app is
 * closed follow the setting too.
 */
export const CHANNEL_VIBRATE = 'default';
export const CHANNEL_QUIET = 'quiet';

export interface NotificationPrefs {
  /** Show notifications on this phone at all. */
  enabled: boolean;
  /** Vibrate when a notification arrives. */
  vibrate: boolean;
}
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { enabled: true, vibrate: true };

let cachedPrefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS };
let prefsLoaded: Promise<NotificationPrefs> | null = null;

function normalizePrefs(raw: any): NotificationPrefs {
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_NOTIFICATION_PREFS.enabled,
    vibrate: typeof raw?.vibrate === 'boolean' ? raw.vibrate : DEFAULT_NOTIFICATION_PREFS.vibrate,
  };
}

/** This phone's notification settings (saved on the phone, default: on + vibrate). */
export function getNotificationPrefs(): Promise<NotificationPrefs> {
  if (!prefsLoaded) {
    prefsLoaded = AsyncStorage.getItem(PREFS_KEY)
      .then((s) => {
        cachedPrefs = normalizePrefs(s ? JSON.parse(s) : null);
        return cachedPrefs;
      })
      .catch(() => cachedPrefs);
  }
  return prefsLoaded;
}

/** Last known prefs without waiting (defaults until loaded). */
export function getCachedNotificationPrefs(): NotificationPrefs {
  return cachedPrefs;
}

export function channelForPrefs(prefs: NotificationPrefs): string {
  return prefs.vibrate ? CHANNEL_VIBRATE : CHANNEL_QUIET;
}

/** Create both Android channels (safe to call often; does nothing elsewhere). */
export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_VIBRATE, {
      name: 'Farmers App',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2E7D32',
      sound: 'default',
    });
    // No vibrationPattern here: setting a pattern turns vibration back on in Android.
    await Notifications.setNotificationChannelAsync(CHANNEL_QUIET, {
      name: 'Farmers App (no vibration)',
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: false,
      lightColor: '#2E7D32',
      sound: 'default',
    });
  } catch (e) {
    console.log('Notifications: could not create channels', e);
  }
}

Notifications.setNotificationHandler({
  // Notifications that arrive while the app is open follow the setting too.
  handleNotification: async () => {
    const prefs = await getNotificationPrefs();
    return {
      shouldShowAlert: prefs.enabled,
      shouldPlaySound: prefs.enabled,
      shouldSetBadge: true,
      shouldShowBanner: prefs.enabled,
      shouldShowList: prefs.enabled,
    };
  },
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
    await ensureNotificationChannels();

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

/**
 * Save this phone's push token (and its notification settings) for the signed-in user.
 * The server takes the user from authToken.
 */
export async function savePushTokenToServer(token: string, authToken: string): Promise<boolean> {
  try {
    const prefs = await getNotificationPrefs();
    const response = await fetch(`${getApiUrl()}/api/me/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token, platform: Platform.OS, notify: prefs.enabled, vibrate: prefs.vibrate }),
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

/**
 * Change this phone's notification settings: saved on the phone straight away, then sent
 * to the server with this phone's push token so closed-app pushes follow it.
 * Returns whether the server got it (false when signed out, offline, or no push token
 * yet; it is sent again on the next sign-in / app start).
 */
export async function setNotificationPrefs(
  patch: Partial<NotificationPrefs>,
  authToken: string | null | undefined,
): Promise<{ prefs: NotificationPrefs; synced: boolean }> {
  const current = await getNotificationPrefs();
  const next = normalizePrefs({ ...current, ...patch });
  cachedPrefs = next;
  prefsLoaded = Promise.resolve(next);
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {}
  if (Platform.OS === 'web' || !authToken) return { prefs: next, synced: false };
  await ensureNotificationChannels();
  const pushToken = await getStoredPushToken();
  if (!pushToken) return { prefs: next, synced: false };
  const synced = await savePushTokenToServer(pushToken, authToken);
  return { prefs: next, synced };
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

/** Show a notification now from the phone itself, on the channel the settings ask for. */
export async function sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
  const prefs = await getNotificationPrefs();
  if (!prefs.enabled) return;
  await ensureNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
    },
    trigger: Platform.OS === 'android' ? { channelId: channelForPrefs(prefs) } : null,
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
