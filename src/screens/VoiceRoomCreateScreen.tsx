// New voice room: name, description, category, the people on stage, schedule, seats, privacy.
import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, Platform, KeyboardAvoidingView } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@/components/icons/Feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { CustomSwitch } from "@/components/CustomSwitch";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { useCommunityStore } from "@/lib/communityStore";
import { resolveServerCommunityId } from "@/lib/feedApi";
import { searchPeople, type PersonCard } from "@/lib/liveDataApi";
import { VOICE_CATEGORIES, createVoiceRoom, fetchVoicePermission, VoiceRoomError } from "@/lib/voiceRoomApi";

type Picked = { id: string; name: string; avatar: string | null; profileRole: string | null; role: "speaker" | "moderator" };

const DAYS = 7;

export default function VoiceRoomCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { theme } = useTheme();
  const { language } = useI18n();
  const bn = language === "bn";
  const user: any = useAuthStore((s: any) => s.user);
  const activeCommunity = useCommunityStore((s) => s.activeCommunity);
  const perm = useQuery({ queryKey: ["voice-rooms-permission"], queryFn: fetchVoicePermission });
  const stageDefault = perm.data?.stageLimit ?? 8;
  const stageMax = perm.data?.stageMax ?? 20;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [people, setPeople] = useState<Picked[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [minutes, setMinutes] = useState(() => {
    const d = new Date();
    return Math.min(23 * 60 + 45, Math.ceil((d.getHours() * 60 + d.getMinutes() + 60) / 15) * 15);
  });
  const [stageLimit, setStageLimit] = useState<number | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [roleFor, setRoleFor] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seats = stageLimit ?? stageDefault;

  const when = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dayIdx);
    d.setMinutes(minutes);
    return d;
  }, [dayIdx, minutes]);

  const dayLabel = (i: number) => {
    if (i === 0) return bn ? "আজ" : "Today";
    if (i === 1) return bn ? "আগামীকাল" : "Tomorrow";
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString(bn ? "bn-BD" : "en-US", { weekday: "short", day: "numeric" });
  };
  const timeLabel = when.toLocaleTimeString(bn ? "bn-BD" : "en-US", { hour: "numeric", minute: "2-digit" });

  const addPerson = (p: PersonCard) => {
    if (p.id === String(user?.id)) return;
    setPeople((cur) => {
      if (cur.some((x) => x.id === p.id)) return cur.filter((x) => x.id !== p.id);
      if (cur.length >= seats - 1) {
        setError(bn ? `মঞ্চে আপনিসহ ${seats}টি আসন। আসন বাড়ান বা কাউকে সরান।` : `The stage has ${seats} seats, you included. Add seats or remove someone.`);
        return cur;
      }
      setError("");
      return [...cur, { id: p.id, name: p.name, avatar: p.avatar, profileRole: p.profileRole, role: "speaker" }];
    });
  };

  const submit = async () => {
    setError("");
    if (title.trim().length < 3) {
      setError(bn ? "রুমের একটি নাম দিন (অন্তত ৩ অক্ষর)।" : "Give the room a name (at least 3 letters).");
      return;
    }
    if (scheduled && when.getTime() < Date.now() + 60_000) {
      setError(bn ? "ভবিষ্যতের একটি সময় বেছে নিন।" : "Pick a start time in the future.");
      return;
    }
    setBusy(true);
    try {
      const share = shareToFeed && !isPrivate;
      const communityId = share ? await resolveServerCommunityId(activeCommunity as any).catch(() => null) : null;
      const r = await createVoiceRoom({
        title: title.trim(),
        description: description.trim(),
        category,
        isPrivate,
        shareToFeed: share && !!communityId,
        communityId,
        scheduledFor: scheduled ? when.toISOString() : null,
        stageLimit: seats,
        speakers: people.filter((p) => p.role === "speaker").map((p) => p.id),
        moderators: people.filter((p) => p.role === "moderator").map((p) => p.id),
      });
      void qc.invalidateQueries({ queryKey: ["voice-rooms"] });
      if (r.status === "live") navigation.replace("VoiceRoom", { roomId: r.id, isHost: true });
      else navigation.goBack();
    } catch (e: any) {
      if (e instanceof VoiceRoomError && e.code === "ALREADY_LIVE" && e.roomId) {
        navigation.replace("VoiceRoom", { roomId: e.roomId, isHost: true });
        return;
      }
      setError(e?.message && !/^HTTP/.test(e.message) ? e.message : bn ? "রুম বানানো গেল না। আবার চেষ্টা করুন।" : "Couldn't create the room. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const card = { backgroundColor: theme.backgroundDefault, borderColor: theme.border };
  const input = { color: theme.text };

  if (perm.data && !perm.data.canCreate) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Feather name="lock" size={34} color={theme.textSecondary} />
        <ThemedText style={[styles.blockText, { color: theme.textSecondary }]}>
          {perm.data.reason === "experts_only"
            ? bn
              ? "এখন শুধু বিশেষজ্ঞরা ভয়েস রুম শুরু করতে পারেন।"
              : "Right now only experts can start voice rooms."
            : bn
              ? "অ্যাডমিন আপনার অ্যাকাউন্টকে এখনো ভয়েস রুম শুরু করার অনুমতি দেননি।"
              : "The admin hasn't allowed your account to start voice rooms yet."}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.inputBox, card]}>
            <Feather name="radio" size={18} color={theme.primary} />
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={bn ? "রুমের নাম" : "Room name"}
              placeholderTextColor={theme.textTertiary}
              maxLength={80}
              style={[styles.input, input]}
              testID="voice-room-title"
            />
          </View>
          <View style={[styles.inputBox, card, { alignItems: "flex-start", minHeight: 88 }]}>
            <Feather name="align-left" size={18} color={theme.primary} style={{ marginTop: 3 }} />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={bn ? "বিবরণ (কী নিয়ে আলোচনা)" : "Description (what you'll talk about)"}
              placeholderTextColor={theme.textTertiary}
              maxLength={400}
              multiline
              style={[styles.input, input, { minHeight: 64, textAlignVertical: "top" }]}
            />
          </View>

          <ThemedText style={styles.label}>{bn ? "বিষয়" : "Category"}</ThemedText>
          <View style={styles.wrap}>
            {VOICE_CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <Pressable key={c.id} onPress={() => setCategory(c.id)} style={[styles.chip, { backgroundColor: on ? theme.primary : theme.backgroundDefault, borderColor: on ? theme.primary : theme.border }]}>
                  <Feather name={c.icon as any} size={13} color={on ? "#fff" : theme.textSecondary} />
                  <ThemedText style={[styles.chipText, { color: on ? "#fff" : theme.text }]}>{bn ? c.bn : c.en}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.rowBetween, { marginTop: Spacing.lg }]}>
            <ThemedText style={styles.label}>{bn ? "মঞ্চে যারা থাকবেন" : "On stage"}</ThemedText>
            <ThemedText style={[styles.small, { color: theme.textSecondary }]}>
              {people.length + 1}/{seats}
            </ThemedText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md, paddingVertical: 4 }}>
            <View style={styles.member}>
              <UserAvatar name={user?.name || ""} avatar={user?.avatar || undefined} badge={user?.profileRole || undefined} size={58} presence={null} />
              <ThemedText style={styles.memberName} numberOfLines={1}>
                {bn ? "আপনি" : "You"}
              </ThemedText>
              <ThemedText style={[styles.roleTag, { color: theme.primary }]}>{bn ? "হোস্ট" : "Host"}</ThemedText>
            </View>
            {people.map((p) => (
              <Pressable key={p.id} style={styles.member} onPress={() => setRoleFor(p)}>
                <UserAvatar name={p.name} avatar={p.avatar || undefined} badge={p.profileRole || undefined} size={58} presence={null} />
                <ThemedText style={styles.memberName} numberOfLines={1}>
                  {p.name}
                </ThemedText>
                <ThemedText style={[styles.roleTag, { color: p.role === "moderator" ? theme.accent : theme.textSecondary }]}>
                  {p.role === "moderator" ? (bn ? "মডারেটর" : "Moderator") : bn ? "বক্তা" : "Speaker"}
                </ThemedText>
              </Pressable>
            ))}
            <Pressable style={styles.member} onPress={() => setPickerOpen(true)} accessibilityLabel={bn ? "মানুষ যোগ করুন" : "Add people"}>
              <View style={[styles.addCircle, { borderColor: theme.primary }]}>
                <Feather name="plus" size={22} color={theme.primary} />
              </View>
              <ThemedText style={[styles.memberName, { color: theme.primary }]}>{bn ? "যোগ করুন" : "Add"}</ThemedText>
            </Pressable>
          </ScrollView>

          <ThemedText style={[styles.label, { marginTop: Spacing.lg }]}>{bn ? "সেটিংস" : "Settings"}</ThemedText>
          <View style={[styles.settings, card]}>
            <View style={styles.settingRow}>
              <Feather name="calendar" size={18} color={theme.textSecondary} />
              <View style={styles.settingText}>
                <ThemedText style={styles.settingTitle}>{bn ? "পরে শুরু করুন" : "Schedule for later"}</ThemedText>
                <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{scheduled ? `${dayLabel(dayIdx)}, ${timeLabel}` : bn ? "এখনই লাইভ হবে" : "Goes live now"}</ThemedText>
              </View>
              <CustomSwitch value={scheduled} onValueChange={setScheduled} accessibilityLabel={bn ? "পরে শুরু করুন" : "Schedule for later"} />
            </View>
            {scheduled ? (
              <View style={{ paddingBottom: Spacing.md }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: Spacing.md }}>
                  {Array.from({ length: DAYS }, (_, i) => (
                    <Pressable key={i} onPress={() => setDayIdx(i)} style={[styles.dayChip, { backgroundColor: dayIdx === i ? theme.primary : theme.backgroundSecondary }]}>
                      <ThemedText style={[styles.chipText, { color: dayIdx === i ? "#fff" : theme.text }]}>{dayLabel(i)}</ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.timeRow}>
                  <Pressable onPress={() => setMinutes((m) => (m + 1440 - 15) % 1440)} style={[styles.stepBtn, { backgroundColor: theme.backgroundSecondary }]} accessibilityLabel="-15">
                    <Feather name="minus" size={18} color={theme.text} />
                  </Pressable>
                  <ThemedText style={styles.timeText}>{timeLabel}</ThemedText>
                  <Pressable onPress={() => setMinutes((m) => (m + 15) % 1440)} style={[styles.stepBtn, { backgroundColor: theme.backgroundSecondary }]} accessibilityLabel="+15">
                    <Feather name="plus" size={18} color={theme.text} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.settingRow}>
              <Feather name="users" size={18} color={theme.textSecondary} />
              <View style={styles.settingText}>
                <ThemedText style={styles.settingTitle}>{bn ? "মঞ্চের আসন" : "Stage seats"}</ThemedText>
                <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{bn ? "আপনিসহ কতজন কথা বলতে পারবেন" : "How many can speak, you included"}</ThemedText>
              </View>
              <View style={styles.stepper}>
                <Pressable onPress={() => setStageLimit(Math.max(Math.max(2, people.length + 1), seats - 1))} style={[styles.stepSm, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="minus" size={15} color={theme.text} />
                </Pressable>
                <ThemedText style={styles.stepValue}>{seats}</ThemedText>
                <Pressable onPress={() => setStageLimit(Math.min(stageMax, seats + 1))} style={[styles.stepSm, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="plus" size={15} color={theme.text} />
                </Pressable>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.settingRow}>
              <Feather name="lock" size={18} color={theme.textSecondary} />
              <View style={styles.settingText}>
                <ThemedText style={styles.settingTitle}>{bn ? "প্রাইভেট রুম" : "Private room"}</ThemedText>
                <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{bn ? "শুধু আপনার যোগ করা মানুষ যোগ দিতে পারবেন" : "Only people you added can join"}</ThemedText>
              </View>
              <CustomSwitch value={isPrivate} onValueChange={setIsPrivate} accessibilityLabel={bn ? "প্রাইভেট রুম" : "Private room"} />
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Pressable
              onPress={() => !isPrivate && setShareToFeed((v) => !v)}
              disabled={isPrivate}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: shareToFeed && !isPrivate, disabled: isPrivate }}
              aria-checked={shareToFeed && !isPrivate}
              accessibilityLabel={bn ? "কমিউনিটি ফিডে শেয়ার করুন" : "Share to community feed"}
              style={[styles.settingRow, isPrivate && { opacity: 0.45 }]}
              testID="voice-room-share"
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: shareToFeed && !isPrivate ? theme.primary : theme.textSecondary,
                  backgroundColor: shareToFeed && !isPrivate ? theme.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {shareToFeed && !isPrivate ? <Feather name="check" size={14} color="#fff" /> : null}
              </View>
              <View style={styles.settingText}>
                <ThemedText style={styles.settingTitle}>{bn ? "কমিউনিটি ফিডে শেয়ার করুন" : "Share to community feed"}</ThemedText>
                <ThemedText style={[styles.small, { color: theme.textSecondary }]}>
                  {isPrivate
                    ? bn ? "প্রাইভেট রুম ফিডে যায় না" : "Private rooms aren't shared"
                    : bn ? "রুমের বিবরণসহ একটি কার্ড যাবে, চাপ দিলেই যোগ দেওয়া যাবে" : "Posts a card with the room's details that people tap to join"}
                </ThemedText>
              </View>
            </Pressable>
          </View>

          {error ? <ThemedText style={[styles.error, { color: theme.error }]}>{error}</ThemedText> : null}
        </ScrollView>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot, borderTopColor: theme.border }]}>
          <Pressable onPress={() => void submit()} disabled={busy} style={({ pressed }) => [styles.start, { backgroundColor: theme.primary }, (pressed || busy) && { opacity: 0.85 }]} testID="voice-room-start">
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name={scheduled ? "calendar" : "mic"} size={18} color="#fff" />
                <ThemedText style={styles.startText}>{scheduled ? (bn ? "রুমের সময় ঠিক করুন" : "Schedule room") : bn ? "এখনই শুরু করুন" : "Start room"}</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <PeoplePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} picked={people.map((p) => p.id)} onPick={addPerson} myId={String(user?.id || "")} bn={bn} />

      <Modal visible={!!roleFor} transparent animationType="slide" onRequestClose={() => setRoleFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setRoleFor(null)} />
        <View style={[styles.sheet, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <ThemedText style={styles.sheetTitle}>{roleFor?.name}</ThemedText>
          {([
            ["speaker", "mic", bn ? "বক্তা" : "Speaker", bn ? "কথা বলতে পারবেন" : "Can talk on stage"],
            ["moderator", "shield", bn ? "মডারেটর" : "Moderator", bn ? "কথা বলা ও রুম সামলানো" : "Talks and helps run the room"],
          ] as const).map(([role, icon, name, sub]) => (
            <Pressable
              key={role}
              style={styles.sheetRow}
              onPress={() => {
                setPeople((cur) => cur.map((x) => (x.id === roleFor?.id ? { ...x, role } : x)));
                setRoleFor(null);
              }}
            >
              <Feather name={icon} size={18} color={theme.text} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText style={styles.settingTitle}>{name}</ThemedText>
                <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{sub}</ThemedText>
              </View>
              {roleFor?.role === role ? <Feather name="check" size={18} color={theme.primary} /> : null}
            </Pressable>
          ))}
          <Pressable
            style={styles.sheetRow}
            onPress={() => {
              setPeople((cur) => cur.filter((x) => x.id !== roleFor?.id));
              setRoleFor(null);
            }}
          >
            <Feather name="user-minus" size={18} color={theme.error} />
            <ThemedText style={[styles.settingTitle, { color: theme.error, marginLeft: Spacing.md }]}>{bn ? "সরিয়ে দিন" : "Remove"}</ThemedText>
          </Pressable>
        </View>
      </Modal>
    </ThemedView>
  );
}

