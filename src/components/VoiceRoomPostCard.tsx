import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, Animated, Easing, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Palette, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { currentUserId } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  VoiceRoomCard,
  fetchVoiceRoom,
  formatRoomTime,
  startScheduledVoiceRoom,
  voiceReasonText,
  VoiceRoomError,
} from "@/lib/voiceRoomApi";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const bnDigits = (n: number) => n.toLocaleString("bn-BD");
const useNative = Platform.OS !== "web";

/** The post text the server writes when a room is shared to the feed (used when the room itself is gone). */
export const VOICE_POST_RE = /^\u{1F399}\uFE0F? (Live voice room|Voice room \(scheduled\)): ?([^\n]*)/u;

export function isVoiceRoomPostText(content?: string | null) {
  return !!content && VOICE_POST_RE.test(content);
}

/** A soft pulsing dot for the LIVE badge. */
function PulseDot({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[
          styles.pulseHalo,
          {
            backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
          },
        ]}
      />
      <View style={[styles.pulseCore, { backgroundColor: color }]} />
    </View>
  );
}

/** Little animated sound bars: the room is talking right now. */
function SoundBars({ color, active }: { color: string; active: boolean }) {
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.35))).current;
  useEffect(() => {
    if (!active) return;
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 380 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
          Animated.timing(b, { toValue: 0.3, duration: 380 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
        ]),
      ),
    );
    loops.forEach((l, i) => setTimeout(() => l.start(), i * 120));
    return () => loops.forEach((l) => l.stop());
  }, [active, bars]);
  return (
    <View style={styles.bars}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={[styles.bar, { backgroundColor: color, transform: [{ scaleY: active ? b : 0.35 }] }]} />
      ))}
    </View>
  );
}

/**
 * A voice room shared to the community feed. Live rooms have Join; scheduled rooms show the time (the host can
 * start it); an ended or deleted room shows an ended state instead of a join that would fail.
 */
