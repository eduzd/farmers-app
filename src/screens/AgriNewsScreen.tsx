import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
const CATEGORIES = [
  { id: "all", label: "সব" },
  { id: "market", label: "বাজার" },
  { id: "policy", label: "নীতি" },
  { id: "tech", label: "প্রযুক্তি" },
  { id: "weather", label: "আবহাওয়া" },
  { id: "export", label: "রপ্তানি" },
];

const NEWS: any[] = [];

export default function AgriNewsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const filteredNews = selectedCategory === "all" 
    ? NEWS 
    : NEWS.filter(n => n.category === selectedCategory);

  const featuredNews = filteredNews.find(n => n.featured);
  const regularNews = filteredNews.filter(n => !n.featured);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise(r => setTimeout(r, 1500));
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.categoriesScroll, { backgroundColor: theme.card }]}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryChip,
              {
                backgroundColor: selectedCategory === cat.id ? theme.primary : "transparent",
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedCategory(cat.id);
            }}
          >
            <ThemedText
              style={[styles.categoryText, { color: selectedCategory === cat.id ? "#fff" : theme.text }]}
            >
              {cat.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {featuredNews ? (
          <Animated.View entering={FadeInUp.duration(400)}>
            <Pressable style={styles.featuredCard}>
              <Image
                source={{ uri: featuredNews.image }}
                style={styles.featuredImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.8)"]}
                style={styles.featuredGradient}
              >
                <View style={styles.featuredBadge}>
                  <Feather name="zap" size={12} color="#fff" />
                  <ThemedText style={styles.featuredBadgeText}>ব্রেকিং</ThemedText>
                </View>
                <ThemedText style={styles.featuredTitle}>{featuredNews.title}</ThemedText>
                <ThemedText style={styles.featuredSummary}>{featuredNews.summary}</ThemedText>
                <View style={styles.featuredMeta}>
                  <ThemedText style={styles.featuredSource}>{featuredNews.source}</ThemedText>
                  <ThemedText style={styles.featuredTime}>{featuredNews.time}</ThemedText>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : null}

        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          সাম্প্রতিক খবর
        </ThemedText>

        {filteredNews.length === 0 ? <EmptyState icon="file-text" title="এখনও কোনো খবর নেই" message="নতুন খবর এলে এখানে দেখা যাবে।" /> : null}
        {regularNews.map((news, index) => (
          <Animated.View key={news.id} entering={FadeInUp.delay(index * 80).duration(400)}>
            <Pressable
              style={[styles.newsCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={styles.newsContent}>
                <View style={[styles.categoryTag, { backgroundColor: theme.primary + "20" }]}>
                  <ThemedText style={[styles.categoryTagText, { color: theme.primary }]}>
                    {CATEGORIES.find(c => c.id === news.category)?.label}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.newsTitle, { color: theme.text }]} numberOfLines={2}>
                  {news.title}
                </ThemedText>
                <ThemedText style={[styles.newsSummary, { color: theme.textSecondary }]} numberOfLines={2}>
                  {news.summary}
                </ThemedText>
                <View style={styles.newsMeta}>
                  <ThemedText style={[styles.newsSource, { color: theme.textSecondary }]}>
                    {news.source}
                  </ThemedText>
                  <View style={styles.newsTime}>
                    <Feather name="clock" size={12} color={theme.textSecondary} />
                    <ThemedText style={[styles.newsTimeText, { color: theme.textSecondary }]}>
                      {news.time}
                    </ThemedText>
                  </View>
                </View>
              </View>
              <View style={[styles.newsIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="file-text" size={24} color={theme.primary} />
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  categoriesScroll: { flexGrow: 0 },
  categoriesContent: { padding: Spacing.md, gap: Spacing.sm },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  categoryText: { fontSize: 14, fontWeight: "500" },
  content: { padding: Spacing.lg },
  featuredCard: { borderRadius: BorderRadius["2xl"], overflow: "hidden", marginBottom: Spacing.lg, height: 220 },
  featuredImage: { width: "100%", height: "100%" },
  featuredGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingTop: 60,
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DC2626",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  featuredBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  featuredTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: Spacing.xs },
  featuredSummary: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  featuredMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm },
  featuredSource: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  featuredTime: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  sectionTitle: { marginBottom: Spacing.md },
  newsCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  newsContent: { flex: 1 },
  categoryTag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, alignSelf: "flex-start", marginBottom: Spacing.xs },
  categoryTagText: { fontSize: 11, fontWeight: "600" },
  newsTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  newsSummary: { fontSize: 13, lineHeight: 18 },
  newsMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm },
  newsSource: { fontSize: 12 },
  newsTime: { flexDirection: "row", alignItems: "center", gap: 4 },
  newsTimeText: { fontSize: 12 },
  newsIcon: { width: 56, height: 56, borderRadius: BorderRadius.lg, alignItems: "center", justifyContent: "center" },
});
