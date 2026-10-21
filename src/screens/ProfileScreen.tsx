import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  FlatList,
} from "react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  interpolate,
  Extrapolation 
} from "react-native-reanimated";
import { Image } from "expo-image";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { tr } from "@/lib/tr";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { badgeKeyFor } from "@/constants/profileBadges";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore, MembershipApplication } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import { useCompanyStore } from "@/lib/companyStore";
import { CommunitySwitcher, CommunitySwitcherRef } from "@/components/CommunitySwitcher";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MENU_ITEMS = [
  { id: "my-posts", labelKey: "profile.myPosts", icon: "edit-3" as const, screen: "MyPosts" as const },
  { id: "saved-posts", labelKey: "profile.savedPosts", icon: "bookmark" as const, expandable: true },
  { id: "orders", labelKey: "profile.myOrders", icon: "shopping-bag" as const, screen: "Orders" as const },
  { id: "applications", labelKey: "profile.applications", icon: "file-text" as const, screen: "ApplicationsList" as const },
  { id: "rfq", labelKey: "rfq.title", icon: "clipboard" as const, screen: "Rfq" as const },
  { id: "listings", labelKey: "profile.myListings", icon: "package" as const },
  { id: "settings", labelKey: "profile.settings", icon: "settings" as const, screen: "Settings" as const },
];

interface SavedPost {
  id: string;
  author: { name: string; avatar: string; initials: string };
  content: string;
  image?: string;
}

