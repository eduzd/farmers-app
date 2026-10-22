import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useGroupBuyStore, GroupBuyDeal } from "@/lib/groupBuyStore";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";

const CountdownTimer = ({ endsAt, theme }: { endsAt: number; theme: any }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, endsAt - now);
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      setTimeLeft({ days, hours, minutes });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <View style={styles.timer}>
      <Feather name="clock" size={14} color={theme.textSecondary} />
      <ThemedText style={[styles.timerText, { color: theme.textSecondary }]}>
        {timeLeft.days > 0 ? `${timeLeft.days}দ ` : ""}
        {timeLeft.hours}ঘ {timeLeft.minutes}মি
      </ThemedText>
    </View>
  );
};

export default function GroupBuyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { language } = useI18n();
  const isBn = language === "bn";
  const { user } = useAuthStore();
  
  const { deals, getActiveDeals, joinDeal, getUserDeals } = useGroupBuyStore();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "my">("active");

  const activeDeals = getActiveDeals();
  const myDeals = user?.id ? getUserDeals(user.id) : [];
  const displayDeals = activeTab === "active" ? activeDeals : myDeals;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleJoinDeal = (deal: GroupBuyDeal) => {
    if (!user?.id) {
      Alert.alert(isBn ? "লগইন করুন" : "Login Required", isBn ? "গ্রুপ বাইতে যোগ দিতে লগইন করুন" : "Please login to join group buy");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      isBn ? "গ্রুপ বাইতে যোগ দিন" : "Join Group Buy",
      isBn
        ? `${deal.productName}\n\nদাম: ${deal.currency}${deal.groupPrice}/${deal.unit} (${deal.discountPercent}% ছাড়)\n\nআপনি কত কিনতে চান?`
        : `${deal.productName}\n\nPrice: ${deal.currency}${deal.groupPrice}/${deal.unit} (${deal.discountPercent}% off)\n\nHow much would you like to buy?`,
      [
        { text: isBn ? "বাতিল" : "Cancel", style: "cancel" },
        {
          text: isBn ? "যোগ দিন" : "Join",
          onPress: () => {
            const success = joinDeal(deal.id, {
              userId: user.id,
              userName: user.name,
              userInitials: user.initials,
              quantity: 10,
            });
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(isBn ? "সফল!" : "Success!", isBn ? "আপনি গ্রুপ বাইতে যোগ দিয়েছেন" : "You have joined the group buy");
            } else {
              Alert.alert(isBn ? "ব্যর্থ" : "Failed", isBn ? "যোগ দেওয়া সম্ভব হয়নি" : "Could not join the group buy");
            }
          },
        },
      ]
    );
  };

  const renderDeal = ({ item: deal, index }: { item: GroupBuyDeal; index: number }) => {
    const progress = (deal.currentParticipants / deal.minParticipants) * 100;
    const isSuccess = deal.status === "success";
    const isFailed = deal.status === "failed";
    const hasJoined = deal.participants.some((p) => p.userId === user?.id);

    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <Pressable
          style={[styles.dealCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={() => handleJoinDeal(deal)}
        >
          <Image source={{ uri: deal.productImage }} style={styles.dealImage} contentFit="cover" />
          
          {isSuccess ? (
            <View style={[styles.statusBadge, { backgroundColor: "#2FA36B" }]}>
              <Feather name="check" size={12} color="#FFF" />
              <ThemedText style={styles.statusText}>{isBn ? "সফল" : "Success"}</ThemedText>
            </View>
          ) : isFailed ? (
            <View style={[styles.statusBadge, { backgroundColor: "#DC2626" }]}>
              <Feather name="x" size={12} color="#FFF" />
              <ThemedText style={styles.statusText}>{isBn ? "ব্যর্থ" : "Failed"}</ThemedText>
            </View>
          ) : hasJoined ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.primary }]}>
              <Feather name="check-circle" size={12} color="#FFF" />
              <ThemedText style={styles.statusText}>{isBn ? "যোগ দিয়েছেন" : "Joined"}</ThemedText>
            </View>
          ) : null}

          <View style={styles.dealContent}>
            <ThemedText style={[styles.dealName, { color: theme.text }]} numberOfLines={2}>
              {deal.productName}
            </ThemedText>
            
            <View style={styles.sellerRow}>
              <ThemedText style={[styles.sellerName, { color: theme.textSecondary }]}>
                {deal.sellerName}
              </ThemedText>
            </View>

            <View style={styles.priceRow}>
              <View style={styles.priceInfo}>
                <ThemedText style={[styles.groupPrice, { color: theme.primary }]}>
                  {deal.currency}{deal.groupPrice}
                </ThemedText>
                <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>
                  {deal.currency}{deal.originalPrice}
                </ThemedText>
              </View>
              <View style={[styles.discountBadge, { backgroundColor: "#2FA36B" }]}>
                <ThemedText style={styles.discountText}>-{deal.discountPercent}%</ThemedText>
              </View>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <ThemedText style={[styles.progressLabel, { color: theme.textSecondary }]}>
                  {deal.currentParticipants}/{deal.minParticipants} {isBn ? "জন" : "people"}
                </ThemedText>
                {!isSuccess && !isFailed ? (
                  <CountdownTimer endsAt={deal.endsAt} theme={theme} />
                ) : null}
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.backgroundRoot }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, progress)}%`,
                      backgroundColor: progress >= 100 ? "#2FA36B" : theme.primary,
                    },
                  ]}
                />
              </View>
              {progress < 100 ? (
                <ThemedText style={[styles.progressHint, { color: theme.textSecondary }]}>
                  {isBn
                    ? `আরো ${deal.minParticipants - deal.currentParticipants} জন দরকার`
                    : `${deal.minParticipants - deal.currentParticipants} more needed`}
                </ThemedText>
              ) : null}
            </View>

            {deal.participants.length > 0 ? (
              <View style={styles.participantsRow}>
                <View style={styles.avatarStack}>
                  {deal.participants.slice(0, 4).map((p, i) => (
                    <View key={p.userId} style={[styles.stackedAvatar, { marginLeft: i > 0 ? -8 : 0 }]}>
                      <UserAvatar initials={p.userInitials} size="small" />
                    </View>
                  ))}
                </View>
                {deal.participants.length > 4 ? (
                  <ThemedText style={[styles.moreCount, { color: theme.textSecondary }]}>
                    +{deal.participants.length - 4}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}

            {!isSuccess && !isFailed && !hasJoined ? (
              <Pressable
                style={[styles.joinButton, { backgroundColor: theme.primary }]}
                onPress={() => handleJoinDeal(deal)}
              >
                <Feather name="users" size={16} color="#FFF" />
                <ThemedText style={styles.joinButtonText}>
                  {isBn ? "যোগ দিন" : "Join Now"}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.tabContainer}>
        {[
          { id: "active", labelBn: "সক্রিয় ডিল", labelEn: "Active Deals", icon: "zap" },
          { id: "my", labelBn: "আমার ডিল", labelEn: "My Deals", icon: "shopping-cart" },
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
            <Feather
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.id ? "#FFF" : theme.textSecondary}
            />
            <ThemedText
              style={[styles.tabText, { color: activeTab === tab.id ? "#FFF" : theme.text }]}
            >
              {isBn ? tab.labelBn : tab.labelEn}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <Animated.View entering={FadeIn} style={[styles.infoBanner, { backgroundColor: theme.primary + "15" }]}>
        <Feather name="info" size={18} color={theme.primary} />
        <ThemedText style={[styles.infoText, { color: theme.text }]}>
          {isBn
            ? "একসাথে কিনলে কম দামে পাবেন! নির্দিষ্ট সংখ্যক মানুষ জয়েন করলেই ডিল সফল হবে।"
            : "Buy together, save more! Deal succeeds when minimum participants join."}
        </ThemedText>
      </Animated.View>

      <FlatList
        data={displayDeals}
        renderItem={renderDeal}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {activeTab === "active"
                ? isBn ? "কোনো সক্রিয় গ্রুপ বাই নেই" : "No active group buys"
                : isBn ? "আপনি কোনো গ্রুপ বাইতে যোগ দেননি" : "You haven't joined any group buys"}
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 18,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  dealCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  dealImage: {
    width: "100%",
    height: 160,
  },
  statusBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#FFF",
  },
  dealContent: {
    padding: Spacing.md,
  },
  dealName: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: Spacing.xs,
  },
  sellerRow: {
    marginBottom: Spacing.sm,
  },
  sellerName: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  priceInfo: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
  },
  groupPrice: {
    fontSize: 22,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  originalPrice: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    textDecorationLine: "line-through",
  },
  discountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  discountText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
  },
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timerText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 4,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarStack: {
    flexDirection: "row",
  },
  stackedAvatar: {
    borderWidth: 2,
    borderColor: "#FFF",
    borderRadius: 12,
  },
  moreCount: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    marginLeft: Spacing.sm,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  joinButtonText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFF",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
