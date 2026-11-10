import React, { useEffect, useMemo, useState } from "react";
import { View, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { ModalBottomInset } from "@/components/ModalBottomInset";
import { playBase64Audio, stopAiAudio } from "@/lib/aiAudio";
import {
  useL, useLoader, Page, Card, SectionTitle, Btn, Field, Loading, ErrorBox, Text, ToggleRow, Pill, Chip, ChipRow, Switch, Hero,
  fmtDate, confirmAsk, st, DISPLAY,
} from "./ui";

/**
 * Admin > More > AI settings.
 *  - Omni route keys: any number of OpenAI-compatible gateway keys (OmniRoute, OpenRouter, OpenAI, Gemini, custom).
 *  - Models: which model answers AI help chat, the disease detector (needs a vision model) and the AI call.
 *  - AI voice calling: voice providers from different companies, a voice for English and one for Bangla.
 *  - Limits and safety.
 * Server: server/aiRoutes.ts (/api/admin/manage/ai). Keys are encrypted on the server and only the last 4
 * characters ever come back here.
 */

type Usage = { today: number; sinceRestart: number; errors: number; lastError: string | null; lastAt: string | null };
type Key = { id: string; label: string; provider: string; baseUrl: string; keyLast4: string; enabled: boolean; models?: string[]; lastTest?: { ok: boolean; at: string; message: string } | null; usage: Usage };
type Feature = { enabled: boolean; model: string; keyId: string | null; temperature: number };
type VProv = { id: string; label: string; company: string; baseUrl?: string; keyLast4: string; enabled: boolean; lastTest?: { ok: boolean; at: string; message: string } | null; usage: Usage };
type Choice = { providerId: string; voiceId: string; voiceName: string; model: string } | null;
type Cfg = {
  keys: Key[];
  features: Record<"chat" | "disease" | "voice", Feature>;
  voice: { callEnabled: boolean; providers: VProv[]; en: Choice; bn: Choice; speed: number; sttProviderId: string | null };
  limits: { perMinute: number; userDaily: number; guestDaily: number };
  extraInstructions: string;
  useServerBackup: boolean;
  serverBackupAvailable: boolean;
  ready: Record<"chat" | "disease" | "voice", boolean>;
  usingBackup: Record<"chat" | "disease" | "voice", boolean>;
  voiceStatus: { en: any; bn: any; sttReady: boolean };
  presets: Record<string, { label: string; baseUrl: string; hint: string }>;
  ttsModels: Record<string, string[]>;
  updatedAt: string | null;
};

const OK = "#00875A";
const BAD = "#DA2F2F";
const WARN = "#B25E09";
const GREY = "#7A8CA3";
const COMPANY_COLOR: Record<string, string> = { openai: "#10A37F", elevenlabs: "#111111", gemini: "#4285F4", compatible: "#6C4CF1" };
const PROVIDER_ICON: Record<string, any> = { omniroute: "git-merge", openrouter: "shuffle", openai: "cpu", gemini: "star", custom: "link" };


// ---------------------------------------------------------------- Bangla for server-made words
// The server stores English labels and test messages; these keep a Bangla screen fully Bangla.
type LFn = (en: string, bn: string) => string;
const PRESET_BN: Record<string, { label?: string; hint: string }> = {
  omniroute: { hint: "আপনার OmniRoute ঠিকানা, শেষে /v1 থাকবে, যেমন https://omniroute.example.com/v1" },
  openrouter: { hint: "মডেলের নাম যেমন openai/gpt-4o-mini বা google/gemini-2.5-flash" },
  openai: { hint: "মডেল যেমন gpt-4o-mini, gpt-4.1-mini" },
  gemini: { hint: "মডেল যেমন gemini-2.5-flash" },
  custom: { label: "অন্যান্য (OpenAI-সামঞ্জস্যপূর্ণ)", hint: "যেকোনো OpenAI-সামঞ্জস্যপূর্ণ ঠিকানা, শেষে /v1 থাকবে" },
};
const bnNum = (s: string) => s.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
const presetLabel = (L: LFn, presets: Cfg["presets"], id: string) => L(presets[id]?.label || id, PRESET_BN[id]?.label || presets[id]?.label || id);
const presetHint = (L: LFn, presets: Cfg["presets"], id: string) => L(presets[id]?.hint || "", PRESET_BN[id]?.hint || presets[id]?.hint || "");
/** "OmniRoute key 2" (the name given when the admin left it empty) reads "OmniRoute কী ২" in Bangla. */
const keyLabel = (L: LFn, label: string) => {
  const m = label.match(/^(.+) key (\d+)$/);
  return m ? L(label, `${m[1]} কী ${bnNum(m[2])}`) : label;
};
const VOICE_DEFAULT: Record<string, [string, string]> = { "Omni route voice": ["Omni route voice", "Omni route ভয়েস"] };
const provLabel = (L: LFn, label: string) => (VOICE_DEFAULT[label] ? L(...VOICE_DEFAULT[label]) : label);
const trMsg = (L: LFn, m?: string | null) => {
  if (!m) return "";
  let x = m.match(/^Connected\. (\d+) models available\.$/);
  if (x) return L(m, `সংযুক্ত। ${bnNum(x[1])}টি মডেল পাওয়া গেছে।`);
  x = m.match(/^Working\. (.+) answered in ([\d.]+)s\.$/);
  if (x) return L(m, `কাজ করছে। ${x[1]} ${bnNum(x[2])} সেকেন্ডে উত্তর দিয়েছে।`);
  if (m === "Voice works") return L(m, "কণ্ঠ কাজ করছে");
  return m;
};

// ---------------------------------------------------------------- slide-up sheet
function Sheet({ visible, title, onClose, children, testID }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; testID?: string }) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(5,12,30,0.45)" }} onPress={onClose} />
        <View testID={testID} style={{ backgroundColor: theme.backgroundRoot, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%", width: "100%", maxWidth: 640, alignSelf: "center" }}>
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.textTertiary + "66" }} />
          </View>
          <View style={[st.row, { paddingHorizontal: 18, paddingVertical: 12 }]}>
            <Text style={[DISPLAY, { color: theme.text, fontSize: 19, flex: 1 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} testID="ai-sheet-close">
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18 }}>{children}</ScrollView>
          <ModalBottomInset />
        </View>
      </View>
    </Modal>
  );
}

