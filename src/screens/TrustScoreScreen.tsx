import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTrustScoreStore, TRUST_LEVELS } from "@/lib/trustScoreStore";
import { useI18n } from "@/lib/i18n";

import { AppIcon } from "@/components/icons/AppIcon";
const CircularProgress = ({ score, size, strokeWidth, color }: { score: number; size: number; strokeWidth: number; color: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center" }]}>
        <ThemedText style={styles.scoreValue}>{score}</ThemedText>
        <ThemedText style={styles.scoreLabel}>/ 100</ThemedText>
      </View>
    </View>
  );
};

export default function TrustScoreScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { language } = useI18n();
  const isBn = language === "bn";
  
  const { trustScore, trustFactors, isVerified, calculateScore, getTrustLevel, getScoreBreakdown } = useTrustScoreStore();
  
  React.useEffect(() => {
    calculateScore();
  }, []);

  const trustLevel = getTrustLevel();
  const breakdown = getScoreBreakdown();

  const getFactorName = (factor: typeof trustFactors[0]) => isBn ? factor.nameBn : factor.nameEn;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn}>
          <LinearGradient
            colors={[trustLevel.color, trustLevel.color + "CC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroContent}>
              <CircularProgress score={trustScore} size={160} strokeWidth={12} color="#FFF" />
              <View style={styles.levelInfo}>
                <View style={styles.levelBadge}>
                  <AppIcon name={trustLevel.icon as any} size={20} color="#FFF" />
                  <ThemedText style={styles.levelName}>
                    {isBn ? trustLevel.nameBn : trustLevel.nameEn}
                  </ThemedText>
                </View>
                {isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Feather name="check-circle" size={14} color="#2E96EF" />
                    <ThemedText style={styles.verifiedText}>
                      {isBn ? "পরিচয় যাচাইকৃত" : "Identity Verified"}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)}>
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              {isBn ? "স্কোর ব্রেকডাউন" : "Score Breakdown"}
            </ThemedText>
            {trustFactors.map((factor, index) => {
              const percentage = (factor.currentScore / factor.maxScore) * 100;
              return (
                <Animated.View key={factor.id} entering={FadeInUp.delay(150 + index * 50)}>
                  <View style={styles.factorItem}>
                    <View style={styles.factorHeader}>
                      <View style={[styles.factorIcon, { backgroundColor: theme.primary + "15" }]}>
                        <AppIcon name={factor.icon as any} size={18} color={theme.primary} />
                      </View>
                      <View style={styles.factorInfo}>
                        <ThemedText style={[styles.factorName, { color: theme.text }]}>
                          {getFactorName(factor)}
                        </ThemedText>
                        <ThemedText style={[styles.factorWeight, { color: theme.textSecondary }]}>
                          {isBn ? `গুরুত্ব: ${Math.round(factor.weight * 100)}%` : `Weight: ${Math.round(factor.weight * 100)}%`}
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.factorScore, { color: theme.primary }]}>
                        {factor.currentScore}/{factor.maxScore}
                      </ThemedText>
                    </View>
                    <View style={[styles.progressBar, { backgroundColor: theme.backgroundRoot }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${percentage}%`,
                            backgroundColor: percentage >= 80 ? "#2E96EF" : percentage >= 50 ? "#B25E09" : "#DA2F2F",
                          },
                        ]}
                      />
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300)}>
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              {isBn ? "ট্রাস্ট লেভেল" : "Trust Levels"}
            </ThemedText>
            {TRUST_LEVELS.map((level, index) => {
              const isCurrentLevel = level.id === trustLevel.id;
              const isUnlocked = trustScore >= level.minScore;
              return (
                <View
                  key={level.id}
                  style={[
                    styles.levelItem,
                    { backgroundColor: isCurrentLevel ? level.color + "15" : theme.backgroundRoot },
                    isCurrentLevel && { borderColor: level.color, borderWidth: 2 },
                  ]}
                >
                  <View style={[styles.levelIcon, { backgroundColor: level.color }]}>
                    <AppIcon name={level.icon as any} size={20} color="#FFF" />
                  </View>
                  <View style={styles.levelDetails}>
                    <ThemedText style={[styles.levelItemName, { color: theme.text }]}>
                      {isBn ? level.nameBn : level.nameEn}
                    </ThemedText>
                    <ThemedText style={[styles.levelRequirement, { color: theme.textSecondary }]}>
                      {level.minScore}+ {isBn ? "পয়েন্ট" : "points"}
                    </ThemedText>
                  </View>
                  {isUnlocked ? (
                    <Feather name="check-circle" size={20} color="#2E96EF" />
                  ) : (
                    <Feather name="lock" size={20} color={theme.textSecondary} />
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400)}>
          <View style={[styles.tipsCard, { backgroundColor: theme.primary + "10", borderColor: theme.primary }]}>
            <Feather name="info" size={20} color={theme.primary} />
            <View style={styles.tipsContent}>
              <ThemedText style={[styles.tipsTitle, { color: theme.text }]}>
                {isBn ? "স্কোর বাড়ানোর উপায়" : "How to Improve"}
              </ThemedText>
              <ThemedText style={[styles.tipsText, { color: theme.textSecondary }]}>
                {isBn
                  ? "• প্রোফাইল সম্পূর্ণ করুন\n• পরিচয় যাচাই করুন\n• সফল লেনদেন বাড়ান\n• দ্রুত রেসপন্স করুন"
                  : "• Complete your profile\n• Verify your identity\n• Increase successful transactions\n• Respond quickly to messages"}
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  heroContent: {
    alignItems: "center",
    gap: Spacing.lg,
  },
  scoreValue: {
    fontSize: 48,
    fontFamily: "DMSans_700Bold",
    color: "#FFF",
  },
  scoreLabel: {
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  levelInfo: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  levelName: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: "#FFF",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  verifiedText: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
    color: "#2E96EF",
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    marginBottom: Spacing.md,
  },
  factorItem: {
    marginBottom: Spacing.md,
  },
  factorHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  factorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  factorInfo: {
    flex: 1,
  },
  factorName: {
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
  },
  factorWeight: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
  },
  factorScore: {
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  levelItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  levelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  levelDetails: {
    flex: 1,
  },
  levelItemName: {
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
  },
  levelRequirement: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
  },
  tipsCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
    marginBottom: Spacing.xs,
  },
  tipsText: {
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    lineHeight: 20,
  },
});
