import React, { useState, useRef, useEffect, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, Platform, Alert, Share } from "react-native";
import { TextInput } from "@/components/MayaText";
import { KeyboardAvoidingScreen } from "@/components/KeyboardAvoidingScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, withTiming } from "react-native-reanimated";
import { ScrollSwapTitle } from "@/components/ScrollSwapTitle";
import { MentionText, MentionPerson } from "@/components/MentionText";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@/components/icons/Feather";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { tr, useTr } from "@/lib/tr";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import {
  createServerComment,
  fetchServerComments,
  initialsOf,
  isSharedPostId,
  likeServerPost,
  timeAgo,
  ServerComment,
  setServerPostSaved,
  fetchServerPost,
} from "@/lib/feedApi";
import { PostActionsSheet } from "@/components/PostActionsSheet";
import { PostPhoto } from "@/components/PhotoViewer";
import { PostPollCard, usePollStore } from "@/components/PostPollCard";
import { VoiceRoomPostCard, VOICE_POST_RE, isVoiceRoomPostText } from "@/components/VoiceRoomPostCard";
import { ChatIcon } from "@/components/icons/ChatIcon";
type PostDetailRouteProp = RouteProp<RootStackParamList, "PostDetail">;

interface Reply {
  id: string;
  parentReplyId?: string;
  author: {
    id?: string;
    name: string;
    initials: string;
    avatar?: string;
    avatarId?: string;
    avatarColor?: string;
    isWelfareMember?: boolean;
  };
  content: string;
  createdAt: string;
  likes: number;
  isLiked: boolean;
  replies: Reply[];
}

interface Comment {
  id: string;
  author: {
    id?: string;
    name: string;
    initials: string;
    avatar?: string;
    avatarId?: string;
    avatarColor?: string;
    isWelfareMember?: boolean;
  };
  content: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
  replies: Reply[];
}

