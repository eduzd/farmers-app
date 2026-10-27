import React, { useEffect, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { View, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

/** Opens a shared product link (/product/<id>): loads the shop product, then shows its normal page. */
export default function ProductLinkScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bn = useI18n().language === "bn";
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { productId } = useRoute<RouteProp<RootStackParamList, "ProductLink">>().params;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p: any = await apiGet(`/api/catalog/listings/${encodeURIComponent(productId)}`);
        if (!alive) return;
        if (!p?.id) throw new Error("missing");
        const product: any = {
          ...p,
          price: Number(p.price) || 0,
          rating: 0,
          reviewCount: 0,
          currency: p.currency || "৳",
          seller: p.seller || p.storeName || p.ownerName || "Farmer",
          location: p.location || "",
          image: p.image || p.images?.[0] || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400",
        };
        navigation.replace("ProductDetail", { product });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [productId]);

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + 24 }]}>
      {failed ? (
        <View style={styles.center}>
          <AppIcon name="package" size={42} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ color: theme.text, marginTop: 12, textAlign: "center" }}>
            {bn ? "এই পণ্যটি আর পাওয়া যাচ্ছে না" : "This product isn't available any more"}
          </ThemedText>
          <ThemedText style={{ color: theme.textSecondary, marginTop: 6, textAlign: "center" }}>
            {bn ? "দোকানগুলোতে অন্য পণ্য দেখুন।" : "Have a look at the shops for other products."}
          </ThemedText>
          <Pressable testID="product-link-shops" onPress={() => navigation.replace("ShopPage", undefined as any)} style={[styles.btn, { backgroundColor: theme.primary }]}>
            <ThemedText style={{ color: "#fff", fontWeight: "700" }}>{bn ? "দোকান দেখুন" : "Browse shops"}</ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  btn: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
});
