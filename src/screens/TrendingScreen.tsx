import React, { useState } from "react";
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface TrendingHashtag {
  id: string;
  tag: string;
  postsCount: number;
  growth: number;
  category: string;
}

interface TrendingPost {
  id: string;
  author: { name: string; avatar: string };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  hashtags: string[];
}

interface TrendingTopic {
  id: string;
  title: string;
  description: string;
  postsCount: number;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

const TRENDING_HASHTAGS: TrendingHashtag[] = [
  { id: "1", tag: "#ধানচাষ", postsCount: 1234, growth: 45, category: "ফসল" },
  { id: "2", tag: "#জৈবসার", postsCount: 987, growth: 32, category: "সার" },
  { id: "3", tag: "#মাছচাষ", postsCount: 876, growth: 28, category: "মাছ" },
  { id: "4", tag: "#বর্ষাকালীন_চাষ", postsCount: 654, growth: 56, category: "মৌসুম" },
  { id: "5", tag: "#গরুর_খামার", postsCount: 543, growth: 18, category: "পশু" },
  { id: "6", tag: "#সবজি_বাগান", postsCount: 432, growth: 24, category: "সবজি" },
  { id: "7", tag: "#কীটনাশক", postsCount: 321, growth: 12, category: "সার" },
  { id: "8", tag: "#সেচ_ব্যবস্থা", postsCount: 234, growth: 38, category: "যন্ত্র" },
];

const TRENDING_TOPICS: TrendingTopic[] = [
  { id: "1", title: "বর্ষা মৌসুমের চাষাবাদ", description: "বর্ষায় কী কী ফসল চাষ করবেন", postsCount: 456, icon: "cloud-rain", color: "#2563EB" },
  { id: "2", title: "জৈব কৃষি পদ্ধতি", description: "রাসায়নিক মুক্ত চাষের কৌশল", postsCount: 389, icon: "feather", color: "#2FA36B" },
  { id: "3", title: "মাছের রোগ প্রতিরোধ", description: "মাছ চাষে সাধারণ রোগ ও প্রতিকার", postsCount: 278, icon: "shield", color: "#EA8A0C" },
  { id: "4", title: "স্মার্ট ফার্মিং", description: "প্রযুক্তি ব্যবহার করে চাষাবাদ", postsCount: 234, icon: "cpu", color: "#7C3AED" },
];

const TRENDING_POSTS: TrendingPost[] = [
  {
    id: "1",
    author: { name: "করিম সাহেব", avatar: "https://randomuser.me/api/portraits/men/32.jpg" },
    content: "এবার আমার জমিতে নতুন জাতের ধান চাষ করেছি। ফলন অনেক ভালো হয়েছে! #ধানচাষ #নতুন_জাত",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600",
    likes: 234,
    comments: 45,
    hashtags: ["#ধানচাষ", "#নতুন_জাত"],
  },
  {
    id: "2",
    author: { name: "ফাতেমা বেগম", avatar: "https://randomuser.me/api/portraits/women/28.jpg" },
    content: "জৈব সার তৈরির সহজ পদ্ধতি শেয়ার করছি। বাড়িতেই তৈরি করা যায়! #জৈবসার #টিপস",
    likes: 189,
    comments: 67,
    hashtags: ["#জৈবসার", "#টিপস"],
  },
  {
    id: "3",
    author: { name: "রহিম উদ্দিন", avatar: "https://randomuser.me/api/portraits/men/45.jpg" },
    content: "আমার পুকুরে তেলাপিয়া মাছের চাষ শুরু করেছি। ৩ মাসে ভালো ফলন পাচ্ছি। #মাছচাষ",
    image: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=600",
    likes: 156,
    comments: 34,
    hashtags: ["#মাছচাষ"],
  },
];

export default function TrendingScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"hashtags" | "topics" | "posts">("hashtags");

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleOpenPost = (item: TrendingPost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const post = {
      id: item.id,
      author: { name: item.author.name, avatar: item.author.avatar, initials: item.author.name.substring(0, 2) },
      content: item.content,
      image: item.image,
      likes: item.likes,
      comments: item.comments,
      views: Math.floor(Math.random() * 1000),
      isLiked: false,
      createdAt: "সম্প্রতি",
    };
    navigation.navigate("PostDetail", { postId: item.id, post });
  };

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
            {item.postsCount.toLocaleString()} পোস্ট • {item.category}
          </ThemedText>
        </View>
        <View style={[styles.growthBadge, { backgroundColor: "#2FA36B15" }]}>
          <Feather name="trending-up" size={12} color="#2FA36B" />
          <ThemedText style={[styles.growthText, { color: "#2FA36B" }]}>+{item.growth}%</ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderTopic = ({ item, index }: { item: TrendingTopic; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[styles.topicCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <View style={[styles.topicIcon, { backgroundColor: item.color + "15" }]}>
          <Feather name={item.icon} size={24} color={item.color} />
        </View>
        <View style={styles.topicInfo}>
          <ThemedText style={[styles.topicTitle, { color: theme.text }]}>{item.title}</ThemedText>
          <ThemedText style={[styles.topicDescription, { color: theme.textSecondary }]}>{item.description}</ThemedText>
          <ThemedText style={[styles.topicPosts, { color: theme.primary }]}>
            {item.postsCount} পোস্ট
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
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
          <Image source={{ uri: item.author.avatar }} style={styles.postAvatar} />
          <ThemedText style={[styles.postAuthor, { color: theme.text }]}>{item.author.name}</ThemedText>
          <Feather name="trending-up" size={16} color={theme.primary} />
        </View>
        <ThemedText style={[styles.postContent, { color: theme.text }]} numberOfLines={3}>
          {item.content}
        </ThemedText>
        {item.image ? <Image source={{ uri: item.image }} style={styles.postImage} contentFit="cover" /> : null}
        <View style={styles.postTags}>
          {item.hashtags.map(tag => (
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
            <Feather name="message-circle" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>{item.comments}</ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>ট্রেন্ডিং</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          কমিউনিটিতে এখন যা জনপ্রিয়
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50)} style={styles.tabsContainer}>
        {[
          { id: "hashtags", label: "হ্যাশট্যাগ", icon: "hash" as const },
          { id: "topics", label: "টপিক", icon: "layers" as const },
          { id: "posts", label: "পোস্ট", icon: "file-text" as const },
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
            <Feather name={tab.icon} size={14} color={activeTab === tab.id ? "#fff" : theme.text} />
            <ThemedText style={[styles.tabText, { color: activeTab === tab.id ? "#fff" : theme.text }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.View>

      {activeTab === "hashtags" ? (
        <FlatList
          data={TRENDING_HASHTAGS}
          keyExtractor={item => item.id}
          renderItem={renderHashtag}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      ) : activeTab === "topics" ? (
        <FlatList
          data={TRENDING_TOPICS}
          keyExtractor={item => item.id}
          renderItem={renderTopic}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      ) : (
        <FlatList
          data={TRENDING_POSTS}
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
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, gap: Spacing.xs },
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
