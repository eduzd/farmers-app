import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useI18n } from "@/lib/i18n";
import { fetchTrending, type TrendingData } from "@/lib/liveDataApi";
import type { FeedPost } from "@/lib/feedApi";

import { EmptyState } from "@/components/ui";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TrendingHashtag = TrendingData["hashtags"][number];
type TrendingTopic = TrendingData["topics"][number];
type TrendingPost = FeedPost;

const HASHTAG = /#[\p{L}\p{N}_]{2,40}/gu;

export default function TrendingScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { language } = useI18n();
  const bn = language === "bn";
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"hashtags" | "topics" | "posts">("hashtags");
  const [data, setData] = useState<TrendingData | null>(null);
  const [failed, setFailed] = useState(false);

  // What people actually posted and reacted to in the last 7 days.
  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await fetchTrending(bn, 7));
    } catch {
      setFailed(true);
    }
  }, [bn]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleOpenPost = (item: TrendingPost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PostDetail", { postId: item.id, post: item } as any);
  };

  const empty = failed ? (
    <EmptyState
      icon="wifi-off"
      title={bn ? "লোড করা যায়নি" : "Couldn't load"}
      message={bn ? "টেনে আবার চেষ্টা করুন।" : "Pull down to try again."}
    />
  ) : data ? (
    <EmptyState
      icon="inbox"
      title={bn ? "এখনও কিছু নেই" : "Nothing yet"}
      message={bn ? "গত ৭ দিনে কমিউনিটিতে যা জনপ্রিয় হবে, এখানে দেখা যাবে।" : "What's popular in the community over the last 7 days will show here."}
    />
  ) : null;

  const renderHashtag = ({ item, index }: { item: TrendingHashtag; index: number }) => (
    <Animated.View entering={FadeInRight.delay(index * 50)}>
      <Pressable
        style={[styles.hashtagCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <View style={styles.hashtagRank}>
          <ThemedText style={[styles.rankNumber, { color: index < 3 ? theme.primary : theme.textSecondary }]}>
            {index + 1}
          </ThemedText>
        </View>
        <View style={styles.hashtagInfo}>
          <ThemedText style={[styles.hashtagText, { color: theme.primary }]}>{item.tag}</ThemedText>
          <ThemedText style={[styles.hashtagMeta, { color: theme.textSecondary }]}>
            {item.postsCount.toLocaleString()} {bn ? "পোস্ট" : item.postsCount === 1 ? "post" : "posts"}
          </ThemedText>
        </View>
        {item.growth === null ? (
          <View style={[styles.growthBadge, { backgroundColor: "#2FA36B15" }]}>
            <ThemedText style={[styles.growthText, { color: "#2FA36B" }]}>{bn ? "নতুন" : "New"}</ThemedText>
          </View>
        ) : item.growth > 0 ? (
          <View style={[styles.growthBadge, { backgroundColor: "#2FA36B15" }]}>
            <Feather name="trending-up" size={12} color="#2FA36B" />
            <ThemedText style={[styles.growthText, { color: "#2FA36B" }]}>+{item.growth}%</ThemedText>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );

  const renderTopic = ({ item, index }: { item: TrendingTopic; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[styles.topicCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <View style={[styles.topicIcon, { backgroundColor: theme.primary + "15" }]}>
          <AppIcon name="layers" size={24} color={theme.primary} />
        </View>
        <View style={styles.topicInfo}>
          <ThemedText style={[styles.topicTitle, { color: theme.text }]}>{bn ? item.nameBn : item.nameEn}</ThemedText>
          <ThemedText style={[styles.topicPosts, { color: theme.primary }]}>
            {bn ? `গত ৭ দিনে ${item.postsCount} পোস্ট` : `${item.postsCount} ${item.postsCount === 1 ? "post" : "posts"} in the last 7 days`}
          </ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderPost = ({ item, index }: { item: TrendingPost; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleOpenPost(item)}
      >
        <View style={styles.postHeader}>
          {item.author.avatar ? <Image source={{ uri: item.author.avatar }} style={styles.postAvatar} /> : null}
          <ThemedText style={[styles.postAuthor, { color: theme.text }]}>{item.author.name}</ThemedText>
          <Feather name="trending-up" size={16} color={theme.primary} />
        </View>
        <ThemedText style={[styles.postContent, { color: theme.text }]} numberOfLines={3}>
          {item.content}
        </ThemedText>
        {item.image ? <Image source={{ uri: item.image }} style={styles.postImage} contentFit="cover" /> : null}
        <View style={styles.postTags}>
          {Array.from(new Set((item.content.match(HASHTAG) || []).map((t) => t.toLowerCase()))).slice(0, 3).map(tag => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.tagChipText, { color: theme.primary }]}>{tag}</ThemedText>
            </View>
          ))}
        </View>
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Feather name="heart" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>{item.likes}</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ChatIcon size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>{item.comments}</ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>{bn ? "ট্রেন্ডিং" : "Trending"}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {bn ? "গত ৭ দিনে কমিউনিটিতে যা জনপ্রিয়" : "Popular in the community over the last 7 days"}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50)} style={styles.tabsContainer}>
        {[
          { id: "hashtags", label: bn ? "হ্যাশট্যাগ" : "Hashtags", icon: "hash" as const },
          { id: "topics", label: bn ? "কমিউনিটি" : "Communities", icon: "layers" as const },
          { id: "posts", label: bn ? "পোস্ট" : "Posts", icon: "file-text" as const },
        ].map(tab => (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              { backgroundColor: activeTab === tab.id ? theme.primary : theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.id as any);
            }}
          >
            <AppIcon name={tab.icon} size={14} color={activeTab === tab.id ? "#fff" : theme.text} />
            <ThemedText style={[styles.tabText, { color: activeTab === tab.id ? "#fff" : theme.text }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.View>

      {activeTab === "hashtags" ? (
        <FlatList
          data={data?.hashtags || []}
          ListEmptyComponent={empty}
          keyExtractor={item => item.tag}
          renderItem={renderHashtag}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      ) : activeTab === "topics" ? (
        <FlatList
          data={data?.topics || []}
          ListEmptyComponent={empty}
          keyExtractor={item => item.id}
          renderItem={renderTopic}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      ) : (
        <FlatList
          data={data?.posts || []}
          ListEmptyComponent={empty}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  tabsContainer: { flexDirection: "row", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
 },
  tabText: { fontSize: 12, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg },
  hashtagCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  hashtagRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" },
  rankNumber: { fontSize: 14, fontWeight: "700" },
  hashtagInfo: { flex: 1, marginLeft: Spacing.md },
  hashtagText: { fontSize: 16, fontWeight: "600" },
  hashtagMeta: { fontSize: 12, marginTop: 2 },
  growthBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4 },
  growthText: { fontSize: 12, fontWeight: "600" },
  topicCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  topicIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  topicInfo: { flex: 1, marginLeft: Spacing.md },
  topicTitle: { fontSize: 15, fontWeight: "600" },
  topicDescription: { fontSize: 12, marginTop: 2 },
  topicPosts: { fontSize: 12, fontWeight: "500", marginTop: 4 },
  postCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  postAvatar: { width: 36, height: 36, borderRadius: 18 },
  postAuthor: { flex: 1, fontSize: 14, fontWeight: "600", marginLeft: Spacing.sm },
  postContent: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.sm },
  postImage: { width: "100%", height: 150, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  postTags: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  tagChip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  tagChipText: { fontSize: 12 },
  postStats: { flexDirection: "row", gap: Spacing.lg },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12 },
});
