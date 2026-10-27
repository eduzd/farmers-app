import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
interface Challenge {
  id: string;
  title: string;
  description: string;
  image: string;
  prize: string;
  participants: number;
  daysLeft: number;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  progress?: number;
  isJoined: boolean;
  tasks: string[];
}

const ACTIVE_CHALLENGES: Challenge[] = [];

const UPCOMING_CHALLENGES: Challenge[] = [];

const getDifficultyConfig = (difficulty: string) => {
  const configs: Record<string, { color: string; label: string }> = {
    easy: { color: "#2E96EF", label: "সহজ" },
    medium: { color: "#B25E09", label: "মাঝারি" },
    hard: { color: "#DA2F2F", label: "কঠিন" },
  };
  return configs[difficulty] || configs.easy;
};

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [challenges, setChallenges] = useState(ACTIVE_CHALLENGES);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleJoin = (challengeId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setChallenges(prev =>
      prev.map(c => (c.id === challengeId ? { ...c, isJoined: true, participants: c.participants + 1 } : c))
    );
  };

  const myProgress = challenges.filter(c => c.isJoined);
  const totalPoints = 2450;

  const renderChallenge = ({ item, index }: { item: Challenge; index: number }) => {
    const difficulty = getDifficultyConfig(item.difficulty);
    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <Pressable
          style={[styles.challengeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          <View style={styles.challengeImageContainer}>
            <Image source={{ uri: item.image }} style={styles.challengeImage} contentFit="cover" />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.challengeGradient} />
            <View style={styles.challengeBadges}>
              <View style={[styles.difficultyBadge, { backgroundColor: difficulty.color }]}>
                <ThemedText style={styles.difficultyText}>{difficulty.label}</ThemedText>
              </View>
              <View style={[styles.daysBadge, { backgroundColor: item.daysLeft <= 3 ? "#DA2F2F" : theme.card }]}>
                <Feather name="clock" size={10} color={item.daysLeft <= 3 ? "#fff" : theme.text} />
                <ThemedText style={[styles.daysText, { color: item.daysLeft <= 3 ? "#fff" : theme.text }]}>
                  {item.daysLeft} দিন
                </ThemedText>
              </View>
            </View>
            <View style={styles.challengeTitleContainer}>
              <ThemedText style={styles.challengeTitle}>{item.title}</ThemedText>
            </View>
          </View>

          <View style={styles.challengeContent}>
            <ThemedText style={[styles.challengeDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.description}
            </ThemedText>

            <View style={styles.prizeRow}>
              <Feather name="gift" size={16} color="#F5B700" />
              <ThemedText style={[styles.prizeText, { color: theme.text }]}>{item.prize}</ThemedText>
            </View>

            {item.isJoined && item.progress !== undefined ? (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <ThemedText style={[styles.progressLabel, { color: theme.textSecondary }]}>আপনার অগ্রগতি</ThemedText>
                  <ThemedText style={[styles.progressPercent, { color: theme.primary }]}>{item.progress}%</ThemedText>
                </View>
                <View style={[styles.progressBar, { backgroundColor: theme.cardBorder }]}>
                  <View style={[styles.progressFill, { width: `${item.progress}%`, backgroundColor: theme.primary }]} />
                </View>
              </View>
            ) : null}

            <View style={styles.challengeFooter}>
              <View style={styles.participantsRow}>
                <Feather name="users" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.participantsText, { color: theme.textSecondary }]}>
                  {item.participants} অংশগ্রহণকারী
                </ThemedText>
              </View>
              {!item.isJoined ? (
                <Pressable
                  style={[styles.joinButton, { backgroundColor: theme.primary }]}
                  onPress={() => handleJoin(item.id)}
                >
                  <ThemedText style={styles.joinButtonText}>যোগ দিন</ThemedText>
                </Pressable>
              ) : (
                <View style={[styles.joinedBadge, { backgroundColor: "#2E96EF15" }]}>
                  <Feather name="check" size={14} color="#2E96EF" />
                  <ThemedText style={[styles.joinedText, { color: "#2E96EF" }]}>যোগ দিয়েছেন</ThemedText>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={challenges}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={item => item.id}
        renderItem={renderChallenge}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeIn} style={styles.header}>
              <ThemedText style={[styles.title, { color: theme.text }]}>চ্যালেঞ্জ</ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                প্রতিযোগিতায় অংশ নিন, পুরস্কার জিতুন
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(50)} style={styles.statsCards}>
              <View style={[styles.statCard, { backgroundColor: theme.primary }]}>
                <Feather name="award" size={24} color="#fff" />
                <View>
                  <ThemedText style={styles.statValue}>{myProgress.length}</ThemedText>
                  <ThemedText style={styles.statLabel}>সক্রিয় চ্যালেঞ্জ</ThemedText>
                </View>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#B25E09" }]}>
                <Feather name="star" size={24} color="#fff" />
                <View>
                  <ThemedText style={styles.statValue}>{totalPoints}</ThemedText>
                  <ThemedText style={styles.statLabel}>পয়েন্ট অর্জিত</ThemedText>
                </View>
              </View>
            </Animated.View>

            <View style={styles.sectionHeader}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>সক্রিয় চ্যালেঞ্জ</ThemedText>
            </View>
          </>
        }
        ListFooterComponent={
          <View>
            <View style={styles.sectionHeader}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>আসন্ন চ্যালেঞ্জ</ThemedText>
            </View>
            {UPCOMING_CHALLENGES.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {UPCOMING_CHALLENGES.map((challenge, index) => (
              <Animated.View key={challenge.id} entering={FadeInUp.delay(200 + index * 50)}>
                <Pressable
                  style={[styles.upcomingCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <Image source={{ uri: challenge.image }} style={styles.upcomingImage} contentFit="cover" />
                  <View style={styles.upcomingInfo}>
                    <ThemedText style={[styles.upcomingTitle, { color: theme.text }]}>{challenge.title}</ThemedText>
                    <View style={styles.upcomingMeta}>
                      <View style={[styles.prizeMini, { backgroundColor: "#F5B70020" }]}>
                        <Feather name="gift" size={10} color="#F5B700" />
                        <ThemedText style={[styles.prizeMiniText, { color: "#F5B700" }]}>{challenge.prize}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.upcomingDays, { color: theme.textSecondary }]}>
                      শুরু হবে {challenge.daysLeft} দিন পর
                    </ThemedText>
                  </View>
                  <Pressable style={[styles.notifyButton, { backgroundColor: theme.primary + "15" }]}>
                    <Feather name="bell" size={16} color={theme.primary} />
                  </Pressable>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  statsCards: { flexDirection: "row", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  statCard: { flex: 1, flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "700" },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  sectionHeader: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  listContent: { paddingHorizontal: Spacing.lg },
  challengeCard: { borderRadius: BorderRadius.xl, borderWidth: 1, overflow: "hidden", marginBottom: Spacing.md },
  challengeImageContainer: { position: "relative", height: 140 },
  challengeImage: { width: "100%", height: "100%" },
  challengeGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 80 },
  challengeBadges: { position: "absolute", top: Spacing.sm, left: Spacing.sm, right: Spacing.sm, flexDirection: "row", justifyContent: "space-between" },
  difficultyBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  difficultyText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  daysBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full, gap: 4 },
  daysText: { fontSize: 10, fontWeight: "500" },
  challengeTitleContainer: { position: "absolute", bottom: Spacing.sm, left: Spacing.sm, right: Spacing.sm },
  challengeTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  challengeContent: { padding: Spacing.md },
  challengeDescription: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.sm },
  prizeRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  prizeText: { fontSize: 14, fontWeight: "600" },
  progressSection: { marginBottom: Spacing.md },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  progressLabel: { fontSize: 12 },
  progressPercent: { fontSize: 12, fontWeight: "600" },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  challengeFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  participantsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  participantsText: { fontSize: 12 },
  joinButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  joinButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  joinedBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: 4 },
  joinedText: { fontSize: 12, fontWeight: "500" },
  upcomingCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  upcomingImage: { width: 70, height: 70, borderRadius: BorderRadius.md },
  upcomingInfo: { flex: 1, marginLeft: Spacing.md },
  upcomingTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  upcomingMeta: { marginBottom: 4 },
  prizeMini: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4, alignSelf: "flex-start" },
  prizeMiniText: { fontSize: 10, fontWeight: "500" },
  upcomingDays: { fontSize: 11 },
  notifyButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
