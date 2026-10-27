import { useMarketCategories } from "@/lib/marketCategories";
import { MayaRadius } from "@/constants/mayaTheme";
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, Dimensions, ScrollView } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useFavoritesStore } from "@/lib/favoritesStore";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCartStore } from "@/lib/cartStore";
import { useI18n } from "@/lib/i18n";
import { MarketplaceProduct, getAllMarketplaceProducts, getAllCompanies, Company } from "@/lib/storage";
import { initializeSeedData } from "@/lib/seedData";
import { apiGet } from "@/lib/api";
import { fetchRatings } from "@/lib/liveDataApi";
import { ShopLogo, type ShopSummary } from "@/screens/ShopPageScreen";
import { fetchCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem, myUserId } from "@/lib/catalog";
import { CatalogFormModal, FormField } from "@/components/CatalogFormModal";
import { useAuthStore } from "@/lib/authStore";
import { useCommunityStore, CommunityType } from "@/lib/communityStore";

import { tr, useTr } from "@/lib/tr";
import { useRecentlyViewedStore } from "@/lib/recentlyViewedStore";
import { DIVISIONS, divisionOf, divisionLabel } from "@/lib/bdLocations";
import { AppIcon } from "@/components/icons/AppIcon";
import { CountBadge } from "@/components/CountBadge";
import { useUnreadCounts } from "@/lib/liveStatus";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Categories now come from the server (admins manage them in the admin app); see useMarketCategories.

export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string;
  seller: string;
  sellerId?: string;
  location: string;
  rating: number;
  /** How many buyer reviews the rating comes from (0 = not rated yet). */
  reviewCount?: number;
  image: string;
  description?: string;
  quantity: number;
  category: string;
  companyId?: string;
  company?: {
    name: string;
    initials: string;
    verified: boolean;
    rating: number;
    location: string;
  };
}

const DEMO_PRODUCTS: Product[] = [];

