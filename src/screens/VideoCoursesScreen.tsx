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
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
interface Course {
  id: string;
  title: string;
  instructor: string;
  thumbnail: string;
  duration: string;
  lessons: number;
  level: "beginner" | "intermediate" | "advanced";
  rating: number;
  students: number;
  price: number;
  isFree: boolean;
  category: string;
  progress?: number;
}

const COURSES: Course[] = [];

const CATEGORIES = ["সব", "কৃষি", "মৎস্য", "প্রাণী"];

export default function VideoCoursesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredCourses = COURSES.filter(
    (course) => selectedCategory === "সব" || course.category === selectedCategory
  );

  const getLevelColor = (level: string) => {
    switch (level) {
      case "beginner":
        return "#2E96EF";
      case "intermediate":
        return "#B25E09";
      case "advanced":
        return "#DA2F2F";
      default:
        return theme.primary;
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case "beginner":
        return "প্রাথমিক";
      case "intermediate":
        return "মাধ্যমিক";
      case "advanced":
        return "উন্নত";
      default:
        return level;
    }
  };

  const handleCoursePress = (course: Course) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderCourse = ({ item, index }: { item: Course; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 80).springify()}>
      <Pressable
        style={[styles.courseCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleCoursePress(item)}
      >
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.durationBadge}>
            <Feather name="clock" size={12} color="#fff" />
            <ThemedText style={styles.durationText}>{item.duration}</ThemedText>
          </View>
          {item.isFree ? (
            <View style={[styles.priceBadge, { backgroundColor: "#2E96EF" }]}>
              <ThemedText style={styles.priceText}>ফ্রি</ThemedText>
            </View>
          ) : null}
          {item.progress !== undefined ? (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: theme.backgroundRoot }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${item.progress}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
              <ThemedText style={styles.progressText}>{item.progress}%</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.courseContent}>
          <View style={styles.categoryRow}>
            <View style={[styles.levelBadge, { backgroundColor: getLevelColor(item.level) + "20" }]}>
              <ThemedText style={[styles.levelText, { color: getLevelColor(item.level) }]}>
                {getLevelText(item.level)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.lessons, { color: theme.textSecondary }]}>
              {item.lessons} পাঠ
            </ThemedText>
          </View>

          <ThemedText style={[styles.courseTitle, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </ThemedText>

          <ThemedText style={[styles.instructor, { color: theme.textSecondary }]}>
            {item.instructor}
          </ThemedText>

          <View style={styles.statsRow}>
            <View style={styles.ratingContainer}>
              <Feather name="star" size={14} color="#FFB300" />
              <ThemedText style={[styles.rating, { color: theme.text }]}>{item.rating}</ThemedText>
            </View>
            <ThemedText style={[styles.students, { color: theme.textSecondary }]}>
              {item.students} শিক্ষার্থী
            </ThemedText>
            {!item.isFree ? (
              <ThemedText style={[styles.price, { color: theme.primary }]}>
                ৳{item.price}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn} style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoriesList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    selectedCategory === item ? theme.primary : theme.card,
                  borderColor:
                    selectedCategory === item ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(item);
              }}
            >
              <ThemedText
                style={[
                  styles.categoryText,
                  { color: selectedCategory === item ? theme.buttonText : theme.text },
                ]}
              >
                {item}
              </ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      <FlatList
        data={filteredCourses}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderCourse}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.statsHeader}>
            <View style={[styles.statCard, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="play-circle" size={24} color={theme.primary} />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {COURSES.length}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                কোর্স
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#2E96EF" + "15" }]}>
              <Feather name="users" size={24} color="#2E96EF" />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                ১৩,৭৪০
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                শিক্ষার্থী
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#B25E09" + "15" }]}>
              <Feather name="award" size={24} color="#B25E09" />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>২</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                সার্টিফিকেট
              </ThemedText>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoriesContainer: {
    zIndex: 1,
  },
  categoriesList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statsHeader: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
  },
  courseCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumbnailContainer: {
    height: 160,
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  priceBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  priceText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  progressContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  courseContent: {
    padding: Spacing.md,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  levelBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  levelText: {
    fontSize: 11,
    fontWeight: "600",
  },
  lessons: {
    fontSize: 12,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    lineHeight: 22,
  },
  instructor: {
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rating: {
    fontSize: 13,
    fontWeight: "600",
  },
  students: {
    fontSize: 12,
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
  },
  separator: {
    height: Spacing.md,
  },
});
