import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ModalBottomInset } from "@/components/ModalBottomInset";

interface VoiceRoom {
  id: string;
  title: string;
  topic: string;
  hostName: string;
  hostAvatar: string;
  isLive: boolean;
  speakersCount: number;
  listenersCount: number;
  speakers: { id: string; name: string; avatar: string; isSpeaking: boolean }[];
  category: "general" | "crops" | "livestock" | "fishery" | "business";
  startedAt: Date;
}

const ROOM_CATEGORIES = [
  { id: "all", label: "সব" },
  { id: "general", label: "সাধারণ" },
  { id: "crops", label: "ফসল" },
  { id: "livestock", label: "গবাদি" },
  { id: "fishery", label: "মাছ" },
  { id: "business", label: "ব্যবসা" },
];

const MOCK_ROOMS: VoiceRoom[] = [];

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    general: "#475569",
    crops: "#2FA36B",
    livestock: "#EA8A0C",
    fishery: "#2563EB",
    business: "#7C3AED",
  };
  return colors[category] || "#475569";
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    general: "সাধারণ",
    crops: "ফসল",
    livestock: "গবাদি",
    fishery: "মাছ",
    business: "ব্যবসা",
  };
  return labels[category] || "সাধারণ";
};

const formatDuration = (date: Date) => {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return `${minutes} মিনিট`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ঘণ্টা ${minutes % 60} মিনিট`;
};

export default function VoiceRoomsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomTopic, setNewRoomTopic] = useState("");
  const [newRoomCategory, setNewRoomCategory] = useState("general");

  const filteredRooms =
    selectedCategory === "all"
      ? MOCK_ROOMS
      : MOCK_ROOMS.filter((r) => r.category === selectedCategory);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleJoinRoom = (room: VoiceRoom) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("VoiceRoom", { roomId: room.id, room });
  };

  const handleCreateRoom = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCreateModal(false);
    const newRoom: VoiceRoom = {
      id: Date.now().toString(),
      title: newRoomTitle || "নতুন আলোচনা",
      topic: newRoomTopic || "কৃষি বিষয়ক আলোচনা",
      hostName: "আপনি",
      hostAvatar: "https://randomuser.me/api/portraits/men/1.jpg",
      isLive: true,
      speakersCount: 1,
      listenersCount: 0,
      category: newRoomCategory as any,
      startedAt: new Date(),
      speakers: [{ id: "self", name: "আপনি", avatar: "https://randomuser.me/api/portraits/men/1.jpg", isSpeaking: true }],
    };
    navigation.navigate("VoiceRoom", { roomId: newRoom.id, room: newRoom, isHost: true });
    setNewRoomTitle("");
    setNewRoomTopic("");
  };

  const renderRoom = ({ item, index }: { item: VoiceRoom; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 80).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.roomCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
          pressed && styles.roomCardPressed,
        ]}
        onPress={() => handleJoinRoom(item)}
      >
        <View style={styles.roomHeader}>
          <View style={styles.roomHeaderLeft}>
            <View style={[styles.liveBadge, { backgroundColor: "#DC2626" }]}>
              <View style={styles.liveIndicator} />
              <ThemedText style={styles.liveText}>LIVE</ThemedText>
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + "20" }]}>
              <ThemedText style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
                {getCategoryLabel(item.category)}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.duration, { color: theme.textSecondary }]}>
            {formatDuration(item.startedAt)}
          </ThemedText>
        </View>

        <ThemedText style={[styles.roomTitle, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </ThemedText>
        <ThemedText style={[styles.roomTopic, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.topic}
        </ThemedText>

        <View style={styles.speakersRow}>
          <View style={styles.avatarStack}>
            {item.speakers.slice(0, 4).map((speaker, idx) => (
              <View
                key={speaker.id}
                style={[
                  styles.speakerAvatar,
                  { marginLeft: idx > 0 ? -12 : 0, zIndex: 10 - idx },
                  speaker.isSpeaking && styles.speakingAvatar,
                ]}
              >
                <Animated.Image
                  source={{ uri: speaker.avatar }}
                  style={styles.avatarImage}
                />
                {speaker.isSpeaking ? (
                  <View style={styles.speakingIndicator}>
                    <Feather name="mic" size={8} color="#fff" />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.speakerNames}>
            <ThemedText style={[styles.speakerNamesText, { color: theme.text }]} numberOfLines={1}>
              {item.speakers.slice(0, 2).map((s) => s.name).join(", ")}
              {item.speakers.length > 2 ? ` +${item.speakers.length - 2}` : ""}
            </ThemedText>
          </View>
        </View>

        <View style={styles.roomStats}>
          <View style={styles.statItem}>
            <Feather name="mic" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
              {item.speakersCount} স্পিকার
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather name="headphones" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
              {item.listenersCount} শ্রোতা
            </ThemedText>
          </View>
          <Pressable
            style={[styles.joinButton, { backgroundColor: "#2FA36B" }]}
            onPress={() => handleJoinRoom(item)}
          >
            <Feather name="log-in" size={14} color="#fff" />
            <ThemedText style={styles.joinText}>জয়েন করুন</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <View>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            ভয়েস রুম
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            লাইভ আলোচনায় অংশ নিন
          </ThemedText>
        </View>
        <Pressable
          style={[styles.createButton, { backgroundColor: "#2FA36B" }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowCreateModal(true);
          }}
        >
          <Feather name="plus" size={20} color="#fff" />
          <ThemedText style={styles.createButtonText}>নতুন রুম</ThemedText>
        </Pressable>
      </Animated.View>

      <Animated.ScrollView
        entering={FadeInUp.delay(100)}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {ROOM_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryChip,
              {
                backgroundColor: selectedCategory === cat.id ? "#2FA36B" : theme.card,
                borderColor: selectedCategory === cat.id ? "#2FA36B" : theme.cardBorder,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedCategory(cat.id);
            }}
          >
            <ThemedText
              style={[
                styles.categoryChipText,
                { color: selectedCategory === cat.id ? "#fff" : theme.text },
              ]}
            >
              {cat.label}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.ScrollView>

      <FlatList
        data={filteredRooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="radio" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              এই ক্যাটাগরিতে কোন রুম নেই
            </ThemedText>
          </View>
        }
      />

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                নতুন ভয়েস রুম তৈরি করুন
              </ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                রুমের নাম
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: theme.card, color: theme.text, borderColor: theme.cardBorder },
                ]}
                value={newRoomTitle}
                onChangeText={setNewRoomTitle}
                placeholder="যেমন: ধান চাষের টিপস"
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                আলোচনার বিষয়
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: theme.card, color: theme.text, borderColor: theme.cardBorder },
                ]}
                value={newRoomTopic}
                onChangeText={setNewRoomTopic}
                placeholder="বিষয় সংক্ষেপে লিখুন"
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                ক্যাটাগরি
              </ThemedText>
              <View style={styles.categoryOptions}>
                {ROOM_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      {
                        backgroundColor: newRoomCategory === cat.id ? getCategoryColor(cat.id) : theme.card,
                        borderColor: getCategoryColor(cat.id),
                      },
                    ]}
                    onPress={() => setNewRoomCategory(cat.id)}
                  >
                    <ThemedText
                      style={[
                        styles.categoryOptionText,
                        { color: newRoomCategory === cat.id ? "#fff" : theme.text },
                      ]}
                    >
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[styles.startRoomButton, { backgroundColor: "#2FA36B" }]}
              onPress={handleCreateRoom}
            >
              <Feather name="radio" size={20} color="#fff" />
              <ThemedText style={styles.startRoomText}>রুম শুরু করুন</ThemedText>
            </Pressable>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 22, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  subtitle: { fontSize: 13, marginTop: 2 },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  createButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  categoriesContainer: { flexGrow: 0, flexShrink: 0 },
  categoriesContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingVertical: Spacing.xs },
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
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  roomCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  roomCardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  roomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  roomHeaderLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  categoryText: { fontSize: 11, fontWeight: "600" },
  duration: { fontSize: 12 },
  roomTitle: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  roomTopic: { fontSize: 13, marginBottom: Spacing.md },
  speakersRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  avatarStack: { flexDirection: "row" },
  speakerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
  },
  speakingAvatar: { borderColor: "#2FA36B" },
  avatarImage: { width: "100%", height: "100%" },
  speakingIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#2FA36B",
    alignItems: "center",
    justifyContent: "center",
  },
  speakerNames: { flex: 1 },
  speakerNamesText: { fontSize: 13, fontWeight: "500" },
  roomStats: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12 },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 4,
    marginLeft: "auto",
  },
  joinText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { marginBottom: Spacing.lg },
  inputLabel: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.xs },
  textInput: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  categoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryOptionText: { fontSize: 13 },
  startRoomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  startRoomText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
