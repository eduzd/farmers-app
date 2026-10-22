import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPut } from "@/lib/api";
import {
  useL, useLoader, Page, Card, SectionTitle, Btn, Field, KV, Loading, ErrorBox, Text, ToggleRow, Pill, RadioGroup,
  taka, fmtDate, confirmAsk, st,
} from "./ui";

/**
 * Admin > More > Payment settings. One set of payment methods for every purchase.
 * Methods: Cash on delivery and Rocket. Rocket is manual: buyers send money to the number below and type
 * the TrxID; the admin checks it in Rocket and marks the order's payment Verified or Rejected.
 * Server: server/paymentRoutes.ts (GET/PUT /api/admin/manage/payments). The saved Rocket number is never
 * sent back in full unless the admin taps Show (that is logged).
 */

export const ROCKET_COLOR = "#8C3494";
type RType = "personal" | "merchant" | "agent";
type Cfg = {
  cod: { enabled: boolean };
  rocket: {
    enabled: boolean; accountNumber: string; accountNumberMasked: string; accountNumberSet: boolean;
    accountName: string; accountType: RType; instructionsEn: string; instructionsBn: string;
  };
  updatedAt?: string | null; updatedBy?: string | null;
};

const digits = (v: string) => v.replace(/[^\d+]/g, "").slice(0, 15);
const validRocket = (v: string) => /^(?:\+?88)?01[3-9]\d{8}\d?$/.test(v.replace(/[\s\-]/g, ""));

