import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
interface DeliveryStep {
  id: string;
  title: string;
  description: string;
  time: string;
  completed: boolean;
  active: boolean;
  icon: string;
}

interface Order {
  id: string;
  orderId: string;
  productName: string;
  estimatedDelivery: string;
  currentStatus: string;
  driver?: {
    name: string;
    phone: string;
    vehicle: string;
  };
  steps: DeliveryStep[];
}



export default function DeliveryTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  // No live delivery tracking yet: show an honest empty state instead of a made-up order.
  const [order] = useState<Order | null>(null);

  const handleCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundRoot, alignItems: "center", justifyContent: "center", padding: Spacing.xl }}>
        <Feather name="truck" size={44} color={theme.textSecondary} />
        <ThemedText style={{ marginTop: Spacing.md, fontSize: 16, fontWeight: "600", textAlign: "center" }}>
          কোনো ডেলিভারি চলছে না
        </ThemedText>
        <ThemedText style={{ marginTop: Spacing.xs, color: theme.textSecondary, textAlign: "center" }}>
          অর্ডার পাঠানো হলে এখানে তার অবস্থা দেখা যাবে।
        </ThemedText>
      </View>
    );
  }

  const activeStep = order.steps.find((s) => s.active);
  const completedSteps = order.steps.filter((s) => s.completed).length;
  const progressPercent = (completedSteps / order.steps.length) * 100;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.orderCard, { backgroundColor: theme.card }]}>
        <View style={styles.orderHeader}>
          <View>
            <ThemedText style={[styles.orderIdLabel, { color: theme.textSecondary }]}>
              অর্ডার নম্বর
            </ThemedText>
            <ThemedText style={[styles.orderId, { color: theme.text }]}>
              {order.orderId}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: theme.primary + "15" }]}>
            <View style={[styles.statusDot, { backgroundColor: theme.primary }]} />
            <ThemedText style={[styles.statusText, { color: theme.primary }]}>
              {order.currentStatus}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.productName, { color: theme.text }]}>
          {order.productName}
        </ThemedText>

        <View style={styles.deliveryEstimate}>
          <Feather name="clock" size={16} color={theme.primary} />
          <ThemedText style={[styles.estimateText, { color: theme.text }]}>
            আনুমানিক ডেলিভারি: {order.estimatedDelivery}
          </ThemedText>
        </View>

        <View style={styles.progressContainer}>
          <View style={[styles.progressBg, { backgroundColor: theme.inputBorder }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: theme.primary, width: `${progressPercent}%` },
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
            {completedSteps}/{order.steps.length} ধাপ সম্পন্ন
          </ThemedText>
        </View>
      </View>

      {order.driver ? (
        <View style={[styles.driverCard, { backgroundColor: theme.card }]}>
          <View style={styles.driverHeader}>
            <View style={[styles.driverAvatar, { backgroundColor: theme.primary }]}>
              <Feather name="user" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.driverInfo}>
              <ThemedText style={[styles.driverLabel, { color: theme.textSecondary }]}>
                ডেলিভারি ড্রাইভার
              </ThemedText>
              <ThemedText style={[styles.driverName, { color: theme.text }]}>
                {order.driver.name}
              </ThemedText>
              <ThemedText style={[styles.vehicleText, { color: theme.textSecondary }]}>
                {order.driver.vehicle}
              </ThemedText>
            </View>
          </View>

          <View style={styles.driverActions}>
            <Pressable
              style={[styles.callDriverBtn, { backgroundColor: theme.primary }]}
              onPress={handleCall}
            >
              <Feather name="phone" size={18} color="#FFFFFF" />
              <ThemedText style={styles.callDriverText}>কল করুন</ThemedText>
            </Pressable>
            <Pressable style={[styles.messageDriverBtn, { borderColor: theme.inputBorder }]}>
              <ChatIcon size={18} color={theme.text} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[styles.timelineCard, { backgroundColor: theme.card }]}>
        <ThemedText style={[styles.timelineTitle, { color: theme.text }]}>
          ট্র্যাকিং টাইমলাইন
        </ThemedText>

        <View style={styles.timeline}>
          {order.steps.map((step, index) => {
            const isLast = index === order.steps.length - 1;

            return (
              <Animated.View
                key={step.id}
                entering={FadeIn.delay(index * 100)}
              >
                <View style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineIcon,
                        {
                          backgroundColor: step.completed
                            ? theme.primary
                            : step.active
                            ? theme.primary + "20"
                            : theme.inputBorder,
                          borderColor: step.active ? theme.primary : "transparent",
                        },
                      ]}
                    >
                      <AppIcon
                        name={step.icon as any}
                        size={16}
                        color={
                          step.completed
                            ? "#FFFFFF"
                            : step.active
                            ? theme.primary
                            : theme.textSecondary
                        }
                      />
                    </View>
                    {!isLast ? (
                      <View
                        style={[
                          styles.timelineLine,
                          {
                            backgroundColor: step.completed
                              ? theme.primary
                              : theme.inputBorder,
                          },
                        ]}
                      />
                    ) : null}
                  </View>

                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <ThemedText
                        style={[
                          styles.stepTitle,
                          {
                            color: step.completed || step.active
                              ? theme.text
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {step.title}
                      </ThemedText>
                      {step.time ? (
                        <ThemedText style={[styles.stepTime, { color: theme.textSecondary }]}>
                          {step.time}
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>
                      {step.description}
                    </ThemedText>

                    {step.active ? (
                      <View
                        style={[styles.activeBadge, { backgroundColor: theme.primary + "15" }]}
                      >
                        <View style={[styles.pulsingDot, { backgroundColor: theme.primary }]} />
                        <ThemedText style={[styles.activeText, { color: theme.primary }]}>
                          বর্তমান অবস্থা
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <View style={[styles.helpCard, { backgroundColor: theme.card }]}>
        <Feather name="help-circle" size={20} color={theme.primary} />
        <View style={styles.helpContent}>
          <ThemedText style={[styles.helpTitle, { color: theme.text }]}>
            সাহায্য দরকার?
          </ThemedText>
          <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
            ডেলিভারি সংক্রান্ত যেকোনো সমস্যায় আমাদের সাথে যোগাযোগ করুন
          </ThemedText>
        </View>
        <Pressable
          style={[styles.supportBtn, { backgroundColor: theme.primary + "15" }]}
        >
          <ThemedText style={[styles.supportBtnText, { color: theme.primary }]}>
            সাপোর্ট
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  orderCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  orderIdLabel: {
    fontSize: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  productName: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: Spacing.md,
  },
  deliveryEstimate: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  estimateText: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressContainer: {
    gap: Spacing.xs,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
  },
  driverCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  driverLabel: {
    fontSize: 12,
  },
  driverName: {
    fontSize: 17,
    fontWeight: "600",
  },
  vehicleText: {
    fontSize: 13,
    marginTop: 2,
  },
  driverActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  callDriverBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  callDriverText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  messageDriverBtn: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.lg,
  },
  timeline: {},
  timelineItem: {
    flexDirection: "row",
  },
  timelineLeft: {
    alignItems: "center",
    width: 40,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 40,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  stepTime: {
    fontSize: 12,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: 4,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  helpCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    ...Shadows.small,
  },
  helpContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  helpText: {
    fontSize: 12,
    marginTop: 2,
  },
  supportBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  supportBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
