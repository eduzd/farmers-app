import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
interface Podcast {
  id: string;
  title: string;
  host: string;
  thumbnail: string;
  duration: string;
  category: string;
  description: string;
  plays: number;
  isPlaying: boolean;
}

const PODCASTS: Podcast[] = [];

export default function PodcastsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [podcasts, setPodcasts] = useState(PODCASTS);
  const [refreshing, setRefreshing] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handlePlay = (podcast: Podcast) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentlyPlaying === podcast.id) {
      setCurrentlyPlaying(null);
    } else {
      setCurrentlyPlaying(podcast.id);
    }
  };

  const renderPodcast = ({ item, index }: { item: Podcast; index: number }) => {
    const isPlaying = currentlyPlaying === item.id;

    return (
      <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
        <View
          style={[
            styles.podcastCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            isPlaying && { borderColor: theme.primary },
          ]}
        >
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} contentFit="cover" />
            <Pressable
              style={[styles.playButton, { backgroundColor: isPlaying ? "#DC2626" : theme.primary }]}
              onPress={() => handlePlay(item)}
            >
              <AppIcon name={isPlaying ? "pause" : "play"} size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.podcastContent}>
            <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.categoryText, { color: theme.primary }]}>
                {item.category}
              </ThemedText>
            </View>

            <ThemedText style={[styles.podcastTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </ThemedText>

            <ThemedText style={[styles.host, { color: theme.textSecondary }]}>{item.host}</ThemedText>

            <ThemedText style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.description}
            </ThemedText>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Feather name="clock" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                  {item.duration}
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <Feather name="headphones" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                  {(item.plays / 1000).toFixed(1)}k শুনেছেন
                </ThemedText>
              </View>
            </View>

            {isPlaying ? (
              <View style={[styles.progressContainer, { backgroundColor: theme.backgroundRoot }]}>
                <View style={[styles.progressBar, { backgroundColor: theme.primary }]} />
                <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
                  ১২:৩৫ / {item.duration}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={podcasts}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderPodcast}
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
            <Feather name="headphones" size={24} color={theme.primary} />
            <View style={styles.headerContent}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                কৃষি পডকাস্ট
              </ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                কাজের ফাঁকে শুনুন কৃষি বিশেষজ্ঞদের পরামর্শ
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
  podcastCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumbnailContainer: { width: 120, height: "100%", minHeight: 150, position: "relative" },
  thumbnail: { width: "100%", height: "100%" },
  playButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
    marginLeft: -24,
  },
  podcastContent: { flex: 1, padding: Spacing.md },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  categoryText: { fontSize: 11, fontWeight: "600" },
  podcastTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4, lineHeight: 20 },
  host: { fontSize: 12, marginBottom: Spacing.xs },
  description: { fontSize: 12, lineHeight: 16, marginBottom: Spacing.sm },
  statsRow: { flexDirection: "row", gap: Spacing.lg },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12 },
  progressContainer: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
  },
  progressBar: { height: 4, width: "45%", borderRadius: 2, marginBottom: 4 },
  progressText: { fontSize: 11 },
  separator: { height: Spacing.md },
});
