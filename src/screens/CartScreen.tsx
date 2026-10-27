import React from "react";
import { MayaRadius } from "@/constants/mayaTheme";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCartStore, CartItem, cartRule, nextQty, canStepUp } from "@/lib/cartStore";
import { amountText, perUnitText, totalContentText } from "@shared/selling";
import { useI18n } from "@/lib/i18n";

import { tr, useTr } from "@/lib/tr";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CartScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCartStore();
  const { t, language } = useI18n();
  const bn = language === "bn";

  const total = getTotal();
  // Delivery fee and promo codes are worked out at checkout (server/checkoutRoutes.ts).
  const grandTotal = total;
  const taka = (n: number) => `৳${(Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const handleRemoveItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeItem(id);
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateQuantity(id, quantity);
  };

  const handleCheckout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Checkout");
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={[styles.cartItem, { backgroundColor: theme.white }, Shadows.small]}>
      <Image
        source={{ uri: item.image }}
        style={styles.itemImage}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.itemInfo}>
        <ThemedText style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
          {item.name}
        </ThemedText>
        <ThemedText style={[styles.itemSeller, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.seller ? <AppIcon name="shopping-bag" size={11} color={theme.textSecondary} /> : null}{item.seller ? " " : ""}{item.seller}
          {totalContentText(cartRule(item), item.quantity, bn) ? ` · ${totalContentText(cartRule(item), item.quantity, bn)}` : ""}
        </ThemedText>
        <View style={styles.itemFooter}>
          <ThemedText style={[styles.itemPrice, { color: theme.accent }]}>
            {item.currency}{item.price} {perUnitText(cartRule(item), bn)}
          </ThemedText>
          <View style={[styles.quantityControl, { backgroundColor: theme.primarySoft }]}>
            <Pressable
              style={styles.quantityButton}
              testID={`cart-minus-${item.productId}`}
              onPress={() => handleUpdateQuantity(item.id, nextQty(item, -1))}
            >
              <AppIcon name="minus" size={16} color={theme.primary} />
            </Pressable>
            <ThemedText style={[styles.quantityValue, { color: theme.text }]}>
              {amountText(cartRule(item), item.quantity, bn)}
            </ThemedText>
            <Pressable
              testID={`cart-plus-${item.productId}`}
              style={styles.quantityButton}
              disabled={!canStepUp(item)}
              onPress={() => handleUpdateQuantity(item.id, nextQty(item, 1))}
            >
              <AppIcon name="plus" size={16} color={canStepUp(item) ? theme.primary : theme.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>
      <Pressable
        style={[styles.removeButton, { backgroundColor: theme.backgroundSecondary }]}
        hitSlop={6}
        onPress={() => handleRemoveItem(item.id)}
      >
        <AppIcon name="trash-2" size={15} color="#DA2F2F" />
      </Pressable>
    </View>
  );

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyRing, { backgroundColor: theme.primarySoft }]}>
        <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.emptyIcon}>
          <AppIcon name="shopping-cart" size={40} color="#FFFFFF" />
        </LinearGradient>
      </View>
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
        {tr("Your cart is empty")}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {tr("Add products from the marketplace to get started")}
      </ThemedText>
      <Pressable
        style={[styles.shopButton, { backgroundColor: theme.primary }, Shadows.small]}
        onPress={() => navigation.goBack()}
      >
        <ThemedText style={[styles.shopButtonText, { color: theme.white }]}>
          {tr("Browse Products")}
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {items.length > 0 ? (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderCartItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingTop: Spacing.md },
            ]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <ThemedText type="h3" style={{ color: theme.text }}>{bn ? "আপনার কার্ট" : "Your cart"}</ThemedText>
                <View style={[styles.countPill, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText style={{ color: theme.primary, fontWeight: "800", fontSize: 12 }}>
                    {bn ? `${items.length.toLocaleString("bn-BD")}টি পণ্য` : `${items.length} ${items.length === 1 ? "item" : "items"}`}
                  </ThemedText>
                </View>
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.white,
                paddingBottom: insets.bottom > 0 ? insets.bottom + Spacing.sm : Spacing.lg,
              },
              Shadows.small,
            ]}
          >
            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  {tr("Subtotal")}
                </ThemedText>
                <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                  {taka(total)}
                </ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  {tr("Delivery fee")}
                </ThemedText>
                <ThemedText style={[styles.summaryValue, { color: theme.textSecondary }]}>
                  {tr("At checkout")}
                </ThemedText>
              </View>
              <View style={[styles.totalDivider, { backgroundColor: theme.inputBorder }]} />
              <View style={styles.summaryRow}>
                <ThemedText type="h4" style={{ color: theme.text }}>
                  {tr("Total")}
                </ThemedText>
                <ThemedText type="h3" style={{ color: theme.primary }}>
                  {taka(grandTotal)}
                </ThemedText>
              </View>
            </View>

            <Pressable testID="button-cart-checkout" onPress={handleCheckout} style={({ pressed }) => [styles.checkoutWrap, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.checkoutButton}>
                <ThemedText style={[styles.checkoutText, { color: "#FFFFFF" }]}>
                  {tr("Proceed to Checkout")}
                </ThemedText>
                <View style={styles.checkoutArrow}>
                  <AppIcon name="arrow-right" size={18} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={[styles.emptyWrapper, { paddingTop: Spacing.lg }]}>
          {renderEmptyCart()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 250,
  },
  cartItem: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: MayaRadius.xl,
  },
  itemImage: {
    width: 92,
    height: 92,
    borderRadius: MayaRadius.lg,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  countPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  checkoutWrap: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  checkoutArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  itemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "space-between",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  itemSeller: {
    fontSize: 13,
    marginTop: 2,
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "600",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    paddingHorizontal: 2,
  },
  quantityButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginLeft: Spacing.xs,
  },
  separator: {
    height: Spacing.md,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopLeftRadius: MayaRadius.xl,
    borderTopRightRadius: MayaRadius.xl,
  },
  summarySection: {
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  totalDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  checkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  checkoutText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  shopButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  shopButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
