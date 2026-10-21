import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Certificate {
  id: string;
  title: string;
  issuer: string;
  category: string;
  requirements: string[];
  duration: string;
  status: "available" | "in_progress" | "completed";
  progress?: number;
  completedDate?: string;
  badge: string;
  color: string;
}

const CERTIFICATES: Certificate[] = [
  {
    id: "1",
    title: "জৈব কৃষি বিশেষজ্ঞ",
    issuer: "বাংলাদেশ কৃষি বিশ্ববিদ্যালয়",
    category: "কৃষি",
    requirements: [
      "জৈব কৃষি কোর্স সম্পন্ন",
      "অনলাইন পরীক্ষায় উত্তীর্ণ",
      "প্রকল্প জমা দিন",
    ],
    duration: "৩ মাস",
    status: "completed",
    completedDate: "১৫ জানুয়ারি ২০২৫",
    badge: "leaf",
    color: "#2FA36B",
  },
  {
    id: "2",
    title: "মৎস্য চাষ সনদ",
    issuer: "মৎস্য অধিদপ্তর",
    category: "মৎস্য",
    requirements: [
      "মৎস্য চাষ কোর্স সম্পন্ন",
      "বাস্তব প্রশিক্ষণ",
      "পরীক্ষায় পাস",
    ],
    duration: "২ মাস",
    status: "in_progress",
    progress: 65,
    badge: "droplet",
    color: "#2563EB",
  },
  {
    id: "3",
    title: "প্রাণী স্বাস্থ্য সহায়ক",
    issuer: "প্রাণিসম্পদ অধিদপ্তর",
    category: "প্রাণী",
    requirements: [
      "প্রাণী স্বাস্থ্য কোর্স",
      "হাতে-কলমে প্রশিক্ষণ",
      "সনদ পরীক্ষা",
    ],
    duration: "৪ মাস",
    status: "available",
    badge: "heart",
    color: "#DB2777",
  },
  {
    id: "4",
    title: "কৃষি ব্যবসা পরিচালনা",
    issuer: "কৃষি তথ্য সার্ভিস",
    category: "ব্যবসা",
    requirements: [
      "ব্যবসা পরিকল্পনা কোর্স",
      "আর্থিক ব্যবস্থাপনা",
      "বাজার বিশ্লেষণ",
    ],
    duration: "৬ সপ্তাহ",
    status: "available",
    badge: "briefcase",
    color: "#EA8A0C",
  },
  {
    id: "5",
    title: "জৈব সার উৎপাদন",
    issuer: "বাংলাদেশ জৈব কৃষি সমিতি",
    category: "কৃষি",
    requirements: [
      "ভার্মিকম্পোস্ট প্রশিক্ষণ",
      "কম্পোস্ট তৈরি অভিজ্ঞতা",
      "মূল্যায়ন পরীক্ষা",
    ],
    duration: "১ মাস",
    status: "completed",
    completedDate: "৫ ডিসেম্বর ২০২৪",
    badge: "package",
    color: "#795548",
  },
];

