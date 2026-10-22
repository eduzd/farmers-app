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
  Alert,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated from "react-native-reanimated";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import HelpButton from "@/components/HelpButton";
import { Card, Button, IconButton, SectionHeader, EmptyState, PostSkeleton } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, FontFamily, Palette, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCommunityStore, CommunityType } from "@/lib/communityStore";
import { badgeKeyFor } from "@/constants/profileBadges";
import { useAuthStore } from "@/lib/authStore";
import { PostActionsSheet } from "@/components/PostActionsSheet";
import { PostPhoto } from "@/components/PhotoViewer";
import { CountBadge } from "@/components/CountBadge";
import { useUnreadCounts } from "@/lib/liveStatus";
import { useI18n } from "@/lib/i18n";
import { tr, useTr } from "@/lib/tr";
import {
  FeedPost,
  createServerPost,
  fetchServerPosts,
  setServerPostSaved,
  likeServerPost,
  initialsOf,
  resolveServerCommunityId,
} from "@/lib/feedApi";

import { AppIcon } from "@/components/icons/AppIcon";
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
  const unreadNotifications = useUnreadCounts((s) => s.notifications);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 640);
  // Featured cards: the original full-width card shape (one card fills the row), still
  // moving to the next card by itself (auto-play below).
  const carouselCardWidth = contentWidth - Spacing.lg * 2;
  const carouselSidePad = Spacing.lg;
  const carouselStep = carouselCardWidth + Spacing.md;
  const isFocused = useIsFocused();
  const myBadge = badgeKeyFor(user);

  const communityType = (activeCommunity?.type || "agriculture") as CommunityType;

  // Only posts made on this phone while the server could not be reached. No demo posts.
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
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
  const slideRef = useRef(0);
  const lastCarouselTouch = useRef(0);
  // Hairline under the pinned header once the page has scrolled under it.
  const [headerRaised, setHeaderRaised] = useState(false);
  // Quick actions: one row of four, the rest behind the expand button.
  const [quickExpanded, setQuickExpanded] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const id = serverCommunityId ?? (await resolveServerCommunityId(activeCommunity));
      if (!id) throw new Error("no community");
      setServerCommunityId(id);
      setServerPosts(await fetchServerPosts(id, isBn, getToken()));
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [activeCommunity, serverCommunityId, isBn, getToken]);

  useEffect(() => {
    loadCommunities();
  }, []);

  useEffect(() => {
    setLocalPosts([]);
    setServerCommunityId(null);
  }, [communityType]);

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

  const handleLike = async (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const liked = !post.isLiked;
    updatePost(postId, (p) => ({ ...p, isLiked: liked, likes: Math.max(0, p.likes + (liked ? 1 : -1)) }));
    if (!post.shared) return;
    const token = getToken();
    try {
      if (!token) throw new Error("signed out");
      const out = await likeServerPost(token, postId, liked);
      updatePost(postId, (p) => ({ ...p, isLiked: out.liked, likes: out.likes }));
    } catch {
      // Undo: the like didn't reach the server.
      updatePost(postId, (p) => ({ ...p, isLiked: post.isLiked, likes: post.likes }));
      Alert.alert(
        isBn ? "লাইক হয়নি" : "Couldn't like",
        token
          ? isBn ? "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।" : "Check your internet and try again."
          : isBn ? "লাইক করতে সাইন ইন করুন।" : "Sign in to like posts.",
      );
    }
  };

  // Saving a shared post is stored on the server, so it shows under Saved posts on the profile.
  const handleSave = async (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const next = !post.isSaved;
    updatePost(postId, (p) => ({ ...p, isSaved: next }));
    if (!post.shared) return; // only on this phone, nothing on the server to save
    const token = getToken();
    try {
      if (!token) throw new Error(isBn ? "সেভ করতে আগে সাইন ইন করুন।" : "Sign in to save posts.");
      await setServerPostSaved(token, postId, next);
    } catch (e) {
      updatePost(postId, (p) => ({ ...p, isSaved: !next }));
      Alert.alert(isBn ? "সেভ হয়নি" : "Couldn't save", e instanceof Error ? e.message : "");
    }
  };

  // Three-dot menu on a post.
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const removePost = (postId: string) => {
    setLocalPosts((prev) => prev.filter((p) => p.id !== postId));
    setServerPosts((prev) => prev.filter((p) => p.id !== postId));
  };
  const hideAuthor = (authorId: string) => {
    setServerPosts((prev) => prev.filter((p) => p.author.id !== authorId));
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

  // Ask first: post the whole photo as it is, or crop it (the phone's own crop screen).
  const pickImage = () => {
    Alert.alert(
      isBn ? "ছবি যোগ করুন" : "Add photo",
      isBn ? "পুরো ছবিটা দেবেন, নাকি কেটে ছোট করবেন?" : "Post the whole photo, or crop it first?",
      [
        { text: isBn ? "বাতিল" : "Cancel", style: "cancel" },
        { text: isBn ? "কাটুন" : "Crop", onPress: () => launchPicker(true) },
        { text: isBn ? "পুরো ছবি" : "Full photo", onPress: () => launchPicker(false) },
      ],
    );
  };

  const launchPicker = async (crop: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // Full photo: no crop screen, the picture keeps its own shape. Crop: free-form crop box.
      allowsEditing: crop,
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
    const i = Math.max(0, Math.min(featured.length - 1, Math.round(e.nativeEvent.contentOffset.x / carouselStep)));
    slideRef.current = i;
    if (i !== slide) setSlide(i);
  };

  const onCarouselTouch = () => {
    lastCarouselTouch.current = Date.now();
  };

  // Auto-play: next card every 4 seconds, looping back to the first. Waits a few seconds
  // after the user swipes, and stops while the Home tab isn't on screen.
  const featuredCount = featured.length;
  useEffect(() => {
    if (!isFocused || featuredCount < 2) return;
    const timer = setInterval(() => {
      if (Date.now() - lastCarouselTouch.current < 5000) return;
      const next = (slideRef.current + 1) % featuredCount;
      slideRef.current = next;
      setSlide(next);
      carouselRef.current?.scrollTo({ x: next * carouselStep, animated: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [isFocused, featuredCount, carouselStep]);

  const onListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raised = e.nativeEvent.contentOffset.y > 4;
    if (raised !== headerRaised) setHeaderRaised(raised);
  };

  // Pinned header: the greeting, search and notifications stay at the top while the page scrolls.
  const renderPinnedHeader = () => (
    <View
      style={[
        styles.pinnedHeader,
        {
          paddingTop: insets.top + Spacing.md,
          backgroundColor: theme.backgroundRoot,
          borderBottomColor: headerRaised ? theme.divider : "transparent",
        },
      ]}
    >
      <View style={styles.pinnedHeaderInner}>
          <View style={styles.greetingRow}>
            {/* The signed-in person's avatar (photo, or their initial) in place of their name. */}
            <Pressable
              testID="home-header-avatar"
              onPress={() => (navigation as any).navigate("Profile")}
              accessibilityRole="button"
              accessibilityLabel={isBn ? "আমার প্রোফাইল" : "My profile"}
              hitSlop={6}
            >
              <UserAvatar
                name={user?.name || (isBn ? "অতিথি" : "Guest")}
                avatar={user?.avatar}
                avatarId={user?.avatarId}
                avatarColor={user?.avatarColor}
                badge={myBadge}
                size={44}
              />
            </Pressable>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="small" muted numberOfLines={1}>
                {greeting(isBn)}
              </ThemedText>
              <ThemedText type="h4" numberOfLines={1}>
                {isBn ? "কৃষক বন্ধু" : "Farmers"}
              </ThemedText>
            </View>
            <IconButton icon="search" accessibilityLabel={isBn ? "খুঁজুন" : "Search"} onPress={() => navigation.navigate("UserSearch")} />
            <View style={{ marginLeft: Spacing.sm }}>
              <HelpButton />
            </View>
            <View style={{ marginLeft: Spacing.sm }}>
              <IconButton
                icon="bell"
                accessibilityLabel={
                  unreadNotifications > 0
                    ? isBn ? `নোটিফিকেশন, ${unreadNotifications}টি নতুন` : `Notifications, ${unreadNotifications} unread`
                    : isBn ? "নোটিফিকেশন" : "Notifications"
                }
                onPress={() => navigation.navigate("Notifications")}
              />
              <CountBadge count={unreadNotifications} style={{ top: -4, right: -6 }} testID="bell-badge" />
            </View>
          </View>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View>
      {/* Featured carousel */}
      <ScrollView
        ref={carouselRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={carouselStep}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onCarouselScroll}
        onScrollBeginDrag={onCarouselTouch}
        onScrollEndDrag={onCarouselTouch}
        onTouchStart={onCarouselTouch}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingHorizontal: carouselSidePad, gap: Spacing.md }}
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
                <AppIcon name={f.icon} size={22} color="#FFFFFF" />
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
          {(quickExpanded ? quickActions : quickActions.slice(0, 4)).map((a) => (
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
                <AppIcon name={a.icon} size={20} color={a.color} />
              </View>
              <ThemedText type="caption" style={styles.quickLabel} numberOfLines={1}>
                {a.label}
              </ThemedText>
            </Pressable>
          ))}
          {quickActions.length > 4 ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setQuickExpanded((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                quickExpanded ? (isBn ? "কম দেখান" : "Show fewer tools") : isBn ? "আরও টুলস দেখান" : "Show more tools"
              }
              hitSlop={6}
              style={({ pressed }) => [styles.quickToggle, { borderTopColor: theme.divider, opacity: pressed ? 0.6 : 1 }]}
            >
              <ThemedText type="caption" style={{ color: theme.primary, fontFamily: FontFamily.semibold }}>
                {quickExpanded ? (isBn ? "কম দেখান" : "Show less") : isBn ? "আরও টুলস" : "More tools"}
              </ThemedText>
              <AppIcon name={quickExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.primary} />
            </Pressable>
          ) : null}
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
            avatar={item.author.avatar || undefined}
            avatarId={item.author.avatarId}
            avatarColor={item.author.avatarColor}
            badge={item.author.badge}
            size={42}
            userId={item.author.id || undefined}
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
        <IconButton icon="more-horizontal" tone="plain" size={34} accessibilityLabel={tr("More")} onPress={() => setMenuPost(item)} />
      </View>

      {item.content ? (
        <ThemedText style={styles.postContent} numberOfLines={6}>
          {item.content}
        </ThemedText>
      ) : null}

      {item.image ? (
        <PostPhoto uri={item.image} style={styles.postImage} mode="thumb" />
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
        {/* Same share button as the post details page: round icon button, no label. */}
        <View style={styles.shareCell}>
          <Pressable
            onPress={() => handleShare(item)}
            accessibilityRole="button"
            accessibilityLabel={isBn ? "শেয়ার" : "Share"}
            hitSlop={4}
            style={({ pressed }) => [styles.shareCircle, { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" }]}
          >
            <Feather name="upload" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
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
      {renderPinnedHeader()}
      <FlatList
        style={{ flex: 1 }}
        data={loading ? [] : posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader()}
        onScroll={onListScroll}
        scrollEventThrottle={32}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="feather"
              title={
                online === false
                  ? isBn ? "সার্ভারে পৌঁছানো যাচ্ছে না" : "Can't reach the server"
                  : isBn ? "এখনও কোনো পোস্ট নেই" : "No posts yet"
              }
              message={
                online === false
                  ? isBn ? "নিচে টেনে আবার চেষ্টা করুন" : "Pull down to try again"
                  : isBn ? "প্রথম পোস্টটি আপনিই করুন" : "Be the first to share something"
              }
              actionLabel={isBn ? "পোস্ট করুন" : "Create post"}
              onAction={() => setShowCreatePost(true)}
            />
          )
        }
        contentContainerStyle={{
          paddingTop: Spacing.sm,
          paddingBottom: tabBarHeight + Spacing["3xl"] + 56,
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

      {/* Floating button: create a post */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowCreatePost(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={isBn ? "পোস্ট করুন" : "Create post"}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.primary,
            bottom: tabBarHeight + Spacing.lg,
            right: Math.max(Spacing.lg, (width - 640) / 2 + Spacing.lg),
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        {/* Plus = make something new (a post). The pencil is kept for editing, e.g. Edit profile. */}
        <Feather name="plus" size={26} color="#FFFFFF" />
      </Pressable>

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
              <UserAvatar name={user?.name || "?"} avatar={user?.avatar} badge={myBadge} size={44} />
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
      <PostActionsSheet
        visible={!!menuPost}
        post={menuPost}
        onClose={() => setMenuPost(null)}
        onToggleSave={() => menuPost && handleSave(menuPost.id)}
        onDeleted={removePost}
        onEdited={(id, content) => updatePost(id, (p) => ({ ...p, content }))}
        onAuthorHidden={hideAuthor}
      />
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
      <AppIcon name={icon} size={18} color={color} />
      <ThemedText style={[styles.actionLabel, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pinnedHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  pinnedHeaderInner: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.large,
  },
  quickToggle: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  shareCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Matches PostDetailScreen's actionIconCircle (44x44 round, "upload" icon, 18px).
  shareCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
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
