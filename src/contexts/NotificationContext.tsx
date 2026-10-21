import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { navigateWhenReady } from "@/lib/navigationRef";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Farmers App",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#2FA36B",
          sound: "default",
        });
      } catch {}
    }

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
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null,
      });
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

    // Tapping a push opens the right screen: a message opens that chat.
    const openFromPush = (response: Notifications.NotificationResponse | null) => {
      const data = (response?.notification.request.content.data || {}) as Record<string, any>;
      const nid = response?.notification.request.identifier;
      if (nid) AsyncStorage.setItem("farmers:lastPushOpened", nid).catch(() => {});
      if (data.type === "message" && data.userId) {
        const name = String(data.userName || "Farmer");
        const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "F";
        navigateWhenReady("Chat", { conversationId: String(data.userId), userName: name, userInitials: initials });
      }
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
