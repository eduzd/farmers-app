import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface User {
  id: string;
  name: string;
  avatar: string;
  location: string;
  category: string;
  followers: number;
  isFollowing: boolean;
  isVerified: boolean;
}

const CATEGORIES = [
  { id: "all", label: "সব" },
  { id: "crops", label: "ফসল" },
  { id: "fish", label: "মাছ" },
  { id: "livestock", label: "গবাদি" },
  { id: "poultry", label: "হাঁস-মুরগি" },
  { id: "experts", label: "বিশেষজ্ঞ" },
];

const MOCK_USERS: User[] = [];

const SUGGESTED_SEARCHES = ["ধান চাষী", "মাছ চাষী", "কৃষি বিশেষজ্ঞ", "গরু খামার", "হাঁস-মুরগি"];

export default function UserSearchScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [users, setUsers] = useState(MOCK_USERS);

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || user.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleFollow = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? { ...user, isFollowing: !user.isFollowing, followers: user.isFollowing ? user.followers - 1 : user.followers + 1 }
          : user
      )
    );
  };

  const handleUserPress = (user: User) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("UserProfile", {
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        initials: user.name.slice(0, 2),
        location: user.location,
        followers: user.followers,
        following: 0,
        posts: 0,
        isFollowing: user.isFollowing,
      },
    });
  };

  const renderUser = ({ item, index }: { item: User; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[styles.userItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleUserPress(item)}
      >
        <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <ThemedText style={[styles.userName, { color: theme.text }]}>{item.name}</ThemedText>
            {item.isVerified ? (
              <Feather name="check-circle" size={14} color="#2FA36B" />
            ) : null}
          </View>
          <ThemedText style={[styles.userMeta, { color: theme.textSecondary }]}>
            {item.location} • {item.followers.toLocaleString()} ফলোয়ার
          </ThemedText>
        </View>
        <Pressable
          style={[
            styles.followButton,
            { backgroundColor: item.isFollowing ? theme.card : theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => handleFollow(item.id)}
        >
          <ThemedText
            style={[styles.followButtonText, { color: item.isFollowing ? theme.primary : "#fff" }]}
          >
            {item.isFollowing ? "ফলো করছেন" : "ফলো করুন"}
          </ThemedText>
        </Pressable>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>ব্যবহারকারী খুঁজুন</ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50)}>
        <View
          style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        >
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="নাম বা এলাকা দিয়ে খুঁজুন..."
            placeholderTextColor={theme.textSecondary}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      <Animated.ScrollView
        entering={FadeInUp.delay(100)}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryChip,
              { backgroundColor: selectedCategory === cat.id ? theme.primary : theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedCategory(cat.id);
            }}
          >
            <ThemedText
              style={[styles.categoryChipText, { color: selectedCategory === cat.id ? "#fff" : theme.text }]}
            >
              {cat.label}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.ScrollView>

      {!searchQuery && selectedCategory === "all" ? (
        <Animated.View entering={FadeInUp.delay(150)} style={styles.suggestionsSection}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>জনপ্রিয় অনুসন্ধান</ThemedText>
          <View style={styles.suggestionsContainer}>
            {SUGGESTED_SEARCHES.map((term) => (
              <Pressable
                key={term}
                style={[styles.suggestionChip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                onPress={() => setSearchQuery(term)}
              >
                <Feather name="search" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.suggestionText, { color: theme.text }]}>{term}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              কোন ব্যবহারকারী পাওয়া যায়নি
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: 22, fontWeight: "700" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  categoriesContainer: { flexGrow: 0, flexShrink: 0 },
  categoriesContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipText: { fontSize: 13, fontWeight: "500" },
  suggestionsSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.sm },
  suggestionsContainer: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  suggestionText: { fontSize: 13 },
  listContent: { paddingHorizontal: Spacing.lg },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  userAvatar: { width: 50, height: 50, borderRadius: 25 },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  userName: { fontSize: 15, fontWeight: "600" },
  userMeta: { fontSize: 12, marginTop: 2 },
  followButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  followButtonText: { fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
});
