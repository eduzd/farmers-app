import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
const CATEGORIES = [
  { id: "all", label: "সব", icon: "grid" },
  { id: "rice", label: "ভাত", icon: "circle" },
  { id: "fish", label: "মাছ", icon: "anchor" },
  { id: "meat", label: "মাংস", icon: "circle" },
  { id: "vegetable", label: "সবজি", icon: "feather" },
  { id: "sweet", label: "মিষ্টি", icon: "heart" },
];

const RECIPES = [
  {
    id: "1",
    name: "ভুনা খিচুড়ি",
    category: "rice",
    time: "৪৫ মিনিট",
    difficulty: "সহজ",
    ingredients: ["চাল", "ডাল", "সবজি", "মশলা"],
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300",
  },
  {
    id: "2",
    name: "ইলিশ ভাপা",
    category: "fish",
    time: "৩০ মিনিট",
    difficulty: "মাঝারি",
    ingredients: ["ইলিশ মাছ", "সরষে বাটা", "কাঁচা মরিচ"],
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=300",
  },
  {
    id: "3",
    name: "মুরগির রোস্ট",
    category: "meat",
    time: "১ ঘণ্টা",
    difficulty: "মাঝারি",
    ingredients: ["মুরগি", "আলু", "মশলা", "তেল"],
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=300",
  },
  {
    id: "4",
    name: "মিক্সড সবজি",
    category: "vegetable",
    time: "২৫ মিনিট",
    difficulty: "সহজ",
    ingredients: ["বিভিন্ন সবজি", "মশলা", "তেল"],
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300",
  },
  {
    id: "5",
    name: "রসগোল্লা",
    category: "sweet",
    time: "১ ঘণ্টা ৩০ মিনিট",
    difficulty: "কঠিন",
    ingredients: ["ছানা", "চিনি", "পানি"],
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1666190094551-2f7eb9e9c0a3?w=300",
  },
];

export default function RecipeFinderScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecipes = RECIPES.filter((r) => {
    const matchesCategory = selectedCategory === "all" || r.category === selectedCategory;
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Feather name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="রেসিপি খুঁজুন..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryChip,
              {
                backgroundColor: selectedCategory === cat.id ? theme.primary : theme.card,
                borderColor: selectedCategory === cat.id ? theme.primary : theme.cardBorder,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedCategory(cat.id);
            }}
          >
            <AppIcon
              name={cat.icon as any}
              size={16}
              color={selectedCategory === cat.id ? "#fff" : theme.textSecondary}
            />
            <ThemedText style={[styles.categoryText, { color: selectedCategory === cat.id ? "#fff" : theme.text }]}>
              {cat.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          {filteredRecipes.length} টি রেসিপি পাওয়া গেছে
        </ThemedText>

        {filteredRecipes.map((recipe, index) => (
          <Animated.View key={recipe.id} entering={FadeInUp.delay(index * 80).duration(400)}>
            <Pressable style={[styles.recipeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Image source={{ uri: recipe.image }} style={styles.recipeImage} contentFit="cover" />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.7)"]}
                style={styles.recipeGradient}
              >
                <View style={styles.ratingBadge}>
                  <Feather name="star" size={12} color="#F5B700" />
                  <ThemedText style={styles.ratingText}>{recipe.rating}</ThemedText>
                </View>
              </LinearGradient>
              <View style={styles.recipeContent}>
                <ThemedText style={[styles.recipeName, { color: theme.text }]}>{recipe.name}</ThemedText>
                <View style={styles.recipeMeta}>
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={14} color={theme.textSecondary} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{recipe.time}</ThemedText>
                  </View>
                  <View
                    style={[
                      styles.difficultyBadge,
                      {
                        backgroundColor:
                          recipe.difficulty === "সহজ"
                            ? "#00BB7720"
                            : recipe.difficulty === "মাঝারি"
                            ? "#B25E0920"
                            : "#DA2F2F20",
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.difficultyText,
                        {
                          color:
                            recipe.difficulty === "সহজ"
                              ? "#00BB77"
                              : recipe.difficulty === "মাঝারি"
                              ? "#B25E09"
                              : "#DA2F2F",
                        },
                      ]}
                    >
                      {recipe.difficulty}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.ingredientsList}>
                  {recipe.ingredients.slice(0, 3).map((ing, i) => (
                    <View key={i} style={[styles.ingredientChip, { backgroundColor: theme.primary + "15" }]}>
                      <ThemedText style={[styles.ingredientText, { color: theme.primary }]}>{ing}</ThemedText>
                    </View>
                  ))}
                  {recipe.ingredients.length > 3 ? (
                    <ThemedText style={[styles.moreIngredients, { color: theme.textSecondary }]}>
                      +{recipe.ingredients.length - 3}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15 },
  categoriesScroll: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, flexGrow: 0 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
  },
  categoryText: { fontSize: 13, fontWeight: "500" },
  content: { padding: Spacing.lg, paddingTop: 0 },
  sectionTitle: { marginBottom: Spacing.md },
  recipeCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  recipeImage: { width: "100%", height: 160 },
  recipeGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    padding: Spacing.sm,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  ratingText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  recipeContent: { padding: Spacing.md },
  recipeName: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.xs },
  recipeMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13 },
  difficultyBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.md },
  difficultyText: { fontSize: 12, fontWeight: "600" },
  ingredientsList: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  ingredientChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md },
  ingredientText: { fontSize: 12 },
  moreIngredients: { fontSize: 12, marginLeft: 4 },
});
