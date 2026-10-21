import React from "react";
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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCartStore, CartItem } from "@/lib/cartStore";
import { useI18n } from "@/lib/i18n";

import { tr, useTr } from "@/lib/tr";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CartScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCartStore();
  const { t } = useI18n();

  const total = getTotal();
  // Delivery fee and promo codes are worked out at checkout (server/checkoutRoutes.ts).
  const grandTotal = total;
  const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

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
    <View style={[styles.cartItem, { backgroundColor: theme.white }]}>
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
        <ThemedText style={[styles.itemSeller, { color: theme.textSecondary }]}>
          {item.seller}
        </ThemedText>
        <View style={styles.itemFooter}>
          <ThemedText style={[styles.itemPrice, { color: theme.primary }]}>
            {item.currency}{item.price}/{item.unit}
          </ThemedText>
          <View style={[styles.quantityControl, { backgroundColor: theme.backgroundDefault }]}>
            <Pressable
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
            >
              <Feather name="minus" size={16} color={theme.text} />
            </Pressable>
            <ThemedText style={[styles.quantityValue, { color: theme.text }]}>
              {item.quantity}
            </ThemedText>
            <Pressable
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
            >
              <Feather name="plus" size={16} color={theme.text} />
            </Pressable>
          </View>
        </View>
      </View>
      <Pressable
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item.id)}
      >
        <Feather name="trash-2" size={18} color="#DC2626" />
      </Pressable>
    </View>
  );

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="shopping-cart" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
        {tr("Your cart is empty")}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {tr("Add products from the marketplace to get started")}
      </ThemedText>
      <Pressable
        style={[styles.shopButton, { backgroundColor: theme.primary }]}
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
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.white,
                paddingBottom: insets.bottom > 0 ? insets.bottom + Spacing.sm : Spacing.lg,
                borderTopColor: theme.inputBorder,
              },
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

            <Pressable
              style={[styles.checkoutButton, { backgroundColor: theme.primary }]}
              onPress={handleCheckout}
            >
              <ThemedText style={[styles.checkoutText, { color: theme.white }]}>
                {tr("Proceed to Checkout")}
              </ThemedText>
              <Feather name="arrow-right" size={20} color={theme.white} />
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
    borderRadius: BorderRadius.md,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
  },
  itemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "space-between",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
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
    borderRadius: BorderRadius.sm,
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
    padding: Spacing.sm,
    alignSelf: "flex-start",
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
    borderTopWidth: 1,
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
    height: 52,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  checkoutText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
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
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
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
    borderRadius: BorderRadius.md,
  },
  shopButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
