import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Fish } from "@/screens/FishEncyclopediaScreen";

import { AppIcon } from "@/components/icons/AppIcon";
type FishDetailRouteProp = RouteProp<RootStackParamList, "FishDetail">;

const getDifficultyConfig = (difficulty: string) => {
  const configs: Record<string, { color: string; label: string; description: string }> = {
    easy: { color: "#2FA36B", label: "সহজ", description: "নতুন চাষিদের জন্য উপযুক্ত" },
    medium: { color: "#EA8A0C", label: "মাঝারি", description: "কিছু অভিজ্ঞতা প্রয়োজন" },
    hard: { color: "#DC2626", label: "কঠিন", description: "অভিজ্ঞ চাষিদের জন্য" },
  };
  return configs[difficulty] || configs.easy;
};

const getProfitabilityConfig = (profitability: string) => {
  const configs: Record<string, { color: string; label: string }> = {
    low: { color: "#9E9E9E", label: "কম লাভজনক" },
    medium: { color: "#EA8A0C", label: "মাঝারি লাভজনক" },
    high: { color: "#2FA36B", label: "অত্যন্ত লাভজনক" },
  };
  return configs[profitability] || configs.medium;
};

const getTypeConfig = (type: string) => {
  const configs: Record<string, { color: string; label: string; icon: keyof typeof Feather.glyphMap }> = {
    freshwater: { color: "#2563EB", label: "মিঠা পানি", icon: "droplet" },
    marine: { color: "#0D9488", label: "সমুদ্রের পানি", icon: "navigation" },
    brackish: { color: "#009688", label: "লোনা পানি", icon: "anchor" },
  };
  return configs[type] || configs.freshwater;
};

interface SectionProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  children: React.ReactNode;
  delay?: number;
}

function Section({ title, icon, iconColor, children, delay = 0 }: SectionProps) {
  const { theme } = useTheme();
  
  return (
    <Animated.View 
      entering={FadeInDown.delay(delay)}
      style={[styles.section, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
    >
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconContainer, { backgroundColor: iconColor + "20" }]}>
          <AppIcon name={icon} size={18} color={iconColor} />
        </View>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{title}</ThemedText>
      </View>
      {children}
    </Animated.View>
  );
}