export function PaymentSettings() {
  const { theme } = useTheme();
  const L = useL();
  const cfg = useLoader<Cfg>(() => apiGet("/api/admin/manage/payments"), []);
  const [codOn, setCodOn] = useState(true);
  const [rocketOn, setRocketOn] = useState(false);
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<RType>("personal");
  const [en, setEn] = useState("");
  const [bn, setBn] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const reset = (d: Cfg) => {
    setCodOn(d.cod.enabled); setRocketOn(d.rocket.enabled); setNum(""); setName(d.rocket.accountName || "");
    setType(d.rocket.accountType || "personal"); setEn(d.rocket.instructionsEn || ""); setBn(d.rocket.instructionsBn || ""); setShown(null);
  };
  useEffect(() => { if (cfg.data) reset(cfg.data); }, [cfg.data]);
  if (cfg.loading && !cfg.data) return <Page><Loading /></Page>;
  if (!cfg.data) return <Page><ErrorBox text={cfg.error || L("Couldn't load payment settings", "পেমেন্ট সেটিং লোড হয়নি")} onRetry={cfg.load} /></Page>;
  const d = cfg.data;
  const hasNumber = d.rocket.accountNumberSet || !!num.trim();
  const errors: string[] = [];
  if (num.trim() && !validRocket(num)) errors.push(L("Rocket number: 11 or 12 digits starting with 01", "রকেট নম্বর: ০১ দিয়ে শুরু ১১ বা ১২ সংখ্যা"));
  if (rocketOn && !hasNumber) errors.push(L("Add the Rocket number to turn Rocket on", "রকেট চালু করতে রকেট নম্বর দিন"));
  if (rocketOn && !name.trim()) errors.push(L("Add the Rocket account name to turn Rocket on", "রকেট চালু করতে অ্যাকাউন্টের নাম দিন"));
  if (!rocketOn && !codOn) errors.push(L("Keep at least one method on, or buyers can't order", "অন্তত একটি পদ্ধতি চালু রাখুন, নইলে ক্রেতারা অর্ডার করতে পারবেন না"));
  const changed =
    codOn !== d.cod.enabled || rocketOn !== d.rocket.enabled || !!num.trim() || name.trim() !== (d.rocket.accountName || "") ||
    type !== d.rocket.accountType || en.trim() !== (d.rocket.instructionsEn || "") || bn.trim() !== (d.rocket.instructionsBn || "");
  const save = async () => {
    if (d.rocket.enabled && !rocketOn) {
      const ok = await confirmAsk(L("Turn off Rocket?", "রকেট বন্ধ করবেন?"), L("Buyers won't see Rocket at checkout until you turn it on again.", "আবার চালু না করা পর্যন্ত ক্রেতারা চেকআউটে রকেট দেখবেন না।"), L("Turn off", "বন্ধ করুন"), L("Cancel", "বাতিল"));
      if (!ok) return;
    }
    setBusy(true); setMsg(null);
    try {
      await apiPut("/api/admin/manage/payments", {
        cod: { enabled: codOn },
        rocket: { enabled: rocketOn, accountNumber: num.trim(), accountName: name.trim(), accountType: type, instructionsEn: en.trim(), instructionsBn: bn.trim() },
      });
      setMsg({ ok: true, text: L("Saved. Checkout uses these settings now.", "সংরক্ষিত। চেকআউটে এখন এই সেটিং ব্যবহার হচ্ছে।") });
      await cfg.load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || L("Couldn't save", "সংরক্ষণ হয়নি") });
    } finally {
      setBusy(false);
    }
  };
  const reveal = async () => {
    if (shown) return setShown(null);
    try {
      const r: Cfg = await apiGet("/api/admin/manage/payments?reveal=1");
      setShown(r.rocket.accountNumber || "");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || L("Couldn't show the number", "নম্বর দেখানো যায়নি") });
    }
  };
  const typeLabel = (t: RType) => (t === "merchant" ? L("Merchant (Payment)", "মার্চেন্ট (পেমেন্ট)") : t === "agent" ? L("Agent (Cash In)", "এজেন্ট (ক্যাশ ইন)") : L("Personal (Send Money)", "পার্সোনাল (সেন্ড মানি)"));
  return (
    <Page onRefresh={cfg.load} testID="payment-settings">
      <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
        {L("These payment methods apply to every purchase in the marketplace. Buyers only see the ones that are on, and the server refuses orders with a method that's off.", "এই পেমেন্ট পদ্ধতিগুলো মার্কেটপ্লেসের সব কেনাকাটায় প্রযোজ্য। ক্রেতারা শুধু চালু পদ্ধতি দেখেন, আর বন্ধ পদ্ধতিতে অর্ডার সার্ভার নেয় না।")}
      </Text>

      <SectionTitle title={L("Payment methods", "পেমেন্ট পদ্ধতি")} />
      <Card>
        <ToggleRow testID="pay-cod-on" icon="dollar-sign" label={L("Cash on delivery", "ক্যাশ অন ডেলিভারি")} sub={codOn ? L("On: buyers pay when the order arrives", "চালু: অর্ডার পৌঁছালে ক্রেতা টাকা দেন") : L("Off", "বন্ধ")} value={codOn} onChange={setCodOn} />
        <ToggleRow testID="pay-rocket-on" icon="smartphone" label="Rocket" sub={rocketOn ? L("On: buyers send money and type the TrxID", "চালু: ক্রেতা টাকা পাঠিয়ে TrxID লেখেন") : L("Off", "বন্ধ")} value={rocketOn} onChange={setRocketOn} />
      </Card>

      <SectionTitle title={L("Rocket account", "রকেট অ্যাকাউন্ট")} />
      <Card testID="pay-rocket-card">
        <View style={[st.row, { gap: 8, marginBottom: 12, flexWrap: "wrap" }]}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: ROCKET_COLOR, alignItems: "center", justifyContent: "center" }}>
            <Feather name="smartphone" size={17} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={{ color: theme.text, fontWeight: "800", fontSize: 15 }}>Rocket</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>{L("Dutch-Bangla Bank mobile banking", "ডাচ্‌-বাংলা ব্যাংক মোবাইল ব্যাংকিং")}</Text>
          </View>
          <Pill label={d.rocket.enabled ? L("On", "চালু") : L("Off", "বন্ধ")} color={d.rocket.enabled ? "#047857" : "#6B7280"} />
        </View>
        {d.rocket.accountNumberSet ? (
          <KV testID="pay-rocket-saved" icon="lock" k={L("Saved number", "সংরক্ষিত নম্বর")} v={shown || d.rocket.accountNumberMasked} />
        ) : null}
        {d.rocket.accountNumberSet ? (
          <View style={[st.row, { gap: 8, marginBottom: 12, flexWrap: "wrap" }]}>
            <Btn small kind="soft" icon={shown ? "eye-off" : "eye"} label={shown ? L("Hide", "লুকান") : L("Show", "দেখান")} onPress={reveal} testID="pay-rocket-reveal" />
          </View>
        ) : null}
        <Field
          testID="pay-rocket-number"
          label={d.rocket.accountNumberSet ? L("New Rocket number (leave empty to keep)", "নতুন রকেট নম্বর (আগেরটা রাখতে খালি রাখুন)") : L("Rocket number", "রকেট নম্বর")}
          placeholder="017XXXXXXXXX"
          keyboardType="phone-pad"
          value={num}
          onChange={(v) => setNum(digits(v))}
          hint={L("Your 12-digit Rocket account: mobile number plus the last digit Rocket gave you", "আপনার ১২ সংখ্যার রকেট অ্যাকাউন্ট: মোবাইল নম্বর আর রকেটের দেওয়া শেষ সংখ্যা")}
        />
        <Field testID="pay-rocket-name" label={L("Account name", "অ্যাকাউন্টের নাম")} placeholder="Farmers Ltd" maxLength={80} value={name} onChange={setName} hint={L("Buyers check this name before they send money", "টাকা পাঠানোর আগে ক্রেতারা এই নাম মিলিয়ে দেখেন")} />
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, fontWeight: "700", marginBottom: 8 }}>{L("Account type", "অ্যাকাউন্টের ধরন")}</Text>
        <RadioGroup<RType>
          testID="pay-rocket-type"
          value={type}
          onChange={setType}
          options={(["personal", "merchant", "agent"] as RType[]).map((t) => ({ value: t, label: typeLabel(t) }))}
        />
        <View style={{ height: 14 }} />
        <Field testID="pay-rocket-en" multiline maxLength={500} label={L("Extra instructions (English)", "অতিরিক্ত নির্দেশনা (ইংরেজি)")} placeholder={L("Optional. e.g. Write your phone number as the reference.", "ঐচ্ছিক। যেমন: রেফারেন্সে আপনার ফোন নম্বর লিখুন।")} value={en} onChange={setEn} />
        <Field testID="pay-rocket-bn" multiline maxLength={500} label={L("Extra instructions (Bangla)", "অতিরিক্ত নির্দেশনা (বাংলা)")} placeholder={L("Optional, shown when the app is in Bangla", "ঐচ্ছিক, অ্যাপ বাংলায় থাকলে দেখানো হয়")} value={bn} onChange={setBn} />
      </Card>

      <SectionTitle title={L("What buyers will see", "ক্রেতারা যা দেখবেন")} />
      <Card testID="pay-preview">
        {codOn ? <KV icon="dollar-sign" k={L("Cash on delivery", "ক্যাশ অন ডেলিভারি")} v={L("Pay when it arrives", "পৌঁছালে টাকা দিন")} /> : null}
        {rocketOn ? (
          <KV icon="smartphone" k="Rocket" v={`${typeLabel(type)} · ${num.trim() ? num.trim() : d.rocket.accountNumberMasked || "—"}${name.trim() ? ` · ${name.trim()}` : ""}`} />
        ) : null}
        {!codOn && !rocketOn ? <Text style={{ color: "#DC2626", fontSize: 13 }}>{L("No method is on. Buyers can't place orders.", "কোনো পদ্ধতি চালু নেই। ক্রেতারা অর্ডার করতে পারবেন না।")}</Text> : null}
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: 8 }}>
          {L("Rocket payments aren't checked automatically. Open each Rocket order, match the TrxID and amount in your Rocket app, then tap Verified or Rejected.", "রকেট পেমেন্ট স্বয়ংক্রিয়ভাবে যাচাই হয় না। প্রতিটি রকেট অর্ডার খুলে আপনার রকেট অ্যাপে TrxID ও টাকার পরিমাণ মিলিয়ে যাচাই হয়েছে বা বাতিল চাপুন।")}
        </Text>
      </Card>

      {errors.length ? (
        <Card style={{ borderColor: "#DC262640" }}>
          {errors.map((e) => <Text key={e} style={{ color: "#DC2626", fontSize: 13, marginBottom: 4 }}>• {e}</Text>)}
        </Card>
      ) : null}
      {msg ? <Text testID="pay-msg" style={{ color: msg.ok ? "#047857" : "#DC2626", fontWeight: "600", marginVertical: 8 }}>{msg.text}</Text> : null}
      <View style={[st.row, { gap: 10, marginTop: 6, flexWrap: "wrap" }]}>
        <Btn testID="pay-save" icon="check" label={L("Save payment settings", "পেমেন্ট সেটিং সংরক্ষণ")} onPress={save} busy={busy} disabled={!changed || errors.length > 0} />
        {changed ? <Btn kind="ghost" label={L("Undo changes", "পরিবর্তন বাতিল")} onPress={() => { reset(d); setMsg(null); }} testID="pay-undo" /> : null}
      </View>
      {d.updatedAt ? (
        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 10 }}>
          {L("Last saved", "সর্বশেষ সংরক্ষণ")}: {fmtDate(d.updatedAt)}{d.updatedBy ? ` · ${d.updatedBy}` : ""}
        </Text>
      ) : null}
    </Page>
  );
}

