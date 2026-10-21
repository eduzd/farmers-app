import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@/lib/authStore";
import { getApiUrl } from "@/lib/query-client";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Chip, EmptyState, IconButton, TextField } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, FontFamily, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { tr, useTr } from "@/lib/tr";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ChatConversation {
  id: string;
  user: {
    name: string;
    initials: string;
    isOnline: boolean;
    isWelfareMember?: boolean;
    avatar?: string;
    avatarId?: string;
    avatarColor?: string;
  };
  lastMessage: string;
  time: string;
  unreadCount: number;
}

function formatAgo(iso?: string) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

const CONVERSATIONS: ChatConversation[] = [];

export default function ChatListScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { language } = useI18n();
  const isBn = language === "bn";

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "online">("all");

  // Real conversations come from the server. The built-in sample chats are only shown
  // to people who aren't signed in: mixed in with real ones they looked like real
  // people, but nothing sent to them ever went anywhere.
  const getToken = useAuthStore((st) => st.getToken);
  const [liveConversations, setLiveConversations] = useState<ChatConversation[]>([]);
  useFocusEffect(
    useCallback(() => {
      const token = getToken();
      if (!token) return;
      let alive = true;
      const load = () =>
        fetch(`${getApiUrl()}/api/dm/threads`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : []))
          .then((threads: any[]) => {
            if (!alive || !Array.isArray(threads)) return;
            setLiveConversations(
              threads.map((t) => ({
                id: t.userId,
                user: { name: t.name, initials: t.initials, isOnline: false, avatar: t.avatar || undefined },
                lastMessage: (t.lastFromMe ? (isBn ? "আপনি: " : "You: ") : "") + t.lastMessage,
                time: formatAgo(t.lastMessageAt),
                unreadCount: t.unread || 0,
              }))
            );
          })
          .catch(() => {});
      load();
      const timer = setInterval(load, 8000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [getToken, isBn])
  );
  const allConversations = getToken() ? liveConversations : CONVERSATIONS;

  const filteredConversations = allConversations.filter((conv) => {
    if (filter === "unread" && conv.unreadCount === 0) return false;
    if (filter === "online" && !conv.user.isOnline) return false;
    const q = searchQuery.trim().toLowerCase();
    return !q || conv.user.name.toLowerCase().includes(q) || conv.lastMessage.toLowerCase().includes(q);
  });
  const unreadTotal = allConversations.reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0);

  const handleConversationPress = (conversation: ChatConversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Chat", {
      conversationId: conversation.id,
      userName: conversation.user.name,
      userInitials: conversation.user.initials,
      isWelfareMember: conversation.user.isWelfareMember,
    });
  };

  const renderConversation = ({ item }: { item: ChatConversation }) => {
    const unread = item.unreadCount > 0;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.user.name}, ${item.lastMessage}`}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" }]}
        onPress={() => handleConversationPress(item)}
      >
        <View>
          <UserAvatar
            initials={item.user.initials}
            avatar={item.user.avatar}
            avatarId={item.user.avatarId}
            avatarColor={item.user.avatarColor}
            size={52}
            isWelfareMember={item.user.isWelfareMember}
          />
          {item.user.isOnline ? (
            <View style={[styles.online, { backgroundColor: theme.success, borderColor: theme.backgroundRoot }]} />
          ) : null}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <ThemedText style={[styles.name, unread && { fontFamily: FontFamily.bold }]} numberOfLines={1}>
              {item.user.name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: unread ? theme.primary : theme.textTertiary }}>
              {item.time}
            </ThemedText>
          </View>
          <View style={styles.rowTop}>
            <ThemedText
              type="small"
              numberOfLines={1}
              style={[{ flex: 1, color: unread ? theme.text : theme.textSecondary }, unread && { fontFamily: FontFamily.medium }]}
            >
              {item.lastMessage}
            </ThemedText>
            {unread ? (
              <View style={[styles.unread, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.unreadText}>{item.unreadCount}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.top}>
        <TextField
          icon="search"
          placeholder={isBn ? "কথোপকথন খুঁজুন..." : "Search conversations..."}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          right={
            searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8} accessibilityLabel={tr("Clear search")}>
                <Feather name="x-circle" size={18} color={theme.textTertiary} />
              </Pressable>
            ) : null
          }
        />
        <View style={styles.chips}>
          <Chip label={isBn ? "সব" : "All"} selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip
            label={`${isBn ? "অপঠিত" : "Unread"}${unreadTotal ? ` · ${unreadTotal}` : ""}`}
            selected={filter === "unread"}
            onPress={() => setFilter("unread")}
          />
          <Chip label={isBn ? "অনলাইন" : "Online"} selected={filter === "online"} onPress={() => setFilter("online")} />
          <View style={{ flex: 1 }} />
          <IconButton
            icon="edit-3"
            tone="primary"
            size={40}
            accessibilityLabel={isBn ? "নতুন বার্তা" : "New message"}
            onPress={() => navigation.navigate("UserSearch")}
          />
        </View>
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={[
          { paddingBottom: tabBarHeight + Spacing["5xl"], width: "100%", maxWidth: 720, alignSelf: "center" },
          filteredConversations.length === 0 && { flexGrow: 1, justifyContent: "center" },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.divider }]} />}
        ListEmptyComponent={
          <EmptyState
            icon="message-circle"
            title={searchQuery ? (isBn ? "কিছু পাওয়া যায়নি" : "No matches") : isBn ? "এখনও কোনো কথোপকথন নেই" : "No conversations yet"}
            message={isBn ? "কমিউনিটির কৃষকদের সাথে কথা বলা শুরু করুন" : "Start a conversation with farmers in the community"}
            actionLabel={isBn ? "কৃষক খুঁজুন" : "Find farmers"}
            onAction={() => navigation.navigate("UserSearch")}
          />
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  chips: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm },
  name: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: FontFamily.semibold },
  online: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#FFFFFF", fontSize: 11, lineHeight: 14, fontFamily: FontFamily.bold },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg + 52 + Spacing.md },
  fab: { position: "absolute", right: Spacing.xl },
});
