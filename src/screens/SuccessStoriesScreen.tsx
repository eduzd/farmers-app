import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
interface Story {
  id: string;
  title: string;
  farmer: string;
  location: string;
  avatar: string;
  coverImage: string;
  category: string;
  summary: string;
  achievement: string;
  earnings: string;
  views: number;
  likes: number;
  date: string;
}

const STORIES: Story[] = [];

export default function SuccessStoriesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleStoryPress = (story: Story) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderStory = ({ item, index }: { item: Story; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 80).springify()}>
      <Pressable
        style={[styles.storyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleStoryPress(item)}
      >
        <Image source={{ uri: item.coverImage }} style={styles.coverImage} contentFit="cover" />

        <View style={[styles.categoryBadge, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.categoryText}>{item.category}</ThemedText>
        </View>

        <View style={styles.storyContent}>
          <View style={styles.farmerRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
            <View style={styles.farmerInfo}>
              <ThemedText style={[styles.farmerName, { color: theme.text }]}>{item.farmer}</ThemedText>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.location, { color: theme.textSecondary }]}>
                  {item.location}
                </ThemedText>
              </View>
            </View>
          </View>

          <ThemedText style={[styles.storyTitle, { color: theme.text }]}>{item.title}</ThemedText>

          <ThemedText style={[styles.summary, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.summary}
          </ThemedText>

          <View style={styles.achievementRow}>
            <View style={[styles.achievementCard, { backgroundColor: "#2E96EF" + "15" }]}>
              <Feather name="award" size={14} color="#2E96EF" />
              <ThemedText style={[styles.achievementText, { color: "#2E96EF" }]}>
                {item.achievement}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.earningsCard, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="trending-up" size={16} color={theme.primary} />
            <ThemedText style={[styles.earningsText, { color: theme.primary }]}>
              {item.earnings}
            </ThemedText>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Feather name="eye" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                {(item.views / 1000).toFixed(1)}k
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <Feather name="heart" size={14} color="#DA2F2F" />
              <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                {item.likes}
              </ThemedText>
            </View>
            <ThemedText style={[styles.date, { color: theme.textSecondary }]}>{item.date}</ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={STORIES}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderStory}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="star" size={24} color={theme.primary} />
            <View style={styles.headerContent}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                সফল কৃষকদের গল্প
              </ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                অনুপ্রেরণামূলক সাফল্যের কাহিনী
              </ThemedText>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg },
  headerCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  headerSubtitle: { fontSize: 13 },
  storyCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  coverImage: { height: 180, width: "100%" },
  categoryBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  categoryText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  storyContent: { padding: Spacing.md },
  farmerRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.sm },
  farmerInfo: { flex: 1 },
  farmerName: { fontSize: 14, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 12 },
  storyTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.xs, lineHeight: 24 },
  summary: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.sm },
  achievementRow: { marginBottom: Spacing.sm },
  achievementCard: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  achievementText: { fontSize: 12, fontWeight: "500" },
  earningsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  earningsText: { fontSize: 15, fontWeight: "700" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 13 },
  date: { fontSize: 12, marginLeft: "auto" },
  separator: { height: Spacing.md },
});