export default function CertificationScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"all" | "completed" | "in_progress">("all");

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredCertificates = CERTIFICATES.filter((cert) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "completed") return cert.status === "completed";
    if (selectedTab === "in_progress")
      return cert.status === "in_progress" || cert.status === "available";
    return true;
  });

  const handleCertificatePress = (cert: Certificate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (cert.status === "completed") {
      Alert.alert("সনদ দেখুন", `${cert.title} সনদ ডাউনলোড বা শেয়ার করতে চান?`, [
        { text: "বাতিল", style: "cancel" },
        { text: "ডাউনলোড", onPress: () => {} },
        { text: "শেয়ার", onPress: () => {} },
      ]);
    } else if (cert.status === "in_progress") {
      Alert.alert("চলমান কোর্স", `${cert.progress}% সম্পন্ন। চালিয়ে যেতে চান?`, [
        { text: "বাতিল", style: "cancel" },
        { text: "চালিয়ে যান", onPress: () => {} },
      ]);
    } else {
      Alert.alert("নতুন সনদ", `${cert.title} কোর্সে ভর্তি হতে চান?`, [
        { text: "না", style: "cancel" },
        { text: "হ্যাঁ, ভর্তি হন", onPress: () => {} },
      ]);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "সম্পন্ন";
      case "in_progress":
        return "চলমান";
      case "available":
        return "উপলব্ধ";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#2FA36B";
      case "in_progress":
        return "#EA8A0C";
      case "available":
        return theme.primary;
      default:
        return theme.textSecondary;
    }
  };

  const renderCertificate = ({ item, index }: { item: Certificate; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 80).springify()}>
      <Pressable
        style={[styles.certCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleCertificatePress(item)}
      >
        <View style={[styles.certBadge, { backgroundColor: item.color + "20" }]}>
          <Feather name={item.badge as any} size={28} color={item.color} />
        </View>

        <View style={styles.certContent}>
          <View style={styles.certHeader}>
            <View style={styles.certTitleContainer}>
              <ThemedText style={[styles.certTitle, { color: theme.text }]}>
                {item.title}
              </ThemedText>
              <ThemedText style={[styles.certIssuer, { color: theme.textSecondary }]}>
                {item.issuer}
              </ThemedText>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) + "15" },
              ]}
            >
              <ThemedText
                style={[styles.statusText, { color: getStatusColor(item.status) }]}
              >
                {getStatusText(item.status)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.certMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {item.duration}
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Feather name="tag" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {item.category}
              </ThemedText>
            </View>
          </View>

          {item.status === "in_progress" && item.progress !== undefined ? (
            <View style={styles.progressSection}>
              <View style={[styles.progressBar, { backgroundColor: theme.backgroundRoot }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${item.progress}%`, backgroundColor: item.color },
                  ]}
                />
              </View>
              <ThemedText style={[styles.progressText, { color: theme.text }]}>
                {item.progress}%
              </ThemedText>
            </View>
          ) : null}

          {item.status === "completed" && item.completedDate ? (
            <View style={styles.completedSection}>
              <Feather name="check-circle" size={16} color="#2FA36B" />
              <ThemedText style={[styles.completedText, { color: "#2FA36B" }]}>
                {item.completedDate} তারিখে অর্জিত
              </ThemedText>
            </View>
          ) : null}

          {item.status === "available" ? (
            <View style={styles.requirementsSection}>
              <ThemedText style={[styles.requirementsTitle, { color: theme.text }]}>
                প্রয়োজনীয়তা:
              </ThemedText>
              {item.requirements.map((req, i) => (
                <View key={i} style={styles.requirementItem}>
                  <View style={[styles.reqDot, { backgroundColor: item.color }]} />
                  <ThemedText style={[styles.reqText, { color: theme.textSecondary }]}>
                    {req}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );

  const completedCount = CERTIFICATES.filter((c) => c.status === "completed").length;
  const inProgressCount = CERTIFICATES.filter((c) => c.status === "in_progress").length;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View
        entering={FadeIn}
        style={[styles.tabsContainer, { paddingTop: Spacing.sm }]}
      >
        {(["all", "completed", "in_progress"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === tab ? theme.primary : theme.card,
                borderColor: selectedTab === tab ? theme.primary : theme.cardBorder,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab(tab);
            }}
          >
            <ThemedText
              style={[
                styles.tabText,
                { color: selectedTab === tab ? theme.white : theme.text },
              ]}
            >
              {tab === "all" ? "সব" : tab === "completed" ? "অর্জিত" : "চলমান"}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.View>

      <FlatList
        data={filteredCertificates}
        keyExtractor={(item) => item.id}
        renderItem={renderCertificate}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: "#2FA36B" + "15" }]}>
              <Feather name="award" size={24} color="#2FA36B" />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {completedCount}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                অর্জিত সনদ
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#EA8A0C" + "15" }]}>
              <Feather name="loader" size={24} color="#EA8A0C" />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {inProgressCount}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                চলমান
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="book-open" size={24} color={theme.primary} />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {CERTIFICATES.length}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                মোট সনদ
              </ThemedText>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  certCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  certBadge: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  certContent: {
    flex: 1,
  },
  certHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  certTitleContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  certTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  certIssuer: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  certMeta: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  progressSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    minWidth: 40,
    textAlign: "right",
  },
  completedSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  completedText: {
    fontSize: 12,
    fontWeight: "500",
  },
  requirementsSection: {
    marginTop: Spacing.xs,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  reqDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reqText: {
    fontSize: 12,
  },
  separator: {
    height: Spacing.md,
  },
});
