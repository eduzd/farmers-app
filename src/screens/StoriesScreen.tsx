import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp, FadeInRight, SlideInRight, SlideOutLeft } from "react-native-reanimated";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ModalBottomInset } from "@/components/ModalBottomInset";

const { width, height } = Dimensions.get("window");

interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  items: StoryItem[];
  hasUnread: boolean;
  isOwn: boolean;
}

interface StoryItem {
  id: string;
  type: "image" | "text";
  content: string;
  backgroundColor?: string;
  createdAt: Date;
  views: number;
}

const STORY_BACKGROUNDS = [
  "#2FA36B", "#2563EB", "#7C3AED", "#EA8A0C", "#DC2626",
  "#0D9488", "#DB2777", "#673AB7", "#FF5722", "#795548",
];

const MOCK_STORIES: Story[] = [];

export default function StoriesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const [stories] = useState<Story[]>(MOCK_STORIES);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStoryText, setNewStoryText] = useState("");
  const [selectedBg, setSelectedBg] = useState(STORY_BACKGROUNDS[0]);

  const handleStoryPress = (story: Story) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (story.isOwn && story.items.length === 0) {
      setShowCreateModal(true);
    } else if (story.items.length > 0) {
      setViewingStory(story);
      setCurrentItemIndex(0);
    }
  };

  const handleNextItem = () => {
    if (!viewingStory) return;
    if (currentItemIndex < viewingStory.items.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
    } else {
      setViewingStory(null);
      setCurrentItemIndex(0);
    }
  };

  const handlePrevItem = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(currentItemIndex - 1);
    }
  };

  const handleCreateStory = () => {
    if (!newStoryText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCreateModal(false);
    setNewStoryText("");
  };

  const formatTimeAgo = (date: Date) => {
    const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
    if (hours < 1) return "এইমাত্র";
    return `${hours} ঘণ্টা আগে`;
  };

  const renderStoryItem = ({ item, index }: { item: Story; index: number }) => (
    <Animated.View entering={FadeInRight.delay(index * 50)}>
      <Pressable
        style={styles.storyItem}
        onPress={() => handleStoryPress(item)}
      >
        <View
          style={[
            styles.storyAvatarRing,
            item.hasUnread && styles.storyUnreadRing,
            item.isOwn && !item.items.length && styles.storyOwnRing,
          ]}
        >
          <Image source={{ uri: item.userAvatar }} style={styles.storyAvatar} />
          {item.isOwn && !item.items.length ? (
            <View style={[styles.addBadge, { backgroundColor: theme.primary }]}>
              <Feather name="plus" size={12} color="#fff" />
            </View>
          ) : null}
        </View>
        <ThemedText
          style={[styles.storyUserName, { color: theme.text }]}
          numberOfLines={1}
        >
          {item.isOwn ? "আপনি" : item.userName.split(" ")[0]}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>স্টোরি</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          ২৪ ঘণ্টার মধ্যে আপডেট শেয়ার করুন
        </ThemedText>
      </Animated.View>

      <FlatList
        data={stories}
        keyExtractor={(item) => item.id}
        renderItem={renderStoryItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesList}
        style={styles.storiesContainer}
      />

      <Animated.View entering={FadeInUp.delay(200)} style={styles.recentSection}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          সাম্প্রতিক স্টোরি
        </ThemedText>
        <ScrollView showsVerticalScrollIndicator={false}>
          {stories.filter(s => !s.isOwn && s.items.length > 0).map((story, index) => (
            <Animated.View key={story.id} entering={FadeInUp.delay(250 + index * 50)}>
              <Pressable
                style={[styles.recentItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                onPress={() => handleStoryPress(story)}
              >
                <View style={[styles.recentAvatarRing, story.hasUnread && styles.storyUnreadRing]}>
                  <Image source={{ uri: story.userAvatar }} style={styles.recentAvatar} />
                </View>
                <View style={styles.recentInfo}>
                  <ThemedText style={[styles.recentName, { color: theme.text }]}>
                    {story.userName}
                  </ThemedText>
                  <ThemedText style={[styles.recentTime, { color: theme.textSecondary }]}>
                    {formatTimeAgo(story.items[0].createdAt)} • {story.items.length} টি স্টোরি
                  </ThemedText>
                </View>
                <View style={styles.recentPreview}>
                  {story.items[0].type === "image" ? (
                    <Image source={{ uri: story.items[0].content }} style={styles.previewImage} />
                  ) : (
                    <View style={[styles.previewText, { backgroundColor: story.items[0].backgroundColor }]}>
                      <Feather name="type" size={16} color="#fff" />
                    </View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>

      <Pressable
        style={[styles.createButton, { backgroundColor: theme.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowCreateModal(true);
        }}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <Modal visible={viewingStory !== null} animationType="fade" statusBarTranslucent>
        {viewingStory ? (
          <View style={styles.storyViewer}>
            <View style={styles.storyProgress}>
              {viewingStory.items.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.progressBar,
                    { backgroundColor: idx <= currentItemIndex ? "#fff" : "rgba(255,255,255,0.3)" },
                  ]}
                />
              ))}
            </View>

            <View style={[styles.storyHeader, { paddingTop: insets.top + Spacing.sm }]}>
              <Image source={{ uri: viewingStory.userAvatar }} style={styles.viewerAvatar} />
              <View style={styles.viewerInfo}>
                <ThemedText style={styles.viewerName}>{viewingStory.userName}</ThemedText>
                <ThemedText style={styles.viewerTime}>
                  {formatTimeAgo(viewingStory.items[currentItemIndex].createdAt)}
                </ThemedText>
              </View>
              <Pressable onPress={() => setViewingStory(null)}>
                <Feather name="x" size={28} color="#fff" />
              </Pressable>
            </View>

            <Pressable style={styles.storyTapLeft} onPress={handlePrevItem} />
            <Pressable style={styles.storyTapRight} onPress={handleNextItem} />

            {viewingStory.items[currentItemIndex].type === "image" ? (
              <Image
                source={{ uri: viewingStory.items[currentItemIndex].content }}
                style={styles.storyImage}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.storyTextContent,
                  { backgroundColor: viewingStory.items[currentItemIndex].backgroundColor },
                ]}
              >
                <ThemedText style={styles.storyText}>
                  {viewingStory.items[currentItemIndex].content}
                </ThemedText>
              </View>
            )}

            <View style={[styles.storyFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
              <View style={styles.viewsCount}>
                <Feather name="eye" size={16} color="#fff" />
                <ThemedText style={styles.viewsText}>
                  {viewingStory.items[currentItemIndex].views} জন দেখেছেন
                </ThemedText>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.createModalOverlay}>
          <View style={[styles.createModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.createModalHeader}>
              <ThemedText style={[styles.createModalTitle, { color: theme.text }]}>
                নতুন স্টোরি তৈরি করুন
              </ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.storyPreview, { backgroundColor: selectedBg }]}>
              <TextInput
                style={styles.storyInput}
                value={newStoryText}
                onChangeText={setNewStoryText}
                placeholder="আপনার স্টোরি লিখুন..."
                placeholderTextColor="rgba(255,255,255,0.7)"
                multiline
                textAlignVertical="center"
                textAlign="center"
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bgPicker}>
              {STORY_BACKGROUNDS.map((bg) => (
                <Pressable
                  key={bg}
                  style={[
                    styles.bgOption,
                    { backgroundColor: bg },
                    selectedBg === bg && styles.bgOptionSelected,
                  ]}
                  onPress={() => setSelectedBg(bg)}
                />
              ))}
            </ScrollView>

            <Pressable
              style={[styles.shareButton, { backgroundColor: theme.primary }]}
              onPress={handleCreateStory}
            >
              <Feather name="send" size={20} color="#fff" />
              <ThemedText style={styles.shareButtonText}>শেয়ার করুন</ThemedText>
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
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  storiesContainer: { maxHeight: 120 },
  storiesList: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  storyItem: { alignItems: "center", width: 70 },
  storyAvatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "#ccc",
    padding: 2,
  },
  storyUnreadRing: { borderColor: "#2FA36B" },
  storyOwnRing: { borderColor: "#ddd", borderStyle: "dashed" },
  storyAvatar: { width: "100%", height: "100%", borderRadius: 30 },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  storyUserName: { fontSize: 11, marginTop: 4, textAlign: "center" },
  recentSection: { flex: 1, paddingHorizontal: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.md },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  recentAvatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#ccc",
    padding: 2,
  },
  recentAvatar: { width: "100%", height: "100%", borderRadius: 22 },
  recentInfo: { flex: 1, marginLeft: Spacing.md },
  recentName: { fontSize: 15, fontWeight: "600" },
  recentTime: { fontSize: 12, marginTop: 2 },
  recentPreview: { width: 50, height: 50, borderRadius: BorderRadius.md, overflow: "hidden" },
  previewImage: { width: "100%", height: "100%" },
  previewText: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  createButton: {
    position: "absolute",
    bottom: 100,
    right: Spacing.lg,
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
  storyViewer: { flex: 1, backgroundColor: "#000" },
  storyProgress: { flexDirection: "row", gap: 4, paddingHorizontal: Spacing.md, paddingTop: 50 },
  progressBar: { flex: 1, height: 3, borderRadius: 2 },
  storyHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  viewerAvatar: { width: 40, height: 40, borderRadius: 20 },
  viewerInfo: { flex: 1, marginLeft: Spacing.sm },
  viewerName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  viewerTime: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  storyTapLeft: { position: "absolute", left: 0, top: 100, bottom: 100, width: width * 0.3 },
  storyTapRight: { position: "absolute", right: 0, top: 100, bottom: 100, width: width * 0.7 },
  storyImage: { ...StyleSheet.absoluteFillObject },
  storyTextContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  storyText: { color: "#fff", fontSize: 24, fontWeight: "600", textAlign: "center", lineHeight: 36 },
  storyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  viewsCount: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  viewsText: { color: "#fff", fontSize: 13 },
  createModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  createModalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  createModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  createModalTitle: { fontSize: 18, fontWeight: "700" },
  storyPreview: { height: 300, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg, justifyContent: "center" },
  storyInput: { color: "#fff", fontSize: 20, fontWeight: "600", textAlign: "center", padding: Spacing.lg },
  bgPicker: { marginBottom: Spacing.lg },
  bgOption: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.sm },
  bgOptionSelected: { borderWidth: 3, borderColor: "#fff" },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  shareButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
