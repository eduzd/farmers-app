import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, cancelAnimation } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Feather } from "@/components/icons/Feather";
import { Text, TextInput } from "@/components/MayaText";
import { AiNotice, aiGradient, useBn } from "@/components/ai/AiKit";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { aiDiagnose, aiStatus, aiErrorText, type Diagnosis, type AiStatus } from "@/lib/aiApi";

/**
 * Disease detector: a photo (and/or a description) goes to the vision model the admin chose in
 * Admin > More > AI settings. The answer comes back as a structured diagnosis card.
 */

const CATS: { id: string; en: string; bn: string; icon: any }[] = [
  { id: "fish", en: "Fish & shrimp", bn: "মাছ ও চিংড়ি", icon: "droplet" },
  { id: "crop", en: "Crops", bn: "ফসল", icon: "feather" },
  { id: "poultry", en: "Poultry", bn: "হাঁস-মুরগি", icon: "sun" },
  { id: "livestock", en: "Livestock", bn: "গবাদি পশু", icon: "heart" },
];
const SEV: Record<string, { c: string; en: string; bn: string }> = {
  low: { c: "#00875A", en: "Mild", bn: "হালকা" },
  medium: { c: "#B25E09", en: "Moderate", bn: "মাঝারি" },
  high: { c: "#DA2F2F", en: "Serious", bn: "গুরুতর" },
};

export default function DiseaseDetectorScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const bn = useBn();
  const T = (en: string, b: string) => (bn ? b : en);
  const [cat, setCat] = useState("fish");
  const [img, setImg] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Diagnosis | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => { aiStatus().then(setStatus).catch(() => {}); }, []);

  const take = async (camera: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted" && Platform.OS !== "web") {
      Alert.alert(T("Permission needed", "অনুমতি প্রয়োজন"), camera ? T("Please allow camera access to take a photo.", "ছবি তুলতে ক্যামেরার অনুমতি দিন।") : T("Please allow photo access to choose a photo.", "ছবি বাছাই করতে গ্যালারির অনুমতি দিন।"));
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.6, base64: true };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets?.[0];
    if (a?.base64) { setImg({ uri: a.uri, base64: a.base64, mime: a.mimeType || "image/jpeg" }); setResult(null); setError(""); }
  };

  const analyze = async () => {
    if (!img && !desc.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusy(true); setResult(null); setError("");
    try {
      const r = await aiDiagnose({ imageBase64: img?.base64, mimeType: img?.mime, description: desc.trim(), category: cat, lang: bn ? "bn" : "en" });
      setResult(r.result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      setError(aiErrorText(e, bn));
    } finally { setBusy(false); }
  };
  const reset = () => { setImg(null); setDesc(""); setResult(null); setError(""); };

  const card = { backgroundColor: theme.backgroundDefault, borderColor: theme.border };

  return (
    <KeyboardAwareScrollViewCompat
      testID="disease-screen"
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeIn.duration(350)}>
        <LinearGradient colors={aiGradient(isDark)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}><Feather name="camera" size={22} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{T("Find the disease from a photo", "ছবি থেকে রোগ খুঁজুন")}</Text>
            <Text style={styles.heroSub}>{T("Take a clear, close photo of the sick part in daylight. Krishi AI checks it and tells you what to do.", "অসুস্থ অংশের কাছ থেকে পরিষ্কার ছবি তুলুন, দিনের আলোয়। কৃষি এআই দেখে কী করতে হবে বলে দেবে।")}</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {status && !status.disease ? <AiNotice testID="disease-not-ready" tone="warn" style={{ marginTop: 14 }} text={T("The disease detector isn't switched on yet. It will work as soon as the admin sets it up.", "রোগ শনাক্তকারী এখনো চালু হয়নি। অ্যাডমিন সেট আপ করলেই কাজ করবে।")} /> : null}

      <Text style={[styles.label, { color: theme.textSecondary }]}>{T("What is sick?", "কী অসুস্থ?")}</Text>
      <View style={styles.cats}>
        {CATS.map((c) => {
          const on = cat === c.id;
          return (
            <Pressable key={c.id} testID={`disease-cat-${c.id}`} onPress={() => setCat(c.id)}
              style={[styles.cat, { backgroundColor: on ? theme.primary : theme.backgroundDefault, borderColor: on ? theme.primary : theme.border }]}>
              <Feather name={c.icon} size={16} color={on ? "#fff" : theme.textSecondary} />
              <Text style={{ color: on ? "#fff" : theme.text, fontSize: 13.5, fontWeight: "600" }} numberOfLines={1}>{T(c.en, c.bn)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.photoBox, card]}>
        {img ? (
          <View>
            <Image source={{ uri: img.uri }} style={styles.photo} contentFit="cover" />
            {busy ? <ScanOverlay /> : null}
            <Pressable onPress={reset} style={styles.photoX} testID="disease-photo-remove" hitSlop={8}><Feather name="x" size={16} color="#fff" /></Pressable>
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "14" }]}><Feather name="image" size={26} color={theme.primary} /></View>
            <Text style={{ color: theme.textSecondary, fontSize: 13.5, textAlign: "center" }}>{T("No photo yet", "এখনো কোনো ছবি নেই")}</Text>
          </View>
        )}
        <View style={styles.photoBtns}>
          <Pressable testID="disease-camera" onPress={() => take(true)} style={[styles.photoBtn, { backgroundColor: theme.primary }]}>
            <Feather name="camera" size={17} color="#fff" /><Text style={styles.photoBtnText}>{T("Take photo", "ছবি তুলুন")}</Text>
          </Pressable>
          <Pressable testID="disease-gallery" onPress={() => take(false)} style={[styles.photoBtn, { backgroundColor: theme.primary + "14" }]}>
            <Feather name="image" size={17} color={theme.primary} /><Text style={[styles.photoBtnText, { color: theme.primary }]}>{T("Gallery", "গ্যালারি")}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.label, { color: theme.textSecondary }]}>{T("Describe what you see (optional)", "যা দেখছেন লিখুন (ঐচ্ছিক)")}</Text>
      <TextInput
        testID="disease-desc"
        value={desc}
        onChangeText={setDesc}
        multiline
        maxLength={1500}
        placeholder={T("e.g. White spots on the body, fish rubbing on the pond side for 3 days", "যেমন: শরীরে সাদা দাগ, ৩ দিন ধরে মাছ পাড়ে ঘষছে")}
        placeholderTextColor={theme.textTertiary}
        style={[styles.desc, card, { color: theme.text }]}
      />

      <Pressable testID="disease-analyze" onPress={analyze} disabled={busy || (!img && !desc.trim())} style={{ marginTop: 16, opacity: busy || (!img && !desc.trim()) ? 0.55 : 1 }}>
        <LinearGradient colors={["#3D7BF2", "#1C3F94"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.analyze}>
          <Feather name={busy ? "loader" : "zap"} size={18} color="#fff" />
          <Text style={styles.analyzeText}>{busy ? T("Checking...", "পরীক্ষা করছি...") : T("Check with AI", "এআই দিয়ে পরীক্ষা")}</Text>
        </LinearGradient>
      </Pressable>

      {error ? <AiNotice testID="disease-error" tone="error" style={{ marginTop: 14 }} text={error} /> : null}
      {result ? <ResultCard r={result} bn={bn} onExpert={() => navigation.navigate("Experts")} onAsk={() => navigation.navigate("AIAssistant")} /> : null}
    </KeyboardAwareScrollViewCompat>
  );
}

