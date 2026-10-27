import React, { useEffect, useState } from "react";
import { MayaRadius } from "@/constants/mayaTheme";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { StepFill, StepPop, CurrentHalo, FadeSlideIn, OrderProgressBar, useStepStagger, bnDigits } from "@/components/OrderProgressMotion";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOrdersStore, Order, OrderStatus } from "@/lib/ordersStore";

import { tr, useTr } from "@/lib/tr";
import { AppIcon } from "@/components/icons/AppIcon";
import { useI18n } from "@/lib/i18n";
import { orderLineText } from "@shared/selling";
type OrderDetailRouteProp = RouteProp<RootStackParamList, "OrderDetail">;

const TRACKING_STEPS: { status: OrderStatus; label: string; labelBn: string; icon: string }[] = [
  { status: "pending", label: "Order Placed", labelBn: "অর্ডার করা হয়েছে", icon: "file-text" },
  { status: "confirmed", label: "Confirmed", labelBn: "নিশ্চিত", icon: "check-circle" },
  { status: "processing", label: "Processing", labelBn: "প্রস্তুত হচ্ছে", icon: "package" },
  { status: "shipped", label: "Shipped", labelBn: "পাঠানো হয়েছে", icon: "truck" },
  { status: "delivered", label: "Delivered", labelBn: "ডেলিভারি হয়েছে", icon: "check" },
];

const STATUS_ORDER: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

interface AnimatedStepProps {
  step: { status: OrderStatus; label: string; labelBn: string; icon: string };
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLast: boolean;
  currentStepIndex: number;
  theme: any;
  estimatedDelivery?: string;
  bn: boolean;
  /** stagger from useStepStagger: only steps the order newly reached get a delay */
  delay: number;
  lineDelay: number;
}

/**
 * One step of the buyer's tracker. All motion follows the real order status:
 * the line fills and the circle pops only when that step is done, the current step gets a short halo
 * (twice, then still), and reduce-motion turns all of it off (see OrderProgressMotion).
 */
