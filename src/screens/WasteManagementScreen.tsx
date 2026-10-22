import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
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
import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
const WASTE_TYPES = [
  { id: "all", label: "সব", icon: "grid" },
  { id: "organic", label: "জৈব", icon: "feather" },
  { id: "plastic", label: "প্লাস্টিক", icon: "package" },
  { id: "ewaste", label: "ই-বর্জ্য", icon: "smartphone" },
  { id: "agri", label: "কৃষি বর্জ্য", icon: "sun" },
  { id: "hazard", label: "ক্ষতিকর", icon: "alert-triangle" },
];

const SERVICES: any[] = [];

const DISCUSSIONS: any[] = [];

const TIPS = [
  { title: "প্লাস্টিক কমান", desc: "কাপড়ের ব্যাগ ব্যবহার করুন", icon: "shopping-bag", color: "#2563EB" },
  { title: "কম্পোস্ট করুন", desc: "রান্নাঘরের বর্জ্য দিয়ে সার", icon: "feather", color: "#16A34A" },
  { title: "রিসাইকেল করুন", desc: "প্লাস্টিক-কাগজ আলাদা রাখুন", icon: "refresh-cw", color: "#EA8A0C" },
  { title: "রিইউজ করুন", desc: "পুরনো জিনিস পুনর্ব্যবহার", icon: "repeat", color: "#7C3AED" },
];

