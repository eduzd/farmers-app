import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Company, CompanyProduct, getCompany, getCompanyProducts } from "@/lib/storage";
import { useCartStore } from "@/lib/cartStore";

import { tr, useTr } from "@/lib/tr";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PRODUCT_CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2;

const PRODUCT_CATEGORIES = [
  { id: "all", label: "সব", icon: "grid" },
  { id: "seeds", label: "বীজ", icon: "sun" },
  { id: "fertilizer", label: "সার", icon: "droplet" },
  { id: "pesticide", label: "কীটনাশক", icon: "shield" },
  { id: "equipment", label: "যন্ত্রপাতি", icon: "tool" },
  { id: "feed", label: "খাদ্য", icon: "package" },
  { id: "medicine", label: "ওষুধ", icon: "heart" },
  { id: "organic", label: "অর্গানিক", icon: "zap" },
  { id: "other", label: "অন্যান্য", icon: "more-horizontal" },
];

const COMPANY_CATEGORIES: Record<string, string> = {
  seeds: "বীজ ও চারা",
  fertilizer: "সার ও কীটনাশক",
  equipment: "কৃষি যন্ত্রপাতি",
  feed: "পশু খাদ্য",
  medicine: "পশু ওষুধ",
  organic: "অর্গানিক পণ্য",
  dairy: "দুগ্ধ প্রক্রিয়াজাতকরণ",
  fish: "মাছ চাষ সামগ্রী",
  poultry: "পোল্ট্রি সামগ্রী",
  other: "অন্যান্য",
};

