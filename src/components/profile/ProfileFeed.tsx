import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/icons/AppIcon";
import { EmptyState } from "@/components/ui";
import { ProfileTabs, ProfileTab } from "@/components/profile/ProfileTabs";
import { ProfilePostCard } from "@/components/profile/ProfilePostCard";
import { ProfileReviews, fetchSellerReviews, type SellerReviews } from "@/components/profile/ProfileReviews";
import { ProfileAchievements, earnedCount, type AchievementInput } from "@/components/profile/ProfileAchievements";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/lib/authStore";
import { fetchUserPosts } from "@/lib/liveDataApi";
import { likeServerPost, fetchServerPost, type FeedPost } from "@/lib/feedApi";
import { Spacing, FontFamily } from "@/constants/theme";

export interface AboutRow {
  icon: string;
  label: string;
  value: string;
  testID?: string;
}

type TabKey = "posts" | "reviews" | "about" | "achievements";

interface Props {
  userId?: string;
  author: { id?: string; name: string; initials?: string; avatar?: string; avatarId?: string; avatarColor?: string; verified?: boolean };
  bn: boolean;
  aboutRows: AboutRow[];
  /** Change it to load the posts again (e.g. each time the page comes into view). */
  reloadKey?: number | string;
  /** Words for an empty Posts tab. */
  emptyPosts: { title: string; message: string };
  /** Follower count once loaded (for Achievements); undefined while loading or if it failed. */
  followers?: number;
  /** When they joined (for the one-year achievement). */
  joinedAt?: string | null;
  /** True on your own profile (changes the empty Reviews words). */
  isMe?: boolean;
}

/**
 * Tabs and their content under a profile's header: Posts (their real posts from the server),
 * Reviews (what buyers wrote about their products), About (details) and Achievements (badges worked out from their real posts, followers,
 * verified tick and join date). Used on your own
 * profile and on everyone else's, so both look the same.
 */
