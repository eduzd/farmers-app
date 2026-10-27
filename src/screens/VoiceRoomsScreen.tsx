// Voice rooms list: rooms that are live now (with Join) and talks coming up.
import React, { useCallback, useState } from "react";
import { askConfirm } from "@/components/ConfirmSheet";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import {
  VOICE_CATEGORIES,
  fetchVoicePermission,
  fetchVoiceRooms,
  formatRoomTime,
  startScheduledVoiceRoom,
  endVoiceRoom,
  voiceCategoryLabel,
  voiceReasonText,
  type VoiceRoomCard,
} from "@/lib/voiceRoomApi";

export default function VoiceRoomsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { language } = useI18n();
  const bn = language === "bn";
  const myId = String((useAuthStore((s: any) => s.user) as any)?.id || "");
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const rooms = useQuery({
    queryKey: ["voice-rooms", category],
    queryFn: () => fetchVoiceRooms(category),
    refetchInterval: 15000,
  });
  const perm = useQuery({ queryKey: ["voice-rooms-permission"], queryFn: fetchVoicePermission, staleTime: 60000 });

  useFocusEffect(
    useCallback(() => {
      void rooms.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const live = rooms.data?.rooms || [];
  const upcoming = rooms.data?.scheduled || [];

  const join = (r: VoiceRoomCard) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate("VoiceRoom", { roomId: r.id, room: r });
  };

  const startNow = async (r: VoiceRoomCard) => {
    setBusy(r.id);
    try {
      await startScheduledVoiceRoom(r.id);
      navigation.navigate("VoiceRoom", { roomId: r.id, room: { ...r, status: "live" } });
    } catch (e: any) {
      Alert.alert(bn ? "শুরু করা গেল না" : "Couldn't start", e?.code === "ALREADY_LIVE" ? (bn ? "আপনার আরেকটি রুম এখন লাইভ।" : "You already have a live room.") : voiceReasonText("", bn));
    } finally {
      setBusy(null);
    }
  };

  const cancel = (r: VoiceRoomCard) => {
    const go = async () => {
      setBusy(r.id);
      try {
        await endVoiceRoom(r.id);
        await rooms.refetch();
      } catch {
      } finally {
        setBusy(null);
      }
    };
    if (Platform.OS === "web") {
      void askConfirm({ title: bn ? "রুম বাতিল" : "Cancel room", message: bn ? "এই রুমটি বাতিল করবেন?" : "Cancel this room?", confirmText: bn ? "বাতিল" : "Cancel room", cancelText: bn ? "না" : "No", tone: "danger" }).then((ok) => { if (ok) void go(); });
      return;
    }
    Alert.alert(bn ? "রুম বাতিল" : "Cancel room", bn ? "এই রুমটি বাতিল করবেন?" : "Cancel this room?", [
      { text: bn ? "না" : "No", style: "cancel" },
      { text: bn ? "বাতিল" : "Cancel room", style: "destructive", onPress: () => void go() },
    ]);
  };

  const card = { backgroundColor: theme.backgroundDefault, borderColor: theme.border };

  const renderLive = (r: VoiceRoomCard, i: number) => {
    const extra = Math.max(0, r.speakers - r.stage.length);
    return (
      <Animated.View key={r.id} entering={FadeInUp.delay(i * 40).duration(250)}>
        <Pressable onPress={() => join(r)} style={({ pressed }) => [styles.liveCard, card, pressed && { opacity: 0.9 }]} testID={`voice-room-${r.id}`}>
          <View style={styles.rowBetween}>
            <View style={[styles.liveBadge, { backgroundColor: theme.error + "18" }]}>
              <View style={[styles.liveDot, { backgroundColor: theme.error }]} />
              <ThemedText style={[styles.liveText, { color: theme.error }]}>{bn ? "লাইভ" : "LIVE"}</ThemedText>
            </View>
            <View style={styles.rowCenter}>
              {r.isPrivate ? <Feather name="lock" size={13} color={theme.textSecondary} style={{ marginRight: 6 }} /> : null}
              <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{voiceCategoryLabel(r.category, bn)}</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.title} numberOfLines={2}>
            {r.title}
          </ThemedText>
          {r.description ? (
            <ThemedText style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={2}>
              {r.description}
            </ThemedText>
          ) : null}
          <View style={[styles.rowBetween, { marginTop: Spacing.md }]}>
            <View style={styles.rowCenter}>
              <View style={styles.stack}>
                {r.stage.slice(0, 4).map((p, idx) => (
                  <View key={p.userId} style={[styles.stackItem, { marginLeft: idx === 0 ? 0 : -10, borderColor: theme.backgroundDefault }]}>
                    <UserAvatar name={p.name} avatar={p.avatar || undefined} size={30} presence={null} />
                  </View>
                ))}
                {extra > 0 ? (
                  <View style={[styles.more, { backgroundColor: theme.primary + "20", borderColor: theme.backgroundDefault }]}>
                    <ThemedText style={[styles.moreText, { color: theme.primary }]}>+{extra}</ThemedText>
                  </View>
                ) : null}
              </View>
              <View style={{ marginLeft: Spacing.sm }}>
                <ThemedText style={styles.hostName} numberOfLines={1}>
                  {r.hostName}
                </ThemedText>
                <View style={styles.rowCenter}>
                  <Feather name="mic" size={11} color={theme.textSecondary} />
                  <ThemedText style={[styles.small, { color: theme.textSecondary, marginLeft: 3 }]}>{r.speakers}</ThemedText>
                  <Feather name="headphones" size={11} color={theme.textSecondary} style={{ marginLeft: 10 }} />
                  <ThemedText style={[styles.small, { color: theme.textSecondary, marginLeft: 3 }]}>{r.listeners}</ThemedText>
                </View>
              </View>
            </View>
            <Pressable onPress={() => join(r)} style={[styles.joinBtn, { backgroundColor: theme.primary }]} accessibilityLabel={bn ? "যোগ দিন" : "Join"}>
              <ThemedText style={styles.joinText}>{r.hostId === myId ? (bn ? "ফিরে যান" : "Rejoin") : bn ? "যোগ দিন" : "Join"}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderUpcoming = (r: VoiceRoomCard, i: number) => {
    const mine = r.hostId === myId;
    return (
      <Animated.View key={r.id} entering={FadeInUp.delay(i * 40).duration(250)} style={[styles.upCard, card]}>
        <View style={[styles.upIcon, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="calendar" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <ThemedText style={[styles.small, { color: theme.primary, fontWeight: "600" }]}>{formatRoomTime(r.scheduledFor, bn)}</ThemedText>
          <ThemedText style={styles.upTitle} numberOfLines={1}>
            {r.title}
          </ThemedText>
          <ThemedText style={[styles.small, { color: theme.textSecondary }]} numberOfLines={1}>
            {mine ? (bn ? "আপনি হোস্ট" : "You're hosting") : r.hostName} · {voiceCategoryLabel(r.category, bn)}
            {r.isPrivate ? (bn ? " · প্রাইভেট" : " · Private") : ""}
          </ThemedText>
        </View>
        {mine ? (
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Pressable onPress={() => void startNow(r)} disabled={busy === r.id} style={[styles.smallBtn, { backgroundColor: theme.primary }]}>
              {busy === r.id ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.smallBtnText}>{bn ? "এখনই শুরু" : "Start now"}</ThemedText>}
            </Pressable>
            <Pressable onPress={() => cancel(r)} hitSlop={8}>
              <ThemedText style={[styles.small, { color: theme.error }]}>{bn ? "বাতিল" : "Cancel"}</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={() => void rooms.refetch()} tintColor={theme.primary} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: "all", en: "All", bn: "সব", icon: "grid" }, ...VOICE_CATEGORIES].map((c) => {
            const on = category === c.id;
            return (
              <Pressable key={c.id} onPress={() => setCategory(c.id)} style={[styles.chip, { backgroundColor: on ? theme.primary : theme.backgroundDefault, borderColor: on ? theme.primary : theme.border }]}>
                <ThemedText style={[styles.chipText, { color: on ? "#fff" : theme.text }]}>{bn ? c.bn : c.en}</ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <ThemedText style={styles.sectionTitle}>{bn ? "এখন লাইভ" : "Live now"}</ThemedText>
            {live.length ? <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{bn ? `${live.length}টি রুম` : `${live.length} ${live.length === 1 ? "room" : "rooms"}`}</ThemedText> : null}
          </View>
          {rooms.isLoading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.xl }} />
          ) : rooms.isError ? (
            <View style={[styles.empty, card]}>
              <Feather name="wifi-off" size={26} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>{bn ? "রুমগুলো আনা গেল না। টেনে আবার চেষ্টা করুন।" : "Couldn't load rooms. Pull down to try again."}</ThemedText>
            </View>
          ) : live.length ? (
            live.map(renderLive)
          ) : (
            <View style={[styles.empty, card]}>
              <Feather name="radio" size={28} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>{bn ? "এখন কোনো রুম লাইভ নেই।" : "No rooms are live right now."}</ThemedText>
            </View>
          )}
        </View>

        {upcoming.length ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{bn ? "আসন্ন আলোচনা" : "Upcoming talks"}</ThemedText>
            {upcoming.map(renderUpcoming)}
          </View>
        ) : null}
      </ScrollView>

      {perm.data?.canCreate ? (
        <Pressable
          onPress={() => navigation.navigate("VoiceRoomCreate")}
          style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 24 }, pressed && { transform: [{ scale: 0.97 }] }]}
          accessibilityLabel={bn ? "নতুন রুম" : "New room"}
          testID="voice-room-new"
        >
          <Feather name="plus" size={20} color="#fff" />
          <ThemedText style={styles.fabText}>{bn ? "নতুন রুম" : "New room"}</ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chips: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: Spacing.sm },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  liveCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  liveBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  liveText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: "700", marginTop: Spacing.sm },
  desc: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  small: { fontSize: 12 },
  stack: { flexDirection: "row", alignItems: "center" },
  stackItem: { borderWidth: 2, borderRadius: 20 },
  more: { marginLeft: -10, width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  moreText: { fontSize: 11, fontWeight: "700" },
  hostName: { fontSize: 13, fontWeight: "600", maxWidth: 140 },
  joinBtn: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20 },
  joinText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  upCard: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  upIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  upTitle: { fontSize: 15, fontWeight: "600", marginVertical: 1 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, minWidth: 74, alignItems: "center" },
  smallBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.xl, alignItems: "center", gap: Spacing.sm },
  emptyText: { fontSize: 14, textAlign: "center" },
  fab: { position: "absolute", right: 20, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, height: 50, borderRadius: 25, elevation: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
