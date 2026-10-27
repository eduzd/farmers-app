import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PublicUser } from "@/lib/storage";
import { currentUserId, isLoggedIn } from "@/lib/api";
import { initialsOf } from "@/lib/feedApi";
import { fetchLikers, toggleFollow, compactCount, type PersonCard } from "@/lib/liveDataApi";

import { ChatIcon } from "@/components/icons/ChatIcon";
interface LikedUser {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  role?: string;
  location?: string;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  verified: boolean;
}

const ROLE_LABEL: Record<string, { bn: string; en: string }> = {
  expert: { bn: "বিশেষজ্ঞ", en: "Expert" },
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type LikesListRouteProp = RouteProp<RootStackParamList, "LikesList">;

export default function LikesListScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { language } = useI18n();
  const bn = language === "bn";
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LikesListRouteProp>();
  const { postId } = route.params;
  const me = currentUserId();

  const [users, setUsers] = useState<LikedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const toLiked = useCallback(
    (p: PersonCard): LikedUser => {
      const key = p.profileRole === "expert" ? "expert" : p.farmingCategory || "";
      return {
        id: p.id,
        name: p.name,
        initials: initialsOf(p.name),
        avatar: p.avatar || undefined,
        role: ROLE_LABEL[key] ? ROLE_LABEL[key][bn ? "bn" : "en"] : undefined,
        isFollowing: p.isFollowing,
        followerCount: p.followerCount,
        followingCount: p.followingCount,
        verified: p.verified,
      };
    },
    [bn],
  );

  // The people who really liked this post, from the server.
  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    fetchLikers(postId)
      .then((list) => setUsers(list.map(toLiked)))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [postId, toLiked]);

  useEffect(load, [load]);

  const handleFollow = async (userId: string) => {
    if (!isLoggedIn()) return navigation.navigate("Login" as any);
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
      // The server didn't change anything, so the button stays as it was.
    } finally {
      setBusy(null);
    }
  };

  const handleMessage = (user: LikedUser) => {
    if (!isLoggedIn()) return navigation.navigate("Login" as any);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Chat", {
      conversationId: user.id,
      userName: user.name,
      userInitials: user.initials,
    });
  };

  const handleUserPress = (user: LikedUser) => {
    const publicUser: PublicUser = {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      initials: user.initials,
      role: "farmer" as const,
      location: user.location,
      verified: user.verified,
      followersCount: user.followerCount,
      followingCount: user.followingCount,
      isFollowing: user.isFollowing,
    };
    navigation.navigate("UserProfile", { user: publicUser });
  };

  const renderUser = ({ item }: { item: LikedUser }) => (
    <View style={[styles.userCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <Pressable 
        style={styles.userInfo}
        onPress={() => handleUserPress(item)}
      >
        <UserAvatar
          initials={item.initials}
          avatar={item.avatar}
          size="medium"
          userId={item.id}
        />
        <View style={styles.userDetails}>
          <ThemedText style={[styles.userName, { color: theme.text }]}>
            {item.name}
          </ThemedText>
          {item.role ? (
            <ThemedText style={[styles.userRole, { color: theme.textSecondary }]}>
              {item.role}
            </ThemedText>
          ) : null}
          <ThemedText style={[styles.userRole, { color: theme.textSecondary }]}>
            {compactCount(item.followerCount)} {bn ? "ফলোয়ার" : item.followerCount === 1 ? "follower" : "followers"}
          </ThemedText>
          {item.location ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
                {item.location}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>

      {item.id === me ? null : <View style={styles.actionButtons}>
        <Pressable
          style={({ pressed }) => [
            styles.followButton,
            { 
              backgroundColor: item.isFollowing ? theme.backgroundDefault : theme.primary,
              borderColor: item.isFollowing ? theme.primary : "transparent",
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={() => handleFollow(item.id)}
          disabled={busy === item.id}
        >
          <ThemedText style={[
            styles.followButtonText,
            { color: item.isFollowing ? theme.primary : theme.buttonText }
          ]}>
            {item.isFollowing ? (bn ? "ফলো করা হয়েছে" : "Following") : bn ? "ফলো" : "Follow"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.messageButton,
            { 
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.cardBorder,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={() => handleMessage(item)}
        >
          <ChatIcon size={18} color={theme.text} />
        </Pressable>
      </View>}
    </View>
  );

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={renderUser}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      ListEmptyComponent={
        loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : failed ? (
          <View style={styles.emptyContainer}>
            <Feather name="wifi-off" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {bn ? "লাইক লোড করা যায়নি" : "Couldn't load likes"}
            </ThemedText>
            <Pressable onPress={load} style={{ marginTop: Spacing.md }}>
              <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>{bn ? "আবার চেষ্টা করুন" : "Try again"}</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="heart" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {bn ? "এখনো কেউ লাইক দেয়নি" : "No likes yet"}
            </ThemedText>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
  userDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  userRole: {
    fontSize: 13,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  followButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 15,
  },
});
