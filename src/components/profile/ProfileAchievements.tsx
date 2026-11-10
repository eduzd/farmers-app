import React, { useState } from "react";
import { View, StyleSheet } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/icons/AppIcon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, FontFamily } from "@/constants/theme";

/**
 * Achievements on a profile, worked out from real data only: the person's posts (and the likes
 * and comments on them), their follower count, whether the account is verified and when they
 * joined. Nothing is invented: while a number is still loading the badge shows "…" instead of
 * a made-up progress.
 */

export interface AchievementInput {
  /** Their posts, once loaded (undefined while loading or if the load failed). */
  posts?: { likes: number; comments: number }[];
  /** Follower count, once loaded. */
  followers?: number;
  verified: boolean;
  joinedAt?: string | null;
}

interface Achievement {
  key: string;
  icon: string;
  title: [string, string];
  desc: [string, string];
  target: number;
  /** undefined = not known yet */
  current?: number;
}

const GAP = 10;
const DAY = 24 * 60 * 60 * 1000;

export function buildAchievements({ posts, followers, verified, joinedAt }: AchievementInput): Achievement[] {
  const nPosts = posts?.length;
  const likes = posts?.reduce((s, p) => s + (p.likes || 0), 0);
  const comments = posts?.reduce((s, p) => s + (p.comments || 0), 0);
  const joined = joinedAt ? new Date(joinedAt).getTime() : NaN;
  const days = Number.isFinite(joined) ? Math.max(0, Math.floor((Date.now() - joined) / DAY)) : undefined;
  return [
    { key: "first-post", icon: "edit-3", title: ["First post", "প্রথম পোস্ট"], desc: ["Share a first post in Community", "কমিউনিটিতে প্রথম পোস্ট করুন"], target: 1, current: nPosts },
    { key: "posts-10", icon: "file-text", title: ["Regular poster", "নিয়মিত পোস্টকারী"], desc: ["Share 10 posts", "১০টি পোস্ট করুন"], target: 10, current: nPosts },
    { key: "posts-50", icon: "trending-up", title: ["Community pillar", "কমিউনিটির স্তম্ভ"], desc: ["Share 50 posts", "৫০টি পোস্ট করুন"], target: 50, current: nPosts },
    { key: "likes-100", icon: "heart", title: ["Well liked", "সবার পছন্দের"], desc: ["Get 100 likes on your posts", "পোস্টে ১০০টি লাইক পান"], target: 100, current: likes },
    { key: "comments-25", icon: "message-circle", title: ["Conversation starter", "আলোচনার সূচনাকারী"], desc: ["Get 25 comments on your posts", "পোস্টে ২৫টি কমেন্ট পান"], target: 25, current: comments },
    { key: "followers-10", icon: "users", title: ["Growing following", "বাড়ছে ফলোয়ার"], desc: ["Reach 10 followers", "১০ জন ফলোয়ার পান"], target: 10, current: followers },
    { key: "followers-100", icon: "star", title: ["Community favourite", "জনপ্রিয় সদস্য"], desc: ["Reach 100 followers", "১০০ জন ফলোয়ার পান"], target: 100, current: followers },
    { key: "verified", icon: "check-circle", title: ["Verified", "ভেরিফায়েড"], desc: ["Account verified by Farmers", "Farmers ভেরিফাই করেছে"], target: 1, current: verified ? 1 : 0 },
    { key: "year-1", icon: "calendar", title: ["One year member", "এক বছরের সদস্য"], desc: ["Be a member for one year", "এক বছর সদস্য থাকুন"], target: 365, current: days },
  ];
}

const isEarned = (a: Achievement) => a.current !== undefined && a.current >= a.target;

/** How many are earned, or undefined while something they depend on is still loading. */
export function earnedCount(input: AchievementInput): number | undefined {
  const list = buildAchievements(input);
  if (list.some((a) => a.current === undefined && a.key !== "year-1")) return undefined;
  return list.filter(isEarned).length;
}

const bnDigits = (s: string) => s.replace(/[0-9]/g, (c) => "০১২৩৪৫৬৭৮৯"[Number(c)]);

