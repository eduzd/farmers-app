import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Scheme {
  id: string;
  title: string;
  ministry: string;
  category: string;
  description: string;
  benefits: string[];
  eligibility: string[];
  deadline?: string;
  status: "active" | "upcoming" | "closed";
  link?: string;
}

const SCHEMES: Scheme[] = [
  {
    id: "1",
    title: "কৃষি যান্ত্রিকীকরণ প্রকল্প",
    ministry: "কৃষি মন্ত্রণালয়",
    category: "যন্ত্রপাতি",
    description: "কৃষি যন্ত্রপাতি ক্রয়ে ৫০-৭০% ভর্তুকি প্রদান",
    benefits: ["ট্রাক্টর ক্রয়ে ৫০% ভর্তুকি", "হার্ভেস্টারে ৭০% ভর্তুকি", "পাওয়ার টিলারে ৬০% ভর্তুকি"],
    eligibility: ["জাতীয় পরিচয়পত্রধারী কৃষক", "কৃষি কার্ড থাকতে হবে", "নিজ জমি বা লিজ জমি থাকতে হবে"],
    deadline: "৩০ জুন ২০২৬",
    status: "active",
  },
  {
    id: "2",
    title: "কৃষি ঋণ সুদ মওকুফ",
    ministry: "অর্থ মন্ত্রণালয়",
    category: "ঋণ",
    description: "ক্ষুদ্র ও প্রান্তিক কৃষকদের ঋণের সুদ মওকুফ",
    benefits: ["১ লক্ষ টাকা পর্যন্ত ঋণ সুদমুক্ত", "৫০,০০০ টাকা পর্যন্ত ঋণ সরাসরি মওকুফ"],
    eligibility: ["প্রান্তিক কৃষক (১ একরের কম জমি)", "আয় বছরে ১ লক্ষ টাকার কম"],
    status: "active",
  },
  {
    id: "3",
    title: "সার ভর্তুকি প্রকল্প",
    ministry: "কৃষি মন্ত্রণালয়",
    category: "সার",
    description: "রাসায়নিক ও জৈব সারে সরকারি ভর্তুকি",
    benefits: ["ইউরিয়া সারে ৬০% ভর্তুকি", "ডিএপি সারে ৫০% ভর্তুকি", "জৈব সারে ৪০% ভর্তুকি"],
    eligibility: ["সকল নিবন্ধিত কৃষক", "কৃষি অফিসের সুপারিশ প্রয়োজন"],
    status: "active",
  },
  {
    id: "4",
    title: "ফসল বীমা প্রকল্প",
    ministry: "কৃষি মন্ত্রণালয়",
    category: "বীমা",
    description: "প্রাকৃতিক দুর্যোগে ফসল ক্ষতির ক্ষতিপূরণ",
    benefits: ["৮০% পর্যন্ত ক্ষতিপূরণ", "প্রিমিয়ামে ৫০% ভর্তুকি"],
    eligibility: ["আমন, বোরো, আউশ ধান চাষীরা", "নিবন্ধিত কৃষক"],
    deadline: "চলমান",
    status: "active",
  },
  {
    id: "5",
    title: "সোলার সেচ পাম্প প্রকল্প",
    ministry: "বিদ্যুৎ ও জ্বালানি মন্ত্রণালয়",
    category: "শক্তি",
    description: "সৌরশক্তি চালিত সেচ পাম্প স্থাপনে ভর্তুকি",
    benefits: ["৫০% ভর্তুকি", "বিনা সুদে কিস্তি সুবিধা", "৫ বছর বিনামূল্যে রক্ষণাবেক্ষণ"],
    eligibility: ["গ্রামীণ কৃষক", "সমবায় সমিতি"],
    status: "upcoming",
  },
  {
    id: "6",
    title: "মৎস্য চাষ উন্নয়ন প্রকল্প",
    ministry: "মৎস্য ও প্রাণিসম্পদ মন্ত্রণালয়",
    category: "মৎস্য",
    description: "মাছ চাষে প্রশিক্ষণ ও আর্থিক সহায়তা",
    benefits: ["বিনামূল্যে প্রশিক্ষণ", "৫০,০০০ টাকা অনুদান", "পোনা মাছ সরবরাহ"],
    eligibility: ["যুবক ও মহিলা উদ্যোক্তা", "বেকার যুবক/যুবতী"],
    status: "active",
  },
];

