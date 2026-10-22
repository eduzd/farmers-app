import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Alert,
  TextInput,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp, FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useReferralStore, REFERRAL_TIERS, REFERRAL_POINTS, Referral, ReferralTier } from "@/lib/referralStore";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { language } = useI18n();
  const isBn = language === "bn";
  const { user } = useAuthStore();
  
  const {
    referralCode,
    referrals,
    totalEarned,
    generateReferralCode,
    getCurrentTier,
    getNextTier,
    getReferralProgress,
    getLeaderboard,
  } = useReferralStore();

  const [activeTab, setActiveTab] = useState<"invite" | "rewards" | "leaderboard">("invite");
  const [showCodeCopied, setShowCodeCopied] = useState(false);

  useEffect(() => {
    if (user?.id && !referralCode) {
      generateReferralCode(user.id);
    }
  }, [user?.id, referralCode]);

  const currentTier = getCurrentTier();
  const nextTier = getNextTier();
  const progress = getReferralProgress();
  const completedReferrals = referrals.filter((r) => r.status === "completed").length;
  const leaderboard = getLeaderboard();

  const handleCopyCode = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(referralCode);
    setShowCodeCopied(true);
    setTimeout(() => setShowCodeCopied(false), 2000);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const message = isBn
        ? `আমার রেফারেল কোড ${referralCode} ব্যবহার করে সাইন আপ করুন এবং ${REFERRAL_POINTS.referred} পয়েন্ট পান! অ্যাপ ডাউনলোড করুন: https://farmers.app/invite/${referralCode}`
        : `Sign up with my referral code ${referralCode} and get ${REFERRAL_POINTS.referred} points! Download the app: https://farmers.app/invite/${referralCode}`;
      
      await Share.share({ message });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const getTierName = (tier: ReferralTier) => isBn ? tier.nameBn : tier.nameEn;

  const renderTierBadge = (tier: ReferralTier, size: "small" | "large" = "small") => {
    const iconSize = size === "large" ? 24 : 16;
    const padding = size === "large" ? Spacing.md : Spacing.sm;
    
    return (
      <View style={[styles.tierBadge, { backgroundColor: tier.badgeColor + "20", padding }]}>
        <AppIcon name={tier.icon as any} size={iconSize} color={tier.badgeColor} />
        <ThemedText style={[styles.tierBadgeText, { color: tier.badgeColor, fontSize: size === "large" ? 14 : 12 }]}>
          {getTierName(tier)}
        </ThemedText>
      </View>
    );
  };

  const renderReferralItem = ({ item, index }: { item: Referral; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <View style={[styles.referralItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <UserAvatar initials={item.referredUserInitials} size="small" />
        <View style={styles.referralInfo}>
          <ThemedText style={[styles.referralName, { color: theme.text }]}>
            {item.referredUserName}
          </ThemedText>
          <ThemedText style={[styles.referralDate, { color: theme.textSecondary }]}>
            {new Date(item.referredAt).toLocaleDateString(isBn ? "bn-BD" : "en-US")}
          </ThemedText>
        </View>
        <View style={[styles.pointsBadge, { backgroundColor: item.status === "completed" ? "#2FA36B" : theme.primary }]}>
          <ThemedText style={styles.pointsBadgeText}>
            +{item.pointsEarned}
          </ThemedText>
        </View>
      </View>
    </Animated.View>
  );

  const renderLeaderboardItem = ({ item, index }: { item: ReturnType<typeof getLeaderboard>[0]; index: number }) => {
    const isTop3 = index < 3;
    const rankColors = ["#F5B700", "#C0C0C0", "#CD7F32"];
    
    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <View style={[
          styles.leaderboardItem,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
          isTop3 && { borderLeftWidth: 3, borderLeftColor: rankColors[index] }
        ]}>
          <View style={[styles.rankBadge, { backgroundColor: isTop3 ? rankColors[index] : theme.backgroundRoot }]}>
            <ThemedText style={[styles.rankText, { color: isTop3 ? "#FFF" : theme.text }]}>
              {index + 1}
            </ThemedText>
          </View>
          <View style={styles.leaderboardInfo}>
            <ThemedText style={[styles.leaderboardName, { color: theme.text }]}>
              {item.name}
            </ThemedText>
            {renderTierBadge(item.tier)}
          </View>
          <View style={styles.leaderboardStats}>
            <ThemedText style={[styles.leaderboardCount, { color: theme.primary }]}>
              {item.count}
            </ThemedText>
            <ThemedText style={[styles.leaderboardLabel, { color: theme.textSecondary }]}>
              {isBn ? "রেফারেল" : "referrals"}
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn}>
          <LinearGradient
            colors={[theme.primary, "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroHeader}>
              <View>
                <ThemedText style={styles.heroTitle}>
                  {isBn ? "বন্ধুদের আমন্ত্রণ করুন" : "Invite Friends"}
                </ThemedText>
                <ThemedText style={styles.heroSubtitle}>
                  {isBn
                    ? `প্রতিটি রেফারেলে ${REFERRAL_POINTS.referrer} পয়েন্ট পান`
                    : `Earn ${REFERRAL_POINTS.referrer} points per referral`}
                </ThemedText>
              </View>
              <View style={styles.heroStats}>
                <ThemedText style={styles.heroStatsValue}>{completedReferrals}</ThemedText>
                <ThemedText style={styles.heroStatsLabel}>
                  {isBn ? "রেফারেল" : "Referrals"}
                </ThemedText>
              </View>
            </View>

            <View style={styles.codeContainer}>
              <View style={styles.codeBox}>
                <ThemedText style={styles.codeLabel}>
                  {isBn ? "আপনার কোড" : "Your Code"}
                </ThemedText>
                <ThemedText style={styles.codeText}>{referralCode}</ThemedText>
              </View>
              <View style={styles.codeActions}>
                <Pressable style={styles.codeButton} onPress={handleCopyCode}>
                  <AppIcon name={showCodeCopied ? "check" : "copy"} size={20} color="#FFF" />
                </Pressable>
                <Pressable style={styles.codeButton} onPress={handleShare}>
                  <Feather name="share-2" size={20} color="#FFF" />
                </Pressable>
              </View>
            </View>

            <View style={styles.tierProgress}>
              <View style={styles.tierRow}>
                {renderTierBadge(currentTier, "large")}
                {nextTier ? (
                  <>
                    <View style={styles.tierArrow}>
                      <Feather name="arrow-right" size={16} color="rgba(255,255,255,0.5)" />
                    </View>
                    {renderTierBadge(nextTier)}
                  </>
                ) : null}
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <Animated.View
                    entering={FadeIn.delay(300)}
                    style={[styles.progressFill, { width: `${progress.percentage}%` }]}
                  />
                </View>
                <ThemedText style={styles.progressText}>
                  {progress.current}/{progress.next}
                </ThemedText>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.tabContainer}>
          {[
            { id: "invite", labelBn: "আমন্ত্রণ", labelEn: "Invite", icon: "user-plus" },
            { id: "rewards", labelBn: "পুরস্কার", labelEn: "Rewards", icon: "gift" },
            { id: "leaderboard", labelBn: "লিডারবোর্ড", labelEn: "Leaderboard", icon: "bar-chart-2" },
          ].map((tab) => (
            <Pressable
              key={tab.id}
              style={[
                styles.tab,
                { backgroundColor: activeTab === tab.id ? theme.primary : theme.card },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id as any);
              }}
            >
              <AppIcon
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.id ? "#FFF" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  { color: activeTab === tab.id ? "#FFF" : theme.text },
                ]}
              >
                {isBn ? tab.labelBn : tab.labelEn}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {activeTab === "invite" && (
          <Animated.View entering={FadeInUp}>
            <View style={[styles.howItWorks, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                {isBn ? "কীভাবে কাজ করে" : "How It Works"}
              </ThemedText>
              {[
                { step: 1, textBn: "আপনার রেফারেল কোড শেয়ার করুন", textEn: "Share your referral code", icon: "share" },
                { step: 2, textBn: "বন্ধু সাইন আপ করলে আপনি পয়েন্ট পাবেন", textEn: "Friend signs up, you get points", icon: "user-check" },
                { step: 3, textBn: "বেশি রেফারেল = উচ্চতর টায়ার", textEn: "More referrals = higher tier", icon: "trending-up" },
              ].map((item) => (
                <View key={item.step} style={styles.stepItem}>
                  <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.stepNumberText}>{item.step}</ThemedText>
                  </View>
                  <AppIcon name={item.icon as any} size={20} color={theme.primary} style={styles.stepIcon} />
                  <ThemedText style={[styles.stepText, { color: theme.text }]}>
                    {isBn ? item.textBn : item.textEn}
                  </ThemedText>
                </View>
              ))}
            </View>

            <Pressable
              style={[styles.shareButton, { backgroundColor: theme.primary }]}
              onPress={handleShare}
            >
              <Feather name="share-2" size={20} color="#FFF" />
              <ThemedText style={styles.shareButtonText}>
                {isBn ? "এখনই শেয়ার করুন" : "Share Now"}
              </ThemedText>
            </Pressable>

            {referrals.length > 0 ? (
              <View style={styles.referralsSection}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  {isBn ? "আপনার রেফারেল" : "Your Referrals"} ({referrals.length})
                </ThemedText>
                <FlatList
                  data={referrals}
                  renderItem={renderReferralItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            ) : null}
          </Animated.View>
        )}

        {activeTab === "rewards" && (
          <Animated.View entering={FadeInUp}>
            <View style={[styles.rewardsCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                {isBn ? "টায়ার পুরস্কার" : "Tier Rewards"}
              </ThemedText>
              {REFERRAL_TIERS.slice(1).map((tier, index) => {
                const isUnlocked = completedReferrals >= tier.minReferrals;
                return (
                  <View
                    key={tier.id}
                    style={[
                      styles.tierItem,
                      { backgroundColor: isUnlocked ? tier.badgeColor + "15" : theme.backgroundRoot },
                      isUnlocked && { borderColor: tier.badgeColor, borderWidth: 1 },
                    ]}
                  >
                    <View style={[styles.tierIcon, { backgroundColor: tier.badgeColor }]}>
                      <AppIcon name={tier.icon as any} size={20} color="#FFF" />
                    </View>
                    <View style={styles.tierInfo}>
                      <ThemedText style={[styles.tierName, { color: theme.text }]}>
                        {getTierName(tier)}
                      </ThemedText>
                      <ThemedText style={[styles.tierRequirement, { color: theme.textSecondary }]}>
                        {tier.minReferrals} {isBn ? "রেফারেল" : "referrals"}
                      </ThemedText>
                    </View>
                    <View style={styles.tierReward}>
                      <ThemedText style={[styles.tierBonus, { color: tier.badgeColor }]}>
                        +{tier.bonusPoints}
                      </ThemedText>
                      <ThemedText style={[styles.tierBonusLabel, { color: theme.textSecondary }]}>
                        {isBn ? "বোনাস" : "bonus"}
                      </ThemedText>
                    </View>
                    {isUnlocked ? (
                      <Feather name="check-circle" size={20} color="#2FA36B" />
                    ) : (
                      <Feather name="lock" size={20} color={theme.textSecondary} />
                    )}
                  </View>
                );
              })}
            </View>

            <View style={[styles.totalEarned, { backgroundColor: theme.primary }]}>
              <Feather name="award" size={24} color="#FFF" />
              <View style={styles.totalEarnedInfo}>
                <ThemedText style={styles.totalEarnedLabel}>
                  {isBn ? "মোট অর্জিত পয়েন্ট" : "Total Points Earned"}
                </ThemedText>
                <ThemedText style={styles.totalEarnedValue}>{totalEarned}</ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        {activeTab === "leaderboard" && (
          <Animated.View entering={FadeInUp}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text, marginBottom: Spacing.md }]}>
              {isBn ? "টপ রেফারার" : "Top Referrers"}
            </ThemedText>
            <FlatList
              data={leaderboard}
              ListEmptyComponent={<EmptyState icon="bar-chart-2" title="এখনও কোনো র‍্যাংকিং নেই" message="বন্ধুরা আপনার রেফারেল কোডে যোগ দিলে এখানে দেখা যাবে।" />}
              renderItem={renderLeaderboardItem}
              keyExtractor={(item) => item.userId}
              scrollEnabled={false}
            />
          </Animated.View>
        )}
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
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  heroStats: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  heroStatsValue: {
    fontSize: 28,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
  },
  heroStatsLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  codeBox: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  codeText: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
    letterSpacing: 2,
  },
  codeActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  codeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  tierProgress: {
    gap: Spacing.sm,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tierArrow: {
    marginHorizontal: Spacing.xs,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  tierBadgeText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F5B700",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#FFF",
  },
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  howItWorks: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: Spacing.md,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
  },
  stepIcon: {
    marginRight: Spacing.sm,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
  },
  referralsSection: {
    marginTop: Spacing.md,
  },
  referralItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  referralInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  referralName: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  referralDate: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  pointsBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  pointsBadgeText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
  },
  rewardsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  tierItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  tierIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  tierRequirement: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  tierReward: {
    alignItems: "center",
    marginRight: Spacing.md,
  },
  tierBonus: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  tierBonusLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  totalEarned: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  totalEarnedInfo: {
    flex: 1,
  },
  totalEarnedLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  totalEarnedValue: {
    fontSize: 28,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  rankText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  leaderboardInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  leaderboardName: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  leaderboardStats: {
    alignItems: "center",
  },
  leaderboardCount: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  leaderboardLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_400Regular",
  },
});
