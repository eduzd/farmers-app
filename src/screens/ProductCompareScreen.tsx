import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
interface CompareProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  seller: string;
  rating: number;
  reviews: number;
  features: {
    weight?: string;
    origin?: string;
    organic?: boolean;
    delivery?: string;
    warranty?: string;
  };
}

const COMPARE_PRODUCTS: CompareProduct[] = [];

const FEATURES = [
  { key: "weight", label: "ওজন" },
  { key: "origin", label: "উৎপাদন স্থান" },
  { key: "organic", label: "জৈব" },
  { key: "delivery", label: "ডেলিভারি সময়" },
  { key: "warranty", label: "গ্যারান্টি" },
];

export default function ProductCompareScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedProducts, setSelectedProducts] = useState<CompareProduct[]>(
    COMPARE_PRODUCTS.slice(0, 2)
  );

  const handleAddToCart = (product: CompareProduct) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("কার্টে যোগ হয়েছে", `${product.name} কার্টে যোগ করা হয়েছে`);
  };

  const handleRemoveProduct = (productId: string) => {
    if (selectedProducts.length <= 2) {
      Alert.alert("ত্রুটি", "তুলনার জন্য কমপক্ষে ২টি পণ্য প্রয়োজন");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const getFeatureValue = (product: CompareProduct, featureKey: string) => {
    const value = product.features[featureKey as keyof typeof product.features];
    if (typeof value === "boolean") {
      return value ? "হ্যাঁ" : "না";
    }
    return value || "---";
  };

  const getBestValue = (featureKey: string) => {
    if (featureKey === "organic") {
      return selectedProducts.find((p) => p.features.organic)?.id;
    }
    return null;
  };

  if (selectedProducts.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, justifyContent: "center" }]}>
        <EmptyState icon="columns" title="তুলনার জন্য কোনো পণ্য নেই" message="বাজার থেকে পণ্য বেছে নিলে এখানে পাশাপাশি তুলনা দেখা যাবে।" />
      </View>
    );
  }

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productsRow}
      >
        {selectedProducts.map((product) => (
          <View
            key={product.id}
            style={[
              styles.productCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Pressable
              style={styles.removeBtn}
              onPress={() => handleRemoveProduct(product.id)}
            >
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>

            <Image
              source={{ uri: product.image }}
              style={styles.productImage}
              contentFit="cover"
              transition={200}
            />

            <ThemedText
              style={[styles.productName, { color: theme.text }]}
              numberOfLines={2}
            >
              {product.name}
            </ThemedText>

            <ThemedText style={[styles.sellerName, { color: theme.textSecondary }]}>
              {product.seller}
            </ThemedText>

            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color="#F5B700" />
              <ThemedText style={[styles.ratingText, { color: theme.text }]}>
                {product.rating}
              </ThemedText>
              <ThemedText style={[styles.reviewsText, { color: theme.textSecondary }]}>
                ({product.reviews})
              </ThemedText>
            </View>

            <ThemedText style={[styles.productPrice, { color: theme.primary }]}>
              ৳{product.price}
            </ThemedText>

            <Pressable
              style={[styles.addToCartBtn, { backgroundColor: theme.primary }]}
              onPress={() => handleAddToCart(product)}
            >
              <Feather name="shopping-cart" size={16} color={theme.white} />
              <ThemedText style={styles.addToCartText}>কার্টে যোগ</ThemedText>
            </Pressable>
          </View>
        ))}

        {selectedProducts.length < 3 ? (
          <Pressable
            style={[
              styles.addProductCard,
              { borderColor: theme.inputBorder },
            ]}
          >
            <Feather name="plus" size={32} color={theme.textSecondary} />
            <ThemedText style={[styles.addProductText, { color: theme.textSecondary }]}>
              পণ্য যোগ করুন
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.comparisonTable, { backgroundColor: theme.card }]}>
        <ThemedText style={[styles.tableTitle, { color: theme.text }]}>
          বিস্তারিত তুলনা
        </ThemedText>

        {FEATURES.map((feature, index) => (
          <View
            key={feature.key}
            style={[
              styles.tableRow,
              { borderBottomColor: theme.inputBorder },
              index === FEATURES.length - 1 && styles.lastRow,
            ]}
          >
            <View style={styles.featureLabelContainer}>
              <ThemedText style={[styles.featureLabel, { color: theme.textSecondary }]}>
                {feature.label}
              </ThemedText>
            </View>

            <View style={styles.featureValuesContainer}>
              {selectedProducts.map((product) => {
                const value = getFeatureValue(product, feature.key);
                const isBest = getBestValue(feature.key) === product.id;

                return (
                  <View key={product.id} style={styles.featureValue}>
                    {feature.key === "organic" ? (
                      <View
                        style={[
                          styles.organicBadge,
                          {
                            backgroundColor:
                              value === "হ্যাঁ" ? theme.primary + "15" : "#DA2F2F15",
                          },
                        ]}
                      >
                        <AppIcon
                          name={value === "হ্যাঁ" ? "check" : "x"}
                          size={14}
                          color={value === "হ্যাঁ" ? theme.primary : "#DA2F2F"}
                        />
                      </View>
                    ) : (
                      <ThemedText
                        style={[
                          styles.featureValueText,
                          { color: isBest ? theme.primary : theme.text },
                        ]}
                      >
                        {value}
                      </ThemedText>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.priceCompare, { backgroundColor: theme.card }]}>
        <ThemedText style={[styles.tableTitle, { color: theme.text }]}>
          মূল্য তুলনা
        </ThemedText>

        <View style={styles.priceRow}>
          {selectedProducts.map((product) => {
            const isLowest =
              product.price ===
              Math.min(...selectedProducts.map((p) => p.price));

            return (
              <View key={product.id} style={styles.priceItem}>
                <ThemedText
                  style={[
                    styles.comparePrice,
                    { color: isLowest ? theme.primary : theme.text },
                  ]}
                >
                  ৳{product.price}
                </ThemedText>
                {isLowest ? (
                  <View style={[styles.lowestBadge, { backgroundColor: theme.primary + "15" }]}>
                    <ThemedText style={[styles.lowestText, { color: theme.primary }]}>
                      সর্বনিম্ন
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
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
  productsRow: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  productCard: {
    width: 160,
    padding: Spacing.md,
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    ...Shadows.medium,
  },
  removeBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  productImage: {
    width: "100%",
    height: 100,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 4,
    height: 36,
  },
  sellerName: {
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.sm,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  reviewsText: {
    fontSize: 11,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  addToCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  addToCartText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  addProductCard: {
    width: 160,
    height: 280,
    borderRadius: BorderRadius["2xl"],
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  addProductText: {
    fontSize: 13,
    fontWeight: "500",
  },
  comparisonTable: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  featureLabelContainer: {
    width: 100,
    justifyContent: "center",
  },
  featureLabel: {
    fontSize: 13,
  },
  featureValuesContainer: {
    flex: 1,
    flexDirection: "row",
  },
  featureValue: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  featureValueText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  organicBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  priceCompare: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    ...Shadows.small,
  },
  priceRow: {
    flexDirection: "row",
  },
  priceItem: {
    flex: 1,
    alignItems: "center",
  },
  comparePrice: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  lowestBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  lowestText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
