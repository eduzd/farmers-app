import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  FadeInUp,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
  requirement: string;
  points: number;
}

interface Level {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
}

const LEVELS: Level[] = [
  { level: 1, name: "নতুন কৃষক", minPoints: 0, maxPoints: 100, color: "#9E9E9E" },
  { level: 2, name: "উদীয়মান কৃষক", minPoints: 100, maxPoints: 300, color: "#2FA36B" },
  { level: 3, name: "অভিজ্ঞ কৃষক", minPoints: 300, maxPoints: 600, color: "#2563EB" },
  { level: 4, name: "মাস্টার কৃষক", minPoints: 600, maxPoints: 1000, color: "#7C3AED" },
  { level: 5, name: "কৃষি গুরু", minPoints: 1000, maxPoints: 2000, color: "#EA8A0C" },
  { level: 6, name: "কৃষি সম্রাট", minPoints: 2000, maxPoints: 999999, color: "#F5B700" },
];

const BADGES: Badge[] = [
  {
    id: "1",
    name: "প্রথম পোস্ট",
    description: "কমিউনিটিতে প্রথম পোস্ট করুন",
    icon: "edit-3",
    color: "#2FA36B",
    earned: true,
    earnedAt: "১০ দিন আগে",
    requirement: "১টি পোস্ট করুন",
    points: 10,
  },
  {
    id: "2",
    name: "সক্রিয় সদস্য",
    description: "৭ দিন পরপর অ্যাপ ব্যবহার করুন",
    icon: "calendar",
    color: "#2563EB",
    earned: true,
    earnedAt: "৫ দিন আগে",
    requirement: "৭ দিন পরপর লগইন",
    points: 25,
  },
  {
    id: "3",
    name: "জনপ্রিয় পোস্টার",
    description: "একটি পোস্টে ৫০+ লাইক পান",
    icon: "heart",
    color: "#DB2777",
    earned: false,
    progress: 68,
    requirement: "৫০ লাইক পান",
    points: 50,
  },
  {
    id: "4",
    name: "হেল্পিং হ্যান্ড",
    description: "১০টি প্রশ্নের উত্তর দিন",
    icon: "help-circle",
    color: "#EA8A0C",
    earned: true,
    earnedAt: "গতকাল",
    requirement: "১০টি উত্তর দিন",
    points: 30,
  },
  {
    id: "5",
    name: "বিশ্বস্ত ক্রেতা",
    description: "৫টি অর্ডার সম্পন্ন করুন",
    icon: "shopping-bag",
    color: "#7C3AED",
    earned: false,
    progress: 40,
    requirement: "৫টি অর্ডার করুন",
    points: 40,
  },
  {
    id: "6",
    name: "সেলার স্টার",
    description: "প্রথম পণ্য বিক্রি করুন",
    icon: "star",
    color: "#F5B700",
    earned: false,
    progress: 0,
    requirement: "১টি বিক্রি করুন",
    points: 100,
  },
  {
    id: "7",
    name: "ফটোগ্রাফার",
    description: "১০টি ছবি সহ পোস্ট করুন",
    icon: "camera",
    color: "#0D9488",
    earned: true,
    earnedAt: "১ সপ্তাহ আগে",
    requirement: "১০টি ছবি পোস্ট করুন",
    points: 20,
  },
  {
    id: "8",
    name: "নেটওয়ার্কার",
    description: "৫০ জন ফলো করুন",
    icon: "users",
    color: "#3F51B5",
    earned: false,
    progress: 56,
    requirement: "৫০ জন ফলো করুন",
    points: 35,
  },
  {
    id: "9",
    name: "AI এক্সপ্লোরার",
    description: "AI টুলস ১০ বার ব্যবহার করুন",
    icon: "cpu",
    color: "#673AB7",
    earned: true,
    earnedAt: "৩ দিন আগে",
    requirement: "১০ বার AI ব্যবহার",
    points: 45,
  },
  {
    id: "10",
    name: "সুপার ফার্মার",
    description: "সব ব্যাজ অর্জন করুন",
    icon: "award",
    color: "#FF5722",
    earned: false,
    progress: 50,
    requirement: "সব ব্যাজ পান",
    points: 500,
  },
];

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const totalPoints = BADGES.filter((b) => b.earned).reduce((sum, b) => sum + b.points, 0);
  const currentLevel = LEVELS.find(
    (l) => totalPoints >= l.minPoints && totalPoints < l.maxPoints
  ) || LEVELS[0];
  const nextLevel = LEVELS.find((l) => l.level === currentLevel.level + 1);
  const progressToNext = nextLevel
    ? ((totalPoints - currentLevel.minPoints) /
        (nextLevel.minPoints - currentLevel.minPoints)) *
      100
    : 100;

  const earnedBadges = BADGES.filter((b) => b.earned);
  const inProgressBadges = BADGES.filter((b) => !b.earned);

  const renderBadge = (badge: Badge, index: number) => (
    <Animated.View
      key={badge.id}
      entering={FadeInUp.delay(index * 50).springify()}
    >
      <Pressable
        style={[
          styles.badgeCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
          !badge.earned && styles.badgeCardLocked,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <View
          style={[
            styles.badgeIconContainer,
            {
              backgroundColor: badge.earned ? badge.color + "20" : theme.inputBorder,
            },
          ]}
        >
          <AppIcon
            name={badge.icon as any}
            size={24}
            color={badge.earned ? badge.color : theme.textSecondary}
          />
          {badge.earned ? (
            <View style={[styles.checkMark, { backgroundColor: badge.color }]}>
              <Feather name="check" size={10} color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        <View style={styles.badgeContent}>
          <ThemedText
            style={[
              styles.badgeName,
              { color: badge.earned ? theme.text : theme.textSecondary },
            ]}
          >
            {badge.name}
          </ThemedText>
          <ThemedText
            style={[styles.badgeDesc, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {badge.description}
          </ThemedText>

          {!badge.earned && badge.progress !== undefined ? (
            <View style={styles.progressRow}>
              <View style={[styles.progressBg, { backgroundColor: theme.inputBorder }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: badge.color, width: `${badge.progress}%` },
                  ]}
                />
              </View>
              <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
                {badge.progress}%
              </ThemedText>
            </View>
          ) : null}

          {badge.earned && badge.earnedAt ? (
            <ThemedText style={[styles.earnedAt, { color: badge.color }]}>
              {badge.earnedAt} অর্জিত
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.pointsBadge, { backgroundColor: badge.color + "15" }]}>
          <ThemedText style={[styles.pointsText, { color: badge.color }]}>
            +{badge.points}
          </ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.levelCard, { backgroundColor: currentLevel.color }]}>
        <View style={styles.levelHeader}>
          <View style={styles.levelBadge}>
            <Feather name="award" size={32} color="#FFFFFF" />
          </View>
          <View style={styles.levelInfo}>
            <ThemedText style={styles.levelName}>{currentLevel.name}</ThemedText>
            <ThemedText style={styles.levelNumber}>লেভেল {currentLevel.level}</ThemedText>
          </View>
          <View style={styles.pointsContainer}>
            <ThemedText style={styles.totalPoints}>{totalPoints}</ThemedText>
            <ThemedText style={styles.pointsLabel}>পয়েন্ট</ThemedText>
          </View>
        </View>

        {nextLevel ? (
          <View style={styles.nextLevelSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFillWhite, { width: `${progressToNext}%` }]} />
            </View>
            <ThemedText style={styles.nextLevelText}>
              পরবর্তী লেভেল: {nextLevel.name} ({nextLevel.minPoints} পয়েন্ট)
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <ThemedText style={[styles.statNumber, { color: theme.primary }]}>
            {earnedBadges.length}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            অর্জিত ব্যাজ
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <ThemedText style={[styles.statNumber, { color: "#EA8A0C" }]}>
            {inProgressBadges.length}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            চলমান
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <ThemedText style={[styles.statNumber, { color: "#7C3AED" }]}>
            {BADGES.length}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            মোট ব্যাজ
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
        অর্জিত ব্যাজ ({earnedBadges.length})
      </ThemedText>
      <View style={styles.badgesGrid}>
        {earnedBadges.map((badge, index) => renderBadge(badge, index))}
      </View>

      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
        চলমান ({inProgressBadges.length})
      </ThemedText>
      <View style={styles.badgesGrid}>
        {inProgressBadges.map((badge, index) => renderBadge(badge, index))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  levelCard: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  levelBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  levelName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  levelNumber: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: "center",
  },
  totalPoints: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  pointsLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  nextLevelSection: {
    marginTop: Spacing.lg,
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    marginBottom: Spacing.sm,
  },
  progressFillWhite: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
  },
  nextLevelText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.small,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  badgesGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  badgeCardLocked: {
    opacity: 0.8,
  },
  badgeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  checkMark: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  badgeName: {
    fontSize: 15,
    fontWeight: "600",
  },
  badgeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  progressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "600",
  },
  earnedAt: {
    fontSize: 11,
    marginTop: Spacing.xs,
    fontWeight: "500",
  },
  pointsBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.sm,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