export default function FishDetailScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<FishDetailRouteProp>();
  const { fish } = route.params;
  
  const difficulty = getDifficultyConfig(fish.difficulty);
  const profitability = getProfitabilityConfig(fish.profitability);
  const fishType = getTypeConfig(fish.type);

  const [activeTab, setActiveTab] = useState<"overview" | "care" | "disease">("overview");

  const tabs = [
    { id: "overview" as const, label: "সংক্ষিপ্ত বিবরণ", icon: "info" as const },
    { id: "care" as const, label: "চাষ পদ্ধতি", icon: "book" as const },
    { id: "disease" as const, label: "রোগ ও প্রতিকার", icon: "activity" as const },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      >
        <Animated.View entering={FadeIn}>
          <Image source={{ uri: fish.image }} style={styles.heroImage} contentFit="cover" />
          <View style={[styles.heroOverlay, { backgroundColor: "rgba(0,0,0,0.3)" }]} />
          <View style={styles.heroContent}>
            <ThemedText style={styles.heroName}>{fish.nameBn}</ThemedText>
            <ThemedText style={styles.heroScientific}>{fish.scientificName}</ThemedText>
          </View>
        </Animated.View>

        <View style={styles.badgesContainer}>
          <View style={[styles.badge, { backgroundColor: fishType.color + "20" }]}>
            <AppIcon name={fishType.icon} size={14} color={fishType.color} />
            <ThemedText style={[styles.badgeText, { color: fishType.color }]}>{fishType.label}</ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: difficulty.color + "20" }]}>
            <Feather name="bar-chart-2" size={14} color={difficulty.color} />
            <ThemedText style={[styles.badgeText, { color: difficulty.color }]}>{difficulty.label}</ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: profitability.color + "20" }]}>
            <Feather name="trending-up" size={14} color={profitability.color} />
            <ThemedText style={[styles.badgeText, { color: profitability.color }]}>{profitability.label}</ThemedText>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              style={[
                styles.tab,
                {
                  backgroundColor: activeTab === tab.id ? theme.primary : theme.surface,
                  borderColor: activeTab === tab.id ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab.id);
              }}
            >
              <AppIcon 
                name={tab.icon} 
                size={16} 
                color={activeTab === tab.id ? "#FFFFFF" : theme.textSecondary} 
              />
              <ThemedText
                style={[
                  styles.tabText,
                  { color: activeTab === tab.id ? "#FFFFFF" : theme.text },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {activeTab === "overview" ? (
          <View style={styles.content}>
            <Section title="বিবরণ" icon="file-text" iconColor="#2563EB" delay={100}>
              <ThemedText style={[styles.sectionContent, { color: theme.text }]}>
                {fish.description}
              </ThemedText>
            </Section>

            <Section title="বাসস্থান" icon="home" iconColor="#2FA36B" delay={150}>
              <ThemedText style={[styles.sectionContent, { color: theme.text }]}>
                {fish.habitat}
              </ThemedText>
            </Section>

            <Section title="বাজার দর" icon="dollar-sign" iconColor="#EA8A0C" delay={200}>
              <View style={styles.priceContainer}>
                <ThemedText style={[styles.priceValue, { color: theme.primary }]}>
                  {fish.marketPrice}
                </ThemedText>
              </View>
            </Section>

            <Section title="মূল তথ্য" icon="list" iconColor="#7C3AED" delay={250}>
              <View style={styles.infoGrid}>
                <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
                  <Feather name="clock" size={20} color={theme.primary} />
                  <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>বৃদ্ধিকাল</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: theme.text }]}>{fish.growthPeriod}</ThemedText>
                </View>
                <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
                  <Feather name="thermometer" size={20} color={theme.primary} />
                  <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>তাপমাত্রা</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: theme.text }]}>{fish.idealTemperature}</ThemedText>
                </View>
                <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
                  <Feather name="package" size={20} color={theme.primary} />
                  <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>খাবার</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: theme.text }]}>{fish.feedType}</ThemedText>
                </View>
                <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
                  <Feather name="target" size={20} color={theme.primary} />
                  <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>সংগ্রহ</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: theme.text }]}>{fish.harvestTime}</ThemedText>
                </View>
              </View>
            </Section>
          </View>
        ) : null}

        {activeTab === "care" ? (
          <View style={styles.content}>
            <Section title="প্রজনন" icon="heart" iconColor="#DB2777" delay={100}>
              <ThemedText style={[styles.sectionContent, { color: theme.text }]}>
                {fish.breeding}
              </ThemedText>
            </Section>

            <Section title="খাদ্য ব্যবস্থাপনা" icon="box" iconColor="#FF5722" delay={150}>
              <ThemedText style={[styles.sectionContent, { color: theme.text }]}>
                {fish.feeding}
              </ThemedText>
            </Section>

            <Section title="পানির গুণাগুণ" icon="droplet" iconColor="#03A9F4" delay={200}>
              <ThemedText style={[styles.sectionContent, { color: theme.text }]}>
                {fish.waterQuality}
              </ThemedText>
            </Section>

            <Section title="চাষের কঠিনতা" icon="bar-chart-2" iconColor={difficulty.color} delay={250}>
              <View style={styles.difficultyContainer}>
                <View style={[styles.difficultyBadge, { backgroundColor: difficulty.color + "20" }]}>
                  <ThemedText style={[styles.difficultyBadgeText, { color: difficulty.color }]}>
                    {difficulty.label}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.difficultyDesc, { color: theme.textSecondary }]}>
                  {difficulty.description}
                </ThemedText>
              </View>
            </Section>
          </View>
        ) : null}

        {activeTab === "disease" ? (
          <View style={styles.content}>
            <Section title="সাধারণ রোগসমূহ" icon="alert-circle" iconColor="#DC2626" delay={100}>
              <View style={styles.diseaseList}>
                {fish.diseases.map((disease, index) => (
                  <View 
                    key={index} 
                    style={[styles.diseaseItem, { backgroundColor: theme.surface }]}
                  >
                    <View style={[styles.diseaseIcon, { backgroundColor: "#DC262620" }]}>
                      <Feather name="alert-triangle" size={16} color="#DC2626" />
                    </View>
                    <ThemedText style={[styles.diseaseText, { color: theme.text }]}>
                      {disease}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Section>

            <Section title="রোগ প্রতিরোধ টিপস" icon="shield" iconColor="#2FA36B" delay={150}>
              <View style={styles.tipsList}>
                <View style={styles.tipItem}>
                  <Feather name="check-circle" size={16} color="#2FA36B" />
                  <ThemedText style={[styles.tipText, { color: theme.text }]}>
                    নিয়মিত পানির গুণাগুণ পরীক্ষা করুন
                  </ThemedText>
                </View>
                <View style={styles.tipItem}>
                  <Feather name="check-circle" size={16} color="#2FA36B" />
                  <ThemedText style={[styles.tipText, { color: theme.text }]}>
                    মাছের খাবারের পরিমাণ সঠিক রাখুন
                  </ThemedText>
                </View>
                <View style={styles.tipItem}>
                  <Feather name="check-circle" size={16} color="#2FA36B" />
                  <ThemedText style={[styles.tipText, { color: theme.text }]}>
                    পুকুরে অতিরিক্ত মাছ রাখবেন না
                  </ThemedText>
                </View>
                <View style={styles.tipItem}>
                  <Feather name="check-circle" size={16} color="#2FA36B" />
                  <ThemedText style={[styles.tipText, { color: theme.text }]}>
                    নতুন মাছ ছাড়ার আগে পৃথকীকরণ করুন
                  </ThemedText>
                </View>
                <View style={styles.tipItem}>
                  <Feather name="check-circle" size={16} color="#2FA36B" />
                  <ThemedText style={[styles.tipText, { color: theme.text }]}>
                    প্রয়োজনে পশু চিকিৎসকের পরামর্শ নিন
                  </ThemedText>
                </View>
              </View>
            </Section>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroImage: {
    width: "100%",
    height: 250,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    height: 250,
  },
  heroContent: {
    position: "absolute",
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  heroName: {
    fontSize: 28,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroScientific: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#FFFFFF",
    fontStyle: "italic",
    opacity: 0.9,
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  sectionContent: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 22,
  },
  priceContainer: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  priceValue: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  infoItem: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.xs,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    textAlign: "center",
  },
  difficultyContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  difficultyBadgeText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  difficultyDesc: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  diseaseList: {
    gap: Spacing.sm,
  },
  diseaseItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  diseaseIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  diseaseText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  tipsList: {
    gap: Spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tipText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    flex: 1,
  },
});
