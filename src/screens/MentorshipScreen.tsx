import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { EmptyState } from "@/components/ui";

import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
interface Mentor {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  experience: string;
  rating: number;
  reviews: number;
  menteesCount: number;
  isAvailable: boolean;
  skills: string[];
  bio: string;
}

const MENTORS: Mentor[] = [];


export default function MentorshipScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"find" | "my">("find");

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderMentor = ({ item, index }: { item: Mentor; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[styles.mentorCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <View style={styles.mentorHeader}>
          <Image source={{ uri: item.avatar }} style={styles.mentorAvatar} />
          <View style={styles.mentorInfo}>
            <View style={styles.mentorNameRow}>
              <ThemedText style={[styles.mentorName, { color: theme.text }]}>{item.name}</ThemedText>
              <Feather name="check-circle" size={14} color="#2E96EF" />
            </View>
            <ThemedText style={[styles.mentorSpecialty, { color: theme.primary }]}>{item.specialty}</ThemedText>
            <ThemedText style={[styles.mentorExperience, { color: theme.textSecondary }]}>
              {item.experience} অভিজ্ঞতা
            </ThemedText>
          </View>
          <View style={[styles.availabilityBadge, { backgroundColor: item.isAvailable ? "#2E96EF15" : "#DA2F2F15" }]}>
            <View style={[styles.availabilityDot, { backgroundColor: item.isAvailable ? "#2E96EF" : "#DA2F2F" }]} />
            <ThemedText style={[styles.availabilityText, { color: item.isAvailable ? "#2E96EF" : "#DA2F2F" }]}>
              {item.isAvailable ? "উপলব্ধ" : "ব্যস্ত"}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.mentorBio, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.bio}
        </ThemedText>

        <View style={styles.skillsRow}>
          {item.skills.map((skill, idx) => (
            <View key={idx} style={[styles.skillChip, { backgroundColor: theme.primary + "10" }]}>
              <ThemedText style={[styles.skillText, { color: theme.primary }]}>{skill}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.mentorStats}>
          <View style={styles.statItem}>
            <Feather name="star" size={14} color="#F5B700" />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>{item.rating}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>({item.reviews})</ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather name="users" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>{item.menteesCount}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>মেন্টি</ThemedText>
          </View>
        </View>

        <View style={styles.mentorActions}>
          <Pressable style={[styles.messageBtn, { borderColor: theme.primary }]}>
            <ChatIcon size={16} color={theme.primary} />
            <ThemedText style={[styles.messageBtnText, { color: theme.primary }]}>মেসেজ</ThemedText>
          </Pressable>
          <Pressable style={[styles.requestBtn, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.requestBtnText}>মেন্টর রিকুয়েস্ট</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>মেন্টরশিপ</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          অভিজ্ঞদের কাছ থেকে শিখুন
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50)} style={styles.tabsContainer}>
        {[
          { id: "find", label: "মেন্টর খুঁজুন", icon: "search" as const },
          { id: "my", label: "আমার মেন্টরশিপ", icon: "user-check" as const },
        ].map(tab => (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              { backgroundColor: activeTab === tab.id ? theme.primary : theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.id as any);
            }}
          >
            <AppIcon name={tab.icon} size={16} color={activeTab === tab.id ? "#fff" : theme.text} />
            <ThemedText style={[styles.tabText, { color: activeTab === tab.id ? "#fff" : theme.text }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.View>

      {activeTab === "find" ? (
        <FlatList
          data={MENTORS}
          ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
          keyExtractor={item => item.id}
          renderItem={renderMentor}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.myMentorshipContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            icon="users"
            title="আপনার এখনও কোনো মেন্টর নেই"
            message="মেন্টর খুঁজুন ট্যাব থেকে একজন মেন্টর বেছে নিন।"
          />

          <Animated.View entering={FadeInUp.delay(200)} style={styles.becomeMentorSection}>
            <View style={[styles.becomeMentorCard, { backgroundColor: "#B25E0910", borderColor: "#B25E09" }]}>
              <Feather name="award" size={32} color="#B25E09" />
              <View style={styles.becomeMentorContent}>
                <ThemedText style={[styles.becomeMentorTitle, { color: theme.text }]}>মেন্টর হতে চান?</ThemedText>
                <ThemedText style={[styles.becomeMentorDescription, { color: theme.textSecondary }]}>
                  আপনার অভিজ্ঞতা শেয়ার করুন এবং নতুনদের সাহায্য করুন
                </ThemedText>
              </View>
              <Pressable style={[styles.applyBtn, { backgroundColor: "#B25E09" }]}>
                <ThemedText style={styles.applyBtnText}>আবেদন করুন</ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  tabsContainer: { flexDirection: "row", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
 },
  tabText: { fontSize: 13, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg },
  mentorCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
  mentorHeader: { flexDirection: "row", marginBottom: Spacing.md },
  mentorAvatar: { width: 60, height: 60, borderRadius: 30 },
  mentorInfo: { flex: 1, marginLeft: Spacing.md },
  mentorNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  mentorName: { fontSize: 16, fontWeight: "600" },
  mentorSpecialty: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  mentorExperience: { fontSize: 12, marginTop: 2 },
  availabilityBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4, alignSelf: "flex-start" },
  availabilityDot: { width: 6, height: 6, borderRadius: 3 },
  availabilityText: { fontSize: 10, fontWeight: "500" },
  mentorBio: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  skillChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  skillText: { fontSize: 11 },
  mentorStats: { flexDirection: "row", gap: Spacing.xl, marginBottom: Spacing.md },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: { fontSize: 14, fontWeight: "600" },
  statLabel: { fontSize: 12 },
  mentorActions: { flexDirection: "row", gap: Spacing.md },
  messageBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, gap: Spacing.xs },
  messageBtnText: { fontSize: 13, fontWeight: "500" },
  requestBtn: { flex: 1, alignItems: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  requestBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  myMentorshipContent: { paddingHorizontal: Spacing.lg },
  currentMentorCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg },
  currentMentorHeader: { flexDirection: "row", marginBottom: Spacing.lg },
  currentMentorAvatar: { width: 70, height: 70, borderRadius: 35 },
  currentMentorInfo: { flex: 1, marginLeft: Spacing.md, justifyContent: "center" },
  currentMentorLabel: { fontSize: 12 },
  currentMentorName: { fontSize: 18, fontWeight: "700", marginTop: 2 },
  currentMentorDate: { fontSize: 12, marginTop: 2 },
  progressSection: { marginBottom: Spacing.lg },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: "500" },
  progressPercent: { fontSize: 14, fontWeight: "700" },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  statsRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.lg },
  statBox: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: "center" },
  statBoxValue: { fontSize: 16, fontWeight: "700" },
  statBoxLabel: { fontSize: 11, marginTop: 4, textAlign: "center" },
  actionButtons: { flexDirection: "row", gap: Spacing.md },
  scheduleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.full, gap: Spacing.sm },
  scheduleBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  chatBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  becomeMentorSection: { marginTop: Spacing.lg },
  becomeMentorCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1 },
  becomeMentorContent: { flex: 1, marginLeft: Spacing.md },
  becomeMentorTitle: { fontSize: 15, fontWeight: "600" },
  becomeMentorDescription: { fontSize: 12, marginTop: 2 },
  applyBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  applyBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
