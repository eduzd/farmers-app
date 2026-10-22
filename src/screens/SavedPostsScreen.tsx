import React, { useState } from "react";
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

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SavedItem {
  id: string;
  type: "post" | "product" | "article" | "video";
  title: string;
  description?: string;
  image?: string;
  author: { name: string; avatar: string };
  savedAt: Date;
  category: string;
}

const SAVED_ITEMS: SavedItem[] = [];

const FILTERS = ["সব", "পোস্ট", "পণ্য", "আর্টিকেল", "ভিডিও"];

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

const formatDate = (date: Date) => {
  const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  const days = Math.floor(hours / 24);
  return `${days} দিন আগে`;
};

export default function SavedPostsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [savedItems, setSavedItems] = useState(SAVED_ITEMS);
  const [selectedFilter, setSelectedFilter] = useState("সব");

  const handleOpenPost = (item: SavedItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.type === "post" || item.type === "article") {
      const post = {
        id: item.id,
        author: { name: item.author.name, avatar: item.author.avatar, initials: item.author.name.substring(0, 2) },
        content: item.description || item.title,
        image: item.image,
        likes: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 20),
        views: Math.floor(Math.random() * 500),
        isLiked: false,
        createdAt: formatDate(item.savedAt),
      };
      navigation.navigate("PostDetail", { postId: item.id, post });
    } else if (item.type === "product") {
      navigation.navigate("ProductDetail", { product: { id: item.id, name: item.title, price: 0, image: item.image || "", category: "", description: item.description || "", seller: item.author.name } as any });
    }
  };

  const filteredItems = selectedFilter === "সব" 
    ? savedItems 
    : savedItems.filter(item => item.category === selectedFilter);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleRemove = (itemId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavedItems(prev => prev.filter(item => item.id !== itemId));
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
                <Image source={{ uri: item.author.avatar }} style={styles.authorAvatar} />
                <ThemedText style={[styles.authorName, { color: theme.textSecondary }]}>
                  {item.author.name}
                </ThemedText>
              </View>
              <ThemedText style={[styles.savedTime, { color: theme.textSecondary }]}>
                {formatDate(item.savedAt)}
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
        <ThemedText style={[styles.title, { color: theme.text }]}>সেভ করা</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {savedItems.length}টি আইটেম সেভ করা আছে
        </ThemedText>
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
              কোন সেভ করা আইটেম নেই
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
