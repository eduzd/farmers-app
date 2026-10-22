import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
import { ChatIcon } from "@/components/icons/ChatIcon";
interface SkillPost {
  id: string;
  user: { name: string; avatar: string; location: string };
  offering: string[];
  seeking: string[];
  description: string;
  createdAt: string;
  responses: number;
}

const SKILL_POSTS: SkillPost[] = [];

const MY_SKILLS: { offering: string[]; seeking: string[]; matches: number } = {
  offering: [],
  seeking: [],
  matches: 0,
};

export default function SkillExchangeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "my">("browse");

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderPost = ({ item, index }: { item: SkillPost; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <View style={styles.postHeader}>
          <Image source={{ uri: item.user.avatar }} style={styles.userAvatar} />
          <View style={styles.userInfo}>
            <ThemedText style={[styles.userName, { color: theme.text }]}>{item.user.name}</ThemedText>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={10} color={theme.textSecondary} />
              <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>{item.user.location}</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>{item.createdAt}</ThemedText>
        </View>

        <View style={styles.skillsSection}>
          <View style={styles.skillRow}>
            <View style={[styles.skillLabel, { backgroundColor: "#2FA36B15" }]}>
              <Feather name="gift" size={12} color="#2FA36B" />
              <ThemedText style={[styles.skillLabelText, { color: "#2FA36B" }]}>দিতে পারি</ThemedText>
            </View>
            <View style={styles.skillChips}>
              {item.offering.map((skill, idx) => (
                <View key={idx} style={[styles.skillChip, { backgroundColor: "#2FA36B10", borderColor: "#2FA36B" }]}>
                  <ThemedText style={[styles.skillChipText, { color: "#2FA36B" }]}>{skill}</ThemedText>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.skillRow}>
            <View style={[styles.skillLabel, { backgroundColor: "#2563EB15" }]}>
              <Feather name="search" size={12} color="#2563EB" />
              <ThemedText style={[styles.skillLabelText, { color: "#2563EB" }]}>খুঁজছি</ThemedText>
            </View>
            <View style={styles.skillChips}>
              {item.seeking.map((skill, idx) => (
                <View key={idx} style={[styles.skillChip, { backgroundColor: "#2563EB10", borderColor: "#2563EB" }]}>
                  <ThemedText style={[styles.skillChipText, { color: "#2563EB" }]}>{skill}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>

        <ThemedText style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.description}
        </ThemedText>

        <View style={styles.postFooter}>
          <View style={styles.responsesRow}>
            <ChatIcon size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.responsesText, { color: theme.textSecondary }]}>
              {item.responses} রেসপন্স
            </ThemedText>
          </View>
          <Pressable style={[styles.connectBtn, { backgroundColor: theme.primary }]}>
            <Feather name="refresh-cw" size={14} color="#fff" />
            <ThemedText style={styles.connectBtnText}>এক্সচেঞ্জ করুন</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>দক্ষতা বিনিময়</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          জ্ঞান শেয়ার করুন, নতুন কিছু শিখুন
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50)} style={[styles.mySkillsCard, { backgroundColor: theme.primary + "10", borderColor: theme.primary }]}>
        <View style={styles.mySkillsHeader}>
          <View>
            <ThemedText style={[styles.mySkillsTitle, { color: theme.text }]}>আপনার প্রোফাইল</ThemedText>
            <ThemedText style={[styles.matchesText, { color: theme.primary }]}>
              {MY_SKILLS.matches}টি সম্ভাব্য ম্যাচ
            </ThemedText>
          </View>
          <Pressable style={[styles.editBtn, { borderColor: theme.primary }]}>
            <Feather name="edit-2" size={14} color={theme.primary} />
          </Pressable>
        </View>
        <View style={styles.mySkillsRow}>
          <View style={styles.mySkillSection}>
            <ThemedText style={[styles.mySkillLabel, { color: "#2FA36B" }]}>দিতে পারি:</ThemedText>
            <View style={styles.mySkillChipsRow}>
              {MY_SKILLS.offering.map((skill, idx) => (
                <View key={idx} style={[styles.mySkillChip, { backgroundColor: "#2FA36B20" }]}>
                  <ThemedText style={[styles.mySkillChipText, { color: "#2FA36B" }]}>{skill}</ThemedText>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.mySkillSection}>
            <ThemedText style={[styles.mySkillLabel, { color: "#2563EB" }]}>খুঁজছি:</ThemedText>
            <View style={styles.mySkillChipsRow}>
              {MY_SKILLS.seeking.map((skill, idx) => (
                <View key={idx} style={[styles.mySkillChip, { backgroundColor: "#2563EB20" }]}>
                  <ThemedText style={[styles.mySkillChipText, { color: "#2563EB" }]}>{skill}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Animated.View>

      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>সাম্প্রতিক পোস্ট</ThemedText>
        <Pressable style={[styles.postBtn, { backgroundColor: theme.primary }]}>
          <Feather name="plus" size={14} color="#fff" />
          <ThemedText style={styles.postBtnText}>পোস্ট করুন</ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={SKILL_POSTS}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  mySkillsCard: { margin: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1 },
  mySkillsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  mySkillsTitle: { fontSize: 16, fontWeight: "600" },
  matchesText: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  editBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  mySkillsRow: { flexDirection: "row", gap: Spacing.md },
  mySkillSection: { flex: 1 },
  mySkillLabel: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  mySkillChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  mySkillChip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  mySkillChipText: { fontSize: 11 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  postBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: 4 },
  postBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  listContent: { paddingHorizontal: Spacing.lg },
  postCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userInfo: { flex: 1, marginLeft: Spacing.sm },
  userName: { fontSize: 15, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  locationText: { fontSize: 11 },
  timeText: { fontSize: 11 },
  skillsSection: { marginBottom: Spacing.md },
  skillRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.sm },
  skillLabel: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4, marginRight: Spacing.sm },
  skillLabelText: { fontSize: 10, fontWeight: "600" },
  skillChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  skillChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  skillChipText: { fontSize: 11 },
  description: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  postFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  responsesRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  responsesText: { fontSize: 12 },
  connectBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: 4 },
  connectBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
