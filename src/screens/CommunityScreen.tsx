import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
  Share,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated from "react-native-reanimated";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { Card, Button, IconButton, SectionHeader, EmptyState, PostSkeleton } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, FontFamily, Palette } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCommunityStore, CommunityType } from "@/lib/communityStore";
import { getPostsByCommunity } from "@/lib/communityData";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import { tr, useTr } from "@/lib/tr";
import {
  FeedPost,
  createServerPost,
  fetchServerPosts,
  initialsOf,
  resolveServerCommunityId,
} from "@/lib/feedApi";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Post = FeedPost;

const toBnDigits = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

function greeting(bn: boolean) {
  const h = new Date().getHours();
  if (h < 12) return bn ? "শুভ সকাল" : "Good morning";
  if (h < 17) return bn ? "শুভ দুপুর" : "Good afternoon";
  return bn ? "শুভ সন্ধ্যা" : "Good evening";
}

export default function CommunityScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  // New-post toolbar: above the navigation bar, or right on top of the keyboard.
  const toolbarPadding = useKeyboardAwareBottomPadding(Spacing.md);
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeCommunity = useCommunityStore((state) => state.activeCommunity);
  const loadCommunities = useCommunityStore((state) => state.loadCommunities);
  const user = useAuthStore((s) => s.user);
  const getToken = useAuthStore((s) => s.getToken);
  const { language } = useI18n();
  const isBn = language === "bn";
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 640);
  const carouselCardWidth = contentWidth - Spacing.lg * 2;

  const communityType = (activeCommunity?.type || "agriculture") as CommunityType;

  const seedPosts = useCallback(
    (): Post[] =>
      getPostsByCommunity(communityType).map((p) => ({
        id: p.id,
        author: p.author,
        content: p.content,
        image: p.image,
        likes: p.likes,
        comments: p.comments,
        views: p.views,
        isLiked: p.isLiked,
        isSaved: false,
        createdAt: p.createdAt,
      })),
    [communityType],
  );

  const [localPosts, setLocalPosts] = useState<Post[]>(seedPosts);
  const [serverPosts, setServerPosts] = useState<Post[]>([]);
  const [serverCommunityId, setServerCommunityId] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [posting, setPosting] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  const loadFeed = useCallback(async () => {
    try {
      const id = serverCommunityId ?? (await resolveServerCommunityId(activeCommunity));
      if (!id) throw new Error("no community");
      setServerCommunityId(id);
      setServerPosts(await fetchServerPosts(id, isBn));
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [activeCommunity, serverCommunityId, isBn]);

  useEffect(() => {
    loadCommunities();
  }, []);

  useEffect(() => {
    setLocalPosts(seedPosts());
    setServerCommunityId(null);
  }, [seedPosts]);

  useEffect(() => {
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityType]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, [loadFeed]);

  const posts = [...serverPosts, ...localPosts];

  const updatePost = (postId: string, fn: (p: Post) => Post) => {
    setLocalPosts((prev) => prev.map((p) => (p.id === postId ? fn(p) : p)));
    setServerPosts((prev) => prev.map((p) => (p.id === postId ? fn(p) : p)));
  };

  const handleLike = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePost(postId, (p) => ({ ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }));
  };

  const handleSave = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePost(postId, (p) => ({ ...p, isSaved: !p.isSaved }));
  };

  const handleShare = async (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: `${post.author.name}: ${post.content}` });
    } catch {
      // user dismissed the share sheet
    }
  };

  const handlePostPress = (post: Post) => {
    navigation.navigate("PostDetail", { postId: post.id, post });
  };

  const handleAuthorPress = (author: Post["author"]) => {
    navigation.navigate("UserProfile", {
      user: {
        id: author.id ?? `user-${author.name.replace(/\s+/g, "-").toLowerCase()}`,
        name: author.name,
        initials: author.initials,
        role: "farmer",
        verified: false,
        followersCount: 0,
        followingCount: 0,
        location: "বাংলাদেশ",
        bio: "",
      },
    });
  };

  const handleCreatePost = async () => {
    const content = newPostContent.trim();
    if (!content && !selectedImage) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const name = user?.name || (isBn ? "আমি" : "Me");
    const draft: Post = {
      id: `local-${Date.now()}`,
      author: { id: user?.id, name, avatar: user?.avatar || "", initials: initialsOf(name) },
      content,
      image: selectedImage || undefined,
      likes: 0,
      comments: 0,
      views: 0,
      isLiked: false,
      isSaved: false,
      createdAt: isBn ? "এইমাত্র" : "Just now",
    };

    const token = getToken();
    setPosting(true);
    try {
      if (!token || !serverCommunityId) throw new Error("offline");
      await createServerPost(token, serverCommunityId, content, selectedImage ? [selectedImage] : []);
      await loadFeed();
    } catch {
      // No server or not signed in: keep the post on this device.
      setLocalPosts((prev) => [draft, ...prev]);
    } finally {
      setPosting(false);
      setNewPostContent("");
      setSelectedImage(null);
      setShowCreatePost(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      // A data URI travels to the server with the post, so other members see the photo.
      setSelectedImage(a.base64 ? `data:${a.mimeType || "image/jpeg"};base64,${a.base64}` : a.uri);
    }
  };

  const quickActions: {
    key: string;
    icon: keyof typeof Feather.glyphMap;
    label: string;
    color: string;
    soft: string;
    onPress: () => void;
  }[] = [
    { key: "calc", icon: "percent", label: isBn ? "হিসাব" : "Calculate", color: Palette.leaf, soft: Palette.leafSoft, onPress: () => navigation.navigate("Calculate") },
    { key: "tools", icon: "tool", label: isBn ? "টুলস" : "Tools", color: Palette.river, soft: Palette.riverSoft, onPress: () => navigation.navigate("Tools") },
    { key: "services", icon: "grid", label: isBn ? "সেবা" : "Services", color: Palette.plum, soft: Palette.plumSoft, onPress: () => navigation.navigate("Services") },
    { key: "weather", icon: "cloud-drizzle", label: isBn ? "আবহাওয়া" : "Weather", color: Palette.teal, soft: Palette.tealSoft, onPress: () => navigation.navigate("Weather") },
    { key: "prices", icon: "trending-up", label: isBn ? "বাজার দর" : "Prices", color: Palette.sun, soft: Palette.sunSoft, onPress: () => navigation.navigate("MarketPrices") },
    { key: "ai", icon: "cpu", label: isBn ? "এআই সহকারী" : "AI help", color: Palette.rose, soft: Palette.roseSoft, onPress: () => navigation.navigate("AIAssistant") },
    { key: "experts", icon: "award", label: isBn ? "বিশেষজ্ঞ" : "Experts", color: Palette.harvest, soft: Palette.harvestSoft, onPress: () => navigation.navigate("Experts") },
    { key: "disease", icon: "crosshair", label: isBn ? "রোগ শনাক্ত" : "Disease", color: Palette.clay, soft: Palette.claySoft, onPress: () => navigation.navigate("DiseaseDetector") },
  ];

  const featured: {
    key: string;
    icon: keyof typeof Feather.glyphMap;
    title: string;
    subtitle: string;
    colors: [string, string];
    onPress: () => void;
  }[] = [
    {
      key: "welfare",
      icon: "heart",
      title: isBn ? "কল্যাণ সমিতি" : "Welfare Association",
      subtitle: isBn ? "সদস্য হন, সুবিধা পান" : "Join and get member benefits",
      colors: ["#14583A", "#2FA36B"],
      onPress: () => navigation.navigate("WelfareAssociation"),
    },
    {
      key: "summit",
      icon: "globe",
      title: isBn ? "আন্তর্জাতিক মৎস্য সম্মেলন" : "International Fish Summit",
      subtitle: isBn ? "প্রদর্শনী, বক্তা ও নিবন্ধন" : "Expo, speakers and registration",
      colors: ["#1D4ED8", "#0D9488"],
      onPress: () => navigation.navigate("InternationalFishSummit"),
    },
    {
      key: "events",
      icon: "calendar",
      title: isBn ? "ইভেন্ট ক্যালেন্ডার" : "Events calendar",
      subtitle: isBn ? "কৃষি মেলা ও প্রশিক্ষণ" : "Fairs, trainings and meetups",
      colors: ["#B45309", "#E3A008"],
      onPress: () => navigation.navigate("EventsCalendar"),
    },
  ];

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (carouselCardWidth + Spacing.md));
    if (i !== slide) setSlide(i);
  };

  const firstName = (user?.name || "").split(" ")[0];

  const renderHeader = () => (
    <View>
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <ThemedText type="small" muted>
            {greeting(isBn)}
            {firstName ? "," : ""}
          </ThemedText>
          <ThemedText type="h2" numberOfLines={1}>
            {firstName || (isBn ? "কৃষক বন্ধু" : "Farmer friend")}
          </ThemedText>
        </View>
        <IconButton icon="search" accessibilityLabel={isBn ? "খুঁজুন" : "Search"} onPress={() => navigation.navigate("UserSearch")} />
        <IconButton
          icon="bell"
          accessibilityLabel={isBn ? "নোটিফিকেশন" : "Notifications"}
          onPress={() => navigation.navigate("Notifications")}
          style={{ marginLeft: Spacing.sm }}
        />
      </View>

      {/* Featured carousel */}
      <ScrollView
        ref={carouselRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={carouselCardWidth + Spacing.md}
        decelerationRate="fast"
        onScroll={onCarouselScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.md }}
      >
        {featured.map((f) => (
          <Pressable
            key={f.key}
            onPress={f.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [{ width: carouselCardWidth, opacity: pressed ? 0.92 : 1 }]}
          >
            <LinearGradient colors={f.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureCard}>
              <View style={styles.featureDecor} />
              <View style={styles.featureIcon}>
                <Feather name={f.icon} size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <ThemedText type="h3" style={styles.featureTitle} numberOfLines={1}>
                  {f.title}
                </ThemedText>
                <ThemedText type="small" style={styles.featureSubtitle} numberOfLines={1}>
                  {f.subtitle}
                </ThemedText>
              </View>
              <View style={styles.featureCta}>
                <ThemedText style={styles.featureCtaText}>{isBn ? "দেখুন" : "Open"}</ThemedText>
                <Feather name="arrow-right" size={14} color="#0F1A14" />
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {featured.map((f, i) => (
          <View
            key={f.key}
            style={[
              styles.dot,
              { backgroundColor: i === slide ? theme.primary : theme.backgroundTertiary, width: i === slide ? 18 : 6 },
            ]}
          />
        ))}
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <SectionHeader
          title={isBn ? "দ্রুত সেবা" : "Quick actions"}
          actionLabel={isBn ? "সব টুলস" : "All tools"}
          onAction={() => navigation.navigate("Tools")}
        />
        <Card padded={false} style={styles.quickGrid}>
          {quickActions.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                a.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => [styles.quickItem, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[styles.quickIcon, { backgroundColor: isDark ? a.color + "26" : a.soft }]}>
                <Feather name={a.icon} size={20} color={a.color} />
              </View>
              <ThemedText type="caption" style={styles.quickLabel} numberOfLines={1}>
                {a.label}
              </ThemedText>
            </Pressable>
          ))}
        </Card>
      </View>

      {/* Composer */}
      <View style={styles.section}>
        <Card onPress={() => setShowCreatePost(true)} style={styles.composer}>
          <UserAvatar name={user?.name || "?"} size={40} />
          <ThemedText muted style={{ flex: 1 }}>
            {isBn ? "আপনার খামারের খবর শেয়ার করুন..." : "Share news from your farm..."}
          </ThemedText>
          <View style={[styles.composerIcon, { backgroundColor: theme.primarySoft }]}>
            <Feather name="image" size={18} color={theme.primary} />
          </View>
        </Card>
      </View>

      <View style={[styles.section, { marginBottom: 0 }]}>
        <SectionHeader
          title={isBn ? "কমিউনিটি ফিড" : "Community feed"}
          subtitle={
            online === false
              ? isBn
                ? "অফলাইন - শুধু এই ফোনের পোস্ট দেখানো হচ্ছে"
                : "Offline - showing posts on this device"
              : (isBn ? activeCommunity?.nameBn : activeCommunity?.nameEn) ?? undefined
          }
        />
      </View>
      {loading ? (
        <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.md }}>
          <PostSkeleton />
        </View>
      ) : null}
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <Card padded={false} onPress={() => handlePostPress(item)} style={styles.postCard}>
      <View style={styles.postHeader}>
        <Pressable onPress={() => handleAuthorPress(item.author)} style={styles.authorInfo} accessibilityRole="button">
          <UserAvatar
            name={item.author.name}
            avatarId={item.author.avatarId}
            avatarColor={item.author.avatarColor}
            size={42}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.authorName} numberOfLines={1}>
                {item.author.name}
              </ThemedText>
              {item.author.isWelfareMember ? (
                <Feather name="check-circle" size={14} color={theme.primary} />
              ) : null}
            </View>
            <View style={styles.metaRow}>
              <ThemedText type="caption" muted>
                {item.createdAt}
              </ThemedText>
              {item.shared === false || item.id.startsWith("local-") ? (
                <>
                  <View style={[styles.metaDot, { backgroundColor: theme.textTertiary }]} />
                  <ThemedText type="caption" muted>
                    {isBn ? "শুধু এই ফোনে" : "Only on this device"}
                  </ThemedText>
                </>
              ) : null}
            </View>
          </View>
        </Pressable>
        <IconButton icon="more-horizontal" tone="plain" size={34} accessibilityLabel={tr("More")} />
      </View>

      {item.content ? (
        <ThemedText style={styles.postContent} numberOfLines={6}>
          {item.content}
        </ThemedText>
      ) : null}

      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.postImage} contentFit="cover" transition={200} />
      ) : null}

      {item.likes > 0 || item.comments > 0 ? (
        <View style={styles.statsRow}>
          <View style={styles.statsLeft}>
            <View style={[styles.likeBubble, { backgroundColor: theme.error }]}>
              <Feather name="heart" size={9} color="#FFFFFF" />
            </View>
            <ThemedText type="caption" muted>
              {isBn ? toBnDigits(item.likes) : item.likes}
            </ThemedText>
          </View>
          <ThemedText type="caption" muted>
            {isBn ? `${toBnDigits(item.comments)} মন্তব্য` : `${item.comments} comments`}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.actionsRow, { borderTopColor: theme.divider }]}>
        <PostAction
          icon="heart"
          label={isBn ? "পছন্দ" : "Like"}
          active={item.isLiked}
          activeColor={theme.error}
          onPress={() => handleLike(item.id)}
        />
        <PostAction icon="message-circle" label={isBn ? "মন্তব্য" : "Comment"} onPress={() => handlePostPress(item)} />
        <PostAction icon="share-2" label={isBn ? "শেয়ার" : "Share"} onPress={() => handleShare(item)} />
        <PostAction
          icon="bookmark"
          label={isBn ? "সেভ" : "Save"}
          active={item.isSaved}
          activeColor={theme.primary}
          onPress={() => handleSave(item.id)}
        />
      </View>
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        data={loading ? [] : posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="feather"
              title={isBn ? "এখনও কোনো পোস্ট নেই" : "No posts yet"}
              message={isBn ? "প্রথম পোস্টটি আপনিই করুন" : "Be the first to share something"}
              actionLabel={isBn ? "পোস্ট করুন" : "Create post"}
              onAction={() => setShowCreatePost(true)}
            />
          )
        }
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.md,
          paddingBottom: tabBarHeight + Spacing["3xl"],
          width: "100%",
          maxWidth: 640,
          alignSelf: "center",
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={showCreatePost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreatePost(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
          behavior="padding"
        >
          <View style={[styles.modalHeader, { borderBottomColor: theme.divider, paddingTop: Platform.OS === "android" ? insets.top + Spacing.md : Spacing.lg }]}>
            <Pressable onPress={() => setShowCreatePost(false)} hitSlop={10} accessibilityRole="button">
              <ThemedText muted>{isBn ? "বাতিল" : "Cancel"}</ThemedText>
            </Pressable>
            <ThemedText type="h4">{isBn ? "নতুন পোস্ট" : "New post"}</ThemedText>
            <Button
              title={isBn ? "পোস্ট" : "Post"}
              size="sm"
              loading={posting}
              disabled={!newPostContent.trim() && !selectedImage}
              onPress={handleCreatePost}
            />
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.lg }} keyboardShouldPersistTaps="handled">
            <View style={styles.composerAuthor}>
              <UserAvatar name={user?.name || "?"} size={44} />
              <View>
                <ThemedText style={styles.authorName}>{user?.name || (isBn ? "আপনি" : "You")}</ThemedText>
                <ThemedText type="caption" muted>
                  {(isBn ? activeCommunity?.nameBn : activeCommunity?.nameEn) || (isBn ? "কৃষক কমিউনিটি" : "Farmers community")}
                </ThemedText>
              </View>
            </View>
            <TextInput
              style={[styles.postInput, { color: theme.text, fontFamily: isBn ? "HindSiliguri_400Regular" : FontFamily.regular }]}
              placeholder={isBn ? "আজ খামারে কী হলো?" : "What happened on the farm today?"}
              placeholderTextColor={theme.textTertiary}
              multiline
              value={newPostContent}
              onChangeText={setNewPostContent}
              autoFocus
            />
            {selectedImage ? (
              <View style={styles.selectedImageWrap}>
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} contentFit="cover" />
                <Pressable style={styles.removeImage} onPress={() => setSelectedImage(null)} accessibilityLabel={tr("Remove image")}>
                  <Feather name="x" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
          <Animated.View style={[styles.modalToolbar, { borderTopColor: theme.divider }, toolbarPadding]}>
            <Button title={isBn ? "ছবি যোগ করুন" : "Add photo"} icon="image" variant="secondary" size="sm" onPress={pickImage} />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function PostAction({
  icon,
  label,
  active,
  activeColor,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const color = active && activeColor ? activeColor : theme.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.actionBtn, { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" }]}
    >
      <Feather name={icon} size={18} color={color} />
      <ThemedText style={[styles.actionLabel, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  featureCard: {
    height: 156,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: "hidden",
  },
  featureDecor: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { color: "#FFFFFF" },
  featureSubtitle: { color: "rgba(255,255,255,0.85)" },
  featureCta: {
    position: "absolute",
    right: Spacing.lg,
    top: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featureCtaText: { color: "#0F1A14", fontSize: 12, lineHeight: 16, fontFamily: FontFamily.bold },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.md,
  },
  dot: { height: 6, borderRadius: 3 },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing["2xl"],
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: Spacing.sm,
  },
  quickItem: {
    width: "25%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { textAlign: "center", paddingHorizontal: 2 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  composerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  postCard: {
    marginHorizontal: Spacing.lg,
    overflow: "hidden",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  authorInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorName: { fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  postContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    fontSize: 15,
    lineHeight: 23,
  },
  postImage: {
    marginTop: Spacing.md,
    width: "100%",
    aspectRatio: 4 / 3,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statsLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionLabel: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  composerAuthor: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.lg },
  postInput: { fontSize: 17, lineHeight: 26, minHeight: 140, textAlignVertical: "top" },
  selectedImageWrap: { marginTop: Spacing.lg, borderRadius: BorderRadius.md, overflow: "hidden" },
  selectedImage: { width: "100%", aspectRatio: 4 / 3 },
  removeImage: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalToolbar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
