import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import { useTheme } from "@/hooks/useTheme";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebaseAuth";
import {
  useAdminNav, useL, useLoader, Page, Card, SectionTitle, Pill, Chip, ChipRow, Btn, Field, KV, Empty, Loading, ErrorBox, Text,
  ToggleRow, Avatar, Segmented, Stat, taka, fmtDate, confirmAsk, st,
} from "./ui";
import { OrderRow } from "./shop";

type L = ReturnType<typeof useL>;
const LIMITS = ["message", "post", "comment", "sell", "buy"] as const;
const limitLabel = (k: string, L: L) =>
  (({
    message: L("Send messages", "মেসেজ পাঠানো"), post: L("Post in the community", "কমিউনিটিতে পোস্ট"), comment: L("Comment", "মন্তব্য"),
    sell: L("Sell products", "পণ্য বিক্রি"), buy: L("Place orders", "অর্ডার করা"),
  } as Record<string, string>)[k] || k);
const limitIcon: Record<string, keyof typeof Feather.glyphMap> = { message: "message-circle", post: "edit", comment: "message-square", sell: "tag", buy: "shopping-cart" };
const actionLabel = (a: string, L: L) =>
  (({
    WARN_USER: L("Warning sent", "সতর্কবার্তা পাঠানো হয়েছে"), WITHDRAW_WARNING: L("Warning withdrawn", "সতর্কবার্তা প্রত্যাহার"),
    RESTRICT_USER: L("Limits set", "সীমা দেওয়া হয়েছে"), UNRESTRICT_USER: L("Limits lifted", "সীমা তুলে নেওয়া হয়েছে"),
    BAN_USER: L("Banned", "ব্যান করা হয়েছে"), UNBAN_USER: L("Unbanned", "ব্যান তুলে নেওয়া হয়েছে"), UPDATE_USER: L("Details edited", "তথ্য সম্পাদনা"),
    RESET_PASSWORD: L("Password set", "পাসওয়ার্ড সেট"), OFFICIAL_MESSAGE: L("Official message", "অফিসিয়াল মেসেজ"), REMOVE_CONTENT: L("Content removed", "কন্টেন্ট মোছা হয়েছে"),
  } as Record<string, string>)[a] || a.replace(/_/g, " ").toLowerCase());
const actionIcon = (a: string): keyof typeof Feather.glyphMap =>
  a.includes("WARN") ? "alert-triangle" : a.includes("BAN") ? "slash" : a.includes("RESTRICT") ? "lock" : a.includes("MESSAGE") ? "send" : a.includes("PASSWORD") ? "key" : "edit-2";

function Banner({ color, icon, title, sub, action }: { color: string; icon: keyof typeof Feather.glyphMap; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: color + "14", borderWidth: 1, borderColor: color + "33" }}>
      <Feather name={icon} size={18} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color, fontWeight: "800" }}>{title}</Text>
        {sub ? <Text style={{ color, fontSize: 12.5, opacity: 0.9 }}>{sub}</Text> : null}
      </View>
      {action}
    </View>
  );
}

