import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { sellRule, perUnitText } from "@shared/selling";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { BuyerPreviewBar, readPreview, BuyerPreviewInfo } from "@/components/BuyerPreview";

/**
 * Shops in the main app. With a slug: one shop (a company or a seller) and all its products.
 * Without one: every open shop, so buyers can see which company a product comes from.
 */
export type ShopSummary = {
  id: string; name: string; slug: string; tagline?: string; description?: string; logo?: string; banner?: string;
  themeColor?: string; location?: string; phone?: string; category?: string; verified?: boolean; companyShop?: boolean; products?: number;
};

export function ShopLogo({ shop, size = 52 }: { shop: Pick<ShopSummary, "name" | "logo" | "themeColor">; size?: number }) {
  const color = shop.themeColor || "#16A34A";
  const initials = (shop.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (shop.logo) return <Image source={{ uri: shop.logo }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <ThemedText style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.36 }}>{initials}</ThemedText>
    </View>
  );
}

export default function ShopPageScreen() {
  const { theme } = useTheme();
  const realInsets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ShopPage">>();
  const slug = route.params?.slug;
  // Opened from the admin app's "View as buyer": the same page, loaded through the admin preview route so a
  // suspended shop still opens; it shows only what buyers would see.
  const preview = readPreview(route.params);
  const [previewInfo, setPreviewInfo] = useState<BuyerPreviewInfo | null>(preview);
  const insets = preview ? { ...realInsets, top: 0 } : realInsets;
  const bn = useI18n().language === "bn";
  const [shop, setShop] = useState<any>(null);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      if (slug && preview) {
        const r: any = await apiGet(`/api/admin/manage/preview/stores/${encodeURIComponent(slug)}`);
        setShop({ store: r.store, products: r.products });
        setPreviewInfo({ kind: "shop", reasons: r.reasons || [], leftOut: Number(r.leftOut) || 0 });
      } else if (slug) setShop(await apiGet(`/api/stores/${encodeURIComponent(slug)}`));
      else setShops(await apiGet<ShopSummary[]>("/api/stores"));
    } catch (e: any) {
      setError(e?.message || (bn ? "লোড করা যায়নি" : "Couldn't load"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug, bn, !!preview]);
  useEffect(() => { load(); }, [load]);

  const products = useMemo(() => {
    const list: any[] = (shop?.products || []).map((p: any) => ({
      ...p, price: Number(p.price) || 0, currency: p.currency || "৳", rating: Number(p.rating) || 0,
      seller: p.seller || shop?.store?.name || "", location: p.location || shop?.store?.location || "",
      image: p.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400",
    }));
    const s = q.trim().toLowerCase();
    return s ? list.filter((p) => `${p.name} ${p.category || ""}`.toLowerCase().includes(s)) : list;
  }, [shop, q]);
  const shopList = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? shops.filter((x) => `${x.name} ${x.tagline || ""} ${x.location || ""} ${x.category || ""}`.toLowerCase().includes(s)) : shops;
  }, [shops, q]);

  const header = (title: string) => (
    <>
    {previewInfo ? <BuyerPreviewBar info={previewInfo} topInset={realInsets.top} onClose={() => navigation.goBack()} /> : null}
    <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: theme.backgroundRoot }]}>
      <Pressable testID="shop-back" hitSlop={10} onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={theme.text} />
      </Pressable>
      <ThemedText type="h4" style={{ color: theme.text, flex: 1 }} numberOfLines={1}>{title}</ThemedText>
    </View>
    </>
  );
  const search = (
    <View style={[styles.search, { backgroundColor: theme.backgroundSecondary }]}>
      <Feather name="search" size={16} color={theme.textSecondary} />
      <TextInput
        testID="shop-search"
        value={q}
        onChangeText={setQ}
        placeholder={slug ? (bn ? "এই দোকানে খুঁজুন" : "Search this shop") : bn ? "দোকান খুঁজুন" : "Search shops"}
        placeholderTextColor={theme.textSecondary}
        style={[styles.searchInput, { color: theme.text }]}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.backgroundRoot }]}>
        {header(slug ? "" : bn ? "দোকান সমূহ" : "Shops")}
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.backgroundRoot }]}>
        {header(bn ? "দোকান" : "Shop")}
        <View style={styles.empty}>
          <Feather name="alert-circle" size={40} color={theme.textSecondary} />
          <ThemedText style={{ color: theme.textSecondary, marginTop: 8 }}>{error}</ThemedText>
          <Pressable onPress={() => { setLoading(true); load(); }} style={[styles.retry, { borderColor: theme.primary }]}>
            <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>{bn ? "আবার চেষ্টা" : "Try again"}</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!slug) {
    return (
      <View testID="shops-list" style={[styles.flex, { backgroundColor: theme.backgroundRoot }]}>
        {header(bn ? "দোকান সমূহ" : "Shops")}
        <FlatList
          data={shopList}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          ListHeaderComponent={search}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[theme.primary]} tintColor={theme.primary} />}
          ListEmptyComponent={<ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: 30 }}>{bn ? "কোনো দোকান নেই" : "No shops yet"}</ThemedText>}
          renderItem={({ item }) => (
            <Pressable
              testID={`shop-row-${item.slug}`}
              onPress={() => { Haptics.selectionAsync(); navigation.push("ShopPage", { slug: item.slug }); }}
              style={({ pressed }) => [styles.shopRow, { backgroundColor: theme.card, borderColor: theme.cardBorder, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <ShopLogo shop={item} size={48} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ThemedText style={{ color: theme.text, fontWeight: "700", fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{item.name}</ThemedText>
                  {item.verified ? <Feather name="check-circle" size={14} color={theme.primary} /> : null}
                </View>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                  {[item.tagline || item.category, item.location].filter(Boolean).join(" · ") || (bn ? "দোকান" : "Shop")}
                </ThemedText>
              </View>
              <ThemedText style={{ color: theme.primary, fontWeight: "700", fontSize: 12.5 }}>
                {bn ? `${item.products || 0}টি পণ্য` : `${item.products || 0} product${item.products === 1 ? "" : "s"}`}
              </ThemedText>
            </Pressable>
          )}
        />
      </View>
    );
  }

  const st = shop?.store || {};
  const color = st.themeColor || theme.primary;
  return (
    <View testID={preview ? "shop-preview" : "shop-page"} style={[styles.flex, { backgroundColor: theme.backgroundRoot }]}>
      {header(st.name || "")}
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[theme.primary]} tintColor={theme.primary} />}
        ListHeaderComponent={
          <View>
            <View style={[styles.banner, { backgroundColor: color + "18" }]}>
              {st.banner ? <Image source={{ uri: st.banner }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            <View style={styles.shopHead}>
              <View style={[styles.logoRing, { borderColor: theme.backgroundRoot }]}><ShopLogo shop={st} size={72} /></View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <ThemedText testID="shop-name" type="h3" style={{ color: theme.text }}>{st.name}</ThemedText>
                {st.verified ? <Feather name="check-circle" size={18} color={theme.primary} /> : null}
              </View>
              {st.tagline ? <ThemedText style={{ color: theme.textSecondary, marginTop: 2, textAlign: "center" }}>{st.tagline}</ThemedText> : null}
              <View style={styles.metaRow}>
                {st.location ? <Meta icon="map-pin" text={st.location} /> : null}
                {st.phone ? <Meta icon="phone" text={st.phone} /> : null}
                <Meta icon="package" text={bn ? `${shop?.products?.length || 0}টি পণ্য` : `${shop?.products?.length || 0} products`} />
              </View>
              {st.description ? <ThemedText style={{ color: theme.text, marginTop: 10, lineHeight: 20 }}>{st.description}</ThemedText> : null}
            </View>
            <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>{search}</View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={40} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: 8 }}>{bn ? "এই দোকানে এখনো পণ্য নেই" : "No products in this shop yet"}</ThemedText>
          </View>
        }
        renderItem={({ item }) => {
          const r = sellRule(item);
          const out = r.stock !== null && (r.stock <= 0 || r.stock < r.min);
          return (
            <Pressable
              testID={`shop-product-${item.id}`}
              onPress={() => { Haptics.selectionAsync(); navigation.navigate("ProductDetail", (preview ? { product: item, preview: { kind: "product", reasons: previewInfo?.reasons || [] } } : { product: item }) as any); }}
              style={({ pressed }) => [styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Image source={{ uri: item.image }} style={styles.cardImg} contentFit="cover" />
              {out ? <View style={styles.outTag}><ThemedText style={styles.outText}>{bn ? "স্টক শেষ" : "Out of stock"}</ThemedText></View> : null}
              <View style={{ padding: 10 }}>
                <ThemedText style={{ color: theme.text, fontWeight: "700" }} numberOfLines={2}>{item.name}</ThemedText>
                <ThemedText style={{ color: theme.primary, fontWeight: "800", marginTop: 4 }}>
                  {item.currency}{item.price.toLocaleString("en-IN")}
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "500" }}> {perUnitText(r, bn)}</ThemedText>
                </ThemedText>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );

  function Meta({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
    return (
      <View style={styles.meta}>
        <Feather name={icon} size={13} color={theme.textSecondary} />
        <ThemedText style={{ color: theme.textSecondary, fontSize: 12.5 }}>{text}</ThemedText>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, height: 42 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  banner: { height: 120, overflow: "hidden" },
  shopHead: { alignItems: "center", paddingHorizontal: 16, marginTop: -36, marginBottom: 14 },
  logoRing: { borderWidth: 4, borderRadius: 44 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 8 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  card: { flex: 1, maxWidth: "48.5%", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardImg: { width: "100%", aspectRatio: 1 },
  outTag: { position: "absolute", top: 8, left: 8, backgroundColor: "#B91C1C", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  outText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 24 },
  retry: { marginTop: 12, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
});
