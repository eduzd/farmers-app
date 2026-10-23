import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
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

/** The post text the server writes when a room is shared to the feed (used when the room itself is gone). */
export const VOICE_POST_RE = /^\u{1F399}\uFE0F? (Live voice room|Voice room \(scheduled\)): ?([^\n]*)/u;

export function isVoiceRoomPostText(content?: string | null) {
  return !!content && VOICE_POST_RE.test(content);
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
  const accent = ended ? theme.textSecondary : theme.primary;
  const badge =
    status === "live"
      ? { text: bn ? "লাইভ" : "LIVE", bg: "#E5484D" }
      : status === "scheduled"
        ? { text: bn ? "আসছে" : "UPCOMING", bg: theme.primary }
        : { text: bn ? "শেষ" : "ENDED", bg: theme.textSecondary };

  const counts =
    r && status === "live"
      ? bn
        ? `${bnDigits(r.speakers)} জন মঞ্চে · ${bnDigits(r.listeners)} জন শুনছেন`
        : `${r.speakers} on stage · ${r.listeners} listening`
      : null;

  return (
    <Pressable
      onPress={status === "live" ? join : undefined}
      disabled={status !== "live"}
      style={[
        styles.card,
        { backgroundColor: ended ? theme.backgroundDefault : theme.primarySoft, borderColor: theme.border, opacity: ended ? 0.85 : 1 },
      ]}
      accessibilityRole={status === "live" ? "button" : undefined}
      testID="post-voice-room"
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: accent }]}>
          <Feather name={ended ? "mic-off" : "mic"} size={16} color="#fff" />
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <ThemedText style={styles.badgeText}>{badge.text}</ThemedText>
        </View>
        {status === "scheduled" && r?.scheduledFor ? (
          <ThemedText style={[styles.small, { color: theme.primary, fontWeight: "600", flexShrink: 1 }]} numberOfLines={1}>
            {formatRoomTime(r.scheduledFor, bn)}
          </ThemedText>
        ) : null}
      </View>

      <ThemedText style={[styles.title, ended && { color: theme.textSecondary }]} numberOfLines={2}>
        {title}
      </ThemedText>
      {r?.description ? (
        <ThemedText style={[styles.small, { color: theme.textSecondary }]} numberOfLines={3}>
          {r.description}
        </ThemedText>
      ) : null}

      {r ? (
        <View style={styles.hostRow}>
          <UserAvatar avatar={r.hostAvatar || undefined} name={r.hostName} badge={r.hostProfileRole || undefined} size={22} />
          <ThemedText style={[styles.small, { flexShrink: 1 }]} numberOfLines={1}>
            {bn ? `হোস্ট: ${r.hostName}` : `Host: ${r.hostName}`}
          </ThemedText>
        </View>
      ) : null}
      {counts ? <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{counts}</ThemedText> : null}

      {status === "live" ? (
        <View style={[styles.btn, { backgroundColor: theme.primary }]} testID="post-voice-room-join">
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="headphones" size={16} color="#fff" />}
          <ThemedText style={styles.btnText}>{bn ? "যোগ দিন" : "Join"}</ThemedText>
        </View>
      ) : status === "scheduled" && isHost ? (
        <Pressable onPress={startNow} style={[styles.btn, { backgroundColor: theme.primary }]} testID="post-voice-room-start">
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="play" size={16} color="#fff" />}
          <ThemedText style={styles.btnText}>{bn ? "এখনই শুরু করুন" : "Start now"}</ThemedText>
        </Pressable>
      ) : status === "scheduled" ? (
        <ThemedText style={[styles.small, { color: theme.textSecondary }]}>
          {bn ? "শুরু হলে এখান থেকে যোগ দিতে পারবেন।" : "You can join from here once it starts."}
        </ThemedText>
      ) : (
        <ThemedText style={[styles.small, { color: theme.textSecondary }]} testID="post-voice-room-ended">
          {bn ? "এই ভয়েস রুমটি শেষ হয়ে গেছে।" : "This voice room has ended."}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, gap: 6, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  top: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  title: { fontSize: 16, fontWeight: "700" },
  small: { fontSize: 13 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  btn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: BorderRadius.full,
    paddingVertical: 10,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