function QuickAction({ icon, label, color, onPress, testID }: { icon: keyof typeof Feather.glyphMap; label: string; color: string; onPress: () => void; testID?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", gap: 6, flex: 1, minWidth: 64, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

type Tab = "overview" | "message" | "safety" | "account" | "activity";

export function UserDetail({ id }: { id: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const u = useLoader<any>(() => apiGet(`/api/admin/manage/users/${id}`), [id]);
  const m = useLoader<any>(() => apiGet(`/api/admin/manage/users/${id}/moderation`).catch(() => null), [id]);
  const [tab, setTab] = useState<Tab>("overview");
  const reload = async () => { await Promise.all([u.load(), m.load()]); };
  if (u.loading && !u.data) return <Page><Loading /></Page>;
  if (!u.data) return <Page><ErrorBox text={u.error || L("User not found", "ব্যবহারকারী পাওয়া যায়নি")} onRetry={u.load} /></Page>;
  const d = u.data;
  const mod = m.data || {};
  const warnings = (mod.warnings || []).filter((w: any) => !w.withdrawn);
  const limits = LIMITS.filter((k) => mod.restrictions?.[k]);
  const isAdmin = !!d.isSuperAdmin;
  return (
    <Page onRefresh={reload} testID="user-detail">
      <Card>
        <View style={[st.row, { gap: 14 }]}>
          <Avatar name={d.name} uri={d.avatar} size={64} dot={d.online ? "online" : d.online === false ? "offline" : null} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: theme.text, fontWeight: "800", fontSize: 18 }} numberOfLines={1}>{d.name || d.username}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={1}>@{d.username}{d.email ? ` · ${d.email}` : ""}</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              <Pill label={d.banned ? L("Banned", "ব্যানড") : L("Active", "সক্রিয়")} color={d.banned ? "#B91C1C" : "#047857"} />
              {limits.length ? <Pill label={L("Limited", "সীমিত")} color="#B45309" icon="lock" /> : null}
              {warnings.length ? <Pill label={L(`${warnings.length} warning${warnings.length > 1 ? "s" : ""}`, `${warnings.length}টি সতর্কবার্তা`)} color="#B45309" icon="alert-triangle" /> : null}
              {isAdmin ? <Pill label={L("Admin", "অ্যাডমিন")} color="#7C3AED" /> : null}
              {d.verified ? <Pill label={L("Verified", "যাচাইকৃত")} color="#1D4ED8" icon="check" /> : null}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", marginTop: 16, gap: 4 }}>
          <QuickAction testID="qa-message" icon="send" label={L("Message", "মেসেজ")} color={theme.primary} onPress={() => setTab("message")} />
          {!isAdmin ? <QuickAction testID="qa-warn" icon="alert-triangle" label={L("Warn", "সতর্ক")} color="#B45309" onPress={() => setTab("safety")} /> : null}
          {!isAdmin ? <QuickAction testID="qa-limit" icon="lock" label={L("Limit", "সীমা")} color="#6D28D9" onPress={() => setTab("safety")} /> : null}
          <QuickAction testID="qa-edit" icon="edit-2" label={L("Edit", "সম্পাদনা")} color="#0E7490" onPress={() => setTab("account")} />
          {d.store ? <QuickAction testID="user-open-shop" icon="shopping-bag" label={L("Shop", "দোকান")} color="#047857" onPress={() => nav.push({ name: "store", id: d.store.id })} /> : null}
        </View>
      </Card>
      {d.banned ? <Banner color="#B91C1C" icon="slash" title={L("This account is banned", "এই অ্যাকাউন্ট ব্যানড")} sub={[mod.bannedReason, mod.bannedUntil ? L(`until ${fmtDate(mod.bannedUntil, false)}`, `${fmtDate(mod.bannedUntil, false)} পর্যন্ত`) : L("until you unban it", "আপনি তুলে না দেওয়া পর্যন্ত")].filter(Boolean).join(" · ")} /> : null}
      {!d.banned && limits.length ? <Banner color="#B45309" icon="lock" title={L("Can't: ", "পারবে না: ") + limits.map((k) => limitLabel(k, L)).join(", ")} sub={[mod.restrictions?.reason, mod.restrictions?.until ? L(`until ${fmtDate(mod.restrictions.until, false)}`, `${fmtDate(mod.restrictions.until, false)} পর্যন্ত`) : L("until lifted", "তুলে না দেওয়া পর্যন্ত")].filter(Boolean).join(" · ")} /> : null}
      <Segmented<Tab>
        testID="user-tabs"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: L("Overview", "সারসংক্ষেপ") },
          { value: "message", label: L("Message", "মেসেজ") },
          ...(!isAdmin ? [{ value: "safety" as Tab, label: L("Safety", "নিরাপত্তা"), count: warnings.length || undefined }] : []),
          { value: "account", label: L("Account", "অ্যাকাউন্ট") },
          { value: "activity", label: L("Log", "লগ") },
        ]}
      />
      {tab === "overview" ? <Overview d={d} mod={mod} /> : null}
      {tab === "message" ? <MessagePanel id={id} name={d.name || d.username} onSent={reload} /> : null}
      {tab === "safety" && !isAdmin ? <SafetyPanel id={id} d={d} mod={mod} warnings={warnings} onChanged={reload} /> : null}
      {tab === "account" ? <AccountPanel id={id} d={d} onChanged={reload} /> : null}
      {tab === "activity" ? <ActivityPanel mod={mod} /> : null}
    </Page>
  );
}