function AnimatedTrackingStep({
  step,
  index,
  isCompleted,
  isCurrent,
  isLast,
  currentStepIndex,
  theme,
  estimatedDelivery,
  bn,
  delay,
  lineDelay,
}: AnimatedStepProps) {
  return (
    <FadeSlideIn delay={index * 60} style={styles.trackingStep}>
      <View testID={`track-step-${step.status}`} accessibilityLabel={`${bn ? step.labelBn : step.label}: ${isCompleted ? (bn ? "সম্পন্ন" : "done") : bn ? "এখনও নয়" : "not yet"}`} style={styles.stepIndicator}>
        <View style={styles.stepCircleWrap}>
          {isCurrent ? <CurrentHalo runKey={step.status} color={theme.primary} size={36} delay={delay} /> : null}
          <StepPop done={isCompleted} delay={delay}>
            <View
              style={[
                styles.stepCircle,
                {
                  backgroundColor: isCompleted ? theme.primary : theme.backgroundDefault,
                  borderColor: isCompleted ? theme.primary : theme.inputBorder,
                },
              ]}
            >
              <AppIcon
                name={step.icon as any}
                size={16}
                color={isCompleted ? theme.white : theme.textSecondary}
              />
            </View>
          </StepPop>
        </View>
        {!isLast ? (
          <View style={[styles.stepLine, { backgroundColor: theme.inputBorder }]}>
            <StepFill testID={`track-line-${step.status}`} filled={index < currentStepIndex} color={theme.primary} delay={lineDelay} />
          </View>
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
          {bn ? step.labelBn : step.label}
        </ThemedText>
        {isCurrent && estimatedDelivery ? (
          <FadeSlideIn runKey={step.status} delay={delay + 200}>
            <ThemedText style={[styles.estimatedDate, { color: theme.primary }]}>
              {bn ? "আনুমানিক" : "Est."} {estimatedDelivery}
            </ThemedText>
          </FadeSlideIn>
        ) : null}
      </View>
    </FadeSlideIn>
  );
}

export default function OrderDetailScreen() {
  const tr = useTr();
  const bnOrder = useI18n().language === "bn";
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<OrderDetailRouteProp>();
  const { orderId } = route.params;
  const { getOrderById, updateOrderStatus } = useOrdersStore();
  
  const [order, setOrder] = useState<Order | undefined>(getOrderById(orderId));
  // How far the order really is (-1 when cancelled); the tracker animates only steps newly reached.
  const delayFor = useStepStagger(order && order.status !== "cancelled" ? STATUS_ORDER.indexOf(order.status) : -1);

  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setOrder(getOrderById(orderId));
    // refresh from the server so status changes by the other side show up
    const st = useOrdersStore.getState();
    Promise.all([st.loadOrders(), st.loadSales()])
      .then(() => setOrder(useOrdersStore.getState().getOrderById(orderId)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [orderId]);
  // Opened straight from a notification the order may not be on the phone yet: wait for the server
  // before saying it isn't there.
  const [loaded, setLoaded] = useState(!!getOrderById(orderId));

  if (!order) {
    return (
      <View testID={loaded ? "order-not-found" : "order-loading"} style={[styles.container, { backgroundColor: theme.backgroundRoot, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }]}>
        {loaded ? (
          <>
            <AppIcon name="package" size={34} color={theme.textSecondary} />
            <ThemedText style={{ fontWeight: "700", fontSize: 16 }}>{tr("Order not found")}</ThemedText>
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center" }}>
              {useI18n.getState().language === "bn" ? "এই অর্ডারটি আপনার অ্যাকাউন্টে নেই, অথবা আর নেই।" : "This order isn't on your account, or isn't there anymore."}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={{ color: theme.textSecondary }}>{useI18n.getState().language === "bn" ? "অর্ডার লোড হচ্ছে…" : "Loading order…"}</ThemedText>
        )}
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
              <AppIcon name="hash" size={14} color={theme.primary} />
              <ThemedText style={[styles.trackingNumber, { color: theme.primary }]}>
                {order.trackingNumber}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {order.status === "cancelled" ? (
          <FadeSlideIn runKey="cancelled" style={[styles.cancelledBanner, { backgroundColor: "#DA2F2F15" }]}>
            <AppIcon name="x-circle" size={20} color="#DA2F2F" />
            <ThemedText style={[styles.cancelledText, { color: "#DA2F2F" }]}>
              {tr("This order has been cancelled")}
            </ThemedText>
          </FadeSlideIn>
        ) : (
          <>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
              {tr("Order Tracking")}
            </ThemedText>
            <View style={styles.trackingBarRow}>
              <View style={{ flex: 1 }}>
                <OrderProgressBar
                  testID="track-progress-bar"
                  fraction={(currentStep + 1) / TRACKING_STEPS.length}
                  color={theme.primary}
                  trackColor={theme.inputBorder}
                  label={bnOrder ? `ধাপ ${bnDigits(currentStep + 1)} / ৫` : `Step ${currentStep + 1} of 5`}
                />
              </View>
              <ThemedText testID="track-step-count" style={[styles.trackingBarText, { color: theme.textSecondary }]}>
                {bnOrder ? `ধাপ ${bnDigits(currentStep + 1)} / ৫` : `Step ${currentStep + 1} of 5`}
              </ThemedText>
            </View>

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
                    bn={bnOrder}
                    delay={delayFor(index)}
                    lineDelay={delayFor(index + 1)}
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
                {tr("Qty")}: {orderLineText(item as any, bnOrder)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.itemPrice, { color: theme.text }]}>
              {order.currency || "৳"}{(Math.round(item.price * item.quantity * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
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
          <AppIcon name="map-pin" size={20} color={theme.primary} />
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
            <AppIcon name={order.checkout.deliveryMethod === "pickup" ? "map-pin" : order.checkout.deliveryMethod === "express" ? "zap" : "truck"} size={20} color={theme.primary} />
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
          <AppIcon
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
              <AppIcon name="check" size={18} color={theme.white} />
              <ThemedText style={[styles.cancelButtonText, { color: theme.white }]}>{sellerLabel[st]}</ThemedText>
            </Pressable>
          ))
        : null}

      {(isSellerView ? order.status === "pending" || order.status === "confirmed" || order.status === "processing" : buyerCanCancel) ? (
        <Pressable
          style={[styles.cancelButton, { borderColor: "#DA2F2F" }]}
          onPress={handleCancelOrder}
        >
          <AppIcon name="x" size={18} color="#DA2F2F" />
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
    borderRadius: MayaRadius.lg,
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
    fontFamily: "DMSans_700Bold",
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
    fontFamily: "DMSans_600SemiBold",
  },
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: MayaRadius.md,
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
  trackingBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
  },
  trackingBarText: {
    fontSize: 12,
    fontWeight: "600",
  },
  stepCircleWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: 1,
    overflow: "hidden",
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
    borderRadius: MayaRadius.sm,
  },
  itemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
  },
  itemQuantity: {
    fontSize: 13,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
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
    fontFamily: "DMSans_700Bold",
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
    fontFamily: "DMSans_600SemiBold",
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
    fontFamily: "DMSans_500Medium",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderRadius: MayaRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#DA2F2F",
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
});