export function ProfileAchievements({ input, bn }: { input: AchievementInput; bn: boolean }) {
  const { theme } = useTheme();
  const L = (pair: [string, string]) => (bn ? pair[1] : pair[0]);
  const num = (n: number) => (bn ? bnDigits(String(n)) : String(n));
  const list = buildAchievements(input);
  const earned = list.filter(isEarned).length;
  const accent = theme.link || theme.primary;
  const [gridW, setGridW] = useState(0);
  const cols = gridW >= 560 ? 3 : 2;
  const tileW = gridW ? Math.floor((gridW - GAP * (cols - 1)) / cols) : 0;

  return (
    <View testID="profile-achievements">
      <View style={[styles.summary, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} testID="achievements-summary">
        <View style={[styles.summaryIcon, { backgroundColor: theme.backgroundSecondary }]}>
          <AppIcon name="award" size={22} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
            {bn ? `${num(list.length)}টির মধ্যে ${num(earned)}টি অর্জিত` : `${earned} of ${list.length} earned`}
          </ThemedText>
          <View style={[styles.track, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.fill, { backgroundColor: accent, width: `${Math.round((earned / list.length) * 100)}%` }]} />
          </View>
        </View>
      </View>

      {/* Badge grid: equal tiles in rows (2 on a phone, 3 on a wide screen), so nothing overlaps or crowds. */}
      <View
        style={styles.grid}
        onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
        testID="achievements-grid"
      >
        {list.map((a) => {
          const done = isEarned(a);
          const known = a.current !== undefined;
          const pct = known ? Math.min(1, (a.current as number) / a.target) : 0;
          const progressText = a.key === "verified"
            ? (bn ? "এখনো নয়" : "Not yet")
            : a.key === "year-1"
              ? (bn ? `${num(a.current || 0)}/${num(a.target)} দিন` : `${a.current || 0}/${a.target} days`)
              : `${num(Math.min(a.current || 0, a.target))}/${num(a.target)}`;
          return (
            <View
              key={a.key}
              style={[
                styles.tile,
                tileW ? { width: tileW } : styles.tileFallback,
                { backgroundColor: theme.card, borderColor: done ? accent : theme.cardBorder },
              ]}
              testID={`achievement-${a.key}`}
              accessibilityLabel={`${L(a.title)}: ${done ? (bn ? "অর্জিত" : "earned") : L(a.desc)}`}
            >
              <View style={[styles.icon, { backgroundColor: done ? accent : theme.backgroundSecondary }]}>
                <AppIcon name={a.icon as any} size={20} color={done ? theme.buttonText || "#fff" : theme.textSecondary} />
              </View>
              <ThemedText numberOfLines={2} style={[styles.title, { color: done ? theme.text : theme.textSecondary }]}>{L(a.title)}</ThemedText>
              <ThemedText numberOfLines={2} style={[styles.desc, { color: theme.textSecondary }]}>{L(a.desc)}</ThemedText>
              <View style={styles.tileFoot}>
                {done ? (
                  <View style={styles.badge} testID={`achievement-${a.key}-earned`}>
                    <AppIcon name="check" size={14} color={accent} />
                    <ThemedText style={[styles.badgeText, { color: accent }]}>{bn ? "অর্জিত" : "Earned"}</ThemedText>
                  </View>
                ) : (
                  <>
                    <ThemedText numberOfLines={1} style={[styles.progress, { color: theme.textSecondary }]} testID={`achievement-${a.key}-progress`}>
                      {known ? progressText : "…"}
                    </ThemedText>
                    {known && a.key !== "verified" ? (
                      <View style={[styles.track, styles.rowTrack, { backgroundColor: theme.backgroundSecondary }]}>
                        <View style={[styles.fill, { backgroundColor: accent, width: `${Math.round(pct * 100)}%` }]} />
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderRadius: 12, padding: Spacing.lg },
  summaryIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  summaryTitle: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.semibold, marginBottom: 8 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  rowTrack: { height: 4, marginTop: 6 },
  fill: { height: "100%", borderRadius: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, marginHorizontal: Spacing.lg },
  tile: { borderWidth: 1, borderRadius: 12, padding: Spacing.md, gap: 4, minHeight: 150 },
  tileFallback: { width: "47%" },
  tileFoot: { marginTop: "auto", paddingTop: 6 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.semibold },
  desc: { fontSize: 12, lineHeight: 17 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeText: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },
  progress: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium },
});

export default ProfileAchievements;
