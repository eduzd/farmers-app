import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Activity {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "purchase" | "review" | "answer" | "achievement";
  user: { name: string; avatar: string };
  content: string;
  target?: string;
  time: string;
  isRead: boolean;
}

const ACTIVITIES: Activity[] = [
  {
    id: "1",
    type: "like",
    user: { name: "করিম সাহেব", avatar: "https://randomuser.me/api/portraits/men/32.jpg" },
    content: "আপনার পোস্টে লাইক দিয়েছেন",
    target: "ধান চাষের নতুন পদ্ধতি",
    time: "২ মিনিট আগে",
    isRead: false,
  },
  {
    id: "2",
    type: "comment",
    user: { name: "ফাতেমা বেগম", avatar: "https://randomuser.me/api/portraits/women/28.jpg" },
    content: "আপনার পোস্টে মন্তব্য করেছেন:",
    target: "খুব ভালো তথ্য, ধন্যবাদ!",
    time: "১০ মিনিট আগে",
    isRead: false,
  },
  {
    id: "3",
    type: "follow",
    user: { name: "রহিম উদ্দিন", avatar: "https://randomuser.me/api/portraits/men/45.jpg" },
    content: "আপনাকে ফলো করতে শুরু করেছেন",
    time: "৩০ মিনিট আগে",
    isRead: false,
  },
  {
    id: "4",
    type: "mention",
    user: { name: "নাজমুল হাসান", avatar: "https://randomuser.me/api/portraits/men/55.jpg" },
    content: "একটি পোস্টে আপনাকে মেনশন করেছেন",
    target: "জৈব সার সম্পর্কে @আপনি বিস্তারিত জানেন",
    time: "১ ঘণ্টা আগে",
    isRead: true,
  },
  {
    id: "5",
    type: "purchase",
    user: { name: "সালমা আক্তার", avatar: "https://randomuser.me/api/portraits/women/44.jpg" },
    content: "আপনার পণ্য কিনেছেন",
    target: "জৈব সার ১০ কেজি",
    time: "২ ঘণ্টা আগে",
    isRead: true,
  },
  {
    id: "6",
    type: "review",
    user: { name: "আলী হোসেন", avatar: "https://randomuser.me/api/portraits/men/67.jpg" },
    content: "আপনার পণ্যে রিভিউ দিয়েছেন",
    target: "৫ স্টার - চমৎকার মানের সার!",
    time: "৩ ঘণ্টা আগে",
    isRead: true,
  },
  {
    id: "7",
    type: "answer",
    user: { name: "ড. ফরিদ উদ্দিন", avatar: "https://randomuser.me/api/portraits/men/32.jpg" },
    content: "আপনার প্রশ্নের উত্তর দিয়েছেন",
    target: "ধানের পাতা হলুদ হলে কী করবেন...",
    time: "৫ ঘণ্টা আগে",
    isRead: true,
  },
  {
    id: "8",
    type: "achievement",
    user: { name: "সিস্টেম", avatar: "" },
    content: "নতুন অর্জন আনলক হয়েছে!",
    target: "সক্রিয় কৃষক ব্যাজ অর্জন করেছেন",
    time: "১ দিন আগে",
    isRead: true,
  },
];

const getActivityConfig = (type: string) => {
  const configs: Record<string, { icon: keyof typeof Feather.glyphMap; color: string }> = {
    like: { icon: "heart", color: "#DC2626" },
    comment: { icon: "message-circle", color: "#2563EB" },
    follow: { icon: "user-plus", color: "#2FA36B" },
    mention: { icon: "at-sign", color: "#7C3AED" },
    purchase: { icon: "shopping-bag", color: "#EA8A0C" },
    review: { icon: "star", color: "#F5B700" },
    answer: { icon: "check-circle", color: "#2FA36B" },
    achievement: { icon: "award", color: "#F5B700" },
  };
  return configs[type] || { icon: "bell" as const, color: "#475569" };
};