function StatusRow({ icon, label, ready, sub, testID }: { icon: any; label: string; ready: boolean; sub: string; testID?: string }) {
  const { theme } = useTheme();
  const L = useL();
  return (
    <View testID={testID} style={[st.row, { gap: 12, paddingVertical: 9 }]}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: (ready ? OK : WARN) + "1F", alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={17} color={ready ? OK : WARN} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14.5 }}>{label}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={2}>{sub}</Text>
      </View>
      <Pill label={ready ? L("Ready", "প্রস্তুত") : L("Not set up", "সেট হয়নি")} color={ready ? OK : WARN} />
    </View>
  );
}

export function AiSettings() {
  const { theme } = useTheme();
  const L = useL();
  const cfg = useLoader<Cfg>(() => apiGet("/api/admin/manage/ai"), []);
  const [data, setData] = useState<Cfg | null>(null);
  useEffect(() => { if (cfg.data) setData(cfg.data); }, [cfg.data]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keySheet, setKeySheet] = useState<null | { edit?: Key }>(null);
  const [provSheet, setProvSheet] = useState<null | { edit?: VProv }>(null);

  if (cfg.loading && !data) return <Page><Loading rows={4} /></Page>;
  if (cfg.error && !data) return <Page><ErrorBox text={cfg.error} onRetry={cfg.load} /></Page>;
  if (!data) return null;
  const d = data;
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 5000); };
  const backupNote = L("Using the server's backup Gemini key until you add your own", "আপনার কী যোগ না করা পর্যন্ত সার্ভারের ব্যাকআপ Gemini কী চলছে");
  const sub = (f: "chat" | "disease" | "voice") =>
    !d.features[f].enabled ? L("Turned off", "বন্ধ") : d.usingBackup[f] ? backupNote : d.ready[f] ? `${L("Model", "মডেল")}: ${d.features[f].model}` : L("Add a key and choose a model below", "নিচে কী যোগ করে মডেল বেছে নিন");
  const voiceSub = !d.voice.callEnabled ? L("Turned off", "বন্ধ") : [d.voiceStatus.en ? `${L("EN", "ইংরেজি")}: ${d.voiceStatus.en.voice}` : "", d.voiceStatus.bn ? `বাংলা: ${d.voiceStatus.bn.voice}` : ""].filter(Boolean).join(" · ") || L("No AI voice chosen yet: the phone's own voice is used", "এখনো এআই ভয়েস বাছা হয়নি: ফোনের নিজস্ব কণ্ঠ ব্যবহার হবে");

  return (
    <Page onRefresh={cfg.load} testID="ai-settings">
      <Hero testID="ai-hero">
        <View style={[st.row, { gap: 12, marginBottom: 6 }]}>
          <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
            <Feather name="zap" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[DISPLAY, { color: "#fff", fontSize: 21 }]}>{L("AI settings", "এআই সেটিং")}</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5, lineHeight: 18 }}>
              {L("Every AI feature in the farmer app uses the keys you set here. Keys stay locked on the server.", "কৃষক অ্যাপের সব এআই ফিচার এখানে দেওয়া কী ব্যবহার করে। কী সার্ভারে তালাবন্ধ থাকে।")}
            </Text>
          </View>
        </View>
      </Hero>

      <Card testID="ai-status">
        <StatusRow testID="ai-status-chat" icon="message-circle" label={L("AI help chat", "এআই সহায়ক চ্যাট")} ready={d.ready.chat} sub={sub("chat")} />
        <StatusRow testID="ai-status-disease" icon="camera" label={L("Disease detector", "রোগ শনাক্তকারী")} ready={d.ready.disease} sub={sub("disease")} />
        <StatusRow testID="ai-status-voice" icon="phone-call" label={L("AI voice call", "এআই ভয়েস কল")} ready={d.ready.voice && d.voiceStatus.sttReady} sub={voiceSub} />
      </Card>
      {msg ? <Text testID="ai-msg" style={{ color: msg.ok ? OK : BAD, fontWeight: "600", marginVertical: 6 }}>{msg.text}</Text> : null}

      <KeysSection d={d} setData={setData} flash={flash} onAdd={() => setKeySheet({})} onEdit={(k) => setKeySheet({ edit: k })} />
      <ModelsSection d={d} setData={setData} flash={flash} />
      <VoiceSection d={d} setData={setData} flash={flash} onAdd={() => setProvSheet({})} onEdit={(p) => setProvSheet({ edit: p })} />
      <LimitsSection d={d} setData={setData} flash={flash} />

      {d.updatedAt ? <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 10 }}>{L("Last saved", "সর্বশেষ সংরক্ষণ")}: {fmtDate(d.updatedAt)}</Text> : null}

      <KeySheet state={keySheet} presets={d.presets} onClose={() => setKeySheet(null)} onSaved={(c) => { setData(c); setKeySheet(null); flash(true, L("Key saved. Tap Test to check it.", "কী সংরক্ষিত। যাচাই করতে টেস্ট চাপুন।")); }} />
      <ProviderSheet state={provSheet} onClose={() => setProvSheet(null)} onSaved={(c) => { setData(c); setProvSheet(null); flash(true, L("Voice provider saved. Now pick a voice below.", "ভয়েস প্রোভাইডার সংরক্ষিত। এখন নিচে একটি কণ্ঠ বেছে নিন।")); }} />
    </Page>
  );
}

type SectionProps = { d: Cfg; setData: (c: Cfg) => void; flash: (ok: boolean, t: string) => void };

