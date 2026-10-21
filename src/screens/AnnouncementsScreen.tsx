import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "urgent";
  date: Date;
  isRead: boolean;
  isPinned: boolean;
}

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    title: "নতুন ফিচার: ভয়েস রুম",
    content: "এখন থেকে লাইভ অডিও আলোচনায় অংশ নিতে পারবেন। ভয়েস রুমে যোগ দিন এবং অন্যান্য কৃষকদের সাথে অভিজ্ঞতা শেয়ার করুন।",
    type: "success",
    date: new Date(Date.now() - 2 * 3600000),
    isRead: false,
    isPinned: true,
  },
  {
    id: "2",
    title: "জরুরি: ধান ব্লাস্ট রোগের সতর্কতা",
    content: "বর্তমান আবহাওয়ায় ধান ব্লাস্ট রোগ ছড়িয়ে পড়তে পারে। সতর্ক থাকুন এবং প্রতিরোধমূলক ব্যবস্থা নিন। বিস্তারিত জানতে AI সহায়ক ব্যবহার করুন।",
    type: "urgent",
    date: new Date(Date.now() - 1 * 24 * 3600000),
    isRead: false,
    isPinned: true,
  },
  {
    id: "3",
    title: "কৃষি ভর্তুকি আবেদনের সময়সীমা",
    content: "সরকারি কৃষি ভর্তুকির জন্য আবেদনের শেষ তারিখ ৩১ জানুয়ারি। এখনই আবেদন করুন সরকারি প্রকল্প সেকশন থেকে।",
    type: "warning",
    date: new Date(Date.now() - 2 * 24 * 3600000),
    isRead: true,
    isPinned: false,
  },
  {
    id: "4",
    title: "মাসিক কৃষি মেলা আগামী সপ্তাহে",
    content: "ময়মনসিংহে আগামী শনিবার বড় কৃষি মেলা অনুষ্ঠিত হবে। বিভিন্ন কৃষি যন্ত্রপাতি ও বীজ প্রদর্শনী থাকবে।",
    type: "info",
    date: new Date(Date.now() - 3 * 24 * 3600000),
    isRead: true,
    isPinned: false,
  },
  {
    id: "5",
    title: "নতুন বিশেষজ্ঞ যোগ হয়েছেন",
    content: "ড. আব্দুল করিম (মৎস্য বিশেষজ্ঞ) আমাদের প্ল্যাটফর্মে যোগ দিয়েছেন। এখন থেকে মাছ চাষ সংক্রান্ত প্রশ্ন করতে পারবেন।",
    type: "success",
    date: new Date(Date.now() - 5 * 24 * 3600000),
    isRead: true,
    isPinned: false,
  },
  {
    id: "6",
    title: "অ্যাপ আপডেট v2.5",
    content: "নতুন আপডেটে যোগ হয়েছে: ফার্ম ডায়েরি, বীজ খুঁজুন, ঋণ ক্যালকুলেটর এবং আরও অনেক ফিচার। এখনই আপডেট করুন।",
    type: "info",
    date: new Date(Date.now() - 7 * 24 * 3600000),
    isRead: true,
    isPinned: false,
  },
];

const getTypeConfig = (type: string) => {
  const configs: Record<string, { color: string; icon: keyof typeof Feather.glyphMap; bgColor: string }> = {
    info: { color: "#2563EB", icon: "info", bgColor: "#2563EB20" },
    warning: { color: "#EA8A0C", icon: "alert-triangle", bgColor: "#EA8A0C20" },
    success: { color: "#2FA36B", icon: "check-circle", bgColor: "#2FA36B20" },
    urgent: { color: "#DC2626", icon: "alert-circle", bgColor: "#DC262620" },
  };
  return configs[type] || configs.info;
};

const formatDate = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  
  if (hours < 24) return hours < 1 ? "এইমাত্র" : `${hours} ঘণ্টা আগে`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} দিন আগে`;
  return date.toLocaleDateString("bn-BD");
};

export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [announcements, setAnnouncements] = useState(MOCK_ANNOUNCEMENTS);
  const [refreshing, setRefreshing] = useState(false);

  const pinnedAnnouncements = announcements.filter((a) => a.isPinned);
  const regularAnnouncements = announcements.filter((a) => !a.isPinned);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleAnnouncementPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
  };

  const renderAnnouncement = ({ item, index }: { item: Announcement; index: number }) => {
    const config = getTypeConfig(item.type);
    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <Pressable
          style={[
            styles.announcementCard,
            { backgroundColor: item.isRead ? theme.card : config.bgColor, borderColor: theme.cardBorder },
          ]}
          onPress={() => handleAnnouncementPress(item.id)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.typeIcon, { backgroundColor: config.color + "20" }]}>
              <Feather name={config.icon} size={18} color={config.color} />
            </View>
            <View style={styles.cardHeaderInfo}>
              <View style={styles.titleRow}>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                {item.isPinned ? (
                  <Feather name="bookmark" size={14} color={theme.primary} />
                ) : null}
              </View>
              <ThemedText style={[styles.cardDate, { color: theme.textSecondary }]}>
                {formatDate(item.date)}
              </ThemedText>
            </View>
            {!item.isRead ? (
              <View style={[styles.unreadDot, { backgroundColor: config.color }]} />
            ) : null}
          </View>
          <ThemedText style={[styles.cardContent, { color: theme.textSecondary }]} numberOfLines={3}>
            {item.content}
          </ThemedText>
          <View style={styles.cardFooter}>
            <View style={[styles.typeBadge, { backgroundColor: config.color + "15" }]}>
              <ThemedText style={[styles.typeBadgeText, { color: config.color }]}>
                {item.type === "urgent" ? "জরুরি" : item.type === "warning" ? "সতর্কতা" : item.type === "success" ? "নতুন" : "তথ্য"}
              </ThemedText>
            </View>
            <Pressable style={styles.readMoreButton}>
              <ThemedText style={[styles.readMoreText, { color: theme.primary }]}>বিস্তারিত</ThemedText>
              <Feather name="chevron-right" size={14} color={theme.primary} />
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>ঘোষণা</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          গুরুত্বপূর্ণ আপডেট ও নোটিশ
        </ThemedText>
      </Animated.View>

      <FlatList
        data={[...pinnedAnnouncements, ...regularAnnouncements]}
        keyExtractor={(item) => item.id}
        renderItem={renderAnnouncement}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              কোন ঘোষণা নেই
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  announcementCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.sm },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderInfo: { flex: 1, marginLeft: Spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  cardTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  cardDate: { fontSize: 12, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardContent: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  typeBadgeText: { fontSize: 11, fontWeight: "600" },
  readMoreButton: { flexDirection: "row", alignItems: "center" },
  readMoreText: { fontSize: 13, fontWeight: "500" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
});
