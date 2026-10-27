import React, { useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@/components/icons/Feather";
import { AppIcon } from "@/components/icons/AppIcon";
import { EmptyState } from "@/components/ui";
import { CommunitySwitcher, CommunitySwitcherRef } from "@/components/CommunitySwitcher";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { fetchSavedPosts, setServerPostSaved, type FeedPost } from "@/lib/feedApi";
import { useI18n } from "@/lib/i18n";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Every option behind the three-dot button on your own profile, on a full page of its own
 * (back arrow + the app's standard title). Grouped: selling, your activity, shopping, app, sign out.
 */
export default function ProfileOptionsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, isSuperAdmin } = useAuthStore();
  const { t, language } = useI18n();
  const bn = language === "bn";
  const communitySwitcherRef = useRef<CommunitySwitcherRef>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);

  // Saved posts, fresh every time this page comes into view.
  useFocusEffect(
    React.useCallback(() => {
      const token = useAuthStore.getState().getToken();
      if (!token || !user?.id) {
        setSavedPosts([]);
        return;
      }
      let alive = true;
      fetchSavedPosts(token, bn)
        .then((list) => alive && setSavedPosts(list))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [user?.id, bn])
  );

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  const go = (screen: string, params?: any) => {
    tap();
    (navigation.navigate as any)(screen, params);
  };

  const removeSaved = async (postId: string) => {
    const token = useAuthStore.getState().getToken();
    if (!token) return;
    const before = savedPosts;
    setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await setServerPostSaved(token, postId, false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setSavedPosts(before);
      Alert.alert(bn ? "সরানো যায়নি" : "Couldn't remove", e instanceof Error ? e.message : "");
    }
  };

  const signOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
  };

  return (
    <ScrollView
      testID="profile-options-page"
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["2xl"] }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <Group title={bn ? "বিক্রি" : "Selling"} testID="profile-options-selling">
          <Row
            icon={user?.verified ? "grid" : "shopping-bag"}
            label={user?.verified ? t("profile.vendorDashboard") : t("profile.becomeSeller")}
            onPress={() => go(user?.verified ? "CompanyDashboard" : "SellerOnboarding")}
            testID="profile-vendor-dashboard"
          />
          <Row icon="briefcase" label={bn ? "সেলার হাব" : "Seller Hub"} onPress={() => go("SellerApp")} testID="profile-seller-hub" />
          <Row icon="package" label={t("profile.myListings")} onPress={() => go("SellerApp")} testID="profile-my-listings" last={!isSuperAdmin} />
          {isSuperAdmin ? (
            <Row icon="shield" label={bn ? "অ্যাডমিন ড্যাশবোর্ড" : "Admin dashboard"} onPress={() => go("AdminApp")} testID="profile-admin-dashboard" last />
          ) : null}
        </Group>

        <Group title={bn ? "আপনার কার্যক্রম" : "Your activity"} testID="profile-options-activity">
          <Row icon="edit-3" label={t("profile.myPosts")} onPress={() => go("MyPosts")} testID="profile-my-posts" />
          <Row
            icon="bookmark"
            label={t("profile.savedPosts")}
            onPress={() => {
              tap();
              setSavedOpen((v) => !v);
            }}
            testID="profile-saved-posts"
            right={
              <View style={styles.rowRight}>
                <View style={[styles.countBadge, { backgroundColor: theme.primary }]}>
                  <ThemedText style={[styles.countText, { color: theme.buttonText }]}>{savedPosts.length}</ThemedText>
                </View>
                <Feather name={savedOpen ? "chevron-up" : "chevron-down"} size={20} color={theme.iconSecondary || theme.textSecondary} />
              </View>
            }
          />
          {savedOpen ? (
            <View style={styles.savedList} testID="profile-saved-list">
              {savedPosts.length === 0 ? (
                <EmptyState
                  icon="inbox"
                  title={bn ? "এখনও কিছু নেই" : "Nothing saved yet"}
                  message={bn ? "পোস্ট সেভ করলে এখানে দেখা যাবে।" : "Posts you save show up here."}
                />
              ) : null}
              {savedPosts.map((post) => (
                <View key={post.id} style={[styles.savedItem, { backgroundColor: theme.backgroundSecondary }]}>
                  {post.image ? <Image source={{ uri: post.image }} style={styles.savedImage} contentFit="cover" /> : null}
                  <Pressable style={styles.savedBody} onPress={() => go("PostDetail", { postId: post.id, post })}>
                    <ThemedText style={[styles.savedAuthor, { color: theme.text }]} numberOfLines={1}>
                      {post.author.name}
                    </ThemedText>
                    <ThemedText style={[styles.savedText, { color: theme.textSecondary }]} numberOfLines={2}>
                      {post.content}
                    </ThemedText>
                  </Pressable>
                  <View style={styles.savedActions}>
                    <Pressable
                      accessibilityLabel={bn ? "দেখুন" : "View"}
                      style={[styles.savedBtn, { backgroundColor: theme.primarySoft }]}
                      onPress={() => go("PostDetail", { postId: post.id, post })}
                    >
                      <Feather name="eye" size={17} color={isDark ? theme.primaryTint : theme.primary} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={bn ? "সেভ থেকে সরান" : "Remove from saved"}
                      style={[styles.savedBtn, { backgroundColor: theme.accentSoft }]}
                      onPress={() => removeSaved(post.id)}
                    >
                      <Feather name="bookmark" size={17} color={theme.accent} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          <View style={[styles.divider, { backgroundColor: theme.divider || theme.cardBorder }]} />
          <Row icon="shopping-bag" label={t("profile.myOrders")} onPress={() => go("Orders")} testID="profile-my-orders" />
          <Row icon="file-text" label={t("profile.applications")} onPress={() => go("ApplicationsList")} testID="profile-applications" />
          <Row icon="clipboard" label={t("rfq.title")} onPress={() => go("Rfq")} testID="profile-rfq" />
          <Row icon="award" label={t("profile.achievements")} onPress={() => go("Badges")} testID="profile-badges" last />
        </Group>

        <Group title={bn ? "কেনাকাটা" : "Shopping"} testID="profile-options-shopping">
          <Row icon="credit-card" label={t("profile.wallet")} onPress={() => go("Wallet")} testID="profile-wallet" />
          <Row icon="heart" label={t("profile.wishlist")} onPress={() => go("Wishlist")} testID="profile-wishlist" />
          <Row icon="truck" label={t("profile.deliveryTracking")} onPress={() => go("DeliveryTracking")} testID="profile-delivery-tracking" />
          <Row icon="map-pin" label={t("profile.deliveryAddress")} onPress={() => go("AddressManagement")} testID="profile-address" last />
        </Group>

        <Group title={bn ? "অ্যাপ" : "App"} testID="profile-options-app">
          <Row
            icon="users"
            label={t("community.title")}
            onPress={() => communitySwitcherRef.current?.openModal()}
            testID="profile-community"
            right={
              <View style={styles.communityRight}>
                <CommunitySwitcher ref={communitySwitcherRef} compact />
              </View>
            }
          />
          <Row icon="edit-2" label={bn ? "প্রোফাইল এডিট" : "Edit profile"} onPress={() => go("EditProfile")} testID="profile-options-edit" />
          <Row icon="settings" label={t("profile.settings")} onPress={() => go("Settings")} testID="profile-settings" last />
        </Group>

        <Pressable
          testID="profile-logout-button"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.logout,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            pressed && { opacity: 0.8 },
          ]}
          onPress={signOut}
        >
          <Feather name="log-out" size={18} color="#DA2F2F" />
          <ThemedText style={[styles.logoutText, { color: theme.error }]}>{t("auth.signOut")}</ThemedText>
        </Pressable>

        <ThemedText type="small" style={[styles.version, { color: theme.textSecondary }]}>
          {t("profile.version")} 1.0.0
        </ThemedText>
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  onPress,
  testID,
  right,
  last,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  testID?: string;
  right?: React.ReactNode;
  last?: boolean;
}) {
  const { theme, isDark } = useTheme();
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSecondary }]}
        onPress={onPress}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.rowIcon, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name={icon as any} size={18} color={isDark ? theme.primaryTint : theme.primary} />
          </View>
          <ThemedText style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>
            {label}
          </ThemedText>
        </View>
        {right ?? <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />}
      </Pressable>
      {last ? null : <View style={[styles.divider, { backgroundColor: theme.divider || theme.cardBorder }]} />}
    </>
  );
}

function Group({ title, children, testID }: { title: string; children: React.ReactNode; testID?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.group} testID={testID}>
      <ThemedText style={[styles.groupTitle, { color: theme.textSecondary }]}>{title}</ThemedText>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  inner: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  group: {
    marginBottom: Spacing.lg,
  },
  groupTitle: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
    minWidth: 0,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: "DMSans_500Medium",
    fontWeight: "500",
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.md + 34 + Spacing.md,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
    fontWeight: "600",
  },
  communityRight: {
    marginLeft: Spacing.sm,
  },
  savedList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  savedItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  savedImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  savedBody: {
    flex: 1,
    minWidth: 0,
  },
  savedAuthor: {
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
    fontWeight: "600",
    marginBottom: 2,
  },
  savedText: {
    fontSize: 13,
    lineHeight: 18,
  },
  savedActions: {
    gap: Spacing.xs,
  },
  savedBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
    fontWeight: "600",
  },
  version: {
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