// ---------------------------------------------------------------- Omni route keys
function KeysSection({ d, setData, flash, onAdd, onEdit }: SectionProps & { onAdd: () => void; onEdit: (k: Key) => void }) {
  const { theme } = useTheme();
  const L = useL();
  const [busy, setBusy] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, { ok: boolean; message: string }>>({});
  const act = async (id: string, fn: () => Promise<any>) => {
    setBusy(id);
    try { await fn(); } catch (e: any) { flash(false, e?.message || L("Couldn't save", "সংরক্ষণ হয়নি")); } finally { setBusy(null); }
  };
  return (
    <>
      <SectionTitle title={L("Omni route API keys", "Omni route API কী")} action={L("Add key", "কী যোগ")} onAction={onAdd} testID="ai-keys-title" />
      <Text style={{ color: theme.textSecondary, fontSize: 12.5, lineHeight: 18, marginBottom: 10 }}>
        {L("Add as many keys as you like. If one fails or runs out, the next one in the list is used automatically.", "যত খুশি কী যোগ করুন। একটি কাজ না করলে বা শেষ হলে তালিকার পরেরটি নিজে থেকে ব্যবহার হয়।")}
      </Text>
      {d.keys.length === 0 ? (
        <Card testID="ai-keys-empty">
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <Feather name="key" size={26} color={theme.textTertiary} />
            <Text style={{ color: theme.textSecondary, marginTop: 8, textAlign: "center" }}>{L("No keys yet. Add your Omni route key to switch AI on.", "এখনো কোনো কী নেই। এআই চালু করতে Omni route কী যোগ করুন।")}</Text>
            <Btn style={{ marginTop: 12 }} icon="plus" label={L("Add key", "কী যোগ")} onPress={onAdd} testID="ai-key-add" />
          </View>
        </Card>
      ) : null}
      {d.keys.map((k, i) => {
        const t = tests[k.id] || k.lastTest;
        return (
          <Card key={k.id} testID={`ai-key-${i}`}>
            <View style={[st.row, { gap: 10 }]}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.primary + "1A", alignItems: "center", justifyContent: "center" }}>
                <Feather name={PROVIDER_ICON[k.provider] || "key"} size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>{i + 1}. {keyLabel(L, k.label)}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>{presetLabel(L, d.presets, k.provider)} · ••••{k.keyLast4}</Text>
              </View>
              <Switch testID={`ai-key-${i}-on`} value={k.enabled} onValueChange={(v) => act(k.id, async () => setData(await apiPut(`/api/admin/manage/ai/keys/${k.id}`, { enabled: v })))} />
            </View>
            <Text style={{ color: theme.textTertiary, fontSize: 11.5, marginTop: 8 }} numberOfLines={1}>{k.baseUrl}</Text>
            {t ? (
              <View style={[st.row, { gap: 6, marginTop: 8 }]}>
                <Feather name={t.ok ? "check-circle" : "alert-circle"} size={14} color={t.ok ? OK : BAD} />
                <Text style={{ color: t.ok ? OK : BAD, fontSize: 12.5, flex: 1 }} numberOfLines={3}>{trMsg(L, t.message)}</Text>
              </View>
            ) : null}
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 6 }}>
              {L("Used today", "আজ ব্যবহার")}: {k.usage.today}{k.usage.errors ? ` · ${L("errors", "ত্রুটি")}: ${k.usage.errors}` : ""}{k.models?.length ? ` · ${k.models.length} ${L("models", "মডেল")}` : ""}
            </Text>
            <View style={[st.row, { gap: 8, marginTop: 10, flexWrap: "wrap" }]}>
              <Btn small kind="soft" icon="activity" label={L("Test", "টেস্ট")} busy={busy === k.id + "t"} testID={`ai-key-${i}-test`}
                onPress={() => act(k.id + "t", async () => {
                  const r: any = await apiPost(`/api/admin/manage/ai/keys/${k.id}/test`, {});
                  setTests((s) => ({ ...s, [k.id]: { ok: r.ok, message: r.message } }));
                  setData(r.config);
                })} />
              <Btn small kind="ghost" icon="edit-2" label={L("Edit", "সম্পাদনা")} onPress={() => onEdit(k)} testID={`ai-key-${i}-edit`} />
              {i > 0 ? <Btn small kind="ghost" icon="arrow-up" label={L("Up", "উপরে")} onPress={() => act(k.id, async () => setData(await apiPut(`/api/admin/manage/ai/keys/${k.id}`, { moveUp: true })))} testID={`ai-key-${i}-up`} /> : null}
              <Btn small kind="dangerSoft" icon="trash-2" label={L("Delete", "মুছুন")} testID={`ai-key-${i}-delete`}
                onPress={async () => {
                  const ok = await confirmAsk(L("Delete this key?", "এই কী মুছবেন?"), L(`${k.label} (••••${k.keyLast4}) is removed from the server. AI features use your other keys.`, `${k.label} (••••${k.keyLast4}) সার্ভার থেকে মুছে যাবে। এআই ফিচার অন্য কী ব্যবহার করবে।`), L("Delete", "মুছুন"), L("Cancel", "ফিরে যান"), "danger");
                  if (ok) act(k.id, async () => setData(await apiDelete(`/api/admin/manage/ai/keys/${k.id}`)));
                }} />
            </View>
          </Card>
        );
      })}
    </>
  );
}