function Overview({ d, mod }: { d: any; mod: any }) {
  const L = useL();
  const c = mod.counts || {};
  return (
    <>
      <View style={[st.grid, { gap: 10 }]}>
        <Stat icon="shopping-bag" color="#1D4ED8" label={L("Orders", "অর্ডার")} value={d.recentOrders?.length || 0} />
        <Stat icon="credit-card" color="#047857" label={L("Spent", "খরচ")} value={taka(d.spent)} />
        <Stat icon="tag" color="#B45309" label={L("Products", "পণ্য")} value={d.listings || 0} />
        <Stat icon="flag" color="#B91C1C" label={L("Reports", "রিপোর্ট")} value={c.reportsAgainst || 0} />
      </View>
      <Card>
        <KV icon="mail" k={L("Email", "ইমেইল")} v={d.email} />
        <KV icon="phone" k={L("Phone", "ফোন")} v={d.phone} />
        <KV icon="briefcase" k={L("Role", "ভূমিকা")} v={d.role} />
        <KV icon="calendar" k={L("Joined", "যোগ দিয়েছেন")} v={fmtDate(d.createdAt, false)} />
        <KV icon="edit" k={L("Posts · comments", "পোস্ট · মন্তব্য")} v={`${c.posts || 0} · ${c.comments || 0}`} />
        <KV icon="message-circle" k={L("Messages sent", "পাঠানো মেসেজ")} v={String(c.messagesSent || 0)} />
      </Card>
      <SectionTitle title={`${L("Recent orders", "সাম্প্রতিক অর্ডার")} (${d.recentOrders?.length || 0})`} />
      {!d.recentOrders?.length ? <Empty icon="shopping-bag" text={L("No orders", "কোনো অর্ডার নেই")} /> : null}
      {(d.recentOrders || []).map((o: any) => <OrderRow key={o.id} o={{ ...o, buyerName: d.name }} />)}
    </>
  );
}

function MessagePanel({ id, name, onSent }: { id: string; name: string; onSent: () => void }) {
  const { theme } = useTheme();
  const L = useL();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      await apiPost(`/api/admin/manage/users/${id}/message`, { title: title.trim(), body: body.trim() });
      setTitle(""); setBody("");
      setMsg({ ok: true, text: L(`Sent. ${name} sees it in Chats under Farmers Official, and gets a notification.`, `পাঠানো হয়েছে। ${name} চ্যাটে Farmers Official-এ দেখবেন ও নোটিফিকেশন পাবেন।`) });
      onSent();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || L("Couldn't send", "পাঠানো যায়নি") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card testID="user-message">
      <View style={[st.row, { gap: 10, marginBottom: 10 }]}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}>
          <Feather name="shield" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: "800" }}>{L("From Farmers Official", "Farmers Official থেকে")}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>{L("Shows in their Chats list and rings their bell", "ওনার চ্যাট তালিকায় দেখাবে ও নোটিফিকেশন যাবে")}</Text>
        </View>
      </View>
      <Field testID="user-message-title" label={L("Title (optional)", "শিরোনাম (ঐচ্ছিক)")} value={title} onChange={setTitle} maxLength={120} />
      <Field testID="user-message-body" label={L("Message", "মেসেজ")} value={body} onChange={setBody} multiline maxLength={2000} placeholder={L("Write to this person…", "এই ব্যক্তিকে লিখুন…")} />
      {msg ? <Text style={{ color: msg.ok ? "#047857" : "#B91C1C", fontWeight: "600", marginBottom: 8 }}>{msg.text}</Text> : null}
      <Btn testID="user-message-send" icon="send" label={L("Send message", "মেসেজ পাঠান")} busy={busy} disabled={!body.trim()} onPress={send} />
    </Card>
  );
}

