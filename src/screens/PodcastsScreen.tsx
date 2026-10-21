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

const PODCASTS: Podcast[] = [
  {
    id: "1",
    title: "জৈব কৃষির আদ্যোপান্ত",
    host: "ড. রহমান কৃষিবিদ",
    thumbnail: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400",
    duration: "৪৫ মিনিট",
    category: "জৈব কৃষি",
    description: "জৈব কৃষি শুরু করার সম্পূর্ণ গাইড - মাটি প্রস্তুতি থেকে বাজারজাত পর্যন্ত",
    plays: 12500,
    isPlaying: false,
  },
  {
    id: "2",
    title: "মাছ চাষে সফলতার গোপন রহস্য",
    host: "প্রফেসর করিম মৎস্যবিদ",
    thumbnail: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    duration: "৩২ মিনিট",
    category: "মৎস্য চাষ",
    description: "বায়োফ্লক, RAS এবং প্রাকৃতিক পদ্ধতিতে মাছ চাষের কৌশল",
    plays: 8900,
    isPlaying: false,
  },
  {
    id: "3",
    title: "ফসলের রোগ-বালাই নির্মূল",
    host: "ড. শামীম হক",
    thumbnail: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
    duration: "২৮ মিনিট",
    category: "ফসল সুরক্ষা",
    description: "ফসলে পোকা-মাকড় এবং রোগের প্রাকৃতিক প্রতিকার",
    plays: 15200,
    isPlaying: false,
  },
  {
    id: "4",
    title: "কৃষি ব্যবসা পরিকল্পনা",
    host: "আনিসুর রহমান",
    thumbnail: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400",
    duration: "৫০ মিনিট",
    category: "ব্যবসা",
    description: "কৃষি পণ্যের বাজার বিশ্লেষণ ও মূল্য নির্ধারণ কৌশল",
    plays: 6700,
    isPlaying: false,
  },
  {
    id: "5",
    title: "গবাদি পশুর স্বাস্থ্য সেবা",
    host: "ড. মাহমুদ ভেট",
    thumbnail: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=400",
    duration: "৩৮ মিনিট",
    category: "প্রাণিসম্পদ",
    description: "গরু, ছাগল ও মুরগির সাধারণ রোগ ও প্রতিকার",
    plays: 11300,
    isPlaying: false,
  },
  {
    id: "6",
    title: "আধুনিক সেচ ব্যবস্থাপনা",
    host: "ইঞ্জি. ফারুক আহমেদ",
    thumbnail: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400",
    duration: "২৫ মিনিট",
    category: "সেচ",
    description: "ড্রিপ ও স্প্রিংকলার সেচের সুবিধা ও স্থাপন পদ্ধতি",
    plays: 5400,
    isPlaying: false,
  },
];

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
              <Feather name={isPlaying ? "pause" : "play"} size={24} color="#fff" />
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
