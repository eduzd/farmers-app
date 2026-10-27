// Full-screen voice call screen: incoming (accept / decline), calling, ringing,
// connecting, connected (timer, mute, speaker, end) and a short "call ended" note.
import React, { useEffect, useState } from "react";
import { Modal, View, StyleSheet, Pressable, Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { tr } from "@/lib/tr";
import { resolveAvatarUri } from "@/lib/avatarUri";
import type { CallUi } from "@/contexts/VoiceCallContext";

import { AppIcon } from "@/components/icons/AppIcon";
interface Props {
  call: CallUi | null;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
}

const GREEN = "#00BB77";
const RED = "#DA2F2F";
const BG = "#0F2E1D";

function endText(reason?: string): string {
  switch (reason) {
    case "declined":
      return tr("কল ধরেননি") + " · Declined";
    case "busy":
      return tr("অন্য কলে আছেন") + " · Busy";
    case "no_answer":
      return tr("কেউ ধরেনি") + " · No answer";
    case "invalid_user":
      return tr("এই ব্যক্তিকে কল করা যাবে না") + " · Can't call this person";
    case "rate_limited":
      return tr("একটু পরে আবার চেষ্টা করুন") + " · Too many calls, try again soon";
    case "mic_denied":
      return tr("মাইক্রোফোনের অনুমতি দিন") + " · Allow the microphone to call";
    case "mic_error":
      return tr("মাইক্রোফোন চালু হয়নি") + " · Microphone didn't start";
    case "offline_self":
      return tr("ইন্টারনেট সংযোগ নেই") + " · No connection";
    case "connection_failed":
      return tr("সংযোগ হয়নি") + " · Couldn't connect the call";
    case "connection_lost":
    case "peer_disconnected":
      return tr("সংযোগ বিচ্ছিন্ন") + " · Connection lost";
    case "cancelled":
    case "hangup":
    default:
      return tr("কল শেষ") + " · Call ended";
  }
}

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function initials(name: string) {
  return (name || "?").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function RoundButton({ icon, label, color, onPress, active, testID }: { icon: any; label: string; color: string; onPress: () => void; active?: boolean; testID?: string }) {
  return (
    <View style={styles.btnWrap}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.btn, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }, active && styles.btnActive]}
      >
        <AppIcon name={icon} size={26} color={active ? BG : "#fff"} />
      </Pressable>
      <ThemedText style={styles.btnLabel}>{label}</ThemedText>
    </View>
  );
}

export function CallOverlay({ call, onAccept, onReject, onHangup, onToggleMute, onToggleSpeaker }: Props) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());
  const visible = !!call && call.phase !== "idle";

  useEffect(() => {
    if (call?.phase !== "connected") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [call?.phase]);

  if (!visible || !call) return null;

  const avatar = resolveAvatarUri(call.peerAvatar);
  let status = "";
  switch (call.phase) {
    case "incoming":
      status = tr("ইনকামিং ভয়েস কল") + " · Incoming voice call";
      break;
    case "outgoing":
      status = tr("কল করা হচ্ছে…") + " · Calling…";
      break;
    case "ringing":
      status = call.peerOnline === false ? tr("রিং হচ্ছে… (ফোনে নোটিফিকেশন গেছে)") + " · Ringing…" : tr("রিং হচ্ছে…") + " · Ringing…";
      break;
    case "connecting":
      status = tr("সংযোগ হচ্ছে…") + " · Connecting…";
      break;
    case "connected":
      status = clock(now - (call.connectedAt || now));
      break;
    case "ended":
      status = endText(call.endReason);
      break;
  }

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent onRequestClose={() => {}}>
      {Platform.OS !== "web" ? <StatusBar barStyle="light-content" backgroundColor={BG} /> : null}
      <View style={[styles.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]} testID="call-overlay">
        <View style={styles.top}>
          <ThemedText style={styles.appLabel}>{tr("ফার্মার্স ভয়েস কল")} · Farmers voice call</ThemedText>
          <View style={styles.avatar}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <ThemedText style={styles.avatarText}>{initials(call.peerName)}</ThemedText>
            )}
          </View>
          <ThemedText style={styles.name} numberOfLines={1}>
            {call.peerName}
          </ThemedText>
          <ThemedText style={styles.status} testID="call-status">
            {status}
          </ThemedText>
        </View>

        {call.phase === "incoming" ? (
          <View style={styles.row}>
            <RoundButton testID="call-decline" icon="phone-off" label={tr("কেটে দিন")} color={RED} onPress={onReject} />
            <RoundButton testID="call-accept" icon="phone" label={tr("ধরুন")} color={GREEN} onPress={onAccept} />
          </View>
        ) : call.phase === "ended" ? (
          <View style={styles.row}>
            <RoundButton icon="x" label={tr("বন্ধ করুন")} color="#202936" onPress={onHangup} />
          </View>
        ) : (
          <View>
            <View style={[styles.row, { marginBottom: 28 }]}>
              <RoundButton
                testID="call-mute"
                icon={call.muted ? "mic-off" : "mic"}
                label={call.muted ? tr("মিউট") : tr("মাইক")}
                color="rgba(255,255,255,0.14)"
                active={call.muted}
                onPress={onToggleMute}
              />
              {Platform.OS !== "web" ? (
                <RoundButton
                  testID="call-speaker"
                  icon="volume-2"
                  label={tr("স্পিকার")}
                  color="rgba(255,255,255,0.14)"
                  active={call.speaker}
                  onPress={onToggleSpeaker}
                />
              ) : null}
            </View>
            <View style={styles.row}>
              <RoundButton testID="call-end" icon="phone-off" label={tr("শেষ করুন")} color={RED} onPress={onHangup} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, justifyContent: "space-between", paddingHorizontal: 24 },
  top: { alignItems: "center" },
  appLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 36 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#1F5133",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 20,
  },
  avatarImg: { width: 120, height: 120 },
  avatarText: { color: "#fff", fontSize: 40, lineHeight: 48, fontWeight: "700" },
  name: { color: "#fff", fontSize: 26, lineHeight: 34, fontWeight: "700", marginBottom: 8, maxWidth: "90%" },
  status: { color: "rgba(255,255,255,0.8)", fontSize: 15, lineHeight: 22, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-start" },
  btnWrap: { alignItems: "center", width: 96 },
  btn: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  btnActive: { backgroundColor: "#fff" },
  btnLabel: { color: "#fff", fontSize: 13, marginTop: 8, textAlign: "center" },
});
