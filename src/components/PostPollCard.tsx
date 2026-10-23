import React, { useState } from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { create } from "zustand";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, FontFamily } from "@/constants/theme";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import { PostPoll, voteServerPoll } from "@/lib/feedApi";

/**
 * The latest copy of each poll after someone votes, by post id, so the feed card and the
 * post page show the same counts without reloading.
 */
export const usePollStore = create<{ polls: Record<string, PostPoll>; setPoll: (postId: string, poll: PostPoll) => void }>((set) => ({
  polls: {},
  setPoll: (postId, poll) => set((s) => ({ polls: { ...s.polls, [postId]: poll } })),
}));

const toBn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
/** "A", "B", "C" ... in English; "ক", "খ", "গ" ... in Bangla. */
const BN_LETTERS = ["ক", "খ", "গ", "ঘ", "ঙ", "চ", "ছ", "জ"];
export const pollLetter = (i: number, bn: boolean) => (bn ? BN_LETTERS[i] ?? String(i + 1) : String.fromCharCode(65 + i));

function votesLabel(n: number, bn: boolean) {
  if (bn) return `${toBn(n)} ভোট`;
  return n === 1 ? "1 vote" : `${n} votes`;
}

/**
 * A poll inside a community post: the title, radio buttons for the options, and the results
 * (how many people voted for A, B, C ...). Voting again moves your vote to the new option.
 */
export function PostPollCard({
  postId,
  poll: initial,
  canVote = true,
  style,
}: {
  postId: string;
  poll: PostPoll;
  /** false for a post that is only on this phone (nothing on the server to vote on) */
  canVote?: boolean;
  style?: any;
}) {
  const { theme } = useTheme();
  const { language } = useI18n();
  const bn = language === "bn";
  const getToken = useAuthStore((s) => s.getToken);
  const stored = usePollStore((s) => s.polls[postId]);
  const setPoll = usePollStore((s) => s.setPoll);
  const poll = stored ?? initial;

  const [picked, setPicked] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [peek, setPeek] = useState(false);

  const voted = !!poll.myVote;
  const showResults = voted || peek;
  const total = poll.totalVotes;

  const sendVote = async (optionId: string) => {
    if (!canVote) return;
    const token = getToken();
    if (!token) {
      Alert.alert(bn ? "সাইন ইন করুন" : "Sign in", bn ? "ভোট দিতে আগে সাইন ইন করুন।" : "Sign in to vote.");
      return;
    }
    if (optionId === poll.myVote || voting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVoting(true);
    try {
      const fresh = await voteServerPoll(token, postId, optionId);
      setPoll(postId, fresh);
      setPicked(null);
      setPeek(false);
    } catch (e) {
      Alert.alert(
        bn ? "ভোট হয়নি" : "Couldn't vote",
        e instanceof Error && e.message && !/^vote( \d+)?$/.test(e.message)
          ? e.message
          : bn ? "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।" : "Check your internet and try again.",
      );
    } finally {
      setVoting(false);
    }
  };

  const onOptionPress = (optionId: string) => {
    if (voted) {
      // Already voted: tapping another option moves the vote there.
      void sendVote(optionId);
      return;
    }
    Haptics.selectionAsync();
    setPeek(false);
    setPicked(optionId);
  };

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.backgroundSecondary }, style]}
      testID="post-poll"
      // Taps inside the poll must not open the post (native: take the touch; web: stop the click).
      onStartShouldSetResponder={() => true}
      {...(Platform.OS === "web" ? ({ onClick: (e: any) => e?.stopPropagation?.() } as any) : null)}
    >
      <View style={styles.titleRow}>
        <View style={[styles.pollPill, { backgroundColor: theme.primarySoft }]}>
          <AppIcon name="bar-chart-2" size={12} color={theme.primary} />
          <ThemedText style={[styles.pollPillText, { color: theme.primary }]}>{bn ? "জরিপ" : "Poll"}</ThemedText>
        </View>
      </View>
      <ThemedText style={styles.question} testID="post-poll-question">
        {poll.question}
      </ThemedText>

      <View style={{ gap: Spacing.sm, marginTop: Spacing.md }} accessibilityRole="radiogroup">
        {poll.options.map((o, i) => {
          const selected = voted ? poll.myVote === o.id : picked === o.id;
          const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
          const letter = pollLetter(i, bn);
          return (
            <Pressable
              key={o.id}
              testID={`post-poll-option-${o.id}`}
              onPress={() => onOptionPress(o.id)}
              disabled={!canVote || voting}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !canVote || voting }}
              aria-checked={selected}
              accessibilityLabel={
                showResults
                  ? `${letter}. ${o.text}, ${votesLabel(o.votes, bn)}, ${bn ? toBn(pct) : pct}%`
                  : `${letter}. ${o.text}`
              }
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: theme.backgroundRoot,
                  borderColor: selected ? theme.primary : theme.divider,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {showResults ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.bar,
                    { width: `${pct}%`, backgroundColor: selected ? theme.primary + "2E" : theme.primary + "14" },
                  ]}
                />
              ) : null}
              <View style={[styles.radioOuter, { borderColor: selected ? theme.primary : theme.textTertiary }]}>
                {selected ? <View style={[styles.radioInner, { backgroundColor: theme.primary }]} /> : null}
              </View>
              <ThemedText style={[styles.letter, { color: selected ? theme.primary : theme.textSecondary }]}>{letter}.</ThemedText>
              <ThemedText style={styles.optionText} numberOfLines={3}>
                {o.text}
              </ThemedText>
              {showResults ? (
                <View style={styles.countCol}>
                  <ThemedText style={[styles.pct, { color: selected ? theme.primary : theme.text }]}>
                    {bn ? toBn(pct) : pct}%
                  </ThemedText>
                  <ThemedText type="caption" muted style={styles.countText} testID={`post-poll-count-${o.id}`}>
                    {votesLabel(o.votes, bn)}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <ThemedText type="caption" muted style={{ flex: 1 }} testID="post-poll-total">
          {bn ? `মোট ${votesLabel(total, true)}` : `${votesLabel(total, false)} total`}
          {voted ? (bn ? " · অন্য অপশনে চাপ দিয়ে ভোট বদলান" : " · Tap another option to change your vote") : ""}
        </ThemedText>
        {!voted && canVote ? (
          <View style={styles.footerActions}>
            <Pressable onPress={() => setPeek((v) => !v)} hitSlop={8} accessibilityRole="button" testID="post-poll-peek">
              <ThemedText type="caption" style={{ color: theme.primary, fontFamily: FontFamily.semibold }}>
                {peek ? (bn ? "ভোট দিন" : "Back to voting") : bn ? "ফলাফল দেখুন" : "See results"}
              </ThemedText>
            </Pressable>
            <Button
              title={bn ? "ভোট দিন" : "Vote"}
              size="sm"
              loading={voting}
              disabled={!picked}
              onPress={() => picked && sendVote(picked)}
              testID="post-poll-vote"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center" },
  pollPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pollPillText: { fontSize: 11, lineHeight: 16, fontFamily: FontFamily.semibold },
  question: { marginTop: Spacing.sm, fontSize: 16, lineHeight: 23, fontFamily: FontFamily.semibold },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 46,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  letter: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 20, minWidth: 16 },
  optionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  countCol: { alignItems: "flex-end", minWidth: 56 },
  pct: { fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 18 },
  countText: { fontSize: 11, lineHeight: 15 },
  footer: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md, flexWrap: "wrap" },
  footerActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
});