type StoreViewScreenRouteProp = RouteProp<RootStackParamList, "StoreView">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function StoreViewScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<StoreViewScreenRouteProp>();
  const { companyId } = route.params;

  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<CompanyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "about" | "reviews">("products");
  
  const { addItem, getItemCount } = useCartStore();
  const cartItemCount = getItemCount();
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.7],
    extrapolate: "clamp",
  });
  
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  useEffect(() => {
    loadStoreData();
  }, [companyId]);

  const loadStoreData = async () => {
    setIsLoading(true);
    try {
      const companyData = await getCompany(companyId);
      const productsData = await getCompanyProducts(companyId);
      setCompany(companyData);
      setProducts(productsData);
    } catch (error) {
      console.error("Error loading store:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => p.status === "active");

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter((p) => p.category === selectedCategory);
    }

    return result;
  }, [products, searchQuery, selectedCategory]);

  const handleFollow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsFollowing(!isFollowing);
  };

  const handleMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (company) {
      navigation.navigate("Chat", {
        conversationId: `store_${company.id}`,
        userName: company.name,
        userInitials: company.initials,
      });
    }
  };

  const handleProductPress = (product: CompanyProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (company) {
      navigation.navigate("ProductDetail", {
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency || "৳",
          unit: product.unit,
          seller: company.name,
          sellerId: company.id,
          location: company.address || "",
          rating: product.rating || company.rating,
          image: product.images?.[0] || "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400",
          description: product.description,
          quantity: product.quantity,
          category: product.category,
          companyId: company.id,
          company: {
            name: company.name,
            initials: company.initials,
            verified: company.verified,
            rating: company.rating,
            location: company.address || "",
          },
        },
      });
    }
  };

  const handleAddToCart = (product: CompanyProduct) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency || "BDT",
      unit: product.unit,
      quantity: 1,
      image: product.images?.[0] || "",
      seller: company?.name || "",
    });
  };

  const renderStars = (rating: number) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Feather
          key={star}
          name="star"
          size={14}
          color={star <= rating ? "#F5B700" : theme.textSecondary + "40"}
        />
      ))}
    </View>
  );

  const renderProduct = ({ item }: { item: CompanyProduct }) => (
    <Pressable
      style={[styles.productCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      onPress={() => handleProductPress(item)}
    >
      <View style={[styles.productImage, { backgroundColor: theme.surface }]}>
        <Feather name="package" size={36} color={theme.textSecondary} />
      </View>
      <View style={styles.productInfo}>
        <ThemedText numberOfLines={2} style={styles.productName}>{item.name}</ThemedText>
        <ThemedText style={[styles.productPrice, { color: theme.primary }]}>
          ৳{item.price.toLocaleString()}/{item.unit}
        </ThemedText>
        <View style={styles.productMeta}>
          <View style={[styles.stockBadge, { backgroundColor: item.quantity > 0 ? "#16A34A15" : "#DC262615" }]}>
            <ThemedText style={[styles.stockText, { color: item.quantity > 0 ? "#16A34A" : "#DC2626" }]}>
              {item.quantity > 0 ? "স্টকে আছে" : "স্টক আউট"}
            </ThemedText>
          </View>
        </View>
        {item.quantity > 0 ? (
          <Pressable
            style={[styles.addToCartButton, { backgroundColor: theme.primary }]}
            onPress={(e) => {
              e.stopPropagation();
              handleAddToCart(item);
            }}
          >
            <Feather name="shopping-cart" size={14} color="#FFFFFF" />
            <ThemedText style={styles.addToCartText}>{tr("কার্টে যোগ করুন")}</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!company) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          {tr("স্টোর পাওয়া যায়নি")}
        </ThemedText>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={styles.backButtonText}>{tr("ফিরে যান")}</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View 
        style={[
          styles.floatingHeader, 
          { 
            paddingTop: insets.top + Spacing.sm,
            opacity: headerOpacity,
          }
        ]}
        pointerEvents="box-none"
      >
        <Animated.View style={[
          styles.floatingHeaderBg,
          { 
            backgroundColor: theme.backgroundRoot,
            opacity: headerBgOpacity,
          }
        ]} />
        <Pressable
          style={[styles.floatingButton, { backgroundColor: "rgba(0,0,0,0.3)" }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={[styles.floatingButton, { backgroundColor: "rgba(0,0,0,0.3)" }]}
          onPress={() => navigation.navigate("Cart")}
        >
          <Feather name="shopping-cart" size={20} color="#FFFFFF" />
          {cartItemCount > 0 ? (
            <View style={[styles.floatingCartBadge, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.floatingCartBadgeText}>
                {cartItemCount > 9 ? "9+" : cartItemCount}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={[theme.primary, theme.primary + "CC"]}
          style={[styles.headerSection, { paddingTop: insets.top + Spacing["4xl"] }]}
        >

          <View style={styles.storeHeader}>
            <View style={[styles.storeLogo, { backgroundColor: theme.white }]}>
              <ThemedText style={[styles.logoText, { color: theme.primary }]}>
                {company.initials}
              </ThemedText>
            </View>
            <View style={styles.storeInfo}>
              <View style={styles.storeNameRow}>
                <ThemedText style={styles.storeName}>{company.name}</ThemedText>
                {company.verified ? (
                  <View style={styles.verifiedBadge}>
                    <Feather name="check" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <ThemedText style={styles.storeCategory}>
                {COMPANY_CATEGORIES[company.category] || company.category}
              </ThemedText>
              <View style={styles.storeMetaRow}>
                <View style={styles.storeMetaItem}>
                  <Feather name="star" size={14} color="#F5B700" />
                  <ThemedText style={styles.storeMetaText}>
                    {company.rating.toFixed(1)} ({company.reviewsCount})
                  </ThemedText>
                </View>
                <View style={styles.storeMetaItem}>
                  <Feather name="users" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.storeMetaText}>
                    {company.followersCount} ফলোয়ার
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <Pressable
              style={[
                styles.followButton,
                isFollowing
                  ? { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.5)" }
                  : { backgroundColor: "#FFFFFF" },
              ]}
              onPress={handleFollow}
            >
              <AppIcon
                name={isFollowing ? "check" : "user-plus"}
                size={16}
                color={isFollowing ? "#FFFFFF" : theme.primary}
              />
              <ThemedText
                style={[styles.followButtonText, { color: isFollowing ? "#FFFFFF" : theme.primary }]}
              >
                {isFollowing ? "ফলো করছেন" : "ফলো করুন"}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.messageButton, { borderColor: "rgba(255,255,255,0.5)" }]}
              onPress={handleMessage}
            >
              <ChatIcon size={16} color="#FFFFFF" />
              <ThemedText style={styles.messageButtonText}>{tr("মেসেজ")}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{company.productsCount}</ThemedText>
              <ThemedText style={styles.statLabel}>{tr("পণ্য")}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{company.totalSales || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>{tr("বিক্রয়")}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{company.responseRate || 100}%</ThemedText>
              <ThemedText style={styles.statLabel}>{tr("রেসপন্স")}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{company.shipOnTime || 100}%</ThemedText>
              <ThemedText style={styles.statLabel}>{tr("অন-টাইম")}</ThemedText>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.tabSection, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.tabBar, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Pressable
              style={[styles.tab, activeTab === "products" && { backgroundColor: theme.primary + "15" }]}
              onPress={() => setActiveTab("products")}
            >
              <Feather name="grid" size={18} color={activeTab === "products" ? theme.primary : theme.textSecondary} />
              <ThemedText style={[styles.tabText, activeTab === "products" && { color: theme.primary }]}>
                পণ্য ({products.length})
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "about" && { backgroundColor: theme.primary + "15" }]}
              onPress={() => setActiveTab("about")}
            >
              <Feather name="info" size={18} color={activeTab === "about" ? theme.primary : theme.textSecondary} />
              <ThemedText style={[styles.tabText, activeTab === "about" && { color: theme.primary }]}>
                {tr("সম্পর্কে")}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "reviews" && { backgroundColor: theme.primary + "15" }]}
              onPress={() => setActiveTab("reviews")}
            >
              <Feather name="star" size={18} color={activeTab === "reviews" ? theme.primary : theme.textSecondary} />
              <ThemedText style={[styles.tabText, activeTab === "reviews" && { color: theme.primary }]}>
                রিভিউ ({company.reviewsCount})
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {activeTab === "products" ? (
          <View style={styles.productsSection}>
            <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Feather name="search" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder={tr("এই স্টোরে খুঁজুন...")}
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    { borderColor: theme.cardBorder },
                    selectedCategory === cat.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <AppIcon
                    name={cat.icon as any}
                    size={14}
                    color={selectedCategory === cat.id ? "#FFFFFF" : theme.textSecondary}
                  />
                  <ThemedText
                    style={[styles.categoryChipText, selectedCategory === cat.id && { color: "#FFFFFF" }]}
                  >
                    {cat.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {filteredProducts.length > 0 ? (
              <View style={styles.productsGrid}>
                {filteredProducts.map((product, index) => (
                  <View key={product.id}>
                    {renderProduct({ item: product })}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyProducts}>
                <Feather name="package" size={48} color={theme.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {searchQuery || selectedCategory !== "all" ? "কোনো পণ্য পাওয়া যায়নি" : "এই স্টোরে কোনো পণ্য নেই"}
                </ThemedText>
              </View>
            )}
          </View>
        ) : activeTab === "about" ? (
          <View style={styles.aboutSection}>
            <View style={[styles.aboutCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <ThemedText type="h4" style={styles.aboutTitle}>{tr("স্টোর সম্পর্কে")}</ThemedText>
              <ThemedText style={[styles.aboutText, { color: theme.text }]}>
                {company.description || "কোনো বিবরণ নেই"}
              </ThemedText>
            </View>

            <View style={[styles.aboutCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <ThemedText type="h4" style={styles.aboutTitle}>{tr("যোগাযোগ")}</ThemedText>
              <View style={styles.contactList}>
                <View style={styles.contactItem}>
                  <Feather name="map-pin" size={18} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.text, flex: 1 }}>{company.address || "ঠিকানা নেই"}</ThemedText>
                </View>
                <View style={styles.contactItem}>
                  <Feather name="mail" size={18} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.text }}>{company.email || "ইমেইল নেই"}</ThemedText>
                </View>
                <View style={styles.contactItem}>
                  <Feather name="clock" size={18} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.text }}>{company.businessHours || "সকাল ৯টা - রাত ৯টা"}</ThemedText>
                </View>
              </View>
            </View>

            <View style={[styles.aboutCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <ThemedText type="h4" style={styles.aboutTitle}>{tr("স্টোর পলিসি")}</ThemedText>
              <View style={styles.policyItem}>
                <View style={[styles.policyIcon, { backgroundColor: "#16A34A20" }]}>
                  <Feather name="refresh-cw" size={16} color="#16A34A" />
                </View>
                <View style={styles.policyInfo}>
                  <ThemedText style={styles.policyLabel}>{tr("রিটার্ন পলিসি")}</ThemedText>
                  <ThemedText style={[styles.policyText, { color: theme.textSecondary }]}>
                    {company.returnPolicy || "৭ দিনের মধ্যে রিটার্ন"}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.policyItem}>
                <View style={[styles.policyIcon, { backgroundColor: "#2563EB20" }]}>
                  <Feather name="truck" size={16} color="#2563EB" />
                </View>
                <View style={styles.policyInfo}>
                  <ThemedText style={styles.policyLabel}>{tr("শিপিং")}</ThemedText>
                  <ThemedText style={[styles.policyText, { color: theme.textSecondary }]}>
                    {company.shippingPolicy || "সারা বাংলাদেশে ডেলিভারি"}
                  </ThemedText>
                </View>
              </View>
            </View>

            {company.paymentMethods && company.paymentMethods.length > 0 ? (
              <View style={[styles.aboutCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <ThemedText type="h4" style={styles.aboutTitle}>{tr("পেমেন্ট পদ্ধতি")}</ThemedText>
                <View style={styles.paymentMethods}>
                  {company.paymentMethods.map((method) => (
                    <View key={method} style={[styles.paymentBadge, { backgroundColor: theme.primary + "15" }]}>
                      <Feather name="check-circle" size={14} color={theme.primary} />
                      <ThemedText style={[styles.paymentText, { color: theme.primary }]}>
                        {method === "cash" ? "ক্যাশ" : method === "bkash" ? "বিকাশ" : method === "nagad" ? "নগদ" : method === "rocket" ? "রকেট" : "ব্যাংক"}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.reviewsSection}>
            <View style={[styles.reviewsSummary, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.ratingSummary}>
                <ThemedText style={styles.bigRating}>{company.rating.toFixed(1)}</ThemedText>
                {renderStars(Math.round(company.rating))}
                <ThemedText style={[styles.reviewCount, { color: theme.textSecondary }]}>
                  {company.reviewsCount} টি রিভিউ
                </ThemedText>
              </View>
            </View>

            {company.reviewsCount === 0 ? (
              <View style={styles.emptyReviews}>
                <Feather name="star" size={48} color={theme.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {tr("এই স্টোরে এখনো কোনো রিভিউ নেই")}
                </ThemedText>
              </View>
            ) : null}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 100,
  },
  floatingHeaderBg: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingCartBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  floatingCartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 16,
  },
  backButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  headerSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#DC2626",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  storeLogo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.medium,
  },
  logoText: {
    fontSize: 26,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  storeInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  storeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  storeName: {
    fontSize: 20,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFFFFF",
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1DA1F2",
    justifyContent: "center",
    alignItems: "center",
  },
  storeCategory: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
    fontSize: 13,
  },
  storeMetaRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  storeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  storeMetaText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  followButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "transparent",
    gap: Spacing.sm,
  },
  followButtonText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
  },
  messageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  messageButtonText: {
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  statLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  tabSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xs,
    ...Shadows.small,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  productsSection: {
    paddingHorizontal: Spacing.lg,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  categoriesContainer: {
    paddingBottom: Spacing.md,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
  },
  categoryChipText: {
    fontSize: 12,
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: PRODUCT_CARD_WIDTH,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
    ...Shadows.small,
  },
  productImage: {
    width: "100%",
    height: PRODUCT_CARD_WIDTH * 0.8,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    padding: Spacing.md,
  },
  productName: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  productPrice: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  productMeta: {
    marginTop: Spacing.sm,
  },
  stockBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  stockText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  addToCartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  addToCartText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  emptyProducts: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  aboutSection: {
    paddingHorizontal: Spacing.lg,
  },
  aboutCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  aboutTitle: {
    marginBottom: Spacing.md,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
  },
  contactList: {
    gap: Spacing.md,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  policyItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  policyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  policyInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  policyLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  policyText: {
    fontSize: 13,
    marginTop: 2,
  },
  paymentMethods: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  paymentText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  reviewsSection: {
    paddingHorizontal: Spacing.lg,
  },
  reviewsSummary: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  ratingSummary: {
    alignItems: "center",
  },
  bigRating: {
    fontSize: 48,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  starsContainer: {
    flexDirection: "row",
    gap: 2,
    marginTop: Spacing.xs,
  },
  reviewCount: {
    marginTop: Spacing.sm,
    fontSize: 13,
  },
  emptyReviews: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
});
