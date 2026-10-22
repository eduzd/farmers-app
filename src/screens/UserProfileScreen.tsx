import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PublicUser } from "@/lib/storage";

import { tr, useTr } from "@/lib/tr";
import { apiGet, apiPost, isLoggedIn } from "@/lib/api";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
import { LOADING, FAILED, countText, parseFollowCounts, pick, type FollowCounts, type Loaded } from "@/lib/profileStats";
interface UserPost {
  id: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  createdAt: string;
  isLiked: boolean;
}

const SAMPLE_POSTS: UserPost[] = [];

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
  const { user } = route.params;

  const [isFollowing, setIsFollowing] = useState(user.isFollowing || false);
  // Followers / following as the server has them: "…" while loading, "—" if the load fails (never a fake 0).
  const [counts, setCounts] = useState<Loaded<FollowCounts>>(LOADING);
  const [countsReload, setCountsReload] = useState(0);
  const [posts, setPosts] = useState<UserPost[]>(SAMPLE_POSTS);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set(SAMPLE_POSTS.filter(p => p.isLiked).map(p => p.id)));

  // Real numbers from the server: followers, following, whether I follow them, and their about.
  const [about, setAbout] = useState<{ bio: string; location: string }>({ bio: user.bio || "", location: user.location || "" });
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
      .then((a) => alive && a && setAbout({ bio: a.bio || "", location: a.location || "" }))
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

  const handleLikePost = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newLiked = new Set(likedPosts);
    if (newLiked.has(postId)) {
      newLiked.delete(postId);
      setPosts(posts.map(p => p.id === postId ? { ...p, likes: p.likes - 1 } : p));
    } else {
      newLiked.add(postId);
      setPosts(posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    }
    setLikedPosts(newLiked);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.profileHeader}>
        <UserAvatar 
          initials={user.initials}
          avatar={user.avatar}
          avatarId={user.avatarId}
          avatarColor={user.avatarColor}
          size="large" 
          isWelfareMember={user.isWelfareMember}
          userId={user.id}
        />

        <View style={styles.nameContainer}>
          <ThemedText type="h3" style={styles.profileName}>
            {user.name}
          </ThemedText>
          {user.verified ? (
            <View style={[styles.verifiedIcon, { backgroundColor: "#1DA1F2" }]}>
              <Feather name="check" size={12} color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        {user.username ? (
          <ThemedText type="body" style={[styles.username, { color: theme.textSecondary }]}>
            @{user.username}
          </ThemedText>
        ) : null}

        <View style={[styles.sectorBadge, { backgroundColor: theme.primary + "20" }]}>
          <AppIcon 
            name={user.farmingCategory === "fish" ? "droplet" : user.role === "expert" ? "award" : "user"} 
            size={14} 
            color={theme.primary} 
          />
          <ThemedText style={[styles.sectorText, { color: theme.primary }]}>
            {getSectorLabel()}
          </ThemedText>
        </View>

        {about.location ? (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
              {about.location}
            </ThemedText>
          </View>
        ) : null}

        {about.bio ? (
          <ThemedText style={[styles.bio, { color: theme.text }]}>
            {about.bio}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.statItem,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            pressed && styles.statPressed,
          ]}
          onPress={handleFollowers}
        >
          <ThemedText type="h4">{posts.length}</ThemedText>
          <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
            {tr("পোস্ট")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.statItem,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            pressed && styles.statPressed,
          ]}
          onPress={handleFollowers}
        >
          <ThemedText type="h4" testID="user-stat-followers">{countText(pick(counts, "followers"))}</ThemedText>
          <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
            {tr("ফলোয়ার্স")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.statItem,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            pressed && styles.statPressed,
          ]}
          onPress={handleFollowing}
        >
          <ThemedText type="h4" testID="user-stat-following">{countText(pick(counts, "following"))}</ThemedText>
          <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
            {tr("ফলোয়িং")}
          </ThemedText>
        </Pressable>
      </View>
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

      <View style={styles.actionButtons}>
        <Pressable
          style={({ pressed }) => [
            styles.followButton,
            isFollowing 
              ? { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1 }
              : { backgroundColor: theme.primary },
            pressed && styles.buttonPressed,
          ]}
          onPress={handleFollow}
        >
          <AppIcon 
            name={isFollowing ? "user-check" : "user-plus"} 
            size={18} 
            color={isFollowing ? theme.text : "#FFFFFF"} 
          />
          <ThemedText style={[
            styles.followButtonText,
            { color: isFollowing ? theme.text : "#FFFFFF" },
          ]}>
            {isFollowing ? tr("Following") : tr("Follow")}
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.messageButton,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            pressed && styles.buttonPressed,
          ]}
          onPress={handleMessage}
        >
          <ChatIcon size={18} color={theme.text} />
          <ThemedText style={[styles.messageButtonText, { color: theme.text }]}>
            {tr("মেসেজ")}
          </ThemedText>
        </Pressable>
      </View>

      <View style={[styles.postsHeader, { borderTopColor: theme.divider }]}>
        <ThemedText style={[styles.postsTitle, { color: theme.text }]}>
          {tr("পোস্টসমূহ")}
        </ThemedText>
      </View>
    </View>
  );

  const renderPost = ({ item }: { item: UserPost }) => (
    <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={styles.postHeader}>
        <View style={[styles.postAvatar, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.postAvatarText}>{user.initials}</ThemedText>
        </View>
        <View style={styles.postHeaderInfo}>
          <ThemedText style={[styles.postAuthor, { color: theme.text }]}>{user.name}</ThemedText>
          <ThemedText style={[styles.postTime, { color: theme.textSecondary }]}>{item.createdAt}</ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.postContent, { color: theme.text }]}>
        {item.content}
      </ThemedText>

      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.postImage}
          contentFit="cover"
        />
      ) : null}

      <View style={[styles.postActions, { borderTopColor: theme.divider }]}>
        <View style={styles.leftActions}>
          <Pressable 
            style={styles.postAction}
            onPress={() => handleLikePost(item.id)}
          >
            <View style={[
              styles.actionIconCircle,
              likedPosts.has(item.id) && { backgroundColor: "#DC262620" }
            ]}>
              <Feather 
                name="heart"
                size={18} 
                color={likedPosts.has(item.id) ? "#DC2626" : theme.textSecondary} 
              />
            </View>
            <ThemedText style={[styles.postActionText, { color: likedPosts.has(item.id) ? "#DC2626" : theme.textSecondary }]}>
              {item.likes}
            </ThemedText>
          </Pressable>

          <Pressable style={styles.postAction}>
            <View style={styles.actionIconCircle}>
              <ChatIcon size={18} color={theme.textSecondary} />
            </View>
            <ThemedText style={[styles.postActionText, { color: theme.textSecondary }]}>
              {item.comments}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.rightActions}>
          <Pressable style={styles.actionIconCircle}>
            <Feather name="bookmark" size={18} color={theme.textSecondary} />
          </Pressable>
          <Pressable style={styles.actionIconCircle}>
            <Feather name="upload" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={renderPost}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Feather name="file-text" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            {tr("এখনো কোনো পোস্ট নেই")}
          </ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  profileName: {
    textAlign: "center",
  },
  verifiedIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    marginBottom: Spacing.md,
  },
  sectorBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  sectorText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  locationText: {
    fontSize: 14,
  },
  bio: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statsRetry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: -Spacing.md,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.xs,
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
  },
  statLabel: {
    marginTop: Spacing.xs,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  followButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    ...Shadows.small,
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  messageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
    ...Shadows.small,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  headerContainer: {
    marginBottom: Spacing.md,
  },
  postsHeader: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.xl,
  },
  postsTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  postCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.small,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  postAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  postHeaderInfo: {
    flex: 1,
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  postTime: {
    fontSize: 12,
    marginTop: 2,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  postActions: {
    flexDirection: "row",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  postAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postActionText: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 15,
  },
});
