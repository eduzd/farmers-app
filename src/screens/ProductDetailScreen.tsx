import { useMarketCategories, categoryLabel } from "@/lib/marketCategories";
import { MayaRadius } from "@/constants/mayaTheme";
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
  FlatList,
  Platform,
  Share,
  Linking,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanimated from "react-native-reanimated";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCartStore } from "@/lib/cartStore";
import { useI18n } from "@/lib/i18n";

import { tr, useTr } from "@/lib/tr";
import { useFavoritesStore } from "@/lib/favoritesStore";
import { publicLink } from "@/lib/guestOrders";
import { apiGet, apiPost, isLoggedIn, currentUserId, timeAgo } from "@/lib/api";
import { CatalogFormModal } from "@/components/CatalogFormModal";
import { useRecentlyViewedStore } from "@/lib/recentlyViewedStore";
import { fetchCatalog } from "@/lib/catalog";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
import { BuyerPreviewBar, readPreview, usePreviewNote } from "@/components/BuyerPreview";
const money2 = (n: number) => (Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
import { sellRule, clampQty as clampToRule, upperLimit, perUnitText, amountText, totalContentText, unitWord, num } from "@shared/selling";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.42;

type ProductDetailRouteProp = RouteProp<RootStackParamList, "ProductDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SAMPLE_IMAGES: any[] = [];

export default function ProductDetailScreen() {
  const tr = useTr();
  const realInsets = useSafeAreaInsets();
  const route = useRoute<ProductDetailRouteProp>();
  // Opened from the admin app's "View as buyer": same page, nothing on it buys, saves or sends.
  const preview = readPreview(route.params);
  // In preview the bar on top already sits under the status bar.
  const insets = preview ? { ...realInsets, top: 0 } : realInsets;
  const previewNote = usePreviewNote(110);
  // Footer (quantity box + buttons): above the navigation bar, and it rides on
  // top of the keyboard while the quantity is being typed.
  const footerKeyboard = useKeyboardAwareBottomPadding(12, { follow: true, min: 20 });
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  // Listings from the Sell form may leave out seller, rating, location, currency or image.
  const raw: any = route.params.product || {};
  const product = useMemo(() => ({
    ...raw,
    price: Number(raw.price) || 0,
    rating: Number(raw.rating) || 0,
    currency: raw.currency || "৳",
    seller: raw.seller || raw.ownerName || "Farmer",
    location: raw.location || "",
    unit: raw.unit || "",
    image: raw.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400",
  }) as typeof route.params.product, [raw]);
  const { addItem, getItemCount } = useCartStore();
  const { t, language } = useI18n();

  // How this product is sold (set in the admin dashboard / Seller Hub): unit, step, minimum, maximum, stock, quick amounts.
  const rule = useMemo(() => sellRule(product), [product]);
  const stock: number | null = rule.stock;
  const minOrder = rule.min;
  const maxQty = upperLimit(rule);
  const outOfStock = stock !== null && (stock <= 0 || stock < minOrder);
  const [quantity, setQuantity] = useState(minOrder);
  const [qtyDraft, setQtyDraft] = useState<string | null>(null);
  // Seller-defined options (size, weight, grade...). Each choice may add to the unit price.
  const optionGroups: { name: string; choices: { label: string; extra: number }[] }[] = Array.isArray((product as any).options)
    ? (product as any).options.filter((g: any) => g?.name && Array.isArray(g?.choices) && g.choices.length)
    : [];
  const [picked, setPicked] = useState<Record<string, string>>({});
  const missingOption = optionGroups.find((g) => !picked[g.name]);
  const unitPrice =
    Number(product.price || 0) +
    optionGroups.reduce((sum, g) => sum + (Number(g.choices.find((c) => c.label === picked[g.name])?.extra) || 0), 0);
  const clampQty = (n: number) => clampToRule(rule, n);
  const bn = language === "bn";
  // Quick amounts the admin set, or a few handy ones made from the step and minimum.
  const quickAmounts = useMemo(() => {
    if (rule.presets.length) return rule.presets.filter((a) => a <= maxQty + 1e-9);
    const base = [1, 2, 5, 10].map((k) => clampQty(minOrder * k));
    return [...new Set(base)].filter((a) => a >= minOrder && a <= maxQty + 1e-9).slice(0, 4);
  }, [rule, maxQty]);
  const amountRules = [
    rule.step !== 1 ? (bn ? `প্রতি ধাপে ${amountText(rule, rule.step, true)}` : `In steps of ${amountText(rule, rule.step)}`) : "",
    minOrder !== rule.step ? (bn ? `সর্বনিম্ন ${amountText(rule, minOrder, true)}` : `Minimum ${amountText(rule, minOrder)}`) : "",
    rule.max !== null ? (bn ? `সর্বোচ্চ ${amountText(rule, rule.max, true)}` : `Maximum ${amountText(rule, rule.max)}`) : "",
    stock !== null ? (bn ? `স্টকে ${amountText(rule, stock, true)}` : `${amountText(rule, stock)} in stock`) : "",
  ].filter(Boolean).join(" · ");
  const [related, setRelated] = useState<any[]>([]);
  useEffect(() => {
    if (!preview) useRecentlyViewedStore.getState().add(product);
    fetchCatalog<any>("listings")
      .then((all) => {
        const others = all.filter((p) => String(p.id) !== String(product.id));
        const same = others.filter((p) => p.category && p.category === product.category);
        setRelated([...same, ...others.filter((p) => !same.includes(p))].slice(0, 8));
      })
      .catch(() => {});
  }, [product.id]);
  const savedByMe = useFavoritesStore((st) => st.items.some((i) => i.itemId === String(product.id)));
  // in preview the heart shows as a new buyer sees it, not the admin's own saved list
  const isFavorite = preview ? false : savedByMe;
  const toggleFavorite = useFavoritesStore((st) => st.toggle);
  const marketCats = useMarketCategories();
  const ownerId: string | undefined = (product as any).ownerId || undefined;
  const isMine = !!ownerId && ownerId === currentUserId();
  // company shops are run by the Farmers admins: no account to follow, questions go to Farmers Support
  const companyShop = !!ownerId && ownerId.startsWith("company-");
  const storeSlug: string | undefined = (product as any).storeSlug || (product as any).storeId || undefined;
  const [reviews, setReviews] = useState<{ reviews: any[]; count: number; average: number }>({ reviews: [], count: 0, average: 0 });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const loadReviews = () =>
    apiGet(`/api/reviews/${encodeURIComponent(String(product.id))}`).then(setReviews).catch(() => {});
  useEffect(() => {
    useFavoritesStore.getState().load();
    loadReviews();
    if (ownerId && !companyShop && !preview) apiGet(`/api/follows/${ownerId}`).then((r) => setFollowing(!!r.isFollowing)).catch(() => {});
  }, [product.id]);
  const handleFollow = async () => {
    if (!ownerId) return;
    if (preview) return previewNote.show(tr("Follow"));
    if (!isLoggedIn()) return Alert.alert(tr("Log in to follow farmers"));
    try {
      const r = await apiPost(`/api/follows/${ownerId}`);
      setFollowing(!!r.following);
    } catch (e: any) {
      Alert.alert(tr("Couldn't follow"), e.message);
    }
  };
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  // the admin's own cart has nothing to do with what a buyer sees
  const cartCount = preview ? 0 : getItemCount();
  const scrollX = useRef(new Animated.Value(0)).current;

  const productImages = (product as any).images?.length ? (product as any).images : [product.image].filter(Boolean);

  const handleAddToCart = () => {
    if (outOfStock) return;
    if (preview) return previewNote.show(tr("Add to cart"));
    if (missingOption) return Alert.alert(tr("Choose an option"), `${tr("Please choose")}: ${missingOption.name}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem({
      productId: product.id,
      name: product.name,
      price: unitPrice,
      ...(optionGroups.length ? { options: picked } : {}),
      currency: product.currency,
      unit: rule.unit,
      quantity,
      image: product.image,
      seller: product.seller,
      sale: { sellAs: rule.sellAs, step: rule.step, min: rule.min, max: rule.max, stock: rule.stock, packSize: rule.packSize, packUnit: rule.packUnit },
    });
  };

  const handleBuyNow = () => {
    if (outOfStock) return;
    if (preview) return previewNote.show(language === "bn" ? "কিনুন" : "Buy");
    if (missingOption) return Alert.alert(tr("Choose an option"), `${tr("Please choose")}: ${missingOption.name}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addItem({
      productId: product.id,
      name: product.name,
      price: unitPrice,
      ...(optionGroups.length ? { options: picked } : {}),
      currency: product.currency,
      unit: rule.unit,
      quantity,
      image: product.image,
      seller: product.seller,
      sale: { sellAs: rule.sellAs, step: rule.step, min: rule.min, max: rule.max, stock: rule.stock, packSize: rule.packSize, packUnit: rule.packUnit },
    });
    navigation.navigate("Cart");
  };

  const increaseQuantity = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuantity((q) => (q + rule.step > maxQty + 1e-9 ? q : clampQty(q + rule.step)));
  };

  const decreaseQuantity = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (quantity > minOrder) setQuantity((q) => clampQty(q - rule.step));
  };

  const handleToggleFavorite = () => {
    if (preview) return previewNote.show(language === "bn" ? "পছন্দ" : "Save");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite({
      itemId: String(product.id),
      name: product.name,
      price: product.price,
      image: product.image,
      seller: product.seller,
      unit: product.unit,
      currency: product.currency,
      inStock: (product as any).inStock !== false,
      product,
    });
  };

  const handleShare = async () => {
    if (preview) return previewNote.show(language === "bn" ? "শেয়ার" : "Share");
    // Shop products get their own link that opens without an account (guest checkout).
    const linkable = !!((product as any).storeSlug || (product as any).ownerId) && !product.companyId;
    const url = linkable ? publicLink(`/product/${encodeURIComponent(String(product.id))}`) : publicLink("/");
    const message = `${product.name} - ৳${product.price}${product.unit ? "/" + product.unit : ""} (${product.seller}) on Farmers`;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined") {
        const nav: any = navigator;
        if (nav.share) {
          await nav.share({ title: product.name, text: message, url });
        } else if (nav.clipboard) {
          await nav.clipboard.writeText(`${message} ${url}`);
          Alert.alert(tr("Copied"), language === "bn" ? "পণ্যের লিংক কপি হয়েছে।" : "Product link copied.");
        }
      } else {
        await Share.share({ message: `${message}\n${url}` });
      }
    } catch {}
  };

  const handleCallSeller = () => {
    if (preview) return previewNote.show(language === "bn" ? "কল" : "Call");
    const phone = (product as any).phone || (product as any).company?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => Alert.alert(tr("Call"), phone));
    } else {
      Alert.alert(
        "No phone number",
        "This seller hasn't shared a phone number. Send them a message instead. বিক্রেতার ফোন নম্বর নেই, মেসেজ পাঠান।",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Message", onPress: handleContactSeller },
        ]
      );
    }
  };

  const handleContactSeller = () => {
    if (preview) return previewNote.show(language === "bn" ? "মেসেজ" : "Message");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (companyShop) {
      navigation.navigate("Support" as any);
      return;
    }
    if (!isLoggedIn()) {
      // Guests can buy without an account, but chat needs one.
      const bn = language === "bn";
      Alert.alert(
        bn ? "মেসেজ পাঠাতে লগ ইন করুন" : "Log in to message the seller",
        bn ? "অ্যাকাউন্ট ছাড়াই কেনা যায়। বিক্রেতাকে মেসেজ পাঠাতে লগ ইন করুন।" : "You can buy without an account. To chat with the seller, please log in.",
        [
          { text: bn ? "বাতিল" : "Cancel", style: "cancel" },
          { text: bn ? "লগ ইন" : "Log in", onPress: () => navigation.navigate("Login" as any) },
        ]
      );
      return;
    }
    navigation.navigate("Chat", {
      conversationId: ownerId || product.companyId || "seller",
      userName: product.seller,
      userInitials: product.seller.substring(0, 2).toUpperCase(),
    });
  };

  const features = [
    { icon: "check-circle", label: "তাজা পণ্য", color: "#16A34A" },
    { icon: "sun", label: "অর্গানিক", color: "#16A34A" },
    { icon: "shield", label: "গুণমান নিশ্চিত", color: "#2563EB" },
    { icon: "truck", label: "দ্রুত ডেলিভারি", color: "#EA8A0C" },
  ];

  const specs = [
    { label: "স্টক", value: stock === null ? tr("In stock") : outOfStock ? tr("Out of stock") : amountText(rule, stock, bn), icon: "package" },
    ...(minOrder !== 1 ? [{ label: tr("Minimum order"), value: amountText(rule, minOrder, bn), icon: "shopping-bag" }] : []),
    ...((product as any).sold ? [{ label: tr("Sold"), value: amountText(rule, Number((product as any).sold), bn), icon: "trending-up" }] : []),
    { label: tr("Category"), value: categoryLabel(marketCats, product.category, language === "bn") || tr("Other"), icon: "grid" },
    { label: "উৎস", value: product.location || "ঢাকা", icon: "map-pin" },
    { label: "ডেলিভারি", value: "২-৩ দিন", icon: "clock" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]} testID={preview ? "product-preview" : undefined}>
      {preview ? <BuyerPreviewBar info={preview} topInset={realInsets.top} onClose={() => navigation.goBack()} /> : null}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <View style={styles.imageSection}>
          <FlatList
            data={productImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveImageIndex(index);
            }}
            renderItem={({ item }) => (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: item }}
                  style={styles.productImage}
                  contentFit="cover"
                  transition={300}
                />
              </View>
            )}
            keyExtractor={(_: string, index: number) => index.toString()}
          />
          
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent"]}
            style={styles.topGradient}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.3)"]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          <View style={[styles.floatingHeader, { paddingTop: insets.top + Spacing.sm }]}>
            <Pressable
              style={[styles.headerButton, { backgroundColor: "rgba(255,255,255,0.95)" }]}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : null)}
            >
              <AppIcon name="arrow-left" size={22} color="#1A1A1A" />
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable
                style={[styles.headerButton, { backgroundColor: "rgba(255,255,255,0.95)" }]}
                onPress={handleToggleFavorite}
              >
                <AppIcon 
                  name="heart" 
                  size={20} 
                  color={isFavorite ? theme.accent : "#202936"}
                  fill={isFavorite ? theme.accent : "none"}
                />
              </Pressable>
              <Pressable
                style={[styles.headerButton, { backgroundColor: "rgba(255,255,255,0.95)" }]}
                onPress={handleShare}
              >
                <AppIcon name="share-2" size={20} color="#1A1A1A" />
              </Pressable>
            </View>
          </View>

          <View style={styles.imagePagination}>
            {productImages.map((_: string, index: number) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  activeImageIndex === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>

          {product.company?.verified ? (
            <View style={styles.verifiedBadge}>
              <AppIcon name="check" size={12} color="#FFFFFF" />
              <ThemedText style={styles.verifiedText}>{tr("ভেরিফাইড")}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.contentSection, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.mainInfo}>
            <View style={styles.categoryTag}>
              <ThemedText style={[styles.categoryText, { color: theme.primary }]}>
                {categoryLabel(marketCats, product.category, language === "bn") || tr("Farm product")}
              </ThemedText>
            </View>
            
            <ThemedText style={[styles.productName, { color: theme.text }]}>
              {product.name}
            </ThemedText>

            <View style={styles.ratingPriceRow}>
              <View style={styles.ratingContainer}>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    // Whole, half or empty star, so 4.9 shows five stars and 4.5 shows four and a half.
                    const r = Math.round((reviews.count ? reviews.average : 0) * 2) / 2;
                    const name = r >= star ? "star" : r >= star - 0.5 ? "star-half-full" : "star-outline";
                    return (
                      <MaterialCommunityIcons
                        key={star}
                        name={name}
                        size={16}
                        color={r >= star - 0.5 ? "#F5B700" : "#D0D0D0"}
                        style={{ marginRight: 1 }}
                      />
                    );
                  })}
                </View>
                <ThemedText style={[styles.ratingText, { color: theme.text }]}>
                  {reviews.count ? reviews.average.toFixed(1) : tr("নতুন")}
                </ThemedText>
                <ThemedText style={[styles.reviewCount, { color: theme.textSecondary }]}>
                  {`(${reviews.count} ${tr("রিভিউ")})`}
                </ThemedText>
              </View>
              
              <View style={styles.priceContainer}>
                <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                  {tr("মূল্য")}
                </ThemedText>
                <View style={styles.priceRow}>
                  <ThemedText style={[styles.currency, { color: theme.primary }]}>
                    {product.currency}
                  </ThemedText>
                  <ThemedText style={[styles.price, { color: theme.primary }]}>
                    {product.price}
                  </ThemedText>
                  <ThemedText testID="product-per-unit" style={[styles.unit, { color: theme.textSecondary }]}>
                    {" "}{perUnitText(rule, bn)}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {!outOfStock ? (
            <View testID="product-amount-box" style={[styles.amountBox, { backgroundColor: theme.white, borderColor: theme.inputBorder }]}>
              <ThemedText style={[styles.amountTitle, { color: theme.text }]}>
                {bn ? `কতটুকু চান? (${unitWord(rule.unit, 2, true)})` : `How much do you want? (${unitWord(rule.unit, 2)})`}
              </ThemedText>
              {quickAmounts.length ? (
                <View style={styles.amountChips}>
                  {quickAmounts.map((a) => {
                    const on = Math.abs(a - quantity) < 1e-9;
                    return (
                      <Pressable
                        key={a}
                        testID={`qty-chip-${a}`}
                        onPress={() => { Haptics.selectionAsync(); setQtyDraft(null); setQuantity(clampQty(a)); }}
                        style={[styles.amountChip, { borderColor: on ? theme.primary : theme.inputBorder, backgroundColor: on ? `${theme.primary}14` : "transparent" }]}
                      >
                        <ThemedText style={[styles.amountChipText, { color: on ? theme.primary : theme.text }]}>{amountText(rule, a, bn)}</ThemedText>
                        <ThemedText style={[styles.amountChipPrice, { color: theme.textSecondary }]}>{product.currency}{Math.round(unitPrice * a).toLocaleString("en-IN")}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <ThemedText testID="product-amount-rules" style={[styles.amountRules, { color: theme.textSecondary }]}>
                {amountRules}
              </ThemedText>
              <ThemedText testID="product-amount-summary" style={[styles.amountSummary, { color: theme.text }]}>
                {`${amountText(rule, quantity, bn)}${totalContentText(rule, quantity, bn) ? ` · ${totalContentText(rule, quantity, bn)}` : ""} = ${product.currency}${money2(unitPrice * quantity)}`}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.featuresRow}>
            {features.map((feature, index) => (
              <View
                key={index}
                style={[styles.featureItem, { backgroundColor: `${feature.color}15` }]}
              >
                <AppIcon name={feature.icon as any} size={16} color={feature.color} />
                <ThemedText style={[styles.featureText, { color: feature.color }]}>
                  {feature.label}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.sellerCard, { backgroundColor: theme.white, borderColor: theme.inputBorder }]}>
            <Pressable
              style={styles.sellerInfo}
              onPress={() => {
                if (storeSlug) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("ShopPage", (preview ? { slug: storeSlug, preview: { kind: "shop" } } : { slug: storeSlug }) as any);
                } else if (product.companyId) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("StoreView", { companyId: product.companyId });
                }
              }}
            >
              <View style={[styles.sellerAvatar, { backgroundColor: theme.primary }]}>
                {(product.company as any)?.avatar ? (
                  <Image source={{ uri: (product.company as any).avatar }} style={styles.sellerAvatarImage} />
                ) : (
                  <ThemedText style={styles.sellerInitials}>
                    {product.company?.initials || product.seller.substring(0, 2).toUpperCase()}
                  </ThemedText>
                )}
              </View>
              <View style={styles.sellerDetails}>
                <View style={styles.sellerNameRow}>
                  <ThemedText style={[styles.sellerName, { color: theme.text }]}>
                    {product.seller}
                  </ThemedText>
                  {product.company?.verified ? (
                    <View style={styles.verifiedIcon}>
                      <AppIcon name="check-circle" size={16} color="#1DA1F2" />
                    </View>
                  ) : null}
                </View>
                <View style={styles.sellerMeta}>
                  <View style={styles.locationRow}>
                    <AppIcon name="map-pin" size={12} color={theme.textSecondary} />
                    <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
                      {product.location}
                    </ThemedText>
                  </View>
                  {product.company?.rating ? (
                    <View style={styles.sellerRating}>
                      <AppIcon name="star" size={12} color="#F5B700" />
                      <ThemedText style={[styles.sellerRatingText, { color: theme.textSecondary }]}>
                        {Number(product.company.rating || 0).toFixed(1)}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
            <View style={styles.sellerActions}>
              {ownerId && !isMine && !companyShop ? (
                <Pressable
                  style={[styles.chatButton, { borderColor: theme.primary, backgroundColor: following ? theme.primary : "transparent" }]}
                  onPress={handleFollow}
                  accessibilityLabel={following ? tr("Following") : tr("Follow")}
                >
                  <AppIcon name={following ? "user-check" : "user-plus"} size={18} color={following ? "#FFFFFF" : theme.primary} />
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.chatButton, { borderColor: theme.primary }]}
                onPress={handleContactSeller}
              >
                <ChatIcon size={18} color={theme.primary} />
              </Pressable>
              <Pressable
                style={[styles.callButton, { backgroundColor: theme.primary }]}
                onPress={handleCallSeller}
              >
                <AppIcon name="phone" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={[styles.descriptionCard, { backgroundColor: theme.white, borderColor: theme.inputBorder }]}>
            <View style={styles.sectionHeader}>
              <AppIcon name="file-text" size={18} color={theme.primary} />
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                {tr("বিবরণ")}
              </ThemedText>
            </View>
            <ThemedText 
              style={[styles.description, { color: theme.textSecondary }]}
              numberOfLines={showFullDescription ? undefined : 3}
            >
              {product.description || `তাজা ${product.name} সরাসরি খামার থেকে। কোনো কীটনাশক বা রাসায়নিক ছাড়াই জৈব পদ্ধতিতে উৎপাদিত। রান্না এবং স্বাস্থ্যকর খাবারের জন্য উপযুক্ত। তাৎক্ষণিক ডেলিভারির জন্য উপলব্ধ। আমাদের পণ্য সম্পূর্ণ প্রাকৃতিক এবং স্বাস্থ্যসম্মত। গুণমান নিশ্চিত করার জন্য আমরা সর্বোচ্চ যত্ন নিই।`}
            </ThemedText>
            <Pressable onPress={() => setShowFullDescription(!showFullDescription)}>
              <ThemedText style={[styles.readMore, { color: theme.primary }]}>
                {showFullDescription ? "কম দেখুন" : "আরও পড়ুন"}
              </ThemedText>
            </Pressable>
          </View>

          <View style={[styles.descriptionCard, { backgroundColor: theme.white, borderColor: theme.inputBorder }]}>
            <View style={styles.sectionHeader}>
              <AppIcon name="star" size={18} color={theme.primary} />
              <ThemedText style={[styles.sectionTitle, { color: theme.text, flex: 1 }]}>
                {tr("Ratings & reviews")}
              </ThemedText>
              {!isMine ? (
                <Pressable
                  onPress={() => (preview ? previewNote.show(tr("Write a review")) : isLoggedIn() ? setReviewOpen(true) : Alert.alert(tr("Log in to write a review")))}
                  accessibilityLabel={tr("Write a review")}
                >
                  <ThemedText style={[styles.readMore, { color: theme.primary, marginTop: 0 }]}>{tr("Write a review")}</ThemedText>
                </Pressable>
              ) : null}
            </View>
            {reviews.count ? (
              <>
                <ThemedText style={{ color: theme.text, fontWeight: "700", marginBottom: Spacing.sm }}>
                  {"★".repeat(Math.round(reviews.average))}{"☆".repeat(5 - Math.round(reviews.average))}  {reviews.average.toFixed(1)} ({reviews.count})
                </ThemedText>
                {reviews.reviews.slice(0, 5).map((r) => (
                  <View key={r.id} style={{ marginBottom: Spacing.sm }}>
                    <ThemedText style={{ color: theme.text, fontWeight: "600" }}>
                      {r.userName} · {"★".repeat(r.rating)}
                    </ThemedText>
                    {r.comment ? <ThemedText style={[styles.description, { color: theme.textSecondary }]}>{r.comment}</ThemedText> : null}
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{timeAgo(r.createdAt, language)}</ThemedText>
                  </View>
                ))}
              </>
            ) : (
              <ThemedText style={[styles.description, { color: theme.textSecondary }]}>{tr("No reviews yet")}</ThemedText>
            )}
          </View>

          <View style={[styles.specsCard, { backgroundColor: theme.white, borderColor: theme.inputBorder }]}>
            <View style={styles.sectionHeader}>
              <AppIcon name="info" size={18} color={theme.primary} />
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                {tr("পণ্যের তথ্য")}
              </ThemedText>
            </View>
            <View style={styles.specsGrid}>
              {specs.map((spec, index) => (
                <View key={index} style={[styles.specItem, { backgroundColor: theme.backgroundDefault }]}>
                  <View style={[styles.specIcon, { backgroundColor: `${theme.primary}15` }]}>
                    <AppIcon name={spec.icon as any} size={18} color={theme.primary} />
                  </View>
                  <View style={styles.specContent}>
                    <ThemedText style={[styles.specLabel, { color: theme.textSecondary }]}>
                      {spec.label}
                    </ThemedText>
                    <ThemedText style={[styles.specValue, { color: theme.text }]}>
                      {spec.value}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.guaranteeCard, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
            <AppIcon name="shield" size={24} color={theme.primary} />
            <View style={styles.guaranteeContent}>
              <ThemedText style={[styles.guaranteeTitle, { color: theme.text }]}>
                {tr("গুণমান নিশ্চয়তা")}
              </ThemedText>
              <ThemedText style={[styles.guaranteeText, { color: theme.textSecondary }]}>
                {tr("পণ্যে সমস্যা থাকলে ১০০% টাকা ফেরত")}
              </ThemedText>
            </View>
          </View>
        </View>
        {optionGroups.length > 0 ? (
          <View style={styles.relatedSection} testID="product-options">
            <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.sm }}>
              {tr("Choose options")}
            </ThemedText>
            {optionGroups.map((g) => (
              <View key={g.name} style={{ marginBottom: Spacing.sm }}>
                <ThemedText style={{ color: theme.textSecondary, marginBottom: 6, fontSize: 13 }}>{g.name}</ThemedText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {g.choices.map((c) => {
                    const on = picked[g.name] === c.label;
                    return (
                      <Pressable
                        key={c.label}
                        testID={`option-${g.name}-${c.label}`}
                        onPress={() => setPicked((p) => ({ ...p, [g.name]: c.label }))}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: on ? theme.primary : theme.cardBorder, backgroundColor: on ? theme.primary + "18" : "transparent" }}
                      >
                        <ThemedText style={{ color: on ? theme.primary : theme.text, fontSize: 13, fontWeight: on ? "700" : "500" }}>
                          {c.label}{c.extra ? ` +${product.currency}${c.extra}` : ""}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {related.length > 0 ? (
          <View style={styles.relatedSection}>
            <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.sm }}>
              {tr("Related products")}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
              {related.map((p) => (
                <Pressable
                  key={`rel-${p.id}`}
                  style={[styles.relatedCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  onPress={() => (navigation as any).push("ProductDetail", { product: { rating: 0, currency: "৳", location: "", seller: "", ...p }, ...(preview ? { preview: {} } : {}) })}
                >
                  <Image source={{ uri: p.image }} style={styles.relatedImage} contentFit="cover" />
                  <ThemedText style={[styles.relatedName, { color: theme.text }]} numberOfLines={1}>{p.name}</ThemedText>
                  <ThemedText style={[styles.relatedPrice, { color: theme.primary }]} numberOfLines={1}>
                    {p.currency || "৳"}{p.price}{p.unit ? `/${p.unit}` : ""}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <Reanimated.View
        style={[
          styles.footer,
          {
            backgroundColor: theme.white,
            borderTopColor: theme.inputBorder,
          },
          footerKeyboard,
        ]}
      >
        <View style={styles.footerContent}>
          <View style={styles.footerLeft}>
            <View style={[styles.quantitySelector, { borderColor: theme.inputBorder }]}>
              <Pressable 
                style={styles.qtyBtn} 
                onPress={decreaseQuantity}
                disabled={quantity <= minOrder}
              >
                <AppIcon name="minus" size={16} color={quantity <= minOrder ? theme.textSecondary : theme.text} />
              </Pressable>
              <TextInput
                testID="product-qty-input"
                value={qtyDraft ?? String(quantity)}
                onChangeText={(v) => setQtyDraft(rule.step < 1 ? v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 8) : v.replace(/[^0-9]/g, "").slice(0, 4))}
                onBlur={() => { if (qtyDraft !== null) setQuantity(clampQty(Number(qtyDraft))); setQtyDraft(null); }}
                onSubmitEditing={() => { if (qtyDraft !== null) setQuantity(clampQty(Number(qtyDraft))); setQtyDraft(null); }}
                keyboardType={rule.step < 1 ? "decimal-pad" : "number-pad"}
                style={[styles.qtyText, { color: theme.text, paddingVertical: 4 }]}
                accessibilityLabel={tr("Quantity")}
              />
              <Pressable testID="product-qty-plus" style={styles.qtyBtn} onPress={increaseQuantity} disabled={quantity + rule.step > maxQty + 1e-9}>
                <AppIcon name="plus" size={16} color={quantity + rule.step > maxQty + 1e-9 ? theme.textSecondary : theme.text} />
              </Pressable>
            </View>
            <ThemedText
              style={[styles.footerTotalPrice, { color: theme.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {product.currency}{money2(unitPrice * quantity)}
            </ThemedText>
          </View>

          <View style={styles.footerRight}>
            <Pressable
              style={[styles.cartBtn, { borderColor: outOfStock ? theme.textSecondary : theme.primary }]}
              testID="product-add-to-cart"
              onPress={handleAddToCart}
              disabled={outOfStock}
              accessibilityLabel={tr("Add to cart")}
            >
              <AppIcon name="shopping-cart" size={20} color={outOfStock ? theme.textSecondary : theme.primary} />
            </Pressable>

            <Pressable
              style={[styles.buyBtn, { backgroundColor: outOfStock ? theme.textSecondary : theme.primary }]}
              testID="product-buy-now"
              onPress={handleBuyNow}
              disabled={outOfStock}
            >
              <ThemedText style={styles.buyBtnText} numberOfLines={1}>{outOfStock ? tr("Out of stock") : tr("কিনুন")}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Reanimated.View>

      {cartCount > 0 ? (
        <Pressable
          testID="product-cart-badge"
          style={[styles.cartBadge, { backgroundColor: theme.primary, top: insets.top + 70 }]}
          onPress={() => (preview ? previewNote.show(tr("Cart")) : navigation.navigate("Cart"))}
        >
          <AppIcon name="shopping-cart" size={18} color="#FFFFFF" />
          <View style={styles.cartCount}>
            <ThemedText style={styles.cartCountText}>{cartCount}</ThemedText>
          </View>
        </Pressable>
      ) : null}
      {previewNote.node}
      <CatalogFormModal
        visible={reviewOpen && !preview}
        title={tr("Write a review")}
        fields={[
          { key: "rating", label: tr("Stars (1 to 5)"), numeric: true, required: true, placeholder: "5" },
          { key: "comment", label: tr("Your review"), multiline: true },
        ]}
        submitLabel={tr("Submit")}
        onClose={() => setReviewOpen(false)}
        onSubmit={async (v) => {
          const rating = Number(v.rating);
          if (!(rating >= 1 && rating <= 5)) return tr("Rating must be 1 to 5 stars");
          try {
            await apiPost(`/api/reviews/${encodeURIComponent(String(product.id))}`, { rating, comment: v.comment || "", targetName: product.name });
            setReviewOpen(false);
            loadReviews();
          } catch (e: any) {
            return e.message;
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  relatedSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.lg },
  relatedCard: { width: 130, borderRadius: MayaRadius.md, borderWidth: 1, overflow: "hidden", paddingBottom: Spacing.xs },
  relatedImage: { width: "100%", height: 86 },
  relatedName: { fontSize: 12, fontWeight: "600", paddingHorizontal: 6, marginTop: 4 },
  relatedPrice: { fontSize: 12, fontWeight: "700", paddingHorizontal: 6 },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  imageSection: {
    position: "relative",
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
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
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  imagePagination: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: "#FFFFFF",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16A34A",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  verifiedText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  contentSection: {
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  mainInfo: {
    marginBottom: Spacing.lg,
  },
  categoryTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: Spacing.sm,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  productName: {
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 34,
    marginBottom: Spacing.md,
  },
  ratingPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: 6,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 13,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  currency: {
    fontSize: 18,
    fontWeight: "600",
  },
  price: {
    fontSize: 28,
    fontWeight: "700",
  },
  unit: {
    fontSize: 14,
    marginLeft: 2,
  },
  featuresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  featureText: {
    fontSize: 12,
    fontWeight: "600",
  },
  amountBox: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  amountTitle: { fontSize: 15, fontWeight: "700" },
  amountChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amountChip: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", minWidth: 72 },
  amountChipText: { fontSize: 14, fontWeight: "700" },
  amountChipPrice: { fontSize: 12, marginTop: 2 },
  amountRules: { fontSize: 12.5 },
  amountSummary: { fontSize: 14, fontWeight: "600" },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sellerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sellerAvatarImage: {
    width: "100%",
    height: "100%",
  },
  sellerInitials: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  sellerDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  verifiedIcon: {},
  sellerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 12,
  },
  sellerRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sellerRatingText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sellerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  chatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  descriptionCard: {
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    lineHeight: 24,
  },
  readMore: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  specsCard: {
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  specItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  specIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  specContent: {
    flex: 1,
  },
  specLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  guaranteeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  guaranteeContent: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  guaranteeText: {
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  // The bottom bar must fit any phone width: the quantity box and total take the space
  // that is left, and the cart and checkout buttons never shrink or slide off the edge.
  footerContent: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  footerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quantitySelector: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  qtyBtn: {
    width: 34,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    // A fixed width: on the web a text box is ~20 characters wide by default, which pushed
    // the checkout button past the screen edge. Four digits fit.
    width: 44,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  footerTotalPrice: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 19,
    fontWeight: "700",
  },
  footerRight: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBtn: {
    height: 48,
    minWidth: 84,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cartBadge: {
    position: "absolute",
    right: Spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cartCount: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#DC2626",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
