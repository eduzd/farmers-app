import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
const { width } = Dimensions.get("window");

const STATS: any[] = [];

const CROPS: any[] = [];

const MONTHLY_DATA: any[] = [];

const INSIGHTS: any[] = [];

export default function FarmAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [period, setPeriod] = useState("6m");

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.periodSelector}>
          {["1m", "3m", "6m", "1y"].map((p) => (
            <Pressable
              key={p}
              style={[
                styles.periodButton,
                { backgroundColor: period === p ? theme.primary : theme.card },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPeriod(p);
              }}
            >
              <ThemedText style={[styles.periodText, { color: period === p ? "#fff" : theme.text }]}>
                {p === "1m" ? "১ মাস" : p === "3m" ? "৩ মাস" : p === "6m" ? "৬ মাস" : "১ বছর"}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <Animated.View entering={FadeInUp.duration(400)} style={styles.statsGrid}>
          {STATS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
          {STATS.map((stat, index) => (
            <LinearGradient
              key={stat.id}
              colors={[stat.color + "20", stat.color + "05"]}
              style={styles.statCard}
            >
              <View style={[styles.statIcon, { backgroundColor: stat.color + "30" }]}>
                <Feather name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</ThemedText>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>{stat.value}</ThemedText>
              <View style={styles.statChange}>
                <Feather
                  name={stat.change.startsWith("+") ? "arrow-up" : "arrow-down"}
                  size={12}
                  color={stat.change.startsWith("+") ? "#16A34A" : "#DC2626"}
                />
                <ThemedText
                  style={[styles.statChangeText, { color: stat.change.startsWith("+") ? "#16A34A" : "#DC2626" }]}
                >
                  {stat.change}
                </ThemedText>
              </View>
            </LinearGradient>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            মাসিক উৎপাদন
          </ThemedText>
          <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.barChart}>
              {MONTHLY_DATA.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
              {MONTHLY_DATA.map((item, index) => (
                <View key={index} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${item.value}%`, backgroundColor: theme.primary },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.barLabel, { color: theme.textSecondary }]}>{item.month}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            ফসল অনুযায়ী উৎপাদন
          </ThemedText>
          <View style={[styles.cropsCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {CROPS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {CROPS.map((crop, index) => (
              <View key={index} style={styles.cropRow}>
                <ThemedText style={[styles.cropName, { color: theme.text }]}>{crop.name}</ThemedText>
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBg, { backgroundColor: theme.cardBorder }]}>
                    <View
                      style={[styles.progressBar, { width: `${crop.production}%`, backgroundColor: crop.color }]}
                    />
                  </View>
                  <ThemedText style={[styles.cropPercent, { color: theme.textSecondary }]}>
                    {crop.production}%
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            মূল তথ্য
          </ThemedText>
          <View style={styles.insightsRow}>
            {INSIGHTS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {INSIGHTS.map((insight, index) => (
              <View
                key={index}
                style={[styles.insightCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={[styles.insightIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name={insight.icon as any} size={18} color={theme.primary} />
                </View>
                <ThemedText style={[styles.insightTitle, { color: theme.textSecondary }]}>{insight.title}</ThemedText>
                <ThemedText style={[styles.insightValue, { color: theme.text }]}>{insight.value}</ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  periodSelector: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  periodButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, alignItems: "center" },
  periodText: { fontSize: 13, fontWeight: "600" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    width: (width - Spacing.lg * 2 - Spacing.sm) / 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 18, fontWeight: "700" },
  statChange: { flexDirection: "row", alignItems: "center", gap: 4 },
  statChangeText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { marginBottom: Spacing.md },
  chartCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
  barChart: { flexDirection: "row", height: 150, alignItems: "flex-end", justifyContent: "space-between" },
  barContainer: { alignItems: "center", flex: 1 },
  barWrapper: { height: 120, justifyContent: "flex-end" },
  bar: { width: 24, borderRadius: 4 },
  barLabel: { marginTop: Spacing.xs, fontSize: 11 },
  cropsCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
  cropRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  cropName: { width: 60, fontSize: 14, fontWeight: "500" },
  progressContainer: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  progressBg: { flex: 1, height: 8, borderRadius: 4 },
  progressBar: { height: "100%", borderRadius: 4 },
  cropPercent: { width: 40, fontSize: 12, textAlign: "right" },
  insightsRow: { flexDirection: "row", gap: Spacing.sm },
  insightCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  insightIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  insightTitle: { fontSize: 11, textAlign: "center" },
  insightValue: { fontSize: 12, fontWeight: "600", textAlign: "center" },
});
