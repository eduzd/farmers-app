import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, TextInput, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
const SERVICE_TYPES = [
  { id: "all", label: "সব", icon: "grid" },
  { id: "survey", label: "জরিপ", icon: "map" },
  { id: "legal", label: "আইনি", icon: "briefcase" },
  { id: "registration", label: "নিবন্ধন", icon: "file-text" },
  { id: "mutation", label: "নামজারি", icon: "edit" },
  { id: "dispute", label: "বিরোধ", icon: "alert-triangle" },
];

const PROFESSIONALS: any[] = [];

const DISCUSSIONS: any[] = [];

const QUICK_SERVICES = [
  { id: "1", title: "জমির খতিয়ান", icon: "file", color: "#2563EB" },
  { id: "2", title: "মৌজা ম্যাপ", icon: "map", color: "#16A34A" },
  { id: "3", title: "দলিল যাচাই", icon: "check-circle", color: "#7C3AED" },
  { id: "4", title: "মূল্যায়ন", icon: "dollar-sign", color: "#EA8A0C" },
];

export default function LandServicesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<"professionals" | "discussions">("professionals");
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? ["#064e3b", "#1f2937"] : ["#d1fae5", "#ffffff"]}
        style={styles.headerGradient}
      >
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>দ্রুত সেবা</ThemedText>
        <View style={styles.quickServicesRow}>
          {QUICK_SERVICES.map((service) => (
            <Pressable
              key={service.id}
              style={[styles.quickServiceCard, { backgroundColor: service.color + "15", borderColor: service.color }]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={[styles.quickIcon, { backgroundColor: service.color }]}>
                <Feather name={service.icon as any} size={18} color="#fff" />
              </View>
              <ThemedText style={[styles.quickTitle, { color: theme.text }]}>{service.title}</ThemedText>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Pressable
          style={[styles.tab, activeTab === "professionals" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("professionals");
          }}
        >
          <Feather name="users" size={18} color={activeTab === "professionals" ? "#fff" : theme.text} />
          <ThemedText style={[styles.tabText, { color: activeTab === "professionals" ? "#fff" : theme.text }]}>
            বিশেষজ্ঞ খুঁজুন
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "discussions" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("discussions");
          }}
        >
          <Feather name="message-square" size={18} color={activeTab === "discussions" ? "#fff" : theme.text} />
          <ThemedText style={[styles.tabText, { color: activeTab === "discussions" ? "#fff" : theme.text }]}>
            আলোচনা
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "professionals" ? (
          <>
            <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Feather name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="উকিল, সার্ভেয়ার খুঁজুন..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesScroll}>
              {SERVICE_TYPES.map((type) => (
                <Pressable
                  key={type.id}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: selectedType === type.id ? theme.primary : theme.card,
                      borderColor: selectedType === type.id ? theme.primary : theme.cardBorder,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedType(type.id);
                  }}
                >
                  <Feather
                    name={type.icon as any}
                    size={14}
                    color={selectedType === type.id ? "#fff" : theme.textSecondary}
                  />
                  <ThemedText style={[styles.typeText, { color: selectedType === type.id ? "#fff" : theme.text }]}>
                    {type.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {PROFESSIONALS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {PROFESSIONALS.map((pro, index) => (
              <Animated.View key={pro.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <View style={[styles.proCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.proHeader}>
                    <View style={[styles.proAvatar, { backgroundColor: "#16A34A" }]}>
                      <ThemedText style={styles.proInitials}>{pro.name.split(" ")[1]?.charAt(0) || "U"}</ThemedText>
                    </View>
                    <View style={styles.proInfo}>
                      <View style={styles.proNameRow}>
                        <ThemedText style={[styles.proName, { color: theme.text }]}>{pro.name}</ThemedText>
                        {pro.available ? (
                          <View style={[styles.availableBadge, { backgroundColor: "#16A34A20" }]}>
                            <ThemedText style={[styles.availableText, { color: "#16A34A" }]}>উপলব্ধ</ThemedText>
                          </View>
                        ) : (
                          <View style={[styles.availableBadge, { backgroundColor: "#DC262620" }]}>
                            <ThemedText style={[styles.availableText, { color: "#DC2626" }]}>ব্যস্ত</ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={[styles.proSpecialty, { color: theme.primary }]}>{pro.specialty}</ThemedText>
                      <ThemedText style={[styles.proQualification, { color: theme.textSecondary }]}>
                        {pro.qualification}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.proMeta}>
                    <View style={styles.metaItem}>
                      <Feather name="star" size={14} color="#EA8A0C" />
                      <ThemedText style={[styles.metaText, { color: theme.text }]}>{pro.rating}</ThemedText>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{pro.experience}</ThemedText>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="briefcase" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{pro.cases}</ThemedText>
                    </View>
                  </View>

                  <View style={[styles.proFooter, { borderTopColor: theme.cardBorder }]}>
                    <View>
                      <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>পরামর্শ ফি</ThemedText>
                      <ThemedText style={[styles.feeAmount, { color: theme.primary }]}>{pro.fee}</ThemedText>
                    </View>
                    <View style={styles.proActions}>
                      <Pressable
                        style={[styles.callBtn, { backgroundColor: theme.primary + "20" }]}
                        onPress={() => handleCall(pro.phone)}
                      >
                        <Feather name="phone" size={18} color={theme.primary} />
                      </Pressable>
                      <Pressable style={[styles.bookBtn, { backgroundColor: theme.primary }]}>
                        <ThemedText style={styles.bookBtnText}>অ্যাপয়েন্টমেন্ট</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        ) : (
          <>
            <Pressable style={[styles.newPostBtn, { backgroundColor: theme.primary }]}>
              <Feather name="plus" size={20} color="#fff" />
              <ThemedText style={styles.newPostText}>সমস্যা শেয়ার করুন</ThemedText>
            </Pressable>

            {DISCUSSIONS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {DISCUSSIONS.map((discussion, index) => (
              <Animated.View key={discussion.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <Pressable style={[styles.discussionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.discussionHeader}>
                    <View style={[styles.authorAvatar, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.authorInitial}>{discussion.author.charAt(0)}</ThemedText>
                    </View>
                    <View style={styles.discussionMeta}>
                      <ThemedText style={[styles.authorName, { color: theme.text }]}>{discussion.author}</ThemedText>
                      <ThemedText style={[styles.postTime, { color: theme.textSecondary }]}>{discussion.time}</ThemedText>
                    </View>
                    {discussion.solved ? (
                      <View style={[styles.solvedBadge, { backgroundColor: "#16A34A20" }]}>
                        <Feather name="check-circle" size={14} color="#16A34A" />
                        <ThemedText style={[styles.solvedText, { color: "#16A34A" }]}>সমাধান হয়েছে</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.discussionTitle, { color: theme.text }]}>{discussion.title}</ThemedText>
                  <ThemedText style={[styles.discussionContent, { color: theme.textSecondary }]} numberOfLines={2}>
                    {discussion.content}
                  </ThemedText>
                  <View style={styles.tagsRow}>
                    {discussion.tags.map((tag: string, i: number) => (
                      <View key={i} style={[styles.tag, { backgroundColor: theme.primary + "15" }]}>
                        <ThemedText style={[styles.tagText, { color: theme.primary }]}>{tag}</ThemedText>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.discussionFooter, { borderTopColor: theme.cardBorder }]}>
                    <View style={styles.statItem}>
                      <Feather name="message-circle" size={16} color={theme.textSecondary} />
                      <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>{discussion.replies} উত্তর</ThemedText>
                    </View>
                    <View style={styles.statItem}>
                      <Feather name="heart" size={16} color={theme.textSecondary} />
                      <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>{discussion.likes}</ThemedText>
                    </View>
                    <Pressable style={[styles.replyBtn, { backgroundColor: theme.primary + "15" }]}>
                      <ThemedText style={[styles.replyBtnText, { color: theme.primary }]}>উত্তর দিন</ThemedText>
                    </Pressable>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { padding: Spacing.lg },
  headerTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.sm },
  quickServicesRow: { flexDirection: "row", gap: Spacing.sm },
  quickServiceCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  quickIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  quickTitle: { fontSize: 11, textAlign: "center" },
  tabContainer: {
    flexDirection: "row",
    margin: Spacing.lg,
    marginTop: 0,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  content: { padding: Spacing.lg, paddingTop: 0 },
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
  typesScroll: { marginBottom: Spacing.md, flexGrow: 0 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    marginRight: Spacing.sm,
  },
  typeText: { fontSize: 13, fontWeight: "500" },
  proCard: { borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.md, overflow: "hidden" },
  proHeader: { flexDirection: "row", padding: Spacing.md, gap: Spacing.md },
  proAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  proInitials: { color: "#fff", fontSize: 20, fontWeight: "700" },
  proInfo: { flex: 1 },
  proNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  proName: { fontSize: 16, fontWeight: "600" },
  availableBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  availableText: { fontSize: 10, fontWeight: "600" },
  proSpecialty: { fontSize: 14, fontWeight: "500", marginTop: 2 },
  proQualification: { fontSize: 12, marginTop: 2 },
  proMeta: { flexDirection: "row", paddingHorizontal: Spacing.md, gap: Spacing.lg },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13 },
  proFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.sm,
  },
  feeLabel: { fontSize: 11 },
  feeAmount: { fontSize: 16, fontWeight: "700" },
  proActions: { flexDirection: "row", gap: Spacing.sm },
  callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bookBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  bookBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  newPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  newPostText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  discussionCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
  discussionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  authorAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  authorInitial: { color: "#fff", fontSize: 16, fontWeight: "600" },
  discussionMeta: { flex: 1 },
  authorName: { fontSize: 14, fontWeight: "600" },
  postTime: { fontSize: 12 },
  solvedBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
  solvedText: { fontSize: 11, fontWeight: "600" },
  discussionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.xs },
  discussionContent: { fontSize: 14, lineHeight: 20 },
  tagsRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.sm },
  tag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  tagText: { fontSize: 12 },
  discussionFooter: { flexDirection: "row", alignItems: "center", paddingTop: Spacing.md, borderTopWidth: 1, marginTop: Spacing.md, gap: Spacing.lg },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 13 },
  replyBtn: { marginLeft: "auto", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  replyBtnText: { fontSize: 13, fontWeight: "600" },
});
