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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PublicUser } from "@/lib/storage";

interface LikedUser {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  role?: string;
  location?: string;
  isFollowing: boolean;
}

const SAMPLE_LIKED_USERS: LikedUser[] = [
  { id: "1", name: "রহিম উদ্দিন", initials: "রউ", role: "ধান চাষি", location: "ময়মনসিংহ", isFollowing: false },
  { id: "2", name: "করিম সাহেব", initials: "কস", role: "সবজি চাষি", location: "বগুড়া", isFollowing: true },
  { id: "3", name: "জামাল হোসেন", initials: "জহ", role: "মৎস্য চাষি", location: "সিলেট", isFollowing: false },
  { id: "4", name: "সালমা বেগম", initials: "সব", role: "গবাদি পশু পালক", location: "রাজশাহী", isFollowing: true },
  { id: "5", name: "আবু তাহের", initials: "আত", role: "ফল চাষি", location: "দিনাজপুর", isFollowing: false },
  { id: "6", name: "নাজমুল ইসলাম", initials: "নই", role: "পোল্ট্রি ফার্মার", location: "গাজীপুর", isFollowing: false },
  { id: "7", name: "ফাতেমা খাতুন", initials: "ফখ", role: "মশলা চাষি", location: "কুমিল্লা", isFollowing: true },
  { id: "8", name: "আলী আকবর", initials: "আআ", role: "চা চাষি", location: "সিলেট", isFollowing: false },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type LikesListRouteProp = RouteProp<RootStackParamList, "LikesList">;

export default function LikesListScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LikesListRouteProp>();
  const { postId, likesCount } = route.params;

  const [users, setUsers] = useState<LikedUser[]>(SAMPLE_LIKED_USERS.slice(0, likesCount));

  const handleFollow = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUsers(prev => 
      prev.map(user => 
        user.id === userId 
          ? { ...user, isFollowing: !user.isFollowing }
          : user
      )
    );
  };

  const handleMessage = (user: LikedUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Chat", {
      conversationId: `user_${user.id}`,
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
      verified: false,
      followersCount: Math.floor(Math.random() * 500) + 50,
      followingCount: Math.floor(Math.random() * 200) + 20,
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

      <View style={styles.actionButtons}>
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
        >
          <ThemedText style={[
            styles.followButtonText,
            { color: item.isFollowing ? theme.primary : theme.white }
          ]}>
            {item.isFollowing ? "ফলো করা হয়েছে" : "ফলো"}
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
          <Feather name="message-circle" size={18} color={theme.text} />
        </Pressable>
      </View>
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
        <View style={styles.emptyContainer}>
          <Feather name="heart" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            এখনো কেউ লাইক দেয়নি
          </ThemedText>
        </View>
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
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  userDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
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
    fontFamily: "PlusJakartaSans_600SemiBold",
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
