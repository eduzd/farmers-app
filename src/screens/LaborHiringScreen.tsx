import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
interface Worker {
  id: string;
  name: string;
  avatar: string;
  skills: string[];
  experience: string;
  location: string;
  dailyRate: number;
  rating: number;
  completedJobs: number;
  available: boolean;
  phone: string;
}

const WORKERS: Worker[] = [];

const SKILL_FILTERS = ["সব", "চাষ", "ফসল কাটা", "মাছ চাষ", "গবাদি পশু", "যন্ত্রপাতি"];

export default function LaborHiringScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedSkill, setSelectedSkill] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleHire = (worker: Worker) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!worker.available) {
      Alert.alert("অনুপলব্ধ", "এই কর্মী বর্তমানে ব্যস্ত আছেন");
      return;
    }
    Alert.alert(
      "শ্রমিক নিয়োগ",
      `${worker.name}\n\nদৈনিক মজুরি: ৳${worker.dailyRate}\nঅভিজ্ঞতা: ${worker.experience}`,
      [
        { text: "বাতিল", style: "cancel" },
        { text: "কল করুন", onPress: () => {} },
        { text: "নিয়োগ দিন", onPress: () => {} },
      ]
    );
  };

  const renderWorker = ({ item, index }: { item: Worker; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable
        style={[styles.workerCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }, !item.available && styles.unavailable]}
        onPress={() => handleHire(item)}
      >
        <View style={styles.workerHeader}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
          <View style={styles.workerInfo}>
            <ThemedText style={[styles.workerName, { color: theme.text }]}>{item.name}</ThemedText>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.location, { color: theme.textSecondary }]}>{item.location}</ThemedText>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.ratingContainer}>
                <Feather name="star" size={12} color="#FFB300" />
                <ThemedText style={[styles.rating, { color: theme.text }]}>{item.rating}</ThemedText>
              </View>
              <ThemedText style={[styles.jobs, { color: theme.textSecondary }]}>
                {item.completedJobs} কাজ সম্পন্ন
              </ThemedText>
            </View>
          </View>
          {item.available ? (
            <View style={[styles.availableBadge, { backgroundColor: "#2E96EF" }]}>
              <ThemedText style={styles.availableText}>উপলব্ধ</ThemedText>
            </View>
          ) : (
            <View style={[styles.availableBadge, { backgroundColor: "#DA2F2F" }]}>
              <ThemedText style={styles.availableText}>ব্যস্ত</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.skillsRow}>
          {item.skills.map((skill, i) => (
            <View key={i} style={[styles.skillBadge, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.skillText, { color: theme.primary }]}>{skill}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.workerFooter}>
          <View style={styles.experienceContainer}>
            <Feather name="briefcase" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.experience, { color: theme.textSecondary }]}>
              {item.experience} অভিজ্ঞতা
            </ThemedText>
          </View>
          <View style={styles.rateContainer}>
            <ThemedText style={[styles.rateLabel, { color: theme.textSecondary }]}>দৈনিক</ThemedText>
            <ThemedText style={[styles.rate, { color: theme.primary }]}>৳{item.dailyRate}</ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn} style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={SKILL_FILTERS}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filtersList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, { backgroundColor: selectedSkill === item ? theme.primary : theme.card, borderColor: selectedSkill === item ? theme.primary : theme.cardBorder }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedSkill(item); }}
            >
              <ThemedText style={[styles.chipText, { color: selectedSkill === item ? theme.buttonText : theme.text }]}>{item}</ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      <FlatList
        data={WORKERS}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderWorker}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="users" size={24} color={theme.primary} />
            <View style={styles.headerContent}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>কৃষি শ্রমিক নিয়োগ</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                অভিজ্ঞ ও দক্ষ কর্মী খুঁজুন
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
  filtersContainer: { zIndex: 1 },
  filtersList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
 },
  chipText: { fontSize: 14, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  headerCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md, marginBottom: Spacing.lg },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  headerSubtitle: { fontSize: 13 },
  workerCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  unavailable: { opacity: 0.6 },
  workerHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: Spacing.md },
  workerInfo: { flex: 1 },
  workerName: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  location: { fontSize: 12 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  ratingContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  rating: { fontSize: 12, fontWeight: "600" },
  jobs: { fontSize: 11 },
  availableBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  availableText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  skillBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  skillText: { fontSize: 11, fontWeight: "500" },
  workerFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  experienceContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  experience: { fontSize: 12 },
  rateContainer: { alignItems: "flex-end" },
  rateLabel: { fontSize: 11 },
  rate: { fontSize: 18, fontWeight: "700" },
  separator: { height: Spacing.md },
});
