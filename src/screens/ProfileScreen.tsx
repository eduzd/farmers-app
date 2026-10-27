import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { badgeKeyFor, PROFILE_BADGES } from "@/constants/profileBadges";
import { darkTone } from "@/constants/mayaTheme";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore, MembershipApplication } from "@/lib/authStore";
import { fetchSavedPosts, setServerPostSaved, type FeedPost } from "@/lib/feedApi";
import { useI18n } from "@/lib/i18n";
import { useCompanyStore } from "@/lib/companyStore";
import { CommunitySwitcher, CommunitySwitcherRef } from "@/components/CommunitySwitcher";

import { EmptyState, IconButton } from "@/components/ui";
import { shareText } from "@/lib/share";
import { AppIcon } from "@/components/icons/AppIcon";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileFeed, type AboutRow } from "@/components/profile/ProfileFeed";
import { ProfileSheet, SheetRow } from "@/components/profile/ProfileSheet";
import { compactCount } from "@/lib/liveDataApi";
import { fetchAbout, formatJoined } from "@/lib/profileApi";
import { apiGet } from "@/lib/api";
import {
  LOADING,
  FAILED,
  countText,
  parseFollowCounts,
  parseRating,
  pick,
  ratingView,
  type FollowCounts,
  type Loaded,
  type RatingSummary,
} from "@/lib/profileStats";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;


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
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, isSuperAdmin, isWelfareMember, isSummitMember, applications } = useAuthStore();
  const { t, language } = useI18n();
  const { company, products, loadCompany } = useCompanyStore();
  
  const [adminTapCount, setAdminTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Real followers / following / rating from the server (never placeholder numbers).
  const [follows, setFollows] = useState<Loaded<FollowCounts>>(LOADING);
  const [rating, setRating] = useState<Loaded<RatingSummary>>(LOADING);
  const [statsReload, setStatsReload] = useState(0);
  const [about, setAbout] = useState<{ bio: string; location: string; joinedAt?: string | null }>({ bio: "", location: "" });
  const [focusCount, setFocusCount] = useState(0);
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
      navigation.navigate("AdminApp");
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

  // Load followers, following and rating every time the profile comes into view,
  // so a follow or a new review made elsewhere shows up here.
  useFocusEffect(
    React.useCallback(() => {
      const id = user?.id;
      if (!id) {
        setFollows(FAILED);
        setRating(FAILED);
        return;
      }
      let alive = true;
      apiGet<any>(`/api/follows/${encodeURIComponent(id)}`)
        .then((f) => alive && setFollows({ state: "ok", value: parseFollowCounts(f) }))
        .catch(() => alive && setFollows(FAILED));
      apiGet<any>(`/api/sellers/${encodeURIComponent(id)}/rating`)
        .then((r) => alive && setRating({ state: "ok", value: parseRating(r) }))
        .catch(() => alive && setRating(FAILED));
      return () => {
        alive = false;
      };
    }, [user?.id, statsReload])
  );
  // Bio, place and join date, plus a fresh posts list, every time the profile comes into view.
  useFocusEffect(
    React.useCallback(() => {
      setFocusCount((n) => n + 1);
      if (!user?.id) return;
      let alive = true;
      fetchAbout().then((a) => {
        if (alive && a) setAbout({ bio: a.bio || "", location: a.location || "", joinedAt: a.joinedAt ?? null });
      });
      return () => {
        alive = false;
      };
    }, [user?.id])
  );
  const statsFailed = follows.state === "error" || rating.state === "error";
  const retryStats = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFollows(LOADING);
    setRating(LOADING);
    setStatsReload((n) => n + 1);
  };
  const ratingBox = ratingView(rating, language);

  // Like the reference design: only a three-dot button in the title bar. It opens every profile option.
  const isBnHeader = language === "bn";
  const shareProfile = () => {
    if (!user) return;
    shareText(
      user.name || "Farmers",
      isBnHeader
        ? `কৃষক বন্ধু অ্যাপে ${user.name}${user.username ? ` (@${user.username})` : ""}-কে খুঁজুন`
        : `Find ${user.name}${user.username ? ` (@${user.username})` : ""} on Farmers`,
    );
  };
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        user ? (
          // The three-dot button opens the full Profile options page (every option, grouped), drawn as
          // the shared title-bar icon button so it matches the Market bell and cart.
          <View testID="profile-more-button" style={{ marginRight: Spacing.lg }}>
            <IconButton
              icon="more-vertical"
              tone="header"
              accessibilityLabel={isBnHeader ? "আরও অপশন" : "More options"}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                navigation.navigate("ProfileOptions" as any);
              }}
            />
          </View>
        ) : null,
    } as any);
  }, [navigation, user?.id, isBnHeader, theme]);


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
          paddingTop: 0,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      {(() => {
        const bn = language === "bn";
        const b = PROFILE_BADGES[badgeKeyFor(user) || "farmer"];
        const tone = darkTone(b.color, isDark);
        const followersN = pick(follows, "followers");
        const followingN = pick(follows, "following");
        const fmt = (n: Loaded<number>) => (n.state === "ok" ? compactCount(n.value) : countText(n));
        const joined = formatJoined(about.joinedAt, bn);
        const aboutRows: AboutRow[] = [
          { icon: "tag", label: bn ? "ক্যাটাগরি" : "Category", value: bn ? b.labelBn : b.label, testID: "profile-about-category" },
          { icon: "star", label: ratingBox.label, value: ratingBox.value, testID: "profile-stat-rating" },
          ...(about.location ? [{ icon: "map-pin", label: bn ? "এলাকা" : "Location", value: about.location }] : []),
          ...(joined ? [{ icon: "calendar", label: bn ? "সদস্য" : "Member since", value: joined.replace(/^Joined |^যোগ দিয়েছেন /, "") }] : []),
          ...(user?.email ? [{ icon: "mail", label: bn ? "ইমেইল (শুধু আপনি দেখেন)" : "Email (only you see this)", value: user.email }] : []),
        ];
        return (
          <>
            <ProfileHero
              userId={user?.id}
              name={user?.name || tr("অতিথি")}
              initials={user?.initials || "JD"}
              avatar={user?.avatar}
              avatarId={user?.avatarId}
              avatarColor={user?.avatarColor}
              badge={badgeKeyFor(user)}
              isWelfareMember={isWelfareMember}
              verified={!!user?.verified}
              subtitle={user?.username ? `@${user.username}` : getSectorLabel()}
              onAvatarPress={handleAvatarTap}
              chips={
                <>
                  <View
                    testID="profile-category-badge"
                    style={[
                      styles.sectorBadge,
                      { backgroundColor: tone + (isDark ? "26" : "1F"), borderColor: tone + "55", borderWidth: 1 },
                      b.shape === "square" ? { borderRadius: 8 } : null,
                    ]}
                  >
                    <MaterialCommunityIcons name={b.icon} size={15} color={tone} />
                    <ThemedText style={[styles.sectorBadgeText, { color: tone }]}>{bn ? b.labelBn : b.label}</ThemedText>
                  </View>
                  {isWelfareMember ? (
                    <View style={[styles.verifiedBadge, { backgroundColor: "#3D38D0" }]}>
                      <Feather name="award" size={12} color="#FFFFFF" />
                      <ThemedText style={[styles.verifiedText, { color: "#FFFFFF" }]}>{bn ? "কল্যাণ সদস্য" : "Welfare Member"}</ThemedText>
                    </View>
                  ) : null}
                  {isSummitMember ? (
                    <View style={[styles.verifiedBadge, { backgroundColor: "#202936" }]}>
                      <Feather name="globe" size={12} color="#FFFFFF" />
                      <ThemedText style={[styles.verifiedText, { color: "#FFFFFF" }]}>{bn ? "সামিট সদস্য" : "Summit Member"}</ThemedText>
                    </View>
                  ) : null}
                </>
              }
              bio={about.bio}
              location={about.location}
              joined={joined}
              followers={fmt(followersN)}
              following={fmt(followingN)}
              onFollowers={() => navigation.navigate("Followers", { userId: user?.id || "", userName: user?.name || "" })}
              onFollowing={() => navigation.navigate("Following", { userId: user?.id || "", userName: user?.name || "" })}
              bn={bn}
              primary={
                user
                  ? { label: bn ? "প্রোফাইল এডিট" : "Edit profile", icon: "edit-2", solid: true, testID: "profile-edit-button", onPress: () => navigation.navigate("EditProfile" as any) }
                  : undefined
              }
              secondary={user ? { label: bn ? "শেয়ার" : "Share profile", icon: "share-2", testID: "profile-share-button", onPress: shareProfile } : undefined}
              footer={
                statsFailed ? (
                  <Pressable
                    testID="profile-stats-retry"
                    accessibilityRole="button"
                    onPress={retryStats}
                    style={({ pressed }) => [styles.statsRetry, pressed && { opacity: 0.6 }]}
                  >
                    <Feather name="refresh-cw" size={13} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {bn ? "সংখ্যা লোড হয়নি · আবার চেষ্টা করতে চাপুন" : "Couldn't load these numbers · Tap to retry"}
                    </ThemedText>
                  </Pressable>
                ) : null
              }
            />
            <ProfileFeed
              userId={user?.id}
              author={{ id: user?.id, name: user?.name || "", initials: user?.initials, avatar: user?.avatar, avatarId: user?.avatarId, avatarColor: user?.avatarColor, verified: !!user?.verified }}
              bn={bn}
              aboutRows={aboutRows}
              reloadKey={focusCount}
              followers={followersN.state === "ok" ? followersN.value : undefined}
              joinedAt={about.joinedAt}
              isMe
              emptyPosts={{
                title: bn ? "আপনি এখনো কিছু পোস্ট করেননি" : "You haven't posted yet",
                message: bn ? "কমিউনিটিতে পোস্ট করলে এখানে দেখা যাবে।" : "Posts you share in Community show up here.",
              }}
            />
          </>
        );
      })()}

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
    paddingHorizontal: 0,
  },
  sheetBody: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
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
    fontFamily: "DMSans_600SemiBold",
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
    fontFamily: "DMSans_600SemiBold",
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
    fontFamily: "DMSans_500Medium",
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
  statsRetry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
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
    fontFamily: "DMSans_500Medium",
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
    fontFamily: "DMSans_600SemiBold",
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
    color: "#00875A",
    fontFamily: "DMSans_600SemiBold",
  },
  savedPostAuthorName: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
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
    color: "#DA2F2F",
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
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
    fontFamily: "DMSans_600SemiBold",
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
    fontFamily: "DMSans_600SemiBold",
  },
  addressText: {
    fontSize: 13,
    marginTop: 2,
  },
});
