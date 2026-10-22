import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ModalBottomInset } from "@/components/ModalBottomInset";

import { EmptyState } from "@/components/ui";
const { width } = Dimensions.get("window");

interface LiveStream {
  id: string;
  title: string;
  streamer: {
    name: string;
    avatar: string;
    isVerified: boolean;
  };
  thumbnail: string;
  viewers: number;
  category: string;
  isLive: boolean;
  startedAt?: string;
  scheduledFor?: string;
}

const CATEGORIES = ["সব", "ফসল চাষ", "মাছ চাষ", "পশুপালন", "প্রশিক্ষণ", "Q&A"];

const MOCK_STREAMS: LiveStream[] = [];

export default function LiveStreamScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");

  const liveStreams = MOCK_STREAMS.filter(s => s.isLive);
  const upcomingStreams = MOCK_STREAMS.filter(s => !s.isLive);

  const filteredLive = selectedCategory === "সব" 
    ? liveStreams 
    : liveStreams.filter(s => s.category === selectedCategory);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleStreamPress = (stream: LiveStream) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("VoiceRoom", {
      roomId: stream.id,
      room: { title: stream.title, topic: stream.category },
      isHost: false,
    });
  };

  const renderLiveStream = ({ item, index }: { item: LiveStream; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <Pressable
        style={[styles.streamCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleStreamPress(item)}
      >
        <View style={styles.thumbnailContainer}>
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.thumbnailGradient} />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveText}>LIVE</ThemedText>
          </View>
          <View style={styles.viewersBadge}>
            <Feather name="eye" size={12} color="#fff" />
            <ThemedText style={styles.viewersText}>{item.viewers}</ThemedText>
          </View>
          <View style={styles.thumbnailInfo}>
            <ThemedText style={styles.streamTitle} numberOfLines={2}>{item.title}</ThemedText>
          </View>
        </View>
        <View style={styles.streamFooter}>
          <Image source={{ uri: item.streamer.avatar }} style={styles.streamerAvatar} />
          <View style={styles.streamerInfo}>
            <View style={styles.streamerNameRow}>
              <ThemedText style={[styles.streamerName, { color: theme.text }]}>{item.streamer.name}</ThemedText>
              {item.streamer.isVerified ? <Feather name="check-circle" size={12} color="#2FA36B" /> : null}
            </View>
            <ThemedText style={[styles.categoryText, { color: theme.textSecondary }]}>{item.category}</ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderUpcoming = ({ item, index }: { item: LiveStream; index: number }) => (
    <Animated.View entering={FadeInUp.delay(100 + index * 50)}>
      <Pressable style={[styles.upcomingCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Image source={{ uri: item.thumbnail }} style={styles.upcomingThumbnail} contentFit="cover" />
        <View style={styles.upcomingInfo}>
          <ThemedText style={[styles.upcomingTitle, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </ThemedText>
          <View style={styles.upcomingMeta}>
            <Image source={{ uri: item.streamer.avatar }} style={styles.upcomingAvatar} />
            <ThemedText style={[styles.upcomingStreamer, { color: theme.textSecondary }]}>
              {item.streamer.name}
            </ThemedText>
          </View>
          <View style={[styles.scheduleBadge, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="clock" size={12} color={theme.primary} />
            <ThemedText style={[styles.scheduleText, { color: theme.primary }]}>{item.scheduledFor}</ThemedText>
          </View>
        </View>
        <Pressable style={[styles.remindButton, { backgroundColor: theme.primary }]}>
          <Feather name="bell" size={16} color="#fff" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>লাইভ স্ট্রিম</ThemedText>
        <Pressable
          style={[styles.goLiveButton, { backgroundColor: "#DC2626" }]}
          onPress={() => setShowGoLive(true)}
        >
          <Feather name="video" size={16} color="#fff" />
          <ThemedText style={styles.goLiveText}>Go Live</ThemedText>
        </Pressable>
      </Animated.View>

      <Animated.ScrollView
        entering={FadeInUp.delay(50)}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            style={[
              styles.categoryChip,
              { backgroundColor: selectedCategory === cat ? theme.primary : theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <ThemedText style={[styles.categoryChipText, { color: selectedCategory === cat ? "#fff" : theme.text }]}>
              {cat}
            </ThemedText>
          </Pressable>
        ))}
      </Animated.ScrollView>

      <FlatList
        data={filteredLive}
        keyExtractor={item => item.id}
        renderItem={renderLiveStream}
        numColumns={2}
        columnWrapperStyle={styles.streamRow}
        ListHeaderComponent={
          filteredLive.length > 0 ? (
            <View style={styles.sectionHeader}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveIndicatorDot} />
              </View>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>এখন লাইভ</ThemedText>
              <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
                ({filteredLive.length})
              </ThemedText>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={16} color={theme.primary} />
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>আসন্ন লাইভ</ThemedText>
            </View>
            {upcomingStreams.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {upcomingStreams.map((stream, index) => renderUpcoming({ item: stream, index }))}
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyLive}>
            <Feather name="video-off" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              এই ক্যাটেগরিতে কোন লাইভ নেই
            </ThemedText>
          </View>
        }
      />

      <Modal visible={showGoLive} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>লাইভ শুরু করুন</ThemedText>
              <Pressable onPress={() => setShowGoLive(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.cardBorder }]}
              placeholder="লাইভের শিরোনাম..."
              placeholderTextColor={theme.textSecondary}
              value={streamTitle}
              onChangeText={setStreamTitle}
            />
            <View style={styles.categorySelect}>
              {["ফসল চাষ", "মাছ চাষ", "পশুপালন"].map(cat => (
                <Pressable key={cat} style={[styles.catOption, { backgroundColor: theme.card, borderColor: theme.primary }]}>
                  <ThemedText style={[styles.catOptionText, { color: theme.text }]}>{cat}</ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.startLiveButton, { backgroundColor: "#DC2626" }]}>
              <Feather name="video" size={20} color="#fff" />
              <ThemedText style={styles.startLiveText}>লাইভ শুরু করুন</ThemedText>
            </Pressable>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const cardWidth = (width - Spacing.lg * 3) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  goLiveButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: Spacing.xs },
  goLiveText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  categoriesScroll: { flexGrow: 0, flexShrink: 0 },
  categoriesContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  categoryChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
 },
  categoryChipText: { fontSize: 13, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md, marginTop: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  sectionCount: { fontSize: 14 },
  liveIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center" },
  liveIndicatorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  streamRow: { justifyContent: "space-between", marginBottom: Spacing.md },
  streamCard: { width: cardWidth, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  thumbnailContainer: { position: "relative", height: 100 },
  thumbnail: { width: "100%", height: "100%" },
  thumbnailGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 60 },
  liveBadge: { position: "absolute", top: Spacing.sm, left: Spacing.sm, flexDirection: "row", alignItems: "center", backgroundColor: "#DC2626", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  viewersBadge: { position: "absolute", top: Spacing.sm, right: Spacing.sm, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  viewersText: { color: "#fff", fontSize: 10 },
  thumbnailInfo: { position: "absolute", bottom: Spacing.sm, left: Spacing.sm, right: Spacing.sm },
  streamTitle: { color: "#fff", fontSize: 12, fontWeight: "600", lineHeight: 16 },
  streamFooter: { flexDirection: "row", padding: Spacing.sm, alignItems: "center" },
  streamerAvatar: { width: 28, height: 28, borderRadius: 14 },
  streamerInfo: { flex: 1, marginLeft: Spacing.xs },
  streamerNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  streamerName: { fontSize: 12, fontWeight: "500" },
  categoryText: { fontSize: 10 },
  upcomingCard: { flexDirection: "row", borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.sm, marginBottom: Spacing.sm },
  upcomingThumbnail: { width: 80, height: 60, borderRadius: BorderRadius.md },
  upcomingInfo: { flex: 1, marginLeft: Spacing.sm },
  upcomingTitle: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  upcomingMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 4 },
  upcomingAvatar: { width: 16, height: 16, borderRadius: 8 },
  upcomingStreamer: { fontSize: 11 },
  scheduleBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  scheduleText: { fontSize: 10, fontWeight: "500" },
  remindButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  emptyLive: { alignItems: "center", paddingVertical: Spacing.xl },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  input: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, fontSize: 15, marginBottom: Spacing.md },
  categorySelect: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  catOption: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center" },
  catOptionText: { fontSize: 12 },
  startLiveButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm },
  startLiveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
