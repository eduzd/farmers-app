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
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
interface LeaderboardUser {
  id: string;
  rank: number;
  name: string;
  avatar: string;
  location: string;
  points: number;
  level: string;
  badges: number;
  postsCount: number;
  helpedCount: number;
  isCurrentUser: boolean;
}

const TABS = [
  { id: "weekly", label: "সাপ্তাহিক" },
  { id: "monthly", label: "মাসিক" },
  { id: "allTime", label: "সর্বকালীন" },
];

const MOCK_LEADERBOARD: LeaderboardUser[] = [];

const getRankBadge = (rank: number) => {
  if (rank === 1) return { color: "#F5B700", icon: "award" as const };
  if (rank === 2) return { color: "#C0C0C0", icon: "award" as const };
  if (rank === 3) return { color: "#CD7F32", icon: "award" as const };
  return null;
};

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("weekly");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const topThree = MOCK_LEADERBOARD.slice(0, 3);
  const restUsers = MOCK_LEADERBOARD.slice(3);

  const renderTopThree = () => (
    <Animated.View entering={FadeInUp.delay(100)} style={styles.topThreeContainer}>
      {[topThree[1], topThree[0], topThree[2]].map((user, index) => {
        const isFirst = index === 1;
        const badge = getRankBadge(user.rank);
        return (
          <Animated.View
            key={user.id}
            entering={FadeInUp.delay(200 + index * 100)}
            style={[styles.topUser, isFirst && styles.topUserFirst]}
          >
            <View style={[styles.topAvatarContainer, isFirst && styles.topAvatarContainerFirst]}>
              <Image source={{ uri: user.avatar }} style={[styles.topAvatar, isFirst && styles.topAvatarFirst]} />
              {badge ? (
                <View style={[styles.rankBadge, { backgroundColor: badge.color }]}>
                  <ThemedText style={styles.rankBadgeText}>{user.rank}</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={[styles.topName, { color: theme.text }]} numberOfLines={1}>
              {user.name.split(" ")[0]}
            </ThemedText>
            <ThemedText style={[styles.topPoints, { color: theme.primary }]}>
              {user.points.toLocaleString()}
            </ThemedText>
            <ThemedText style={[styles.topLevel, { color: theme.textSecondary }]}>
              {user.level}
            </ThemedText>
          </Animated.View>
        );
      })}
    </Animated.View>
  );

  const renderUser = ({ item, index }: { item: LeaderboardUser; index: number }) => (
    <Animated.View entering={FadeInUp.delay(300 + index * 50)}>
      <Pressable
        style={[
          styles.userItem,
          { backgroundColor: item.isCurrentUser ? theme.primary + "15" : theme.card, borderColor: theme.cardBorder },
        ]}
      >
        <ThemedText style={[styles.userRank, { color: theme.textSecondary }]}>
          {item.rank}
        </ThemedText>
        <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <ThemedText style={[styles.userName, { color: theme.text }]}>
              {item.name}
            </ThemedText>
            {item.isCurrentUser ? (
              <View style={[styles.youBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.youBadgeText}>আপনি</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={[styles.userLocation, { color: theme.textSecondary }]}>
            {item.location} • {item.level}
          </ThemedText>
        </View>
        <View style={styles.userStats}>
          <ThemedText style={[styles.userPoints, { color: theme.primary }]}>
            {item.points.toLocaleString()}
          </ThemedText>
          <View style={styles.userBadges}>
            <Feather name="award" size={12} color="#F5B700" />
            <ThemedText style={[styles.userBadgeCount, { color: theme.textSecondary }]}>
              {item.badges}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>লিডারবোর্ড</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          কমিউনিটির সেরা কৃষকদের তালিকা
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50)} style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              { backgroundColor: activeTab === tab.id ? theme.primary : theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.id);
            }}
          >
            <ThemedText style={[styles.tabText, { color: activeTab === tab.id ? "#fff" : theme.text }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.View>

      <FlatList
        data={restUsers}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        ListHeaderComponent={renderTopThree}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      />

      <Animated.View
        entering={FadeInUp.delay(500)}
        style={[styles.myRankCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      >
        <ThemedText style={[styles.myRankLabel, { color: theme.textSecondary }]}>আপনার অবস্থান</ThemedText>
        <View style={styles.myRankInfo}>
          <ThemedText style={[styles.myRankNumber, { color: theme.primary }]}>#10</ThemedText>
          <ThemedText style={[styles.myRankPoints, { color: theme.text }]}>3,500 পয়েন্ট</ThemedText>
        </View>
        <ThemedText style={[styles.myRankHint, { color: theme.textSecondary }]}>
          আরও 700 পয়েন্টে 9ম স্থান
        </ThemedText>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
  },
  tabText: { fontSize: 13, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  topUser: { alignItems: "center", width: 90 },
  topUserFirst: { marginBottom: Spacing.lg },
  topAvatarContainer: { position: "relative", marginBottom: Spacing.xs },
  topAvatarContainerFirst: { marginBottom: Spacing.sm },
  topAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: "#C0C0C0" },
  topAvatarFirst: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: "#F5B700" },
  rankBadge: {
    position: "absolute",
    bottom: -8,
    left: "50%",
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  rankBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  topName: { fontSize: 13, fontWeight: "600", marginTop: Spacing.xs },
  topPoints: { fontSize: 14, fontWeight: "700" },
  topLevel: { fontSize: 10 },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  userRank: { width: 30, fontSize: 16, fontWeight: "700", textAlign: "center" },
  userAvatar: { width: 44, height: 44, borderRadius: 22, marginHorizontal: Spacing.sm },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  userName: { fontSize: 15, fontWeight: "600" },
  youBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  youBadgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  userLocation: { fontSize: 12, marginTop: 2 },
  userStats: { alignItems: "flex-end" },
  userPoints: { fontSize: 15, fontWeight: "700" },
  userBadges: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  userBadgeCount: { fontSize: 11 },
  myRankCard: {
    position: "absolute",
    bottom: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  myRankLabel: { fontSize: 12 },
  myRankInfo: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: Spacing.md, gap: Spacing.sm },
  myRankNumber: { fontSize: 20, fontWeight: "700" },
  myRankPoints: { fontSize: 14, fontWeight: "500" },
  myRankHint: { fontSize: 11 },
});
