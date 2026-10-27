import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@/components/icons/Feather";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { likeServerPost } from "@/lib/feedApi";
import { fetchUserPosts } from "@/lib/liveDataApi";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
interface Post {
  id: string;
  content: string;
  translatedContent?: string;
  image?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  createdAt: string;
  status: "approved" | "pending";
  isOnline?: boolean;
}

type FilterType = "all" | "pending" | "approved";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyPostsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { t, language } = useI18n();
  const { user, isWelfareMember } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const bn = language === "bn";
  const token = useAuthStore((st: any) => st.token);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // This account's real posts from the server (they go live as soon as they're posted).
  const load = useCallback(async () => {
    const uid = (user as any)?.id;
    if (!uid) {
      setMyPosts([]);
      setLoading(false);
      return;
    }
    setFailed(false);
    try {
      const posts = await fetchUserPosts(uid, bn);
      setMyPosts(
        posts.map((p) => ({
          id: p.id,
          content: p.content,
          image: p.image,
          likes: p.likes,
          comments: p.comments,
          isLiked: p.isLiked,
          createdAt: p.createdAt,
          status: "approved" as const,
        })),
      );
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user, bn]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleLike = async (post: Post) => {
    if (!token) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const r = await likeServerPost(token, post.id, !post.isLiked);
      setMyPosts((prev) => prev.map((x) => (x.id === post.id ? { ...x, isLiked: r.liked, likes: r.likes } : x)));
    } catch {
      // Not changed on the server, so not changed here.
    }
  };

  const filteredPosts = myPosts;

  const allCount = myPosts.length;

  const filters: { key: FilterType; label: string; count: number; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "all", label: language === "bn" ? "সব" : "All", count: allCount, icon: "file-text" },
  ];

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* User Info */}
      <View style={styles.userInfoRow}>
        <UserAvatar
          initials={user?.initials || "U"}
          avatar={user?.avatar}
          avatarId={user?.avatarId}
          avatarColor={user?.avatarColor}
          size="large"
          isWelfareMember={isWelfareMember}
        />
        <View style={styles.userDetails}>
          <ThemedText style={[styles.userName, { color: theme.text }]}>
            {user?.name || "User"}
          </ThemedText>
          <ThemedText style={[styles.userRole, { color: theme.textSecondary }]}>
            {loading || failed ? "" : `${allCount} ${bn ? "পোস্ট" : allCount === 1 ? "post" : "posts"}`}
          </ThemedText>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              style={[
                styles.filterTab,
                isActive 
                  ? { backgroundColor: "#202936" } 
                  : { backgroundColor: "transparent", borderWidth: 1, borderColor: filter.key === "pending" ? "#B25E09" : filter.key === "approved" ? "#00BB77" : theme.cardBorder }
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(filter.key);
              }}
            >
              <AppIcon 
                name={filter.icon} 
                size={14} 
                color={isActive ? "#fff" : filter.key === "pending" ? "#B25E09" : filter.key === "approved" ? "#00BB77" : theme.text} 
              />
              <ThemedText style={[
                styles.filterTabText, 
                { color: isActive ? "#fff" : filter.key === "pending" ? "#B25E09" : filter.key === "approved" ? "#00BB77" : theme.text }
              ]}>
                {filter.label} ({filter.count})
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <UserAvatar
          initials={user?.initials || "U"}
          avatar={user?.avatar}
          avatarId={user?.avatarId}
          avatarColor={user?.avatarColor}
          size="medium"
          isWelfareMember={isWelfareMember}
        />
        <View style={styles.postAuthorInfo}>
          <ThemedText style={[styles.postAuthorName, { color: theme.text }]}>
            {user?.name || "User"}
          </ThemedText>
          <View style={styles.postMetaRow}>
            <ThemedText style={[styles.postTime, { color: theme.textSecondary }]}>
              {item.createdAt}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Post Content */}
      <ThemedText style={[styles.postContent, { color: theme.text }]}>
        {item.content}
      </ThemedText>

      {/* Translated Content Box */}
      {item.translatedContent ? (
        <View style={[styles.translatedBox, { backgroundColor: theme.backgroundRoot }]}>
          <ThemedText style={[styles.translatedText, { color: theme.textSecondary }]}>
            {item.translatedContent}
          </ThemedText>
        </View>
      ) : null}

      {/* Post Image */}
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.postImage} contentFit="cover" />
      ) : null}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <View style={styles.leftActions}>
          <Pressable 
            style={styles.actionButton}
            onPress={() => toggleLike(item)}
          >
            <View style={[
              styles.actionIconCircle,
              item.isLiked && { backgroundColor: "#DA2F2F20" }
            ]}>
              <Feather 
                name="heart" 
                size={18} 
                color={item.isLiked ? "#DA2F2F" : theme.textSecondary} 
              />
            </View>
            <ThemedText style={[styles.actionCount, { color: item.isLiked ? "#DA2F2F" : theme.textSecondary }]}>
              {item.likes}
            </ThemedText>
          </Pressable>

          <Pressable 
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("PostDetail", { 
                postId: item.id, 
                post: { 
                  id: item.id, 
                  author: { id: (user as any)?.id, name: user?.name || "", avatar: user?.avatar || "", initials: user?.name?.charAt(0) || "" },
                  content: item.content, 
                  image: item.image, 
                  likes: item.likes, 
                  comments: item.comments, 
                  views: 0, 
                  isLiked: item.isLiked, 
                  isSaved: false,
                  createdAt: item.createdAt,
                  shared: true,
                } as any
              });
            }}
          >
            <View style={styles.actionIconCircle}>
              <ChatIcon size={18} color={theme.textSecondary} />
            </View>
            <ThemedText style={[styles.actionCount, { color: theme.textSecondary }]}>
              {item.comments}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.rightActions}>
          <Pressable 
            style={styles.actionIconCircle}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Feather name="bookmark" size={18} color={theme.textSecondary} />
          </Pressable>
          <Pressable 
            style={styles.actionIconCircle}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Feather name="upload" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={[styles.emptyContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <Feather name="edit-3" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        {loading
          ? (bn ? "লোড হচ্ছে..." : "Loading...")
          : failed
          ? (bn ? "পোস্ট লোড করা যায়নি" : "Couldn't load your posts")
          : t("profile.noPosts")}
      </ThemedText>
      {loading ? null : failed ? (
        <Pressable onPress={load}>
          <ThemedText style={[styles.emptySubtitle, { color: theme.primary }]}>{bn ? "আবার চেষ্টা করুন" : "Try again"}</ThemedText>
        </Pressable>
      ) : (
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          {t("profile.startPosting")}
        </ThemedText>
      )}
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl }
        ]}
        ListEmptyComponent={renderEmpty}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.lg,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  userAvatarImage: {
    width: "100%",
    height: "100%",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  userRole: {
    fontSize: 14,
    marginTop: 2,
  },
  filtersScroll: {
    marginHorizontal: -Spacing.lg,
  },
  filtersContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
  },
  postCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  postAuthorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  postAuthorAvatarImage: {
    width: "100%",
    height: "100%",
  },
  postAuthorInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  postAuthorName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  postTime: {
    fontSize: 13,
  },
  postMetaDot: {
    fontSize: 13,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  approvedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  translatedBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  translatedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
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
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionCount: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl * 1.5,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.lg,
    fontFamily: "DMSans_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
});