interface LikedUser {
  id: string;
  name: string;
  initials: string;
  color: string;
}


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PostDetailScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  // Just above the navigation bar; right on top of the keyboard when it is open.
  const composerPadding = useKeyboardAwareBottomPadding(Spacing.sm, { min: Spacing.md });
  const { theme } = useTheme();
  const route = useRoute<PostDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { post } = route.params;

  const flatListRef = useRef<FlatList>(null);

  // Scroll past the author row and the header title "Post" slides away for the author's name.
  const titleSwap = useSharedValue(0);
  const nameShown = useRef(false);
  const authorBottom = useRef(72);
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <ScrollSwapTitle title={tr("Post")} swapTo={post.author.name} progress={titleSwap} />,
    });
  }, [navigation, post.author.name, tr("Post")]);
  const onListScroll = (e: any) => {
    const show = e.nativeEvent.contentOffset.y > authorBottom.current;
    if (show !== nameShown.current) {
      nameShown.current = show;
      titleSwap.value = withTiming(show ? 1 : 0, { duration: 220 });
    }
  };
  // Shared posts: real comments from the server (the author is notified of each new one).
  const shared = !!post.shared || isSharedPostId(post.id);
  const getToken = useAuthStore((s) => s.getToken);
  const me = useAuthStore((s) => s.user);
  const { language } = useI18n();
  const isBn = language === "bn";
  const [comments, setComments] = useState<Comment[]>([]);
  const [sending, setSending] = useState(false);
  const toComment = (c: ServerComment): Comment => ({
    id: c.id,
    author: { id: c.userId, name: c.userName, initials: initialsOf(c.userName), avatar: c.avatar || undefined },
    content: c.body,
    likes: 0,
    isLiked: false,
    createdAt: c.createdAt ? timeAgo(c.createdAt, isBn) : "",
    replies: [],
  });

  useEffect(() => {
    if (!shared) return;
    let alive = true;
    fetchServerComments(post.id)
      .then((list) => {
        if (alive) setComments(list.map(toComment));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, shared]);
  // Poll posts: fetch fresh vote counts when the page opens.
  useEffect(() => {
    if (!shared || !post.poll) return;
    let alive = true;
    fetchServerPost(post.id, isBn, getToken())
      .then((fresh) => {
        if (alive && fresh.poll) usePollStore.getState().setPoll(post.id, fresh.poll);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, shared]);
  // Opened from a notification: scroll to that comment and light it up for a few seconds
  // (or to the comments, for older comment notifications), and say so if the comment is gone.
  const deepLink = (route.params || {}) as { highlightCommentId?: string; scrollToComments?: boolean; commentMissing?: boolean };
  const [highlightId, setHighlightId] = useState<string>(deepLink.highlightCommentId || "");
  const [commentGone, setCommentGone] = useState(!!deepLink.commentMissing);
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || (!deepLink.highlightCommentId && !deepLink.scrollToComments)) return;
    if (!comments.length) return;
    deepLinked.current = true;
    const want = deepLink.highlightCommentId || "";
    const index = want ? comments.findIndex((c) => String(c.id) === want) : 0;
    if (index < 0) {
      setCommentGone(true);
      return;
    }
    const t = setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
      } catch {}
    }, 350);
    const clear = want ? setTimeout(() => setHighlightId(""), 4000) : undefined;
    return () => { clearTimeout(t); if (clear) clearTimeout(clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments]);
  useEffect(() => {
    if (!commentGone) return;
    const t = setTimeout(() => setCommentGone(false), 6000);
    return () => clearTimeout(t);
  }, [commentGone]);
  const [newComment, setNewComment] = useState("");
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [isSaved, setIsSaved] = useState(!!post.isSaved);
  const [postText, setPostText] = useState(post.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ 
    commentId: string; 
    authorName: string;
    replyId?: string;
    replyPath?: string[];
  } | null>(null);

  const handleShare = async () => {
    try {
      await Share.share({ message: `${post.author.name}: ${postText}` });
    } catch {
      // user dismissed the share sheet
    }
  };

  // Saved on the server, so the post shows under Saved posts on the profile.
  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isSaved;
    setIsSaved(next);
    if (!shared) return;
    const bn = useI18n.getState().language === "bn";
    const token = getToken();
    try {
      if (!token) throw new Error(bn ? "সেভ করতে আগে সাইন ইন করুন।" : "Sign in to save posts.");
      await setServerPostSaved(token, post.id, next);
    } catch (e) {
      setIsSaved(!next);
      Alert.alert(bn ? "সেভ হয়নি" : "Couldn't save", e instanceof Error ? e.message : "");
    }
  };

  const handleReply = (commentId: string, authorName: string, replyId?: string, replyPath?: string[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyingTo({ commentId, authorName, replyId, replyPath });
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const toggleReplyLike = (replies: Reply[], replyId: string): Reply[] => {
    return replies.map((reply) => {
      if (reply.id === replyId) {
        return {
          ...reply,
          isLiked: !reply.isLiked,
          likes: reply.isLiked ? reply.likes - 1 : reply.likes + 1,
        };
      }
      if (reply.replies.length > 0) {
        return { ...reply, replies: toggleReplyLike(reply.replies, replyId) };
      }
      return reply;
    });
  };

  const handleReplyLike = (commentId: string, replyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? { ...comment, replies: toggleReplyLike(comment.replies, replyId) }
          : comment
      )
    );
  };

  const addNestedReply = (replies: Reply[], targetPath: string[], newReply: Reply): Reply[] => {
    if (targetPath.length === 0) return replies;
    
    return replies.map((reply) => {
      if (reply.id === targetPath[0]) {
        if (targetPath.length === 1) {
          return { ...reply, replies: [...reply.replies, newReply] };
        }
        return { ...reply, replies: addNestedReply(reply.replies, targetPath.slice(1), newReply) };
      }
      return reply;
    });
  };

  const handleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const before = { isLiked, likesCount };
    const liked = !isLiked;
    setIsLiked(liked);
    setLikesCount((prev) => Math.max(0, prev + (liked ? 1 : -1)));
    if (!shared) return;
    const token = getToken();
    try {
      if (!token) throw new Error("signed out");
      const out = await likeServerPost(token, post.id, liked);
      setIsLiked(out.liked);
      setLikesCount(out.likes);
    } catch {
      setIsLiked(before.isLiked);
      setLikesCount(before.likesCount);
      Alert.alert(isBn ? "লাইক হয়নি" : "Couldn't like", token ? (isBn ? "আবার চেষ্টা করুন।" : "Check your internet and try again.") : isBn ? "লাইক করতে সাইন ইন করুন।" : "Sign in to like posts.");
    }
  };

  // Open the real profile of a post author, commenter or @mentioned person (no made-up numbers).
  const handleAuthorPress = (author: MentionPerson) => {
    if (!author.id) return; // an old comment without an account behind it
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate("UserProfile", {
      user: {
        id: author.id,
        name: author.name,
        initials: author.initials || author.name.charAt(0).toUpperCase(),
        avatar: author.avatar,
        role: "farmer",
        verified: false,
        followersCount: 0,
        followingCount: 0,
        location: "",
        bio: "",
      } as any,
    });
  };

  // Everyone in this thread who can be @mentioned: the post author and every commenter.
  const mentionPeople = useMemo<MentionPerson[]>(() => {
    const seen = new Map<string, MentionPerson>();
    const add = (a: any) => {
      if (a?.name && a?.id && !seen.has(a.name.toLowerCase())) seen.set(a.name.toLowerCase(), { id: a.id, name: a.name, initials: a.initials, avatar: a.avatar });
    };
    add(post.author);
    for (const c of comments) {
      add(c.author);
      for (const r of c.replies || []) add(r.author);
    }
    return [...seen.values()];
  }, [post.author, comments]);


  const handleCommentLike = (commentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isLiked: !comment.isLiked,
              likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
            }
          : comment
      )
    );
  };

  const myName = me?.name || (isBn ? "আমি" : "Me");

  const handleSendComment = async () => {
    if (!newComment.trim() || sending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (shared) {
      const token = getToken();
      if (!token) {
        Alert.alert(isBn ? "সাইন ইন করুন" : "Sign in", isBn ? "মন্তব্য করতে সাইন ইন করুন।" : "Sign in to comment.");
        return;
      }
      // The server keeps one level of comments; a reply starts with @name.
      const text = replyingTo ? `@${replyingTo.authorName} ${newComment.trim()}` : newComment.trim();
      setSending(true);
      try {
        const saved = await createServerComment(token, post.id, text);
        setComments((prev) => [...prev, toComment(saved)]);
        setNewComment("");
        setReplyingTo(null);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      } catch {
        Alert.alert(isBn ? "মন্তব্য যায়নি" : "Comment not sent", isBn ? "ইন্টারনেট দেখে আবার চেষ্টা করুন।" : "Check your internet and try again.");
      } finally {
        setSending(false);
      }
      return;
    }

    if (replyingTo) {
      const reply: Reply = {
        id: Date.now().toString(),
        parentReplyId: replyingTo.replyId,
        author: { name: myName, initials: initialsOf(myName) },
        content: newComment.trim(),
        createdAt: "Just now",
        likes: 0,
        isLiked: false,
        replies: [],
      };

      if (replyingTo.replyPath && replyingTo.replyPath.length > 0) {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === replyingTo.commentId
              ? { ...comment, replies: addNestedReply(comment.replies, replyingTo.replyPath!, reply) }
              : comment
          )
        );
      } else {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === replyingTo.commentId
              ? { ...comment, replies: [...comment.replies, reply] }
              : comment
          )
        );
      }
      setReplyingTo(null);
    } else {
      const comment: Comment = {
        id: Date.now().toString(),
        author: { name: myName, initials: initialsOf(myName) },
        content: newComment.trim(),
        likes: 0,
        isLiked: false,
        createdAt: "Just now",
        replies: [],
      };

      setComments((prev) => [...prev, comment]);
    }
    
    setNewComment("");
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderReply = (reply: Reply, commentId: string, depth: number = 0, parentPath: string[] = []) => {
    const currentPath = [...parentPath, reply.id];
    const isNested = depth > 0;
    
    return (
      <View key={reply.id} style={styles.replyItem}>
        <View style={styles.replyAvatarContainer}>
          {isNested ? (
            <View style={[styles.replyThreadLine, { backgroundColor: theme.inputBorder || theme.cardBorder }]} />
          ) : null}
          <Pressable onPress={() => handleAuthorPress(reply.author)}>
            <UserAvatar
              initials={reply.author.initials}
              avatar={reply.author.avatar}
              avatarId={reply.author.avatarId}
              avatarColor={reply.author.avatarColor}
              size="small"
              isWelfareMember={reply.author.isWelfareMember}
              userId={reply.author.id}
            />
          </Pressable>
        </View>
        <View style={styles.replyContentWrapper}>
          <View style={[styles.replyBubble, { backgroundColor: theme.backgroundDefault }]}>
            <Pressable onPress={() => handleAuthorPress(reply.author)}>
              <ThemedText style={[styles.replyAuthor, { color: theme.text }]}>
                {reply.author.name}
              </ThemedText>
            </Pressable>
            <MentionText
              text={reply.content}
              people={mentionPeople}
              onPressPerson={handleAuthorPress}
              mentionColor={theme.primary}
              style={[styles.replyText, { color: theme.text }]}
            />
          </View>
          <View style={styles.replyMeta}>
            <ThemedText style={[styles.replyTime, { color: theme.textSecondary }]}>
              {reply.createdAt}
            </ThemedText>
            <Pressable
              style={styles.replyLikeButton}
              onPress={() => handleReplyLike(commentId, reply.id)}
            >
              <ThemedText
                style={[
                  styles.replyLikeText,
                  { color: reply.isLiked ? theme.primary : theme.textSecondary },
                ]}
              >
                Like ({reply.likes})
              </ThemedText>
            </Pressable>
            <Pressable
              style={styles.replyLikeButton}
              onPress={() => handleReply(commentId, reply.author.name, reply.id, currentPath)}
            >
              <ThemedText style={[styles.replyLikeText, { color: theme.textSecondary }]}>
                {tr("Reply")}
              </ThemedText>
            </Pressable>
          </View>
          {reply.replies.length > 0 ? (
            <View style={styles.nestedReplies}>
              {reply.replies.map((nestedReply) => 
                renderReply(nestedReply, commentId, depth + 1, currentPath)
              )}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View
      testID={highlightId && String(item.id) === highlightId ? "comment-highlighted" : `comment-${item.id}`}
      style={[styles.commentItem, highlightId && String(item.id) === highlightId ? { backgroundColor: theme.primary + "1F", borderRadius: 14, marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 6 } : null]}
    >
      <Pressable onPress={() => handleAuthorPress(item.author)}>
        <UserAvatar
          initials={item.author.initials}
          avatar={item.author.avatar}
          avatarId={item.author.avatarId}
          avatarColor={item.author.avatarColor}
          size="small"
          isWelfareMember={item.author.isWelfareMember}
          userId={item.author.id}
        />
      </Pressable>
      <View style={styles.commentContent}>
        <View style={[styles.commentBubble, { backgroundColor: theme.backgroundDefault }]}>
          <Pressable onPress={() => handleAuthorPress(item.author)}>
            <ThemedText style={[styles.commentAuthor, { color: theme.text }]}>
              {item.author.name}
            </ThemedText>
          </Pressable>
          <MentionText
            text={item.content}
            people={mentionPeople}
            onPressPerson={handleAuthorPress}
            mentionColor={theme.primary}
            style={[styles.commentText, { color: theme.text }]}
          />
        </View>
        <View style={styles.commentMeta}>
          <ThemedText style={[styles.commentTime, { color: theme.textSecondary }]}>
            {item.createdAt}
          </ThemedText>
          <Pressable
            style={styles.commentLikeButton}
            onPress={() => handleCommentLike(item.id)}
          >
            <ThemedText
              style={[
                styles.commentLikeText,
                { color: item.isLiked ? theme.primary : theme.textSecondary },
              ]}
            >
              Like ({item.likes})
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.commentReplyButton}
            onPress={() => handleReply(item.id, item.author.name)}
          >
            <ThemedText style={[styles.commentReplyText, { color: theme.textSecondary }]}>
              {tr("Reply")}
            </ThemedText>
          </Pressable>
        </View>
        {item.replies.length > 0 ? (
          <View style={styles.repliesContainer}>
            {item.replies.map((reply) => renderReply(reply, item.id, 0, []))}
          </View>
        ) : null}
      </View>
    </View>
  );

  // No made-up likers: only the count is shown.
  const displayedLikedUsers: LikedUser[] = [];

  const renderHeader = () => (
    <View style={[styles.postContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View
        style={styles.postHeader}
        onLayout={(e) => {
          const l = e.nativeEvent.layout;
          authorBottom.current = Math.max(24, l.y + l.height); // once the author row has scrolled under the header
        }}
      >
        <Pressable 
          style={styles.authorPressable}
          onPress={() => handleAuthorPress(post.author)}
        >
          <UserAvatar 
            initials={post.author.initials}
            avatar={post.author.avatar}
            avatarId={post.author.avatarId}
            avatarColor={post.author.avatarColor}
            size="medium" 
            isWelfareMember={post.author.isWelfareMember}
            badge={post.author.badge}
            userId={(post.author as any).id || undefined}
          />
          <View style={styles.authorInfo}>
            <ThemedText style={[styles.authorName, { color: theme.text }]}>
              {post.author.name}
            </ThemedText>
            <ThemedText style={[styles.postTime, { color: theme.textSecondary }]}>
              {post.createdAt}
            </ThemedText>
          </View>
        </Pressable>
        <View style={styles.viewCountContainer}>
          <Feather name="eye" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.viewCountText, { color: theme.textSecondary }]}>
            {post.views}
          </ThemedText>
        </View>
        <Pressable
          style={styles.moreButton}
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={useI18n.getState().language === "bn" ? "আরও" : "More"}
          hitSlop={8}
        >
          <Feather name="more-horizontal" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      {(postText || !post.poll) && !post.voiceRoom && !isVoiceRoomPostText(post.content) ? (
        <ThemedText style={[styles.postContent, { color: theme.text }]}>
          {postText}
        </ThemedText>
      ) : null}

      {post.voiceRoom || isVoiceRoomPostText(post.content) ? (
        <VoiceRoomPostCard room={post.voiceRoom} fallbackTitle={post.content?.match(VOICE_POST_RE)?.[2]} />
      ) : null}

      {post.poll ? <PostPollCard postId={post.id} poll={post.poll} canVote={shared} style={styles.postPoll} /> : null}

      {post.image ? (
        <PostPhoto uri={post.image} style={styles.postImage} radius={BorderRadius.md} />
      ) : null}

      <View style={styles.postActionsRow}>
        <View style={styles.leftActions}>
          <Pressable style={styles.iconActionButton} onPress={handleLike}>
            <View style={[
              styles.actionIconCircle,
              isLiked && { backgroundColor: "#DA2F2F20" }
            ]}>
              <Feather
                name="heart"
                size={18}
                color={isLiked ? "#DA2F2F" : theme.textSecondary}
              />
            </View>
            <ThemedText style={[styles.iconActionCount, { color: isLiked ? "#DA2F2F" : theme.textSecondary }]}>
              {likesCount}
            </ThemedText>
          </Pressable>

          <Pressable style={styles.iconActionButton}>
            <View style={styles.actionIconCircle}>
              <ChatIcon size={18} color={theme.textSecondary} />
            </View>
            <ThemedText style={[styles.iconActionCount, { color: theme.textSecondary }]}>
              {comments.length}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.rightActions}>
          <Pressable 
            style={[
              styles.actionIconCircle, 
              isSaved && { backgroundColor: theme.primary + "20" }
            ]}
            onPress={handleSave}
          >
            <Feather 
              name="bookmark" 
              size={18} 
              color={isSaved ? theme.primary : theme.textSecondary} 
            />
          </Pressable>
          <Pressable
            style={styles.actionIconCircle}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={useI18n.getState().language === "bn" ? "শেয়ার" : "Share"}
          >
            <Feather name="upload" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      {likesCount > 0 ? (
        <Pressable 
          style={styles.likedBySection}
          onPress={() => navigation.navigate("LikesList", { postId: post.id, likesCount })}
        >
          <View style={styles.likedAvatarsRow}>
            {displayedLikedUsers.map((user, index) => (
              <View
                key={user.id}
                style={[
                  styles.likedAvatar,
                  { backgroundColor: user.color, marginLeft: index === 0 ? 0 : -10, zIndex: displayedLikedUsers.length - index },
                ]}
              >
                <ThemedText style={styles.likedAvatarText}>{user.initials}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText style={[styles.likedByText, { color: theme.textSecondary }]}>
            {likesCount} জন লাইক করেছেন
          </ThemedText>
          <Feather name="chevron-right" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      <View style={styles.commentsHeader}>
        <ThemedText type="h4" style={{ color: theme.text }}>
          Comments ({comments.length})
        </ThemedText>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingScreen style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        ref={flatListRef}
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        // An element, not the function: a new function each render made React remount the header
        // (and reload the photo) whenever the screen re-rendered, e.g. as the keyboard opened.
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        extraData={highlightId}
        onScrollToIndexFailed={(info) => {
          // Rows not measured yet: jump near it, then try again.
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => {
            try { flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.3 }); } catch {}
          }, 300);
        }}
      />
      {commentGone ? (
        <Pressable testID="comment-removed-note" onPress={() => setCommentGone(false)} style={{ position: "absolute", top: 10, alignSelf: "center", backgroundColor: theme.text, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 }}>
          <ThemedText style={{ color: theme.backgroundRoot, fontSize: 13, fontWeight: "600" }}>
            {isBn ? "এই মন্তব্যটি আর নেই" : "This comment was removed"}
          </ThemedText>
        </Pressable>
      ) : null}

      <Animated.View
        style={[
          styles.inputWrapper,
          {
            // Same colour as the page, so there is no strip behind the comment box.
            backgroundColor: theme.backgroundRoot,
          },
          composerPadding,
        ]}
      >
        {replyingTo ? (
          <View style={[styles.replyIndicator, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.replyIndicatorText, { color: theme.textSecondary }]}>
              Replying to <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>{replyingTo.authorName}</ThemedText>
            </ThemedText>
            <Pressable onPress={cancelReply}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.inputContainer}>
          <View style={[styles.commentInputWrapper, { backgroundColor: theme.surface }]}>
            <TextInput
              style={[styles.commentInput, { color: theme.text }]}
              placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
              placeholderTextColor={theme.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              onKeyPress={(e: any) => {
                  // web: Enter sends, Shift+Enter adds a new line
                  if (Platform.OS === "web" && e?.nativeEvent?.key === "Enter" && !e?.nativeEvent?.shiftKey) {
                    e.preventDefault?.();
                    handleSendComment();
                  }
                }}
              />
          </View>
          <Pressable
            style={[
              styles.sendButton,
              { backgroundColor: newComment.trim() ? theme.primary : theme.backgroundSecondary },
            ]}
            onPress={handleSendComment}
            disabled={!newComment.trim()}
            accessibilityRole="button"
            accessibilityLabel={isBn ? "মন্তব্য পাঠান" : "Send comment"}
            testID="comment-send"
          >
            <Feather name="send" size={18} color={newComment.trim() ? theme.buttonText : theme.textSecondary} />
          </Pressable>
        </View>
      </Animated.View>
      <PostActionsSheet
        visible={menuOpen}
        post={{ ...post, content: postText, isSaved, shared }}
        onClose={() => setMenuOpen(false)}
        onToggleSave={handleSave}
        onDeleted={() => navigation.goBack()}
        onEdited={(_id, content) => setPostText(content)}
        onAuthorHidden={() => navigation.goBack()}
      />
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  postContainer: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  authorPressable: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  authorInfo: {
    marginLeft: Spacing.md,
  },
  authorName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  postTime: {
    fontSize: 14,
    marginTop: 2,
  },
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  postPoll: { marginHorizontal: 0, marginTop: 0, marginBottom: Spacing.lg },
  postImage: {
    marginBottom: Spacing.lg,
  },
  postStats: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statText: {
    fontSize: 14,
  },
  postActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    justifyContent: "space-around",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  commentsHeader: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  commentContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  commentBubble: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    gap: Spacing.lg,
    paddingLeft: Spacing.md,
  },
  commentTime: {
    fontSize: 12,
  },
  commentLikeButton: {},
  commentLikeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  commentReplyButton: {},
  commentReplyText: {
    fontSize: 12,
    fontWeight: "500",
  },
  repliesContainer: {
    marginTop: Spacing.md,
  },
  replyItem: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  replyAvatarContainer: {
    alignItems: "center",
    width: 28,
  },
  replyThreadLine: {
    width: 2,
    height: 12,
    borderRadius: 1,
    marginBottom: 4,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  replyAvatarText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  replyContentWrapper: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  replyBubble: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  replyAuthor: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  replyTime: {
    fontSize: 11,
  },
  replyMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: Spacing.md,
    paddingLeft: Spacing.md,
  },
  replyLikeButton: {},
  replyLikeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  nestedReplies: {
    marginTop: Spacing.sm,
  },
  replyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  replyIndicatorText: {
    flex: 1,
    fontSize: 13,
  },
  inputWrapper: {
    borderTopWidth: 0,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  commentInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    maxHeight: 100,
  },
  commentInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    paddingVertical: Spacing.sm,
    maxHeight: 80,
    textAlignVertical: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  viewCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    marginRight: Spacing.sm,
  },
  viewCountText: {
    fontSize: 14,
  },
  moreButton: {
    padding: Spacing.xs,
  },
  postActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconActionCount: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  likedBySection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  likedAvatarsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  likedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  likedAvatarText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  likedByText: {
    fontSize: 13,
  },
});