/** On the admin order page: the buyer's Rocket payment and the Verified / Rejected buttons. */
export function RocketPaymentCheck({ order, onChanged }: { order: any; onChanged: () => void }) {
  const { theme } = useTheme();
  const L = useL();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const p = order.payment;
  if (!p || p.method !== "rocket") return null;
  const label = p.status === "verified" ? L("Verified", "যাচাই হয়েছে") : p.status === "rejected" ? L("Rejected", "বাতিল") : L("Waiting for check", "যাচাইয়ের অপেক্ষায়");
  const color = p.status === "verified" ? "#047857" : p.status === "rejected" ? "#DC2626" : "#B45309";
  const set = async (status: string) => {
    if (status === "rejected") {
      const ok = await confirmAsk(L("Reject this payment?", "এই পেমেন্ট বাতিল করবেন?"), L("The buyer gets a notification that the payment wasn't found.", "ক্রেতা নোটিফিকেশন পাবেন যে পেমেন্ট পাওয়া যায়নি।"), L("Reject", "বাতিল"), L("Cancel", "ফিরে যান"));
      if (!ok) return;
    }
    setBusy(status); setErr("");
    try {
      await apiPut(`/api/admin/manage/orders/${order.id}/payment`, { status });
      onChanged();
    } catch (e: any) {
      setErr(e?.message || L("Couldn't update", "আপডেট হয়নি"));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card testID="order-rocket">
      <View style={[st.row, { justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }]}>
        <View style={[st.row, { gap: 8 }]}>
          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: ROCKET_COLOR, alignItems: "center", justifyContent: "center" }}>
            <Feather name="smartphone" size={14} color="#fff" />
          </View>
          <Text style={{ color: theme.text, fontWeight: "800", fontSize: 15 }}>{L("Rocket payment", "রকেট পেমেন্ট")}</Text>
        </View>
        <Pill label={label} color={color} />
      </View>
      <KV icon="hash" k="TrxID" v={p.trxId} />
      <KV icon="phone" k={L("Sent from", "যে নম্বর থেকে")} v={p.senderNumber} />
      <KV icon="dollar-sign" k={L("Amount to match", "মেলানোর পরিমাণ")} v={taka(p.amount ?? order.total)} />
      {p.checkedAt ? <KV icon="clock" k={L("Checked", "যাচাই করা হয়েছে")} v={`${fmtDate(p.checkedAt)}${p.checkedBy ? ` · ${p.checkedBy}` : ""}`} /> : null}
      <View style={[st.row, { gap: 8, marginTop: 8, flexWrap: "wrap" }]}>
        {p.status !== "verified" ? <Btn small icon="check" label={L("Verified", "যাচাই হয়েছে")} onPress={() => set("verified")} busy={busy === "verified"} testID="rocket-verify" /> : null}
        {p.status !== "rejected" ? <Btn small kind="dangerSoft" icon="x" label={L("Rejected", "বাতিল")} onPress={() => set("rejected")} busy={busy === "rejected"} testID="rocket-reject" /> : null}
        {p.status !== "awaiting" ? <Btn small kind="ghost" icon="rotate-ccw" label={L("Check again", "আবার যাচাই")} onPress={() => set("awaiting")} busy={busy === "awaiting"} testID="rocket-reset" /> : null}
      </View>
      {err ? <Text style={{ color: "#DC2626", fontSize: 12.5, marginTop: 6 }}>{err}</Text> : null}
    </Card>
  );
}
