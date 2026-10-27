import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MayaRadius } from "@/constants/mayaTheme";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Company, getAllCompanies } from "@/lib/storage";
import { initializeSeedData } from "@/lib/seedData";

import { AppIcon } from "@/components/icons/AppIcon";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SHOP_CATEGORIES = [
  { id: "all", label: "সব", icon: "grid", color: "#37B1FF" },
  { id: "seeds", label: "বীজ", icon: "sun", color: "#00BB77" },
  { id: "fertilizer", label: "সার", icon: "droplet", color: "#37B1FF" },
  { id: "equipment", label: "যন্ত্রপাতি", icon: "tool", color: "#B25E09" },
  { id: "feed", label: "খাদ্য", icon: "package", color: "#3D38D0" },
  { id: "medicine", label: "ওষুধ", icon: "heart", color: "#DA2F2F" },
  { id: "organic", label: "অর্গানিক", icon: "zap", color: "#00BB77" },
  { id: "dairy", label: "দুগ্ধ", icon: "coffee", color: "#B25E09" },
  { id: "fish", label: "মাছ", icon: "anchor", color: "#37B1FF" },
  { id: "poultry", label: "পোল্ট্রি", icon: "feather", color: "#FF4BB7" },
];

const CATEGORY_LABELS: Record<string, string> = {
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ShopsHomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      let data = await getAllCompanies();
      if (data.length === 0) {
        await initializeSeedData();
        data = await getAllCompanies();
      }
      setCompanies(data);
    } catch (error) {
      console.error("Error loading companies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCompanies();
    setIsRefreshing(false);
  };

  const filteredCompanies = useMemo(() => {
    let result = companies;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter((c) => c.category === selectedCategory);
    }

    return result;
  }, [companies, searchQuery, selectedCategory]);

  const featuredCompanies = useMemo(() => {
    return companies.filter((c) => c.verified).slice(0, 5);
  }, [companies]);

  const handleShopPress = useCallback((company: Company) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("StoreView", { companyId: company.id });
  }, [navigation]);

  const handleCategoryPress = useCallback((categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(categoryId);
  }, []);

  const renderFeaturedItem = useCallback(({ item }: { item: Company }) => (
    <Pressable
      style={[styles.featuredCard, { borderColor: theme.cardBorder }]}
      onPress={() => handleShopPress(item)}
    >
      <LinearGradient
        colors={[theme.primary, theme.primary + "CC"]}
        style={styles.featuredGradient}
      >
        <View style={[styles.featuredLogo, { backgroundColor: theme.white }]}>
          <ThemedText style={[styles.featuredLogoText, { color: theme.primary }]}>
            {item.initials}
          </ThemedText>
        </View>
        <View style={styles.featuredInfo}>
          <View style={styles.featuredNameRow}>
            <ThemedText style={styles.featuredName} numberOfLines={1}>
              {item.name}
            </ThemedText>
            {item.verified ? (
              <View style={styles.verifiedBadge}>
                <AppIcon name="check" size={10} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <ThemedText style={styles.featuredCategory}>
            {CATEGORY_LABELS[item.category] || item.category}
          </ThemedText>
          <View style={styles.featuredMeta}>
            <AppIcon name="star" size={12} color="#F5B700" />
            <ThemedText style={styles.featuredRating}>
              {item.rating.toFixed(1)}
            </ThemedText>
            <ThemedText style={styles.featuredProducts}>
              {item.productsCount} পণ্য
            </ThemedText>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  ), [theme, handleShopPress]);

  const renderShopItem = useCallback(({ item }: { item: Company }) => (
    <Pressable
      style={[styles.shopCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      onPress={() => handleShopPress(item)}
    >
      <View style={[styles.shopLogo, { backgroundColor: theme.primary + "15" }]}>
        <ThemedText style={[styles.shopLogoText, { color: theme.primary }]}>
          {item.initials}
        </ThemedText>
      </View>
      <View style={styles.shopInfo}>
        <View style={styles.shopNameRow}>
          <ThemedText style={styles.shopName} numberOfLines={1}>{item.name}</ThemedText>
          {item.verified ? (
            <View style={[styles.verifiedBadgeSmall, { backgroundColor: "#37B1FF" }]}>
              <AppIcon name="check" size={8} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
        <ThemedText style={[styles.shopCategory, { color: theme.textSecondary }]}>
          {CATEGORY_LABELS[item.category] || item.category}
        </ThemedText>
        <View style={styles.shopMeta}>
          <View style={styles.shopMetaItem}>
            <AppIcon name="star" size={12} color="#F5B700" />
            <ThemedText style={[styles.shopMetaText, { color: theme.text }]}>
              {item.rating.toFixed(1)}
            </ThemedText>
          </View>
          <View style={styles.shopMetaItem}>
            <AppIcon name="package" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.shopMetaText, { color: theme.textSecondary }]}>
              {item.productsCount}
            </ThemedText>
          </View>
          <View style={styles.shopMetaItem}>
            <AppIcon name="users" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.shopMetaText, { color: theme.textSecondary }]}>
              {item.followersCount}
            </ThemedText>
          </View>
        </View>
      </View>
      <AppIcon name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  ), [theme, handleShopPress]);

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <AppIcon name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="দোকান খুঁজুন..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <AppIcon name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={SHOP_CATEGORIES}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.categoryChip,
              { borderColor: theme.cardBorder },
              selectedCategory === item.id && { backgroundColor: item.color, borderColor: item.color },
            ]}
            onPress={() => handleCategoryPress(item.id)}
          >
            <AppIcon
              name={item.icon as any}
              size={14}
              color={selectedCategory === item.id ? "#FFFFFF" : item.color}
            />
            <ThemedText
              style={[
                styles.categoryText,
                selectedCategory === item.id && { color: "#FFFFFF" },
              ]}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        )}
      />

      {featuredCompanies.length > 0 && selectedCategory === "all" && !searchQuery ? (
        <View style={styles.featuredSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            জনপ্রিয় দোকান
          </ThemedText>
          <FlatList
            horizontal
            data={featuredCompanies}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
            renderItem={renderFeaturedItem}
          />
        </View>
      ) : null}

      <View style={styles.allShopsHeader}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          {selectedCategory === "all" ? "সব দোকান" : CATEGORY_LABELS[selectedCategory] || "দোকান"}
        </ThemedText>
        <ThemedText style={[styles.resultCount, { color: theme.textSecondary }]}>
          {filteredCompanies.length} টি
        </ThemedText>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <AppIcon name="shopping-bag" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {searchQuery || selectedCategory !== "all"
          ? "কোনো দোকান পাওয়া যায়নি"
          : "এখনো কোনো দোকান নেই"}
      </ThemedText>
      {searchQuery || selectedCategory !== "all" ? (
        <Pressable
          style={[styles.clearButton, { borderColor: theme.primary }]}
          onPress={() => {
            setSearchQuery("");
            setSelectedCategory("all");
          }}
        >
          <ThemedText style={[styles.clearButtonText, { color: theme.primary }]}>
            ফিল্টার সরান
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredCompanies}
        keyExtractor={(item) => item.id}
        renderItem={renderShopItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: MayaRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
  },
  categoriesContainer: {
    paddingVertical: Spacing.sm,
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
  categoryText: {
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
  },
  featuredSection: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  featuredList: {
    paddingRight: Spacing.lg,
  },
  featuredCard: {
    width: SCREEN_WIDTH * 0.7,
    marginRight: Spacing.md,
    borderRadius: MayaRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    ...Shadows.small,
  },
  featuredGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  featuredLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.small,
  },
  featuredLogoText: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
  },
  featuredInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  featuredNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  featuredName: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
    color: "#FFFFFF",
    flex: 1,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#37B1FF",
    justifyContent: "center",
    alignItems: "center",
  },
  featuredCategory: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  featuredRating: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
  },
  featuredProducts: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginLeft: Spacing.sm,
  },
  allShopsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  resultCount: {
    fontSize: 13,
  },
  shopCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: MayaRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  shopLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  shopLogoText: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
  },
  shopInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  shopNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  shopName: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
  },
  verifiedBadgeSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  shopCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  shopMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    gap: Spacing.md,
  },
  shopMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  shopMetaText: {
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 15,
  },
  clearButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
  },
});