function KeySheet({ state, presets, onClose, onSaved }: { state: null | { edit?: Key }; presets: Cfg["presets"]; onClose: () => void; onSaved: (c: Cfg) => void }) {
  const { theme } = useTheme();
  const L = useL();
  const edit = state?.edit;
  const [provider, setProvider] = useState("omniroute");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!state) return;
    setProvider(edit?.provider || "omniroute");
    setLabel(edit?.label || "");
    setBaseUrl(edit?.baseUrl || presets.omniroute?.baseUrl || "");
    setKey("");
    setErr("");
  }, [state]);
  const pick = (p: string) => {
    setProvider(p);
    if (presets[p]?.baseUrl) setBaseUrl(presets[p].baseUrl);
    else if (Object.values(presets).some((x) => x.baseUrl && x.baseUrl === baseUrl)) setBaseUrl("");
  };
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body: any = { provider, label: label.trim(), baseUrl: baseUrl.trim() };
      if (key.trim()) body.apiKey = key.trim();
      const c: Cfg = edit ? await apiPut(`/api/admin/manage/ai/keys/${edit.id}`, body) : await apiPost("/api/admin/manage/ai/keys", body);
      onSaved(c);
    } catch (e: any) { setErr(e?.message || L("Couldn't save", "সংরক্ষণ হয়নি")); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!state} title={edit ? L("Edit key", "কী সম্পাদনা") : L("Add Omni route key", "Omni route কী যোগ")} onClose={onClose} testID="ai-key-sheet">
      <Text style={[st.label, { color: theme.textSecondary, marginBottom: 8 }]}>{L("Service", "সার্ভিস")}</Text>
      <ChipRow>
        {Object.entries(presets).map(([id, p]) => <Chip key={id} testID={`ai-key-provider-${id}`} label={presetLabel(L, presets, id)} on={provider === id} onPress={() => pick(id)} />)}
      </ChipRow>
      <View style={{ height: 12 }} />
      <Field testID="ai-key-label" label={L("Name", "নাম")} placeholder={L("e.g. Main key", "যেমন: মূল কী")} value={label} onChange={setLabel} maxLength={60} />
      <Field testID="ai-key-url" label={L("Address (base URL)", "ঠিকানা (বেস URL)")} placeholder="https://.../v1" value={baseUrl} onChange={setBaseUrl} hint={presetHint(L, presets, provider)} />
      <Field testID="ai-key-value" secure label={edit ? L(`New API key (leave empty to keep ••••${edit.keyLast4})`, `নতুন API কী (••••${edit.keyLast4} রাখতে খালি রাখুন)`) : L("API key", "API কী")} placeholder="sk-..." value={key} onChange={setKey}
        hint={L("Saved encrypted on the server. After saving, only the last 4 characters are shown.", "সার্ভারে এনক্রিপ্ট করে রাখা হয়। সংরক্ষণের পর শুধু শেষ ৪টি অক্ষর দেখা যায়।")} />
      {err ? <Text testID="ai-key-err" style={{ color: BAD, marginBottom: 10 }}>{err}</Text> : null}
      <Btn testID="ai-key-save" icon="lock" label={edit ? L("Save changes", "পরিবর্তন সংরক্ষণ") : L("Save key", "কী সংরক্ষণ")} onPress={save} busy={busy} disabled={!baseUrl.trim() || (!edit && key.trim().length < 8)} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- models per feature
const SUGGESTED: Record<string, string[]> = {
  chat: ["gpt-4o-mini", "gemini-2.5-flash", "openai/gpt-4o-mini", "google/gemini-2.5-flash"],
  disease: ["gpt-4o", "gemini-2.5-flash", "openai/gpt-4o", "google/gemini-2.5-pro"],
  voice: ["gpt-4o-mini", "gemini-2.5-flash", "openai/gpt-4o-mini", "google/gemini-2.5-flash-lite"],
};

