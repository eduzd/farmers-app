import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { isLoggedIn } from "@/lib/api";
import { initialsOf } from "@/lib/feedApi";
import { searchPeople, toggleFollow, compactCount, type PersonCard } from "@/lib/liveDataApi";
import { Spacing, BorderRadius } from "@/constants/theme";

const CATEGORIES = [
  { id: "all", bn: "সব", en: "All" },
  { id: "crops", bn: "ফসল", en: "Crops" },
  { id: "fish", bn: "মাছ", en: "Fish" },
  { id: "livestock", bn: "গবাদি", en: "Livestock" },
  { id: "poultry", bn: "হাঁস-মুরগি", en: "Poultry" },
  { id: "experts", bn: "বিশেষজ্ঞ", en: "Experts" },
];

const CATEGORY_LABEL: Record<string, { bn: string; en: string }> = {
  crops: { bn: "ফসল চাষি", en: "Crop farmer" },
  vegetables: { bn: "সবজি চাষি", en: "Vegetable farmer" },
  fruits: { bn: "ফল চাষি", en: "Fruit farmer" },
  dairy: { bn: "দুগ্ধ খামারি", en: "Dairy farmer" },
  poultry: { bn: "হাঁস-মুরগি খামারি", en: "Poultry farmer" },
  fish: { bn: "মাছ চাষি", en: "Fish farmer" },
  livestock: { bn: "গবাদি পশু খামারি", en: "Livestock farmer" },
  organic: { bn: "জৈব চাষি", en: "Organic farmer" },
  mixed: { bn: "মিশ্র চাষি", en: "Mixed farmer" },
};

export default function UserSearchScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { language } = useI18n();
  const bn = language === "bn";
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [users, setUsers] = useState<PersonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const reqId = useRef(0);

  // Ask the server: people whose name or farming type matches, most followed first.
  const load = useCallback((q: string, cat: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setFailed(false);
    searchPeople(q, cat)
      .then((list) => id === reqId.current && setUsers(list))
      .catch(() => id === reqId.current && setFailed(true))
      .finally(() => id === reqId.current && setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(searchQuery.trim(), selectedCategory), searchQuery ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchQuery, selectedCategory, load]);

  const handleFollow = async (userId: string) => {
    if (!isLoggedIn()) return navigation.navigate("Login");
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(userId);
    try {
      const following = await toggleFollow(userId);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId && u.isFollowing !== following
            ? { ...u, isFollowing: following, followerCount: Math.max(0, u.followerCount + (following ? 1 : -1)) }
            : u,
        ),
      );
    } catch {
      // Nothing changed on the server, so nothing changes on screen.
    } finally {
      setBusy(null);
    }
  };

  const handleUserPress = (user: PersonCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("UserProfile", {
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar || "",
        initials: initialsOf(user.name),
        followers: user.followerCount,
        following: user.followingCount,
        isFollowing: user.isFollowing,
      },
    });
  };

  const metaOf = (u: PersonCard) => {
    const kind =
      u.profileRole === "expert"
        ? bn ? "বিশেষজ্ঞ" : "Expert"
        : u.farmingCategory && CATEGORY_LABEL[u.farmingCategory]
          ? CATEGORY_LABEL[u.farmingCategory][bn ? "bn" : "en"]
          : bn ? "সদস্য" : "Member";
    const n = compactCount(u.followerCount);
    return `${kind} • ${n} ${bn ? "ফলোয়ার" : u.followerCount === 1 ? "follower" : "followers"}`;
  };

  const renderUser = ({ item, index }: { item: PersonCard; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 10) * 40)}>
      <Pressable
        style={[styles.userItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleUserPress(item)}
      >
        <UserAvatar initials={initialsOf(item.name)} avatar={item.avatar || undefined} size="medium" userId={item.id} />
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <ThemedText style={[styles.userName, { color: theme.text }]} numberOfLines={1}>{item.name}</ThemedText>
            {item.verified ? <Feather name="check-circle" size={14} color="#2E96EF" /> : null}
          </View>
          <ThemedText style={[styles.userMeta, { color: theme.textSecondary }]}>{metaOf(item)}</ThemedText>
        </View>
        <Pressable
          style={[
            styles.followButton,
            { backgroundColor: item.isFollowing ? theme.card : theme.primary, borderColor: theme.primary, opacity: busy === item.id ? 0.6 : 1 },
          ]}
          onPress={() => handleFollow(item.id)}
          disabled={busy === item.id}
        >
          <ThemedText style={[styles.followButtonText, { color: item.isFollowing ? theme.primary : "#fff" }]}>
            {item.isFollowing ? (bn ? "ফলো করছেন" : "Following") : bn ? "ফলো করুন" : "Follow"}
          </ThemedText>
        </Pressable>
      </Pressable>
    </Animated.View>
  );

  const browsing = !searchQuery.trim() && selectedCategory === "all";

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>{bn ? "ব্যবহারকারী খুঁজুন" : "Find people"}</ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50)}>
        <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={bn ? "নাম দিয়ে খুঁজুন..." : "Search by name..."}
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
            <ThemedText style={[styles.categoryChipText, { color: selectedCategory === cat.id ? "#fff" : theme.text }]}>
              {bn ? cat.bn : cat.en}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.ScrollView>

      {browsing && users.length > 0 ? (
        <View style={styles.suggestionsSection}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{bn ? "সবচেয়ে বেশি ফলো করা" : "Most followed"}</ThemedText>
        </View>
      ) : null}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : failed ? (
            <View style={styles.emptyState}>
              <Feather name="wifi-off" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {bn ? "লোড করা যায়নি" : "Couldn't load people"}
              </ThemedText>
              <Pressable onPress={() => load(searchQuery.trim(), selectedCategory)} style={{ marginTop: Spacing.md }}>
                <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>{bn ? "আবার চেষ্টা করুন" : "Try again"}</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {bn ? "কোন ব্যবহারকারী পাওয়া যায়নি" : "No people found"}
              </ThemedText>
            </View>
          )
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
