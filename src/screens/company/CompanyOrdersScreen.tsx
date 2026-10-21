import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { ModalBottomInset } from "@/components/ModalBottomInset";

interface VendorOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentMethod: string;
  paymentStatus: "pending" | "paid" | "refunded";
  shippingAddress: string;
  notes?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: "অপেক্ষমান", color: "#EA8A0C", bgColor: "#EA8A0C15" },
  confirmed: { label: "নিশ্চিত", color: "#2563EB", bgColor: "#2563EB15" },
  processing: { label: "প্রক্রিয়াধীন", color: "#7C3AED", bgColor: "#7C3AED15" },
  shipped: { label: "শিপ করা হয়েছে", color: "#06B6D4", bgColor: "#06B6D415" },
  delivered: { label: "ডেলিভারি সম্পন্ন", color: "#16A34A", bgColor: "#16A34A15" },
  cancelled: { label: "বাতিল", color: "#DC2626", bgColor: "#DC262615" },
};

const FILTER_TABS = [
  { id: "all", label: "সব" },
  { id: "pending", label: "অপেক্ষমান" },
  { id: "confirmed", label: "নিশ্চিত" },
  { id: "processing", label: "প্রক্রিয়াধীন" },
  { id: "shipped", label: "শিপ করা" },
  { id: "delivered", label: "ডেলিভার করা" },
];

