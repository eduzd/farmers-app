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
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useCompanyStore } from "@/lib/companyStore";
import { CompanyChat } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useI18n } from "@/lib/i18n";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CompanyChatScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { company, chats } = useCompanyStore();
  const navigation = useNavigation<NavigationProp>();
  const { t, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = chats.filter((chat) =>
    chat.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatPress = (chat: CompanyChat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Chat", {
      conversationId: chat.id,
      userName: chat.customerName,
      userInitials: chat.customerInitials,
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (language === "bn") {
      if (diffMins < 60) {
        return `${diffMins} মি.`;
      } else if (diffHours < 24) {
        return `${diffHours} ঘ.`;
      } else if (diffDays === 1) {
        return "গতকাল";
      } else if (diffDays < 7) {
        return `${diffDays} দিন আগে`;
      } else {
        return date.toLocaleDateString("bn-BD");
      }
    } else {
      if (diffMins < 60) {
        return `${diffMins}m`;
      } else if (diffHours < 24) {
        return `${diffHours}h`;
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return `${diffDays}d`;
      } else {
        return date.toLocaleDateString("en-US");
      }
    }
  };

  const renderChat = ({ item }: { item: CompanyChat }) => (
    <Pressable
      style={({ pressed }) => [
        styles.conversationItem,
        { backgroundColor: theme.white },
        pressed && styles.itemPressed,
      ]}
      onPress={() => handleChatPress(item)}
    >
      <View style={styles.avatarContainer}>
        <UserAvatar
          initials={item.customerInitials}
          size="medium"
          isWelfareMember={item.isWelfareMember}
        />
        {item.isOnline ? (
          <View style={[styles.onlineIndicator, { borderColor: theme.white }]} />
        ) : null}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <ThemedText style={[styles.userName, { color: theme.text }]}>
            {item.customerName}
          </ThemedText>
          <ThemedText style={[styles.time, { color: theme.textSecondary }]}>
            {formatTime(item.updatedAt)}
          </ThemedText>
        </View>
        <View style={styles.messageRow}>
          <ThemedText
            style={[
              styles.lastMessage,
              { color: theme.textSecondary },
              item.unreadCount > 0 && { color: theme.text, fontWeight: "500" },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </ThemedText>
          {item.unreadCount > 0 ? (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.unreadCount}>{item.unreadCount}</ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="message-circle" size={64} color={theme.textSecondary} />
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
        {language === "bn" ? "কোনো চ্যাট নেই" : "No conversations yet"}
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {language === "bn" 
          ? "গ্রাহকরা আপনার সাথে যোগাযোগ করলে এখানে দেখা যাবে"
          : "Customer conversations will appear here"}
      </ThemedText>
    </View>
  );

  if (!company) {
    return (
      <View style={[styles.noCompanyContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.noCompanyText, { color: theme.textSecondary }]}>
          {language === "bn" ? "প্রথমে কোম্পানি প্রোফাইল তৈরি করুন" : "Create company profile first"}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.searchContainer,
          {
            paddingTop: Spacing.md,
            backgroundColor: theme.backgroundRoot,
          },
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: theme.white }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={language === "bn" ? "চ্যাট খুঁজুন..." : "Search conversations..."}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderChat}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
          filteredChats.length === 0 && styles.emptyListContent,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.inputBorder }]} />
        )}
        ListEmptyComponent={renderEmptyState}
      />

      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
      >
        <Feather name="edit-2" size={22} color={theme.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  noCompanyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.xl,
  },
  noCompanyText: {
    fontSize: 16,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 44,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlignVertical: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  itemPressed: {
    opacity: 0.9,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  onlineIndicator: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#16A34A",
    borderWidth: 2,
  },
  conversationContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  time: {
    fontSize: 13,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: Spacing.sm,
  },
  unreadCount: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  separator: {
    height: 1,
    marginLeft: 76,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  emptyTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
