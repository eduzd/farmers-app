import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  category: "discount" | "product" | "service" | "premium";
  isAvailable: boolean;
  expiresIn?: string;
}

interface Activity {
  id: string;
  action: string;
  points: number;
  date: Date;
  type: "earn" | "redeem";
}

const USER_POINTS = 3500;
const USER_LEVEL = "সক্রিয় কৃষক";
const NEXT_LEVEL_POINTS = 5000;

const REWARDS: Reward[] = [
  { id: "1", title: "১০% ছাড় - বীজ ক্রয়ে", description: "যেকোনো বীজ কেনায় ১০% ছাড়", pointsCost: 500, category: "discount", isAvailable: true, expiresIn: "৭ দিন" },
  { id: "2", title: "ফ্রি ডেলিভারি", description: "পরবর্তী অর্ডারে বিনামূল্যে ডেলিভারি", pointsCost: 300, category: "service", isAvailable: true },
  { id: "3", title: "প্রিমিয়াম ১ মাস", description: "১ মাসের প্রিমিয়াম সদস্যতা", pointsCost: 2000, category: "premium", isAvailable: true },
  { id: "4", title: "বিশেষজ্ঞ কল - ৩০ মিনিট", description: "বিশেষজ্ঞের সাথে ভিডিও কল", pointsCost: 1000, category: "service", isAvailable: true },
  { id: "5", title: "সার প্যাকেট", description: "৫ কেজি জৈব সার", pointsCost: 1500, category: "product", isAvailable: false },
  { id: "6", title: "২০% ছাড় - যন্ত্রপাতি", description: "কৃষি যন্ত্রপাতি ভাড়ায় ২০% ছাড়", pointsCost: 800, category: "discount", isAvailable: true },
];

const ACTIVITIES: Activity[] = [
  { id: "1", action: "পোস্ট করেছেন", points: 10, date: new Date(Date.now() - 2 * 3600000), type: "earn" },
  { id: "2", action: "প্রশ্নের উত্তর দিয়েছেন", points: 25, date: new Date(Date.now() - 5 * 3600000), type: "earn" },
  { id: "3", action: "১০% ছাড় রিডিম করেছেন", points: -500, date: new Date(Date.now() - 1 * 24 * 3600000), type: "redeem" },
  { id: "4", action: "ভয়েস রুমে অংশ নিয়েছেন", points: 15, date: new Date(Date.now() - 1 * 24 * 3600000), type: "earn" },
  { id: "5", action: "নতুন ফলোয়ার পেয়েছেন", points: 5, date: new Date(Date.now() - 2 * 24 * 3600000), type: "earn" },
];

const EARN_METHODS = [
  { id: "1", action: "পোস্ট করুন", points: "+10", icon: "edit-3" as const },
  { id: "2", action: "প্রশ্নের উত্তর দিন", points: "+25", icon: "message-circle" as const },
  { id: "3", action: "ভয়েস রুমে অংশ নিন", points: "+15", icon: "radio" as const },
  { id: "4", action: "পণ্য রিভিউ দিন", points: "+20", icon: "star" as const },
  { id: "5", action: "বন্ধু আমন্ত্রণ করুন", points: "+100", icon: "user-plus" as const },
];