export default function ActivityFeedScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState(ACTIVITIES);

  const unreadCount = activities.filter(a => !a.isRead).length;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const markAsRead = (activityId: string) => {
    setActivities(prev =>
      prev.map(a => (a.id === activityId ? { ...a, isRead: true } : a))
    );
  };

  const handleActivityPress = (activity: Activity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAsRead(activity.id);
    if (activity.type === "like" || activity.type === "comment" || activity.type === "mention") {
      const post = {
        id: activity.id,
        author: { name: activity.user.name, avatar: activity.user.avatar, initials: activity.user.name.substring(0, 2) },
        content: activity.target || activity.content,
        likes: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 20),
        views: Math.floor(Math.random() * 500),
        isLiked: false,
        createdAt: activity.time,
      };
      navigation.navigate("PostDetail", { postId: activity.id, post });
    } else if (activity.type === "follow") {
      navigation.navigate("UserProfile", { user: { id: activity.id, name: activity.user.name, avatar: activity.user.avatar, bio: "", location: "", followersCount: 0, followingCount: 0, isFollowing: false } as any });
    } else if (activity.type === "purchase" || activity.type === "review") {
      navigation.navigate("Orders");
    }
  };

  const markAllAsRead = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActivities(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const renderActivity = ({ item, index }: { item: Activity; index: number }) => {
    const config = getActivityConfig(item.type);
    return (
      <Animated.View entering={FadeInUp.delay(index * 30)}>
        <Pressable
          style={[
            styles.activityCard,
            { backgroundColor: item.isRead ? theme.card : theme.primary + "08", borderColor: theme.cardBorder },
          ]}
          onPress={() => handleActivityPress(item)}
        >
          <View style={[styles.iconContainer, { backgroundColor: config.color + "15" }]}>
            {item.type === "achievement" ? (
              <Feather name={config.icon} size={20} color={config.color} />
            ) : (
              <Image source={{ uri: item.user.avatar }} style={styles.userAvatar} />
            )}
            <View style={[styles.activityIcon, { backgroundColor: config.color }]}>
              <Feather name={config.icon} size={10} color="#fff" />
            </View>
          </View>
          <View style={styles.activityContent}>
            <ThemedText style={[styles.activityText, { color: theme.text }]}>
              <ThemedText style={styles.userName}>{item.user.name}</ThemedText> {item.content}
            </ThemedText>
            {item.target ? (
              <ThemedText style={[styles.targetText, { color: theme.primary }]} numberOfLines={1}>
                {item.target}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>{item.time}</ThemedText>
          </View>
          {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} /> : null}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <View>
          <ThemedText style={[styles.title, { color: theme.text }]}>অ্যাক্টিভিটি</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            আপনার সাম্প্রতিক নোটিফিকেশন
          </ThemedText>
        </View>
        {unreadCount > 0 ? (
          <Pressable
            style={[styles.markAllBtn, { backgroundColor: theme.primary + "10" }]}
            onPress={markAllAsRead}
          >
            <Feather name="check-circle" size={14} color={theme.primary} />
            <ThemedText style={[styles.markAllText, { color: theme.primary }]}>সব পড়া হয়েছে</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>

      {unreadCount > 0 ? (
        <Animated.View entering={FadeInUp.delay(50)} style={[styles.unreadBanner, { backgroundColor: theme.primary }]}>
          <Feather name="bell" size={16} color="#fff" />
          <ThemedText style={styles.unreadText}>{unreadCount}টি নতুন নোটিফিকেশন</ThemedText>
        </Animated.View>
      ) : null}

      <FlatList
        data={activities}
        keyExtractor={item => item.id}
        renderItem={renderActivity}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              কোন নোটিফিকেশন নেই
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  markAllBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: 4 },
  markAllText: { fontSize: 12, fontWeight: "500" },
  unreadBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginHorizontal: Spacing.lg, marginVertical: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: Spacing.xs },
  unreadText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg },
  activityCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  iconContainer: { position: "relative", width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  activityIcon: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  activityContent: { flex: 1, marginLeft: Spacing.sm },
  activityText: { fontSize: 14, lineHeight: 20 },
  userName: { fontWeight: "600" },
  targetText: { fontSize: 13, marginTop: 2 },
  timeText: { fontSize: 11, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
});
