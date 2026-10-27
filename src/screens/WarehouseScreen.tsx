import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
const WAREHOUSES: any[] = [];

const FILTERS = [
  { id: "all", label: "সব" },
  { id: "general", label: "সাধারণ" },
  { id: "cold", label: "কোল্ড স্টোরেজ" },
  { id: "nearby", label: "কাছাকাছি" },
];

export default function WarehouseScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredWarehouses = WAREHOUSES.filter((w) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "cold") return w.type === "cold";
    if (selectedFilter === "general") return w.type === "general";
    if (selectedFilter === "nearby") return parseInt(w.distance) < 50;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.searchSection, { backgroundColor: theme.card }]}>
        <View style={[styles.searchContainer, { borderColor: theme.cardBorder }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="গুদাম খুঁজুন..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.id}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedFilter === filter.id ? theme.primary : "transparent",
                  borderColor: selectedFilter === filter.id ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedFilter(filter.id);
              }}
            >
              <ThemedText
                style={[styles.filterText, { color: selectedFilter === filter.id ? "#fff" : theme.text }]}
              >
                {filter.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="h4" style={[styles.resultCount, { color: theme.text }]}>
          {filteredWarehouses.length} টি গুদাম পাওয়া গেছে
        </ThemedText>

        {filteredWarehouses.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
        {filteredWarehouses.map((warehouse, index) => (
          <Animated.View key={warehouse.id} entering={FadeInUp.delay(index * 80).duration(400)}>
            <Pressable
              style={[styles.warehouseCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.typeIcon,
                    { backgroundColor: warehouse.type === "cold" ? "#2E96EF20" : "#00BB7720" },
                  ]}
                >
                  <AppIcon
                    name={warehouse.type === "cold" ? "thermometer" : "box"}
                    size={24}
                    color={warehouse.type === "cold" ? "#2E96EF" : "#00BB77"}
                  />
                </View>
                <View style={styles.cardInfo}>
                  <ThemedText style={[styles.warehouseName, { color: theme.text }]}>{warehouse.name}</ThemedText>
                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={14} color={theme.textSecondary} />
                    <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
                      {warehouse.location} ({warehouse.distance})
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.ratingBadge}>
                  <Feather name="star" size={14} color="#B25E09" />
                  <ThemedText style={[styles.ratingText, { color: theme.text }]}>{warehouse.rating}</ThemedText>
                </View>
              </View>

              <View style={styles.capacitySection}>
                <View style={styles.capacityItem}>
                  <ThemedText style={[styles.capacityLabel, { color: theme.textSecondary }]}>মোট ধারণ</ThemedText>
                  <ThemedText style={[styles.capacityValue, { color: theme.text }]}>{warehouse.capacity}</ThemedText>
                </View>
                <View style={styles.capacityItem}>
                  <ThemedText style={[styles.capacityLabel, { color: theme.textSecondary }]}>খালি আছে</ThemedText>
                  <ThemedText style={[styles.capacityValue, { color: "#00BB77" }]}>{warehouse.available}</ThemedText>
                </View>
                <View style={styles.capacityItem}>
                  <ThemedText style={[styles.capacityLabel, { color: theme.textSecondary }]}>মূল্য</ThemedText>
                  <ThemedText style={[styles.capacityValue, { color: theme.primary }]}>{warehouse.price}</ThemedText>
                </View>
              </View>

              <View style={styles.featuresRow}>
                {warehouse.features.map((feature: string, i: number) => (
                  <View key={i} style={[styles.featureChip, { backgroundColor: theme.primary + "15" }]}>
                    <ThemedText style={[styles.featureText, { color: theme.primary }]}>{feature}</ThemedText>
                  </View>
                ))}
              </View>

              <View style={styles.cardActions}>
                <Pressable style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}>
                  <Feather name="phone" size={18} color={theme.primary} />
                  <ThemedText style={[styles.actionText, { color: theme.primary }]}>যোগাযোগ</ThemedText>
                </Pressable>
                <Pressable style={[styles.actionButton, { backgroundColor: theme.primary }]}>
                  <Feather name="calendar" size={18} color="#fff" />
                  <ThemedText style={[styles.actionText, { color: "#fff" }]}>বুকিং</ThemedText>
                </Pressable>
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
  searchSection: { padding: Spacing.lg, paddingBottom: Spacing.md },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filtersScroll: { flexGrow: 0 },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: { fontSize: 13, fontWeight: "500" },
  content: { padding: Spacing.lg, paddingTop: 0 },
  resultCount: { marginBottom: Spacing.md },
  warehouseCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  typeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  warehouseName: { fontSize: 16, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { fontSize: 13 },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 14, fontWeight: "600" },
  capacitySection: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.md },
  capacityItem: { alignItems: "center" },
  capacityLabel: { fontSize: 12, marginBottom: 2 },
  capacityValue: { fontSize: 14, fontWeight: "700" },
  featuresRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  featureChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md },
  featureText: { fontSize: 12, fontWeight: "500" },
  cardActions: { flexDirection: "row", gap: Spacing.sm },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  actionText: { fontSize: 14, fontWeight: "600" },
});