const getCategoryConfig = (category: string) => {
  const configs: Record<string, { color: string; icon: keyof typeof Feather.glyphMap }> = {
    discount: { color: "#2FA36B", icon: "percent" },
    product: { color: "#EA8A0C", icon: "package" },
    service: { color: "#2563EB", icon: "headphones" },
    premium: { color: "#7C3AED", icon: "award" },
  };
  return configs[category] || configs.discount;
};

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"rewards" | "earn" | "history">("rewards");

  const handleRedeem = (reward: Reward) => {
    if (USER_POINTS >= reward.pointsCost && reward.isAvailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const progressPercent = (USER_POINTS / NEXT_LEVEL_POINTS) * 100;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={[styles.pointsCard, { backgroundColor: theme.primary }]}>
          <View style={styles.pointsHeader}>
            <View>
              <ThemedText style={styles.pointsLabel}>আপনার পয়েন্ট</ThemedText>
              <ThemedText style={styles.pointsValue}>{USER_POINTS.toLocaleString()}</ThemedText>
            </View>
            <View style={styles.levelBadge}>
              <Feather name="award" size={20} color="#F5B700" />
              <ThemedText style={styles.levelText}>{USER_LEVEL}</ThemedText>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            <ThemedText style={styles.progressText}>
              পরবর্তী লেভেলে আরও {NEXT_LEVEL_POINTS - USER_POINTS} পয়েন্ট
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)} style={styles.tabsContainer}>
          {[
            { id: "rewards", label: "রিওয়ার্ড", icon: "gift" as const },
            { id: "earn", label: "পয়েন্ট আয়", icon: "plus-circle" as const },
            { id: "history", label: "ইতিহাস", icon: "clock" as const },
          ].map((tab) => (
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
              <Feather name={tab.icon} size={16} color={activeTab === tab.id ? "#fff" : theme.text} />
              <ThemedText style={[styles.tabText, { color: activeTab === tab.id ? "#fff" : theme.text }]}>
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </Animated.View>

        {activeTab === "rewards" ? (
          <View style={styles.rewardsGrid}>
            {REWARDS.map((reward, index) => {
              const config = getCategoryConfig(reward.category);
              const canRedeem = USER_POINTS >= reward.pointsCost && reward.isAvailable;
              return (
                <Animated.View key={reward.id} entering={FadeInUp.delay(150 + index * 50)}>
                  <Pressable
                    style={[
                      styles.rewardCard,
                      { backgroundColor: theme.card, borderColor: theme.cardBorder, opacity: reward.isAvailable ? 1 : 0.5 },
                    ]}
                    onPress={() => handleRedeem(reward)}
                  >
                    <View style={[styles.rewardIcon, { backgroundColor: config.color + "15" }]}>
                      <Feather name={config.icon} size={24} color={config.color} />
                    </View>
                    <ThemedText style={[styles.rewardTitle, { color: theme.text }]} numberOfLines={1}>
                      {reward.title}
                    </ThemedText>
                    <ThemedText style={[styles.rewardDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                      {reward.description}
                    </ThemedText>
                    <View style={styles.rewardFooter}>
                      <View style={styles.pointsCostContainer}>
                        <Feather name="star" size={14} color="#F5B700" />
                        <ThemedText style={[styles.pointsCost, { color: theme.text }]}>
                          {reward.pointsCost}
                        </ThemedText>
                      </View>
                      <Pressable
                        style={[styles.redeemButton, { backgroundColor: canRedeem ? theme.primary : theme.card }]}
                      >
                        <ThemedText style={[styles.redeemText, { color: canRedeem ? "#fff" : theme.textSecondary }]}>
                          {reward.isAvailable ? "রিডিম" : "শেষ"}
                        </ThemedText>
                      </Pressable>
                    </View>
                    {reward.expiresIn ? (
                      <View style={[styles.expiresBadge, { backgroundColor: "#EA8A0C20" }]}>
                        <ThemedText style={[styles.expiresText, { color: "#EA8A0C" }]}>
                          {reward.expiresIn} বাকি
                        </ThemedText>
                      </View>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        ) : activeTab === "earn" ? (
          <View style={styles.earnSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>পয়েন্ট আয় করুন</ThemedText>
            {EARN_METHODS.map((method, index) => (
              <Animated.View key={method.id} entering={FadeInUp.delay(150 + index * 50)}>
                <View style={[styles.earnItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={[styles.earnIcon, { backgroundColor: theme.primary + "15" }]}>
                    <Feather name={method.icon} size={20} color={theme.primary} />
                  </View>
                  <ThemedText style={[styles.earnAction, { color: theme.text }]}>{method.action}</ThemedText>
                  <View style={[styles.earnPoints, { backgroundColor: "#2FA36B15" }]}>
                    <ThemedText style={[styles.earnPointsText, { color: "#2FA36B" }]}>{method.points}</ThemedText>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        ) : (
          <View style={styles.historySection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>সাম্প্রতিক কার্যক্রম</ThemedText>
            {ACTIVITIES.map((activity, index) => (
              <Animated.View key={activity.id} entering={FadeInUp.delay(150 + index * 50)}>
                <View style={[styles.activityItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={[styles.activityIcon, { backgroundColor: activity.type === "earn" ? "#2FA36B15" : "#DC262615" }]}>
                    <Feather
                      name={activity.type === "earn" ? "plus" : "minus"}
                      size={16}
                      color={activity.type === "earn" ? "#2FA36B" : "#DC2626"}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <ThemedText style={[styles.activityAction, { color: theme.text }]}>{activity.action}</ThemedText>
                    <ThemedText style={[styles.activityDate, { color: theme.textSecondary }]}>
                      {activity.date.toLocaleDateString("bn-BD")}
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={[styles.activityPoints, { color: activity.type === "earn" ? "#2FA36B" : "#DC2626" }]}
                  >
                    {activity.type === "earn" ? "+" : ""}{activity.points}
                  </ThemedText>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  pointsCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  pointsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  pointsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  pointsValue: { color: "#fff", fontSize: 36, fontWeight: "700" },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  levelText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  progressContainer: { marginTop: Spacing.md },
  progressBar: { height: 6, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 3 },
  progressText: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: Spacing.xs },
  tabsContainer: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, gap: Spacing.xs },
  tabText: { fontSize: 13, fontWeight: "500" },
  rewardsGrid: { gap: Spacing.md },
  rewardCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, position: "relative" },
  rewardIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
  rewardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  rewardDescription: { fontSize: 12, marginBottom: Spacing.sm, lineHeight: 18 },
  rewardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pointsCostContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  pointsCost: { fontSize: 14, fontWeight: "600" },
  redeemButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  redeemText: { fontSize: 12, fontWeight: "600" },
  expiresBadge: { position: "absolute", top: Spacing.sm, right: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  expiresText: { fontSize: 10, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.md },
  earnSection: {},
  earnItem: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  earnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  earnAction: { flex: 1, fontSize: 14, marginLeft: Spacing.md },
  earnPoints: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  earnPointsText: { fontSize: 14, fontWeight: "700" },
  historySection: {},
  activityItem: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  activityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  activityInfo: { flex: 1, marginLeft: Spacing.md },
  activityAction: { fontSize: 14 },
  activityDate: { fontSize: 11, marginTop: 2 },
  activityPoints: { fontSize: 16, fontWeight: "700" },
});