const DEMO_ORDERS: VendorOrder[] = [
  {
    id: "ord-1",
    customerName: "রহিম আহমেদ",
    customerPhone: "01712345678",
    items: [
      { name: "ধান বীজ (BR-28)", quantity: 10, price: 120 },
      { name: "টমেটো চারা", quantity: 5, price: 250 },
    ],
    total: 2450,
    status: "pending",
    paymentMethod: "bkash",
    paymentStatus: "pending",
    shippingAddress: "গ্রাম: কালিকাপুর, উপজেলা: সাভার, জেলা: ঢাকা",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ord-2",
    customerName: "করিম খান",
    customerPhone: "01898765432",
    items: [
      { name: "মাছের ভাসমান খাবার", quantity: 20, price: 85 },
    ],
    total: 1700,
    status: "confirmed",
    paymentMethod: "cash",
    paymentStatus: "pending",
    shippingAddress: "গ্রাম: বাগবাড়ি, উপজেলা: ময়মনসিংহ সদর",
    notes: "সকালে ডেলিভারি দিতে হবে",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ord-3",
    customerName: "জামিল হোসেন",
    customerPhone: "01567890123",
    items: [
      { name: "স্প্রে মেশিন", quantity: 1, price: 4500 },
    ],
    total: 4500,
    status: "shipped",
    paymentMethod: "nagad",
    paymentStatus: "paid",
    shippingAddress: "গ্রাম: পাটগ্রাম, উপজেলা: উত্তরা, ঢাকা",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ord-4",
    customerName: "সালমা বেগম",
    customerPhone: "01456789012",
    items: [
      { name: "ইউরিয়া সার", quantity: 50, price: 25 },
      { name: "TSP সার", quantity: 30, price: 30 },
    ],
    total: 2150,
    status: "delivered",
    paymentMethod: "bkash",
    paymentStatus: "paid",
    shippingAddress: "গ্রাম: মহিষালবাড়ি, উপজেলা: গাজীপুর সদর",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

export default function CompanyOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [orders, setOrders] = useState<VendorOrder[]>(DEMO_ORDERS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const filteredOrders = orders.filter((order) =>
    selectedFilter === "all" ? true : order.status === selectedFilter
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handleOrderPress = (order: VendorOrder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleUpdateStatus = (orderId: string, newStatus: VendorOrder["status"]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const getNextStatus = (currentStatus: VendorOrder["status"]): VendorOrder["status"] | null => {
    const statusFlow: VendorOrder["status"][] = ["pending", "confirmed", "processing", "shipped", "delivered"];
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex >= 0 && currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1];
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "এইমাত্র";
    if (diffHours < 24) return `${diffHours} ঘন্টা আগে`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} দিন আগে`;
    return date.toLocaleDateString("bn-BD");
  };

  const renderOrder = ({ item }: { item: VendorOrder }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const nextStatus = getNextStatus(item.status);

    return (
      <Pressable
        style={[styles.orderCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleOrderPress(item)}
      >
        <View style={styles.orderHeader}>
          <View>
            <ThemedText style={styles.orderId}>#{item.id.toUpperCase()}</ThemedText>
            <ThemedText style={[styles.orderDate, { color: theme.textSecondary }]}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

        <View style={styles.customerInfo}>
          <Feather name="user" size={16} color={theme.textSecondary} />
          <ThemedText style={styles.customerName}>{item.customerName}</ThemedText>
          <ThemedText style={[styles.customerPhone, { color: theme.textSecondary }]}>
            {item.customerPhone}
          </ThemedText>
        </View>

        <View style={styles.itemsList}>
          {item.items.slice(0, 2).map((orderItem, index) => (
            <ThemedText key={index} style={[styles.itemText, { color: theme.textSecondary }]} numberOfLines={1}>
              {orderItem.name} x{orderItem.quantity}
            </ThemedText>
          ))}
          {item.items.length > 2 ? (
            <ThemedText style={[styles.moreItems, { color: theme.primary }]}>
              +{item.items.length - 2} আরো পণ্য
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.orderFooter}>
          <ThemedText style={[styles.totalLabel, { color: theme.textSecondary }]}>মোট:</ThemedText>
          <ThemedText style={[styles.totalAmount, { color: theme.primary }]}>
            ৳{item.total.toLocaleString()}
          </ThemedText>
          {nextStatus && item.status !== "cancelled" ? (
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={(e) => {
                e.stopPropagation();
                handleUpdateStatus(item.id, nextStatus);
              }}
            >
              <ThemedText style={styles.actionButtonText}>
                {STATUS_CONFIG[nextStatus].label}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: Spacing.md, backgroundColor: theme.card, borderBottomColor: theme.cardBorder }]}>
        <ThemedText type="h2">অর্ডার ম্যানেজমেন্ট</ThemedText>
        <View style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: "#EA8A0C15" }]}>
            <ThemedText style={[styles.statValue, { color: "#EA8A0C" }]}>
              {orders.filter((o) => o.status === "pending").length}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: "#EA8A0C" }]}>অপেক্ষমান</ThemedText>
          </View>
          <View style={[styles.statItem, { backgroundColor: "#2563EB15" }]}>
            <ThemedText style={[styles.statValue, { color: "#2563EB" }]}>
              {orders.filter((o) => o.status === "confirmed" || o.status === "processing").length}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: "#2563EB" }]}>প্রক্রিয়াধীন</ThemedText>
          </View>
          <View style={[styles.statItem, { backgroundColor: "#16A34A15" }]}>
            <ThemedText style={[styles.statValue, { color: "#16A34A" }]}>
              {orders.filter((o) => o.status === "delivered").length}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: "#16A34A" }]}>সম্পন্ন</ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.filterContainer, { backgroundColor: theme.backgroundRoot }]}>
        <FlatList
          horizontal
          data={FILTER_TABS}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.filterTab,
                { borderColor: theme.cardBorder },
                selectedFilter === item.id && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <ThemedText
                style={[styles.filterText, selectedFilter === item.id && { color: "#FFFFFF" }]}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={[styles.ordersList, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                কোনো অর্ডার নেই
              </ThemedText>
            </View>
          }
        />
      )}

      <Modal visible={showOrderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">অর্ডার বিস্তারিত</ThemedText>
              <Pressable onPress={() => setShowOrderModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedOrder ? (
              <FlatList
                data={[selectedOrder]}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalBody}
                renderItem={() => {
                  const order = selectedOrder;
                  const statusConfig = STATUS_CONFIG[order.status];
                  const nextStatus = getNextStatus(order.status);

                  return (
                    <>
                      <View style={styles.modalSection}>
                        <View style={styles.modalSectionHeader}>
                          <ThemedText style={styles.sectionTitle}>অর্ডার তথ্য</ThemedText>
                          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                            <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                              {statusConfig.label}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                          অর্ডার আইডি: #{order.id.toUpperCase()}
                        </ThemedText>
                        <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                          তারিখ: {formatDate(order.createdAt)}
                        </ThemedText>
                      </View>

                      <View style={[styles.modalDivider, { backgroundColor: theme.cardBorder }]} />

                      <View style={styles.modalSection}>
                        <ThemedText style={styles.sectionTitle}>কাস্টমার তথ্য</ThemedText>
                        <View style={styles.detailRow}>
                          <Feather name="user" size={16} color={theme.textSecondary} />
                          <ThemedText>{order.customerName}</ThemedText>
                        </View>
                        <View style={styles.detailRow}>
                          <Feather name="phone" size={16} color={theme.textSecondary} />
                          <ThemedText>{order.customerPhone}</ThemedText>
                        </View>
                        <View style={styles.detailRow}>
                          <Feather name="map-pin" size={16} color={theme.textSecondary} />
                          <ThemedText style={{ flex: 1 }}>{order.shippingAddress}</ThemedText>
                        </View>
                      </View>

                      <View style={[styles.modalDivider, { backgroundColor: theme.cardBorder }]} />

                      <View style={styles.modalSection}>
                        <ThemedText style={styles.sectionTitle}>অর্ডার করা পণ্য</ThemedText>
                        {order.items.map((item, index) => (
                          <View key={index} style={styles.orderItemRow}>
                            <View style={{ flex: 1 }}>
                              <ThemedText>{item.name}</ThemedText>
                              <ThemedText style={[styles.itemQty, { color: theme.textSecondary }]}>
                                {item.quantity} x ৳{item.price}
                              </ThemedText>
                            </View>
                            <ThemedText style={[styles.itemTotal, { color: theme.primary }]}>
                              ৳{(item.quantity * item.price).toLocaleString()}
                            </ThemedText>
                          </View>
                        ))}
                        <View style={[styles.totalRow, { borderTopColor: theme.cardBorder }]}>
                          <ThemedText style={styles.totalLabel}>মোট</ThemedText>
                          <ThemedText style={[styles.totalAmount, { color: theme.primary }]}>
                            ৳{order.total.toLocaleString()}
                          </ThemedText>
                        </View>
                      </View>

                      {order.notes ? (
                        <>
                          <View style={[styles.modalDivider, { backgroundColor: theme.cardBorder }]} />
                          <View style={styles.modalSection}>
                            <ThemedText style={styles.sectionTitle}>নোট</ThemedText>
                            <ThemedText style={{ color: theme.textSecondary }}>{order.notes}</ThemedText>
                          </View>
                        </>
                      ) : null}

                      {nextStatus && order.status !== "cancelled" ? (
                        <View style={styles.modalActions}>
                          <Pressable
                            style={[styles.modalActionButton, { backgroundColor: theme.primary }]}
                            onPress={() => {
                              handleUpdateStatus(order.id, nextStatus);
                              setShowOrderModal(false);
                            }}
                          >
                            <Feather name="check" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.modalActionText}>
                              {STATUS_CONFIG[nextStatus].label} হিসেবে মার্ক করুন
                            </ThemedText>
                          </Pressable>
                          {order.status === "pending" ? (
                            <Pressable
                              style={[styles.modalActionButton, { backgroundColor: "#DC2626" }]}
                              onPress={() => {
                                handleUpdateStatus(order.id, "cancelled");
                                setShowOrderModal(false);
                              }}
                            >
                              <Feather name="x" size={18} color="#FFFFFF" />
                              <ThemedText style={styles.modalActionText}>অর্ডার বাতিল করুন</ThemedText>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </>
                  );
                }}
              />
            ) : null}
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  statItem: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  filterContainer: {
    paddingVertical: Spacing.md,
  },
  filterList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ordersList: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  orderCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderId: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  orderDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  customerName: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  customerPhone: {
    fontSize: 12,
    marginLeft: "auto",
  },
  itemsList: {
    marginTop: Spacing.md,
    gap: 4,
  },
  itemText: {
    fontSize: 13,
  },
  moreItems: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  orderFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  totalLabel: {
    fontSize: 13,
  },
  totalAmount: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
    marginLeft: Spacing.sm,
    flex: 1,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalSection: {
    gap: Spacing.sm,
  },
  modalSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: Spacing.sm,
  },
  detailText: {
    fontSize: 13,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  modalDivider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  itemQty: {
    fontSize: 12,
  },
  itemTotal: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  modalActions: {
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  modalActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
