// Inside a voice room: the stage (host, moderators, speakers), the listeners, raised hands,
// emoji reactions, the room's text chat, and mic / hand / leave controls.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { askConfirm } from "@/components/ConfirmSheet";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { initialsOf } from "@/lib/feedApi";
import { useVoiceRoom, type FloatingReaction } from "@/lib/voiceRoom/useVoiceRoom";
import { REACTIONS, onStage, voiceCategoryLabel, voiceReasonText, type VoiceMember, type VoiceRole } from "@/lib/voiceRoomApi";

const ROLE_ORDER: Record<VoiceRole, number> = { host: 0, moderator: 1, speaker: 2, audience: 3 };

export default function VoiceRoomScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const roomId: string = route.params?.roomId;
  const preview = route.params?.room;
  const { theme } = useTheme();
  const { language } = useI18n();
  const bn = language === "bn";
  const { height } = useWindowDimensions();
  const vr = useVoiceRoom(roomId);
  const { room, me, myId, actions } = vr;

  const [person, setPerson] = useState<VoiceMember | null>(null);
  const [stageSheet, setStageSheet] = useState(false);
  const [audienceSheet, setAudienceSheet] = useState(false);
  const [handsSheet, setHandsSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const chatScroll = useRef<ScrollView>(null);
  const allowLeave = useRef(false);

  const L = (en: string, b: string) => (bn ? b : en);
  const isHost = me?.role === "host";
  const isManager = me?.role === "host" || me?.role === "moderator";
  const iAmOnStage = !!me && onStage(me.role);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Sorted people.
  const stage = useMemo(
    () => (room?.members || []).filter((m) => onStage(m.role)).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name)),
    [room],
  );
  const audience = useMemo(
    () =>
      (room?.members || [])
        .filter((m) => m.role === "audience")
        .sort((a, b) => (a.hand === b.hand ? (a.hand ? a.handAt - b.handAt : a.name.localeCompare(b.name)) : a.hand ? -1 : 1)),
    [room],
  );
  const hands = audience.filter((m) => m.hand);
  const shown = room?.stageShown ?? 8;
  const seatCount = Math.min(room?.stageLimit ?? shown, shown);
  const overflow = stage.length > shown;
  const stageVisible = overflow ? stage.slice(0, shown - 1) : stage;
  const emptySeats = overflow ? 0 : Math.max(0, seatCount - stage.length);

  // Toasts from the room.
  useEffect(() => {
    const n = vr.notice;
    if (!n) return;
    const nameOf = (id: string) => room?.members.find((m) => m.userId === id)?.name || L("The host", "হোস্ট");
    let text = "";
    if (n.kind === "on_stage") text = L("You're on stage. Tap the mic to talk.", "আপনি মঞ্চে। কথা বলতে মাইকে ট্যাপ করুন।");
    else if (n.kind === "off_stage") text = L("You're back in the audience.", "আপনি আবার শ্রোতাদের মধ্যে।");
    else if (n.kind === "muted_by") text = L(`${nameOf(n.by)} muted you.`, `${nameOf(n.by)} আপনাকে মিউট করেছেন।`);
    else if (n.kind === "hand_declined") text = L("The host didn't bring you up this time.", "এবার হোস্ট আপনাকে মঞ্চে আনেননি।");
    else if (n.kind === "made_moderator") text = L("You're a moderator now.", "আপনি এখন মডারেটর।");
    else if (n.kind === "hand_raised") text = L(`${n.name} raised a hand`, `${n.name} হাত তুলেছেন`);
    else if (n.kind === "error") text = voiceReasonText(n.reason, bn);
    vr.clearNotice();
    if (!text) return;
    setToast(text);
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vr.notice]);

  // Chat: scroll to the newest, count unread while closed.
  const lastLen = useRef(0);
  useEffect(() => {
    if (vr.chat.length > lastLen.current && !chatOpen) setUnread((u) => u + (vr.chat.length - lastLen.current));
    lastLen.current = vr.chat.length;
    setTimeout(() => chatScroll.current?.scrollToEnd({ animated: true }), 50);
  }, [vr.chat.length, chatOpen]);

  // The host leaving ends the room: ask first.
  useEffect(() => {
    const off = navigation.addListener("beforeRemove", (e: any) => {
      if (allowLeave.current || vr.status !== "live" || !isHost) return;
      e.preventDefault();
      confirmEnd(() => {
        allowLeave.current = true;
        navigation.dispatch(e.data.action);
      });
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, vr.status, isHost]);

  const ask = (title: string, body: string, yes: string, onYes: () => void) => {
    if (Platform.OS === "web") {
      void askConfirm({ title, message: body, confirmText: yes, cancelText: L("Cancel", "বাতিল"), tone: "danger" }).then((ok) => { if (ok) onYes(); });
      return;
    }
    Alert.alert(title, body, [
      { text: L("Cancel", "বাতিল"), style: "cancel" },
      { text: yes, style: "destructive", onPress: onYes },
    ]);
  };

  const confirmEnd = (after?: () => void) =>
    ask(L("End the room?", "রুম শেষ করবেন?"), L("You're the host, so the room ends for everyone.", "আপনি হোস্ট, তাই সবার জন্য রুম শেষ হবে।"), L("End room", "শেষ করুন"), () => {
      actions.end();
      allowLeave.current = true;
      if (after) after();
      else navigation.goBack();
    });

  const leave = () => {
    if (isHost && vr.status === "live") return confirmEnd();
    actions.leave();
    allowLeave.current = true;
    navigation.goBack();
  };

  const tapHaptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const sendChat = () => {
    const t = draft.trim();
    if (!t) return;
    if (actions.sendChat(t)) setDraft("");
  };

  const openProfile = (m: VoiceMember) => {
    setPerson(null);
    navigation.navigate("UserProfile", {
      user: { id: m.userId, name: m.name, initials: initialsOf(m.name), avatar: m.avatar || undefined, role: m.profileRole || "farmer", verified: false, followersCount: 0, followingCount: 0, location: "", bio: "" } as any,
    });
  };

  const roleName = (r: VoiceRole) =>
    r === "host" ? L("Host", "হোস্ট") : r === "moderator" ? L("Moderator", "মডারেটর") : r === "speaker" ? L("Speaker", "বক্তা") : L("Listener", "শ্রোতা");
  const roleColor = (r: VoiceRole) => (r === "host" ? theme.primary : r === "moderator" ? theme.accent : theme.textSecondary);

  // ---------------- ended / error states
  if (vr.status !== "live" && vr.status !== "connecting") {
    const icon = vr.status === "removed" ? "user-x" : vr.status === "error" ? "alert-circle" : "radio";
    const text = vr.reason === "left" ? L("You left the room.", "আপনি রুম ছেড়েছেন।") : voiceReasonText(vr.reason || "ended", bn);
    return (
      <ThemedView style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <View style={[styles.endIcon, { backgroundColor: theme.primary + "15" }]}>
          <Feather name={icon as any} size={30} color={theme.primary} />
        </View>
        <ThemedText style={styles.endText}>{text}</ThemedText>
        <Pressable onPress={() => { allowLeave.current = true; navigation.goBack(); }} style={[styles.endBtn, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.endBtnText}>{L("Back to rooms", "রুমের তালিকায় ফিরুন")}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const title = room?.title || preview?.title || "";

  const Seat = ({ m, size = 62 }: { m: VoiceMember; size?: number }) => (
    <Pressable onPress={() => setPerson(m)} style={[styles.seat, !m.online && { opacity: 0.45 }]} testID={`vr-seat-${m.userId}`}>
      <View>
        <View style={[styles.ring, { borderColor: m.role === "host" ? theme.primary : m.role === "moderator" ? theme.accent : "transparent", width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
          <UserAvatar name={m.name} avatar={m.avatar || undefined} badge={m.profileRole || undefined} size={size} presence={null} />
        </View>
        {onStage(m.role) && m.muted ? (
          <View style={[styles.micBadge, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="mic-off" size={11} color={theme.error} />
          </View>
        ) : null}
        {m.hand ? (
          <View style={[styles.handBadge, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={{ fontSize: 14 }}>{"\u270B"}</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={styles.seatName} numberOfLines={1}>
        {m.userId === myId ? L("You", "আপনি") : m.name}
      </ThemedText>
      {onStage(m.role) ? <ThemedText style={[styles.seatRole, { color: roleColor(m.role) }]}>{roleName(m.role)}</ThemedText> : null}
    </Pressable>
  );

  const chatHeight = Math.max(170, Math.min(280, height * 0.3));

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={leave} hitSlop={10} style={styles.iconBtn} accessibilityLabel={L("Back", "ফিরে যান")}>
          <Feather name="chevron-down" size={26} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={styles.rowCenter}>
            <View style={[styles.liveDot, { backgroundColor: vr.status === "live" ? theme.error : theme.textTertiary }]} />
            <ThemedText style={[styles.small, { color: theme.textSecondary, fontWeight: "700" }]}>
              {vr.status === "live" ? L("LIVE", "লাইভ") : L("Connecting…", "যুক্ত হচ্ছে…")}
              {room ? ` · ${room.members.length} ${L(room.members.length === 1 ? "person" : "people", "জন")}` : ""}
            </ThemedText>
          </View>
        </View>
        <Pressable onPress={() => setMenu(true)} hitSlop={10} style={styles.iconBtn} accessibilityLabel={L("More", "আরও")}>
          <Feather name="more-horizontal" size={22} color={theme.text} />
        </Pressable>
      </View>

      {!vr.isConnected && vr.status === "live" ? (
        <View style={[styles.offline, { backgroundColor: theme.warning + "25" }]}>
          <ThemedText style={[styles.small, { color: theme.text }]}>{voiceReasonText("offline", bn)}</ThemedText>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {room?.description ? <ThemedText style={[styles.desc, { color: theme.textSecondary }]}>{room.description}</ThemedText> : null}
        {room ? (
          <View style={[styles.rowCenter, { marginTop: 6, gap: 8 }]}>
            <View style={[styles.tag, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.tagText, { color: theme.primary }]}>{voiceCategoryLabel(room.category, bn)}</ThemedText>
            </View>
            {room.isPrivate ? (
              <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="lock" size={11} color={theme.textSecondary} />
                <ThemedText style={[styles.tagText, { color: theme.textSecondary }]}>{L("Private", "প্রাইভেট")}</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {!room ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Raised hands (host and moderators) */}
            {isManager && hands.length ? (
              <Pressable onPress={() => setHandsSheet(true)} style={[styles.handsBar, { backgroundColor: theme.accent + "18" }]} testID="vr-hands">
                <ThemedText style={{ fontSize: 18 }}>{"\u270B"}</ThemedText>
                <ThemedText style={[styles.handsText, { color: theme.text }]}>
                  {bn ? `${hands.length} জন হাত তুলেছেন` : `${hands.length} ${hands.length === 1 ? "hand" : "hands"} raised`}
                </ThemedText>
                <ThemedText style={[styles.small, { color: theme.primary, fontWeight: "700" }]}>{L("Review", "দেখুন")}</ThemedText>
              </Pressable>
            ) : null}

            {/* Stage */}
            <View style={[styles.sectionHead, { marginTop: Spacing.lg }]}>
              <ThemedText style={styles.sectionTitle}>
                {L("On stage", "মঞ্চে")} <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{stage.length}/{room.stageLimit}</ThemedText>
              </ThemedText>
              {stage.length > 4 ? (
                <Pressable onPress={() => setStageSheet(true)} hitSlop={8} testID="vr-stage-more">
                  <ThemedText style={[styles.small, { color: theme.primary, fontWeight: "700" }]}>{L("See all", "সব দেখুন")}</ThemedText>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.grid}>
              {stageVisible.map((m) => (
                <Seat key={m.userId} m={m} />
              ))}
              {overflow ? (
                <Pressable onPress={() => setStageSheet(true)} style={styles.seat} testID="vr-stage-more-seat" accessibilityLabel={L("More people on stage", "মঞ্চে আরও মানুষ")}>
                  <View style={[styles.moreSeat, { backgroundColor: theme.primary + "15" }]}>
                    <ThemedText style={[styles.moreSeatText, { color: theme.primary }]}>+{stage.length - stageVisible.length}</ThemedText>
                  </View>
                  <ThemedText style={[styles.seatName, { color: theme.primary }]}>{L("More", "আরও")}</ThemedText>
                </Pressable>
              ) : null}
              {Array.from({ length: emptySeats }, (_, i) => (
                <Pressable
                  key={`empty-${i}`}
                  style={styles.seat}
                  onPress={() => {
                    if (me?.role === "audience" && !me.hand) {
                      tapHaptic();
                      actions.raiseHand(true);
                    }
                  }}
                >
                  <View style={[styles.emptySeat, { borderColor: theme.border }]}>
                    <Feather name="mic" size={18} color={theme.textTertiary} />
                  </View>
                  <ThemedText style={[styles.seatName, { color: theme.textTertiary }]}>{L("Empty", "খালি")}</ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Listeners */}
            <View style={[styles.sectionHead, { marginTop: Spacing.lg }]}>
              <ThemedText style={styles.sectionTitle}>
                {L("Listeners", "শ্রোতা")} <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{audience.length}</ThemedText>
              </ThemedText>
              {audience.length > 8 ? (
                <Pressable onPress={() => setAudienceSheet(true)} hitSlop={8}>
                  <ThemedText style={[styles.small, { color: theme.primary, fontWeight: "700" }]}>{L("See all", "সব দেখুন")}</ThemedText>
                </Pressable>
              ) : null}
            </View>
            {audience.length ? (
              <View style={styles.grid}>
                {audience.slice(0, 8).map((m) => (
                  <Seat key={m.userId} m={m} size={50} />
                ))}
              </View>
            ) : (
              <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{L("No listeners yet.", "এখনো কোনো শ্রোতা নেই।")}</ThemedText>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating reactions */}
      <View pointerEvents="none" style={[styles.reactLayer, { bottom: (chatOpen ? chatHeight : 0) + 90 + insets.bottom }]}>
        {vr.reactions.map((r, i) => (
          <FloatingEmoji key={r.id} r={r} index={i} name={room?.members.find((m) => m.userId === r.userId)?.name} />
        ))}
      </View>

      {toast ? (
        <Animated.View entering={FadeInDown} exiting={FadeOut} style={[styles.toast, { top: insets.top + 56, backgroundColor: theme.text }]}>
          <ThemedText style={[styles.toastText, { color: theme.backgroundRoot }]}>{toast}</ThemedText>
        </Animated.View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Chat box */}
        {chatOpen ? (
          <View style={[styles.chat, { height: chatHeight, backgroundColor: theme.backgroundDefault, borderTopColor: theme.border }]}>
            <View style={styles.chatHead}>
              <ThemedText style={styles.chatTitle}>{L("Room chat", "রুম চ্যাট")}</ThemedText>
              <Pressable onPress={() => setChatOpen(false)} hitSlop={10} accessibilityLabel={L("Hide chat", "চ্যাট লুকান")}>
                <Feather name="chevron-down" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView ref={chatScroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 6 }}>
              {vr.chat.length === 0 ? (
                <ThemedText style={[styles.small, { color: theme.textTertiary, textAlign: "center", marginTop: Spacing.md }]}>
                  {room?.chatOn === false ? L("The host turned the chat off.", "হোস্ট চ্যাট বন্ধ করেছেন।") : L("Say hello to the room.", "রুমে সবাইকে শুভেচ্ছা জানান।")}
                </ThemedText>
              ) : (
                vr.chat.map((c) => (
                  <Pressable
                    key={c.id}
                    onLongPress={() => {
                      if (c.userId === myId || isManager)
                        ask(L("Delete message?", "বার্তা মুছবেন?"), c.text.slice(0, 80), L("Delete", "মুছুন"), () => actions.deleteChat(c.id));
                    }}
                    style={styles.msg}
                  >
                    <UserAvatar name={c.name} avatar={c.avatar || undefined} size={26} presence={null} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <View style={styles.rowCenter}>
                        <ThemedText style={[styles.msgName, { color: c.userId === myId ? theme.primary : theme.text }]} numberOfLines={1}>
                          {c.userId === myId ? L("You", "আপনি") : c.name}
                        </ThemedText>
                        {c.role !== "audience" ? <ThemedText style={[styles.msgRole, { color: roleColor(c.role) }]}>{roleName(c.role)}</ThemedText> : null}
                      </View>
                      <ThemedText style={styles.msgText}>{c.text}</ThemedText>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <View style={[styles.inputRow, { borderTopColor: theme.border }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                editable={room?.chatOn !== false || isManager}
                placeholder={room?.chatOn === false && !isManager ? L("Chat is off", "চ্যাট বন্ধ") : L("Write a message…", "বার্তা লিখুন…")}
                placeholderTextColor={theme.textTertiary}
                style={[styles.chatInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                maxLength={500}
                onSubmitEditing={sendChat}
                returnKeyType="send"
                blurOnSubmit={false}
                testID="vr-chat-input"
              />
              <Pressable onPress={sendChat} disabled={!draft.trim()} style={[styles.sendBtn, { backgroundColor: draft.trim() ? theme.primary : theme.backgroundSecondary }]} accessibilityLabel={L("Send", "পাঠান")} testID="vr-chat-send">
                <Feather name="send" size={16} color={draft.trim() ? "#fff" : theme.textTertiary} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Emoji row */}
        {emojiOpen ? (
          <Animated.View entering={FadeIn.duration(150)} style={[styles.emojiRow, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border }]}>
            {REACTIONS.map((e) => (
              <Pressable
                key={e}
                onPress={() => {
                  tapHaptic();
                  actions.react(e);
                }}
                style={styles.emojiBtn}
              >
                <ThemedText style={{ fontSize: 26 }}>{e}</ThemedText>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}

        {/* Controls */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 10, backgroundColor: theme.backgroundRoot, borderTopColor: theme.border }]}>
          <Pressable onPress={leave} style={[styles.leaveBtn, { backgroundColor: theme.error + "15" }]} testID="vr-leave">
            <Feather name="log-out" size={16} color={theme.error} />
            <ThemedText style={[styles.leaveText, { color: theme.error }]}>{isHost ? L("End", "শেষ") : L("Leave", "ছাড়ুন")}</ThemedText>
          </Pressable>
          <View style={{ flex: 1 }} />
          <CtrlBtn icon="smile" active={emojiOpen} onPress={() => setEmojiOpen((v) => !v)} label={L("React", "রিঅ্যাক্ট")} />
          <CtrlBtn
            icon="message-circle"
            active={chatOpen}
            badge={!chatOpen && unread > 0 ? unread : 0}
            onPress={() => {
              setChatOpen((v) => !v);
              setUnread(0);
            }}
            label={L("Chat", "চ্যাট")}
          />
          {iAmOnStage ? (
            <Pressable
              onPress={() => {
                tapHaptic();
                actions.setMuted(!me?.muted);
              }}
              style={[styles.micBtn, { backgroundColor: me?.muted ? theme.backgroundSecondary : theme.primary }]}
              accessibilityLabel={me?.muted ? L("Unmute", "আনমিউট") : L("Mute", "মিউট")}
              testID="vr-mic"
            >
              <Feather name={me?.muted ? "mic-off" : "mic"} size={24} color={me?.muted ? theme.text : "#fff"} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                tapHaptic();
                actions.raiseHand(!me?.hand);
              }}
              style={[styles.micBtn, { backgroundColor: me?.hand ? theme.accent : theme.backgroundSecondary }]}
              accessibilityLabel={me?.hand ? L("Lower hand", "হাত নামান") : L("Raise hand", "হাত তুলুন")}
              testID="vr-hand"
            >
              <ThemedText style={{ fontSize: 24 }}>{"\u270B"}</ThemedText>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Full stage roster */}
      <Sheet visible={stageSheet} onClose={() => setStageSheet(false)} title={`${L("On stage", "মঞ্চে")} · ${stage.length}`} tall>
        {stage.map((m) => (
          <PersonRow key={m.userId} m={m} me={myId} roleName={roleName} roleColor={roleColor} onPress={() => { setStageSheet(false); setPerson(m); }} />
        ))}
      </Sheet>

      {/* All listeners */}
      <Sheet visible={audienceSheet} onClose={() => setAudienceSheet(false)} title={`${L("Listeners", "শ্রোতা")} · ${audience.length}`} tall>
        {audience.map((m) => (
          <PersonRow key={m.userId} m={m} me={myId} roleName={roleName} roleColor={roleColor} onPress={() => { setAudienceSheet(false); setPerson(m); }} />
        ))}
      </Sheet>

      {/* Raised hands */}
      <Sheet visible={handsSheet} onClose={() => setHandsSheet(false)} title={L("Raised hands", "হাত তোলা")} tall>
        {hands.length === 0 ? (
          <ThemedText style={[styles.small, { color: theme.textSecondary, textAlign: "center", marginVertical: Spacing.lg }]}>{L("No raised hands right now.", "এখন কেউ হাত তোলেনি।")}</ThemedText>
        ) : (
          hands.map((m) => (
            <View key={m.userId} style={styles.personRow}>
              <UserAvatar name={m.name} avatar={m.avatar || undefined} badge={m.profileRole || undefined} size={42} presence={null} />
              <ThemedText style={[styles.personName, { flex: 1 }]} numberOfLines={1}>
                {m.name}
              </ThemedText>
              <Pressable onPress={() => actions.reject(m.userId)} style={[styles.pill, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.pillText, { color: theme.text }]}>{L("Decline", "না")}</ThemedText>
              </Pressable>
              <Pressable onPress={() => actions.accept(m.userId)} style={[styles.pill, { backgroundColor: theme.primary, marginLeft: 6 }]} testID={`vr-accept-${m.userId}`}>
                <ThemedText style={[styles.pillText, { color: "#fff" }]}>{L("Bring up", "মঞ্চে আনুন")}</ThemedText>
              </Pressable>
            </View>
          ))
        )}
      </Sheet>

      {/* One person */}
      <Sheet visible={!!person} onClose={() => setPerson(null)}>
        {person ? (
          <PersonActions
            m={room?.members.find((x) => x.userId === person.userId) || person}
            me={me}
            bn={bn}
            roleName={roleName}
            onProfile={openProfile}
            onDone={() => setPerson(null)}
            actions={actions}
            stageFull={stage.length >= (room?.stageLimit ?? 8)}
          />
        ) : null}
      </Sheet>

      {/* Room menu */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title={L("Room", "রুম")}>
        {isHost && room ? (
          <>
            <View style={styles.menuRow}>
              <Feather name="users" size={18} color={theme.text} />
              <ThemedText style={[styles.menuText, { flex: 1 }]}>{L("Stage seats", "মঞ্চের আসন")}</ThemedText>
              <Pressable onPress={() => actions.setStageLimit(room.stageLimit - 1)} style={[styles.stepSm, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="minus" size={15} color={theme.text} />
              </Pressable>
              <ThemedText style={styles.stepValue}>{room.stageLimit}</ThemedText>
              <Pressable onPress={() => actions.setStageLimit(Math.min(room.stageMax, room.stageLimit + 1))} style={[styles.stepSm, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="plus" size={15} color={theme.text} />
              </Pressable>
            </View>
            <Pressable style={styles.menuRow} onPress={() => actions.setChatOn(!room.chatOn)}>
              <Feather name={room.chatOn ? "message-square" : "slash"} size={18} color={theme.text} />
              <ThemedText style={[styles.menuText, { flex: 1 }]}>{room.chatOn ? L("Turn chat off", "চ্যাট বন্ধ করুন") : L("Turn chat on", "চ্যাট চালু করুন")}</ThemedText>
            </Pressable>
          </>
        ) : null}
        {iAmOnStage && !isHost ? (
          <Pressable style={styles.menuRow} onPress={() => { setMenu(false); actions.toAudience(); }}>
            <Feather name="arrow-down-circle" size={18} color={theme.text} />
            <ThemedText style={styles.menuText}>{L("Leave the stage", "মঞ্চ থেকে নামুন")}</ThemedText>
          </Pressable>
        ) : null}
        {Platform.OS !== "web" ? (
          <SpeakerRow bn={bn} onChange={actions.setSpeaker} />
        ) : null}
        <Pressable style={styles.menuRow} onPress={() => { setMenu(false); leave(); }}>
          <Feather name="log-out" size={18} color={theme.error} />
          <ThemedText style={[styles.menuText, { color: theme.error }]}>{isHost ? L("End room for everyone", "সবার জন্য রুম শেষ করুন") : L("Leave quietly", "চুপচাপ ছেড়ে যান")}</ThemedText>
        </Pressable>
      </Sheet>

      {/* Invited to speak */}
      <Modal visible={vr.pendingInvite !== null} transparent animationType="fade" onRequestClose={() => actions.answerInvite(false)}>
        <View style={styles.dialogBack}>
          <View style={[styles.dialog, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={{ fontSize: 34, textAlign: "center" }}>{"\u{1F399}\uFE0F"}</ThemedText>
            <ThemedText style={styles.dialogTitle}>
              {L(
                `${room?.members.find((m) => m.userId === vr.pendingInvite)?.name || "The host"} invited you to speak`,
                `${room?.members.find((m) => m.userId === vr.pendingInvite)?.name || "হোস্ট"} আপনাকে কথা বলতে ডেকেছেন`,
              )}
            </ThemedText>
            <ThemedText style={[styles.small, { color: theme.textSecondary, textAlign: "center" }]}>{L("You'll join the stage muted.", "আপনি মিউট অবস্থায় মঞ্চে যাবেন।")}</ThemedText>
            <View style={[styles.rowCenter, { gap: 10, marginTop: Spacing.lg }]}>
              <Pressable onPress={() => actions.answerInvite(false)} style={[styles.dialogBtn, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={{ fontWeight: "700" }}>{L("Not now", "এখন না")}</ThemedText>
              </Pressable>
              <Pressable onPress={() => actions.answerInvite(true)} style={[styles.dialogBtn, { backgroundColor: theme.primary }]} testID="vr-invite-accept">
                <ThemedText style={{ fontWeight: "700", color: "#fff" }}>{L("Join stage", "মঞ্চে যান")}</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function CtrlBtn({ icon, active, onPress, label, badge = 0 }: { icon: any; active?: boolean; onPress: () => void; label: string; badge?: number }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.ctrl, { backgroundColor: active ? theme.primary + "18" : theme.backgroundSecondary }]} accessibilityLabel={label}>
      <Feather name={icon} size={20} color={active ? theme.primary : theme.text} />
      {badge > 0 ? (
        <View style={[styles.ctrlBadge, { backgroundColor: theme.error }]}>
          <ThemedText style={styles.ctrlBadgeText}>{badge > 9 ? "9+" : badge}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

function SpeakerRow({ bn, onChange }: { bn: boolean; onChange: (on: boolean) => void }) {
  const { theme } = useTheme();
  const [on, setOn] = useState(true);
  return (
    <Pressable
      style={styles.menuRow}
      onPress={() => {
        onChange(!on);
        setOn(!on);
      }}
    >
      <Feather name={on ? "volume-2" : "phone"} size={18} color={theme.text} />
      <ThemedText style={styles.menuText}>{on ? (bn ? "ফোনের ইয়ারপিসে শুনুন" : "Listen on the earpiece") : bn ? "লাউডস্পিকারে শুনুন" : "Listen on the loudspeaker"}</ThemedText>
    </Pressable>
  );
}

function Sheet({ visible, onClose, title, tall, children }: { visible: boolean; onClose: () => void; title?: string; tall?: boolean; children: React.ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, tall && { maxHeight: "80%" }, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        {title ? <ThemedText style={styles.sheetTitle}>{title}</ThemedText> : null}
        <ScrollView>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function PersonRow({ m, me, onPress, roleName, roleColor }: { m: VoiceMember; me: string; onPress: () => void; roleName: (r: VoiceRole) => string; roleColor: (r: VoiceRole) => string }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.personRow, !m.online && { opacity: 0.5 }]}>
      <UserAvatar name={m.name} avatar={m.avatar || undefined} badge={m.profileRole || undefined} size={42} presence={null} />
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <ThemedText style={styles.personName} numberOfLines={1}>
          {m.name}
          {m.userId === me ? " · ★" : ""}
        </ThemedText>
        <ThemedText style={[styles.small, { color: roleColor(m.role) }]}>{roleName(m.role)}</ThemedText>
      </View>
      {m.hand ? <ThemedText style={{ fontSize: 16, marginRight: 8 }}>{"\u270B"}</ThemedText> : null}
      {onStage(m.role) ? <Feather name={m.muted ? "mic-off" : "mic"} size={16} color={m.muted ? theme.error : theme.primary} /> : null}
    </Pressable>
  );
}

function PersonActions({
  m,
  me,
  bn,
  roleName,
  onProfile,
  onDone,
  actions,
  stageFull,
}: {
  m: VoiceMember;
  me?: VoiceMember;
  bn: boolean;
  roleName: (r: VoiceRole) => string;
  onProfile: (m: VoiceMember) => void;
  onDone: () => void;
  actions: ReturnType<typeof useVoiceRoom>["actions"];
  stageFull: boolean;
}) {
  const { theme } = useTheme();
  const L = (en: string, b: string) => (bn ? b : en);
  const isMe = me?.userId === m.userId;
  const iHost = me?.role === "host";
  const iManage = iHost || me?.role === "moderator";
  const rows: { icon: any; text: string; onPress: () => void; danger?: boolean; testID?: string }[] = [];
  const run = (f: () => void) => () => {
    f();
    onDone();
  };
  rows.push({ icon: "user", text: L("View profile", "প্রোফাইল দেখুন"), onPress: () => onProfile(m) });
  if (isMe && onStage(m.role) && m.role !== "host") rows.push({ icon: "arrow-down-circle", text: L("Leave the stage", "মঞ্চ থেকে নামুন"), onPress: run(() => actions.toAudience()) });
  if (!isMe && iManage && m.role !== "host" && !(me?.role === "moderator" && m.role === "moderator")) {
    if (m.role === "audience") {
      if (m.hand) {
        rows.push({ icon: "check-circle", text: L("Bring up to the stage", "মঞ্চে আনুন"), onPress: run(() => actions.accept(m.userId)), testID: "vr-act-accept" });
        rows.push({ icon: "x-circle", text: L("Decline the raised hand", "হাত তোলা ফিরিয়ে দিন"), onPress: run(() => actions.reject(m.userId)) });
      } else if (!m.invitedToStage) {
        rows.push({ icon: "mic", text: stageFull ? L("Invite to speak (stage is full)", "কথা বলতে ডাকুন (মঞ্চ ভর্তি)") : L("Invite to speak", "কথা বলতে ডাকুন"), onPress: run(() => actions.invite(m.userId)), testID: "vr-act-invite" });
      } else {
        rows.push({ icon: "clock", text: L("Invited — waiting for them", "ডাকা হয়েছে — উত্তরের অপেক্ষা"), onPress: onDone });
      }
    } else {
      if (!m.muted) rows.push({ icon: "mic-off", text: L("Mute", "মিউট করুন"), onPress: run(() => actions.muteOther(m.userId)) });
      rows.push({ icon: "arrow-down-circle", text: L("Move to the audience", "শ্রোতাদের মধ্যে পাঠান"), onPress: run(() => actions.toAudience(m.userId)) });
    }
    if (iHost) {
      if (m.role === "moderator") rows.push({ icon: "shield-off", text: L("Remove as moderator", "মডারেটর থেকে সরান"), onPress: run(() => actions.removeModerator(m.userId)) });
      else rows.push({ icon: "shield", text: L("Make moderator", "মডারেটর করুন"), onPress: run(() => actions.makeModerator(m.userId)) });
    }
    rows.push({ icon: "user-x", text: L("Remove from the room", "রুম থেকে সরিয়ে দিন"), onPress: run(() => actions.removeFromRoom(m.userId)), danger: true });
  }
  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: Spacing.md }}>
        <UserAvatar name={m.name} avatar={m.avatar || undefined} badge={m.profileRole || undefined} size={72} presence={null} />
        <ThemedText style={[styles.sheetTitle, { marginTop: Spacing.sm, marginBottom: 0 }]}>{m.name}</ThemedText>
        <ThemedText style={[styles.small, { color: theme.textSecondary }]}>
          {roleName(m.role)}
          {onStage(m.role) && m.muted ? ` · ${L("muted", "মিউট")}` : ""}
          {!m.online ? ` · ${L("reconnecting", "আবার যুক্ত হচ্ছে")}` : ""}
        </ThemedText>
      </View>
      {rows.map((r) => (
        <Pressable key={r.text} onPress={r.onPress} style={styles.menuRow} testID={r.testID}>
          <Feather name={r.icon} size={18} color={r.danger ? theme.error : theme.text} />
          <ThemedText style={[styles.menuText, r.danger && { color: theme.error }]}>{r.text}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function FloatingEmoji({ r, index, name }: { r: FloatingReaction; index: number; name?: string }) {
  const y = useSharedValue(0);
  const o = useSharedValue(1);
  const x = useMemo(() => ((index * 37) % 60) - 30, [index]);
  useEffect(() => {
    y.value = withTiming(-200, { duration: 2400, easing: Easing.out(Easing.quad) });
    o.value = withTiming(0, { duration: 2400, easing: Easing.in(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { translateX: x }], opacity: o.value }));
  return (
    <Animated.View style={[styles.floatEmoji, st]}>
      <ThemedText style={{ fontSize: 30 }}>{r.emoji}</ThemedText>
      {name ? (
        <ThemedText style={styles.floatName} numberOfLines={1}>
          {name.split(" ")[0]}
        </ThemedText>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  endIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  endText: { fontSize: 16, textAlign: "center", marginTop: Spacing.lg, lineHeight: 23 },
  endBtn: { marginTop: Spacing.xl, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 24 },
  endBtnText: { color: "#fff", fontWeight: "700" },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, height: 50 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  small: { fontSize: 12 },
  offline: { paddingVertical: 6, alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", marginTop: Spacing.xs },
  desc: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  tagText: { fontSize: 11, fontWeight: "700" },
  handsBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  handsText: { flex: 1, fontSize: 14, fontWeight: "600" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  seat: { width: "25%", alignItems: "center", marginBottom: Spacing.md },
  ring: { borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  micBadge: { position: "absolute", right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  handBadge: { position: "absolute", left: -2, top: -2, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  seatName: { fontSize: 12, fontWeight: "600", marginTop: 5, maxWidth: 80, textAlign: "center" },
  seatRole: { fontSize: 10, fontWeight: "700" },
  moreSeat: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
  moreSeatText: { fontSize: 18, fontWeight: "800" },
  emptySeat: { width: 70, height: 70, borderRadius: 35, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  reactLayer: { position: "absolute", right: 24, width: 80, height: 10, alignItems: "center" },
  floatEmoji: { position: "absolute", bottom: 0, alignItems: "center" },
  floatName: { fontSize: 10, fontWeight: "700", color: "#fff", backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 5, borderRadius: 6, overflow: "hidden", maxWidth: 70 },
  toast: { position: "absolute", alignSelf: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, maxWidth: "88%" },
  toastText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  chat: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  chatHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingTop: 10, paddingBottom: 4 },
  chatTitle: { fontSize: 13, fontWeight: "700" },
  msg: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 5 },
  msgName: { fontSize: 12, fontWeight: "700", maxWidth: 160 },
  msgRole: { fontSize: 10, fontWeight: "700", marginLeft: 6 },
  msgText: { fontSize: 14, lineHeight: 19 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  chatInput: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 14, fontSize: 14, outlineStyle: "none" as any },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emojiRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  emojiBtn: { padding: 6 },
  controls: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: Spacing.lg, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  leaveBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 44, borderRadius: 22 },
  leaveText: { fontWeight: "700", fontSize: 14 },
  ctrl: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  ctrlBadge: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  ctrlBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  micBtn: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: Spacing.md },
  sheetTitle: { fontSize: 17, fontWeight: "700", marginBottom: Spacing.sm },
  personRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  personName: { fontSize: 15, fontWeight: "600", marginLeft: 0 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  pillText: { fontSize: 12, fontWeight: "700" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: 14 },
  menuText: { fontSize: 15, fontWeight: "600" },
  stepSm: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 16, fontWeight: "700", minWidth: 26, textAlign: "center" },
  dialogBack: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  dialog: { width: "100%", maxWidth: 360, borderRadius: 22, padding: Spacing.xl },
  dialogTitle: { fontSize: 17, fontWeight: "700", textAlign: "center", marginVertical: Spacing.sm },
  dialogBtn: { flex: 1, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
});
