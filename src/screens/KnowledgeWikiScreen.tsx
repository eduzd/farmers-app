import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
interface WikiCategory {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  articlesCount: number;
}

interface WikiArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  image?: string;
  readTime: number;
  views: number;
  isBookmarked: boolean;
}

const CATEGORIES: WikiCategory[] = [
  { id: "1", title: "ফসল চাষ", icon: "sun", color: "#2FA36B", articlesCount: 156 },
  { id: "2", title: "মাছ চাষ", icon: "droplet", color: "#2563EB", articlesCount: 89 },
  { id: "3", title: "পশুপালন", icon: "heart", color: "#EA8A0C", articlesCount: 67 },
  { id: "4", title: "সার ও কীটনাশক", icon: "shield", color: "#7C3AED", articlesCount: 134 },
  { id: "5", title: "কৃষি যন্ত্রপাতি", icon: "settings", color: "#475569", articlesCount: 45 },
  { id: "6", title: "রোগ ও পোকা", icon: "alert-circle", color: "#DC2626", articlesCount: 178 },
];

const POPULAR_ARTICLES: WikiArticle[] = [
  {
    id: "1",
    title: "ধান চাষের সম্পূর্ণ গাইড",
    summary: "বীজ বাছাই থেকে ফসল তোলা পর্যন্ত ধান চাষের A to Z",
    category: "ফসল চাষ",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600",
    readTime: 15,
    views: 12500,
    isBookmarked: false,
  },
  {
    id: "2",
    title: "তেলাপিয়া মাছ চাষ",
    summary: "পুকুরে তেলাপিয়া মাছ চাষের আধুনিক পদ্ধতি",
    category: "মাছ চাষ",
    image: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=600",
    readTime: 10,
    views: 8900,
    isBookmarked: true,
  },
  {
    id: "3",
    title: "জৈব সার তৈরির পদ্ধতি",
    summary: "বাড়িতেই তৈরি করুন উন্নত মানের জৈব সার",
    category: "সার ও কীটনাশক",
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600",
    readTime: 8,
    views: 15600,
    isBookmarked: false,
  },
  {
    id: "4",
    title: "ধানের ব্লাস্ট রোগ ও প্রতিকার",
    summary: "ব্লাস্ট রোগ চেনার উপায় এবং কার্যকর প্রতিরোধ ব্যবস্থা",
    category: "রোগ ও পোকা",
    readTime: 12,
    views: 7800,
    isBookmarked: false,
  },
  {
    id: "5",
    title: "গরুর খাদ্য ব্যবস্থাপনা",
    summary: "সুষম খাদ্য তৈরি এবং খাওয়ানোর নিয়ম",
    category: "পশুপালন",
    readTime: 10,
    views: 5600,
    isBookmarked: true,
  },
];

export default function KnowledgeWikiScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState(POPULAR_ARTICLES);

  const handleBookmark = (articleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setArticles(prev =>
      prev.map(a => (a.id === articleId ? { ...a, isBookmarked: !a.isBookmarked } : a))
    );
  };

  const renderCategory = ({ item, index }: { item: WikiCategory; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[styles.categoryCard, { backgroundColor: item.color + "10", borderColor: item.color + "30" }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <View style={[styles.categoryIcon, { backgroundColor: item.color }]}>
          <AppIcon name={item.icon} size={20} color="#fff" />
        </View>
        <ThemedText style={[styles.categoryTitle, { color: theme.text }]}>{item.title}</ThemedText>
        <ThemedText style={[styles.categoryCount, { color: theme.textSecondary }]}>
          {item.articlesCount} আর্টিকেল
        </ThemedText>
      </Pressable>
    </Animated.View>
  );

  const renderArticle = ({ item, index }: { item: WikiArticle; index: number }) => (
    <Animated.View entering={FadeInUp.delay(100 + index * 50)}>
      <Pressable
        style={[styles.articleCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.articleImage} contentFit="cover" />
        ) : (
          <View style={[styles.articleImagePlaceholder, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="book-open" size={24} color={theme.primary} />
          </View>
        )}
        <View style={styles.articleContent}>
          <View style={styles.articleHeader}>
            <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.categoryBadgeText, { color: theme.primary }]}>{item.category}</ThemedText>
            </View>
            <Pressable onPress={() => handleBookmark(item.id)}>
              <AppIcon name={item.isBookmarked ? "bookmark" : "bookmark"} size={18} color={item.isBookmarked ? theme.primary : theme.textSecondary} />
            </Pressable>
          </View>
          <ThemedText style={[styles.articleTitle, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </ThemedText>
          <ThemedText style={[styles.articleSummary, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.summary}
          </ThemedText>
          <View style={styles.articleMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{item.readTime} মিনিট</ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Feather name="eye" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {(item.views / 1000).toFixed(1)}k
              </ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <ThemedText style={[styles.title, { color: theme.text }]}>জ্ঞানভাণ্ডার</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            কৃষি সংক্রান্ত সব তথ্য এক জায়গায়
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(50)}>
          <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Feather name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="আর্টিকেল খুঁজুন..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </Animated.View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>ক্যাটেগরি</ThemedText>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat, index) => renderCategory({ item: cat, index }))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>জনপ্রিয় আর্টিকেল</ThemedText>
            <Pressable>
              <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>সব দেখুন</ThemedText>
            </Pressable>
          </View>
          {articles.map((article, index) => renderArticle({ item: article, index }))}
        </View>

        <Animated.View entering={FadeInUp.delay(400)} style={[styles.contributeCta, { backgroundColor: theme.primary + "10", borderColor: theme.primary }]}>
          <Feather name="edit-3" size={24} color={theme.primary} />
          <View style={styles.ctaContent}>
            <ThemedText style={[styles.ctaTitle, { color: theme.text }]}>আর্টিকেল লিখুন</ThemedText>
            <ThemedText style={[styles.ctaDescription, { color: theme.textSecondary }]}>
              আপনার জ্ঞান শেয়ার করুন, পয়েন্ট অর্জন করুন
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.primary} />
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { paddingTop: Spacing.md, marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  searchInput: { flex: 1, fontSize: 15 },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.md },
  seeAllText: { fontSize: 13, fontWeight: "500" },
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  categoryCard: { width: "48%", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  categoryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
  categoryTitle: { fontSize: 14, fontWeight: "600" },
  categoryCount: { fontSize: 11, marginTop: 2 },
  articleCard: { flexDirection: "row", borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden", marginBottom: Spacing.md },
  articleImage: { width: 100, height: 100 },
  articleImagePlaceholder: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  articleContent: { flex: 1, padding: Spacing.sm },
  articleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryBadgeText: { fontSize: 10, fontWeight: "500" },
  articleTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  articleSummary: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  articleMeta: { flexDirection: "row", gap: Spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 10 },
  contributeCta: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  ctaContent: { flex: 1, marginLeft: Spacing.md },
  ctaTitle: { fontSize: 14, fontWeight: "600" },
  ctaDescription: { fontSize: 12, marginTop: 2 },
});