export default function MarketScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { t, language } = useI18n();
  const { getItemCount } = useCartStore();
  const activeCommunity = useCommunityStore((state) => state.activeCommunity);
  const isBn = language === "bn";
  const marketCats = useMarketCategories();
  const CATEGORIES = useMemo(
    () => [
      { id: "all", labelBn: "সব", labelEn: "All", icon: "grid" },
      ...marketCats.map((c) => ({ id: c.slug, labelBn: c.nameBn, labelEn: c.nameEn, icon: c.icon })),
    ],
    [marketCats],
  );

  const communityType = (activeCommunity?.type || "agriculture") as CommunityType;

  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [companies, setCompanies] = useState<Company[]>([]);
  // real shops from the server (company shops the admin opened, and sellers' shops)
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  // A carousel ad can open one category: match it by slug or by its English/Bangla name.
  const routeParams = (useRoute() as any)?.params as { category?: string; at?: number } | undefined;
  useEffect(() => {
    const want = String(routeParams?.category || "").trim().toLowerCase();
    if (!want) return;
    const hit = CATEGORIES.find(
      (c) => c.id.toLowerCase() === want || c.labelEn.toLowerCase() === want || (c.labelBn || "").trim() === want,
    );
    setSelectedCategory(hit ? hit.id : "all");
  }, [routeParams?.category, routeParams?.at, CATEGORIES]);

  const cartCount = getItemCount();
  const loggedIn = useAuthStore((st) => st.isAuthenticated && !!st.token);
  const isSuperAdmin = useAuthStore((st) => st.isSuperAdmin);
  const authUser = useAuthStore((st) => st.user);
  const [sellForm, setSellForm] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const SELL_FIELDS: FormField[] = [
    { key: "name", label: t("market.form.name"), required: true },
    { key: "price", label: t("market.form.price"), numeric: true, required: true },
    { key: "unit", label: t("market.form.unit"), placeholder: tr("kg / maund / piece / dozen / litre") },
    { key: "quantity", label: tr("Stock available"), numeric: true },
    { key: "minOrder", label: tr("Minimum order"), numeric: true, placeholder: "1" },
    { key: "location", label: t("market.form.location") },
    { key: "category", label: t("market.form.category"), choices: marketCats.map((c) => ({ value: c.slug, label: isBn ? c.nameBn : c.nameEn })) },
    { key: "image", label: t("market.form.image"), placeholder: "https://...", image: true },
    { key: "description", label: t("market.form.description"), multiline: true },
  ];
  const saveListing = async (v: Record<string, any>) => {
    const data = {
      currency: "৳",
      rating: 0,
      seller: (authUser as any)?.name || (authUser as any)?.username || "Seller",
      sellerId: (authUser as any)?.id,
      category: "vegetables",
      ...v,
      image: v.image || "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400",
    };
    if (sellForm.item) await updateCatalogItem("listings", sellForm.item.id, data);
    else await createCatalogItem("listings", data);
    setSellForm({ open: false, item: null });
    loadProducts();
  };

  useEffect(() => {
    loadProducts();
  }, [communityType]);

  const loadProducts = async () => {
    try {
      const loadedCompanies = await getAllCompanies();
      if (loadedCompanies.length === 0) {
        await initializeSeedData();
        const newCompanies = await getAllCompanies();
        setCompanies(newCompanies);
      } else {
        setCompanies(loadedCompanies);
      }

      // Listings made with the Sell form may leave out rating, seller, location or currency.
      apiGet<ShopSummary[]>("/api/stores").then((r) => setShops(Array.isArray(r) ? r : [])).catch(() => {});
      const serverListings: Product[] = (await fetchCatalog<Product>("listings").catch(() => [] as Product[])).map((p: any) => ({
        ...p,
        price: Number(p.price) || 0,
        // Real stars come from buyer reviews below; the number saved on the listing is not a review.
        rating: 0,
        reviewCount: 0,
        currency: p.currency || "৳",
        seller: p.seller || p.ownerName || "Farmer",
        location: p.location || "",
        image: p.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400",
      }));
      const marketplaceProducts = await getAllMarketplaceProducts();
      
      const formattedProducts: Product[] = marketplaceProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency,
        unit: p.unit,
        seller: p.company.name,
        sellerId: p.companyId,
        location: p.company.location,
        rating: p.rating || p.company.rating,
        image: (p.images && p.images.length > 0 ? p.images[0] : null) || "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400",
        description: p.description,
        quantity: p.quantity,
        category: p.category,
        companyId: p.companyId,
        company: p.company,
      }));

      const allProducts = [...serverListings, ...formattedProducts];
      // Average stars and review count from real buyer reviews. Products with no reviews
      // show no stars at all (never a made-up 0.0); if this fails, stars are just hidden.
      const ratings = await fetchRatings(serverListings.map((p) => String(p.id))).catch(() => ({}) as Record<string, { average: number; count: number }>);
      for (const p of serverListings as any[]) {
        const r = (ratings as any)[String(p.id)];
        if (r) {
          p.rating = r.average;
          p.reviewCount = r.count;
        }
      }

      setProducts(allProducts);
    } catch (error) {
      console.error("Error loading products:", error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    useFavoritesStore.getState().load();
    await loadProducts();
    setIsRefreshing(false);
  };

  const [sortBy, setSortBy] = useState<"newest" | "nearby" | "price_asc" | "price_desc" | "rating" | "saved">("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [division, setDivision] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const recentItems = useRecentlyViewedStore((st) => st.items);
  useEffect(() => {
    useRecentlyViewedStore.getState().load();
  }, []);
  const myDivision = useMemo(() => {
    const u: any = authUser || {};
    const a = (u.addresses || []).find((x: any) => x.isDefault) || (u.addresses || [])[0];
    return divisionOf([a?.district, a?.city, u.location, u.district, u.division].filter(Boolean).join(" ")) || "Dhaka";
  }, [authUser]);
  const activeFilterCount = (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (division ? 1 : 0) + (inStockOnly ? 1 : 0);
  const clearFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setDivision(null);
    setInStockOnly(false);
    setSelectedCategory("all");
    setSearchQuery("");
    setSortBy("newest");
  };
  const favItems = useFavoritesStore((st) => st.items);
  const favIds = useMemo(() => new Set(favItems.map((f) => f.itemId)), [favItems]);
  useEffect(() => {
    useFavoritesStore.getState().load();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.seller.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter((p) => p.category?.toLowerCase() === selectedCategory);
    }

    const lo = parseFloat(minPrice);
    const hi = parseFloat(maxPrice);
    if (!Number.isNaN(lo)) result = result.filter((p) => p.price >= lo);
    if (!Number.isNaN(hi)) result = result.filter((p) => p.price <= hi);
    if (division) result = result.filter((p) => divisionOf(p.location) === division);
    if (inStockOnly) result = result.filter((p) => p.quantity === undefined || p.quantity === null || Number(p.quantity) > 0);
    if (sortBy === "nearby") {
      const rank = (p: Product) => (divisionOf(p.location) === myDivision ? 0 : 1);
      result = [...result].sort((a, b) => rank(a) - rank(b));
    }
    if (sortBy === "saved") result = result.filter((p) => favIds.has(String(p.id)));
    if (sortBy === "price_asc") result = [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") result = [...result].sort((a, b) => b.price - a.price);
    if (sortBy === "rating") result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return result;
  }, [products, searchQuery, selectedCategory, sortBy, favIds, minPrice, maxPrice, division, inStockOnly, myDivision]);

  const handleProductPress = useCallback((product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ProductDetail", { product });
  }, [navigation]);

  const handleCompanyPress = useCallback((companyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("StoreView", { companyId });
  }, [navigation]);

  const handleCategoryPress = useCallback((categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(categoryId);
  }, []);

  const unreadNotifications = useUnreadCounts((st) => st.notificationsMarket) // only marketplace notifications on this bell;

  const handleCartPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Cart");
  }, [navigation]);

  // One title only: the app header shows "Marketplace"; Notifications and Cart sit on the right of it.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.marketHeaderActions}>
          {loggedIn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unreadNotifications > 0
                  ? language === "bn" ? `নোটিফিকেশন, ${unreadNotifications}টি নতুন` : `Notifications, ${unreadNotifications} unread`
                  : language === "bn" ? "নোটিফিকেশন" : "Notifications"
              }
              testID="market-bell"
              style={[styles.cartHeaderButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              onPress={() => navigation.navigate("Notifications" as any, { scope: "market" })}
            >
              <AppIcon name="bell" size={20} color={theme.text} />
              <CountBadge count={unreadNotifications} style={{ top: -2, right: -2 }} testID="market-bell-badge" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr("Cart")}
            style={[styles.cartHeaderButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={handleCartPress}
          >
            <AppIcon name="shopping-cart" size={20} color={theme.text} />
            {cartCount > 0 ? (
              <View style={[styles.cartBadge, { backgroundColor: theme.accent }]}>
                <ThemedText style={styles.cartBadgeText}>{cartCount > 9 ? "9+" : cartCount}</ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>
      ),
    });
  }, [navigation, loggedIn, theme, cartCount, unreadNotifications, language, handleCartPress, t, tr]);

  const handleSeeAllShops = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // real shops when there are any; the old sample shops otherwise
    if (shops.length) navigation.navigate("ShopPage", {});
    else navigation.navigate("ShopsHome");
  }, [navigation, shops.length]);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        { 
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        },
        pressed && styles.productPressed,
      ]}
      onPress={() => handleProductPress(item)}
      onLongPress={() => {
        const it: any = item;
        if (it.ownerId && (isSuperAdmin || it.ownerId === myUserId())) setSellForm({ open: true, item: it });
      }}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: item.image }}
          style={styles.productImage}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.05)"]}
          style={styles.imageGradient}
        />
        {Number(item.rating) > 0 ? (
          <View style={styles.ratingBadge}>
            <AppIcon name="star" size={10} color="#FFFFFF" />
            <ThemedText style={styles.ratingBadgeText}>{Number(item.rating).toFixed(1)}</ThemedText>
          </View>
        ) : null}
        {item.quantity !== undefined && item.quantity !== null && Number(item.quantity) <= 0 ? (
          <View style={[styles.stockBadge, { backgroundColor: "#DA2F2F" }]}>
            <ThemedText style={styles.stockBadgeText}>{tr("Out of stock")}</ThemedText>
          </View>
        ) : item.quantity !== undefined && item.quantity !== null && Number(item.quantity) > 0 && Number(item.quantity) < 10 ? (
          <View style={[styles.stockBadge, { backgroundColor: "#B25E09" }]}>
            <ThemedText style={styles.stockBadgeText}>{tr("Only")} {item.quantity} {tr("left")}</ThemedText>
          </View>
        ) : null}
        {item.company?.verified ? (
          <View style={styles.verifiedBadge}>
            <AppIcon name="check" size={10} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={styles.productInfo}>
        <ThemedText style={[styles.productName, { color: theme.text }]} numberOfLines={2}>
          {item.name}
        </ThemedText>
        <View style={styles.priceRow}>
          <ThemedText type="h4" style={[styles.productPrice, { color: theme.accent }]}>
            {item.currency}{item.price}
          </ThemedText>
          <ThemedText style={[styles.unitText, { color: theme.textSecondary }]}>
            /{item.unit}
          </ThemedText>
        </View>
        <Pressable
          style={styles.sellerRow}
          onPress={(e) => {
            e.stopPropagation();
            if (item.companyId) {
              handleCompanyPress(item.companyId);
            }
          }}
        >
          <LinearGradient
            colors={[theme.gradientStart, theme.gradientEnd]}
            style={styles.sellerAvatar}
          >
            <ThemedText style={styles.sellerInitials}>
              {item.company?.initials || item.seller.substring(0, 2).toUpperCase()}
            </ThemedText>
          </LinearGradient>
          <View style={styles.sellerInfo}>
            <ThemedText style={[styles.productSeller, { color: theme.text }]} numberOfLines={1}>
              {item.seller}
            </ThemedText>
            <View style={styles.locationContainer}>
              <AppIcon name="map-pin" size={9} color={theme.textSecondary} />
              <ThemedText style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.location.split(",")[0]}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      </View>
    </Pressable>
  ), [theme, handleProductPress, handleCompanyPress, tr]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          {isBn ? "পণ্য লোড হচ্ছে..." : "Loading products..."}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.searchSection,
          {
            paddingTop: Spacing.md,
            // Maya's pale blue band behind search and categories.
            backgroundColor: theme.backgroundSecondary,
          },
        ]}
      >
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.white, borderColor: theme.cardBorder },
          ]}
        >
          <AppIcon name="search" size={18} color={theme.iconSecondary || theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={isBn ? "পণ্য অনুসন্ধান করুন..." : "Search products..."}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} accessibilityLabel={tr("Clear search")}>
              <AppIcon name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            accessibilityLabel={tr("Filters")}
            style={[styles.filterButton, { backgroundColor: showFilters || activeFilterCount ? theme.primary : theme.backgroundRoot }]}
          >
            <AppIcon name="sliders" size={16} color={showFilters || activeFilterCount ? "#FFFFFF" : theme.text} />
            {activeFilterCount ? <ThemedText style={styles.filterCount}>{activeFilterCount}</ThemedText> : null}
          </Pressable>
        </View>
        {showFilters ? (
          <View style={[styles.filterPanel, { backgroundColor: theme.white, borderColor: theme.cardBorder }]}>
            <ThemedText style={[styles.filterLabel, { color: theme.text }]}>{tr("Price range (৳)")}</ThemedText>
            <View style={styles.priceRow2}>
              <TextInput
                style={[styles.priceInput, { color: theme.text, borderColor: theme.inputBorder || theme.cardBorder, backgroundColor: theme.backgroundRoot }]}
                placeholder={tr("Min")}
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={minPrice}
                onChangeText={(v) => setMinPrice(v.replace(/[^0-9.]/g, ""))}
              />
              <ThemedText style={{ color: theme.textSecondary }}>–</ThemedText>
              <TextInput
                style={[styles.priceInput, { color: theme.text, borderColor: theme.inputBorder || theme.cardBorder, backgroundColor: theme.backgroundRoot }]}
                placeholder={tr("Max")}
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={(v) => setMaxPrice(v.replace(/[^0-9.]/g, ""))}
              />
            </View>
            <ThemedText style={[styles.filterLabel, { color: theme.text }]}>{tr("Division")}</ThemedText>
            <View style={styles.chipWrap}>
              {[{ id: "", bn: "সব" }, ...DIVISIONS].map((d) => {
                const active = (division || "") === d.id;
                return (
                  <Pressable
                    key={d.id || "all"}
                    onPress={() => setDivision(d.id || null)}
                    style={[styles.smallChip, { backgroundColor: active ? theme.primary : theme.card, borderColor: active ? theme.primary : theme.cardBorder }]}
                  >
                    <ThemedText style={[styles.smallChipText, { color: active ? "#FFFFFF" : theme.text }]}>
                      {d.id ? divisionLabel(d.id, isBn) : tr("All")}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.filterFooter}>
              <Pressable
                onPress={() => setInStockOnly((v) => !v)}
                style={[styles.smallChip, { backgroundColor: inStockOnly ? theme.primary : theme.card, borderColor: inStockOnly ? theme.primary : theme.cardBorder }]}
              >
                <AppIcon name={inStockOnly ? "check-square" : "square"} size={13} color={inStockOnly ? "#FFFFFF" : theme.text} />
                <ThemedText style={[styles.smallChipText, { color: inStockOnly ? "#FFFFFF" : theme.text }]}>{tr("In stock only")}</ThemedText>
              </Pressable>
              <Pressable onPress={clearFilters} style={styles.clearBtn}>
                <ThemedText style={{ color: theme.primary, fontWeight: "600", fontSize: 13 }}>{tr("Clear all")}</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          style={styles.chipRowList}
          contentContainerStyle={styles.categoriesContainer}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    selectedCategory === item.id
                      ? theme.primary
                      : theme.card,
                  borderColor: selectedCategory === item.id ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => handleCategoryPress(item.id)}
            >
              <AppIcon 
                name={item.icon as any} 
                size={14} 
                color={selectedCategory === item.id ? "#FFFFFF" : theme.primary} 
              />
              <ThemedText
                style={[
                  styles.categoryText,
                  {
                    color:
                      selectedCategory === item.id ? "#FFFFFF" : theme.text,
                  },
                ]}
              >
                {isBn ? item.labelBn : item.labelEn}
              </ThemedText>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={[
          styles.productsContainer,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        renderItem={renderProduct}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View>

            {recentItems.length > 0 && !searchQuery ? (
              <View style={styles.recentSection}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="h4" style={{ color: theme.text }}>{tr("Recently viewed")}</ThemedText>
                  <Pressable onPress={() => useRecentlyViewedStore.getState().clear()} style={styles.seeAllButton}>
                    <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>{tr("Clear")}</ThemedText>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
                  {recentItems.map((p: any) => (
                    <Pressable
                      key={`recent-${p.id}`}
                      onPress={() => handleProductPress(p)}
                      style={[styles.recentCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    >
                      <Image source={{ uri: p.image }} style={styles.recentImage} contentFit="cover" />
                      <ThemedText style={[styles.recentName, { color: theme.text }]} numberOfLines={1}>{p.name}</ThemedText>
                      <ThemedText style={[styles.recentPrice, { color: theme.accent }]} numberOfLines={1}>
                        {p.currency || "৳"}{p.price}{p.unit ? `/${p.unit}` : ""}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.resultRow}>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                {filteredProducts.length} {tr("products found")}
              </ThemedText>
              {activeFilterCount || selectedCategory !== "all" || searchQuery || sortBy !== "newest" ? (
                <Pressable onPress={clearFilters} accessibilityLabel={tr("Clear all")}>
                  <ThemedText style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>{tr("Clear all")}</ThemedText>
                </Pressable>
              ) : null}
            </View>

            {shops.length > 0 || companies.length > 0 ? (
            <View style={styles.shopsSection}>
              <View style={styles.sectionHeader}>
                <ThemedText type="h4" style={{ color: theme.text }}>
                  {isBn ? "দোকান সমূহ" : "Shops"}
                </ThemedText>
                <Pressable onPress={handleSeeAllShops} style={styles.seeAllButton}>
                  <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>
                    {isBn ? "সব দেখুন" : "See All"}
                  </ThemedText>
                  <AppIcon name="chevron-right" size={16} color={theme.primary} />
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shopsContainer}
              >
                {shops.slice(0, 10).map((shop) => (
                  <Pressable
                    key={shop.id}
                    testID={`market-shop-${shop.slug}`}
                    style={[styles.shopCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate("ShopPage", { slug: shop.slug }); }}
                  >
                    <ShopLogo shop={shop} size={48} />
                    <ThemedText style={[styles.shopName, { color: theme.text }]} numberOfLines={1}>
                      {shop.name}
                    </ThemedText>
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={1}>
                      {isBn ? `${shop.products || 0}টি পণ্য` : `${shop.products || 0} products`}
                    </ThemedText>
                  </Pressable>
                ))}
                {(shops.length ? [] : companies.slice(0, 5)).map((company) => (
                  <Pressable
                    key={company.id}
                    style={[styles.shopCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    onPress={() => handleCompanyPress(company.id)}
                  >
                    <LinearGradient
                      colors={[theme.primary, theme.primary + "CC"]}
                      style={styles.shopAvatar}
                    >
                      <ThemedText style={styles.shopInitials}>
                        {company.initials}
                      </ThemedText>
                    </LinearGradient>
                    <ThemedText style={[styles.shopName, { color: theme.text }]} numberOfLines={1}>
                      {company.name}
                    </ThemedText>
                    {company.verified ? (
                      <View style={[styles.verifiedTag, { backgroundColor: theme.primary + "15" }]}>
                        <AppIcon name="check-circle" size={10} color={theme.primary} />
                        <ThemedText style={[styles.verifiedTagText, { color: theme.primary }]}>
                          {isBn ? "যাচাইকৃত" : "Verified"}
                        </ThemedText>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.productsSectionHeader}>
                <ThemedText type="h4" style={{ color: theme.text }}>
                  {isBn ? "পণ্যসমূহ" : "Products"}
                </ThemedText>
              </View>
            </View>
          ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppIcon name="package" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isBn ? "কোনো পণ্য পাওয়া যায়নি" : "No products found"}
            </ThemedText>
          </View>
        }
      />

      <CatalogFormModal
        visible={sellForm.open}
        title={sellForm.item ? t("market.editListing") : t("market.sell")}
        fields={SELL_FIELDS}
        initial={sellForm.item}
        submitLabel={t("common.save")}
        onClose={() => setSellForm({ open: false, item: null })}
        onSubmit={saveListing}
        deleteLabel={t("common.delete")}
        onDelete={
          sellForm.item
            ? async () => {
                try {
                  await deleteCatalogItem("listings", sellForm.item!.id);
                } catch {}
                setSellForm({ open: false, item: null });
                loadProducts();
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sellButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    marginRight: 8,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  filterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  filterCount: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", marginLeft: 1 },
  filterPanel: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: MayaRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  filterLabel: { fontSize: 13, fontWeight: "600" },
  priceRow2: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  priceInput: { flex: 1, minWidth: 0, height: 40, borderWidth: 1, borderRadius: MayaRadius.md, paddingHorizontal: Spacing.md, fontSize: 14 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  smallChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  smallChipText: { fontSize: 12, fontWeight: "500" },
  filterFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: Spacing.sm },
  clearBtn: { paddingVertical: 6, paddingHorizontal: Spacing.sm },
  stockBadge: {
    position: "absolute",
    left: Spacing.sm,
    bottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    maxWidth: "90%",
  },
  stockBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  recentSection: { marginBottom: Spacing.md },
  recentCard: { width: 112, borderRadius: MayaRadius.md, borderWidth: 1, overflow: "hidden", paddingBottom: Spacing.xs },
  recentImage: { width: "100%", height: 72 },
  recentName: { fontSize: 12, fontWeight: "600", paddingHorizontal: 6, marginTop: 4 },
  recentPrice: { fontSize: 12, fontWeight: "700", paddingHorizontal: 6 },
  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  marketHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginRight: Spacing.lg,
  },
  cartHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cartBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 50,
    borderRadius: MayaRadius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
    ...Shadows.small,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    textAlignVertical: "center",
  },
  // Two chip rows (categories, then sort) with clear space between and around them.
  chipRowList: {
    flexGrow: 0,
  },
  categoriesContainer: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
    paddingRight: Spacing.sm,
    gap: 10,
    alignItems: "center",
  },
  sortRow: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 6,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    justifyContent: "center",
  },
  categoryText: {
    lineHeight: 18,
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
  },
  productsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  productRow: {
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  productCard: {
    width: CARD_WIDTH,
    borderRadius: MayaRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    ...Shadows.small,
  },
  productPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  imageWrapper: {
    position: "relative",
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: 130,
  },
  imageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
  },
  ratingBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 3,
  },
  ratingBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  verifiedBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: "#37B1FF",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: {
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.md,
  },
  productPrice: {
    fontSize: 17,
    fontWeight: "700",
  },
  unitText: {
    fontSize: 12,
    marginLeft: 2,
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sellerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sellerInitials: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  sellerInfo: {
    flex: 1,
  },
  productSeller: {
    fontSize: 12,
    fontWeight: "600",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontSize: 10,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
  },
  quickFeaturesRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  quickFeatureBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    ...Shadows.small,
  },
  quickFeatureText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  cartFab: {
    position: "absolute",
    right: Spacing.lg,
    bottom: 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.small,
  },
  shopsSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  shopsContainer: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  shopCard: {
    width: 100,
    padding: Spacing.md,
    borderRadius: MayaRadius.xl,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.sm,
  },
  shopAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  shopInitials: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  shopName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: "600",
  },
  productsSectionHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
});
