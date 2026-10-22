import React, { useState, useCallback } from "react";
import { refreshUnreadCounts } from "@/lib/liveStatus";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useNotifications } from "@/contexts/NotificationContext";

import { tr, useTr } from "@/lib/tr";
import { apiGet, apiPost, isLoggedIn } from "@/lib/api";
interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "order" | "system" | "voice_room" | "badge" | "message" | "review" | "answer" | "rfq" | "price" | "reminder";
  title: string;
  message: string;
  userAvatar?: string;
  userName?: string;
  userInitials?: string;
  isWelfareMember?: boolean;
  isRead: boolean;
  createdAt: Date;
  actionData?: any;
}

const MOCK_NOTIFICATIONS: Notification[] = [];

const getNotificationIcon = (type: string): keyof typeof Feather.glyphMap => {
  const icons: Record<string, keyof typeof Feather.glyphMap> = {
    like: "heart",
    comment: "message-circle",
    follow: "user-plus",
    mention: "at-sign",
    order: "package",
    system: "bell",
    voice_room: "radio",
    badge: "award",
    message: "message-square",
    review: "star",
    answer: "help-circle",
    rfq: "file-text",
    price: "trending-down",
    reminder: "clock",
  };
  return icons[type] || "bell";
};

const getNotificationColor = (type: string) => {
  const colors: Record<string, string> = {
    like: "#DC2626",
    comment: "#2563EB",
    follow: "#2FA36B",
    mention: "#7C3AED",
    order: "#EA8A0C",
    system: "#475569",
    voice_room: "#DB2777",
    badge: "#F5B700",
    message: "#2563EB",
    review: "#F5B700",
    answer: "#7C3AED",
    rfq: "#0D9488",
    price: "#DC2626",
    reminder: "#2FA36B",
  };
  return colors[type] || "#475569";
};

const formatTimeAgo = (date: Date) => {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "এইমাত্র";
  if (minutes < 60) return `${minutes} মিনিট আগে`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  const days = Math.floor(hours / 24);
  return `${days} দিন আগে`;
};

