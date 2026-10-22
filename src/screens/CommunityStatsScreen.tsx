import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
const { width } = Dimensions.get("window");

const COMMUNITY_STATS = {
  totalMembers: 125000,
  activeToday: 8500,
  postsToday: 1234,
  questionsAnswered: 567,
  productsListed: 4500,
  ordersCompleted: 890,
  voiceRoomsLive: 12,
  expertSessions: 45,
};

const GROWTH_DATA: any[] = [];

const TOP_CATEGORIES: any[] = [];

const ACTIVITY_TIMELINE: any[] = [];

export default function CommunityStatsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const maxPosts = Math.max(...TOP_CATEGORIES.map(c => c.posts));

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <ThemedText style={[styles.title, { color: theme.text }]}>কমিউনিটি স্ট্যাটস</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            রিয়েল-টাইম ডাটা ও বিশ্লেষণ
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(50)} style={styles.heroCard}>
          <LinearGradient colors={[theme.primary, "#2563EB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
            <View style={styles.heroContent}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroValue}>{(COMMUNITY_STATS.totalMembers / 1000).toFixed(0)}k+</ThemedText>
                <ThemedText style={styles.heroLabel}>মোট সদস্য</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroValue}>{(COMMUNITY_STATS.activeToday / 1000).toFixed(1)}k</ThemedText>
                <ThemedText style={styles.heroLabel}>আজ সক্রিয়</ThemedText>
              </View>
            </View>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveText}>{COMMUNITY_STATS.voiceRoomsLive} লাইভ রুম</ThemedText>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)} style={styles.statsGrid}>
          {[
            { icon: "edit-3" as const, value: COMMUNITY_STATS.postsToday, label: "পোস্ট আজ", color: "#2FA36B" },
            { icon: "help-circle" as const, value: COMMUNITY_STATS.questionsAnswered, label: "উত্তর দেওয়া হয়েছে", color: "#2563EB" },
            { icon: "shopping-bag" as const, value: COMMUNITY_STATS.productsListed, label: "পণ্য তালিকাভুক্ত", color: "#EA8A0C" },
            { icon: "check-circle" as const, value: COMMUNITY_STATS.ordersCompleted, label: "অর্ডার সম্পন্ন", color: "#7C3AED" },
          ].map((stat, index) => (
            <View key={index} style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={[styles.statIcon, { backgroundColor: stat.color + "15" }]}>
                <AppIcon name={stat.icon} size={20} color={stat.color} />
              </View>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>{stat.value.toLocaleString()}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</ThemedText>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150)} style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>টপ ক্যাটেগরি</ThemedText>
          <View style={[styles.categoriesCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {TOP_CATEGORIES.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {TOP_CATEGORIES.map((cat, index) => (
              <View key={index} style={styles.categoryRow}>
                <View style={styles.categoryInfo}>
                  <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                  <ThemedText style={[styles.categoryName, { color: theme.text }]}>{cat.name}</ThemedText>
                </View>
                <View style={styles.categoryBarContainer}>
                  <View style={[styles.categoryBar, { width: `${(cat.posts / maxPosts) * 100}%`, backgroundColor: cat.color }]} />
                </View>
                <ThemedText style={[styles.categoryPosts, { color: theme.textSecondary }]}>
                  {(cat.posts / 1000).toFixed(1)}k
                </ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>সদস্য বৃদ্ধি</ThemedText>
          <View style={[styles.growthCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.growthChart}>
              {GROWTH_DATA.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
              {GROWTH_DATA.map((data, index) => {
                const maxMembers = Math.max(...GROWTH_DATA.map(d => d.members));
                const height = (data.members / maxMembers) * 100;
                return (
                  <View key={index} style={styles.growthBarContainer}>
                    <View style={[styles.growthBar, { height: `${height}%`, backgroundColor: theme.primary }]} />
                    <ThemedText style={[styles.growthMonth, { color: theme.textSecondary }]}>
                      {data.month.slice(0, 3)}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
            <View style={styles.growthSummary}>
              <View style={styles.growthItem}>
                <Feather name="trending-up" size={16} color="#2FA36B" />
                <ThemedText style={[styles.growthValue, { color: "#2FA36B" }]}>+56%</ThemedText>
                <ThemedText style={[styles.growthLabel, { color: theme.textSecondary }]}>৬ মাসে বৃদ্ধি</ThemedText>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(250)} style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>সাম্প্রতিক কার্যক্রম</ThemedText>
          <View style={[styles.activityCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {ACTIVITY_TIMELINE.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {ACTIVITY_TIMELINE.map((activity, index) => (
              <View key={index} style={[styles.activityRow, index < ACTIVITY_TIMELINE.length - 1 && styles.activityRowBorder, { borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.activityDot, { backgroundColor: theme.primary }]} />
                <View style={styles.activityContent}>
                  <ThemedText style={[styles.activityAction, { color: theme.text }]}>{activity.action}</ThemedText>
                  <ThemedText style={[styles.activityUser, { color: theme.textSecondary }]}>
                    {activity.user} • {activity.category}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.activityTime, { color: theme.textSecondary }]}>{activity.time}</ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { paddingTop: Spacing.md, marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  heroCard: { marginBottom: Spacing.lg },
  heroGradient: { borderRadius: BorderRadius.xl, padding: Spacing.lg },
  heroContent: { flexDirection: "row", justifyContent: "space-around" },
  heroStat: { alignItems: "center" },
  heroValue: { color: "#fff", fontSize: 36, fontWeight: "700" },
  heroLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 },
  liveIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.md, gap: Spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#DC2626" },
  liveText: { color: "#fff", fontSize: 13 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { width: (width - Spacing.lg * 3) / 2, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, alignItems: "center" },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, textAlign: "center", marginTop: 4 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.md },
  categoriesCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  categoryRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  categoryInfo: { width: 90, flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryName: { fontSize: 12 },
  categoryBarContainer: { flex: 1, height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, marginHorizontal: Spacing.sm },
  categoryBar: { height: "100%", borderRadius: 4 },
  categoryPosts: { width: 40, fontSize: 11, textAlign: "right" },
  growthCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  growthChart: { flexDirection: "row", justifyContent: "space-around", height: 120, alignItems: "flex-end", marginBottom: Spacing.md },
  growthBarContainer: { alignItems: "center", width: 40 },
  growthBar: { width: 24, borderRadius: 12, minHeight: 8 },
  growthMonth: { fontSize: 10, marginTop: 4 },
  growthSummary: { alignItems: "center" },
  growthItem: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  growthValue: { fontSize: 18, fontWeight: "700" },
  growthLabel: { fontSize: 12 },
  activityCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  activityRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm },
  activityRowBorder: { borderBottomWidth: 1 },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityContent: { flex: 1, marginLeft: Spacing.sm },
  activityAction: { fontSize: 13, fontWeight: "500" },
  activityUser: { fontSize: 11, marginTop: 2 },
  activityTime: { fontSize: 10 },
});