const SAVED_POSTS: SavedPost[] = [
  { id: "sp-1", author: { name: "মোঃ মিজান", avatar: "", initials: "মম" }, content: "এই পুকুরে দেখা যাচ্ছে অনেক শ্যাওলা জমে আছে শ্যাওলা কিভাবে দূর ক...", image: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=400" },
  { id: "sp-2", author: { name: "মোঃ মিজান", avatar: "", initials: "মম" }, content: "তোমার সর্বশেষ লিমিট আছে সেগুলো ঠিক করছো আর যে প্রোফাইলে শেয়ার করে সবাইকে দেখার..." },
  { id: "sp-3", author: { name: "মোঃ মিজান", avatar: "", initials: "মম" }, content: "কলার গাছে ওষুধ দিতে হবে কীটনাশক দমন এর জন্য কি কি...", image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400" },
  { id: "sp-4", author: { name: "Didu", avatar: "", initials: "Di" }, content: "সবাই কেমন আছো খানা খেয়েছো" },
];

const FEATURE_MENU_ITEMS = [
  { id: "wallet", labelKey: "profile.wallet", icon: "credit-card" as const, screen: "Wallet" as const },
  { id: "wishlist", labelKey: "profile.wishlist", icon: "heart" as const, screen: "Wishlist" as const },
  { id: "badges", labelKey: "profile.achievements", icon: "award" as const, screen: "Badges" as const },
  { id: "tracking", labelKey: "profile.deliveryTracking", icon: "truck" as const, screen: "DeliveryTracking" as const },
];

const VENDOR_DASHBOARD_ITEM = { 
  id: "vendor-dashboard", 
  labelKey: "profile.vendorDashboard", 
  sublabelKey: "profile.manageYourShop",
  icon: "grid" as const, 
  screen: "CompanyDashboard" as const 
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, isSuperAdmin, isWelfareMember, isSummitMember, applications } = useAuthStore();
  const { t, language } = useI18n();
  const { company, products, loadCompany } = useCompanyStore();
  
  const [adminTapCount, setAdminTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const communitySwitcherRef = useRef<CommunitySwitcherRef>(null);
  const [savedPostsExpanded, setSavedPostsExpanded] = useState(false);
  const [savedPosts, setSavedPosts] = useState(SAVED_POSTS);
  const savedPostsAnimation = useSharedValue(0);

  const toggleSavedPosts = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSavedPostsExpanded(!savedPostsExpanded);
    savedPostsAnimation.value = withSpring(savedPostsExpanded ? 0 : 1, { damping: 15 });
  };

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(savedPostsAnimation.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));

  const handleViewPost = (post: SavedPost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PostDetail", { 
      postId: post.id, 
      post: { 
        id: post.id, 
        author: post.author, 
        content: post.content, 
        image: post.image, 
        likes: 0, 
        comments: 0, 
        views: 0, 
        isLiked: false, 
        createdAt: "" 
      } 
    });
  };

  const handleRemoveSavedPost = (postId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavedPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleAvatarTap = () => {
    if (!isSuperAdmin) return;
    
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    
    const newCount = adminTapCount + 1;
    setAdminTapCount(newCount);
    
    if (newCount >= 5) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAdminTapCount(0);
      navigation.navigate("AdminDashboard");
    } else if (newCount >= 3) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    tapTimeoutRef.current = setTimeout(() => {
      setAdminTapCount(0);
    }, 2000);
  };

  useFocusEffect(
    React.useCallback(() => {
      if (user?.verified && user?.id) {
        loadCompany(user.id);
      }
    }, [user?.verified, user?.id])
  );

  const handleMenuPress = (item: typeof MENU_ITEMS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.screen) {
      navigation.navigate(item.screen as any);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: "Landing" }],
    });
  };

  const getSectorLabelKey = (sector: string) => {
    const sectorMap: Record<string, string> = {
      crops: "profile.sectorCrops",
      vegetables: "profile.sectorVegetables",
      fruits: "profile.sectorFruits",
      dairy: "profile.sectorDairy",
      poultry: "profile.sectorPoultry",
      fish: "profile.sectorFish",
      livestock: "profile.sectorLivestock",
      organic: "profile.sectorOrganic",
      mixed: "profile.sectorMixed",
    };
    return sectorMap[sector] || sector;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "farmer": return t("onboarding.farmer");
      case "buyer": return t("onboarding.buyer");
      case "company": return t("onboarding.company");
      case "expert": return t("onboarding.expert");
      default: return role;
    }
  };

  const getSectorLabel = () => {
    if (user?.farmingCategory) {
      return t(getSectorLabelKey(user.farmingCategory));
    }
    return getRoleLabel(user?.role || "farmer");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <Pressable onPress={handleAvatarTap}>
          <UserAvatar
            initials={user?.initials || "JD"}
            avatar={user?.avatar}
            avatarId={user?.avatarId}
            avatarColor={user?.avatarColor}
            size="large"
            isWelfareMember={isWelfareMember}
            badge={badgeKeyFor(user)}
          />
          {user ? (
            <Pressable
              onPress={() => navigation.navigate("Settings", { openEditProfile: true })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
              style={[styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.backgroundRoot }]}
            >
              <Feather name="camera" size={14} color="#fff" />
            </Pressable>
          ) : null}
        </Pressable>
        <ThemedText type="h3" style={styles.profileName}>
          {user?.name || tr("অতিথি")}
        </ThemedText>
        <ThemedText type="body" style={[styles.profileEmail, { color: theme.textSecondary }]}>
          {user?.email || ""}
        </ThemedText>
        {user ? (
          <Pressable
            onPress={() => navigation.navigate("Settings", { openEditProfile: true })}
            style={[styles.editProfileBtn, { borderColor: theme.primary }]}
            accessibilityRole="button"
            testID="profile-edit-button"
          >
            <Feather name="edit-2" size={14} color={theme.primary} />
            <ThemedText style={{ color: theme.primary, fontWeight: "600", fontSize: 14 }}>{tr("প্রোফাইল এডিট করুন")}</ThemedText>
          </Pressable>
        ) : null}
        <View style={styles.badgeContainer}>
          <View style={[styles.sectorBadge, { backgroundColor: theme.primary + "20" }]}>
            <Feather 
              name={user?.farmingCategory === "fish" ? "droplet" : user?.role === "expert" ? "award" : "user"} 
              size={14} 
              color={theme.primary} 
            />
            <ThemedText style={[styles.sectorBadgeText, { color: theme.primary }]}>
              {getSectorLabel()}
            </ThemedText>
          </View>
          {user?.verified ? (
            <View style={[styles.verifiedBadge, { backgroundColor: "#1DA1F2" }]}>
              <Feather name="check" size={12} color="#FFFFFF" />
              <ThemedText style={[styles.verifiedText, { color: "#FFFFFF" }]}>
                {t("profile.verified")}
              </ThemedText>
            </View>
          ) : null}
          {isWelfareMember ? (
            <View style={[styles.verifiedBadge, { backgroundColor: "#1D4ED8" }]}>
              <Feather name="award" size={12} color="#FFFFFF" />
              <ThemedText style={[styles.verifiedText, { color: "#FFFFFF" }]}>
                {language === "bn" ? "কল্যাণ সদস্য" : "Welfare Member"}
              </ThemedText>
            </View>
          ) : null}
          {isSummitMember ? (
            <View style={[styles.verifiedBadge, { backgroundColor: "#0D47A1" }]}>
              <Feather name="globe" size={12} color="#FFFFFF" />
              <ThemedText style={[styles.verifiedText, { color: "#FFFFFF" }]}>
                {language === "bn" ? "সামিট সদস্য" : "Summit Member"}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <Pressable 
          style={({ pressed }) => [
            styles.statItem, 
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            pressed && styles.statPressed,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("Followers", { userId: user?.id || "", userName: user?.name || "" });
          }}
        >
          <ThemedText type="h4">{user?.followersCount || 156}</ThemedText>
          <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t("profile.followers")}
          </ThemedText>
        </Pressable>
        <Pressable 
          style={({ pressed }) => [
            styles.statItem, 
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            pressed && styles.statPressed,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("Following", { userId: user?.id || "", userName: user?.name || "" });
          }}
        >
          <ThemedText type="h4">{user?.followingCount || 89}</ThemedText>
          <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t("profile.following")}
          </ThemedText>
        </Pressable>
        <View style={[styles.statItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <ThemedText type="h4">4.9</ThemedText>
          <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t("profile.rating")}
          </ThemedText>
        </View>
      </View>

      {/* Quick Settings Section */}
      <View style={[styles.menuSection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        {/* Seller/Vendor Dashboard */}
        <Pressable
          style={({ pressed }) => [
            styles.menuItem,
            pressed && styles.menuPressed,
            styles.menuFirstItem,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (user?.verified) {
              navigation.navigate("CompanyDashboard");
            } else {
              navigation.navigate("SellerOnboarding" as any);
            }
          }}
        >
          <View style={styles.menuLeft}>
            <Feather name={user?.verified ? "grid" : "shopping-bag"} size={20} color={theme.iconDefault || theme.text} />
            <ThemedText style={[styles.menuLabel, { color: theme.text }]}>
              {user?.verified ? t("profile.vendorDashboard") : t("profile.becomeSeller")}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.inputBorder || theme.cardBorder }]} />

        {/* Seller Hub: products, orders with buyer contact, store page */}
        <Pressable
          testID="profile-seller-hub"
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("SellerApp" as any);
          }}
        >
          <View style={styles.menuLeft}>
            <Feather name="briefcase" size={20} color={theme.iconDefault || theme.text} />
            <ThemedText style={[styles.menuLabel, { color: theme.text }]}>
              {language === "bn" ? "সেলার হাব" : "Seller Hub"}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
        </Pressable>

        {isSuperAdmin ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.inputBorder || theme.cardBorder }]} />
            <Pressable
              testID="profile-admin-dashboard"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("AdminDashboard");
              }}
            >
              <View style={styles.menuLeft}>
                <Feather name="shield" size={20} color={theme.iconDefault || theme.text} />
                <ThemedText style={[styles.menuLabel, { color: theme.text }]}>
                  {language === "bn" ? "অ্যাডমিন ড্যাশবোর্ড" : "Admin dashboard"}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
            </Pressable>
          </>
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.inputBorder || theme.cardBorder }]} />

        {/* Delivery Address */}
        <Pressable
          style={({ pressed }) => [
            styles.menuItem,
            pressed && styles.menuPressed,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("AddressManagement" as any);
          }}
        >
          <View style={styles.menuLeft}>
            <Feather name="map-pin" size={20} color={theme.iconDefault || theme.text} />
            <ThemedText style={[styles.menuLabel, { color: theme.text }]}>
              {t("profile.deliveryAddress")}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.inputBorder || theme.cardBorder }]} />

        {/* Community Switcher as menu item */}
        <Pressable 
          style={({ pressed }) => [
            styles.menuItem, 
            styles.menuLastItem,
            pressed && styles.menuPressed,
          ]}
          onPress={() => communitySwitcherRef.current?.openModal()}
        >
          <View style={styles.menuLeft}>
            <Feather name="users" size={20} color={theme.iconDefault || theme.text} />
            <ThemedText style={[styles.menuLabel, { color: theme.text }]}>
              {t("community.title")}
            </ThemedText>
          </View>
          <View style={styles.communitySwitcherInline}>
            <CommunitySwitcher ref={communitySwitcherRef} compact />
          </View>
        </Pressable>
      </View>

      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.md }]}>
        {t("profile.accountSection")}
      </ThemedText>
      <View style={[styles.menuSection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        {MENU_ITEMS.map((item, index) => (
          <React.Fragment key={item.id}>
            {item.id === "saved-posts" ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.menuPressed,
                  ]}
                  onPress={toggleSavedPosts}
                >
                  <View style={styles.menuLeft}>
                    <Feather name={item.icon} size={20} color={theme.iconDefault || theme.text} />
                    <ThemedText style={[styles.menuLabel, { color: theme.text }]}>
                      {t(item.labelKey)}
                    </ThemedText>
                  </View>
                  <View style={styles.savedPostsMenuRight}>
                    <View style={[styles.savedPostsCountBadge, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.savedPostsCountText}>
                        {savedPosts.length}
                      </ThemedText>
                    </View>
                    <Animated.View style={chevronAnimatedStyle}>
                      <Feather name="chevron-down" size={20} color={theme.iconSecondary || theme.textSecondary} />
                    </Animated.View>
                  </View>
                </Pressable>
                {savedPostsExpanded ? (
                  <View style={styles.savedPostsList}>
                    {savedPosts.map((post) => (
                      <View 
                        key={post.id} 
                        style={[styles.savedPostItem, { backgroundColor: theme.backgroundRoot }]}
                      >
                        {post.image ? (
                          <Image source={{ uri: post.image }} style={styles.savedPostImage} contentFit="cover" />
                        ) : null}
                        <View style={[styles.savedPostContent, !post.image && { flex: 1 }]}>
                          <View style={styles.savedPostAuthorRow}>
                            <View style={[styles.savedPostAuthorAvatar, { backgroundColor: "#D1FAE5" }]}>
                              <ThemedText style={styles.savedPostAuthorInitials}>
                                {post.author.initials}
                              </ThemedText>
                            </View>
                            <ThemedText style={[styles.savedPostAuthorName, { color: theme.text }]}>
                              {post.author.name}
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.savedPostText, { color: theme.text }]} numberOfLines={2}>
                            {post.content}
                          </ThemedText>
                        </View>
                        <View style={styles.savedPostActions}>
                          <Pressable 
                            style={[styles.savedPostActionBtn, { backgroundColor: "#E0E7FF" }]}
                            onPress={() => handleViewPost(post)}
                          >
                            <Feather name="eye" size={18} color="#4F46E5" />
                          </Pressable>
                          <Pressable 
                            style={[styles.savedPostActionBtn, { backgroundColor: "#FFE4E6" }]}
                            onPress={() => handleRemoveSavedPost(post.id)}
                          >
                            <Feather name="bookmark" size={18} color="#F43F5E" />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuPressed,
                  index === 0 && styles.menuFirstItem,
                  index === MENU_ITEMS.length - 1 && styles.menuLastItem,
                ]}
                onPress={() => handleMenuPress(item)}
              >
                <View style={styles.menuLeft}>
                  <Feather name={item.icon} size={20} color={theme.iconDefault || theme.text} />
                  <ThemedText style={[styles.menuLabel, { color: theme.text }]}>
                    {t(item.labelKey)}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
              </Pressable>
            )}
            {index < MENU_ITEMS.length - 1 ? (
              <View style={[styles.divider, { backgroundColor: theme.inputBorder || theme.cardBorder }]} />
            ) : null}
          </React.Fragment>
        ))}
      </View>

      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
        {t("profile.featuresSection")}
      </ThemedText>
      <View style={[styles.menuSection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        {FEATURE_MENU_ITEMS.map((item, index) => (
          <React.Fragment key={item.id}>
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuPressed,
                index === 0 && styles.menuFirstItem,
                index === FEATURE_MENU_ITEMS.length - 1 && styles.menuLastItem,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(item.screen as any);
              }}
            >
              <View style={styles.menuLeft}>
                <Feather name={item.icon} size={20} color={theme.iconDefault || theme.text} />
                <ThemedText style={[styles.menuLabel, { color: theme.text }]}>
                  {t(item.labelKey)}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
            </Pressable>
            {index < FEATURE_MENU_ITEMS.length - 1 ? (
              <View style={[styles.divider, { backgroundColor: theme.inputBorder || theme.cardBorder }]} />
            ) : null}
          </React.Fragment>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.logoutButton,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
          pressed && styles.buttonPressed,
        ]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color="#DC2626" />
        <ThemedText style={styles.logoutText}>{t("auth.signOut")}</ThemedText>
      </Pressable>

      <ThemedText type="small" style={[styles.versionText, { color: theme.textSecondary }]}>
        {t("profile.version")} 1.0.0
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 10,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatarContainer: {
    position: "relative",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.medium,
  },
  avatarWelfareBadgeContainer: {
    position: "absolute",
    bottom: -4,
    left: -4,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  profileName: {
    marginBottom: Spacing.xs,
  },
  profileEmail: {
    marginBottom: Spacing.md,
  },
  badgeContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  sectorBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  sectorBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  companySection: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  becomeSellerSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  communitySwitcherContainer: {
    marginBottom: Spacing.lg,
  },
  companyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  companyInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  companySubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  statPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  statLabel: {
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    marginLeft: 52,
  },
  menuSection: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    ...Shadows.small,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  menuFirstItem: {
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
  },
  menuLastItem: {
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  menuPressed: {
    opacity: 0.8,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  communitySwitcherInline: {
    marginLeft: "auto",
  },
  savedPostsCountBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  savedPostsCountText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  savedPostsMenuRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  savedPostsList: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  savedPostItem: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  savedPostImage: {
    width: 70,
    height: 70,
    borderRadius: BorderRadius.md,
  },
  savedPostContent: {
    flex: 1,
    justifyContent: "center",
  },
  savedPostAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  savedPostAuthorAvatar: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  savedPostAuthorInitials: {
    fontSize: 10,
    fontWeight: "600",
    color: "#059669",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  savedPostAuthorName: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  savedPostText: {
    fontSize: 13,
    lineHeight: 18,
  },
  savedPostActions: {
    justifyContent: "center",
    gap: Spacing.sm,
  },
  savedPostActionBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  logoutText: {
    fontSize: 16,
    color: "#DC2626",
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  versionText: {
    textAlign: "center",
    marginTop: Spacing.xl,
  },
  vendorDashboardSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  vendorDashboardIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  vendorDashboardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  vendorDashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  shopNameBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  shopNameText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  vendorDashboardSublabel: {
    fontSize: 13,
    marginTop: 2,
  },
  vendorQuickStats: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  vendorQuickStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  vendorQuickStatText: {
    fontSize: 11,
  },
  addressSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addressInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  addressTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  addressText: {
    fontSize: 13,
    marginTop: 2,
  },
});
