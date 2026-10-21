import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  interpolate,
  Easing,
  withSequence,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOrdersStore, Order, OrderStatus } from "@/lib/ordersStore";

import { tr, useTr } from "@/lib/tr";
type OrderDetailRouteProp = RouteProp<RootStackParamList, "OrderDetail">;

const TRACKING_STEPS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: "pending", label: "Order Placed", icon: "file-text" },
  { status: "confirmed", label: "Confirmed", icon: "check-circle" },
  { status: "processing", label: "Processing", icon: "package" },
  { status: "shipped", label: "Shipped", icon: "truck" },
  { status: "delivered", label: "Delivered", icon: "check" },
];

const STATUS_ORDER: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

interface AnimatedStepProps {
  step: { status: OrderStatus; label: string; icon: string };
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLast: boolean;
  currentStepIndex: number;
  theme: any;
  estimatedDelivery?: string;
}

function AnimatedTrackingStep({
  step,
  index,
  isCompleted,
  isCurrent,
  isLast,
  currentStepIndex,
  theme,
  estimatedDelivery,
}: AnimatedStepProps) {
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(0);
  const lineHeight = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    const baseDelay = index * 200;
    
    opacity.value = withDelay(
      baseDelay,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      baseDelay,
      withSpring(0, { damping: 14, stiffness: 120 })
    );
    
    if (!isLast) {
      lineHeight.value = withDelay(
        baseDelay + 250,
        withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
      );
    }
    
    if (isCurrent) {
      pulseScale.value = withDelay(
        baseDelay + 400,
        withSequence(
          withSpring(1.2, { damping: 6, stiffness: 150 }),
          withSpring(1, { damping: 10, stiffness: 200 })
        )
      );
    }
  }, [index, isCurrent, isLast]);

  const stepAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const circleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const lineAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: lineHeight.value }],
    opacity: lineHeight.value,
  }));

  return (
    <Animated.View style={[styles.trackingStep, stepAnimatedStyle]}>
      <View style={styles.stepIndicator}>
        <Animated.View
          style={[
            styles.stepCircle,
            {
              backgroundColor: isCompleted ? theme.primary : theme.backgroundDefault,
              borderColor: isCompleted ? theme.primary : theme.inputBorder,
            },
            circleAnimatedStyle,
          ]}
        >
          <Feather
            name={step.icon as any}
            size={16}
            color={isCompleted ? theme.white : theme.textSecondary}
          />
        </Animated.View>
        {!isLast ? (
          <Animated.View
            style={[
              styles.stepLine,
              {
                backgroundColor: index < currentStepIndex ? theme.primary : theme.inputBorder,
              },
              lineAnimatedStyle,
            ]}
          />
        ) : null}
      </View>
      <View style={styles.stepContent}>
        <ThemedText
          style={[
            styles.stepLabel,
            {
              color: isCompleted ? theme.text : theme.textSecondary,
              fontWeight: isCurrent ? "600" : "400",
            },
          ]}
        >
          {step.label}
        </ThemedText>
        {isCurrent && estimatedDelivery ? (
          <ThemedText style={[styles.estimatedDate, { color: theme.primary }]}>
            Est. {estimatedDelivery}
          </ThemedText>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function OrderDetailScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<OrderDetailRouteProp>();
  const { orderId } = route.params;
  const { getOrderById, updateOrderStatus } = useOrdersStore();
  
  const [order, setOrder] = useState<Order | undefined>(getOrderById(orderId));

  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setOrder(getOrderById(orderId));
    // refresh from the server so status changes by the other side show up
    const st = useOrdersStore.getState();
    Promise.all([st.loadOrders(), st.loadSales()]).then(() => setOrder(useOrdersStore.getState().getOrderById(orderId)));
  }, [orderId]);

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>{tr("Order not found")}</ThemedText>
      </View>
    );
  }

  const getCurrentStepIndex = () => {
    if (order.status === "cancelled") return -1;
    return STATUS_ORDER.indexOf(order.status);
  };

  const currentStep = getCurrentStepIndex();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const changeStatus = async (status: OrderStatus) => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      await updateOrderStatus(order.id, status);
      setOrder(getOrderById(order.id) || { ...order, status });
    } catch (e: any) {
      Alert.alert(tr("Couldn't update the order"), e?.message || "");
    } finally {
      setBusy(false);
    }
  };
  const handleCancelOrder = () => changeStatus("cancelled");
  const isSellerView = order.role === "seller";
  const SELLER_NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
    pending: ["confirmed"],
    confirmed: ["processing", "shipped"],
    processing: ["shipped"],
    shipped: ["delivered"],
  };
  const sellerLabel: Record<string, string> = {
    confirmed: tr("Confirm order"),
    processing: tr("Mark as processing"),
    shipped: tr("Mark as shipped"),
    delivered: tr("Mark as delivered"),
  };
  const buyerCanCancel = order.onServer ? order.status === "pending" : order.status !== "cancelled" && order.status !== "delivered";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, { backgroundColor: theme.white }]}>
        <View style={styles.orderInfo}>
          <View>
            <ThemedText style={[styles.orderId, { color: theme.text }]}>
              {order.id}
            </ThemedText>
            <ThemedText style={[styles.orderDate, { color: theme.textSecondary }]}>
              {formatDate(order.createdAt)}
            </ThemedText>
          </View>
          {order.trackingNumber ? (
            <View style={[styles.trackingBadge, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="hash" size={14} color={theme.primary} />
              <ThemedText style={[styles.trackingNumber, { color: theme.primary }]}>
                {order.trackingNumber}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {order.status === "cancelled" ? (
          <View style={[styles.cancelledBanner, { backgroundColor: "#DC262615" }]}>
            <Feather name="x-circle" size={20} color="#DC2626" />
            <ThemedText style={[styles.cancelledText, { color: "#DC2626" }]}>
              {tr("This order has been cancelled")}
            </ThemedText>
          </View>
        ) : (
          <>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
              {tr("Order Tracking")}
            </ThemedText>
            
            <View style={styles.trackingSteps}>
              {TRACKING_STEPS.map((step, index) => {
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;
                
                return (
                  <AnimatedTrackingStep
                    key={step.status}
                    step={step}
                    index={index}
                    isCompleted={isCompleted}
                    isCurrent={isCurrent}
                    isLast={index === TRACKING_STEPS.length - 1}
                    currentStepIndex={currentStep}
                    theme={theme}
                    estimatedDelivery={order.estimatedDelivery}
                  />
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.white }]}>
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          Items ({order.items.length})
        </ThemedText>
        
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Image
              source={{ uri: item.image }}
              style={styles.itemImage}
              contentFit="cover"
            />
            <View style={styles.itemInfo}>
              <ThemedText style={[styles.itemName, { color: theme.text }]}>
                {item.name}
              </ThemedText>
              {(item as any).options ? (
                <ThemedText style={[styles.itemQuantity, { color: theme.textSecondary }]}>
                  {Object.entries((item as any).options).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.itemQuantity, { color: theme.textSecondary }]}>
                {tr("Qty")}: {item.quantity}
              </ThemedText>
            </View>
            <ThemedText style={[styles.itemPrice, { color: theme.text }]}>
              {order.currency || "৳"}{Math.round(item.price * item.quantity).toLocaleString("en-IN")}
            </ThemedText>
          </View>
        ))}

        {order.checkout && typeof order.checkout.subtotal === "number" ? (
          <View style={{ marginTop: Spacing.sm, gap: 4 }}>
            {[
              [tr("Subtotal"), `৳${Math.round(order.checkout.subtotal).toLocaleString("en-IN")}`],
              [tr("Delivery fee"), order.checkout.deliveryFee ? `৳${Math.round(order.checkout.deliveryFee)}` : tr("Free")],
              ...(order.checkout.discount ? [[`${tr("Discount")} (${order.checkout.coupon || ""})`, `−৳${Math.round(order.checkout.discount)}`]] : []),
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: Spacing.sm }}>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>{k}</ThemedText>
                <ThemedText style={{ color: theme.text, fontSize: 14 }}>{v}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.totalRow, { borderTopColor: theme.inputBorder }]}>
          <ThemedText style={[styles.totalLabel, { color: theme.textSecondary }]}>
            {tr("Total")}
          </ThemedText>
          <ThemedText style={[styles.totalAmount, { color: theme.text }]}>
            {order.currency || "৳"}{Math.round(Number(order.total) || 0).toLocaleString("en-IN")}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.white }]}>
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          {tr("Shipping Address")}
        </ThemedText>
        
        <View style={styles.addressInfo}>
          <Feather name="map-pin" size={20} color={theme.primary} />
          <View style={styles.addressText}>
            <ThemedText style={[styles.addressName, { color: theme.text }]}>
              {order.shippingAddress.fullName}
            </ThemedText>
            <ThemedText style={[styles.addressLine, { color: theme.textSecondary }]}>
              {order.shippingAddress.address}
            </ThemedText>
            <ThemedText style={[styles.addressLine, { color: theme.textSecondary }]}>
              {order.shippingAddress.city}
            </ThemedText>
            <ThemedText style={[styles.addressLine, { color: theme.textSecondary }]}>
              {order.shippingAddress.phone}
            </ThemedText>
          </View>
        </View>
      </View>

      {order.checkout?.deliveryMethod ? (
        <View style={[styles.card, { backgroundColor: theme.white }]}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            {tr("Delivery")}
          </ThemedText>
          <View style={styles.addressInfo}>
            <Feather name={order.checkout.deliveryMethod === "pickup" ? "map-pin" : order.checkout.deliveryMethod === "express" ? "zap" : "truck"} size={20} color={theme.primary} />
            <View style={styles.addressText}>
              <ThemedText style={[styles.addressName, { color: theme.text }]}>
                {tr(order.checkout.deliveryMethod === "pickup" ? "Pick up from seller" : order.checkout.deliveryMethod === "express" ? "Express delivery" : "Home delivery")}
                {order.checkout.zone ? ` · ${tr(order.checkout.zone === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka")}` : ""}
              </ThemedText>
              {order.checkout.contactPhone ? (
                <ThemedText testID="order-contact" style={[styles.addressLine, { color: theme.textSecondary }]}>
                  {order.checkout.contactName} · {order.checkout.contactPhone}{order.checkout.altPhone ? ` / ${order.checkout.altPhone}` : ""}
                </ThemedText>
              ) : null}
              {order.checkout.deliveryDate ? (
                <ThemedText style={[styles.addressLine, { color: theme.textSecondary }]}>
                  {order.checkout.deliveryDate}
                  {order.checkout.timeSlot ? ` · ${tr(order.checkout.timeSlot === "morning" ? "Morning (9am–12pm)" : order.checkout.timeSlot === "afternoon" ? "Afternoon (12–4pm)" : "Evening (4–8pm)")}` : ""}
                </ThemedText>
              ) : null}
              {order.checkout.notes ? (
                <ThemedText style={[styles.addressLine, { color: theme.textSecondary }]}>
                  {tr("Note")}: {order.checkout.notes}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.white }]}>
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          {tr("Payment Method")}
        </ThemedText>
        
        <View style={styles.paymentInfo}>
          <Feather
            name={order.paymentMethod === "cod" ? "dollar-sign" : "credit-card"}
            size={20}
            color={theme.primary}
          />
          <ThemedText style={[styles.paymentText, { color: theme.text }]}>
            {tr(order.paymentMethod === "cod" ? "Cash on Delivery" : order.paymentMethod === "bkash" ? "bKash" : "Credit/Debit Card")}
          </ThemedText>
        </View>
      </View>

      {isSellerView && order.buyer ? (
        <View style={[styles.card, { backgroundColor: theme.white }]}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            {tr("Buyer")}
          </ThemedText>
          <ThemedText style={{ color: theme.text }}>{order.buyer.name}</ThemedText>
        </View>
      ) : null}

      {order.history && order.history.length ? (
        <View style={[styles.card, { backgroundColor: theme.white }]}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            {tr("Status history")}
          </ThemedText>
          {order.history.map((h, i) => (
            <ThemedText key={i} style={{ color: theme.textSecondary, marginBottom: 4 }}>
              {tr(h.status.charAt(0).toUpperCase() + h.status.slice(1))} · {formatDate(h.at)}
            </ThemedText>
          ))}
        </View>
      ) : null}

      {isSellerView && order.status !== "cancelled"
        ? (SELLER_NEXT[order.status] || []).map((st) => (
            <Pressable
              key={st}
              disabled={busy}
              style={[styles.cancelButton, { borderColor: theme.primary, backgroundColor: theme.primary, marginBottom: Spacing.sm }]}
              onPress={() => changeStatus(st)}
            >
              <Feather name="check" size={18} color={theme.white} />
              <ThemedText style={[styles.cancelButtonText, { color: theme.white }]}>{sellerLabel[st]}</ThemedText>
            </Pressable>
          ))
        : null}

      {(isSellerView ? order.status === "pending" || order.status === "confirmed" || order.status === "processing" : buyerCanCancel) ? (
        <Pressable
          style={[styles.cancelButton, { borderColor: "#DC2626" }]}
          onPress={handleCancelOrder}
        >
          <Feather name="x" size={18} color="#DC2626" />
          <ThemedText style={styles.cancelButtonText}>
            {tr("Cancel Order")}
          </ThemedText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  orderInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  orderId: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  orderDate: {
    fontSize: 13,
    marginTop: 4,
  },
  trackingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  trackingNumber: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  cancelledText: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  trackingSteps: {
    gap: 0,
  },
  trackingStep: {
    flexDirection: "row",
    minHeight: 60,
  },
  stepIndicator: {
    alignItems: "center",
    width: 40,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  stepContent: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  stepLabel: {
    fontSize: 15,
  },
  estimatedDate: {
    fontSize: 12,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
  },
  itemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  itemQuantity: {
    fontSize: 13,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.lg,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  addressInfo: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  addressText: {
    flex: 1,
  },
  addressName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  paymentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  paymentText: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#DC2626",
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
