import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Modal, ScrollView } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "react-native";
import { useCommunityList, createCommunity, communityAction } from "@/lib/community";
import { isLoggedIn, timeAgo } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { tr, useTr } from "@/lib/tr";
import { shareText } from "@/lib/share";
import { CatalogFormModal } from "@/components/CatalogFormModal";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { useHeaderAddButton } from "@/components/HeaderAddButton";
import { ModalBottomInset } from "@/components/ModalBottomInset";
import { ChatIcon } from "@/components/icons/ChatIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Expert {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  verified: boolean;
}

interface Question {
  id: string;
  question: string;
  author: {
    name: string;
    initials: string;
    isWelfareMember?: boolean;
  };
  expert?: Expert;
  answer?: string;
  category: string;
  upvotes: number;
  answers: number;
  isUpvoted: boolean;
  createdAt: string;
  isLive: boolean;
  createdAtIso?: string;
  answerList?: { id: string; name: string; text: string }[];
  isMine?: boolean;
}

const CATEGORIES = ["সব", "ফসল", "মাছ", "পোল্ট্রি", "পশুপালন", "সার ও কীটনাশক", "যন্ত্রপাতি"];


const LIVE_SESSIONS: any[] = [];

export default function ExpertQAScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const { language } = useI18n();
  useTr();
  const { items: questions, reload, patch } = useCommunityList<Question & { createdAtIso?: string; answerList?: any[]; isMine?: boolean }>("questions");
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [showAskQuestion, setShowAskQuestion] = useState(false);
  useHeaderAddButton(() => setShowAskQuestion(true), "Ask a question", "help-circle");
  const [newQuestion, setNewQuestion] = useState("");
  const [questionCategory, setQuestionCategory] = useState("ফসল");

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const handleUpvote = (questionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isLoggedIn()) {
      Alert.alert(tr("Log in to upvote"));
      return;
    }
    communityAction("questions", questionId, "upvote").then(patch).catch((e) => Alert.alert(tr("ত্রুটি"), e.message));
  };

  const handleAskQuestion = async () => {
    if (!newQuestion.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isLoggedIn()) {
      Alert.alert(tr("Log in to ask a question"));
      return;
    }
    try {
      await createCommunity("questions", { question: newQuestion.trim(), category: questionCategory });
      await reload();
    } catch (e: any) {
      Alert.alert(tr("ত্রুটি"), e.message);
      return;
    }
    setNewQuestion("");
    setShowAskQuestion(false);
  };

  const filteredQuestions = questions.filter(
    (q) => selectedCategory === "সব" || q.category === selectedCategory
  );

  const renderLiveSessions = () => LIVE_SESSIONS.length === 0 ? null : (
    <View style={styles.liveSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.liveLabel}>লাইভ Q&A</ThemedText>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.liveScroll}
      >
        {LIVE_SESSIONS.map((session) => (
          <Pressable
            key={session.id}
            style={[
              styles.liveCard,
              {
                backgroundColor: session.isLive ? theme.primary : theme.card,
                borderColor: session.isLive ? theme.primary : theme.cardBorder,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("VoiceRoom", {
                roomId: session.id,
                room: {
                  title: session.title,
                  topic: `${session.expert.name} - ${session.expert.specialty}`,
                  hostName: session.expert.name,
                  participants: session.participants,
                  isLive: session.isLive,
                },
                isHost: false,
              });
            }}
          >
            <View style={styles.liveCardHeader}>
              <View
                style={[
                  styles.expertAvatar,
                  { backgroundColor: session.isLive ? "rgba(255,255,255,0.2)" : theme.primary },
                ]}
              >
                <ThemedText
                  style={[
                    styles.expertInitials,
                    { color: session.isLive ? "#FFFFFF" : "#FFFFFF" },
                  ]}
                >
                  {session.expert.initials}
                </ThemedText>
              </View>
              {session.isLive ? (
                <View style={styles.nowLiveBadge}>
                  <View style={styles.nowLiveDot} />
                  <ThemedText style={styles.nowLiveText}>LIVE</ThemedText>
                </View>
              ) : null}
            </View>

            <ThemedText
              style={[
                styles.liveTitle,
                { color: session.isLive ? "#FFFFFF" : theme.text },
              ]}
              numberOfLines={2}
            >
              {session.title}
            </ThemedText>

            <ThemedText
              style={[
                styles.expertName,
                { color: session.isLive ? "rgba(255,255,255,0.8)" : theme.textSecondary },
              ]}
            >
              {session.expert.name}
            </ThemedText>

            <View style={styles.liveCardFooter}>
              <ThemedText
                style={[
                  styles.liveTime,
                  { color: session.isLive ? "rgba(255,255,255,0.8)" : theme.textSecondary },
                ]}
              >
                {session.startTime}
              </ThemedText>
              {session.isLive ? (
                <View style={styles.participantsRow}>
                  <Feather name="users" size={12} color="rgba(255,255,255,0.8)" />
                  <ThemedText style={styles.participantsText}>
                    {session.participants}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderQuestion = ({ item }: { item: Question }) => (
    <View
      style={[
        styles.questionCard,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.questionHeader}>
        <UserAvatar
          initials={item.author.initials}
          size="medium"
          isWelfareMember={item.author.isWelfareMember}
        />
        <View style={styles.authorInfo}>
          <ThemedText style={[styles.authorName, { color: theme.text }]}>
            {item.author.name}
          </ThemedText>
          <View style={styles.metaRow}>
            <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.categoryText, { color: theme.primary }]}>
                {item.category}
              </ThemedText>
            </View>
            <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>
              {item.createdAtIso && !String(item.id).includes("-seed-") ? timeAgo(item.createdAtIso, language) : tr(item.createdAt)}
            </ThemedText>
          </View>
        </View>
        {item.isLive ? (
          <View style={styles.liveQuestionBadge}>
            <View style={styles.liveDot} />
          </View>
        ) : null}
      </View>

      <ThemedText style={[styles.questionText, { color: theme.text }]}>
        {item.question}
      </ThemedText>

      {item.answer && item.expert ? (
        <View style={[styles.answerSection, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.answerHeader}>
            <View style={[styles.expertAvatarSmall, { backgroundColor: "#2E96EF" }]}>
              <ThemedText style={styles.expertInitialsSmall}>
                {item.expert.initials}
              </ThemedText>
            </View>
            <View style={styles.expertInfo}>
              <View style={styles.expertNameRow}>
                <ThemedText style={[styles.expertNameText, { color: theme.text }]}>
                  {item.expert.name}
                </ThemedText>
                {item.expert.verified ? (
                  <View style={[styles.verifiedBadge, { backgroundColor: "#1DA1F2" }]}>
                    <Feather name="check" size={10} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <ThemedText style={[styles.expertSpecialty, { color: theme.textSecondary }]}>
                {item.expert.specialty}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.answerText, { color: theme.text }]}>
            {item.answer}
          </ThemedText>
        </View>
      ) : null}

      {(item.answerList || []).map((a: any) => (
        <View key={a.id} style={[styles.answerSection, { backgroundColor: theme.backgroundRoot }]}>
          <ThemedText style={[styles.expertNameText, { color: theme.text }]}>{a.name}</ThemedText>
          <ThemedText style={[styles.answerText, { color: theme.text }]}>{a.text}</ThemedText>
        </View>
      ))}

      <View style={[styles.actionRow, { borderTopColor: theme.inputBorder }]}>
        <Pressable
          style={styles.actionButton}
          onPress={() => handleUpvote(item.id)}
        >
          <Feather
            name="arrow-up"
            size={18}
            color={item.isUpvoted ? theme.primary : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.actionText,
              { color: item.isUpvoted ? theme.primary : theme.textSecondary },
            ]}
          >
            {item.upvotes}
          </ThemedText>
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => (isLoggedIn() ? setAnswerFor(item.id) : Alert.alert(tr("Log in to answer")))}
          accessibilityLabel={tr("Answer")}
        >
          <ChatIcon size={18} color={theme.textSecondary} />
          <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
            {item.answers} {tr("উত্তর")}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => shareText(tr("Expert Q&A"), `${item.question} (Farmers Expert Q&A)`)} accessibilityLabel={tr("Share")}>
          <Feather name="share-2" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View>
      {renderLiveSessions()}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
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
      </ScrollView>

      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
        সাম্প্রতিক প্রশ্ন
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredQuestions}
        keyExtractor={(item) => item.id}
        renderItem={renderQuestion}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl + 70,
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

      <Modal
        visible={showAskQuestion}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAskQuestion(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowAskQuestion(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                প্রশ্ন করুন
              </ThemedText>
              <Pressable onPress={() => setShowAskQuestion(false)}>
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
                আপনার প্রশ্ন
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
                placeholder="আপনার প্রশ্ন বিস্তারিত লিখুন..."
                placeholderTextColor={theme.textSecondary}
                value={newQuestion}
                onChangeText={setNewQuestion}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                ক্যাটাগরি
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categorySelectContainer}
              >
                {CATEGORIES.filter((c) => c !== "সব").map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.categorySelectChip,
                      {
                        backgroundColor:
                          questionCategory === cat ? theme.primary : theme.backgroundRoot,
                        borderColor:
                          questionCategory === cat ? theme.primary : theme.inputBorder,
                      },
                    ]}
                    onPress={() => setQuestionCategory(cat)}
                  >
                    <ThemedText
                      style={[
                        styles.categorySelectText,
                        { color: questionCategory === cat ? theme.white : theme.text },
                      ]}
                    >
                      {cat}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.primary },
                  !newQuestion.trim() && styles.buttonDisabled,
                ]}
                onPress={handleAskQuestion}
                disabled={!newQuestion.trim()}
              >
                <ThemedText style={[styles.submitButtonText, { color: theme.white }]}>
                  প্রশ্ন পাঠান
                </ThemedText>
              </Pressable>
            </ScrollView>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
      <CatalogFormModal
        visible={!!answerFor}
        title={tr("Answer")}
        fields={[{ key: "text", label: tr("Your answer"), multiline: true, required: true }]}
        submitLabel={tr("Submit")}
        onClose={() => setAnswerFor(null)}
        onSubmit={async (v) => {
          try {
            const r = await communityAction("questions", answerFor as string, "answers", { text: v.text });
            patch(r);
            setAnswerFor(null);
          } catch (e: any) {
            return e.message;
          }
        }}
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
  liveSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DA2F2F",
  },
  liveLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DA2F2F",
  },
  liveScroll: {
    gap: Spacing.md,
  },
  liveCard: {
    width: 200,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  liveCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  expertAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  expertInitials: {
    fontSize: 16,
    fontWeight: "600",
  },
  nowLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  nowLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  nowLiveText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  liveTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    lineHeight: 20,
  },
  expertName: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  liveCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveTime: {
    fontSize: 11,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  participantsText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
  },
  categoriesContainer: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  questionCard: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.lg,
    borderWidth: 1,
    ...Shadows.medium,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timeText: {
    fontSize: 12,
  },
  liveQuestionBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#DA2F2F",
    alignItems: "center",
    justifyContent: "center",
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  answerSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  expertAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  expertInitialsSmall: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  expertInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  expertNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expertNameText: {
    fontSize: 13,
    fontWeight: "600",
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  expertSpecialty: {
    fontSize: 11,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 20,
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
    maxHeight: "80%",
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
    minHeight: 100,
    marginBottom: Spacing.lg,
  },
  categorySelectContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  categorySelectChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  categorySelectText: {
    fontSize: 13,
    fontWeight: "500",
  },
  submitButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
