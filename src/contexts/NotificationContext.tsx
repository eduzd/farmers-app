import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { Platform } from "react-native";
import { refreshUnreadCounts } from "@/lib/liveStatus";
import * as Notifications from "expo-notifications";
import { openNotificationWhenReady } from "@/lib/notificationTarget";
import { useAuthStore } from "@/lib/authStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import Constants from "expo-constants";
// Importing the service also installs the one notification handler (it follows the
// on/off setting); the channels and local notifications follow the vibration setting.
import {
  ensureNotificationChannels,
  sendLocalNotification as showLocalNotification,
} from "@/lib/notificationService";

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
}

export interface AppNotification {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "order" | "system" | "voice_room" | "badge" | "message";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  receivedAt: Date;
  isRead: boolean;
}

interface NotificationContextType {
  expoPushToken: string | null;
  notifications: AppNotification[];
  unreadCount: number;
  permissionStatus: string | null;
  requestPermission: () => Promise<boolean>;
  sendLocalNotification: (title: string, body: string, data?: Record<string, unknown>) => Promise<void>;
  sendTestNotification: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "android" && isExpoGo()) {
      setPermissionStatus("unavailable");
      return false;
    }

    // Both Android channels (with and without vibration).
    await ensureNotificationChannels();

    if (!Device.isDevice) {
      setPermissionStatus("unavailable");
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setPermissionStatus(finalStatus);

      if (finalStatus === "granted") {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (projectId) {
          try {
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            setExpoPushToken(tokenData.data);
          } catch {}
        }
      }

      return finalStatus === "granted";
    } catch {
      setPermissionStatus("unavailable");
      return false;
    }
  }, []);

  const sendLocalNotification = useCallback(
    async (title: string, body: string, data?: Record<string, unknown>) => {
      await showLocalNotification(title, body, data || {});
    },
    []
  );

  const sendTestNotification = useCallback(async () => {
    await sendLocalNotification(
      "Farmers App 🌾",
      "নোটিফিকেশন সফলভাবে সক্রিয় হয়েছে!",
      { type: "system" }
    );
  }, [sendLocalNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    requestPermission();

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: Notifications.Notification) => {
        // A push means a new notification or message on the server: refresh the badges.
        refreshUnreadCounts();
        const newNotification: AppNotification = {
          id: notification.request.identifier,
          type: ((notification.request.content.data?.type as string) || "system") as AppNotification["type"],
          title: notification.request.content.title || "",
          body: notification.request.content.body || "",
          data: notification.request.content.data as Record<string, unknown>,
          receivedAt: new Date(),
          isRead: false,
        };
        setNotifications((prev) => [newNotification, ...prev.slice(0, 49)]);
      }
    );

    // Tapping a push opens where it came from: the comment on your post, the order, the chat,
    // the new follower... (NotificationOpen asks the server and checks it's still there and yours).
    // Opened once per tap: on a cold start the listener and the last-response check can both report it.
    const openFromPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const content = response.notification.request.content;
      const data = (content.data || {}) as Record<string, any>;
      const nid = response.notification.request.identifier;
      if (nid) AsyncStorage.setItem("farmers:lastPushOpened", nid).catch(() => {});
      if (data.type === "incoming_call") return; // the call screen comes up on its own
      openNotificationWhenReady(
        {
          id: data.notificationId ? String(data.notificationId) : undefined,
          type: String(data.type || ""),
          data,
          title: content.title || "",
          body: content.body || "",
        },
        nid || (data.notificationId ? String(data.notificationId) : undefined),
      );
    };
    responseListener.current = Notifications.addNotificationResponseReceivedListener(openFromPush);
    if (Platform.OS !== "web") {
      // Cold start from a tap. Remember which one was handled so it doesn't reopen on every launch.
      Notifications.getLastNotificationResponseAsync()
        .then(async (r) => {
          const id = r?.notification.request.identifier;
          if (!id) return;
          const last = await AsyncStorage.getItem("farmers:lastPushOpened").catch(() => null);
          if (last === id) return;
          await AsyncStorage.setItem("farmers:lastPushOpened", id).catch(() => {});
          openFromPush(r);
        })
        .catch(() => {});
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [requestPermission]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notifications,
        unreadCount,
        permissionStatus,
        requestPermission,
        sendLocalNotification,
        sendTestNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