export default function NotificationsScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);
  const loggedIn = isLoggedIn();
  const loadServer = useCallback(async () => {
    if (!isLoggedIn()) {
      setLocalNotifications([]);
      return;
    }
    try {
      const r = await apiGet<{ notifications: any[] }>("/api/me/notifications");
      setLocalNotifications(
        r.notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.body || "",
          isRead: !!n.read,
          createdAt: new Date(n.createdAt),
          actionData: n.data || {},
        }))
      );
    } catch {
      // offline: keep what we have
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      loadServer();
      const t = setInterval(loadServer, 15000);
      return () => clearInterval(t);
    }, [loadServer])
  );
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  
  const { 
    permissionStatus, 
    requestPermission, 
    sendTestNotification,
    notifications: pushNotifications,
    markAsRead: markPushAsRead,
    markAllAsRead: markAllPushAsRead,
  } = useNotifications();

  const allNotifications: Notification[] = [
    ...pushNotifications.map((pn) => ({
      id: pn.id,
      type: pn.type as Notification["type"],
      title: pn.title,
      message: pn.body,
      isRead: pn.isRead,
      createdAt: pn.receivedAt,
    })),
    ...localNotifications,
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const unreadCount = allNotifications.filter((n) => !n.isRead).length;
  const filteredNotifications = filter === "unread" 
    ? allNotifications.filter((n) => !n.isRead) 
    : allNotifications;

  const onRefresh = async () => {
    setRefreshing(true);
    await loadServer();
    setRefreshing(false);
  };

  const handleEnableNotifications = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const granted = await requestPermission();
    if (granted) {
      await sendTestNotification();
      Alert.alert(tr("সফল!"), tr("পুশ নোটিফিকেশন সক্রিয় হয়েছে"));
    } else {
      if (Platform.OS !== "web") {
        Alert.alert(
          "অনুমতি প্রয়োজন",
          "নোটিফিকেশন পেতে সেটিংস থেকে অনুমতি দিন",
          [
            { text: "বাতিল", style: "cancel" },
            { 
              text: "সেটিংস", 
              onPress: async () => {
                try {
                  await Linking.openSettings();
                } catch (error) {
                  console.log("Could not open settings");
                }
              }
            },
          ]
        );
      }
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pushNotifications.find((pn) => pn.id === notification.id)) {
      markPushAsRead(notification.id);
    } else {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      if (isLoggedIn()) apiPost("/api/me/notifications/read", { ids: [notification.id] }).then(() => refreshUnreadCounts()).catch(() => {});
      const d = notification.actionData || {};
      if (d.orderId) navigation.navigate("OrderDetail", { orderId: d.orderId });
      else if (notification.type === "message" && d.userId)
        navigation.navigate("Chat", { conversationId: d.userId, userName: notification.title.replace(/^Message from /, ""), userInitials: "" });
      else if (d.rfqId) navigation.navigate("Rfq");
      else if (d.questionId) navigation.navigate("ExpertQA");
      else if (d.diaryId) navigation.navigate("FarmDiary");
      else if (d.alertId) navigation.navigate("PriceAlert");
    }
  };

  const handleMarkAllRead = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markAllPushAsRead();
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (isLoggedIn()) apiPost("/api/me/notifications/read", { all: true }).then(() => refreshUnreadCounts()).catch(() => {});
  };

  const renderNotification = ({ item, index }: { item: Notification; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[
          styles.notificationItem,
          { backgroundColor: item.isRead ? theme.card : theme.primary + "10", borderColor: theme.cardBorder },
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationLeft}>
          {item.userInitials ? (
            <View style={styles.avatarContainer}>
              <UserAvatar
                initials={item.userInitials}
                avatar={item.userAvatar}
                size="medium"
                isWelfareMember={item.isWelfareMember}
              />
              <View style={[styles.iconBadge, { backgroundColor: getNotificationColor(item.type) }]}>
                <Feather name={getNotificationIcon(item.type)} size={10} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + "20" }]}>
              <Feather name={getNotificationIcon(item.type)} size={20} color={getNotificationColor(item.type)} />
            </View>
          )}
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <ThemedText style={[styles.notificationTitle, { color: theme.text }]}>
              {item.userName || item.title}
            </ThemedText>
            <ThemedText style={[styles.notificationTime, { color: theme.textSecondary }]}>
              {formatTimeAgo(item.createdAt)}
            </ThemedText>
          </View>
          <ThemedText style={[styles.notificationMessage, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.message}
          </ThemedText>
        </View>

        {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} /> : null}
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <View>
          <ThemedText style={[styles.title, { color: theme.text }]}>{tr("নোটিফিকেশন")}</ThemedText>
          {unreadCount > 0 ? (
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {unreadCount}টি অপঠিত বার্তা
            </ThemedText>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable
            style={[styles.markAllButton, { backgroundColor: theme.primary + "15" }]}
            onPress={handleMarkAllRead}
          >
            <Feather name="check-circle" size={16} color={theme.primary} />
            <ThemedText style={[styles.markAllText, { color: theme.primary }]}>{tr("সব পঠিত")}</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>

      {permissionStatus !== "granted" ? (
        <Animated.View entering={FadeInUp.delay(50)} style={styles.enableBanner}>
          <LinearGradient
            colors={["#2FA36B", "#2E7D32"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.enableGradient}
          >
            <View style={styles.enableContent}>
              <View style={styles.enableIconContainer}>
                <Feather name="bell" size={24} color="#fff" />
              </View>
              <View style={styles.enableTextContainer}>
                <ThemedText style={styles.enableTitle}>{tr("পুশ নোটিফিকেশন সক্রিয় করুন")}</ThemedText>
                <ThemedText style={styles.enableSubtitle}>
                  {tr("নতুন আপডেট ও বার্তা সাথে সাথে পান")}
                </ThemedText>
              </View>
            </View>
            <Pressable style={styles.enableButton} onPress={handleEnableNotifications}>
              <ThemedText style={styles.enableButtonText}>{tr("সক্রিয় করুন")}</ThemedText>
              <Feather name="chevron-right" size={16} color="#2FA36B" />
            </Pressable>
          </LinearGradient>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInUp.delay(100)} style={styles.filterRow}>
        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: filter === "all" ? theme.primary : theme.card, borderColor: theme.cardBorder },
          ]}
          onPress={() => setFilter("all")}
        >
          <ThemedText style={[styles.filterText, { color: filter === "all" ? "#fff" : theme.text }]}>
            {tr("সব")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: filter === "unread" ? theme.primary : theme.card, borderColor: theme.cardBorder },
          ]}
          onPress={() => setFilter("unread")}
        >
          <ThemedText style={[styles.filterText, { color: filter === "unread" ? "#fff" : theme.text }]}>
            অপঠিত ({unreadCount})
          </ThemedText>
        </Pressable>
      </Animated.View>

      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {loggedIn ? tr("কোন নোটিফিকেশন নেই") : tr("Log in to see your order, message and price alert notifications")}
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  markAllText: { fontSize: 13, fontWeight: "500" },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg },
  notificationItem: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  notificationLeft: { marginRight: Spacing.md },
  avatarContainer: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContent: { flex: 1 },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notificationTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  notificationTime: { fontSize: 12 },
  notificationMessage: { fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: Spacing.sm, alignSelf: "center" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
  enableBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  enableGradient: {
    padding: Spacing.md,
  },
  enableContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  enableIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  enableTextContainer: {
    flex: 1,
  },
  enableTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  enableSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  enableButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2FA36B",
  },
});
