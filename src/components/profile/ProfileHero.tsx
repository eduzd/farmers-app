import React from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { AppIcon } from "@/components/icons/AppIcon";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { useTheme } from "@/hooks/useTheme";
import { usePresence } from "@/lib/liveStatus";
import { Spacing, FontFamily } from "@/constants/theme";

/**
 * The top of every profile page (your own and other people's), laid out like the reference
 * the user picked: photo, name, a short line under it, the bio, an "Online · followers" line,
 * a "Joined · place" line, then two equal buttons side by side.
 *
 * Everything is centred. Colours are the app's Maya theme: the main button is solid navy
 * (white with navy text in dark mode), the second one is outlined.
 */
export interface HeroButton {
  label: string;
  /** Feather icon name, or "chat" for the app's own chat bubble. */
  icon?: string;
  onPress: () => void;
  /** Solid (main) or outlined. */
  solid?: boolean;
  busy?: boolean;
  testID?: string;
}

interface Props {
  userId?: string;
  name: string;
  initials?: string;
  avatar?: string;
  avatarId?: string;
  avatarColor?: string;
  badge?: string;
  isWelfareMember?: boolean;
  verified?: boolean;
  /** Line under the name: @username or the person's role. */
  subtitle?: string;
  /** Small pills under the subtitle (category, membership). */
  chips?: React.ReactNode;
  bio?: string;
  location?: string;
  /** Already formatted, e.g. "Joined October 2026". */
  joined?: string;
  /** Already formatted counts ("20K", "…" while loading, "—" when it failed). */
  followers: string;
  following: string;
  onFollowers?: () => void;
  onFollowing?: () => void;
  onAvatarPress?: () => void;
  primary?: HeroButton;
  secondary?: HeroButton;
  bn: boolean;
  /** Extra content under the buttons (e.g. a retry line). */
  footer?: React.ReactNode;
  /** Prefix for the follower/following test ids: "profile" (own page) or "user" (someone else). */
  statIdPrefix?: string;
}

const AVATAR = 104;

