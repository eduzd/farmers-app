import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface Tip {
  id: string;
  title: string;
  content: string;
  category: string;
  categoryColor: string;
  image?: string;
  author: string;
  date: string;
  likes: number;
  isLiked: boolean;
  isSaved: boolean;
}

const CATEGORIES = ["সব", "ফসল", "মাছ", "পোল্ট্রি", "সবজি", "আবহাওয়া", "বাজার"];

const TIPS: Tip[] = [
  {
    id: "1",
    title: "ধান ক্ষেতে সেচ দেওয়ার সঠিক সময়",
    content: "বোরো মৌসুমে সেচ দেওয়ার সেরা সময় হলো সকাল ৬-৮টা বা বিকাল ৪-৬টা। এ সময় পানির বাষ্পীভবন কম হয় এবং গাছ বেশি পানি শোষণ করতে পারে।",
    category: "ফসল",
    categoryColor: "#2FA36B",
    image: "https://images.unsplash.com/photo-1536617621572-1d5f1e6269a0?w=600",
    author: "কৃষি পরামর্শ",
    date: "আজ",
    likes: 0,
    isLiked: false,
    isSaved: false,
  },
  {
    id: "2",
    title: "মাছের পুকুরে অক্সিজেন বাড়ানোর উপায়",
    content: "গরমের দিনে পুকুরে অক্সিজেন কমে যায়। এয়ারেটর ব্যবহার করুন বা সকাল-সন্ধ্যায় পানিতে লাঠি দিয়ে নাড়াচাড়া করুন। এতে পানিতে বাতাস মিশবে।",
    category: "মাছ",
    categoryColor: "#2563EB",
    author: "কৃষি পরামর্শ",
    date: "গতকাল",
    likes: 0,
    isLiked: true,
    isSaved: true,
  },
  {
    id: "3",
    title: "মুরগির গরমকালীন যত্ন",
    content: "গরমে মুরগির খামারে পর্যাপ্ত বাতাস চলাচল নিশ্চিত করুন। পানিতে ভিটামিন-সি মিশান। দুপুরে খাবার দেওয়া থেকে বিরত থাকুন।",
    category: "পোল্ট্রি",
    categoryColor: "#EA8A0C",
    author: "কৃষি পরামর্শ",
    date: "২ দিন আগে",
    likes: 0,
    isLiked: false,
    isSaved: false,
  },
  {
    id: "4",
    title: "টমেটোর ফল ঝরে পড়া রোধ",
    content: "টমেটো গাছে ফুল আসলে বোরণ স্প্রে করুন। এতে ফল ঝরে পড়া কমবে এবং ফলের আকার বড় হবে। প্রতি লিটার পানিতে ১ গ্রাম বোরিক এসিড মেশান।",
    category: "সবজি",
    categoryColor: "#65A30D",
    image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600",
    author: "কৃষি পরামর্শ",
    date: "৩ দিন আগে",
    likes: 0,
    isLiked: false,
    isSaved: true,
  },
  {
    id: "5",
    title: "আগামী সপ্তাহে বৃষ্টির সম্ভাবনা",
    content: "আবহাওয়া দপ্তরের পূর্বাভাস অনুযায়ী আগামী সপ্তাহে হালকা থেকে মাঝারি বৃষ্টি হতে পারে। ফসল কাটা বা মাড়াই এর কাজ এই সপ্তাহেই শেষ করুন।",
    category: "আবহাওয়া",
    categoryColor: "#03A9F4",
    author: "কৃষি পরামর্শ",
    date: "আজ",
    likes: 0,
    isLiked: true,
    isSaved: false,
  },
  {
    id: "6",
    title: "এই সপ্তাহে সবজির দাম বাড়তে পারে",
    content: "বন্যার কারণে উত্তরাঞ্চলে সবজি উৎপাদন কমেছে। আগামী ২-৩ সপ্তাহে টমেটো, আলু, পেঁয়াজের দাম ১০-১৫% বাড়তে পারে।",
    category: "বাজার",
    categoryColor: "#7C3AED",
    author: "কৃষি পরামর্শ",
    date: "গতকাল",
    likes: 0,
    isLiked: false,
    isSaved: false,
  },
];

