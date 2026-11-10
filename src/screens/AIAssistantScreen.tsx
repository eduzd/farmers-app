import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { View, FlatList, TextInput, Pressable, StyleSheet, Platform, Image } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { Feather } from "@/components/icons/Feather";
import { Text } from "@/components/MayaText";
import { HeaderIconCircle } from "@/components/HeaderIconCircle";
import { KeyboardAvoidingScreen } from "@/components/KeyboardAvoidingScreen";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { AiOrb, TypingDots, RichText, AiNotice, aiGradient, useBn } from "@/components/ai/AiKit";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { aiChat, aiStatus, aiErrorText, type AiStatus } from "@/lib/aiApi";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

/**
 * AI help chat (Krishi AI). Answers come from the server, which uses the model and Omni route keys the admin
 * chose in Admin > More > AI settings. A photo can be attached; it goes to the disease-detector model.
 * The last 40 messages stay on the phone so the chat survives closing the app.
 */

type Msg = { id: string; role: "user" | "assistant"; text: string; image?: string; error?: boolean; at: number };
const STORE = "krishi_ai_chat_v2";

export default function AIAssistantScreen() {
  const { theme, isDark } = useTheme();
  const bn = useBn();
  const T = (en: string, b: string) => (bn ? b : en);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const askedInitial = useRef(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [photo, setPhoto] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const composerPadding = useKeyboardAwareBottomPadding(Spacing.sm, { min: Spacing.md });

  useEffect(() => {
    AsyncStorage.getItem(STORE).then((s) => { if (s) try { setMsgs(JSON.parse(s)); } catch {} }).catch(() => {});
    aiStatus().then(setStatus).catch(() => {});
    return () => { Speech.stop(); };
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(STORE, JSON.stringify(msgs.filter((m) => !m.error).slice(-40).map(({ image, ...m }) => m))).catch(() => {});
  }, [msgs]);

  const clear = useCallback(() => { Speech.stop(); setMsgs([]); }, []);
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: Spacing.lg, flexDirection: "row", gap: 8 }}>
          {msgs.length ? (
            <HeaderIconCircle onPress={clear} accessibilityLabel={T("New chat", "নতুন চ্যাট")} testID="ai-new-chat">
              <Feather name="edit" size={19} color={theme.text} />
            </HeaderIconCircle>
          ) : null}
          <HeaderIconCircle onPress={() => navigation.navigate("VoiceCall" as any)} accessibilityLabel={T("Call Krishi AI", "কৃষি এআই-কে কল")} testID="ai-call-button">
            <Feather name="phone" size={19} color={theme.text} />
          </HeaderIconCircle>
        </View>
      ),
    });
  }, [navigation, theme, msgs.length, bn]);

  const scrollEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if ((!q && !photo) || busy) return;
    Haptics.selectionAsync().catch(() => {});
    const question = q || T("What is wrong in this photo? What should I do?", "এই ছবিতে কী সমস্যা? কী করব?");
    const mine: Msg = { id: `u${Date.now()}`, role: "user", text: question, image: photo?.uri, at: Date.now() };
    const history = msgs.filter((m) => !m.error).slice(-10).map((m) => ({ role: m.role, content: m.text }));
    const img = photo ? { base64: photo.base64, mimeType: photo.mime } : undefined;
    setMsgs((s) => [...s, mine]);
    setInput("");
    setPhoto(null);
    setBusy(true);
    scrollEnd();
    try {
      const r = await aiChat(question, history, bn ? "bn" : "en", img);
      setMsgs((s) => [...s, { id: `a${Date.now()}`, role: "assistant", text: r.reply, at: Date.now() }]);
    } catch (e: any) {
      setMsgs((s) => [...s, { id: `e${Date.now()}`, role: "assistant", text: aiErrorText(e, bn), error: true, at: Date.now() }]);
    } finally {
      setBusy(false);
      scrollEnd();
    }
  };

  // Opened with a question (e.g. from Smart Farming): ask it once.
  useEffect(() => {
    const q = route.params?.initialQuery;
    if (q && !askedInitial.current) { askedInitial.current = true; setTimeout(() => send(String(q)), 300); }
  }, [route.params?.initialQuery]);

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true, allowsEditing: true });
    const a = r.canceled ? null : r.assets?.[0];
    if (a?.base64) setPhoto({ uri: a.uri, base64: a.base64, mime: a.mimeType || "image/jpeg" });
  };

  const speak = (m: Msg) => {
    if (speakingId === m.id) { Speech.stop(); setSpeakingId(null); return; }
    Speech.stop();
    setSpeakingId(m.id);
    Speech.speak(m.text.replace(/[*#_`]/g, ""), { language: bn ? "bn-BD" : "en-US", rate: 0.95, onDone: () => setSpeakingId(null), onStopped: () => setSpeakingId(null), onError: () => setSpeakingId(null) });
  };

  const suggestions = bn
    ? ["পুকুরের পানি সবুজ হয়ে গেছে, কী করব?", "তেলাপিয়ার জন্য দিনে কতটুকু খাবার দেব?", "মাছ ভোরে ভেসে উঠছে কেন?", "পুকুরে চুন কতটুকু দেব?"]
    : ["My pond water turned green. What should I do?", "How much feed per day for tilapia?", "Why are my fish gasping at dawn?", "How much lime should I add to my pond?"];

  const userBubble: [string, string] = isDark ? ["#2F6FE4", "#1C3F94"] : ["#1C3F94", "#0A1F44"];

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const mine = item.role === "user";
    const prevSame = index > 0 && msgs[index - 1].role === item.role;
    return (
      <Animated.View entering={FadeInDown.duration(260).springify().damping(18)} style={[styles.row, mine ? styles.rowMine : null, { marginTop: prevSame ? 4 : 14 }]}>
        {!mine ? (
          <View style={{ width: 30, alignItems: "center" }}>
            {!prevSame ? (
              <LinearGradient colors={aiGradient(isDark).slice(1) as any} style={styles.avatar}>
                <Feather name="zap" size={14} color="#fff" />
              </LinearGradient>
            ) : null}
          </View>
        ) : null}
        {mine ? (
          <LinearGradient colors={userBubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine]}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.photo} /> : null}
            <Text style={{ color: "#fff", fontSize: 15, lineHeight: 22 }}>{item.text}</Text>
          </LinearGradient>
        ) : (
          <View testID={item.error ? "ai-error-bubble" : "ai-reply"} style={[styles.bubble, styles.bubbleAi, { backgroundColor: item.error ? theme.error + "12" : theme.backgroundDefault, borderColor: item.error ? theme.error + "30" : theme.border }]}>
            <RichText text={item.text} color={item.error ? theme.error : theme.text} />
            {!item.error ? (
              <View style={styles.tools}>
                <Pressable onPress={() => speak(item)} hitSlop={8} style={styles.tool} testID="ai-speak">
                  <Feather name={speakingId === item.id ? "stop-circle" : "volume-2"} size={14} color={theme.textSecondary} />
                  <Text style={[styles.toolText, { color: theme.textSecondary }]}>{speakingId === item.id ? T("Stop", "থামুন") : T("Listen", "শুনুন")}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => { const last = [...msgs].reverse().find((m) => m.role === "user"); if (last) { setMsgs((s) => s.filter((m) => m.id !== item.id && m.id !== last.id)); send(last.text); } }} style={[styles.tool, { marginTop: 8 }]} testID="ai-retry">
                <Feather name="refresh-cw" size={14} color={theme.error} />
                <Text style={[styles.toolText, { color: theme.error }]}>{T("Try again", "আবার চেষ্টা")}</Text>
              </Pressable>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  const empty = (
    <Animated.View entering={FadeIn.duration(400)} style={{ paddingHorizontal: 18, paddingTop: 18 }}>
      <LinearGradient colors={aiGradient(isDark)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <AiOrb size={58} color="#5B9BFF" />
        <Text style={styles.heroTitle}>{T("Hi, I'm Krishi AI", "আমি কৃষি এআই")}</Text>
        <Text style={styles.heroSub}>{T("Ask about fish, ponds, feed, crops or animals. I answer in Bangla or English.", "মাছ, পুকুর, খাবার, ফসল বা পশু নিয়ে জিজ্ঞেস করুন। আমি বাংলা বা ইংরেজিতে উত্তর দিই।")}</Text>
      </LinearGradient>
      <View style={styles.quickRow}>
        <Pressable testID="ai-quick-scan" onPress={() => navigation.navigate("DiseaseDetector" as any)} style={({ pressed }) => [styles.quick, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}>
          <View style={[styles.quickIcon, { backgroundColor: "#E8F1FF" }]}><Feather name="camera" size={18} color="#1C3F94" /></View>
          <Text style={[styles.quickTitle, { color: theme.text }]}>{T("Scan a disease", "রোগ স্ক্যান")}</Text>
          <Text style={[styles.quickSub, { color: theme.textSecondary }]}>{T("From a photo", "ছবি থেকে")}</Text>
        </Pressable>
        <Pressable testID="ai-quick-call" onPress={() => navigation.navigate("VoiceCall" as any)} style={({ pressed }) => [styles.quick, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}>
          <View style={[styles.quickIcon, { backgroundColor: "#E6F7EF" }]}><Feather name="phone-call" size={18} color="#00875A" /></View>
          <Text style={[styles.quickTitle, { color: theme.text }]}>{T("Talk to AI", "এআই-এর সাথে কথা")}</Text>
          <Text style={[styles.quickSub, { color: theme.textSecondary }]}>{T("Voice call", "ভয়েস কল")}</Text>
        </Pressable>
      </View>
      {status && !status.chat ? <AiNotice testID="ai-not-ready" tone="warn" style={{ marginTop: 14 }} text={T("AI isn't switched on yet. It will start working as soon as the admin sets it up.", "এআই এখনো চালু হয়নি। অ্যাডমিন সেট আপ করলেই কাজ করবে।")} /> : null}
      <Text style={[styles.tryLabel, { color: theme.textSecondary }]}>{T("Try asking", "জিজ্ঞেস করে দেখুন")}</Text>
      {suggestions.map((s, i) => (
        <Animated.View key={s} entering={FadeInDown.delay(80 + i * 60).duration(300)}>
          <Pressable testID={`ai-suggestion-${i}`} onPress={() => send(s)} style={({ pressed }) => [styles.suggestion, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
            <Feather name="message-circle" size={15} color={theme.primary} />
            <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>{s}</Text>
            <Feather name="arrow-up-right" size={15} color={theme.textTertiary} />
          </Pressable>
        </Animated.View>
      ))}
    </Animated.View>
  );

  const canSend = (!!input.trim() || !!photo) && !busy;
  const composer = (
    <Animated.View style={[styles.composerWrap, { backgroundColor: theme.backgroundRoot, borderTopColor: theme.border, }, composerPadding]}>
      {photo ? (
        <View style={styles.attach}>
          <Image source={{ uri: photo.uri }} style={styles.attachImg} />
          <Text style={{ color: theme.textSecondary, fontSize: 12.5, flex: 1 }}>{T("Photo added. Ask about it, or just send.", "ছবি যোগ হয়েছে। প্রশ্ন লিখুন বা সরাসরি পাঠান।")}</Text>
          <Pressable onPress={() => setPhoto(null)} hitSlop={8} testID="ai-photo-remove"><Feather name="x" size={18} color={theme.textSecondary} /></Pressable>
        </View>
      ) : null}
      <View style={[styles.composer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
        <Pressable onPress={pickPhoto} hitSlop={6} style={styles.iconBtn} testID="ai-attach" accessibilityLabel={T("Add photo", "ছবি যোগ")}>
          <Feather name="image" size={20} color={theme.textSecondary} />
        </Pressable>
        <TextInput
          testID="ai-input"
          value={input}
          onChangeText={setInput}
          placeholder={T("Ask Krishi AI...", "কৃষি এআই-কে জিজ্ঞেস করুন...")}
          placeholderTextColor={theme.textTertiary}
          style={[styles.input, { color: theme.text }]}
          multiline
          maxLength={2000}
          onKeyPress={(e: any) => {
            // web: Enter sends, Shift+Enter adds a new line
            if (Platform.OS === "web" && e?.nativeEvent?.key === "Enter" && !e?.nativeEvent?.shiftKey) { e.preventDefault?.(); send(); }
          }}
        />
        <Pressable onPress={() => send()} disabled={!canSend} testID="ai-send" accessibilityLabel={T("Send", "পাঠান")}>
          <LinearGradient colors={canSend ? ["#3D7BF2", "#1C3F94"] : [theme.border, theme.border]} style={styles.send}>
            <Feather name="arrow-up" size={19} color={canSend ? "#fff" : theme.textTertiary} />
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingScreen style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        ref={listRef}
        testID="ai-messages"
        data={msgs}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        ListFooterComponent={busy ? (
          <Animated.View entering={FadeIn} style={[styles.row, { marginTop: 14 }]}>
            <View style={{ width: 30, alignItems: "center" }}>
              <LinearGradient colors={aiGradient(isDark).slice(1) as any} style={styles.avatar}><Feather name="zap" size={14} color="#fff" /></LinearGradient>
            </View>
            <View testID="ai-thinking" style={[styles.bubble, styles.bubbleAi, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, flexDirection: "row", alignItems: "center", gap: 10 }]}>
              <TypingDots color={theme.primary} />
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{T("Thinking...", "ভাবছি...")}</Text>
            </View>
          </Animated.View>
        ) : <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: msgs.length ? 14 : 0, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => msgs.length && listRef.current?.scrollToEnd({ animated: false })}
      />
      {composer}
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rowMine: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "84%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleMine: { borderTopRightRadius: 6 },
  bubbleAi: { borderTopLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, flexShrink: 1 },
  photo: { width: 200, height: 150, borderRadius: 14, marginBottom: 8 },
  tools: { flexDirection: "row", gap: 14, marginTop: 8 },
  tool: { flexDirection: "row", alignItems: "center", gap: 5 },
  toolText: { fontSize: 12.5, fontWeight: "600" },
  hero: { borderRadius: 26, padding: 20, alignItems: "center" },
  heroTitle: { color: "#fff", fontSize: 21, fontWeight: "800", marginTop: 2 },
  heroSub: { color: "rgba(255,255,255,0.82)", fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: 6, maxWidth: 340 },
  quickRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  quick: { flex: 1, borderRadius: 18, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  quickIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  quickTitle: { fontSize: 14.5, fontWeight: "700" },
  quickSub: { fontSize: 12.5, marginTop: 2 },
  tryLabel: { fontSize: 12.5, fontWeight: "700", marginTop: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 6, borderRadius: 26, borderWidth: 1, paddingLeft: 6, paddingRight: 5, paddingVertical: 5 },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, fontSize: 15, maxHeight: 120, paddingTop: Platform.OS === "ios" ? 10 : 8, paddingBottom: 8, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  attach: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, paddingHorizontal: 4 },
  attachImg: { width: 44, height: 44, borderRadius: 10 },
});
