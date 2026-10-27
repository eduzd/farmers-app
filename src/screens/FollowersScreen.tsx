import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PublicUser } from "@/lib/storage";
import { apiGet, apiPost, isLoggedIn, currentUserId } from "@/lib/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FollowersRouteProp = RouteProp<RootStackParamList, "Followers">;


const SECTOR_LABELS: Record<string, string> = {
  crops: "শস্য চাষী",
  vegetables: "সবজি চাষী",
  fruits: "ফল চাষী",
  dairy: "দুগ্ধ খামারি",
  poultry: "পোল্ট্রি খামারি",
  fish: "মাছ চাষী",
  livestock: "পশু পালক",
  organic: "অর্গানিক চাষী",
  mixed: "মিশ্র খামারি",
  farmer: "কৃষক",
  buyer: "ক্রেতা",
  company: "কোম্পানি",
  expert: "বিশেষজ্ঞ",
};

export default function FollowersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<FollowersRouteProp>();

  const [followers, setFollowers] = useState<PublicUser[]>([]);
  React.useEffect(() => {
    const uid = (route.params as any)?.userId;
    const target = !uid || uid === "me" || uid === currentUserId() ? "me" : uid;
    Promise.all([apiGet(`/api/follows/${target}`), isLoggedIn() ? apiGet("/api/follows/me") : Promise.resolve({ following: [] })])
      .then(([r, mine]: any[]) => {
        const myIds = new Set((mine.following || []).map((u: any) => u.id));
        const toUser = (u: any): PublicUser => ({
          id: u.id,
          name: u.name || u.username,
          username: u.username,
          initials: String(u.name || u.username || "U").slice(0, 2).toUpperCase(),
          role: u.role === "buyer" || u.role === "company" || u.role === "expert" ? u.role : "farmer",
          verified: !!u.verified,
          followersCount: 0,
          followingCount: 0,
          isFollowing: myIds.has(u.id),
        } as PublicUser);
        setFollowers((r.followers || []).map(toUser));
      })
      .catch(() => setFollowers([]));
  }, [(route.params as any)?.userId]);


  const handleUserPress = (user: PublicUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("UserProfile", { user });
  };

  const handleToggleFollow = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLoggedIn()) return;
    apiPost(`/api/follows/${userId}`).catch(() => {});
    setFollowers((prev) =>
      prev.map((f) =>
        f.id === userId ? { ...f, isFollowing: !f.isFollowing } : f
      )
    );
  };

  const getSectorLabel = (user: PublicUser) => {
    if (user.farmingCategory) {
      return SECTOR_LABELS[user.farmingCategory] || user.farmingCategory;
    }
    return SECTOR_LABELS[user.role] || user.role;
  };

  const renderFollower = ({ item }: { item: PublicUser }) => (
    <Pressable
      style={({ pressed }) => [
        styles.followerCard,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
        pressed && styles.cardPressed,
      ]}
      onPress={() => handleUserPress(item)}
    >
      <UserAvatar
        initials={item.initials}
        avatarId={item.avatarId}
        avatarColor={item.avatarColor}
        avatar={item.avatar}
        size="medium"
        isWelfareMember={item.isWelfareMember}
        userId={item.id}
      />

      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <ThemedText style={[styles.userName, { color: theme.text }]}>
            {item.name}
          </ThemedText>
        </View>
        <ThemedText style={[styles.sectorLabel, { color: theme.textSecondary }]}>
          {getSectorLabel(item)}
        </ThemedText>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.followButton,
          item.isFollowing
            ? { backgroundColor: theme.backgroundSecondary }
            : { backgroundColor: theme.primary },
          pressed && styles.buttonPressed,
        ]}
        onPress={() => handleToggleFollow(item.id)}
      >
        <ThemedText
          style={[
            styles.followButtonText,
            { color: item.isFollowing ? theme.text : "#FFFFFF" },
          ]}
        >
          {item.isFollowing ? "ফলোয়িং" : "ফলো"}
        </ThemedText>
      </Pressable>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={followers}
        renderItem={renderFollower}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              কোনো ফলোয়ার নেই
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  followerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  cardPressed: {
    opacity: 0.9,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  verifiedIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectorLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["4xl"],
  },
  emptyText: {
    fontSize: 16,
    marginTop: Spacing.md,
  },
});
