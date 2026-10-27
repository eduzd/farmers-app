import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
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
const SERVICE_TYPES = [
  { id: "all", label: "সব", icon: "grid" },
  { id: "solar", label: "সোলার", icon: "sun" },
  { id: "wiring", label: "ওয়্যারিং", icon: "zap" },
  { id: "meter", label: "মিটার", icon: "activity" },
  { id: "pump", label: "মোটর/পাম্প", icon: "settings" },
  { id: "inverter", label: "ইনভার্টার", icon: "battery-charging" },
];

const PROFESSIONALS: any[] = [];

const DISCUSSIONS: any[] = [];

const EMERGENCY = [
  { title: "বিদ্যুৎ জরুরি", number: "16116", icon: "zap", color: "#B25E09" },
  { title: "অগ্নি নির্বাপক", number: "199", icon: "alert-triangle", color: "#DA2F2F" },
];

const TIPS = [
  { title: "LED বাল্ব ব্যবহার করুন", desc: "৮০% বিদ্যুৎ সাশ্রয়", icon: "sun", color: "#B25E09" },
  { title: "অফ করুন", desc: "অব্যবহৃত যন্ত্র বন্ধ রাখুন", icon: "power", color: "#DA2F2F" },
  { title: "সোলার ব্যবহার", desc: "বিনামূল্যে সূর্যের আলো", icon: "sunrise", color: "#00BB77" },
  { title: "স্টার রেটিং", desc: "৫ স্টার যন্ত্রপাতি কিনুন", icon: "star", color: "#2E96EF" },
];

export default function ElectricityServicesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"professionals" | "discussions" | "tips">("professionals");
  const [selectedType, setSelectedType] = useState("all");

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? ["#78350f", "#202936"] : ["#FFF1DE", "#fffbeb"]}
        style={styles.headerGradient}
      >
        <View style={styles.emergencyRow}>
          {EMERGENCY.map((item, index) => (
            <Pressable
              key={index}
              style={[styles.emergencyCard, { backgroundColor: item.color + "20", borderColor: item.color }]}
              onPress={() => handleCall(item.number)}
            >
              <AppIcon name={item.icon as any} size={20} color={item.color} />
              <ThemedText style={[styles.emergencyTitle, { color: theme.text }]}>{item.title}</ThemedText>
              <ThemedText style={[styles.emergencyNumber, { color: item.color }]}>{item.number}</ThemedText>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        {[
          { id: "professionals", label: "সেবা", icon: "tool" },
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
        {activeTab === "professionals" ? (
          <>
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

            {PROFESSIONALS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {PROFESSIONALS.map((pro, index) => (
              <Animated.View key={pro.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <View style={[styles.proCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.proHeader}>
                    <View style={[styles.proIcon, { backgroundColor: "#B25E0920" }]}>
                      <Feather name="zap" size={24} color="#B25E09" />
                    </View>
                    <View style={styles.proInfo}>
                      <ThemedText style={[styles.proName, { color: theme.text }]}>{pro.name}</ThemedText>
                      <ThemedText style={[styles.proSpecialty, { color: theme.primary }]}>{pro.specialty}</ThemedText>
                      <View style={styles.proMeta}>
                        <View style={styles.metaItem}>
                          <Feather name="star" size={12} color="#B25E09" />
                          <ThemedText style={[styles.metaText, { color: theme.text }]}>{pro.rating}</ThemedText>
                        </View>
                        <View style={styles.metaItem}>
                          <Feather name="clock" size={12} color={theme.textSecondary} />
                          <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{pro.experience}</ThemedText>
                        </View>
                        <View style={styles.metaItem}>
                          <Feather name="map-pin" size={12} color={theme.textSecondary} />
                          <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{pro.location}</ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.servicesRow}>
                    {pro.services.map((service: string, i: number) => (
                      <View key={i} style={[styles.serviceChip, { backgroundColor: "#B25E0920" }]}>
                        <ThemedText style={[styles.serviceChipText, { color: "#B25E09" }]}>{service}</ThemedText>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.proFooter, { borderTopColor: theme.cardBorder }]}>
                    <Pressable
                      style={[styles.callBtn, { backgroundColor: theme.primary + "20" }]}
                      onPress={() => handleCall(pro.phone)}
                    >
                      <Feather name="phone" size={18} color={theme.primary} />
                      <ThemedText style={[styles.callBtnText, { color: theme.primary }]}>কল করুন</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.bookBtn, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.bookBtnText}>অ্যাপয়েন্টমেন্ট</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        ) : activeTab === "discussions" ? (
          <>
            <Pressable style={[styles.newPostBtn, { backgroundColor: theme.primary }]}>
              <Feather name="plus" size={20} color="#fff" />
              <ThemedText style={styles.newPostText}>প্রশ্ন করুন</ThemedText>
            </Pressable>

            {DISCUSSIONS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {DISCUSSIONS.map((discussion, index) => (
              <Animated.View key={discussion.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <Pressable style={[styles.discussionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.discussionHeader}>
                    <View style={[styles.authorAvatar, { backgroundColor: "#B25E09" }]}>
                      <ThemedText style={styles.authorInitial}>{discussion.author.charAt(0)}</ThemedText>
                    </View>
                    <View style={styles.discussionMeta}>
                      <ThemedText style={[styles.authorName, { color: theme.text }]}>{discussion.author}</ThemedText>
                      <ThemedText style={[styles.postTime, { color: theme.textSecondary }]}>{discussion.time}</ThemedText>
                    </View>
                    {discussion.solved ? (
                      <View style={[styles.solvedBadge, { backgroundColor: "#00BB7720" }]}>
                        <Feather name="check-circle" size={14} color="#00BB77" />
                        <ThemedText style={[styles.solvedText, { color: "#00BB77" }]}>সমাধান</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.discussionTitle, { color: theme.text }]}>{discussion.title}</ThemedText>
                  <ThemedText style={[styles.discussionContent, { color: theme.textSecondary }]} numberOfLines={2}>
                    {discussion.content}
                  </ThemedText>
                  <View style={styles.tagsRow}>
                    {discussion.tags.map((tag: string, i: number) => (
                      <View key={i} style={[styles.tag, { backgroundColor: "#B25E0920" }]}>
                        <ThemedText style={[styles.tagText, { color: "#B25E09" }]}>{tag}</ThemedText>
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
              বিদ্যুৎ সাশ্রয়ের টিপস
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { padding: Spacing.lg },
  emergencyRow: { flexDirection: "row", gap: Spacing.sm },
  emergencyCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  emergencyTitle: { fontSize: 12 },
  emergencyNumber: { fontSize: 18, fontWeight: "700" },
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
  proCard: { borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.md, overflow: "hidden" },
  proHeader: { flexDirection: "row", padding: Spacing.md, gap: Spacing.md },
  proIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  proInfo: { flex: 1 },
  proName: { fontSize: 16, fontWeight: "600" },
  proSpecialty: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  proMeta: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  servicesRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: Spacing.md, gap: Spacing.xs },
  serviceChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  serviceChipText: { fontSize: 12 },
  proFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.sm,
  },
  callBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, gap: Spacing.xs },
  callBtnText: { fontSize: 14, fontWeight: "600" },
  bookBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  bookBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
});