export default function WasteManagementScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<"services" | "discussions" | "tips">("services");
  const [selectedType, setSelectedType] = useState("all");

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? ["#065f46", "#1f2937"] : ["#d1fae5", "#ecfdf5"]}
        style={styles.headerGradient}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: "#16A34A20" }]}>
            <Feather name="refresh-cw" size={24} color="#16A34A" />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>১২,৫০০ কেজি</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>রিসাইকেল হয়েছে</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#2563EB20" }]}>
            <Feather name="users" size={24} color="#2563EB" />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>৫৬৭</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>সদস্য</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#EA8A0C20" }]}>
            <Feather name="map-pin" size={24} color="#EA8A0C" />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>৪৫</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>সংগ্রহ কেন্দ্র</ThemedText>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        {[
          { id: "services", label: "সেবা", icon: "truck" },
          { id: "discussions", label: "আলোচনা", icon: "message-circle" },
          { id: "tips", label: "টিপস", icon: "info" },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { backgroundColor: theme.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab.id as any);
            }}
          >
            <AppIcon name={tab.icon as any} size={16} color={activeTab === tab.id ? "#fff" : theme.text} />
            <ThemedText style={[styles.tabText, { color: activeTab === tab.id ? "#fff" : theme.text }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "services" ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesScroll}>
              {WASTE_TYPES.map((type) => (
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
                  <AppIcon
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

            {SERVICES.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {SERVICES.map((service, index) => (
              <Animated.View key={service.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <View style={[styles.serviceCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.serviceHeader}>
                    <View style={[styles.serviceIcon, { backgroundColor: "#16A34A20" }]}>
                      <Feather name="refresh-cw" size={24} color="#16A34A" />
                    </View>
                    <View style={styles.serviceInfo}>
                      <ThemedText style={[styles.serviceName, { color: theme.text }]}>{service.name}</ThemedText>
                      <ThemedText style={[styles.serviceType, { color: theme.primary }]}>{service.type}</ThemedText>
                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={12} color={theme.textSecondary} />
                        <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
                          {service.location} ({service.distance})
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.ratingBadge}>
                      <Feather name="star" size={14} color="#EA8A0C" />
                      <ThemedText style={[styles.ratingText, { color: theme.text }]}>{service.rating}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.acceptsRow}>
                    <ThemedText style={[styles.acceptsLabel, { color: theme.textSecondary }]}>গ্রহণ করে:</ThemedText>
                    {service.accepts.map((item: string, i: number) => (
                      <View key={i} style={[styles.acceptChip, { backgroundColor: theme.primary + "15" }]}>
                        <ThemedText style={[styles.acceptText, { color: theme.primary }]}>{item}</ThemedText>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.serviceFooter, { borderTopColor: theme.cardBorder }]}>
                    <View>
                      <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>ক্রয় মূল্য</ThemedText>
                      <ThemedText style={[styles.priceValue, { color: "#16A34A" }]}>{service.buyPrice}</ThemedText>
                    </View>
                    <View style={styles.serviceActions}>
                      <Pressable style={[styles.callBtn, { backgroundColor: theme.primary + "20" }]}>
                        <Feather name="phone" size={18} color={theme.primary} />
                      </Pressable>
                      <Pressable style={[styles.sellBtn, { backgroundColor: theme.primary }]}>
                        <ThemedText style={styles.sellBtnText}>বিক্রি করুন</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        ) : activeTab === "discussions" ? (
          <>
            <Pressable style={[styles.newPostBtn, { backgroundColor: theme.primary }]}>
              <Feather name="plus" size={20} color="#fff" />
              <ThemedText style={styles.newPostText}>প্রশ্ন করুন / সমস্যা শেয়ার করুন</ThemedText>
            </Pressable>

            {DISCUSSIONS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {DISCUSSIONS.map((discussion, index) => (
              <Animated.View key={discussion.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <Pressable style={[styles.discussionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.discussionHeader}>
                    <View style={[styles.authorAvatar, { backgroundColor: "#16A34A" }]}>
                      <ThemedText style={styles.authorInitial}>{discussion.author.charAt(0)}</ThemedText>
                    </View>
                    <View style={styles.discussionMeta}>
                      <ThemedText style={[styles.authorName, { color: theme.text }]}>{discussion.author}</ThemedText>
                      <ThemedText style={[styles.postTime, { color: theme.textSecondary }]}>{discussion.time}</ThemedText>
                    </View>
                    {discussion.solved ? (
                      <View style={[styles.solvedBadge, { backgroundColor: "#16A34A20" }]}>
                        <Feather name="check-circle" size={14} color="#16A34A" />
                        <ThemedText style={[styles.solvedText, { color: "#16A34A" }]}>সমাধান</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.discussionTitle, { color: theme.text }]}>{discussion.title}</ThemedText>
                  <ThemedText style={[styles.discussionContent, { color: theme.textSecondary }]} numberOfLines={2}>
                    {discussion.content}
                  </ThemedText>
                  <View style={styles.tagsRow}>
                    {discussion.tags.map((tag: string, i: number) => (
                      <View key={i} style={[styles.tag, { backgroundColor: "#16A34A20" }]}>
                        <ThemedText style={[styles.tagText, { color: "#16A34A" }]}>{tag}</ThemedText>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.discussionFooter, { borderTopColor: theme.cardBorder }]}>
                    <View style={styles.statItem}>
                      <ChatIcon size={16} color={theme.textSecondary} />
                      <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>{discussion.replies}</ThemedText>
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
        ) : (
          <>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
              পরিবেশ বান্ধব টিপস
            </ThemedText>
            <View style={styles.tipsGrid}>
              {TIPS.map((tip, index) => (
                <Animated.View key={index} entering={FadeInUp.delay(index * 80).duration(400)}>
                  <View style={[styles.tipCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <View style={[styles.tipIcon, { backgroundColor: tip.color + "20" }]}>
                      <AppIcon name={tip.icon as any} size={28} color={tip.color} />
                    </View>
                    <ThemedText style={[styles.tipTitle, { color: theme.text }]}>{tip.title}</ThemedText>
                    <ThemedText style={[styles.tipDesc, { color: theme.textSecondary }]}>{tip.desc}</ThemedText>
                  </View>
                </Animated.View>
              ))}
            </View>

            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>
              কম্পোস্ট তৈরির পদ্ধতি
            </ThemedText>
            <View style={[styles.guideCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              {[
                "রান্নাঘরের সবজির খোসা, ফলের অবশিষ্টাংশ জমা করুন",
                "শুকনো পাতা, খড়, কাগজ মেশান",
                "মাঝে মাঝে উল্টে দিন বাতাস চলাচলের জন্য",
                "পানি ছিটিয়ে ভেজা রাখুন",
                "২-৩ মাসে জৈব সার তৈরি হয়ে যাবে",
              ].map((step, i) => (
                <View key={i} style={styles.guideStep}>
                  <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.stepNumberText}>{i + 1}</ThemedText>
                  </View>
                  <ThemedText style={[styles.stepText, { color: theme.text }]}>{step}</ThemedText>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { padding: Spacing.lg },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  statCard: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: "center", gap: Spacing.xs },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11, textAlign: "center" },
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
  tabText: { fontSize: 13, fontWeight: "600" },
  content: { padding: Spacing.lg, paddingTop: 0 },
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
  serviceCard: { borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.md, overflow: "hidden" },
  serviceHeader: { flexDirection: "row", padding: Spacing.md, gap: Spacing.md },
  serviceIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: "600" },
  serviceType: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { fontSize: 12 },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 14, fontWeight: "600" },
  acceptsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", paddingHorizontal: Spacing.md, gap: Spacing.xs },
  acceptsLabel: { fontSize: 12 },
  acceptChip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  acceptText: { fontSize: 11 },
  serviceFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.sm,
  },
  priceLabel: { fontSize: 11 },
  priceValue: { fontSize: 14, fontWeight: "700" },
  serviceActions: { flexDirection: "row", gap: Spacing.sm },
  callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sellBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  sellBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
  sectionTitle: { marginBottom: Spacing.md },
  tipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  tipCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  tipIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  tipTitle: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  tipDesc: { fontSize: 12, textAlign: "center" },
  guideCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg },
  guideStep: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, marginBottom: Spacing.md },
  stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepNumberText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
