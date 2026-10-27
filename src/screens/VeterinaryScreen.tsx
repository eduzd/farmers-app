import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
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
import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
const VET_CATEGORIES = [
  { id: "all", label: "সব", icon: "grid" },
  { id: "cattle", label: "গরু-মহিষ", icon: "circle" },
  { id: "goat", label: "ছাগল-ভেড়া", icon: "circle" },
  { id: "poultry", label: "পোল্ট্রি", icon: "twitter" },
  { id: "fish", label: "মাছ", icon: "anchor" },
];

const VETS: any[] = [];

const EMERGENCY_SERVICES = [
  { title: "জরুরি হটলাইন", number: "16263", icon: "phone-call", color: "#DA2F2F" },
  { title: "অ্যাম্বুলেন্স", number: "01711-XXXX", icon: "truck", color: "#B25E09" },
  { title: "রাত্রি সেবা", number: "01811-XXXX", icon: "moon", color: "#3D38D0" },
];

export default function VeterinaryScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="ভেট ডাক্তার খুঁজুন..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
          {VET_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === cat.id ? theme.primary : theme.card,
                  borderColor: selectedCategory === cat.id ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(cat.id);
              }}
            >
              <AppIcon
                name={cat.icon as any}
                size={16}
                color={selectedCategory === cat.id ? "#fff" : theme.textSecondary}
              />
              <ThemedText
                style={[styles.categoryText, { color: selectedCategory === cat.id ? "#fff" : theme.text }]}
              >
                {cat.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <Animated.View entering={FadeInUp.duration(400)}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            জরুরি সেবা
          </ThemedText>
          <View style={styles.emergencyRow}>
            {EMERGENCY_SERVICES.map((service, index) => (
              <Pressable
                key={index}
                style={[styles.emergencyCard, { backgroundColor: service.color + "15", borderColor: service.color }]}
                onPress={() => handleCall(service.number)}
              >
                <AppIcon name={service.icon as any} size={24} color={service.color} />
                <ThemedText style={[styles.emergencyTitle, { color: theme.text }]}>{service.title}</ThemedText>
                <ThemedText style={[styles.emergencyNumber, { color: service.color }]}>{service.number}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            উপলব্ধ ডাক্তার ({VETS.length})
          </ThemedText>
          {VETS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
          {VETS.map((vet, index) => (
            <Animated.View key={vet.id} entering={FadeInUp.delay(index * 80).duration(400)}>
              <View style={[styles.vetCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <View style={styles.vetHeader}>
                  <View style={[styles.vetAvatar, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.vetInitials}>{vet.name.charAt(3)}</ThemedText>
                  </View>
                  <View style={styles.vetInfo}>
                    <View style={styles.vetNameRow}>
                      <ThemedText style={[styles.vetName, { color: theme.text }]}>{vet.name}</ThemedText>
                      {vet.available ? (
                        <View style={[styles.statusBadge, { backgroundColor: "#00BB7720" }]}>
                          <View style={[styles.statusDot, { backgroundColor: "#00BB77" }]} />
                          <ThemedText style={[styles.statusText, { color: "#00BB77" }]}>অনলাইন</ThemedText>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: "#DA2F2F20" }]}>
                          <View style={[styles.statusDot, { backgroundColor: "#DA2F2F" }]} />
                          <ThemedText style={[styles.statusText, { color: "#DA2F2F" }]}>অফলাইন</ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={[styles.vetSpecialty, { color: theme.textSecondary }]}>
                      {vet.specialty}
                    </ThemedText>
                    <View style={styles.vetMeta}>
                      <View style={styles.vetMetaItem}>
                        <Feather name="star" size={14} color="#B25E09" />
                        <ThemedText style={[styles.vetMetaText, { color: theme.text }]}>{vet.rating}</ThemedText>
                      </View>
                      <View style={styles.vetMetaItem}>
                        <Feather name="clock" size={14} color={theme.textSecondary} />
                        <ThemedText style={[styles.vetMetaText, { color: theme.textSecondary }]}>
                          {vet.experience}
                        </ThemedText>
                      </View>
                      <View style={styles.vetMetaItem}>
                        <Feather name="map-pin" size={14} color={theme.textSecondary} />
                        <ThemedText style={[styles.vetMetaText, { color: theme.textSecondary }]}>
                          {vet.location}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={[styles.vetFooter, { borderTopColor: theme.cardBorder }]}>
                  <ThemedText style={[styles.vetFee, { color: theme.primary }]}>ফি: {vet.fee}</ThemedText>
                  <View style={styles.vetActions}>
                    <Pressable
                      style={[styles.actionButton, { backgroundColor: theme.primary + "20" }]}
                      onPress={() => handleCall(vet.phone)}
                    >
                      <Feather name="phone" size={18} color={theme.primary} />
                    </Pressable>
                    <Pressable style={[styles.actionButton, { backgroundColor: theme.primary }]}>
                      <ChatIcon size={18} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
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
  categoriesContainer: { marginBottom: Spacing.lg },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
  },
  categoryText: { fontSize: 13, fontWeight: "500" },
  sectionTitle: { marginBottom: Spacing.md },
  emergencyRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  emergencyCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  emergencyTitle: { fontSize: 11, textAlign: "center" },
  emergencyNumber: { fontSize: 12, fontWeight: "700" },
  vetCard: { borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.md, overflow: "hidden" },
  vetHeader: { flexDirection: "row", padding: Spacing.md, gap: Spacing.md },
  vetAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  vetInitials: { color: "#fff", fontSize: 20, fontWeight: "700" },
  vetInfo: { flex: 1 },
  vetNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  vetName: { fontSize: 16, fontWeight: "600" },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "600" },
  vetSpecialty: { fontSize: 13, marginTop: 2 },
  vetMeta: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
  vetMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  vetMetaText: { fontSize: 12 },
  vetFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, borderTopWidth: 1 },
  vetFee: { fontSize: 15, fontWeight: "700" },
  vetActions: { flexDirection: "row", gap: Spacing.sm },
  actionButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
