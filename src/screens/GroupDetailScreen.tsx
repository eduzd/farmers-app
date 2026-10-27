import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Modal, ScrollView } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@/components/icons/Feather";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ModalBottomInset } from "@/components/ModalBottomInset";

import { EmptyState } from "@/components/ui";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
type RouteProps = RouteProp<RootStackParamList, "GroupDetail">;

interface GroupPost {
  id: string;
  author: {
    name: string;
    initials: string;
    isWelfareMember?: boolean;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  createdAt: string;
}

const SAMPLE_POSTS: GroupPost[] = [];

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const { group } = route.params;

  const [posts, setPosts] = useState<GroupPost[]>(SAMPLE_POSTS);
  const [refreshing, setRefreshing] = useState(false);
  const [isJoined, setIsJoined] = useState(group.isJoined);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleLike = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );
  };

  const handleJoinToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsJoined(!isJoined);
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newPost: GroupPost = {
      id: Date.now().toString(),
      author: { name: "আপনি", initials: "আ" },
      content: newPostContent.trim(),
      likes: 0,
      comments: 0,
      isLiked: false,
      createdAt: "এইমাত্র",
    };

    setPosts([newPost, ...posts]);
    setNewPostContent("");
    setShowCreatePost(false);
  };

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "K";
    }
    return count.toString();
  };

  const renderHeader = () => (
    <View>
      {group.coverImage ? (
        <Image
          source={{ uri: group.coverImage }}
          style={styles.coverImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: group.color + "30" }]}>
          <ThemedText style={styles.coverIcon}>{group.icon}</ThemedText>
        </View>
      )}

      <View style={[styles.groupInfo, { backgroundColor: theme.card }]}>
        <View style={styles.groupHeader}>
          <View style={[styles.iconCircle, { backgroundColor: group.color + "20" }]}>
            <ThemedText style={styles.groupIcon}>{group.icon}</ThemedText>
          </View>
          <View style={styles.groupTitleContainer}>
            <ThemedText style={[styles.groupName, { color: theme.text }]}>
              {group.name}
            </ThemedText>
            <View style={[styles.categoryBadge, { backgroundColor: group.color + "15" }]}>
              <ThemedText style={[styles.categoryText, { color: group.color }]}>
                {group.category}
              </ThemedText>
            </View>
          </View>
        </View>

        <ThemedText style={[styles.groupDesc, { color: theme.textSecondary }]}>
          {group.description}
        </ThemedText>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {formatCount(group.memberCount)}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              সদস্য
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.inputBorder }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {formatCount(group.postCount)}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              পোস্ট
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.inputBorder }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {group.lastActivity}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              শেষ কার্যক্রম
            </ThemedText>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <Pressable
            style={[
              styles.joinButton,
              {
                backgroundColor: isJoined ? theme.backgroundRoot : theme.primary,
                borderColor: isJoined ? theme.inputBorder : theme.primary,
              },
            ]}
            onPress={handleJoinToggle}
          >
            <AppIcon
              name={isJoined ? "check" : "user-plus"}
              size={18}
              color={isJoined ? theme.primary : theme.white}
            />
            <ThemedText
              style={[
                styles.joinButtonText,
                { color: isJoined ? theme.primary : theme.white },
              ]}
            >
              {isJoined ? "যুক্ত আছেন" : "যোগ দিন"}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.shareButton, { borderColor: theme.inputBorder }]}
          >
            <Feather name="share-2" size={18} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.postsHeader}>
        <ThemedText style={[styles.postsTitle, { color: theme.text }]}>
          সাম্প্রতিক পোস্ট
        </ThemedText>
      </View>
    </View>
  );

  const renderPost = ({ item }: { item: GroupPost }) => (
    <View
      style={[
        styles.postCard,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.postHeader}>
        <UserAvatar
          initials={item.author.initials}
          size="medium"
          isWelfareMember={item.author.isWelfareMember}
        />
        <View style={styles.authorInfo}>
          <ThemedText style={[styles.authorName, { color: theme.text }]}>
            {item.author.name}
          </ThemedText>
          <ThemedText style={[styles.postTime, { color: theme.textSecondary }]}>
            {item.createdAt}
          </ThemedText>
        </View>
        <Pressable style={styles.moreButton}>
          <Feather name="more-horizontal" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      <ThemedText style={[styles.postContent, { color: theme.text }]}>
        {item.content}
      </ThemedText>

      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.postImage}
          contentFit="cover"
          transition={200}
        />
      ) : null}

      <View style={[styles.postActions, { borderTopColor: theme.inputBorder }]}>
        <Pressable
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Feather
            name="heart"
            size={20}
            color={item.isLiked ? "#DA2F2F" : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.actionText,
              { color: item.isLiked ? "#DA2F2F" : theme.textSecondary },
            ]}
          >
            {item.likes}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.actionButton}>
          <ChatIcon size={20} color={theme.textSecondary} />
          <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
            {item.comments}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.actionButton}>
          <Feather name="share-2" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={posts}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: 0,
            paddingBottom: insets.bottom + Spacing.xl + 70,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {isJoined ? (
        <Pressable
          style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + Spacing.lg }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowCreatePost(true);
          }}
        >
          <Feather name="edit-2" size={22} color={theme.white} />
        </Pressable>
      ) : null}

      <Modal
        visible={showCreatePost}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreatePost(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCreatePost(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                নতুন পোস্ট
              </ThemedText>
              <Pressable onPress={() => setShowCreatePost(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: Spacing.xl },
              ]}
            >
              <TextInput
                style={[
                  styles.postInput,
                  {
                    backgroundColor: theme.backgroundRoot,
                    color: theme.text,
                    borderColor: theme.inputBorder,
                  },
                ]}
                placeholder="আপনার মতামত শেয়ার করুন..."
                placeholderTextColor={theme.textSecondary}
                value={newPostContent}
                onChangeText={setNewPostContent}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <View style={styles.attachmentRow}>
                <Pressable style={[styles.attachButton, { borderColor: theme.inputBorder }]}>
                  <Feather name="image" size={20} color={theme.primary} />
                  <ThemedText style={[styles.attachText, { color: theme.primary }]}>
                    ছবি যোগ করুন
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.postButton,
                  { backgroundColor: theme.primary },
                  !newPostContent.trim() && styles.buttonDisabled,
                ]}
                onPress={handleCreatePost}
                disabled={!newPostContent.trim()}
              >
                <ThemedText style={[styles.postButtonText, { color: theme.white }]}>
                  পোস্ট করুন
                </ThemedText>
              </Pressable>
            </ScrollView>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  coverImage: {
    width: "100%",
    height: 150,
  },
  coverPlaceholder: {
    width: "100%",
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  coverIcon: {
    fontSize: 50,
  },
  groupInfo: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  groupIcon: {
    fontSize: 28,
  },
  groupTitleContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  groupName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  groupDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: "100%",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  joinButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  postsHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  postsTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  postCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.lg,
    borderWidth: 1,
    ...Shadows.medium,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  authorInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "600",
  },
  postTime: {
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    padding: Spacing.xs,
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
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    gap: Spacing["2xl"],
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  separator: {
    height: Spacing.md,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.medium,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing["2xl"],
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  postInput: {
    height: 150,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  attachmentRow: {
    marginBottom: Spacing.xl,
  },
  attachButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  attachText: {
    fontSize: 14,
    fontWeight: "500",
  },
  postButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