export default function DailyTipsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [tips, setTips] = useState<Tip[]>(TIPS);
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleLike = (tipId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTips((prev) =>
      prev.map((tip) =>
        tip.id === tipId
          ? {
              ...tip,
              isLiked: !tip.isLiked,
              likes: tip.isLiked ? tip.likes - 1 : tip.likes + 1,
            }
          : tip
      )
    );
  };

  const handleSave = (tipId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTips((prev) =>
      prev.map((tip) =>
        tip.id === tipId ? { ...tip, isSaved: !tip.isSaved } : tip
      )
    );
  };

  const handleShare = async (tip: Tip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `${tip.title}\n\n${tip.content}\n\n- ${tip.author}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const filteredTips = tips.filter(
    (tip) => selectedCategory === "সব" || tip.category === selectedCategory
  );

  const renderTip = ({ item, index }: { item: Tip; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <View
        style={[
          styles.tipCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
        ]}
      >
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={styles.tipImage}
            contentFit="cover"
            transition={200}
          />
        ) : null}

        <View style={styles.tipContent}>
          <View style={styles.tipHeader}>
            <View
              style={[styles.categoryBadge, { backgroundColor: item.categoryColor + "15" }]}
            >
              <ThemedText style={[styles.categoryText, { color: item.categoryColor }]}>
                {item.category}
              </ThemedText>
            </View>
            <ThemedText style={[styles.dateText, { color: theme.textSecondary }]}>
              {item.date}
            </ThemedText>
          </View>

          <ThemedText style={[styles.tipTitle, { color: theme.text }]}>
            {item.title}
          </ThemedText>

          <ThemedText
            style={[styles.tipText, { color: theme.textSecondary }]}
            numberOfLines={3}
          >
            {item.content}
          </ThemedText>

          <View style={styles.authorRow}>
            <View style={[styles.authorAvatar, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.authorInitial}>
                {item.author.charAt(0)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.authorName, { color: theme.text }]}>
              {item.author}
            </ThemedText>
          </View>

          <View style={[styles.actionRow, { borderTopColor: theme.inputBorder }]}>
            <Pressable style={styles.actionButton} onPress={() => handleLike(item.id)}>
              <Feather
                name="heart"
                size={18}
                color={item.isLiked ? "#DC2626" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.actionText,
                  { color: item.isLiked ? "#DC2626" : theme.textSecondary },
                ]}
              >
                {item.likes}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={() => handleSave(item.id)}>
              <Feather
                name={item.isSaved ? "bookmark" : "bookmark"}
                size={18}
                color={item.isSaved ? theme.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.actionText,
                  { color: item.isSaved ? theme.primary : theme.textSecondary },
                ]}
              >
                {item.isSaved ? "সেভড" : "সেভ"}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={() => handleShare(item)}>
              <Feather name="share-2" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
                শেয়ার
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderHeader = () => (
    <View>
      <View style={[styles.todayCard, { backgroundColor: theme.primary }]}>
        <Feather name="sun" size={28} color="#F5B700" />
        <View style={styles.todayContent}>
          <ThemedText style={styles.todayTitle}>আজকের কৃষি টিপস</ThemedText>
          <ThemedText style={styles.todaySubtitle}>
            প্রতিদিন নতুন কিছু শিখুন
          </ThemedText>
        </View>
        <View style={[styles.newBadge, { backgroundColor: "#F5B700" }]}>
          <ThemedText style={styles.newText}>NEW</ThemedText>
        </View>
      </View>

      <View style={styles.categoriesContainer}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.categoryChip,
              {
                backgroundColor: selectedCategory === cat ? theme.primary : theme.backgroundRoot,
                borderColor: selectedCategory === cat ? theme.primary : theme.inputBorder,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedCategory(cat);
            }}
          >
            <ThemedText
              style={[
                styles.categoryChipText,
                { color: selectedCategory === cat ? theme.white : theme.text },
              ]}
            >
              {cat}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredTips}
        keyExtractor={(item) => item.id}
        renderItem={renderTip}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  },
  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.lg,
  },
  todayContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  todayTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  todaySubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 2,
  },
  newBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  newText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "700",
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tipCard: {
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.medium,
  },
  tipImage: {
    width: "100%",
    height: 160,
  },
  tipContent: {
    padding: Spacing.lg,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 12,
  },
  tipTitle: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: Spacing.md,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  authorInitial: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  authorName: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: Spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    gap: Spacing["2xl"],
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  separator: {
    height: Spacing.md,
  },
});
