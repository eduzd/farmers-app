import React, { useState, useCallback } from "react";
import { refreshUnreadCounts, useUnreadCounts } from "@/lib/liveStatus";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useNotifications } from "@/contexts/NotificationContext";

import { tr, useTr } from "@/lib/tr";
import { apiGet, apiPost, isLoggedIn } from "@/lib/api";
import { fetchServerPost } from "@/lib/feedApi";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import { AppIcon } from "@/components/icons/AppIcon";
import { inScope, isMarketNotification, parseScope } from "@/lib/notificationScope";
interface Notification {
  id: string;
  type: "like" | "comment" | "new_post" | "follow" | "mention" | "order" | "system" | "voice_room" | "badge" | "message" | "review" | "answer" | "rfq" | "price" | "reminder";
  title: string;
  message: string;
  userAvatar?: string;
  userName?: string;
  userInitials?: string;
  isWelfareMember?: boolean;
  isRead: boolean;
  createdAt: Date;
  actionData?: any;
  isMarket?: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [];

const getNotificationIcon = (type: string): keyof typeof Feather.glyphMap => {
  const icons: Record<string, keyof typeof Feather.glyphMap> = {
    like: "heart",
    comment: "message-circle",
    follow: "user-plus",
    new_post: "edit-3",
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
    like: "#DA2F2F",
    comment: "#2E96EF",
    follow: "#2E96EF",
    new_post: "#0E9F6E",
    mention: "#3D38D0",
    order: "#B25E09",
    system: "#4A5568",
    voice_room: "#FF4BB7",
    badge: "#F5B700",
    message: "#2E96EF",
    review: "#F5B700",
    answer: "#3D38D0",
    rfq: "#00BB77",
    price: "#DA2F2F",
    reminder: "#2E96EF",
  };
  return colors[type] || "#4A5568";
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
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { language } = useI18n();
  const isBn = language === "bn";
  // The Marketplace bell opens this with scope "market" (orders, shop, price alerts, quotes,
  // product reviews); the Home bell with scope "home" (everything else); other links show all.
  const scope = parseScope((useRoute() as any)?.params?.scope);
  React.useLayoutEffect(() => {
    if (scope === "market") navigation.setOptions({ headerTitle: isBn ? "মার্কেট নোটিফিকেশন" : "Market notifications" });
  }, [navigation, scope, isBn]);
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);
  const loggedIn = isLoggedIn();
  const loadServer = useCallback(async () => {
    if (!isLoggedIn()) {
      setLocalNotifications([]);
      return;
    }
    try {
      const r = await apiGet<{ notifications: any[] }>(
        scope === "all" ? "/api/me/notifications" : `/api/me/notifications?scope=${scope}`
      );
      setLocalNotifications(
        r.notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.body || "",
          isRead: !!n.read,
          createdAt: new Date(n.createdAt),
          actionData: n.data || {},
          isMarket: isMarketNotification(n.type, n.data, typeof n.market === "boolean" ? n.market : undefined),
        }))
          // An older server ignores ?scope: keep only this bell's notifications here too.
          .filter((n) => inScope(scope, !!n.isMarket))
      );
    } catch {
      // offline: keep what we have
    }
  }, [scope]);
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
    notifications: pushNotifications,
    markAsRead: markPushAsRead,
  } = useNotifications();

  const allNotifications: Notification[] = [
    ...pushNotifications
      .filter((pn) => inScope(scope, isMarketNotification(pn.type, pn.data)))
      .map((pn) => ({
      id: pn.id,
      type: pn.type as Notification["type"],
      title: pn.title,
      message: pn.body,
      isRead: pn.isRead,
      createdAt: pn.receivedAt,
      actionData: pn.data || {},
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

  const handleNotificationPress = (notification: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pushNotifications.find((pn) => pn.id === notification.id)) {
      markPushAsRead(notification.id);
      // A push that came in while the app was open: open its source like any other notification.
      const d = notification.actionData || {};
      (navigation as any).navigate("NotificationOpen", {
        payload: { id: d.notificationId ? String(d.notificationId) : undefined, type: String(d.type || notification.type), data: d, title: notification.title, body: notification.message, createdAt: notification.createdAt.toISOString() },
      });
    } else {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      if (!notification.isRead) {
        const u = useUnreadCounts.getState();
        u.set(
          notification.isMarket
            ? { notifications: Math.max(0, u.notifications - 1), notificationsMarket: Math.max(0, u.notificationsMarket - 1) }
            : { notifications: Math.max(0, u.notifications - 1), notificationsHome: Math.max(0, u.notificationsHome - 1) }
        );
      }
      if (isLoggedIn()) apiPost("/api/me/notifications/read", { ids: [notification.id] }).then(() => refreshUnreadCounts()).catch(() => {});
      // Open it where it came from: the comment on the post, the order, the chat, the profile...
      // NotificationOpen checks with the server that it still exists and is this account's.
      (navigation as any).navigate("NotificationOpen", {
        payload: { id: notification.id, type: notification.type, data: notification.actionData || {}, title: notification.title, body: notification.message, createdAt: notification.createdAt.toISOString() },
        markedRead: true,
      });
    }
  };

  const handleMarkAllRead = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Only this bell's notifications: "mark all read" under the Marketplace bell leaves the
    // Home bell's unread ones alone, and the other way round.
    pushNotifications
      .filter((pn) => !pn.isRead && inScope(scope, isMarketNotification(pn.type, pn.data)))
      .forEach((pn) => markPushAsRead(pn.id));
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    const u = useUnreadCounts.getState();
    if (scope === "market") u.set({ notificationsMarket: 0, notifications: u.notificationsHome });
    else if (scope === "home") u.set({ notificationsHome: 0, notifications: u.notificationsMarket });
    else u.set({ notifications: 0, notificationsMarket: 0, notificationsHome: 0 }); // the bell clears at once
    if (isLoggedIn()) apiPost("/api/me/notifications/read", { all: true, scope }).then(() => refreshUnreadCounts()).catch(() => {});
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
                <AppIcon name={getNotificationIcon(item.type)} size={10} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + "20" }]}>
              <AppIcon name={getNotificationIcon(item.type)} size={20} color={getNotificationColor(item.type)} />
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
      <Animated.View entering={FadeInUp.delay(60)} style={styles.filterRow} testID="notif-filter-row">
        {/* All / Unread as one segmented pill, Mark all read on the same line at the right. */}
        <View
          style={[
            styles.segment,
            { backgroundColor: isDark ? theme.backgroundSecondary : theme.card, borderColor: theme.cardBorder },
          ]}
        >
          {(["all", "unread"] as const).map((key) => {
            const active = filter === key;
            const count = key === "all" ? allNotifications.length : unreadCount;
            const activeBg = isDark ? theme.primary : theme.primaryDark;
            return (
              <Pressable
                key={key}
                testID={`notif-filter-${key}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                aria-selected={active}
                onPress={() => {
                  if (!active) Haptics.selectionAsync();
                  setFilter(key);
                }}
                style={[styles.segmentItem, active && [styles.segmentItemActive, { backgroundColor: activeBg }]]}
              >
                <ThemedText style={[styles.segmentText, { color: active ? "#FFFFFF" : theme.textSecondary }]}>
                  {key === "all" ? tr("সব") : isBn ? "অপঠিত" : "Unread"}
                </ThemedText>
                <View
                  style={[
                    styles.countPill,
                    {
                      backgroundColor: active
                        ? isDark ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.18)"
                        : key === "unread" && count > 0
                          ? theme.primary
                          : theme.primarySoft,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.countText,
                      { color: active || (key === "unread" && count > 0) ? "#FFFFFF" : theme.primary },
                    ]}
                  >
                    {count > 99 ? "99+" : count}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
        {unreadCount > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.markAllButton,
              { backgroundColor: theme.primarySoft, borderColor: theme.primary + "33", opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={handleMarkAllRead}
            accessibilityRole="button"
            testID="notif-mark-all"
          >
            <Feather name="check-circle" size={15} color={isDark ? theme.primaryTint : theme.primary} />
            <ThemedText style={[styles.markAllText, { color: isDark ? theme.primaryTint : theme.primaryDark }]} numberOfLines={1}>
              {tr("সব পঠিত")}
            </ThemedText>
          </Pressable>
        ) : null}
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
              {!loggedIn
                ? tr("Log in to see your order, message and price alert notifications")
                : scope === "market"
                  ? isBn ? "এখনো কোনো মার্কেট নোটিফিকেশন নেই। অর্ডার, দোকান আর দামের খবর এখানে আসবে।" : "No marketplace notifications yet. Orders, your shop and price alerts show up here."
                  : tr("কোন নোটিফিকেশন নেই")}
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 2,
  },
  segmentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  segmentItemActive: {
    shadowColor: "#202936",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: "600" },
  countPill: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontWeight: "700", lineHeight: 14 },
  markAllButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 6,
    flexShrink: 1,
  },
  markAllText: { fontSize: 13, fontWeight: "600" },
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
});
