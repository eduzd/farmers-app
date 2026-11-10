import React from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { AppIcon } from "@/components/icons/AppIcon";
import { EmptyState } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { apiGet } from "@/lib/api";
import { initialsOf, timeAgo } from "@/lib/feedApi";
import { Spacing, FontFamily } from "@/constants/theme";

export interface SellerReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  itemId?: string;
  itemName?: string | null;
}

export interface SellerReviews {
  reviews: SellerReview[];
  count: number;
  average: number;
}

/** Every review buyers left on this person's own listings (real data from the server). */
export async function fetchSellerReviews(userId: string): Promise<SellerReviews> {
  const r = await apiGet<any>(`/api/sellers/${encodeURIComponent(userId)}/reviews`);
  if (!r || !Array.isArray(r.reviews)) throw new Error("Bad reviews data");
  return { reviews: r.reviews, count: Number(r.count) || r.reviews.length, average: Number(r.average) || 0 };
}

const bnDigits = (s: string) => s.replace(/[0-9]/g, (c) => "০১২৩৪৫৬৭৮৯"[Number(c)]);

function Stars({ value, size, color, empty }: { value: number; size: number; color: string; empty: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <AppIcon key={i} name="star" size={size} color={i <= Math.round(value) ? color : empty} />
      ))}
    </View>
  );
}

interface Props {
  state: "loading" | "ok" | "error";
  data?: SellerReviews;
  bn: boolean;
  name: string;
  isMe?: boolean;
  onRetry: () => void;
}

/**
 * Reviews tab on a profile: the average, how the stars split, then each review (who, stars,
 * when, which product, what they wrote). Same flat white cards as About.
 */
export function ProfileReviews({ state, data, bn, name, isMe, onRetry }: Props) {
  const { theme } = useTheme();
  const star = "#F5A623";
  const num = (n: number | string) => (bn ? bnDigits(String(n)) : String(n));

  if (state !== "ok" || !data) {
    return (
      <View style={styles.center}>
        {state === "loading" ? (
          <ActivityIndicator color={theme.text} testID="user-reviews-loading" />
        ) : (
          <Pressable onPress={onRetry} style={styles.retry} testID="user-reviews-retry" accessibilityRole="button">
            <AppIcon name="refresh-cw" size={14} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>{bn ? "রিভিউ লোড হয়নি · আবার চেষ্টা করতে চাপুন" : "Couldn't load reviews · Tap to retry"}</ThemedText>
          </Pressable>
        )}
      </View>
    );
  }

  if (data.reviews.length === 0) {
    return (
      <View testID="user-reviews-empty">
        <EmptyState
          icon="star"
          title={bn ? "এখনো কোনো রিভিউ নেই" : "No reviews yet"}
          message={
            isMe
              ? bn ? "ক্রেতারা আপনার পণ্যে রিভিউ দিলে এখানে দেখা যাবে।" : "Reviews buyers leave on your products show up here."
              : bn ? `${name}-এর পণ্যে ক্রেতাদের রিভিউ এখানে দেখা যাবে।` : `Reviews buyers leave on ${name}'s products show up here.`
          }
        />
      </View>
    );
  }

  const total = data.reviews.length;
  const split = [5, 4, 3, 2, 1].map((s) => ({ s, n: data.reviews.filter((r) => Math.round(r.rating) === s).length }));

  return (
    <View testID="profile-reviews">
      <View style={[styles.card, styles.summary, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} testID="reviews-summary">
        <View style={styles.avgCol}>
          <ThemedText style={[styles.avg, { color: theme.text }]} testID="reviews-average">{num(data.average.toFixed(1))}</ThemedText>
          <Stars value={data.average} size={14} color={star} empty={theme.divider} />
          <ThemedText style={[styles.small, { color: theme.textSecondary, marginTop: 4 }]} testID="reviews-count">
            {bn ? `${num(total)}টি রিভিউ` : `${total} review${total === 1 ? "" : "s"}`}
          </ThemedText>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {split.map(({ s, n }) => (
            <View key={s} style={styles.splitRow}>
              <ThemedText style={[styles.small, { color: theme.textSecondary, width: 12 }]}>{num(s)}</ThemedText>
              <View style={[styles.track, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={[styles.fill, { backgroundColor: star, width: `${Math.round((n / total) * 100)}%` }]} />
              </View>
              <ThemedText style={[styles.small, { color: theme.textSecondary, width: 22, textAlign: "right" }]}>{num(n)}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      {data.reviews.map((r) => (
        <View key={r.id} style={[styles.card, styles.review, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} testID={`user-review-${r.id}`}>
          <View style={styles.head}>
            <UserAvatar name={r.userName} initials={initialsOf(r.userName)} avatar={r.userAvatar || undefined} size={36} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>{r.userName}</ThemedText>
              <View style={styles.metaRow}>
                <Stars value={r.rating} size={12} color={star} empty={theme.divider} />
                <ThemedText style={[styles.small, { color: theme.textSecondary }]}>· {timeAgo(r.createdAt, bn)}</ThemedText>
              </View>
            </View>
          </View>
          {r.itemName ? (
            <View style={[styles.item, { backgroundColor: theme.backgroundSecondary }]}>
              <AppIcon name="shopping-bag" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.small, { color: theme.textSecondary }]} numberOfLines={1}>{r.itemName}</ThemedText>
            </View>
          ) : null}
          {r.comment ? <ThemedText style={[styles.comment, { color: theme.text }]}>{r.comment}</ThemedText> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingVertical: Spacing["2xl"] },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, padding: Spacing.sm },
  card: { marginHorizontal: Spacing.lg, borderWidth: 1, borderRadius: 12, padding: Spacing.lg, marginBottom: Spacing.md },
  summary: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  avgCol: { alignItems: "center", minWidth: 90 },
  avg: { fontSize: 32, lineHeight: 40, fontFamily: FontFamily.semibold },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  review: { gap: Spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  name: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.medium },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, maxWidth: "100%" },
  comment: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
});

export default ProfileReviews;
