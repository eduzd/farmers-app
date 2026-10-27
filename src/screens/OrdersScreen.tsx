import React, { useEffect, useCallback, useState } from "react";
import { MayaRadius } from "@/constants/mayaTheme";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOrdersStore, Order, OrderStatus } from "@/lib/ordersStore";
import { useI18n } from "@/lib/i18n";

import { tr, useTr } from "@/lib/tr";
import { AppIcon } from "@/components/icons/AppIcon";
import { listGuestOrders } from "@/lib/guestOrders";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<OrderStatus, { color: string; icon: string; label: string }> = {
  pending: { color: "#FF9500", icon: "clock", label: "Pending" },
  confirmed: { color: "#2E96EF", icon: "check-circle", label: "Confirmed" },
  processing: { color: "#3D38D0", icon: "package", label: "Processing" },
  shipped: { color: "#00BB77", icon: "truck", label: "Shipped" },
  delivered: { color: "#00BB77", icon: "check", label: "Delivered" },
  cancelled: { color: "#DA2F2F", icon: "x-circle", label: "Cancelled" },
};

export default function OrdersScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useI18n();
  const { orders, sales, isLoading, loadOrders, loadSales } = useOrdersStore();
  const [tab, setTab] = useState<"buying" | "selling">("buying");
  const [guestCount, setGuestCount] = useState(0);
  const bn = useI18n().language === "bn";

  useFocusEffect(
    useCallback(() => {
      listGuestOrders().then((l) => setGuestCount(l.length)).catch(() => {});
      loadOrders();
      loadSales();
    }, [loadOrders, loadSales])
  );

  const handleRefresh = useCallback(() => {
    loadOrders();
    loadSales();
  }, [loadOrders, loadSales]);

  const pendingSales = sales.filter((o) => o.status === "pending").length;
  const renderTabs = () => (
    <>
    {guestCount > 0 && tab === "buying" ? (
      // orders placed without an account on this phone
      <Pressable testID="orders-guest-link" onPress={() => navigation.navigate("GuestOrder" as any)} style={[styles.guestRow, { backgroundColor: theme.primarySoft }]}>
        <AppIcon name="user-check" size={16} color={theme.primary} />
        <ThemedText style={{ color: theme.text, flex: 1, fontSize: 13 }}>
          {bn ? `অ্যাকাউন্ট ছাড়া করা অর্ডার (${guestCount})` : `Orders placed without an account (${guestCount})`}
        </ThemedText>
        <AppIcon name="chevron-right" size={16} color={theme.primary} />
      </Pressable>
    ) : null}
    <View style={styles.tabRow}>
      {(["buying", "selling"] as const).map((k) => {
        const active = tab === k;
        return (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={[styles.tabChip, { backgroundColor: active ? theme.primary : theme.backgroundDefault, borderColor: active ? theme.primary : theme.border }]}
          >
            <ThemedText style={[styles.tabChipText, { color: active ? theme.buttonText : theme.text }]}>
              {k === "buying" ? tr("My orders") : tr("Selling")}
              {k === "selling" && pendingSales > 0 ? ` (${pendingSales})` : ""}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
    </>
  );

  const handleOrderPress = (order: Order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("OrderDetail", { orderId: order.id });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.orderCard,
          { backgroundColor: theme.white },
          pressed && styles.cardPressed,
        ]}
        onPress={() => handleOrderPress(item)}
      >
        <View style={styles.orderHeader}>
          <View>
            <ThemedText style={[styles.orderId, { color: theme.text }]}>
              {item.id}
            </ThemedText>
            {item.role === "seller" && item.buyer ? (
              <ThemedText style={[styles.orderDate, { color: theme.textSecondary }]}>
                {tr("Buyer")}: {item.buyer.name}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.orderDate, { color: theme.textSecondary }]}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + "20" }]}>
            <AppIcon name={statusConfig.icon as any} size={14} color={statusConfig.color} />
            <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.orderItems}>
          <View style={styles.itemImages}>
            {item.items.slice(0, 3).map((orderItem, index) => (
              <View
                key={orderItem.id}
                style={[
                  styles.itemImageWrapper,
                  { marginLeft: index > 0 ? -12 : 0, zIndex: 3 - index },
                ]}
              >
                <Image
                  source={{ uri: orderItem.image }}
                  style={styles.itemImage}
                  contentFit="cover"
                />
              </View>
            ))}
            {item.items.length > 3 ? (
              <View style={[styles.moreItems, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText style={[styles.moreItemsText, { color: theme.textSecondary }]}>
                  +{item.items.length - 3}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={[styles.itemCount, { color: theme.textSecondary }]}>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </ThemedText>
        </View>

        <View style={[styles.orderFooter, { borderTopColor: theme.inputBorder }]}>
          <View>
            <ThemedText style={[styles.totalLabel, { color: theme.textSecondary }]}>
              {tr("Total")}
            </ThemedText>
            <ThemedText style={[styles.totalAmount, { color: theme.text }]}>
              {item.currency || "৳"}{Math.round(Number(item.total) || 0).toLocaleString("en-IN")}
            </ThemedText>
          </View>
          <View style={styles.trackButton}>
            <ThemedText style={[styles.trackButtonText, { color: theme.primary }]}>
              {tr("Track Order")}
            </ThemedText>
            <AppIcon name="chevron-right" size={18} color={theme.primary} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
        <AppIcon name="shopping-bag" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
        {tr("No Orders Yet")}
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {tr("Your order history will appear here once you make a purchase")}
      </ThemedText>
      <Pressable
        style={[styles.shopButton, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate("MainTabs", { screen: "Market" })}
      >
        <ThemedText style={[styles.shopButtonText, { color: theme.buttonText }]}>
          {tr("Browse Marketplace")}
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={tab === "buying" ? orders : sales}
        ListHeaderComponent={renderTabs}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          tab === "buying" ? (
            renderEmptyState()
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
                <AppIcon name="package" size={48} color={theme.textSecondary} />
              </View>
              <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
                {tr("No sales yet")}
              </ThemedText>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {tr("Orders for your market listings will show up here")}
              </ThemedText>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guestRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: Spacing.sm },
  tabRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tabChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  tabChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  orderCard: {
    borderRadius: MayaRadius.lg,
    padding: Spacing.lg,
  },
  cardPressed: {
    opacity: 0.95,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  orderDate: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  orderItems: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  itemImages: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemImageWrapper: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  moreItems: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -12,
  },
  moreItemsText: {
    fontSize: 12,
    fontWeight: "600",
  },
  itemCount: {
    fontSize: 14,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 12,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "DMSans_700Bold",
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  separator: {
    height: Spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingTop: 100,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  shopButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: MayaRadius.md,
  },
  shopButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
});
