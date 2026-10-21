import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useSubscriptionStore, Subscription, FREQUENCY_OPTIONS } from "@/lib/subscriptionStore";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";

const getStatusConfig = (status: Subscription["status"]) => {
  const configs: Record<string, { color: string; labelBn: string; labelEn: string; icon: string }> = {
    active: { color: "#2FA36B", labelBn: "সক্রিয়", labelEn: "Active", icon: "check-circle" },
    paused: { color: "#EA8A0C", labelBn: "বিরতি", labelEn: "Paused", icon: "pause-circle" },
    cancelled: { color: "#9E9E9E", labelBn: "বাতিল", labelEn: "Cancelled", icon: "x-circle" },
  };
  return configs[status] || configs.active;
};

export default function SubscriptionsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { language } = useI18n();
  const isBn = language === "bn";
  const { user } = useAuthStore();
  
  const { subscriptions, pauseSubscription, resumeSubscription, cancelSubscription, skipNextDelivery, getUserSubscriptions } = useSubscriptionStore();
  const [activeTab, setActiveTab] = useState<"active" | "all">("active");

  const userSubs = user?.id ? getUserSubscriptions(user.id) : subscriptions;
  const displaySubs = activeTab === "active" ? userSubs.filter((s) => s.status === "active") : userSubs;

  const handlePause = (sub: Subscription) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      isBn ? "সাবস্ক্রিপশন বিরতি" : "Pause Subscription",
      isBn ? "আপনি কি এই সাবস্ক্রিপশন বিরতি দিতে চান?" : "Do you want to pause this subscription?",
      [
        { text: isBn ? "না" : "No", style: "cancel" },
        {
          text: isBn ? "হ্যাঁ" : "Yes",
          onPress: () => {
            pauseSubscription(sub.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleResume = (sub: Subscription) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resumeSubscription(sub.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCancel = (sub: Subscription) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      isBn ? "সাবস্ক্রিপশন বাতিল" : "Cancel Subscription",
      isBn ? "আপনি কি এই সাবস্ক্রিপশন বাতিল করতে চান?" : "Are you sure you want to cancel this subscription?",
      [
        { text: isBn ? "না" : "No", style: "cancel" },
        {
          text: isBn ? "হ্যাঁ, বাতিল করুন" : "Yes, Cancel",
          style: "destructive",
          onPress: () => {
            cancelSubscription(sub.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleSkip = (sub: Subscription) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      isBn ? "পরের ডেলিভারি স্কিপ" : "Skip Next Delivery",
      isBn ? "পরের ডেলিভারি স্কিপ করবেন?" : "Skip the next scheduled delivery?",
      [
        { text: isBn ? "না" : "No", style: "cancel" },
        {
          text: isBn ? "স্কিপ করুন" : "Skip",
          onPress: () => {
            skipNextDelivery(sub.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const renderSubscription = ({ item: sub, index }: { item: Subscription; index: number }) => {
    const statusConfig = getStatusConfig(sub.status);
    const frequencyLabel = FREQUENCY_OPTIONS.find((f) => f.id === sub.frequency);
    const daysUntilDelivery = Math.ceil((sub.nextDelivery - Date.now()) / (24 * 3600000));

    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <View style={[styles.subCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View>
              <ThemedText style={[styles.sellerName, { color: theme.text }]}>
                {sub.sellerName}
              </ThemedText>
              <ThemedText style={[styles.frequency, { color: theme.textSecondary }]}>
                {isBn ? frequencyLabel?.labelBn : frequencyLabel?.labelEn}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + "20" }]}>
              <Feather name={statusConfig.icon as any} size={12} color={statusConfig.color} />
              <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                {isBn ? statusConfig.labelBn : statusConfig.labelEn}
              </ThemedText>
            </View>
          </View>

          <View style={styles.itemsList}>
            {sub.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Image source={{ uri: item.productImage }} style={styles.itemImage} contentFit="cover" />
                <View style={styles.itemInfo}>
                  <ThemedText style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.productName}
                  </ThemedText>
                  <ThemedText style={[styles.itemQty, { color: theme.textSecondary }]}>
                    {item.quantity} {item.unit} x {item.currency}{item.pricePerUnit}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.totalRow, { borderTopColor: theme.cardBorder }]}>
            <View>
              <ThemedText style={[styles.totalLabel, { color: theme.textSecondary }]}>
                {isBn ? "মোট" : "Total"} ({sub.discountPercent}% {isBn ? "ছাড়" : "off"})
              </ThemedText>
              <ThemedText style={[styles.totalAmount, { color: theme.primary }]}>
                ৳{sub.totalAmount}
              </ThemedText>
            </View>
            {sub.status === "active" ? (
              <View style={styles.nextDelivery}>
                <Feather name="truck" size={14} color={theme.primary} />
                <ThemedText style={[styles.nextDeliveryText, { color: theme.text }]}>
                  {daysUntilDelivery > 0
                    ? isBn ? `${daysUntilDelivery} দিন পরে` : `in ${daysUntilDelivery} days`
                    : isBn ? "আজ" : "Today"}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                {sub.deliveryCount} {isBn ? "বার ডেলিভারি" : "deliveries"}
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                {new Date(sub.startDate).toLocaleDateString(isBn ? "bn-BD" : "en-US")} {isBn ? "থেকে" : "since"}
              </ThemedText>
            </View>
          </View>

          {sub.status !== "cancelled" ? (
            <View style={styles.actionsRow}>
              {sub.status === "active" ? (
                <>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
                    onPress={() => handleSkip(sub)}
                  >
                    <Feather name="skip-forward" size={16} color={theme.primary} />
                    <ThemedText style={[styles.actionText, { color: theme.text }]}>
                      {isBn ? "স্কিপ" : "Skip"}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
                    onPress={() => handlePause(sub)}
                  >
                    <Feather name="pause" size={16} color="#EA8A0C" />
                    <ThemedText style={[styles.actionText, { color: theme.text }]}>
                      {isBn ? "বিরতি" : "Pause"}
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
                  onPress={() => handleResume(sub)}
                >
                  <Feather name="play" size={16} color={theme.primary} />
                  <ThemedText style={[styles.actionText, { color: theme.primary }]}>
                    {isBn ? "চালু করুন" : "Resume"}
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                style={[styles.actionButton, { backgroundColor: "#DC262615" }]}
                onPress={() => handleCancel(sub)}
              >
                <Feather name="x" size={16} color="#DC2626" />
                <ThemedText style={[styles.actionText, { color: "#DC2626" }]}>
                  {isBn ? "বাতিল" : "Cancel"}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.tabContainer}>
        {[
          { id: "active", labelBn: "সক্রিয়", labelEn: "Active", icon: "check-circle" },
          { id: "all", labelBn: "সব", labelEn: "All", icon: "list" },
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

      <FlatList
        data={displaySubs}
        renderItem={renderSubscription}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <Feather name="repeat" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              {isBn ? "কোনো সাবস্ক্রিপশন নেই" : "No Subscriptions"}
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isBn
                ? "নিয়মিত পণ্য পেতে সাবস্ক্রাইব করুন এবং সাশ্রয় করুন!"
                : "Subscribe to products for regular delivery and save!"}
            </ThemedText>
          </Animated.View>
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
  },
  tabText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  list: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  subCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  sellerName: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  frequency: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  statusBadge: {
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
  },
  itemsList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  itemQty: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    marginBottom: Spacing.md,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  nextDelivery: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  nextDeliveryText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