export function ProfileHero(p: Props) {
  const { theme } = useTheme();
  const presence = usePresence(p.userId);
  const L = (en: string, b: string) => (p.bn ? b : en);

  const renderButton = (b: HeroButton | undefined) => {
    if (!b) return null;
    const fg = b.solid ? theme.backgroundRoot : theme.text;
    return (
      <Pressable
        testID={b.testID}
        accessibilityRole="button"
        accessibilityLabel={b.label}
        disabled={b.busy}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          b.onPress();
        }}
        style={({ pressed }) => [
          styles.button,
          b.solid
            ? { backgroundColor: theme.text, borderColor: theme.text }
            : { backgroundColor: theme.card, borderColor: theme.text },
          pressed && { opacity: 0.8 },
        ]}
      >
        {b.busy ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <>
            {b.icon === "chat" ? <ChatIcon size={18} color={fg} /> : b.icon ? <AppIcon name={b.icon as any} size={18} color={fg} /> : null}
            <ThemedText style={[styles.buttonText, { color: fg }]} numberOfLines={1}>
              {b.label}
            </ThemedText>
          </>
        )}
      </Pressable>
    );
  };

  const sep = <ThemedText style={[styles.sep, { color: theme.textTertiary || theme.textSecondary }]}>·</ThemedText>;

  return (
    <View style={styles.wrap} testID="profile-hero">
      <Pressable onPress={p.onAvatarPress} disabled={!p.onAvatarPress} accessibilityLabel={p.name}>
        <View style={[styles.avatarRing, { borderColor: theme.backgroundSecondary }]}>
          <UserAvatar
            initials={p.initials}
            name={p.name}
            avatar={p.avatar}
            avatarId={p.avatarId}
            avatarColor={p.avatarColor}
            size={AVATAR}
            badge={p.badge}
            isWelfareMember={p.isWelfareMember}
            userId={p.userId}
          />
        </View>
      </Pressable>

      <View style={styles.nameRow}>
        <ThemedText type="h3" style={[styles.name, { color: theme.text }]} numberOfLines={2} testID="profile-hero-name">
          {p.name}
        </ThemedText>
        {p.verified ? (
          <View style={styles.tick} testID="profile-hero-verified" accessibilityLabel={L("Verified", "ভেরিফায়েড")}>
            <AppIcon name="check" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      {p.subtitle ? (
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1} testID="profile-hero-subtitle">
          {p.subtitle}
        </ThemedText>
      ) : null}

      {p.chips ? <View style={styles.chips}>{p.chips}</View> : null}

      {p.bio ? (
        <ThemedText style={[styles.bio, { color: theme.text }]} numberOfLines={5} testID="profile-hero-bio">
          {p.bio}
        </ThemedText>
      ) : null}

      {/* Online · followers · following */}
      <View style={styles.metaRow}>
        {presence ? (
          <>
            <View style={styles.metaItem} testID={presence === "online" ? "profile-hero-online" : "profile-hero-offline"}>
              <View style={[styles.dot, { backgroundColor: presence === "online" ? theme.success || "#00BB77" : theme.textTertiary || "#9CA3AF" }]} />
              <ThemedText style={[styles.metaText, { color: presence === "online" ? theme.success || "#00BB77" : theme.textSecondary }]}>
                {presence === "online" ? L("Online", "অনলাইন") : L("Offline", "অফলাইন")}
              </ThemedText>
            </View>
            {sep}
          </>
        ) : null}
        <Pressable onPress={p.onFollowers} disabled={!p.onFollowers} hitSlop={6} testID="profile-hero-followers" accessibilityRole="button">
          <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
            <ThemedText style={[styles.metaStrong, { color: theme.text }]} testID={`${p.statIdPrefix || "profile"}-stat-followers`}>{p.followers}</ThemedText>{" "}
            {L("followers", "ফলোয়ার")}
          </ThemedText>
        </Pressable>
        {sep}
        <Pressable onPress={p.onFollowing} disabled={!p.onFollowing} hitSlop={6} testID="profile-hero-following" accessibilityRole="button">
          <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
            <ThemedText style={[styles.metaStrong, { color: theme.text }]} testID={`${p.statIdPrefix || "profile"}-stat-following`}>{p.following}</ThemedText>{" "}
            {L("following", "ফলো করছেন")}
          </ThemedText>
        </Pressable>
      </View>

      {/* Joined · place */}
      {p.joined || p.location ? (
        <View style={styles.metaRow}>
          {p.joined ? (
            <View style={styles.metaItem} testID="profile-hero-joined">
              <AppIcon name="calendar" size={14} color={theme.iconSecondary || theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{p.joined}</ThemedText>
            </View>
          ) : null}
          {p.joined && p.location ? sep : null}
          {p.location ? (
            <View style={styles.metaItem} testID="profile-hero-location">
              <AppIcon name="map-pin" size={14} color={theme.iconSecondary || theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
                {p.location}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      {p.primary || p.secondary ? (
        <View style={styles.buttons}>
          {renderButton(p.primary)}
          {renderButton(p.secondary)}
        </View>
      ) : null}
      {p.footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  avatarRing: { borderWidth: 3, borderRadius: AVATAR / 2 + 3 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: Spacing.md, maxWidth: "100%" },
  name: { textAlign: "center", flexShrink: 1 },
  tick: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#1DA1F2", alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.medium, marginTop: 2, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  bio: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: Spacing.md, maxWidth: 520 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", marginTop: Spacing.sm, columnGap: 6, rowGap: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 260 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metaText: { fontSize: 14, lineHeight: 20 },
  metaStrong: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.bold },
  sep: { fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg, maxWidth: 560, width: "100%" },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  buttonText: { fontSize: 15, lineHeight: 20, fontFamily: FontFamily.semibold },
});

export default ProfileHero;
