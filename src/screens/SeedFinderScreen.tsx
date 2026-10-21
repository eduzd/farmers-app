import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
interface Seed {
  id: string;
  name: string;
  variety: string;
  crop: string;
  image: string;
  price: number;
  yield: string;
  duration: string;
  season: string;
  seller: string;
  location: string;
  rating: number;
  certified: boolean;
}

const SEEDS: Seed[] = [];

const CROP_FILTERS = ["সব", "ধান", "টমেটো", "পেঁয়াজ", "মরিচ", "গম"];

export default function SeedFinderScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedCrop, setSelectedCrop] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredSeeds = SEEDS.filter((s) => selectedCrop === "সব" || s.crop === selectedCrop);

  const handleBuy = (seed: Seed) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("বীজ ক্রয়", `${seed.name}\n\nদাম: ৳${seed.price}/কেজি\nবিক্রেতা: ${seed.seller}`, [
      { text: "বাতিল", style: "cancel" },
      { text: "যোগাযোগ করুন", onPress: () => {} },
      { text: "ক্রয় করুন", onPress: () => {} },
    ]);
  };

  const renderSeed = ({ item, index }: { item: Seed; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable style={[styles.seedCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={() => handleBuy(item)}>
        <Image source={{ uri: item.image }} style={styles.seedImage} contentFit="cover" />
        <View style={styles.badgesRow}>
          <View style={[styles.cropBadge, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.cropText}>{item.crop}</ThemedText>
          </View>
          {item.certified ? (
            <View style={[styles.certifiedBadge, { backgroundColor: "#2FA36B" }]}>
              <Feather name="check-circle" size={12} color="#fff" />
              <ThemedText style={styles.certifiedText}>সনদপ্রাপ্ত</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.seedContent}>
          <ThemedText style={[styles.seedName, { color: theme.text }]}>{item.name}</ThemedText>
          <ThemedText style={[styles.variety, { color: theme.textSecondary }]}>{item.variety}</ThemedText>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Feather name="trending-up" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>{item.yield}</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Feather name="clock" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>{item.duration}</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Feather name="sun" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>{item.season}</ThemedText>
            </View>
          </View>

          <View style={styles.sellerRow}>
            <Feather name="user" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.seller, { color: theme.textSecondary }]} numberOfLines={1}>{item.seller}</ThemedText>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.ratingContainer}>
              <Feather name="star" size={14} color="#FFB300" />
              <ThemedText style={[styles.rating, { color: theme.text }]}>{item.rating}</ThemedText>
            </View>
            <ThemedText style={[styles.price, { color: theme.primary }]}>৳{item.price}/কেজি</ThemedText>
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
          data={CROP_FILTERS}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filtersList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, { backgroundColor: selectedCrop === item ? theme.primary : theme.card, borderColor: selectedCrop === item ? theme.primary : theme.cardBorder }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedCrop(item); }}
            >
              <ThemedText style={[styles.chipText, { color: selectedCrop === item ? theme.white : theme.text }]}>{item}</ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      <FlatList
        data={filteredSeeds}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderSeed}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filtersContainer: { zIndex: 1 },
  filtersList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, marginRight: Spacing.sm },
  chipText: { fontSize: 14, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  columnWrapper: { gap: Spacing.sm, marginBottom: Spacing.sm },
  seedCard: { flex: 1, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  seedImage: { height: 100, width: "100%" },
  badgesRow: { position: "absolute", top: Spacing.xs, left: Spacing.xs, right: Spacing.xs, flexDirection: "row", gap: 4 },
  cropBadge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.sm },
  cropText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  certifiedBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.sm, gap: 2 },
  certifiedText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  seedContent: { padding: Spacing.sm },
  seedName: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  variety: { fontSize: 11, marginBottom: Spacing.xs },
  infoGrid: { gap: 4, marginBottom: Spacing.xs },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 10 },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: Spacing.xs },
  seller: { fontSize: 10, flex: 1 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ratingContainer: { flexDirection: "row", alignItems: "center", gap: 2 },
  rating: { fontSize: 12, fontWeight: "600" },
  price: { fontSize: 14, fontWeight: "700" },
});
