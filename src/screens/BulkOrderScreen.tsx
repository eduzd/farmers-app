import React, { useState, useCallback } from "react";
import { MayaRadius } from "@/constants/mayaTheme";
import { AppIcon } from "@/components/icons/AppIcon";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Modal, ScrollView, Alert } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { tr, useTr } from "@/lib/tr";
import { ModalBottomInset } from "@/components/ModalBottomInset";
import { EmptyState } from "@/components/ui";
interface BulkProduct {
  id: string;
  name: string;
  image: string;
  basePrice: number;
  unit: string;
  minQuantity: number;
  discounts: { quantity: number; discount: number }[];
  seller: string;
  available: number;
}

const BULK_PRODUCTS: BulkProduct[] = [];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BulkOrderScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [refreshing, setRefreshing] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BulkProduct | null>(null);
  const [quantity, setQuantity] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const openOrderModal = (product: BulkProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedProduct(product);
    setQuantity(product.minQuantity.toString());
    setShowOrderModal(true);
  };

  const handleViewDetails = (product: BulkProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const maxDiscount = Math.max(...product.discounts.map((d) => d.discount));
    navigation.navigate("ProductDetail", {
      product: {
        id: product.id,
        name: product.name,
        price: product.basePrice,
        currency: "৳",
        unit: product.unit,
        seller: product.seller,
        location: "বাংলাদেশ",
        rating: 0,
        image: product.image,
        description: `বাল্ক অর্ডারে সর্বোচ্চ ${maxDiscount}% ছাড়। ন্যূনতম অর্ডার: ${product.minQuantity} ${product.unit}`,
        quantity: product.available,
        category: "bulk",
      }
    });
  };

  const getDiscount = (product: BulkProduct, qty: number) => {
    const applicable = product.discounts
      .filter((d) => qty >= d.quantity)
      .sort((a, b) => b.quantity - a.quantity);
    return applicable[0]?.discount || 0;
  };

  const calculatePrice = (product: BulkProduct, qty: number) => {
    const discount = getDiscount(product, qty);
    const pricePerUnit = product.basePrice * (1 - discount / 100);
    return {
      pricePerUnit: Math.round(pricePerUnit * 100) / 100,
      totalPrice: Math.round(pricePerUnit * qty),
      discount,
      savings: Math.round(product.basePrice * qty * (discount / 100)),
    };
  };

  const handlePlaceOrder = () => {
    if (!selectedProduct || !quantity) return;

    const qty = parseInt(quantity);
    if (qty < selectedProduct.minQuantity) {
      Alert.alert(tr("ত্রুটি"), `সর্বনিম্ন অর্ডার ${selectedProduct.minQuantity} ${selectedProduct.unit}`);
      return;
    }

    if (!deliveryAddress.trim()) {
      Alert.alert(tr("ত্রুটি"), tr("ডেলিভারি ঠিকানা লিখুন"));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(tr("সফল"), tr("আপনার বাল্ক অর্ডার রিকোয়েস্ট পাঠানো হয়েছে। বিক্রেতা শীঘ্রই যোগাযোগ করবেন।"));
    setShowOrderModal(false);
    setQuantity("");
    setDeliveryAddress("");
    setSelectedProduct(null);
  };

  const renderProduct = ({ item, index }: { item: BulkProduct; index: number }) => {
    const maxDiscount = Math.max(...item.discounts.map((d) => d.discount));

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
        <View
          style={[
            styles.productCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Pressable onPress={() => handleViewDetails(item)}>
            <Image
              source={{ uri: item.image }}
              style={styles.productImage}
              contentFit="cover"
              transition={200}
            />
          </Pressable>

          <View style={[styles.discountBadge, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.discountText}>
              সর্বোচ্চ {maxDiscount}% ছাড়
            </ThemedText>
          </View>

          <View style={styles.productContent}>
            <ThemedText
              style={[styles.productName, { color: theme.text }]}
              numberOfLines={2}
            >
              {item.name}
            </ThemedText>

            <ThemedText style={[styles.sellerName, { color: theme.textSecondary }]}>
              {item.seller}
            </ThemedText>

            <View style={styles.priceRow}>
              <ThemedText style={[styles.basePrice, { color: theme.primary }]}>
                ৳{item.basePrice}/{item.unit}
              </ThemedText>
              <ThemedText style={[styles.minOrder, { color: theme.textSecondary }]}>
                সর্বনিম্ন: {item.minQuantity} {item.unit}
              </ThemedText>
            </View>

            <View style={styles.discountTiers}>
              {item.discounts.slice(1).map((d, i) => (
                <View
                  key={i}
                  style={[styles.tierBadge, { backgroundColor: theme.primary + "10" }]}
                >
                  <ThemedText style={[styles.tierText, { color: theme.primary }]}>
                    {d.quantity}+ = {d.discount}%
                  </ThemedText>
                </View>
              ))}
            </View>

            <Pressable
              style={[styles.orderButton, { backgroundColor: theme.primary }]}
              onPress={() => openOrderModal(item)}
            >
              <AppIcon name="package" size={16} color={theme.white} />
              <ThemedText style={styles.orderButtonText}>{tr("অর্ডার করুন")}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  };

  const currentQty = selectedProduct ? parseInt(quantity) || 0 : 0;
  const priceInfo = selectedProduct ? calculatePrice(selectedProduct, currentQty) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={BULK_PRODUCTS}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
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
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.header, { backgroundColor: theme.card }]}>
            <AppIcon name="package" size={24} color={theme.primary} />
            <View style={styles.headerText}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                {tr("বাল্ক অর্ডার")}
              </ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {tr("বেশি কিনুন, বেশি বাঁচান")}
              </ThemedText>
            </View>
          </View>
        }
      />

      <Modal
        visible={showOrderModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowOrderModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                {tr("বাল্ক অর্ডার")}
              </ThemedText>
              <Pressable onPress={() => setShowOrderModal(false)}>
                <AppIcon name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedProduct ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: Spacing.xl },
                ]}
              >
                <ThemedText style={[styles.productNameModal, { color: theme.text }]}>
                  {selectedProduct.name}
                </ThemedText>

                <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                  পরিমাণ ({selectedProduct.unit})
                </ThemedText>
                <TextInput
                  style={[
                    styles.quantityInput,
                    {
                      backgroundColor: theme.backgroundRoot,
                      color: theme.text,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  placeholder={`সর্বনিম্ন ${selectedProduct.minQuantity}`}
                  placeholderTextColor={theme.textSecondary}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                />

                <View style={styles.quickQuantities}>
                  {selectedProduct.discounts.map((d) => (
                    <Pressable
                      key={d.quantity}
                      style={[
                        styles.quickQtyChip,
                        {
                          backgroundColor:
                            quantity === d.quantity.toString()
                              ? theme.primary
                              : theme.backgroundRoot,
                          borderColor:
                            quantity === d.quantity.toString()
                              ? theme.primary
                              : theme.inputBorder,
                        },
                      ]}
                      onPress={() => setQuantity(d.quantity.toString())}
                    >
                      <ThemedText
                        style={[
                          styles.quickQtyText,
                          {
                            color:
                              quantity === d.quantity.toString() ? theme.white : theme.text,
                          },
                        ]}
                      >
                        {d.quantity}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {priceInfo && currentQty >= selectedProduct.minQuantity ? (
                  <View style={[styles.priceBreakdown, { backgroundColor: theme.backgroundRoot }]}>
                    <View style={styles.priceRow2}>
                      <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                        {tr("একক মূল্য")}
                      </ThemedText>
                      <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                        ৳{priceInfo.pricePerUnit}/{selectedProduct.unit}
                      </ThemedText>
                    </View>
                    {priceInfo.discount > 0 ? (
                      <View style={styles.priceRow2}>
                        <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                          {tr("ছাড়")}
                        </ThemedText>
                        <ThemedText style={[styles.priceValue, { color: theme.primary }]}>
                          {priceInfo.discount}%
                        </ThemedText>
                      </View>
                    ) : null}
                    {priceInfo.savings > 0 ? (
                      <View style={styles.priceRow2}>
                        <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                          {tr("সাশ্রয়")}
                        </ThemedText>
                        <ThemedText style={[styles.priceValue, { color: "#00BB77" }]}>
                          ৳{priceInfo.savings.toLocaleString()}
                        </ThemedText>
                      </View>
                    ) : null}
                    <View style={[styles.totalRow, { borderTopColor: theme.inputBorder }]}>
                      <ThemedText style={[styles.totalLabel, { color: theme.text }]}>
                        {tr("মোট")}
                      </ThemedText>
                      <ThemedText style={[styles.totalValue, { color: theme.primary }]}>
                        ৳{priceInfo.totalPrice.toLocaleString()}
                      </ThemedText>
                    </View>
                  </View>
                ) : null}

                <ThemedText style={[styles.inputLabel, { color: theme.text, marginTop: Spacing.lg }]}>
                  {tr("ডেলিভারি ঠিকানা")}
                </ThemedText>
                <TextInput
                  style={[
                    styles.addressInput,
                    {
                      backgroundColor: theme.backgroundRoot,
                      color: theme.text,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  placeholder={tr("সম্পূর্ণ ঠিকানা লিখুন...")}
                  placeholderTextColor={theme.textSecondary}
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <Pressable
                  style={[styles.submitButton, { backgroundColor: theme.primary }]}
                  onPress={handlePlaceOrder}
                >
                  <ThemedText style={styles.submitButtonText}>{tr("অর্ডার পাঠান")}</ThemedText>
                </Pressable>
              </ScrollView>
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
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: MayaRadius.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  productCard: {
    borderRadius: MayaRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.small,
  },
  productImage: {
    width: "100%",
    height: 150,
  },
  discountBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: MayaRadius.md,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  productContent: {
    padding: Spacing.lg,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  basePrice: {
    fontSize: 18,
    fontWeight: "700",
  },
  minOrder: {
    fontSize: 12,
  },
  discountTiers: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tierBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: MayaRadius.sm,
  },
  tierText: {
    fontSize: 11,
    fontWeight: "600",
  },
  orderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: MayaRadius.lg,
    gap: Spacing.sm,
  },
  orderButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  separator: {
    height: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: MayaRadius.xl,
    borderTopRightRadius: MayaRadius.xl,
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing["2xl"],
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  productNameModal: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  quantityInput: {
    borderWidth: 1,
    borderRadius: MayaRadius.md,
    padding: Spacing.md,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  quickQuantities: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickQtyChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: MayaRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  quickQtyText: {
    fontSize: 13,
    fontWeight: "600",
  },
  priceBreakdown: {
    padding: Spacing.md,
    borderRadius: MayaRadius.lg,
  },
  priceRow2: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  addressInput: {
    borderWidth: 1,
    borderRadius: MayaRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 80,
    marginBottom: Spacing.xl,
  },
  submitButton: {
    height: 52,
    borderRadius: MayaRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