const DAYS = ["1", "3", "7", "30", "0"] as const;
const daysLabel = (d: string, L: L) => (d === "0" ? L("Until lifted", "তুলে না দেওয়া পর্যন্ত") : d === "1" ? L("1 day", "১ দিন") : L(`${d} days`, `${d} দিন`));

function SafetyPanel({ id, d, mod, warnings, onChanged }: { id: string; d: any; mod: any; warnings: any[]; onChanged: () => Promise<void> }) {
  const { theme } = useTheme();
  const L = useL();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [lim, setLim] = useState<Record<string, boolean>>({});
  const [limDays, setLimDays] = useState<string>("3");
  const [limReason, setLimReason] = useState("");
  const [banDays, setBanDays] = useState<string>("7");
  const [banReason, setBanReason] = useState("");
  const [skipWarn, setSkipWarn] = useState(false);
  useEffect(() => {
    const r = mod.restrictions || {};
    setLim(Object.fromEntries(LIMITS.map((k) => [k, !!r[k]])));
    setLimReason(r.reason || "");
  }, [mod.restrictions]);
  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await onChanged(); } catch (e: any) { setMsg({ ok: false, text: e?.message || L("Something went wrong", "কিছু একটা সমস্যা হয়েছে") }); } finally { setBusy(null); }
  };
  const presets = [L("Spam", "স্প্যাম"), L("Rude language", "অসভ্য ভাষা"), L("Fake or wrong product", "ভুয়া বা ভুল পণ্য"), L("Scam attempt", "প্রতারণার চেষ্টা"), L("Didn't deliver orders", "অর্ডার ডেলিভারি দেননি")];
  const anyLimit = LIMITS.some((k) => mod.restrictions?.[k]);
  return (
    <>
      {msg ? <Text style={{ color: msg.ok ? "#047857" : "#B91C1C", fontWeight: "600" }}>{msg.text}</Text> : null}
      <SectionTitle title={L("Step 1 · Warn", "ধাপ ১ · সতর্ক করুন")} />
      <Card testID="user-warn">
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginBottom: 8 }}>{L("The warning arrives in their Chats from Farmers Official. A ban needs a warning first.", "সতর্কবার্তা Farmers Official থেকে চ্যাটে যাবে। ব্যানের আগে সতর্কবার্তা দিতে হয়।")}</Text>
        <ChipRow>{presets.map((p) => <Chip key={p} label={p} on={warnReason === p} onPress={() => setWarnReason(p)} />)}</ChipRow>
        <Field testID="warn-reason" label={L("What is the warning for?", "কিসের জন্য সতর্কবার্তা?")} value={warnReason} onChange={setWarnReason} multiline maxLength={500} />
        <Btn testID="warn-send" kind="soft" icon="alert-triangle" label={L(`Send warning ${warnings.length + 1}`, `সতর্কবার্তা ${warnings.length + 1} পাঠান`)} busy={busy === "warn"} disabled={!warnReason.trim()}
          onPress={() => run("warn", async () => { await apiPost(`/api/admin/manage/users/${id}/warn`, { reason: warnReason.trim() }); setWarnReason(""); }, L("Warning sent", "সতর্কবার্তা পাঠানো হয়েছে"))} />
        {(mod.warnings || []).length ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            {(mod.warnings || []).map((w: any, i: number) => (
              <View key={w.id} style={[st.row, { gap: 10, opacity: w.withdrawn ? 0.5 : 1 }]}>
                <Feather name="alert-triangle" size={15} color={w.withdrawn ? theme.textTertiary : "#B45309"} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: "600", textDecorationLine: w.withdrawn ? "line-through" : "none" }}>{w.reason}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{fmtDate(w.at)}{w.by ? ` · ${w.by}` : ""}{w.withdrawn ? ` · ${L("withdrawn", "প্রত্যাহার করা")}` : ""}</Text>
                </View>
                {!w.withdrawn ? <Btn testID={`warn-withdraw-${i}`} small kind="ghost" label={L("Withdraw", "প্রত্যাহার")} busy={busy === w.id} onPress={() => run(w.id, () => apiDelete(`/api/admin/manage/users/${id}/warnings/${w.id}`), L("Warning withdrawn", "সতর্কবার্তা প্রত্যাহার করা হয়েছে"))} /> : null}
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <SectionTitle title={L("Step 2 · Limit what they can do", "ধাপ ২ · কাজ সীমিত করুন")} />
      <Card testID="user-limits">
        {LIMITS.map((k) => (
          <ToggleRow key={k} testID={`limit-${k}`} icon={limitIcon[k]} label={L("Stop: ", "বন্ধ: ") + limitLabel(k, L)} value={!!lim[k]} onChange={(v) => setLim({ ...lim, [k]: v })} />
        ))}
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 8, marginBottom: 6 }}>{L("For how long", "কত দিন")}</Text>
        <ChipRow>{DAYS.map((x) => <Chip key={x} label={daysLabel(x, L)} on={limDays === x} onPress={() => setLimDays(x)} />)}</ChipRow>
        <Field testID="limit-reason" label={L("Reason (they see this)", "কারণ (উনি দেখবেন)")} value={limReason} onChange={setLimReason} maxLength={300} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {anyLimit ? <Btn testID="limit-lift" kind="ghost" icon="unlock" label={L("Lift all", "সব তুলে দিন")} busy={busy === "lift"} onPress={() => run("lift", () => apiPut(`/api/admin/manage/users/${id}/restrictions`, {}), L("All limits lifted", "সব সীমা তুলে দেওয়া হয়েছে"))} /> : null}
          <Btn testID="limit-save" style={{ flex: 1 }} icon="lock" label={L("Save limits", "সীমা সংরক্ষণ")} busy={busy === "limit"} disabled={!LIMITS.some((k) => lim[k]) || !limReason.trim()}
            onPress={() => run("limit", () => apiPut(`/api/admin/manage/users/${id}/restrictions`, { ...lim, days: Number(limDays), reason: limReason.trim() }), L("Limits saved. They got a notification.", "সীমা সংরক্ষিত। উনি নোটিফিকেশন পেয়েছেন।"))} />
        </View>
        {!LIMITS.some((k) => lim[k]) || !limReason.trim() ? <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 6 }}>{L("Pick at least one thing to stop and write a reason.", "অন্তত একটি বিষয় বেছে নিন ও কারণ লিখুন।")}</Text> : null}
      </Card>

      <SectionTitle title={L("Step 3 · Ban", "ধাপ ৩ · ব্যান")} />
      <Card testID="user-ban">
        {d.banned ? (
          <Btn testID="unban" kind="soft" icon="unlock" label={L("Unban this account", "ব্যান তুলে দিন")} busy={busy === "unban"} onPress={() => run("unban", () => apiPost(`/api/admin/manage/users/${id}/unban`, {}), L("Unbanned", "ব্যান তুলে নেওয়া হয়েছে"))} />
        ) : (
          <>
            {!warnings.length ? (
              <View style={{ marginBottom: 10 }}>
                <Banner color="#B45309" icon="alert-triangle" title={L("No warning yet", "এখনও কোনো সতর্কবার্তা নেই")} sub={L("Send a warning first. For serious cases you can ban now and say why.", "আগে সতর্কবার্তা দিন। গুরুতর ক্ষেত্রে কারণ লিখে এখনই ব্যান করতে পারেন।")} />
                <ToggleRow testID="ban-skip-warning" icon="zap" label={L("Serious case: ban without a warning", "গুরুতর: সতর্কবার্তা ছাড়া ব্যান")} value={skipWarn} onChange={setSkipWarn} />
              </View>
            ) : null}
            <ChipRow>{(DAYS.filter((x) => x !== "1") as string[]).map((x) => <Chip key={x} label={x === "0" ? L("Permanent", "স্থায়ী") : daysLabel(x, L)} on={banDays === x} onPress={() => setBanDays(x)} />)}</ChipRow>
            <Field testID="ban-reason" label={L("Reason", "কারণ")} value={banReason} onChange={setBanReason} maxLength={300} />
            <Btn testID="ban" kind="danger" icon="slash" label={banDays === "0" ? L("Ban permanently", "স্থায়ীভাবে ব্যান") : L(`Ban for ${banDays} days`, `${banDays} দিনের জন্য ব্যান`)} busy={busy === "ban"}
              disabled={!banReason.trim() || (!warnings.length && !skipWarn)}
              onPress={async () => {
                if (!(await confirmAsk(L("Ban this account?", "এই অ্যাকাউন্ট ব্যান করবেন?"), L("They are signed out and can't use Farmers until the ban ends.", "তাঁকে সাইন আউট করা হবে, ব্যান শেষ না হওয়া পর্যন্ত Farmers ব্যবহার করতে পারবেন না।"), L("Ban", "ব্যান"), L("Go back", "ফিরে যান")))) return;
                run("ban", () => apiPost(`/api/admin/manage/users/${id}/ban`, { reason: banReason.trim(), days: Number(banDays), skipWarning: skipWarn || undefined }), L("Banned", "ব্যান করা হয়েছে"));
              }} />
          </>
        )}
      </Card>
    </>
  );
}

