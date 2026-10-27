import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { AppIcon } from "@/components/icons/AppIcon";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, FontFamily } from "@/constants/theme";

export interface ProfilePost {
  id: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  createdAt: string;
  isLiked: boolean;
}

interface Props {
  post: ProfilePost;
  author: { id?: string; name: string; initials?: string; avatar?: string; avatarId?: string; avatarColor?: string; verified?: boolean };
  onPress: () => void;
  onLike: () => void;
  onComments: () => void;
}

/** A post on a profile page, as in the reference: photo, name and time on one line, the text,
 *  the picture, then like and comment counts. A flat white card with a pale-blue hairline. */
export function ProfilePostCard({ post, author, onPress, onLike, onComments }: Props) {
  const { theme } = useTheme();
  const liked = post.isLiked;
  const heart = theme.accent || "#FF4BB7";
  return (
    <Pressable
      testID={`user-post-${post.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.head}>
        <UserAvatar initials={author.initials} name={author.name} avatar={author.avatar} avatarId={author.avatarId} avatarColor={author.avatarColor} size={40} />
        <View style={styles.headText}>
          <View style={styles.nameRow}>
            <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {author.name}
            </ThemedText>
            {author.verified ? (
              <View style={styles.tick}>
                <AppIcon name="check" size={9} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <ThemedText style={[styles.time, { color: theme.textSecondary }]} numberOfLines={1}>
            {post.createdAt}
          </ThemedText>
        </View>
      </View>

      {post.content ? (
        <ThemedText style={[styles.body, { color: theme.text }]} numberOfLines={8}>
          {post.content}
        </ThemedText>
      ) : null}

      {post.image ? <Image source={{ uri: post.image }} style={[styles.image, { backgroundColor: theme.backgroundSecondary }]} contentFit="cover" /> : null}

      <View style={styles.actions}>
        <Pressable onPress={onLike} hitSlop={8} style={styles.action} accessibilityRole="button" testID={`user-post-like-${post.id}`}>
          <AppIcon name="heart" size={18} color={liked ? heart : theme.textSecondary} fill={liked ? heart : "none"} />
          <ThemedText style={[styles.actionText, { color: liked ? heart : theme.textSecondary }]}>{post.likes}</ThemedText>
        </Pressable>
        <Pressable onPress={onComments} hitSlop={8} style={styles.action} accessibilityRole="button">
          <ChatIcon size={18} color={theme.textSecondary} />
          <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>{post.comments}</ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.lg, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  headText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { fontSize: 15, lineHeight: 20, fontFamily: FontFamily.semibold, flexShrink: 1 },
  tick: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#1DA1F2", alignItems: "center", justifyContent: "center" },
  time: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 22, marginTop: Spacing.md },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: 12, marginTop: Spacing.md },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.xl, marginTop: Spacing.md },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.medium },
});

export default ProfilePostCard;
