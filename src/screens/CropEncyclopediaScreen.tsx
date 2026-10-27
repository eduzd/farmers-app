import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Crop {
  id: string;
  name: string;
  scientificName: string;
  image: string;
  category: string;
  season: string;
  duration: string;
  difficulty: "easy" | "medium" | "hard";
  waterNeeds: string;
  soilType: string;
}

const CATEGORIES = ["সব", "শস্য", "সবজি", "ফল", "মসলা", "তেল"];

const CROPS: Crop[] = [
  {
    id: "1",
    name: "ধান",
    scientificName: "Oryza sativa",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400",
    category: "শস্য",
    season: "আউশ/আমন/বোরো",
    duration: "৯০-১৫০ দিন",
    difficulty: "medium",
    waterNeeds: "বেশি",
    soilType: "এঁটেল মাটি",
  },
  {
    id: "2",
    name: "গম",
    scientificName: "Triticum aestivum",
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400",
    category: "শস্য",
    season: "রবি",
    duration: "১১০-১২০ দিন",
    difficulty: "easy",
    waterNeeds: "মাঝারি",
    soilType: "দোআঁশ মাটি",
  },
  {
    id: "3",
    name: "টমেটো",
    scientificName: "Solanum lycopersicum",
    image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400",
    category: "সবজি",
    season: "শীতকাল",
    duration: "৭০-৯০ দিন",
    difficulty: "medium",
    waterNeeds: "মাঝারি",
    soilType: "দোআঁশ মাটি",
  },
  {
    id: "4",
    name: "আম",
    scientificName: "Mangifera indica",
    image: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400",
    category: "ফল",
    season: "গ্রীষ্মকাল",
    duration: "৫+ বছর",
    difficulty: "hard",
    waterNeeds: "মাঝারি",
    soilType: "সব ধরনের",
  },
  {
    id: "5",
    name: "মরিচ",
    scientificName: "Capsicum annuum",
    image: "https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=400",
    category: "মসলা",
    season: "সারা বছর",
    duration: "৬০-৯০ দিন",
    difficulty: "easy",
    waterNeeds: "মাঝারি",
    soilType: "দোআঁশ মাটি",
  },
  {
    id: "6",
    name: "সরিষা",
    scientificName: "Brassica juncea",
    image: "https://images.unsplash.com/photo-1556761223-4c4282c73f77?w=400",
    category: "তেল",
    season: "রবি",
    duration: "৯০-১১০ দিন",
    difficulty: "easy",
    waterNeeds: "কম",
    soilType: "দোআঁশ মাটি",
  },
];

const getDifficultyConfig = (difficulty: string) => {
  const configs: Record<string, { color: string; label: string }> = {
    easy: { color: "#2E96EF", label: "সহজ" },
    medium: { color: "#B25E09", label: "মাঝারি" },
    hard: { color: "#DA2F2F", label: "কঠিন" },
  };
  return configs[difficulty] || configs.easy;
};

export default function CropEncyclopediaScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);

  const filteredCrops = CROPS.filter(crop => {
    const matchesSearch = crop.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "সব" || crop.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderCrop = ({ item, index }: { item: Crop; index: number }) => {
    const difficulty = getDifficultyConfig(item.difficulty);
    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <Pressable
          style={[styles.cropCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          <Image source={{ uri: item.image }} style={styles.cropImage} contentFit="cover" />
          <View style={styles.cropContent}>
            <View style={styles.cropHeader}>
              <View>
                <ThemedText style={[styles.cropName, { color: theme.text }]}>{item.name}</ThemedText>
                <ThemedText style={[styles.scientificName, { color: theme.textSecondary }]}>{item.scientificName}</ThemedText>
              </View>
              <View style={[styles.difficultyBadge, { backgroundColor: difficulty.color + "15" }]}>
                <ThemedText style={[styles.difficultyText, { color: difficulty.color }]}>{difficulty.label}</ThemedText>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Feather name="calendar" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.infoText, { color: theme.text }]}>{item.season}</ThemedText>
              </View>
              <View style={styles.infoItem}>
                <Feather name="clock" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.infoText, { color: theme.text }]}>{item.duration}</ThemedText>
              </View>
              <View style={styles.infoItem}>
                <Feather name="droplet" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.infoText, { color: theme.text }]}>{item.waterNeeds}</ThemedText>
              </View>
            </View>

            <View style={styles.cropFooter}>
              <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "10" }]}>
                <ThemedText style={[styles.categoryText, { color: theme.primary }]}>{item.category}</ThemedText>
              </View>
              <Pressable style={styles.learnMore}>
                <ThemedText style={[styles.learnMoreText, { color: theme.primary }]}>বিস্তারিত</ThemedText>
                <Feather name="chevron-right" size={14} color={theme.primary} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>ফসল বিশ্বকোষ</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          বাংলাদেশের প্রধান ফসল সম্পর্কে জানুন
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50)}>
        <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="ফসল খুঁজুন..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </Animated.View>

      <Animated.ScrollView
        entering={FadeInUp.delay(75)}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            style={[
              styles.categoryChip,
              { backgroundColor: selectedCategory === cat ? theme.primary : theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedCategory(cat);
            }}
          >
            <ThemedText style={[styles.categoryChipText, { color: selectedCategory === cat ? "#fff" : theme.text }]}>
              {cat}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.ScrollView>

      <FlatList
        data={filteredCrops}
        keyExtractor={item => item.id}
        renderItem={renderCrop}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>কোন ফসল পাওয়া যায়নি</ThemedText>
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
  searchContainer: { flexDirection: "row", alignItems: "center", marginHorizontal: Spacing.lg, marginVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: 15 },
  categoriesScroll: { flexGrow: 0, flexShrink: 0 },
  categoriesContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  categoryChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
 },
  categoryChipText: { fontSize: 13, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  cropCard: { flexDirection: "row", borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden", marginBottom: Spacing.md },
  cropImage: { width: 100, height: 120 },
  cropContent: { flex: 1, padding: Spacing.sm },
  cropHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm },
  cropName: { fontSize: 16, fontWeight: "600" },
  scientificName: { fontSize: 11, fontStyle: "italic" },
  difficultyBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  difficultyText: { fontSize: 10, fontWeight: "500" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginBottom: Spacing.sm },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 11 },
  cropFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  categoryBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 4 },
  categoryText: { fontSize: 10, fontWeight: "500" },
  learnMore: { flexDirection: "row", alignItems: "center" },
  learnMoreText: { fontSize: 12, fontWeight: "500" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
});