export function VoiceRoomPostCard({ room, fallbackTitle }: { room?: VoiceRoomCard | null; fallbackTitle?: string }) {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { language } = useI18n();
  const bn = language === "bn";
  const [override, setOverride] = useState<VoiceRoomCard | null>(null);
  const [busy, setBusy] = useState(false);
  const r = override || room || null;
  const status: "live" | "scheduled" | "ended" = r ? r.status : "ended";
  const isHost = !!r && currentUserId() === r.hostId;
  const title = r?.title || fallbackTitle || (bn ? "ভয়েস রুম" : "Voice room");

  const join = async () => {
    if (!r || busy) return;
    setBusy(true);
    try {
      // The feed may be a few minutes old: check the room is still live before opening it.
      const fresh = await fetchVoiceRoom(r.id).catch((e) => {
        if ((e instanceof VoiceRoomError && e.status === 404) || /doesn't exist|HTTP 404/.test(String(e?.message))) return null;
        throw e;
      });
      if (!fresh) {
        setOverride({ ...r, status: "ended" });
        return;
      }
      setOverride(fresh);
      if (fresh.status === "live") navigation.navigate("VoiceRoom", { roomId: fresh.id, room: fresh });
    } catch (e: any) {
      Alert.alert(bn ? "ভয়েস রুম" : "Voice room", e?.message || voiceReasonText("", bn));
    } finally {
      setBusy(false);
    }
  };

  const startNow = async () => {
    if (!r || busy) return;
    setBusy(true);
    try {
      await startScheduledVoiceRoom(r.id);
      const live = { ...r, status: "live" as const };
      setOverride(live);
      navigation.navigate("VoiceRoom", { roomId: r.id, room: live, isHost: true });
    } catch (e: any) {
      Alert.alert(bn ? "ভয়েস রুম" : "Voice room", e?.message || voiceReasonText("", bn));
    } finally {
      setBusy(false);
    }
  };

  const ended = status === "ended";
  const live = status === "live";
  const scheduled = status === "scheduled";

  // ---------- Ended: a calm, muted card so nobody tries to join.
  if (ended) {
    return (
      <View
        style={[styles.endedCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
        testID="post-voice-room"
      >
        <View style={[styles.endedIcon, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <Feather name="mic-off" size={20} color={theme.textSecondary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.rowCenter}>
            <View style={[styles.endedBadge, { backgroundColor: theme.textSecondary + "22" }]}>
              <ThemedText style={[styles.endedBadgeText, { color: theme.textSecondary }]}>{bn ? "শেষ" : "ENDED"}</ThemedText>
            </View>
            <ThemedText style={[styles.kicker, { color: theme.textSecondary }]}>{bn ? "ভয়েস রুম" : "Voice room"}</ThemedText>
          </View>
          <ThemedText style={[styles.endedTitle, { color: theme.text }]} numberOfLines={2}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.small, { color: theme.textSecondary }]} testID="post-voice-room-ended" numberOfLines={1}>
            {r?.hostName
              ? bn
                ? `${r.hostName}-এর রুমটি শেষ হয়ে গেছে।`
                : `${r.hostName}'s room has ended.`
              : bn
                ? "এই ভয়েস রুমটি শেষ হয়ে গেছে।"
                : "This voice room has ended."}
          </ThemedText>
        </View>
      </View>
    );
  }

  // ---------- Live / scheduled: a compact hero card. The whole card is the tap target.
  const stage = (r?.stage || []).filter((s) => s.userId !== r?.hostId).slice(0, 2);
  const extraOnStage = r ? Math.max(0, r.speakers - 1 - stage.length) : 0;
  const num = (n: number) => (bn ? bnDigits(n) : String(n));
  const onCardPress = live ? join : scheduled && isHost ? startNow : undefined;
  const meta =
    r && live
      ? bn
        ? `${num(r.speakers)} জন মঞ্চে · ${num(r.listeners)} জন শুনছেন`
        : `${r.speakers} on stage · ${r.listeners} listening`
      : scheduled && r?.scheduledFor
        ? formatRoomTime(r.scheduledFor, bn)
        : "";

  return (
    <Pressable
      onPress={onCardPress}
      disabled={!onCardPress || busy}
      style={({ pressed }) => [styles.shadowWrap, Shadows.medium, pressed && { transform: [{ scale: 0.98 }], opacity: 0.96 }]}
      accessibilityRole={onCardPress ? "button" : undefined}
      accessibilityLabel={
        live
          ? bn
            ? `লাইভ ভয়েস রুম: ${title}। যোগ দিতে ট্যাপ করুন`
            : `Live voice room: ${title}. Tap to join`
          : `${bn ? "ভয়েস রুম" : "Voice room"}: ${title}`
      }
      testID="post-voice-room"
    >
      <View style={styles.hero}>
        <ShiftingBackground live={live} />

        <View style={styles.heroRow}>
          {/* Left: status, title, host, numbers */}
          <View style={styles.heroLeft}>
            <View style={styles.topRow}>
              {live ? (
                <View style={[styles.liveBadge, { backgroundColor: "#E5484D" }]}>
                  <PulseDot color="#FFFFFF" />
                  <ThemedText style={styles.liveBadgeText}>{bn ? "লাইভ" : "LIVE"}</ThemedText>
                </View>
              ) : (
                <View style={[styles.liveBadge, { backgroundColor: Palette.harvest }]}>
                  <Feather name="calendar" size={10} color="#3A2A00" />
                  <ThemedText style={[styles.liveBadgeText, { color: "#3A2A00" }]}>{bn ? "আসছে" : "UPCOMING"}</ThemedText>
                </View>
              )}
              <ThemedText style={styles.kickerLight} numberOfLines={1}>
                {bn ? "ভয়েস রুম" : "Voice room"}
                {r?.isPrivate ? (bn ? " · প্রাইভেট" : " · Private") : ""}
              </ThemedText>
              {live ? <SoundBars color="rgba(255,255,255,0.9)" active /> : null}
            </View>

            <ThemedText style={styles.heroTitle} numberOfLines={2}>
              {title}
            </ThemedText>

            {r ? (
              <View style={styles.peopleRow}>
                <View style={styles.avatarStack}>
                  <View style={[styles.avatarRing, styles.hostRing]}>
                    <UserAvatar avatar={r.hostAvatar || undefined} name={r.hostName} size={24} presence={null} />
                  </View>
                  {live
                    ? stage.map((s, i) => (
                        <View key={s.userId} style={[styles.avatarRing, { marginLeft: -8, zIndex: 3 - i }]}>
                          <UserAvatar avatar={s.avatar || undefined} name={s.name} size={20} presence={null} />
                        </View>
                      ))
                    : null}
                  {live && extraOnStage > 0 ? (
                    <View style={[styles.avatarRing, styles.moreBubble]}>
                      <ThemedText style={styles.moreText}>+{num(extraOnStage)}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={styles.hostLine} numberOfLines={1}>
                  <ThemedText style={styles.hostLabel}>{bn ? "হোস্ট " : "Host "}</ThemedText>
                  {r.hostName}
                </ThemedText>
              </View>
            ) : null}

            {meta ? (
              <View style={styles.metaRow}>
                <Feather name={live ? "headphones" : "clock"} size={11} color="rgba(255,255,255,0.8)" />
                <ThemedText style={styles.metaText} numberOfLines={1}>
                  {meta}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* Right, vertically centred: a small action pill */}
          <View style={styles.heroRight}>
            {live ? (
              <View style={styles.joinPill} testID="post-voice-room-join">
                {busy ? <ActivityIndicator color={Palette.leaf} size="small" /> : <Feather name="headphones" size={13} color={Palette.leaf} />}
                <ThemedText style={styles.joinText}>{bn ? "যোগ দিন" : "Join"}</ThemedText>
              </View>
            ) : isHost ? (
              <View style={styles.joinPill} testID="post-voice-room-start">
                {busy ? <ActivityIndicator color={Palette.leaf} size="small" /> : <Feather name="play" size={13} color={Palette.leaf} />}
                <ThemedText style={styles.joinText}>{bn ? "শুরু" : "Start"}</ThemedText>
              </View>
            ) : (
              <View style={styles.soonPill} accessibilityLabel={bn ? "শুরু হলে এখান থেকে যোগ দিতে পারবেন।" : "You can join from here once it starts."}>
                <Feather name="bell" size={12} color="#FFFFFF" />
                <ThemedText style={styles.soonText}>{bn ? "শীঘ্রই" : "Soon"}</ThemedText>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The living background: brand greens that slowly drift into teal and back, plus a soft light sheen that sweeps
 * across now and then. Opacity and transforms only, so it runs on the native thread.
 */
function ShiftingBackground({ live }: { live: boolean }) {
  const shift = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(shift, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
        Animated.timing(shift, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      ]),
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
        Animated.delay(2600),
        Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: useNative }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [shift, sheen]);

  const base: [string, string, string] = live ? [Palette.leafLight, Palette.leaf, Palette.leafDark] : ["#1F6B4A", "#164E37", "#0F3A29"];
  const alt: [string, string, string] = live ? ["#14B8A6", "#0F8A6A", "#14583A"] : ["#2B6F5C", "#1B5545", "#123D31"];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={base} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: shift }]}>
        <LinearGradient colors={alt} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {/* warm glow in the corner that breathes with the shift */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: shift.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.12] }),
            transform: [{ scale: shift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
          },
        ]}
      />
      <View style={styles.ring1} />
      <Animated.View
        style={[
          styles.sheen,
          { transform: [{ translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-160, 520] }) }, { rotate: "20deg" }] },
        ]}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={styles.watermark}>
        <Feather name="mic" size={64} color="rgba(255,255,255,0.07)" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
  small: { fontSize: 13 },
  kicker: { fontSize: 12, fontWeight: "600" },

  // ended
  endedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  endedIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  endedBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 7, paddingVertical: 1 },
  endedBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  endedTitle: { fontSize: 15, fontWeight: "700" },

  // hero (compact)
  shadowWrap: { borderRadius: 18, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  hero: { borderRadius: 18, overflow: "hidden", paddingVertical: 12, paddingLeft: 14, paddingRight: 12 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroLeft: { flex: 1, minWidth: 0, gap: 5 },
  heroRight: { alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: Palette.gold, top: -90, right: -50 },
  ring1: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 16, borderColor: "rgba(255,255,255,0.07)", bottom: -60, left: -40 },
  sheen: { position: "absolute", top: -40, bottom: -40, width: 90 },
  watermark: { position: "absolute", right: 70, bottom: -10 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: BorderRadius.full, paddingHorizontal: 7, paddingVertical: 2 },
  liveBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  kickerLight: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", letterSpacing: 0.3, flexShrink: 1 },
  pulseWrap: { width: 7, height: 7, alignItems: "center", justifyContent: "center" },
  pulseHalo: { position: "absolute", width: 7, height: 7, borderRadius: 3.5 },
  pulseCore: { width: 6, height: 6, borderRadius: 3 },
  bars: { flexDirection: "row", alignItems: "center", gap: 2, height: 12 },
  bar: { width: 2.5, height: 12, borderRadius: 2 },
  heroTitle: { color: "#FFFFFF", fontSize: 16, lineHeight: 21, fontWeight: "800" },
  peopleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  avatarRing: { borderRadius: 999, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)", backgroundColor: "#FFFFFF" },
  hostRing: { borderColor: Palette.gold, borderWidth: 2, zIndex: 5 },
  moreBubble: { marginLeft: -8, width: 23, height: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  moreText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  hostLine: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", flexShrink: 1 },
  hostLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: "rgba(255,255,255,0.85)", fontSize: 11.5, fontWeight: "600", flexShrink: 1 },
  joinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 74,
    justifyContent: "center",
  },
  joinText: { color: Palette.leaf, fontWeight: "800", fontSize: 13 },
  soonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  soonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
});
