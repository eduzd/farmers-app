import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
interface ColdStorage {
  id: string;
  name: string;
  location: string;
  distance: string;
  capacity: string;
  available: string;
  ratePerKg: number;
  ratePerMonth: number;
  temperature: string;
  products: string[];
  phone: string;
  rating: number;
}

const COLD_STORAGES: ColdStorage[] = [];

export default function ColdStorageScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleBook = (storage: ColdStorage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "স্টোরেজ বুকিং",
      `${storage.name}\n\nপ্রতি কেজি: ৳${storage.ratePerKg}/মাস\nউপলব্ধ: ${storage.available}`,
      [
        { text: "বাতিল", style: "cancel" },
        { text: "কল করুন", onPress: () => {} },
        { text: "বুক করুন", onPress: () => {} },
      ]
    );
  };

  const renderStorage = ({ item, index }: { item: ColdStorage; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable
        style={[styles.storageCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleBook(item)}
      >
        <View style={styles.storageHeader}>
          <View style={[styles.tempIcon, { backgroundColor: "#00BB77" + "20" }]}>
            <Feather name="thermometer" size={24} color="#00BB77" />
          </View>
          <View style={styles.storageInfo}>
            <ThemedText style={[styles.storageName, { color: theme.text }]}>{item.name}</ThemedText>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.location, { color: theme.textSecondary }]}>
                {item.location} ({item.distance})
              </ThemedText>
            </View>
          </View>
          <View style={styles.ratingContainer}>
            <Feather name="star" size={14} color="#FFB300" />
            <ThemedText style={[styles.rating, { color: theme.text }]}>{item.rating}</ThemedText>
          </View>
        </View>

        <View style={styles.tempRow}>
          <View style={[styles.tempBadge, { backgroundColor: "#00BB77" + "15" }]}>
            <Feather name="wind" size={14} color="#00BB77" />
            <ThemedText style={[styles.tempText, { color: "#00BB77" }]}>{item.temperature}</ThemedText>
          </View>
          <View style={styles.capacityInfo}>
            <ThemedText style={[styles.capacityLabel, { color: theme.textSecondary }]}>
              মোট: {item.capacity}
            </ThemedText>
            <ThemedText style={[styles.availableText, { color: "#2E96EF" }]}>
              উপলব্ধ: {item.available}
            </ThemedText>
          </View>
        </View>

        <View style={styles.productsRow}>
          {item.products.map((product, i) => (
            <View key={i} style={[styles.productBadge, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={[styles.productText, { color: theme.text }]}>{product}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceItem}>
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>প্রতি কেজি/মাস</ThemedText>
            <ThemedText style={[styles.priceValue, { color: theme.primary }]}>৳{item.ratePerKg}</ThemedText>
          </View>
          <View style={styles.priceItem}>
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>প্রতি মণ/মাস</ThemedText>
            <ThemedText style={[styles.priceValue, { color: theme.text }]}>৳{item.ratePerMonth}</ThemedText>
          </View>
          <Pressable style={[styles.bookButton, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.bookButtonText}>বুক করুন</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={COLD_STORAGES}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderStorage}
        contentContainerStyle={[styles.listContent, { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: "#00BB77" + "15" }]}>
            <Feather name="box" size={24} color="#00BB77" />
            <View style={styles.headerContent}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>হিমাগার খুঁজুন</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                আপনার ফসল সংরক্ষণ করুন নিরাপদে
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
  headerCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md, marginBottom: Spacing.lg },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  headerSubtitle: { fontSize: 13 },
  storageCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  storageHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  tempIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginRight: Spacing.md },
  storageInfo: { flex: 1 },
  storageName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 12 },
  ratingContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  rating: { fontSize: 14, fontWeight: "600" },
  tempRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  tempBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  tempText: { fontSize: 13, fontWeight: "600" },
  capacityInfo: { alignItems: "flex-end" },
  capacityLabel: { fontSize: 11 },
  availableText: { fontSize: 12, fontWeight: "600" },
  productsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  productBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  productText: { fontSize: 11 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  priceItem: { alignItems: "center" },
  priceLabel: { fontSize: 11 },
  priceValue: { fontSize: 16, fontWeight: "700" },
  bookButton: { marginLeft: "auto", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  bookButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  separator: { height: Spacing.md },
});
