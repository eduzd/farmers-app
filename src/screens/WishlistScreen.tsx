import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
import { useFavoritesStore } from "@/lib/favoritesStore";
import { useCartStore } from "@/lib/cartStore";
import { apiPost, isLoggedIn, timeAgo } from "@/lib/api";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  seller: string;
  inStock: boolean;
  addedAt: string;
  priceAlert?: boolean;
  product?: any;
}

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const tr = useTr();
  const { language: lang } = useI18n();
  const favItems = useFavoritesStore((st) => st.items);
  const loadFavs = useFavoritesStore((st) => st.load);
  const removeFav = useFavoritesStore((st) => st.remove);
  const addToCart = useCartStore((st) => st.addItem);
  const [alerts, setAlerts] = useState<Record<string, boolean>>({});
  const wishlist: WishlistItem[] = favItems.map((f) => ({
    id: f.itemId,
    name: f.name,
    price: Number(f.price || 0),
    originalPrice: f.originalPrice,
    image: f.image || "",
    seller: f.seller || "",
    inStock: f.inStock !== false,
    addedAt: timeAgo(f.addedAt, lang),
    priceAlert: !!alerts[f.itemId],
    product: f.product,
  }));
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(
    useCallback(() => {
      loadFavs();
    }, [loadFavs])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFavs();
    setRefreshing(false);
  }, [loadFavs]);

  const handleRemove = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      tr("উইশলিস্ট থেকে সরান"),
      tr("আপনি কি এই পণ্যটি উইশলিস্ট থেকে সরাতে চান?"),
      [
        { text: tr("না"), style: "cancel" },
        {
          text: tr("হ্যাঁ"),
          style: "destructive",
          onPress: () => {
            removeFav(itemId);
          },
        },
      ]
    );
  };

  const handleTogglePriceAlert = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const item = wishlist.find((i) => i.id === itemId);
    const on = !alerts[itemId];
    setAlerts((prev) => ({ ...prev, [itemId]: on }));
    if (on && item) {
      if (!isLoggedIn()) {
        Alert.alert(tr("Log in to get price alerts"));
        return;
      }
      apiPost("/api/me/price-alerts", { product: item.name, condition: "below", target: item.price })
        .then(() => Alert.alert(tr("Price alert set"), `${item.name}: ${tr("we'll notify you when the price drops below")} ৳${item.price}`))
        .catch((e) => Alert.alert(tr("Couldn't set the alert"), e.message));
    }
  };

  const handleAddToCart = (item: WishlistItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToCart({ productId: item.id, name: item.name, price: item.price, currency: "৳", unit: item.product?.unit || "", quantity: 1, image: item.image, seller: item.seller });
    Alert.alert(tr("কার্টে যোগ হয়েছে"), `${item.name} ${tr("কার্টে যোগ করা হয়েছে")}`);
  };

  const handleViewProduct = (item: WishlistItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ProductDetail", {
      product: item.product || {
        id: item.id,
        name: item.name,
        price: item.price,
        currency: "৳",
        unit: "কেজি",
        seller: item.seller,
        location: "বাংলাদেশ",
        rating: 4.5,
        image: item.image,
        description: `${item.seller} এর পণ্য`,
        quantity: item.inStock ? 100 : 0,
        category: "wishlist",
      }
    });
  };

  const renderItem = ({ item }: { item: WishlistItem }) => {
    const discount = item.originalPrice
      ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
      : 0;

    return (
      <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
        layout={Layout.springify()}
      >
        <Pressable
          style={[
            styles.itemCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            !item.inStock && styles.outOfStock,
          ]}
          onPress={() => handleViewProduct(item)}
        >
          <Image
            source={{ uri: item.image }}
            style={styles.itemImage}
            contentFit="cover"
            transition={200}
          />

          {discount > 0 ? (
            <View style={[styles.discountBadge, { backgroundColor: "#DC2626" }]}>
              <ThemedText style={styles.discountText}>-{discount}%</ThemedText>
            </View>
          ) : null}

          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <ThemedText
                style={[styles.itemName, { color: theme.text }]}
                numberOfLines={2}
              >
                {item.name}
              </ThemedText>
              <Pressable
                style={styles.removeButton}
                onPress={() => handleRemove(item.id)}
              >
                <Feather name="x" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ThemedText style={[styles.sellerName, { color: theme.textSecondary }]}>
              {item.seller}
            </ThemedText>

            <View style={styles.priceRow}>
              <ThemedText style={[styles.price, { color: theme.primary }]}>
                ৳{item.price}
              </ThemedText>
              {item.originalPrice ? (
                <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>
                  ৳{item.originalPrice}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.stockBadge,
                  {
                    backgroundColor: item.inStock
                      ? theme.primary + "15"
                      : "#DC262615",
                  },
                ]}
              >
                <View
                  style={[
                    styles.stockDot,
                    { backgroundColor: item.inStock ? theme.primary : "#DC2626" },
                  ]}
                />
                <ThemedText
                  style={[
                    styles.stockText,
                    { color: item.inStock ? theme.primary : "#DC2626" },
                  ]}
                >
                  {item.inStock ? tr("স্টকে আছে") : tr("স্টক নেই")}
                </ThemedText>
              </View>

              <Pressable
                style={[
                  styles.alertButton,
                  {
                    backgroundColor: item.priceAlert
                      ? theme.primary + "15"
                      : theme.backgroundRoot,
                    borderColor: item.priceAlert ? theme.primary : theme.inputBorder,
                  },
                ]}
                onPress={() => handleTogglePriceAlert(item.id)}
              >
                <Feather
                  name="bell"
                  size={14}
                  color={item.priceAlert ? theme.primary : theme.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.addToCartButton,
                  { backgroundColor: item.inStock ? theme.primary : theme.inputBorder },
                ]}
                onPress={() => handleAddToCart(item)}
                disabled={!item.inStock}
              >
                <Feather name="shopping-cart" size={16} color={theme.white} />
                <ThemedText style={[styles.addToCartText, { color: theme.white }]}>
                  {tr("কার্টে যোগ করুন")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={wishlist}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="heart" size={64} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              {tr("উইশলিস্ট খালি")}
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {tr("আপনার পছন্দের পণ্যগুলো এখানে সেভ করুন")}
            </ThemedText>
            <Pressable
              style={[styles.browseButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate("Main")}
            >
              <ThemedText style={[styles.browseButtonText, { color: theme.white }]}>
                {tr("মার্কেট দেখুন")}
              </ThemedText>
            </Pressable>
          </View>
        }
        ListHeaderComponent={
          wishlist.length > 0 ? (
            <View style={styles.header}>
              <ThemedText style={[styles.headerText, { color: theme.textSecondary }]}>
                {lang === "en" ? `${wishlist.length} saved item(s)` : `${wishlist.length}টি পণ্য সেভ করা আছে`}
              </ThemedText>
            </View>
          ) : null
        }
      />
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
    marginBottom: Spacing.md,
  },
  headerText: {
    fontSize: 14,
  },
  itemCard: {
    flexDirection: "row",
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.medium,
  },
  outOfStock: {
    opacity: 0.7,
  },
  itemImage: {
    width: 120,
    height: "100%",
    minHeight: 160,
  },
  discountBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  itemContent: {
    flex: 1,
    padding: Spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
    marginRight: Spacing.sm,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  sellerName: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 11,
    fontWeight: "600",
  },
  alertButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    marginTop: Spacing.xs,
  },
  addToCartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  addToCartText: {
    fontSize: 13,
    fontWeight: "600",
  },
  separator: {
    height: Spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  browseButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  browseButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