export function ProfileFeed({ userId, author, bn, aboutRows, reloadKey, emptyPosts, followers, joinedAt, isMe }: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabKey>("posts");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const L = (en: string, b: string) => (bn ? b : en);

  useEffect(() => {
    if (!userId) {
      setPosts([]);
      setState("ok");
      return;
    }
    let alive = true;
    setState((s) => (s === "ok" && posts.length ? "ok" : "loading"));
    fetchUserPosts(userId, bn)
      .then((list) => {
        if (!alive) return;
        setPosts(list);
        setState("ok");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, bn, reloadKey, retry]);

  // Reviews buyers left on this person's products, loaded with the posts so the tab shows its count.
  const [reviews, setReviews] = useState<SellerReviews | undefined>(undefined);
  const [reviewsState, setReviewsState] = useState<"loading" | "ok" | "error">("loading");
  const [reviewsRetry, setReviewsRetry] = useState(0);
  useEffect(() => {
    if (!userId) {
      setReviews({ reviews: [], count: 0, average: 0 });
      setReviewsState("ok");
      return;
    }
    let alive = true;
    setReviewsState((s) => (s === "ok" ? "ok" : "loading"));
    fetchSellerReviews(userId)
      .then((r) => {
        if (!alive) return;
        setReviews(r);
        setReviewsState("ok");
      })
      .catch(() => alive && setReviewsState("error"));
    return () => {
      alive = false;
    };
  }, [userId, reloadKey, reviewsRetry]);

  const achieveInput: AchievementInput = {
    posts: state === "ok" ? posts : undefined,
    followers,
    verified: !!author.verified,
    joinedAt,
  };
  const earned = earnedCount(achieveInput);

  const tabs: ProfileTab<TabKey>[] = [
    { key: "posts", label: L("Posts", "পোস্ট"), icon: "file-text", count: state === "ok" ? posts.length : undefined },
    { key: "reviews", label: L("Reviews", "রিভিউ"), icon: "star", count: reviewsState === "ok" && reviews ? reviews.reviews.length : undefined },
    { key: "about", label: L("About", "পরিচিতি"), icon: "info" },
    { key: "achievements", label: L("Achievements", "অর্জন"), icon: "award", count: earned },
  ];

  // Open the post as the server has it now (full details), falling back to what this list has.
  const openPost = useCallback(
    async (p: FeedPost, comments?: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      let full: FeedPost = p;
      try {
        full = await fetchServerPost(p.id, bn, useAuthStore.getState().getToken());
      } catch {}
      navigation.navigate("PostDetail", { postId: full.id, post: full, ...(comments ? { scrollToComments: true } : {}) });
    },
    [navigation, bn],
  );

  const toggleLike = async (p: FeedPost) => {
    const token = useAuthStore.getState().getToken();
    if (!token) {
      Alert.alert(L("Sign in to like posts", "লাইক করতে সাইন ইন করুন"));
      return;
    }
    const next = !p.isLiked;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPosts((all) => all.map((x) => (x.id === p.id ? { ...x, isLiked: next, likes: Math.max(0, x.likes + (next ? 1 : -1)) } : x)));
    try {
      const r = await likeServerPost(token, p.id, next);
      setPosts((all) => all.map((x) => (x.id === p.id ? { ...x, isLiked: r.liked, likes: r.likes } : x)));
    } catch {
      setPosts((all) => all.map((x) => (x.id === p.id ? { ...x, isLiked: p.isLiked, likes: p.likes } : x)));
    }
  };

  const loadingOrError = (
    <View style={styles.center}>
      {state === "loading" ? (
        <ActivityIndicator color={theme.text} testID="user-posts-loading" />
      ) : (
        <Pressable onPress={() => setRetry((n) => n + 1)} style={styles.retry} testID="user-posts-retry" accessibilityRole="button">
          <AppIcon name="refresh-cw" size={14} color={theme.textSecondary} />
          <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>{L("Couldn't load posts · Tap to retry", "পোস্ট লোড হয়নি · আবার চেষ্টা করতে চাপুন")}</ThemedText>
        </Pressable>
      )}
    </View>
  );

  return (
    <View testID="profile-feed">
      <ProfileTabs tabs={tabs} value={tab} onChange={setTab} />
      <View style={styles.body}>
        {tab === "posts" ? (
          state !== "ok" ? (
            loadingOrError
          ) : posts.length === 0 ? (
            <View testID="user-posts-empty">
              <EmptyState icon="file-text" title={emptyPosts.title} message={emptyPosts.message} />
            </View>
          ) : (
            posts.map((p) => (
              <ProfilePostCard
                key={p.id}
                post={{ id: p.id, content: p.content, image: p.image, likes: p.likes, comments: p.comments, createdAt: p.createdAt, isLiked: p.isLiked }}
                author={author}
                onPress={() => openPost(p)}
                onLike={() => toggleLike(p)}
                onComments={() => openPost(p, true)}
              />
            ))
          )
        ) : null}

        {tab === "reviews" ? (
          <ProfileReviews
            state={reviewsState}
            data={reviews}
            bn={bn}
            name={author.name}
            isMe={isMe}
            onRetry={() => {
              setReviewsState("loading");
              setReviewsRetry((n) => n + 1);
            }}
          />
        ) : null}

        {tab === "about" ? (
          <View style={[styles.aboutCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} testID="profile-about">
            {aboutRows.length === 0 ? (
              <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>{L("No details yet.", "এখনো কোনো তথ্য নেই।")}</ThemedText>
            ) : (
              aboutRows.map((r, i) => (
                <View key={r.label} style={[styles.aboutRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]} testID={r.testID}>
                  <View style={[styles.aboutIcon, { backgroundColor: theme.backgroundSecondary }]}>
                    <AppIcon name={r.icon as any} size={16} color={theme.link || theme.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.aboutLabel, { color: theme.textSecondary }]}>{r.label}</ThemedText>
                    <ThemedText style={[styles.aboutValue, { color: theme.text }]}>{r.value}</ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === "achievements" ? (
          <>
            {state === "error" ? loadingOrError : null}
            <ProfileAchievements input={achieveInput} bn={bn} />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: Spacing.lg },
  center: { alignItems: "center", paddingVertical: Spacing["2xl"] },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, padding: Spacing.sm },
  aboutCard: { marginHorizontal: Spacing.lg, borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md },
  aboutIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  aboutLabel: { fontSize: 13, lineHeight: 18 },
  aboutValue: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.medium },
});

export default ProfileFeed;
