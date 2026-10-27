import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Modal, ScrollView, Alert } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { useCommunityList, createCommunity, communityAction } from "@/lib/community";
import { tr, useTr } from "@/lib/tr";
import { isLoggedIn, timeAgo } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { useHeaderAddButton } from "@/components/HeaderAddButton";
import { ModalBottomInset } from "@/components/ModalBottomInset";
interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  author: {
    name: string;
    initials: string;
    isWelfareMember?: boolean;
  };
  totalVotes: number;
  votedOptionId: string | null;
  endsAt: string;
  createdAt: string;
  isActive: boolean;
}


function AnimatedProgressBar({ 
  percentage, 
  isVoted,
  theme,
}: { 
  percentage: number;
  isVoted: boolean;
  theme: any;
}) {
  const width = useSharedValue(0);

  React.useEffect(() => {
    width.value = withSpring(percentage, { damping: 15, stiffness: 100 });
  }, [percentage]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={[styles.progressBarBg, { backgroundColor: theme.inputBorder }]}>
      <Animated.View
        style={[
          styles.progressBarFill,
          { backgroundColor: isVoted ? theme.primary : theme.primary + "60" },
          animatedStyle,
        ]}
      />
    </View>
  );
}

export default function PollsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const { language } = useI18n();
  useTr();
  const { items: polls, reload, patch } = useCommunityList<Poll & { createdAtIso?: string }>("polls");
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  useHeaderAddButton(() => setShowCreatePoll(true), "New poll");
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", ""]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const handleVote = (pollId: string, optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const poll = polls.find((p) => p.id === pollId);
    if (!poll || poll.votedOptionId || !poll.isActive) return;
    if (!isLoggedIn()) {
      Alert.alert(tr("Log in to vote"));
      return;
    }
    communityAction("polls", pollId, "vote", { optionId })
      .then(patch)
      .catch((e) => Alert.alert(tr("ত্রুটি"), e.message));
  };

  const handleAddOption = () => {
    if (newOptions.length < 6) {
      setNewOptions([...newOptions, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (newOptions.length > 2) {
      setNewOptions(newOptions.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, text: string) => {
    const updated = [...newOptions];
    updated[index] = text;
    setNewOptions(updated);
  };

  const handleCreatePoll = async () => {
    if (!newQuestion.trim()) {
      Alert.alert(tr("ত্রুটি"), tr("প্রশ্ন লিখুন"));
      return;
    }

    const validOptions = newOptions.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      Alert.alert(tr("ত্রুটি"), tr("কমপক্ষে ২টি অপশন দিন"));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isLoggedIn()) {
      Alert.alert(tr("Log in to create a poll"));
      return;
    }
    try {
      await createCommunity("polls", {
        question: newQuestion.trim(),
        options: validOptions.map((o) => o.trim()),
        endsAt: language === "en" ? "7 days left" : "৭ দিন বাকি",
      });
      await reload();
    } catch (e: any) {
      Alert.alert(tr("ত্রুটি"), e.message);
      return;
    }
    setNewQuestion("");
    setNewOptions(["", "", ""]);
    setShowCreatePoll(false);
  };

  const renderPoll = ({ item }: { item: Poll }) => {
    const hasVoted = item.votedOptionId !== null;

    return (
      <View
        style={[
          styles.pollCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
        ]}
      >
        <View style={styles.pollHeader}>
          <UserAvatar
            initials={item.author.initials}
            size="medium"
            isWelfareMember={item.author.isWelfareMember}
          />
          <View style={styles.authorInfo}>
            <ThemedText style={[styles.authorName, { color: theme.text }]}>
              {item.author.name}
            </ThemedText>
            <ThemedText style={[styles.pollTime, { color: theme.textSecondary }]}>
              {(item as any).createdAtIso && !String((item as any).id).includes("-seed-") ? timeAgo((item as any).createdAtIso, language) : tr(item.createdAt)}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: item.isActive
                  ? theme.primary + "20"
                  : theme.textSecondary + "20",
              },
            ]}
          >
            <ThemedText
              style={[
                styles.statusText,
                { color: item.isActive ? theme.primary : theme.textSecondary },
              ]}
            >
              {tr(item.endsAt)}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.question, { color: theme.text }]}>
          {item.question}
        </ThemedText>

        <View style={styles.optionsContainer}>
          {item.options.map((option) => {
            const percentage =
              item.totalVotes > 0
                ? Math.round((option.votes / item.totalVotes) * 100)
                : 0;
            const isSelected = item.votedOptionId === option.id;

            return (
              <Pressable
                key={option.id}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: isSelected
                      ? theme.primary + "15"
                      : theme.backgroundRoot,
                    borderColor: isSelected ? theme.primary : theme.inputBorder,
                  },
                ]}
                onPress={() => handleVote(item.id, option.id)}
                disabled={hasVoted || !item.isActive}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor: isSelected ? theme.primary : theme.inputBorder,
                        },
                      ]}
                    >
                      {isSelected ? (
                        <View
                          style={[styles.radioInner, { backgroundColor: theme.primary }]}
                        />
                      ) : null}
                    </View>
                    <ThemedText
                      style={[
                        styles.optionText,
                        { color: theme.text, fontWeight: isSelected ? "600" : "400" },
                      ]}
                    >
                      {option.text}
                    </ThemedText>
                  </View>
                  {hasVoted ? (
                    <ThemedText
                      style={[
                        styles.percentageText,
                        { color: isSelected ? theme.primary : theme.textSecondary },
                      ]}
                    >
                      {percentage}%
                    </ThemedText>
                  ) : null}
                </View>
                {hasVoted ? (
                  <AnimatedProgressBar
                    percentage={percentage}
                    isVoted={isSelected}
                    theme={theme}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.pollFooter}>
          <View style={styles.footerLeft}>
            <Feather name="users" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.voteCount, { color: theme.textSecondary }]}>
              {item.totalVotes} ভোট
            </ThemedText>
          </View>
          <Pressable style={styles.shareButton}>
            <Feather name="share-2" size={16} color={theme.primary} />
            <ThemedText style={[styles.shareText, { color: theme.primary }]}>
              শেয়ার
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={polls}
        keyExtractor={(item) => item.id}
        renderItem={renderPoll}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="bar-chart-2" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              কোনো পোল নেই
            </ThemedText>
          </View>
        }
      />

      <Modal
        visible={showCreatePoll}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreatePoll(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCreatePoll(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                নতুন পোল তৈরি
              </ThemedText>
              <Pressable onPress={() => setShowCreatePoll(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: Spacing.xl },
              ]}
            >
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                প্রশ্ন
              </ThemedText>
              <TextInput
                style={[
                  styles.questionInput,
                  {
                    backgroundColor: theme.backgroundRoot,
                    color: theme.text,
                    borderColor: theme.inputBorder,
                  },
                ]}
                placeholder="আপনার প্রশ্ন লিখুন..."
                placeholderTextColor={theme.textSecondary}
                value={newQuestion}
                onChangeText={setNewQuestion}
                multiline
              />

              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                অপশন
              </ThemedText>
              {newOptions.map((option, index) => (
                <View key={index} style={styles.optionInputRow}>
                  <TextInput
                    style={[
                      styles.optionInput,
                      {
                        backgroundColor: theme.backgroundRoot,
                        color: theme.text,
                        borderColor: theme.inputBorder,
                      },
                    ]}
                    placeholder={`অপশন ${index + 1}`}
                    placeholderTextColor={theme.textSecondary}
                    value={option}
                    onChangeText={(text) => handleOptionChange(index, text)}
                  />
                  {newOptions.length > 2 ? (
                    <Pressable
                      style={[styles.removeOptionBtn, { backgroundColor: "#DA2F2F20" }]}
                      onPress={() => handleRemoveOption(index)}
                    >
                      <Feather name="minus" size={18} color="#DA2F2F" />
                    </Pressable>
                  ) : null}
                </View>
              ))}

              {newOptions.length < 6 ? (
                <Pressable
                  style={[styles.addOptionBtn, { borderColor: theme.primary }]}
                  onPress={handleAddOption}
                >
                  <Feather name="plus" size={18} color={theme.primary} />
                  <ThemedText style={[styles.addOptionText, { color: theme.primary }]}>
                    অপশন যোগ করুন
                  </ThemedText>
                </Pressable>
              ) : null}

              <Pressable
                style={[styles.createButton, { backgroundColor: theme.primary }]}
                onPress={handleCreatePoll}
              >
                <ThemedText style={[styles.createButtonText, { color: theme.buttonText }]}>
                  পোল তৈরি করুন
                </ThemedText>
              </Pressable>
            </ScrollView>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
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
  pollCard: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.lg,
    borderWidth: 1,
    ...Shadows.medium,
  },
  pollHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  authorInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
  },
  pollTime: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  question: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.xs,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  pollFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  voteCount: {
    fontSize: 13,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  shareText: {
    fontSize: 13,
    fontWeight: "500",
  },
  separator: {
    height: Spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.medium,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing["2xl"],
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  questionInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: Spacing.xl,
  },
  optionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  removeOptionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  createButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