function PeoplePicker({ visible, onClose, picked, onPick, myId, bn }: { visible: boolean; onClose: () => void; picked: string[]; onPick: (p: PersonCard) => void; myId: string; bn: boolean }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [list, setList] = useState<PersonCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchPeople(q.trim())
        .then((r) => alive && setList((r || []).filter((p) => p.id !== myId)))
        .catch(() => alive && setList([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, visible, myId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, styles.tallSheet, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <View style={styles.rowBetween}>
          <ThemedText style={styles.sheetTitle}>{bn ? "মঞ্চে যোগ করুন" : "Add to stage"}</ThemedText>
          <Pressable onPress={onClose} hitSlop={10}>
            <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>{bn ? "হয়েছে" : "Done"}</ThemedText>
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput value={q} onChangeText={setQ} placeholder={bn ? "নাম দিয়ে খুঁজুন" : "Search by name"} placeholderTextColor={theme.textTertiary} style={[styles.input, { color: theme.text }]} autoFocus={Platform.OS === "web"} />
        </View>
        {loading && !list.length ? <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.lg }} /> : null}
        <ScrollView keyboardShouldPersistTaps="handled">
          {list.map((p) => {
            const on = picked.includes(p.id);
            return (
              <Pressable key={p.id} onPress={() => onPick(p)} style={styles.personRow}>
                <UserAvatar name={p.name} avatar={p.avatar || undefined} badge={p.profileRole || p.farmingCategory || undefined} size={42} userId={p.id} />
                <ThemedText style={[styles.settingTitle, { flex: 1, marginLeft: Spacing.md }]} numberOfLines={1}>
                  {p.name}
                </ThemedText>
                <View style={[styles.check, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary : "transparent" }]}>
                  {on ? <Feather name="check" size={14} color="#fff" /> : null}
                </View>
              </Pressable>
            );
          })}
          {!loading && !list.length ? <ThemedText style={[styles.small, { color: theme.textSecondary, textAlign: "center", marginTop: Spacing.lg }]}>{bn ? "কাউকে পাওয়া যায়নি" : "No one found"}</ThemedText> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.md },
  blockText: { textAlign: "center", fontSize: 15, lineHeight: 22 },
  inputBox: { flexDirection: "row", alignItems: "center", gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 4, marginBottom: Spacing.md },
  input: { flex: 1, fontSize: 15, paddingVertical: 10, outlineStyle: "none" as any },
  label: { fontSize: 14, fontWeight: "700", marginBottom: Spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  small: { fontSize: 12 },
  member: { width: 72, alignItems: "center" },
  memberName: { fontSize: 12, fontWeight: "600", marginTop: 6, maxWidth: 72 },
  roleTag: { fontSize: 11, fontWeight: "600" },
  addCircle: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  settings: { borderWidth: 1, borderRadius: BorderRadius.lg, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.md },
  settingText: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.lg, marginTop: Spacing.md },
  stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  timeText: { fontSize: 22, fontWeight: "700", minWidth: 110, textAlign: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepSm: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 16, fontWeight: "700", minWidth: 22, textAlign: "center" },
  error: { marginTop: Spacing.md, fontSize: 14 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  start: { height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  startText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  tallSheet: { height: "75%" },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: Spacing.md },
  sheetTitle: { fontSize: 17, fontWeight: "700", marginBottom: Spacing.sm },
  sheetRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, marginVertical: Spacing.sm },
  personRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
