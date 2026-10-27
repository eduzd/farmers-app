import React, { useState, useEffect, useLayoutEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { IconButton } from "@/components/ui";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PublicUser } from "@/lib/storage";

import { tr, useTr } from "@/lib/tr";
import { apiGet, apiPost, isLoggedIn, currentUserId } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { AppIcon } from "@/components/icons/AppIcon";
import { LOADING, FAILED, countText, parseFollowCounts, pick, type FollowCounts, type Loaded } from "@/lib/profileStats";
import { compactCount } from "@/lib/liveDataApi";
import { formatJoined } from "@/lib/profileApi";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileFeed, type AboutRow } from "@/components/profile/ProfileFeed";
import { VisitorProfileMenu } from "@/components/profile/VisitorProfileMenu";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type UserProfileRouteProp = RouteProp<RootStackParamList, "UserProfile">;

const SECTOR_LABELS: Record<string, string> = {
  crops: "শস্য চাষী",
  vegetables: "সবজি চাষী",
  fruits: "ফল চাষী",
  dairy: "দুগ্ধ খামারি",
  poultry: "পোল্ট্রি খামারি",
  fish: "মাছ চাষী",
  livestock: "পশু পালক",
  organic: "অর্গানিক চাষী",
  mixed: "মিশ্র খামারি",
  farmer: "কৃষক",
  buyer: "ক্রেতা",
  company: "কোম্পানি",
  expert: "বিশেষজ্ঞ",
};