function ModelsSection({ d, setData, flash }: SectionProps) {
  const { theme } = useTheme();
  const L = useL();
  const [f, setF] = useState(d.features);
  useEffect(() => setF(d.features), [d.features]);
  const [busy, setBusy] = useState(false);
  const [trying, setTrying] = useState<string | null>(null);
  const [tryOut, setTryOut] = useState<Record<string, { ok: boolean; text: string }>>({});
  const allModels = useMemo(() => Array.from(new Set(d.keys.flatMap((k) => k.models || []))), [d.keys]);
  const changed = JSON.stringify(f) !== JSON.stringify(d.features);
  const rows: ["chat" | "disease" | "voice", string, string, any][] = [
    ["chat", L("AI help chat", "এআই সহায়ক চ্যাট"), L("Answers farmers' questions in chat", "চ্যাটে কৃষকদের প্রশ্নের উত্তর দেয়"), "message-circle"],
    ["disease", L("Disease detector", "রোগ শনাক্তকারী"), L("Reads photos: choose a model that can see images", "ছবি দেখে: ছবি বুঝতে পারে এমন মডেল বেছে নিন"), "camera"],
    ["voice", L("AI call brain", "এআই কলের মস্তিষ্ক"), L("Thinks of the answers during an AI call: a fast model works best", "এআই কলে উত্তর ঠিক করে: দ্রুত মডেল ভালো"), "phone-call"],
  ];
  const set = (name: string, patch: Partial<Feature>) => setF((s: any) => ({ ...s, [name]: { ...s[name], ...patch } }));
  const save = async () => {
    setBusy(true);
    try { setData(await apiPut("/api/admin/manage/ai/settings", { features: f })); flash(true, L("Models saved. The app uses them now.", "মডেল সংরক্ষিত। অ্যাপ এখন এগুলো ব্যবহার করছে।")); }
    catch (e: any) { flash(false, e?.message || L("Couldn't save", "সংরক্ষণ হয়নি")); } finally { setBusy(false); }
  };
  const tryIt = async (name: string) => {
    setTrying(name);
    try {
      const r: any = await apiPost("/api/admin/manage/ai/try", { feature: name, lang: L("en", "bn") });
      setTryOut((s) => ({ ...s, [name]: { ok: true, text: `${r.reply}\n\n${r.model} · ${L(`${(r.ms / 1000).toFixed(1)}s`, `${bnNum((r.ms / 1000).toFixed(1))} সেকেন্ড`)} · ${r.via === "Server backup key" ? L(r.via, "সার্ভারের ব্যাকআপ কী") : keyLabel(L, r.via)}` } }));
    } catch (e: any) { setTryOut((s) => ({ ...s, [name]: { ok: false, text: e?.message || "Failed" } })); } finally { setTrying(null); }
  };
  return (
    <>
      <SectionTitle title={L("Model for each feature", "প্রতিটি ফিচারের মডেল")} />
      {rows.map(([name, title, hint, icon]) => {
        const v = f[name];
        const q = v.model.trim().toLowerCase();
        const options = (allModels.length ? allModels : SUGGESTED[name]).filter((m) => !q || m.toLowerCase().includes(q)).slice(0, 8);
        return (
          <Card key={name} testID={`ai-feature-${name}`}>
            <ToggleRow testID={`ai-feature-${name}-on`} icon={icon} label={title} sub={hint} value={v.enabled} onChange={(on) => set(name, { enabled: on })} />
            <Field testID={`ai-feature-${name}-model`} label={L("Model", "মডেল")} placeholder={SUGGESTED[name][0]} value={v.model} onChange={(m) => set(name, { model: m })}
              hint={allModels.length ? L("Tap one below or type its exact name", "নিচ থেকে বেছে নিন বা ঠিক নাম লিখুন") : L("Test a key above to see its full model list", "পুরো মডেল তালিকা দেখতে উপরে একটি কী টেস্ট করুন")} />
            {options.length && !(options.length === 1 && options[0] === v.model) ? (
              <ChipRow>{options.map((m) => <Chip key={m} label={m} on={v.model === m} onPress={() => set(name, { model: m })} testID={`ai-feature-${name}-opt`} />)}</ChipRow>
            ) : null}
            {d.keys.length > 1 ? (
              <>
                <Text style={[st.label, { color: theme.textSecondary, marginTop: 10, marginBottom: 6 }]}>{L("Which key", "কোন কী")}</Text>
                <ChipRow>
                  <Chip label={L("Any (in order)", "যেকোনো (ক্রমানুসারে)")} on={!v.keyId} onPress={() => set(name, { keyId: null })} />
                  {d.keys.map((k) => <Chip key={k.id} label={keyLabel(L, k.label)} on={v.keyId === k.id} onPress={() => set(name, { keyId: k.id })} />)}
                </ChipRow>
              </>
            ) : null}
            <View style={[st.row, { gap: 8, marginTop: 10 }]}>
              <Btn small kind="soft" icon="play" label={L("Try it", "চেষ্টা করুন")} busy={trying === name} disabled={changed} onPress={() => tryIt(name)} testID={`ai-feature-${name}-try`} />
              {changed ? <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{L("Save first to try", "চেষ্টার আগে সংরক্ষণ করুন")}</Text> : null}
            </View>
            {tryOut[name] ? (
              <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: (tryOut[name].ok ? theme.primary : BAD) + "12" }}>
                <Text testID={`ai-feature-${name}-out`} style={{ color: tryOut[name].ok ? theme.text : BAD, fontSize: 13, lineHeight: 19 }}>{tryOut[name].text}</Text>
              </View>
            ) : null}
          </Card>
        );
      })}
      {changed ? (
        <View style={[st.row, { gap: 10, marginBottom: 8, flexWrap: "wrap" }]}>
          <Btn testID="ai-models-save" icon="check" label={L("Save models", "মডেল সংরক্ষণ")} onPress={save} busy={busy} />
          <Btn kind="ghost" label={L("Undo", "বাতিল")} onPress={() => setF(d.features)} />
        </View>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- voice
const COMPANIES: { id: string; en: string; bn: string; hint: string; hintBn: string }[] = [
  { id: "openai", en: "OpenAI", bn: "OpenAI", hint: "11 voices · speaks Bangla and English · also listens (speech to text)", hintBn: "১১টি কণ্ঠ · বাংলা ও ইংরেজিতে কথা বলে · শুনতেও পারে (কথা থেকে লেখা)" },
  { id: "elevenlabs", en: "ElevenLabs", bn: "ElevenLabs", hint: "Your account's voices · use the eleven_v3 model for Bangla · also listens", hintBn: "আপনার অ্যাকাউন্টের কণ্ঠ · বাংলার জন্য eleven_v3 মডেল ব্যবহার করুন · শুনতেও পারে" },
  { id: "gemini", en: "Google Gemini", bn: "Google Gemini", hint: "30 voices · speaks Bangla and English · also listens", hintBn: "৩০টি কণ্ঠ · বাংলা ও ইংরেজিতে কথা বলে · শুনতেও পারে" },
  { id: "compatible", en: "Omni route voice", bn: "Omni route ভয়েস", hint: "Any OpenAI-compatible speech address, e.g. your OmniRoute /v1", hintBn: "যেকোনো OpenAI-সামঞ্জস্যপূর্ণ স্পিচ ঠিকানা, যেমন আপনার OmniRoute /v1" },
];
const companyName = (c: string) => COMPANIES.find((x) => x.id === c)?.en || c;

function VoiceSection({ d, setData, flash, onAdd, onEdit }: SectionProps & { onAdd: () => void; onEdit: (p: VProv) => void }) {
  const { theme } = useTheme();
  const L = useL();
  const [lang, setLang] = useState<"en" | "bn">("bn");
  const [sel, setSel] = useState<{ en: Choice; bn: Choice }>({ en: d.voice.en, bn: d.voice.bn });
  const [speed, setSpeed] = useState(d.voice.speed);
  const [stt, setStt] = useState<string | null>(d.voice.sttProviderId);
  useEffect(() => { setSel({ en: d.voice.en, bn: d.voice.bn }); setSpeed(d.voice.speed); setStt(d.voice.sttProviderId); }, [d.voice]);
  const enabled = d.voice.providers.filter((p) => p.enabled);
  const cur = sel[lang];
  const [provId, setProvId] = useState<string | null>(cur?.providerId || enabled[0]?.id || null);
  useEffect(() => { setProvId(sel[lang]?.providerId || enabled[0]?.id || null); }, [lang, d.voice.providers.length]);
  const prov = d.voice.providers.find((p) => p.id === provId) || null;
  const [voices, setVoices] = useState<{ id: string; name: string; note?: string }[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>(cur?.model || "");
  const [vLoading, setVLoading] = useState(false);
  const [vErr, setVErr] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!prov) { setVoices([]); return; }
    let live = true;
    setVLoading(true); setVErr("");
    apiGet(`/api/admin/manage/ai/voice/providers/${prov.id}/voices`).then((r: any) => {
      if (!live) return;
      setVoices(r.voices || []); setModels(r.models || []);
      const keep = sel[lang]?.providerId === prov.id ? sel[lang]?.model : "";
      setModel(keep || (prov.company === "elevenlabs" ? "eleven_v3" : (r.models || [])[0] || ""));
    }).catch((e: any) => live && setVErr(e?.message || "Failed")).finally(() => live && setVLoading(false));
    return () => { live = false; };
  }, [prov?.id, prov?.keyLast4]);
  useEffect(() => () => stopAiAudio(), []);

  const preview = async (voiceId: string) => {
    if (!prov) return;
    if (playing === voiceId) { stopAiAudio(); setPlaying(null); return; }
    setPlaying(voiceId);
    try {
      const r: any = await apiPost("/api/admin/manage/ai/voice/preview", { providerId: prov.id, voiceId, model, lang });
      await playBase64Audio(r.audioBase64, r.mimeType);
    } catch (e: any) { flash(false, e?.message || L("Couldn't play the voice", "কণ্ঠ চালানো যায়নি")); } finally { setPlaying((p) => (p === voiceId ? null : p)); }
  };
  const choose = (v: { id: string; name: string }) => prov && setSel((s) => ({ ...s, [lang]: { providerId: prov.id, voiceId: v.id, voiceName: v.name, model } }));
  useEffect(() => { if (cur && prov && cur.providerId === prov.id && cur.model !== model && model) setSel((s) => ({ ...s, [lang]: { ...(s[lang] as any), model } })); }, [model]);
  const changed = JSON.stringify(sel) !== JSON.stringify({ en: d.voice.en, bn: d.voice.bn }) || speed !== d.voice.speed || stt !== d.voice.sttProviderId;
  const save = async () => {
    setBusy("save");
    try { setData(await apiPut("/api/admin/manage/ai/settings", { voice: { en: sel.en, bn: sel.bn, speed, sttProviderId: stt } })); flash(true, L("Voice settings saved. AI calls use them now.", "ভয়েস সেটিং সংরক্ষিত। এআই কল এখন এগুলো ব্যবহার করছে।")); }
    catch (e: any) { flash(false, e?.message || L("Couldn't save", "সংরক্ষণ হয়নি")); } finally { setBusy(null); }
  };
  const toggleProv = async (p: VProv, on: boolean) => {
    setBusy(p.id);
    try { setData(await apiPut(`/api/admin/manage/ai/voice/providers/${p.id}`, { enabled: on })); } catch (e: any) { flash(false, e?.message); } finally { setBusy(null); }
  };

  return (
    <>
      <SectionTitle title={L("AI voice calling", "এআই ভয়েস কল")} action={L("Add provider", "প্রোভাইডার যোগ")} onAction={onAdd} testID="ai-voice-title" />
      <Card>
        <ToggleRow testID="ai-call-on" icon="phone-call" label={L("AI call in the farmer app", "কৃষক অ্যাপে এআই কল")} sub={d.voice.callEnabled ? L("On: farmers can talk to Krishi AI", "চালু: কৃষকরা কৃষি এআই-এর সাথে কথা বলতে পারেন") : L("Off", "বন্ধ")}
          value={d.voice.callEnabled} onChange={async (v) => { try { setData(await apiPut("/api/admin/manage/ai/settings", { voice: { callEnabled: v } })); } catch (e: any) { flash(false, e?.message); } }} />
      </Card>
      {d.voice.providers.length === 0 ? (
        <Card testID="ai-voice-empty">
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <Feather name="mic" size={26} color={theme.textTertiary} />
            <Text style={{ color: theme.textSecondary, marginTop: 8, textAlign: "center" }}>{L("Add a voice company (OpenAI, ElevenLabs, Google Gemini or Omni route) to give Krishi AI a natural voice.", "কৃষি এআই-কে স্বাভাবিক কণ্ঠ দিতে একটি ভয়েস কোম্পানি যোগ করুন (OpenAI, ElevenLabs, Google Gemini বা Omni route)।")}</Text>
            <Btn style={{ marginTop: 12 }} icon="plus" label={L("Add provider", "প্রোভাইডার যোগ")} onPress={onAdd} testID="ai-voice-add" />
          </View>
        </Card>
      ) : null}
      {d.voice.providers.map((p, i) => (
        <Card key={p.id} testID={`ai-vprov-${i}`}>
          <View style={[st.row, { gap: 10 }]}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: COMPANY_COLOR[p.company] || theme.primary, alignItems: "center", justifyContent: "center" }}>
              <Feather name="mic" size={17} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>{provLabel(L, p.label)}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{provLabel(L, companyName(p.company))} · ••••{p.keyLast4}{p.usage.today ? ` · ${L("used today", "আজ ব্যবহার")}: ${p.usage.today}` : ""}</Text>
            </View>
            {busy === p.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Switch testID={`ai-vprov-${i}-on`} value={p.enabled} onValueChange={(v) => toggleProv(p, v)} />}
          </View>
          {p.lastTest ? (
            <View style={[st.row, { gap: 6, marginTop: 8 }]}>
              <Feather name={p.lastTest.ok ? "check-circle" : "alert-circle"} size={14} color={p.lastTest.ok ? OK : BAD} />
              <Text style={{ color: p.lastTest.ok ? OK : BAD, fontSize: 12.5, flex: 1 }} numberOfLines={3}>{trMsg(L, p.lastTest.message)}</Text>
            </View>
          ) : null}
          <View style={[st.row, { gap: 8, marginTop: 10, flexWrap: "wrap" }]}>
            <Btn small kind="ghost" icon="edit-2" label={L("Edit", "সম্পাদনা")} onPress={() => onEdit(p)} testID={`ai-vprov-${i}-edit`} />
            <Btn small kind="dangerSoft" icon="trash-2" label={L("Delete", "মুছুন")} testID={`ai-vprov-${i}-delete`} onPress={async () => {
              const ok = await confirmAsk(L("Delete this voice provider?", "এই ভয়েস প্রোভাইডার মুছবেন?"), L("Voices chosen from it are cleared too.", "এর থেকে বাছাই করা কণ্ঠও মুছে যাবে।"), L("Delete", "মুছুন"), L("Cancel", "ফিরে যান"), "danger");
              if (!ok) return;
              try { setData(await apiDelete(`/api/admin/manage/ai/voice/providers/${p.id}`)); } catch (e: any) { flash(false, e?.message); }
            }} />
          </View>
        </Card>
      ))}

      {enabled.length ? (
        <Card testID="ai-voice-pick">
          <Text style={[DISPLAY, { color: theme.text, fontSize: 17, marginBottom: 4 }]}>{L("Krishi AI's voice", "কৃষি এআই-এর কণ্ঠ")}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginBottom: 10 }}>{L("Pick a voice for each language. Tap play to hear it first.", "প্রতিটি ভাষার জন্য একটি কণ্ঠ বেছে নিন। আগে শুনতে প্লে চাপুন।")}</Text>
          <ChipRow>
            <Chip testID="ai-voice-lang-bn" label={`বাংলা${sel.bn ? ` · ${sel.bn.voiceName}` : ""}`} on={lang === "bn"} onPress={() => setLang("bn")} />
            <Chip testID="ai-voice-lang-en" label={`English${sel.en ? ` · ${sel.en.voiceName}` : ""}`} on={lang === "en"} onPress={() => setLang("en")} />
          </ChipRow>
          <Text style={[st.label, { color: theme.textSecondary, marginTop: 12, marginBottom: 6 }]}>{L("Company", "কোম্পানি")}</Text>
          <ChipRow>{enabled.map((p) => <Chip key={p.id} label={provLabel(L, p.label)} on={provId === p.id} onPress={() => setProvId(p.id)} testID="ai-voice-prov" />)}</ChipRow>
          {models.length > 1 ? (
            <>
              <Text style={[st.label, { color: theme.textSecondary, marginTop: 12, marginBottom: 6 }]}>{L("Voice model", "ভয়েস মডেল")}</Text>
              <ChipRow>{models.map((m) => <Chip key={m} label={m} on={model === m} onPress={() => setModel(m)} testID="ai-voice-model" />)}</ChipRow>
            </>
          ) : null}
          <View style={{ height: 10 }} />
          {vLoading ? <ActivityIndicator color={theme.primary} style={{ marginVertical: 14 }} /> : vErr ? <Text style={{ color: BAD, marginVertical: 8 }}>{vErr}</Text> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {voices.map((v) => {
                const on = cur?.providerId === prov?.id && cur?.voiceId === v.id;
                return (
                  <Pressable key={v.id} testID={`ai-voice-${v.id}`} onPress={() => choose(v)}
                    style={{ flexGrow: 1, flexBasis: 150, maxWidth: 260, padding: 10, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? theme.primary : theme.cardBorder || theme.inputBorder, backgroundColor: on ? theme.primary + "10" : theme.backgroundDefault, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable onPress={() => preview(v.id)} hitSlop={6} testID={`ai-voice-${v.id}-play`}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: on ? theme.primary : theme.primary + "1A", alignItems: "center", justifyContent: "center" }}>
                      {playing === v.id ? <ActivityIndicator size="small" color={on ? "#fff" : theme.primary} /> : <Feather name="play" size={14} color={on ? "#fff" : theme.primary} />}
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13.5 }} numberOfLines={1}>{v.name}</Text>
                      {v.note ? <Text style={{ color: theme.textSecondary, fontSize: 11.5 }} numberOfLines={1}>{v.note}</Text> : null}
                    </View>
                    {on ? <Feather name="check-circle" size={16} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={[st.label, { color: theme.textSecondary, marginTop: 14, marginBottom: 6 }]}>{L("Speaking speed", "কথার গতি")}</Text>
          <ChipRow>
            {[[0.85, L("Slow", "ধীর")], [1, L("Normal", "স্বাভাবিক")], [1.15, L("Fast", "দ্রুত")]].map(([v, l]) => <Chip key={String(v)} label={String(l)} on={Math.abs(speed - Number(v)) < 0.01} onPress={() => setSpeed(Number(v))} />)}
          </ChipRow>
          <Text style={[st.label, { color: theme.textSecondary, marginTop: 14, marginBottom: 6 }]}>{L("Listening (speech to text)", "শোনা (কথা থেকে লেখা)")}</Text>
          <ChipRow>
            <Chip label={L("Automatic", "স্বয়ংক্রিয়")} on={!stt} onPress={() => setStt(null)} />
            {enabled.map((p) => <Chip key={p.id} label={provLabel(L, p.label)} on={stt === p.id} onPress={() => setStt(p.id)} />)}
          </ChipRow>
          {changed ? (
            <View style={[st.row, { gap: 10, marginTop: 14, flexWrap: "wrap" }]}>
              <Btn testID="ai-voice-save" icon="check" label={L("Save voice settings", "ভয়েস সেটিং সংরক্ষণ")} onPress={save} busy={busy === "save"} />
              <Btn kind="ghost" label={L("Undo", "বাতিল")} onPress={() => { setSel({ en: d.voice.en, bn: d.voice.bn }); setSpeed(d.voice.speed); setStt(d.voice.sttProviderId); }} />
            </View>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

function ProviderSheet({ state, onClose, onSaved }: { state: null | { edit?: VProv }; onClose: () => void; onSaved: (c: Cfg) => void }) {
  const { theme } = useTheme();
  const L = useL();
  const edit = state?.edit;
  const [company, setCompany] = useState("openai");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!state) return;
    setCompany(edit?.company || "openai"); setLabel(edit?.label || ""); setBaseUrl(edit?.baseUrl || ""); setKey(""); setErr("");
  }, [state]);
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body: any = { company, label: label.trim(), baseUrl: baseUrl.trim() };
      if (key.trim()) body.apiKey = key.trim();
      onSaved(edit ? await apiPut(`/api/admin/manage/ai/voice/providers/${edit.id}`, body) : await apiPost("/api/admin/manage/ai/voice/providers", body));
    } catch (e: any) { setErr(e?.message || L("Couldn't save", "সংরক্ষণ হয়নি")); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!state} title={edit ? L("Edit voice provider", "ভয়েস প্রোভাইডার সম্পাদনা") : L("Add voice provider", "ভয়েস প্রোভাইডার যোগ")} onClose={onClose} testID="ai-vprov-sheet">
      {!edit ? (
        <View style={{ gap: 8, marginBottom: 12 }}>
          {COMPANIES.map((c) => {
            const on = company === c.id;
            return (
              <Pressable key={c.id} testID={`ai-vprov-company-${c.id}`} onPress={() => setCompany(c.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? theme.primary : theme.inputBorder, backgroundColor: on ? theme.primary + "10" : theme.backgroundDefault }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: COMPANY_COLOR[c.id], alignItems: "center", justifyContent: "center" }}><Feather name="mic" size={15} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: "700" }}>{L(c.en, c.bn)}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{L(c.hint, c.hintBn)}</Text>
                </View>
                {on ? <Feather name="check-circle" size={18} color={theme.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Field testID="ai-vprov-label" label={L("Name", "নাম")} placeholder={provLabel(L, companyName(company))} value={label} onChange={setLabel} maxLength={60} />
      {company === "compatible" ? <Field testID="ai-vprov-url" label={L("Speech address (base URL)", "স্পিচ ঠিকানা (বেস URL)")} placeholder="https://.../v1" value={baseUrl} onChange={setBaseUrl} hint={L("The app calls /audio/speech and /audio/transcriptions on this address", "অ্যাপ এই ঠিকানায় /audio/speech ও /audio/transcriptions ব্যবহার করে")} /> : null}
      <Field testID="ai-vprov-key" secure label={edit ? L(`New API key (leave empty to keep ••••${edit.keyLast4})`, `নতুন API কী (••••${edit.keyLast4} রাখতে খালি রাখুন)`) : L("API key", "API কী")} value={key} onChange={setKey}
        hint={L("Saved encrypted on the server. Only the last 4 characters are shown.", "সার্ভারে এনক্রিপ্ট করে রাখা হয়। শুধু শেষ ৪টি অক্ষর দেখা যায়।")} />
      {err ? <Text testID="ai-vprov-err" style={{ color: BAD, marginBottom: 10 }}>{err}</Text> : null}
      <Btn testID="ai-vprov-save" icon="lock" label={edit ? L("Save changes", "পরিবর্তন সংরক্ষণ") : L("Save provider", "প্রোভাইডার সংরক্ষণ")} onPress={save} busy={busy} disabled={(!edit && key.trim().length < 8) || (company === "compatible" && !baseUrl.trim())} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- limits and safety
function LimitsSection({ d, setData, flash }: SectionProps) {
  const { theme } = useTheme();
  const L = useL();
  const [perMinute, setPerMinute] = useState(String(d.limits.perMinute));
  const [userDaily, setUserDaily] = useState(String(d.limits.userDaily));
  const [guestDaily, setGuestDaily] = useState(String(d.limits.guestDaily));
  const [extra, setExtra] = useState(d.extraInstructions);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPerMinute(String(d.limits.perMinute)); setUserDaily(String(d.limits.userDaily)); setGuestDaily(String(d.limits.guestDaily)); setExtra(d.extraInstructions); }, [d.limits, d.extraInstructions]);
  const changed = perMinute !== String(d.limits.perMinute) || userDaily !== String(d.limits.userDaily) || guestDaily !== String(d.limits.guestDaily) || extra !== d.extraInstructions;
  const num = (s: string) => s.replace(/[^0-9]/g, "");
  const save = async () => {
    setBusy(true);
    try { setData(await apiPut("/api/admin/manage/ai/settings", { limits: { perMinute: Number(perMinute), userDaily: Number(userDaily), guestDaily: Number(guestDaily) }, extraInstructions: extra })); flash(true, L("Saved.", "সংরক্ষিত।")); }
    catch (e: any) { flash(false, e?.message || L("Couldn't save", "সংরক্ষণ হয়নি")); } finally { setBusy(false); }
  };
  return (
    <>
      <SectionTitle title={L("Limits and safety", "সীমা ও নিরাপত্তা")} />
      <Card testID="ai-limits">
        <Field testID="ai-limit-minute" label={L("Requests per person per minute", "জনপ্রতি প্রতি মিনিটে অনুরোধ")} keyboardType="number-pad" value={perMinute} onChange={(v) => setPerMinute(num(v))} />
        <Field testID="ai-limit-user" label={L("Per signed-in user per day", "সাইন ইন করা ব্যবহারকারী প্রতি দিনে")} keyboardType="number-pad" value={userDaily} onChange={(v) => setUserDaily(num(v))} />
        <Field testID="ai-limit-guest" label={L("Per guest (not signed in) per day", "অতিথি (সাইন ইন ছাড়া) প্রতি দিনে")} keyboardType="number-pad" value={guestDaily} onChange={(v) => setGuestDaily(num(v))} hint={L("A photo check counts as 2.", "একটি ছবি পরীক্ষা ২টি হিসেবে গণা হয়।")} />
        <Field testID="ai-extra" multiline maxLength={1500} label={L("Extra instructions for the AI (optional)", "এআই-এর জন্য অতিরিক্ত নির্দেশনা (ঐচ্ছিক)")} placeholder={L("e.g. Recommend products from our marketplace when they fit.", "যেমন: মানালে আমাদের মার্কেটপ্লেসের পণ্য সুপারিশ করুন।")} value={extra} onChange={setExtra} />
        {d.serverBackupAvailable ? (
          <ToggleRow testID="ai-backup" icon="life-buoy" label={L("Use server backup key", "সার্ভারের ব্যাকআপ কী ব্যবহার")} sub={L("The Gemini key saved on the server is used only when none of your keys work", "আপনার কোনো কী কাজ না করলে শুধু তখন সার্ভারের Gemini কী ব্যবহার হয়")}
            value={d.useServerBackup} onChange={async (v) => { try { setData(await apiPut("/api/admin/manage/ai/settings", { useServerBackup: v })); } catch (e: any) { flash(false, e?.message); } }} />
        ) : null}
        {changed ? <Btn testID="ai-limits-save" icon="check" label={L("Save", "সংরক্ষণ")} onPress={save} busy={busy} style={{ marginTop: 6 }} /> : null}
      </Card>
    </>
  );
}