const CATEGORIES = ["সব", "যন্ত্রপাতি", "ঋণ", "সার", "বীমা", "শক্তি", "মৎস্য"];

export default function GovernmentSchemesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredSchemes = SCHEMES.filter(
    (s) => selectedCategory === "সব" || s.category === selectedCategory
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#2FA36B";
      case "upcoming":
        return "#EA8A0C";
      case "closed":
        return "#DC2626";
      default:
        return theme.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "চলমান";
      case "upcoming":
        return "শীঘ্রই";
      case "closed":
        return "বন্ধ";
      default:
        return status;
    }
  };

  const handleApply = (scheme: Scheme) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (scheme.link) {
      Linking.openURL(scheme.link);
    }
  };

  const renderScheme = ({ item, index }: { item: Scheme; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <View style={[styles.schemeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.schemeHeader}>
          <View style={styles.schemeTitleContainer}>
            <ThemedText style={[styles.schemeTitle, { color: theme.text }]}>{item.title}</ThemedText>
            <ThemedText style={[styles.ministry, { color: theme.textSecondary }]}>
              {item.ministry}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "15" }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <ThemedText style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
          {item.description}
        </ThemedText>

        <View style={styles.benefitsSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.text }]}>সুবিধাসমূহ:</ThemedText>
          {item.benefits.map((benefit, i) => (
            <View key={i} style={styles.benefitItem}>
              <Feather name="check-circle" size={14} color="#2FA36B" />
              <ThemedText style={[styles.benefitText, { color: theme.text }]}>{benefit}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.eligibilitySection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.text }]}>যোগ্যতা:</ThemedText>
          {item.eligibility.map((elig, i) => (
            <View key={i} style={styles.eligibilityItem}>
              <View style={[styles.eligDot, { backgroundColor: theme.primary }]} />
              <ThemedText style={[styles.eligText, { color: theme.textSecondary }]}>{elig}</ThemedText>
            </View>
          ))}
        </View>

        {item.deadline ? (
          <View style={styles.deadlineRow}>
            <Feather name="clock" size={14} color="#EA8A0C" />
            <ThemedText style={[styles.deadline, { color: "#EA8A0C" }]}>
              শেষ তারিখ: {item.deadline}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.applyButton, { backgroundColor: theme.primary }]}
            onPress={() => handleApply(item)}
          >
            <Feather name="file-text" size={16} color={theme.white} />
            <ThemedText style={styles.applyButtonText}>আবেদন করুন</ThemedText>
          </Pressable>
          <Pressable style={[styles.shareButton, { borderColor: theme.primary }]}>
            <Feather name="share-2" size={16} color={theme.primary} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn} style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoriesList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === item ? theme.primary : theme.card,
                  borderColor: selectedCategory === item ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(item);
              }}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: selectedCategory === item ? theme.white : theme.text },
                ]}
              >
                {item}
              </ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      <FlatList
        data={filteredSchemes}
        keyExtractor={(item) => item.id}
        renderItem={renderScheme}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="award" size={24} color={theme.primary} />
            <View style={styles.headerContent}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                সরকারি প্রকল্প ও ভর্তুকি
              </ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                কৃষকদের জন্য বিশেষ সুবিধা ও অনুদান
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
  categoriesContainer: { zIndex: 1 },
  categoriesList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  headerCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  headerSubtitle: { fontSize: 13 },
  schemeCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  schemeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  schemeTitleContainer: { flex: 1, marginRight: Spacing.sm },
  schemeTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  ministry: { fontSize: 12 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  description: { fontSize: 14, marginBottom: Spacing.md, lineHeight: 20 },
  benefitsSection: { marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 13, fontWeight: "600", marginBottom: Spacing.xs },
  benefitItem: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 4 },
  benefitText: { fontSize: 13, flex: 1 },
  eligibilitySection: { marginBottom: Spacing.sm },
  eligibilityItem: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 4 },
  eligDot: { width: 6, height: 6, borderRadius: 3 },
  eligText: { fontSize: 12, flex: 1 },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.md },
  deadline: { fontSize: 13, fontWeight: "500" },
  actionRow: { flexDirection: "row", gap: Spacing.sm },
  applyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  applyButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  shareButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  separator: { height: Spacing.md },
});
