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
const SPECIALTIES = [
  { id: "all", label: "সব", icon: "grid" },
  { id: "general", label: "জেনারেল", icon: "user" },
  { id: "cardio", label: "হার্ট", icon: "heart" },
  { id: "ortho", label: "হাড়", icon: "activity" },
  { id: "skin", label: "চর্ম", icon: "sun" },
  { id: "eye", label: "চক্ষু", icon: "eye" },
  { id: "child", label: "শিশু", icon: "smile" },
];

const DOCTORS: any[] = [];

const DISCUSSIONS: any[] = [];

const EMERGENCY = [
  { title: "জরুরি হটলাইন", number: "999", icon: "phone-call", color: "#DC2626" },
  { title: "অ্যাম্বুলেন্স", number: "199", icon: "truck", color: "#EA8A0C" },
];

export default function MedicalServicesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<"doctors" | "discussions">("doctors");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? ["#7f1d1d", "#1f2937"] : ["#fee2e2", "#ffffff"]}
        style={styles.headerGradient}
      >
        <View style={styles.emergencyRow}>
          {EMERGENCY.map((item, index) => (
            <Pressable
              key={index}
              style={[styles.emergencyCard, { backgroundColor: item.color + "20", borderColor: item.color }]}
              onPress={() => handleCall(item.number)}
            >
              <Feather name={item.icon as any} size={20} color={item.color} />
              <ThemedText style={[styles.emergencyTitle, { color: theme.text }]}>{item.title}</ThemedText>
              <ThemedText style={[styles.emergencyNumber, { color: item.color }]}>{item.number}</ThemedText>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Pressable
          style={[styles.tab, activeTab === "doctors" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("doctors");
          }}
        >
          <Feather name="user-plus" size={18} color={activeTab === "doctors" ? "#fff" : theme.text} />
          <ThemedText style={[styles.tabText, { color: activeTab === "doctors" ? "#fff" : theme.text }]}>
            ডাক্তার খুঁজুন
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "discussions" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("discussions");
          }}
        >
          <Feather name="message-circle" size={18} color={activeTab === "discussions" ? "#fff" : theme.text} />
          <ThemedText style={[styles.tabText, { color: activeTab === "discussions" ? "#fff" : theme.text }]}>
            আলোচনা
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "doctors" ? (
          <>
            <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Feather name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="ডাক্তার বা বিশেষজ্ঞ খুঁজুন..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specialtiesScroll}>
              {SPECIALTIES.map((spec) => (
                <Pressable
                  key={spec.id}
                  style={[
                    styles.specialtyChip,
                    {
                      backgroundColor: selectedSpecialty === spec.id ? theme.primary : theme.card,
                      borderColor: selectedSpecialty === spec.id ? theme.primary : theme.cardBorder,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedSpecialty(spec.id);
                  }}
                >
                  <Feather
                    name={spec.icon as any}
                    size={14}
                    color={selectedSpecialty === spec.id ? "#fff" : theme.textSecondary}
                  />
                  <ThemedText
                    style={[styles.specialtyText, { color: selectedSpecialty === spec.id ? "#fff" : theme.text }]}
                  >
                    {spec.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {DOCTORS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {DOCTORS.map((doctor, index) => (
              <Animated.View key={doctor.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <View style={[styles.doctorCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.doctorHeader}>
                    <View style={[styles.doctorAvatar, { backgroundColor: "#DC2626" }]}>
                      <ThemedText style={styles.doctorInitials}>{doctor.name.charAt(3)}</ThemedText>
                    </View>
                    <View style={styles.doctorInfo}>
                      <View style={styles.doctorNameRow}>
                        <ThemedText style={[styles.doctorName, { color: theme.text }]}>{doctor.name}</ThemedText>
                        {doctor.available ? (
                          <View style={[styles.availableBadge, { backgroundColor: "#16A34A20" }]}>
                            <View style={[styles.availableDot, { backgroundColor: "#16A34A" }]} />
                            <ThemedText style={[styles.availableText, { color: "#16A34A" }]}>অনলাইন</ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText style={[styles.doctorSpecialty, { color: theme.primary }]}>
                        {doctor.specialty}
                      </ThemedText>
                      <ThemedText style={[styles.doctorQualification, { color: theme.textSecondary }]}>
                        {doctor.qualification}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.doctorMeta}>
                    <View style={styles.metaItem}>
                      <Feather name="star" size={14} color="#EA8A0C" />
                      <ThemedText style={[styles.metaText, { color: theme.text }]}>{doctor.rating}</ThemedText>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                        {doctor.experience}
                      </ThemedText>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="map-pin" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                        {doctor.location}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.doctorFooter, { borderTopColor: theme.cardBorder }]}>
                    <View>
                      <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>ভিজিট ফি</ThemedText>
                      <ThemedText style={[styles.feeAmount, { color: theme.primary }]}>{doctor.fee}</ThemedText>
                    </View>
                    <View>
                      <ThemedText style={[styles.slotLabel, { color: theme.textSecondary }]}>পরবর্তী স্লট</ThemedText>
                      <ThemedText style={[styles.slotTime, { color: theme.text }]}>{doctor.nextSlot}</ThemedText>
                    </View>
                    <Pressable style={[styles.bookBtn, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.bookBtnText}>অ্যাপয়েন্টমেন্ট</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        ) : (
          <>
            <Pressable style={[styles.newPostBtn, { backgroundColor: theme.primary }]}>
              <Feather name="plus" size={20} color="#fff" />
              <ThemedText style={styles.newPostText}>নতুন আলোচনা শুরু করুন</ThemedText>
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
  headerGradient: { padding: Spacing.lg, paddingTop: Spacing.md },
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
  specialtiesScroll: { marginBottom: Spacing.md, flexGrow: 0 },
  specialtyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    marginRight: Spacing.sm,
  },
  specialtyText: { fontSize: 13, fontWeight: "500" },
  doctorCard: { borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.md, overflow: "hidden" },
  doctorHeader: { flexDirection: "row", padding: Spacing.md, gap: Spacing.md },
  doctorAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  doctorInitials: { color: "#fff", fontSize: 20, fontWeight: "700" },
  doctorInfo: { flex: 1 },
  doctorNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  doctorName: { fontSize: 16, fontWeight: "600" },
  availableBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, gap: 4 },
  availableDot: { width: 6, height: 6, borderRadius: 3 },
  availableText: { fontSize: 10, fontWeight: "600" },
  doctorSpecialty: { fontSize: 14, fontWeight: "500", marginTop: 2 },
  doctorQualification: { fontSize: 12, marginTop: 2 },
  doctorMeta: { flexDirection: "row", paddingHorizontal: Spacing.md, gap: Spacing.lg },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13 },
  doctorFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.sm,
  },
  feeLabel: { fontSize: 11 },
  feeAmount: { fontSize: 16, fontWeight: "700" },
  slotLabel: { fontSize: 11 },
  slotTime: { fontSize: 13, fontWeight: "500" },
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