const ROLES = ["user", "farmer", "buyer", "seller", "expert", "company"];

function AccountPanel({ id, d, onChanged }: { id: string; d: any; onChanged: () => Promise<void> }) {
  const { theme } = useTheme();
  const L = useL();
  const [f, setF] = useState({ name: d.name || "", username: d.username || "", phone: d.phone || "", role: d.role || "user" });
  const [verified, setVerified] = useState(!!d.verified);
  const [admin, setAdmin] = useState(!!d.isSuperAdmin);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await onChanged(); } catch (e: any) { setMsg({ ok: false, text: e?.message || L("Something went wrong", "কিছু একটা সমস্যা হয়েছে") }); } finally { setBusy(null); }
  };
  const userErr = !/^[a-z0-9_.]{3,30}$/.test(f.username.trim().toLowerCase().replace(/^@/, "")) ? L("3 to 30 letters, numbers, _ or .", "৩–৩০টি ইংরেজি অক্ষর, সংখ্যা, _ বা .") : null;
  const roles = ROLES.includes(f.role) ? ROLES : [...ROLES, f.role];
  return (
    <>
      {msg ? <Text style={{ color: msg.ok ? "#047857" : "#B91C1C", fontWeight: "600" }}>{msg.text}</Text> : null}
      <SectionTitle title={L("Details", "তথ্য")} />
      <Card testID="user-edit">
        <Field testID="edit-name" label={L("Name", "নাম")} value={f.name} onChange={(v) => setF({ ...f, name: v })} maxLength={120} />
        <Field testID="edit-username" label={L("Username", "ইউজারনেম")} prefix="@" value={f.username} onChange={(v) => setF({ ...f, username: v })} maxLength={30} hint={userErr || undefined} />
        <Field testID="edit-phone" label={L("Phone", "ফোন")} keyboardType="phone-pad" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} maxLength={30} />
        <KV icon="mail" k={L("Email (sign-in, can't be changed here)", "ইমেইল (সাইন-ইন, এখানে বদলানো যায় না)")} v={d.email} />
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 10, marginBottom: 6 }}>{L("Role", "ভূমিকা")}</Text>
        <ChipRow>{roles.map((r) => <Chip key={r} label={r} on={f.role === r} onPress={() => setF({ ...f, role: r })} />)}</ChipRow>
        <ToggleRow testID="edit-verified" icon="check-circle" label={L("Verified badge", "যাচাইকৃত ব্যাজ")} value={verified} onChange={setVerified} />
        <Btn testID="edit-save" icon="save" label={L("Save details", "তথ্য সংরক্ষণ")} busy={busy === "save"} disabled={!!userErr || !f.name.trim()}
          onPress={() => run("save", () => apiPut(`/api/admin/manage/users/${id}`, { name: f.name.trim(), username: f.username.trim(), phone: f.phone.trim(), role: f.role, verified }), L("Details saved", "তথ্য সংরক্ষিত"))} />
      </Card>

      <SectionTitle title={L("Password", "পাসওয়ার্ড")} />
      <Card testID="user-password">
        <Btn testID="pw-email" kind="soft" icon="mail" label={L("Email them a reset link", "রিসেট লিংক ইমেইল করুন")} busy={busy === "pwmail"} disabled={!d.email}
          onPress={() => run("pwmail", () => sendPasswordResetEmail(getFirebaseAuth(), d.email), L(`Reset link sent to ${d.email}. It may land in spam.`, `${d.email}-এ রিসেট লিংক পাঠানো হয়েছে। স্প্যামে যেতে পারে।`))} />
        <Text style={{ color: theme.textSecondary, fontSize: 12, marginVertical: 10 }}>{L("Or set a new password yourself and tell them privately (at least 8 characters). Google sign-in isn't affected.", "অথবা নিজে নতুন পাসওয়ার্ড দিন ও গোপনে জানান (কমপক্ষে ৮ অক্ষর)। Google সাইন-ইনে প্রভাব পড়বে না।")}</Text>
        <Field testID="pw-new" label={L("New password", "নতুন পাসওয়ার্ড")} value={pw} onChange={setPw} maxLength={100} />
        <Btn testID="pw-set" kind="ghost" icon="key" label={L("Set password", "পাসওয়ার্ড সেট করুন")} busy={busy === "pw"} disabled={pw.length < 8}
          onPress={() => run("pw", async () => { await apiPut(`/api/admin/manage/users/${id}/password`, { password: pw }); setPw(""); }, L("Password set", "পাসওয়ার্ড সেট হয়েছে"))} />
      </Card>

      <SectionTitle title={L("Admin rights", "অ্যাডমিন অধিকার")} />
      <Card>
        <ToggleRow testID="edit-admin" icon="shield" label={L("Can open this dashboard", "এই ড্যাশবোর্ড খুলতে পারবেন")} sub={L("Full control over everything", "সবকিছুর পূর্ণ নিয়ন্ত্রণ")} value={admin} disabled={busy === "admin"}
          onChange={async (v) => {
            if (!(await confirmAsk(v ? L("Make this person an admin?", "এই ব্যক্তিকে অ্যাডমিন করবেন?") : L("Remove admin rights?", "অ্যাডমিন অধিকার সরাবেন?"), v ? L("They get full control of the dashboard.", "তিনি ড্যাশবোর্ডের পূর্ণ নিয়ন্ত্রণ পাবেন।") : L("They lose access to the dashboard.", "তিনি ড্যাশবোর্ডে ঢুকতে পারবেন না।"), L("Yes", "হ্যাঁ"), L("Go back", "ফিরে যান")))) return;
            setAdmin(v);
            run("admin", () => apiPut(`/api/admin/manage/users/${id}`, { isSuperAdmin: v }), v ? L("Now an admin", "এখন অ্যাডমিন") : L("Admin rights removed", "অ্যাডমিন অধিকার সরানো হয়েছে")).catch(() => setAdmin(!v));
          }} />
      </Card>
    </>
  );
}

function ActivityPanel({ mod }: { mod: any }) {
  const { theme } = useTheme();
  const L = useL();
  const items: any[] = mod.activity || [];
  if (!items.length) return <Empty icon="clock" text={L("No admin actions on this account yet", "এই অ্যাকাউন্টে এখনও কোনো অ্যাডমিন কাজ নেই")} />;
  return (
    <Card testID="user-activity">
      <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginBottom: 8 }}>{L("Every admin action on this account, newest first", "এই অ্যাকাউন্টে সব অ্যাডমিন কাজ, নতুনগুলো আগে")}</Text>
      {items.map((a, i) => (
        <View key={i} style={[st.row, { gap: 10, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: theme.cardBorder }]}>
          <Feather name={actionIcon(a.action)} size={15} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "600" }}>{actionLabel(a.action, L)}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{fmtDate(a.at)}{a.by ? ` · ${a.by}` : ""}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}
