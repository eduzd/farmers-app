import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import { fetchSavedPosts, setServerPostSaved, type FeedPost } from "@/lib/feedApi";

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SavedItem {
  id: string;
  post: FeedPost;
  type: "post" | "product" | "article" | "video";
  title: string;
  description?: string;
  image?: string;
  author: { name: string; avatar: string };
  savedAt: string;
  category: string;
}

const getTypeIcon = (type: string): keyof typeof Feather.glyphMap => {
  const icons: Record<string, keyof typeof Feather.glyphMap> = {
    post: "file-text",
    product: "shopping-bag",
    article: "book-open",
    video: "play-circle",
  };
  return icons[type] || "file";
};

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    post: "#2563EB",
    product: "#2FA36B",
    article: "#EA8A0C",
    video: "#DC2626",
  };
  return colors[type] || "#475569";
};

export default function SavedPostsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { language } = useI18n();
  const bn = language === "bn";
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const FILTERS = [bn ? "সব" : "All"];
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const token = useAuthStore((s: any) => s.getToken());

  // Posts this account really saved, from the server.
  const load = useCallback(async () => {
    if (!token) {
      setSavedItems([]);
      setLoading(false);
      return;
    }
    setFailed(false);
    try {
      const posts = await fetchSavedPosts(token, bn);
      setSavedItems(
        posts.map((p) => ({
          id: p.id,
          post: p,
          type: "post",
          title: p.content.split("\n")[0].slice(0, 120) || (p.poll ? `${bn ? "জরিপ" : "Poll"}: ${p.poll.question}`.slice(0, 120) : bn ? "ছবি" : "Photo"),
          description: p.content.length > 120 ? p.content : undefined,
          image: p.image,
          author: { name: p.author.name, avatar: p.author.avatar || "" },
          savedAt: p.createdAt,
          category: bn ? "পোস্ট" : "Post",
        })),
      );
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token, bn]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenPost = (item: SavedItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PostDetail", { postId: item.id, post: item.post } as any);
  };

  const filteredItems = savedItems;

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRemove = async (itemId: string) => {
    if (!token) return;
    try {
      await setServerPostSaved(token, itemId, false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSavedItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch {
      // Still saved on the server, so it stays in the list.
    }
  };

  const renderItem = ({ item, index }: { item: SavedItem; index: number }) => {
    const typeColor = getTypeColor(item.type);
    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <Pressable
          style={[styles.savedCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={() => handleOpenPost(item)}
        >
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
          ) : (
            <View style={[styles.itemImagePlaceholder, { backgroundColor: typeColor + "15" }]}>
              <AppIcon name={getTypeIcon(item.type)} size={24} color={typeColor} />
            </View>
          )}
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <View style={[styles.typeBadge, { backgroundColor: typeColor + "15" }]}>
                <AppIcon name={getTypeIcon(item.type)} size={10} color={typeColor} />
                <ThemedText style={[styles.typeText, { color: typeColor }]}>{item.category}</ThemedText>
              </View>
              <Pressable onPress={() => handleRemove(item.id)} hitSlop={10}>
                <Feather name="bookmark" size={18} color={theme.primary} />
              </Pressable>
            </View>
            <ThemedText style={[styles.itemTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </ThemedText>
            {item.description ? (
              <ThemedText style={[styles.itemDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.description}
              </ThemedText>
            ) : null}
            <View style={styles.itemFooter}>
              <View style={styles.authorRow}>
                {item.author.avatar ? <Image source={{ uri: item.author.avatar }} style={styles.authorAvatar} /> : null}
                <ThemedText style={[styles.authorName, { color: theme.textSecondary }]}>
                  {item.author.name}
                </ThemedText>
              </View>
              <ThemedText style={[styles.savedTime, { color: theme.textSecondary }]}>
                {item.savedAt}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>{bn ? "সেভ করা" : "Saved"}</ThemedText>
        {!loading && !failed && token ? (
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {bn ? `${savedItems.length}টি পোস্ট সেভ করা আছে` : `${savedItems.length} saved ${savedItems.length === 1 ? "post" : "posts"}`}
          </ThemedText>
        ) : null}
      </Animated.View>

      <Animated.ScrollView
        entering={FadeInUp.delay(50)}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTERS.map(filter => (
          <Pressable
            key={filter}
            style={[
              styles.filterChip,
              { backgroundColor: selectedFilter === filter ? theme.primary : theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedFilter(filter);
            }}
          >
            <ThemedText style={[styles.filterText, { color: selectedFilter === filter ? "#fff" : theme.text }]}>
              {filter}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.ScrollView>

      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bookmark" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {loading
                ? bn ? "লোড হচ্ছে..." : "Loading..."
                : failed
                  ? bn ? "লোড করা যায়নি। টেনে আবার চেষ্টা করুন" : "Couldn't load. Pull down to try again"
                  : !token
                    ? bn ? "সেভ করা পোস্ট দেখতে সাইন ইন করুন" : "Sign in to see your saved posts"
                    : bn ? "কোন সেভ করা পোস্ট নেই" : "No saved posts yet"}
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  filtersScroll: { flexGrow: 0, flexShrink: 0 },
  filtersContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
 },
  filterText: { fontSize: 13, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg },
  savedCard: { flexDirection: "row", borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden", marginBottom: Spacing.md },
  itemImage: { width: 100, height: 100 },
  itemImagePlaceholder: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  itemContent: { flex: 1, padding: Spacing.sm },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  typeBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  typeText: { fontSize: 10, fontWeight: "500" },
  itemTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  itemDescription: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  itemFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorAvatar: { width: 16, height: 16, borderRadius: 8 },
  authorName: { fontSize: 11 },
  savedTime: { fontSize: 10 },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
});
