import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { Feather } from "@/components/icons/Feather";
import { Text } from "@/components/MayaText";
import { AiOrb, SoundBars, useBn } from "@/components/ai/AiKit";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { aiVoiceTurn, aiVoiceGreet, aiErrorText } from "@/lib/aiApi";
import { playBase64Audio, stopAiAudio } from "@/lib/aiAudio";

/**
 * AI voice call with Krishi AI.
 * Tap the mic and talk, tap again to send. The server turns the speech into text, the "AI call brain" model
 * answers, and the reply is spoken in the voice the admin chose for this language (Admin > More > AI settings).
 * When no AI voice is set up the phone's own voice reads the answer.
 */

type Phase = "connecting" | "ready" | "listening" | "thinking" | "speaking" | "ended";
type Turn = { role: "user" | "assistant"; content: string };

async function fileToBase64(uri: string): Promise<{ base64: string; mime: string }> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result || "").split(",")[1] || "");
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    try { URL.revokeObjectURL(uri); } catch {}
    return { base64, mime: (blob.type || "audio/webm").split(";")[0] };
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  return { base64, mime: "audio/mp4" };
}

export default function VoiceCallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const bn = useBn();
  const T = (en: string, b: string) => (bn ? b : en);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const live = useRef(true);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const scrollRef = useRef<ScrollView>(null);
  const recorder = useVoiceRecorder((r) => { if (r) handleRecording(r.uri); });

  // call timer
  useEffect(() => {
    const t = setInterval(() => live.current && setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const say = useCallback(async (text: string, audio: string | null, mime: string | null) => {
    if (!live.current) return;
    setPhase("speaking");
    if (mutedRef.current) { setPhase("ready"); return; }
    try {
      if (audio) await playBase64Audio(audio, mime || "audio/mpeg");
      else {
        await new Promise<void>((resolve) => {
          Speech.speak(text, { language: bn ? "bn-BD" : "en-US", rate: 0.95, onDone: () => resolve(), onStopped: () => resolve(), onError: () => resolve() });
          setTimeout(resolve, Math.min(60_000, 2000 + text.length * 90));
        });
      }
    } catch {}
    if (live.current) setPhase((p) => (p === "speaking" ? "ready" : p));
  }, [bn]);

  // greeting
  useEffect(() => {
    live.current = true;
    (async () => {
      try {
        const g = await aiVoiceGreet(bn ? "bn" : "en");
        if (!live.current) return;
        setVoiceName(g.voice);
        setTurns([{ role: "assistant", content: g.reply }]);
        await say(g.reply, g.audioBase64, g.mimeType);
      } catch (e: any) {
        if (!live.current) return;
        setError(aiErrorText(e, bn));
        setPhase("ready");
      }
    })();
    return () => {
      live.current = false;
      stopAiAudio();
      Speech.stop();
      recorder.cancel?.();
    };
  }, []);

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80); }, [turns.length, phase]);

  async function handleRecording(uri: string) {
    if (!live.current) return;
    setPhase("thinking");
    setError("");
    try {
      const { base64, mime } = await fileToBase64(uri);
      const r = await aiVoiceTurn({ audioBase64: base64, mimeType: mime, history: turnsRef.current.slice(-10), lang: bn ? "bn" : "en" });
      if (!live.current) return;
      if (!r.heard) { setError(T("I didn't catch that. Tap the mic and try again.", "ঠিক শুনতে পাইনি। মাইক চেপে আবার বলুন।")); setPhase("ready"); return; }
      if (r.voice) setVoiceName(r.voice);
      setTurns((t) => [...t, { role: "user", content: r.transcript }, { role: "assistant", content: r.reply }]);
      await say(r.reply, r.audioBase64, r.mimeType);
    } catch (e: any) {
      if (!live.current) return;
      setError(aiErrorText(e, bn));
      setPhase("ready");
    }
  }

  const onMic = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (phase === "listening") {
      const r = await recorder.stop();
      if (r) handleRecording(r.uri);
      else { setPhase("ready"); setError(T("That was too short. Hold on a little longer while you talk.", "খুব ছোট হয়েছে। একটু সময় নিয়ে বলুন।")); }
      return;
    }
    if (phase === "speaking") { stopAiAudio(); Speech.stop(); }
    if (phase === "thinking" || phase === "connecting") return;
    setError("");
    const ok = await recorder.start();
    if (ok) setPhase("listening");
  };

  const end = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    live.current = false;
    stopAiAudio();
    Speech.stop();
    recorder.cancel?.();
    navigation.goBack();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const label: Record<Phase, string> = {
    connecting: T("Connecting...", "সংযোগ হচ্ছে..."),
    ready: T("Tap the mic and talk", "মাইক চেপে কথা বলুন"),
    listening: T("Listening... tap again when you're done", "শুনছি... শেষ হলে আবার চাপুন"),
    thinking: T("Thinking...", "ভাবছি..."),
    speaking: T("Krishi AI is speaking", "কৃষি এআই বলছে"),
    ended: "",
  };
  const lastAi = [...turns].reverse().find((t) => t.role === "assistant");
  const lastUser = phase !== "listening" ? [...turns].reverse().find((t) => t.role === "user") : null;
  const recSecs = Math.floor((recorder.durationMs || 0) / 1000);

  return (
    <LinearGradient testID="ai-call-screen" colors={["#06132E", "#0B1F4D", "#173A8A"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 }}>
      <View style={styles.top}>
        <Pressable onPress={end} hitSlop={10} style={styles.topBtn} testID="ai-call-back"><Feather name="chevron-down" size={24} color="#fff" /></Pressable>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={styles.name}>{T("Krishi AI", "কৃষি এআই")}</Text>
          <Text style={styles.timer} testID="ai-call-timer">{mm}:{ss}</Text>
        </View>
        <View style={styles.topBtn} />
      </View>

      <View style={{ alignItems: "center", marginTop: 14 }}>
        <AiOrb size={118} active={phase === "listening" || phase === "speaking"} icon={phase === "listening" ? "mic" : "zap"} color={phase === "listening" ? "#2FBF71" : "#5B9BFF"} />
        <View style={{ height: 30, marginTop: 4, justifyContent: "center" }}>
          {phase === "listening" || phase === "speaking" ? <SoundBars active bars={7} color={phase === "listening" ? "#7BE0A8" : "#9CC3FF"} /> : null}
        </View>
        <Animated.Text key={phase} entering={FadeIn.duration(250)} testID="ai-call-status" style={styles.status}>
          {label[phase]}{phase === "listening" ? `  ${recSecs}s` : ""}
        </Animated.Text>
        {voiceName ? <Text style={styles.voice}>{T("Voice", "কণ্ঠ")}: {voiceName}</Text> : null}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 10, flexGrow: 1, justifyContent: "flex-end" }}>
        {lastUser ? (
          <Animated.View key={`u${turns.length}`} entering={FadeInDown.duration(260)} style={styles.youBox}>
            <Text style={styles.youLabel}>{T("You", "আপনি")}</Text>
            <Text style={styles.youText}>{lastUser.content}</Text>
          </Animated.View>
        ) : null}
        {lastAi ? (
          <Animated.View key={`a${turns.length}`} entering={FadeInDown.duration(300)} style={styles.aiBox} testID="ai-call-reply">
            <Text style={styles.aiText}>{lastAi.content}</Text>
          </Animated.View>
        ) : null}
        {error ? <Animated.View entering={FadeIn} style={styles.err}><Feather name="alert-circle" size={15} color="#FFB4B4" /><Text testID="ai-call-error" style={styles.errText}>{error}</Text></Animated.View> : null}
      </ScrollView>

      <View style={styles.controls}>
        <Pressable testID="ai-call-mute" onPress={() => { setMuted((m) => !m); if (!muted) { stopAiAudio(); Speech.stop(); } }} style={[styles.side, muted && { backgroundColor: "#fff" }]}>
          <Feather name={muted ? "volume-x" : "volume-2"} size={22} color={muted ? "#0B1F4D" : "#fff"} />
          <Text style={[styles.sideText, muted && { color: "#0B1F4D" }]}>{muted ? T("Muted", "মিউট") : T("Speaker", "স্পিকার")}</Text>
        </Pressable>
        <Pressable testID="ai-call-mic" onPress={onMic} disabled={phase === "thinking" || phase === "connecting"}>
          <LinearGradient colors={phase === "listening" ? ["#2FBF71", "#0E8F52"] : ["#5B9BFF", "#2F6FE4"]} style={[styles.mic, (phase === "thinking" || phase === "connecting") && { opacity: 0.5 }]}>
            <Feather name={phase === "listening" ? "send" : "mic"} size={30} color="#fff" />
          </LinearGradient>
        </Pressable>
        <Pressable testID="ai-call-end" onPress={end} style={[styles.side, { backgroundColor: "#E5484D" }]}>
          <Feather name="phone-off" size={22} color="#fff" />
          <Text style={styles.sideText}>{T("End", "শেষ")}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  topBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  name: { color: "#fff", fontSize: 19, fontWeight: "800" },
  timer: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2, fontVariant: ["tabular-nums"] },
  status: { color: "#fff", fontSize: 15.5, fontWeight: "600", marginTop: 6, textAlign: "center", paddingHorizontal: 24 },
  voice: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4 },
  youBox: { alignSelf: "flex-end", maxWidth: "88%", backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 18, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  youLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11.5, fontWeight: "700", marginBottom: 2 },
  youText: { color: "#fff", fontSize: 14.5, lineHeight: 21 },
  aiBox: { backgroundColor: "rgba(91,155,255,0.16)", borderRadius: 20, borderTopLeftRadius: 6, padding: 16, borderWidth: 1, borderColor: "rgba(156,195,255,0.25)" },
  aiText: { color: "#fff", fontSize: 16, lineHeight: 25 },
  err: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 10, backgroundColor: "rgba(229,72,77,0.16)", borderRadius: 14, padding: 12 },
  errText: { color: "#FFD6D6", fontSize: 13.5, lineHeight: 19, flex: 1 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", paddingHorizontal: 20, marginTop: 8 },
  side: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", gap: 2 },
  sideText: { color: "#fff", fontSize: 10.5, fontWeight: "600" },
  mic: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", shadowColor: "#2F6FE4", shadowOpacity: 0.6, shadowRadius: 18, elevation: 10 },
});