function ScanOverlay() {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(y);
  }, []);
  const s = useAnimatedStyle(() => ({ top: `${y.value * 92}%` as any }));
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,31,68,0.25)", borderRadius: 16, overflow: "hidden" }]} pointerEvents="none">
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, height: 3, backgroundColor: "#7FB2FF", shadowColor: "#7FB2FF", shadowOpacity: 0.9, shadowRadius: 10 }, s]} />
    </View>
  );
}

function ResultCard({ r, bn, onExpert, onAsk }: { r: Diagnosis; bn: boolean; onExpert: () => void; onAsk: () => void }) {
  const { theme, isDark } = useTheme();
  const T = (en: string, b: string) => (bn ? b : en);
  // Section colours one step lighter in dark mode so the numbers and icons stay readable.
  const sc = (light: string, dark: string) => (isDark ? dark : light);
  const sev = SEV[r.severity] || SEV.medium;
  const tone = r.healthy ? "#00875A" : sev.c;
  const conf = Math.max(0, Math.min(100, Math.round(r.confidence)));
  const card = { backgroundColor: theme.backgroundDefault, borderColor: theme.border };
  const Section = ({ icon, title, items, color }: { icon: any; title: string; items: string[]; color: string }) =>
    items?.length ? (
      <View style={[styles.section, card]}>
        <View style={styles.sectionHead}>
          <View style={[styles.sectionIcon, { backgroundColor: color + "18" }]}><Feather name={icon} size={15} color={color} /></View>
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>{title}</Text>
        </View>
        {items.map((t, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <Text style={{ color, fontWeight: "800", minWidth: 16 }}>{i + 1}.</Text>
            <Text style={{ color: theme.text, fontSize: 14, lineHeight: 21, flex: 1 }}>{t}</Text>
          </View>
        ))}
      </View>
    ) : null;
  return (
    <Animated.View entering={FadeInDown.duration(380).springify().damping(18)} testID="disease-result" style={{ marginTop: 18 }}>
      <View style={[styles.resultHead, card, { borderLeftColor: tone }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <View style={[styles.badge, { backgroundColor: tone + "18" }]}>
            <Feather name={r.healthy ? "check-circle" : "alert-triangle"} size={13} color={tone} />
            <Text style={{ color: tone, fontSize: 12, fontWeight: "700" }}>{r.healthy ? T("Looks healthy", "সুস্থ মনে হচ্ছে") : T(sev.en, sev.bn)}</Text>
          </View>
          {r.subject ? <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>{r.subject}</Text> : null}
        </View>
        <Text testID="disease-name" style={{ color: theme.text, fontSize: 21, fontWeight: "800", marginTop: 8 }}>{r.diseaseName}</Text>
        {r.scientificName ? <Text style={{ color: theme.textSecondary, fontStyle: "italic", fontSize: 13 }}>{r.scientificName}</Text> : null}
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>{T("How sure the AI is", "এআই কতটা নিশ্চিত")}</Text>
            <Text style={{ color: theme.text, fontSize: 12.5, fontWeight: "700" }}>{conf}%</Text>
          </View>
          <View style={[styles.bar, { backgroundColor: theme.border }]}><View style={{ width: `${conf}%`, height: "100%", borderRadius: 4, backgroundColor: tone }} /></View>
        </View>
        {r.summary ? <Text style={{ color: theme.text, fontSize: 14.5, lineHeight: 22, marginTop: 12 }}>{r.summary}</Text> : null}
      </View>
      {r.notClear ? <AiNotice tone="warn" style={{ marginTop: 10 }} text={T("The photo wasn't clear enough to be sure. A closer photo in daylight will help.", "ছবিটি যথেষ্ট পরিষ্কার নয়। দিনের আলোয় কাছ থেকে তোলা ছবি দিলে ভালো হবে।")} /> : null}
      <Section icon="eye" title={T("Signs", "লক্ষণ")} items={r.symptoms} color={sc("#1C3F94", "#8FB0FF")} />
      <Section icon="help-circle" title={T("Likely causes", "সম্ভাব্য কারণ")} items={r.causes} color={sc("#6C4CF1", "#B3A2FF")} />
      <Section icon="activity" title={T("What to do now", "এখন কী করবেন")} items={r.treatment} color={sc("#00875A", "#3DD39A")} />
      <Section icon="shield" title={T("Prevent it next time", "পরের বার প্রতিরোধ")} items={r.prevention} color={sc("#B25E09", "#F2A54A")} />
      {r.otherPossibilities?.length ? (
        <View style={[styles.section, card]}>
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>{T("It could also be", "এটিও হতে পারে")}</Text>
          {r.otherPossibilities.map((o, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>{o.name}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{Math.round(o.confidence)}%</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.expert, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
        <Feather name="user-check" size={20} color={theme.primary} />
        <Text style={{ color: theme.text, fontSize: 13.5, lineHeight: 20, flex: 1 }}>
          {r.seeSpecialist ? T("This needs a specialist. Show them this result before using strong medicine.", "এটির জন্য বিশেষজ্ঞ দরকার। কড়া ওষুধ দেওয়ার আগে তাঁকে এই ফলাফল দেখান।") : T("AI can be wrong. A specialist can confirm before you treat.", "এআই ভুল করতে পারে। চিকিৎসার আগে বিশেষজ্ঞ নিশ্চিত করতে পারেন।")}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Pressable testID="disease-expert" onPress={onExpert} style={[styles.actBtn, { backgroundColor: theme.primary }]}>
          <Feather name="users" size={16} color="#fff" /><Text style={styles.photoBtnText}>{T("Ask a specialist", "বিশেষজ্ঞকে জিজ্ঞেস")}</Text>
        </Pressable>
        <Pressable testID="disease-ask-ai" onPress={onAsk} style={[styles.actBtn, { backgroundColor: theme.primary + "14" }]}>
          <Feather name="message-circle" size={16} color={theme.primary} /><Text style={[styles.photoBtnText, { color: theme.primary }]}>{T("Ask AI more", "এআই-কে আরও জিজ্ঞেস")}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: 18, flexDirection: "row", gap: 14, alignItems: "center" },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#fff", fontSize: 17.5, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.82)", fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  label: { fontSize: 12.5, fontWeight: "700", marginTop: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  cats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cat: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  photoBox: { marginTop: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16 },
  photoX: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  photoBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  photoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14 },
  photoBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  desc: { minHeight: 84, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, fontSize: 14.5, textAlignVertical: "top" },
  analyze: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15, borderRadius: 16 },
  analyzeText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  resultHead: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 5, padding: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  bar: { height: 7, borderRadius: 4, marginTop: 6, overflow: "hidden" },
  section: { marginTop: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  sectionIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  expert: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14 },
});