export default function UserProfileScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<UserProfileRouteProp>();
  const passed = route.params.user;
  const { language } = useI18n();
  const bn = language === "bn";
  const token = useAuthStore((st: any) => st.token);

  // The person as the server has them now: their real photo, name and role, whatever screen
  // opened this page. Until it loads, what that screen already knew (photo included) shows.
  const [user, setUser] = useState<PublicUser>(passed);
  const [missing, setMissing] = useState(false);
  const isMe = !!passed.id && passed.id === currentUserId();
  useEffect(() => {
    setUser(passed);
    setMissing(false);
    let alive = true;
    apiGet<any>(`/api/users/${encodeURIComponent(passed.id)}/profile`)
      .then((p) => {
        if (!alive || !p?.id) return;
        const roleRaw = String(p.profileRole || p.role || "");
        setUser((u) => ({
          ...u,
          name: p.name || u.name,
          username: p.username || u.username,
          initials: p.initials || u.initials,
          // An uploaded photo wins. With none on the server, there is no photo: show the face/initials.
          avatar: p.avatar || undefined,
          verified: !!p.verified,
          role: (["farmer", "buyer", "company", "expert"].includes(roleRaw) ? roleRaw : u.role) as PublicUser["role"],
          farmingCategory: p.farmingCategory || u.farmingCategory,
        }));
      })
      .catch((e: any) => {
        if (alive && /isn't available|doesn't exist|404/i.test(String(e?.message || ""))) setMissing(true);
      });
    return () => {
      alive = false;
    };
  }, [passed.id]);

  const [isFollowing, setIsFollowing] = useState(user.isFollowing || false);
  // Followers / following as the server has them: "…" while loading, "—" if the load fails (never a fake 0).
  const [counts, setCounts] = useState<Loaded<FollowCounts>>(LOADING);
  const [countsReload, setCountsReload] = useState(0);
  // Real numbers from the server: followers, following, whether I follow them, and their about.
  const [about, setAbout] = useState<{ bio: string; location: string; joinedAt?: string | null }>({ bio: user.bio || "", location: user.location || "" });
  useEffect(() => {
    let alive = true;
    apiGet<any>(`/api/follows/${encodeURIComponent(user.id)}`)
      .then((f) => {
        if (!alive) return;
        const c = parseFollowCounts(f);
        setCounts({ state: "ok", value: c });
        setIsFollowing(c.isFollowing);
      })
      .catch(() => alive && setCounts(FAILED));
    return () => {
      alive = false;
    };
  }, [user.id, countsReload]);
  const retryCounts = () => {
    setCounts(LOADING);
    setCountsReload((n) => n + 1);
  };
  useEffect(() => {
    let alive = true;
    apiGet<any>(`/api/users/${encodeURIComponent(user.id)}/about`)
      .then((a) => alive && a && setAbout({ bio: a.bio || "", location: a.location || "", joinedAt: a.joinedAt ?? null }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.id]);

  const handleFollow = () => {
    if (!isLoggedIn()) {
      Alert.alert(tr("Sign in"), tr("Please sign in to follow people."));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const was = isFollowing;
    const before = counts;
    const bump = (d: number) =>
      setCounts((s) => (s.state === "ok" ? { state: "ok", value: { ...s.value, followers: Math.max(0, s.value.followers + d) } } : s));
    setIsFollowing(!was);
    bump(was ? -1 : 1);
    apiPost<{ following: boolean }>(`/api/follows/${encodeURIComponent(user.id)}`, {})
      .then((r) => {
        setIsFollowing(!!r?.following);
        // Re-read the real count; if only this re-read fails, the follow itself still went through.
        return apiGet<any>(`/api/follows/${encodeURIComponent(user.id)}`)
          .then((f) => {
            const c = parseFollowCounts(f);
            setCounts({ state: "ok", value: c });
            setIsFollowing(c.isFollowing);
          })
          .catch(() => setCounts(FAILED));
      })
      .catch((e) => {
        setIsFollowing(was);
        setCounts(before);
        Alert.alert(tr("Couldn't follow"), e?.message || tr("Please try again."));
      });
  };

  const handleMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Chat", {
      conversationId: user.id,
      userName: user.name,
      userInitials: user.initials,
      userAvatar: user.avatar,
      isWelfareMember: user.isWelfareMember,
    });
  };

  const handleFollowers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Followers", { userId: user.id, userName: user.name });
  };

  const handleFollowing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Following", { userId: user.id, userName: user.name });
  };

  const getSectorLabel = () => {
    if (user.farmingCategory) {
      return SECTOR_LABELS[user.farmingCategory] || user.farmingCategory;
    }
    return SECTOR_LABELS[user.role] || user.role;
  };

  // Like the reference design: the title bar has only the three-dot button, which opens
  // share, mute, block and report. (Your own profile opened this way gets no menu.)
  const [menuOpen, setMenuOpen] = useState(false);
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isMe || missing ? null : (
          <View testID="user-profile-more" style={{ marginRight: Spacing.lg }}>
            <IconButton
              icon="more-vertical"
              tone="header"
              accessibilityLabel={bn ? "আরও অপশন" : "More options"}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setMenuOpen(true);
              }}
            />
          </View>
        ),
    } as any);
  }, [navigation, isMe, missing, bn, theme]);

  const fmt = (n: Loaded<number>) => (n.state === "ok" ? compactCount(n.value) : countText(n));
  const joined = formatJoined(about.joinedAt, bn);
  const sector = tr(getSectorLabel());
  const aboutRows: AboutRow[] = [
    { icon: user.role === "expert" ? "award" : user.farmingCategory === "fish" ? "droplet" : "user", label: bn ? "ক্যাটাগরি" : "Category", value: sector, testID: "user-about-category" },
    ...(about.location ? [{ icon: "map-pin", label: bn ? "এলাকা" : "Location", value: about.location }] : []),
    ...(joined ? [{ icon: "calendar", label: bn ? "সদস্য" : "Member since", value: joined.replace(/^Joined |^যোগ দিয়েছেন /, "") }] : []),
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
      testID="user-profile-screen"
    >
      <ProfileHero
        userId={user.id}
        name={user.name}
        initials={user.initials}
        avatar={user.avatar}
        avatarId={user.avatarId}
        avatarColor={user.avatarColor}
        isWelfareMember={user.isWelfareMember}
        verified={!!user.verified}
        subtitle={user.username ? `@${user.username}` : undefined}
        chips={
          <View style={[styles.sectorBadge, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]} testID="user-profile-sector">
            <AppIcon name={user.farmingCategory === "fish" ? "droplet" : user.role === "expert" ? "award" : "user"} size={14} color={theme.link} />
            <ThemedText style={[styles.sectorText, { color: theme.link }]}>{sector}</ThemedText>
          </View>
        }
        bio={about.bio}
        location={about.location}
        joined={joined}
        followers={fmt(pick(counts, "followers"))}
        following={fmt(pick(counts, "following"))}
        onFollowers={handleFollowers}
        onFollowing={handleFollowing}
        bn={bn}
        statIdPrefix="user"
        primary={
          missing
            ? undefined
            : isMe
              ? { label: bn ? "প্রোফাইল এডিট" : "Edit profile", icon: "edit-2", solid: true, onPress: () => navigation.navigate("Settings", { openEditProfile: true }) }
              : isFollowing
                ? { label: bn ? "ফলোয়িং" : "Following", icon: "user-check", solid: false, onPress: handleFollow, testID: "user-follow" }
                : { label: bn ? "ফলো করুন" : "Follow", icon: "user-plus", solid: true, onPress: handleFollow, testID: "user-follow" }
        }
        secondary={missing || isMe ? undefined : { label: bn ? "মেসেজ" : "Message", icon: "chat", onPress: handleMessage, testID: "user-message" }}
        footer={
          <>
            {counts.state === "error" ? (
              <Pressable
                testID="user-stats-retry"
                accessibilityRole="button"
                onPress={retryCounts}
                style={({ pressed }) => [styles.statsRetry, pressed && { opacity: 0.6 }]}
              >
                <Feather name="refresh-cw" size={13} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {tr("Couldn't load these numbers · Tap to retry")}
                </ThemedText>
              </Pressable>
            ) : null}
            {missing ? (
              <View testID="user-profile-missing" style={styles.statsRetry}>
                <Feather name="slash" size={13} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {tr("This account isn't available")}
                </ThemedText>
              </View>
            ) : null}
          </>
        }
      />

      {missing ? null : (
        <ProfileFeed
          userId={user.id}
          author={{ id: user.id, name: user.name, initials: user.initials, avatar: user.avatar, avatarId: user.avatarId, avatarColor: user.avatarColor, verified: !!user.verified }}
          bn={bn}
          aboutRows={aboutRows}
          followers={counts.state === "ok" ? counts.value.followers : undefined}
          joinedAt={about.joinedAt}
          isMe={isMe}
          emptyPosts={{
            title: bn ? "এখনো কোনো পোস্ট নেই" : "No posts yet",
            message: bn ? `${user.name} এখনো কিছু পোস্ট করেননি।` : `${user.name} hasn't posted anything yet.`,
          }}
        />
      )}

      {isMe || missing ? null : (
        <VisitorProfileMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          user={{ id: user.id, name: user.name, username: user.username }}
          bn={bn}
          onBlocked={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectorBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  sectorText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  statsRetry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: Spacing.md, paddingVertical: Spacing.xs },
});
