import React, { useEffect, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPost, apiPut, apiDelete, api } from "@/lib/api";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  Page, Card, SectionTitle, Pill, Chip, ChipRow, SearchBox, Btn, Field, Empty, Loading, ErrorBox, Thumb, Avatar,
  ToggleRow, RadioGroup, ListRow, Segmented, Text, useAdminNav, useL, useLoader, useDebounced, taka, fmtDate,
  statusLabel, STATUS_COLOR, confirmAsk, pickAndUpload, st,
} from "./ui";

/* =============================================================================================
 * Moderation panel (inside a user's page): limits, bans, removing content, deleting the account.
 * Everything here is checked again on the server; these screens only send the admin's choice.
 * ============================================================================================= */

type Mod = {
  banned: boolean; bannedReason: string; bannedUntil: string | null; restricted: boolean; isSuperAdmin: boolean;
  restrictions: { message?: boolean; post?: boolean; comment?: boolean; sell?: boolean; buy?: boolean; until?: string | null; reason?: string };
  counts: { posts: number; comments: number; listings: number; community: number; messagesSent: number; reportsAgainst: number };
};

const LIMITS: { key: "message" | "post" | "comment" | "sell" | "buy"; en: string; bn: string; subEn: string; subBn: string; icon: any }[] = [
  { key: "message", en: "Block messages", bn: "মেসেজ বন্ধ", subEn: "Can't send chats, photos or voice to other people", subBn: "অন্যদের চ্যাট, ছবি বা ভয়েস পাঠাতে পারবে না", icon: "message-circle" },
  { key: "post", en: "Block community posts", bn: "কমিউনিটি পোস্ট বন্ধ", subEn: "Can't post, edit posts, ask questions or start polls", subBn: "পোস্ট, প্রশ্ন বা পোল করতে পারবে না", icon: "edit-3" },
  { key: "comment", en: "Block comments", bn: "মন্তব্য বন্ধ", subEn: "Can't comment, answer, bid or review", subBn: "মন্তব্য, উত্তর, বিড বা রিভিউ করতে পারবে না", icon: "message-square" },
  { key: "sell", en: "Block selling", bn: "বিক্রি বন্ধ", subEn: "Can't add or change products or a shop", subBn: "পণ্য বা দোকান যোগ/পরিবর্তন করতে পারবে না", icon: "tag" },
  { key: "buy", en: "Block ordering", bn: "অর্ডার বন্ধ", subEn: "Can't place orders or pay", subBn: "অর্ডার বা পেমেন্ট করতে পারবে না", icon: "shopping-cart" },
];

export function ModerationPanel({ user, onChanged }: { user: any; onChanged: () => void }) {
  const { theme } = useTheme();
  const L = useL();
  const nav = useAdminNav();
  const m = useLoader<Mod>(() => apiGet(`/api/admin/manage/users/${user.id}/moderation`), [user.id]);
  const [lim, setLim] = useState<Record<string, boolean>>({});
  const [limDays, setLimDays] = useState("7");
  const [limReason, setLimReason] = useState("");
  const [banDays, setBanDays] = useState("0");
  const [banReason, setBanReason] = useState("");
  const [rm, setRm] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!m.data) return;
    const r = m.data.restrictions || {};
    setLim({ message: !!r.message, post: !!r.post, comment: !!r.comment, sell: !!r.sell, buy: !!r.buy });
    setLimReason(r.reason || "");
  }, [m.data]);

  if (m.loading && !m.data) return <Loading rows={2} />;
  if (m.error) return <ErrorBox text={m.error} onRetry={m.load} />;
  const d = m.data!;
  if (d.isSuperAdmin)
    return (
      <Card>
        <ListRow icon="shield" color="#2563EB" label={L("This is an admin account", "এটি একটি অ্যাডমিন অ্যাকাউন্ট")} sub={L("Remove admin rights first to limit, ban or delete it.", "সীমিত, নিষিদ্ধ বা মুছতে আগে অ্যাডমিন অধিকার সরান।")} last />
      </Card>
    );

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      m.load();
      onChanged();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || L("Something went wrong", "কিছু ভুল হয়েছে") });
    }
    setBusy("");
  };
  const anyLim = LIMITS.some((x) => lim[x.key]);
  const days = [
    { value: "1", label: L("1 day", "১ দিন") },
    { value: "7", label: L("7 days", "৭ দিন") },
    { value: "30", label: L("30 days", "৩০ দিন") },
    { value: "0", label: L("Until I lift it", "আমি না তোলা পর্যন্ত") },
  ];
  const status = d.banned ? "banned" : d.restricted ? "restricted" : "active";
  const statusColor = status === "banned" ? "#B91C1C" : status === "restricted" ? "#B45309" : "#15803D";
  const confirmName = String(user.username || user.email || "");

  return (
    <View testID="moderation-panel">
      <Card style={{ borderLeftWidth: 4, borderLeftColor: statusColor }}>
        <View style={st.row}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: statusColor + "18", alignItems: "center", justifyContent: "center" }}>
            <Feather name={status === "active" ? "check-circle" : status === "banned" ? "slash" : "shield"} size={20} color={statusColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text testID="moderation-status" style={{ color: theme.text, fontWeight: "800", fontSize: 15.5 }}>
              {status === "banned" ? L("Banned", "নিষিদ্ধ") : status === "restricted" ? L("Limited", "সীমিত") : L("In good standing", "সক্রিয়, কোনো সীমা নেই")}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 2 }}>
              {status === "banned"
                ? `${d.bannedUntil ? L("Until ", "পর্যন্ত: ") + fmtDate(d.bannedUntil) : L("Until unbanned", "আনব্যান না করা পর্যন্ত")}${d.bannedReason ? " · " + d.bannedReason : ""}`
                : status === "restricted"
                  ? `${LIMITS.filter((x) => (d.restrictions as any)[x.key]).map((x) => L(x.en, x.bn)).join(", ")}${d.restrictions.until ? " · " + L("until ", "পর্যন্ত ") + fmtDate(d.restrictions.until) : ""}`
                  : L("Can use every part of the app", "অ্যাপের সব কিছু ব্যবহার করতে পারেন")}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <Pill icon="file-text" label={`${d.counts.posts} ${L("posts", "পোস্ট")}`} color="#2563EB" />
          <Pill icon="message-square" label={`${d.counts.comments} ${L("comments", "মন্তব্য")}`} color="#0E7490" />
          <Pill icon="tag" label={`${d.counts.listings} ${L("listings", "লিস্টিং")}`} color="#7C3AED" />
          <Pill icon="send" label={`${d.counts.messagesSent} ${L("messages sent", "মেসেজ পাঠানো")}`} color="#475569" />
          {d.counts.reportsAgainst ? <Pill icon="flag" label={`${d.counts.reportsAgainst} ${L("reports", "রিপোর্ট")}`} color="#DC2626" /> : null}
        </View>
      </Card>
      {msg ? (
        <View testID="moderation-msg" style={{ flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: 14, marginBottom: 12, backgroundColor: msg.ok ? "#ECFDF5" : "#FEF2F2" }}>
          <Feather name={msg.ok ? "check-circle" : "alert-circle"} size={17} color={msg.ok ? "#047857" : "#B91C1C"} />
          <Text style={{ flex: 1, color: msg.ok ? "#065F46" : "#991B1B", fontSize: 13.5 }}>{msg.text}</Text>
        </View>
      ) : null}

      <SectionTitle title={L("Limits", "সীমাবদ্ধতা")} />
      <Card>
        {LIMITS.map((x, i) => (
          <ToggleRow key={x.key} testID={`limit-${x.key}`} icon={x.icon} label={L(x.en, x.bn)} sub={L(x.subEn, x.subBn)} value={!!lim[x.key]} onChange={(v) => setLim((p) => ({ ...p, [x.key]: v }))} />
        ))}
        <Text style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 13, marginTop: 14, marginBottom: 8 }}>{L("For how long", "কতদিনের জন্য")}</Text>
        <RadioGroup row testID="limit-days" options={days} value={limDays} onChange={setLimDays} />
        <View style={{ height: 12 }} />
        <Field label={L("Reason (the person sees it)", "কারণ (ব্যবহারকারী দেখবেন)")} value={limReason} onChange={setLimReason} testID="limit-reason" maxLength={300} placeholder={L("e.g. Spam in the community", "যেমন কমিউনিটিতে স্প্যাম")} />
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Btn testID="limit-save" icon="shield" label={anyLim ? L("Save limits", "সীমা সেভ করুন") : L("Save (no limits)", "সেভ (কোনো সীমা নেই)")} busy={busy === "lim"} style={{ flexGrow: 1 }}
            onPress={() => run("lim", () => apiPut(`/api/admin/manage/users/${user.id}/restrictions`, { ...lim, days: Number(limDays), reason: limReason }), anyLim ? L("Limits saved. The person was told.", "সীমা সেভ হয়েছে। ব্যবহারকারীকে জানানো হয়েছে।") : L("Limits removed", "সীমা সরানো হয়েছে"))} />
          {d.restricted ? (
            <Btn testID="limit-clear" kind="ghost" icon="unlock" label={L("Lift all", "সব তুলুন")} busy={busy === "clear"}
              onPress={() => run("clear", () => apiPut(`/api/admin/manage/users/${user.id}/restrictions`, {}), L("Limits removed", "সীমা সরানো হয়েছে"))} />
          ) : null}
        </View>
      </Card>

      <SectionTitle title={L("Ban", "নিষিদ্ধ")} />
      <Card>
        {d.banned ? (
          <>
            <Text style={{ color: theme.textSecondary, fontSize: 13.5, marginBottom: 12, lineHeight: 19 }}>{L("This person can't sign in or use the app.", "এই ব্যক্তি সাইন ইন বা অ্যাপ ব্যবহার করতে পারবেন না।")}</Text>
            <Btn testID="unban" icon="unlock" label={L("Unban", "আনব্যান")} busy={busy === "unban"} onPress={() => run("unban", () => apiPost(`/api/admin/manage/users/${user.id}/unban`), L("Unbanned", "আনব্যান হয়েছে"))} />
          </>
        ) : (
          <>
            <Text style={{ color: theme.textSecondary, fontSize: 13.5, marginBottom: 10, lineHeight: 19 }}>{L("Signs them out everywhere and stops them signing in.", "সব জায়গা থেকে সাইন আউট হবে এবং সাইন ইন করতে পারবে না।")}</Text>
            <RadioGroup row testID="ban-days" options={days} value={banDays} onChange={setBanDays} />
            <View style={{ height: 12 }} />
            <Field label={L("Reason", "কারণ")} value={banReason} onChange={setBanReason} testID="ban-reason" maxLength={300} />
            <Btn testID="ban" kind="danger" icon="slash" label={L("Ban user", "নিষিদ্ধ করুন")} busy={busy === "ban"}
              onPress={async () => {
                if (!(await confirmAsk(L("Ban this user?", "নিষিদ্ধ করবেন?"), user.name || user.username, L("Ban", "নিষিদ্ধ"), L("Cancel", "বাতিল")))) return;
                run("ban", () => apiPost(`/api/admin/manage/users/${user.id}/ban`, { days: Number(banDays), reason: banReason }), L("User banned", "ব্যবহারকারী নিষিদ্ধ"));
              }} />
          </>
        )}
      </Card>

      <SectionTitle title={L("Remove content", "কন্টেন্ট সরান")} />
      <Card>
        <ToggleRow testID="rm-posts" icon="file-text" label={`${L("All posts", "সব পোস্ট")} (${d.counts.posts})`} value={!!rm.posts} onChange={(v) => setRm((p) => ({ ...p, posts: v }))} />
        <ToggleRow testID="rm-comments" icon="message-square" label={`${L("All comments", "সব মন্তব্য")} (${d.counts.comments})`} value={!!rm.comments} onChange={(v) => setRm((p) => ({ ...p, comments: v }))} />
        <ToggleRow testID="rm-listings" icon="tag" label={`${L("All product listings", "সব পণ্য লিস্টিং")} (${d.counts.listings})`} value={!!rm.listings} onChange={(v) => setRm((p) => ({ ...p, listings: v }))} />
        <ToggleRow testID="rm-community" icon="help-circle" label={`${L("Questions, polls & diary", "প্রশ্ন, পোল ও ডায়েরি")} (${d.counts.community})`} value={!!rm.community} onChange={(v) => setRm((p) => ({ ...p, community: v }))} />
        <View style={{ height: 12 }} />
        <Btn testID="rm-run" kind="dangerSoft" icon="trash-2" label={L("Remove selected", "নির্বাচিত সরান")} disabled={!Object.values(rm).some(Boolean)} busy={busy === "rm"}
          onPress={async () => {
            if (!(await confirmAsk(L("Remove this content?", "এই কন্টেন্ট সরাবেন?"), L("This can't be undone.", "এটি ফেরানো যাবে না।"), L("Remove", "সরান"), L("Cancel", "বাতিল")))) return;
            run("rm", async () => { await apiPost(`/api/admin/manage/users/${user.id}/remove-content`, rm); setRm({}); }, L("Content removed", "কন্টেন্ট সরানো হয়েছে"));
          }} />
      </Card>

      <SectionTitle title={L("Message", "মেসেজ")} />
      <Card>
        <ListRow testID="mod-official" icon="send" color="#2563EB" label={L("Send an official message", "অফিসিয়াল মেসেজ পাঠান")} sub={L("Shows in their Chats from Farmers Official", "তাদের চ্যাটে Farmers Official থেকে দেখাবে")} onPress={() => nav.push({ name: "official", target: user.id, targetName: user.name || user.username } as any)} last />
      </Card>

      <SectionTitle title={L("Danger zone", "বিপজ্জনক")} />
      <Card style={{ borderWidth: 1, borderColor: "#FCA5A5" }}>
        <Text style={{ color: "#B91C1C", fontWeight: "800", fontSize: 15 }}>{L("Delete account", "অ্যাকাউন্ট মুছুন")}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 12 }}>
          {L("Removes their profile, posts, comments, listings, shop, chats and follows, and signs them out. Orders stay for the records as \"Deleted user\". This can't be undone.",
            "প্রোফাইল, পোস্ট, মন্তব্য, লিস্টিং, দোকান, চ্যাট ও ফলো মুছে যাবে এবং সাইন আউট হবে। অর্ডারগুলো রেকর্ডের জন্য \"Deleted user\" নামে থাকবে। এটি ফেরানো যাবে না।")}
        </Text>
        <Field label={`${L("Type", "লিখুন")} "${confirmName}" ${L("to confirm", "নিশ্চিত করতে")}`} value={confirm} onChange={setConfirm} testID="delete-confirm" />
        <Btn testID="delete-account" kind="danger" icon="trash-2" label={L("Delete account forever", "চিরতরে মুছুন")} disabled={confirm.trim().toLowerCase() !== confirmName.toLowerCase() || !confirmName} busy={busy === "del"}
          onPress={async () => {
            if (!(await confirmAsk(L("Delete this account?", "অ্যাকাউন্ট মুছবেন?"), user.name || user.username, L("Delete", "মুছুন"), L("Cancel", "বাতিল")))) return;
            setBusy("del");
            try {
              await api("DELETE", `/api/admin/manage/users/${user.id}?confirm=${encodeURIComponent(confirm.trim())}`, { confirm: confirm.trim() });
              onChanged();
              nav.pop();
            } catch (e: any) {
              setMsg({ ok: false, text: e?.message || "Error" });
            }
            setBusy("");
          }} />
      </Card>
    </View>
  );
}

/* =============================================================================================
 * Search everything (header search icon)
 * ============================================================================================= */
export function SearchScreen() {
  const { theme } = useTheme();
  const L = useL();
  const nav = useAdminNav();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 300);
  const r = useLoader<any>(() => (dq.length < 2 ? Promise.resolve(null) : apiGet(`/api/admin/manage/search?q=${encodeURIComponent(dq)}`)), [dq]);
  const d = r.data;
  const total = d ? d.users.length + d.products.length + d.shops.length + d.orders.length + d.support.length : 0;
  return (
    <Page testID="admin-search">
      <SearchBox autoFocus value={q} onChange={setQ} testID="global-search" placeholder={L("People, products, shops, orders, chats…", "মানুষ, পণ্য, দোকান, অর্ডার, চ্যাট…")} />
      {dq.length < 2 ? <Empty icon="search" text={L("Type at least 2 letters. Search by name, username, email, phone, product, shop or order number.", "কমপক্ষে ২টি অক্ষর লিখুন। নাম, ইউজারনেম, ইমেইল, ফোন, পণ্য, দোকান বা অর্ডার নম্বর দিয়ে খুঁজুন।")} /> : null}
      {r.loading && dq.length >= 2 ? <Loading rows={2} /> : null}
      {r.error ? <ErrorBox text={r.error} onRetry={r.load} /> : null}
      {d && !total && !r.loading ? <Empty icon="search" text={L(`Nothing found for "${dq}"`, `"${dq}" এর জন্য কিছু পাওয়া যায়নি`)} /> : null}
      {d?.users.length ? (
        <>
          <SectionTitle title={L("People", "মানুষ")} />
          <Card style={{ paddingVertical: 4 }}>
            {d.users.map((u: any, i: number) => (
              <Pressable key={u.id} testID={`sr-user-${u.id}`} onPress={() => nav.push({ name: "user", id: u.id })} style={[st.row, { paddingVertical: 10, borderBottomWidth: i < d.users.length - 1 ? 0.5 : 0, borderBottomColor: theme.cardBorder }]}>
                <Avatar name={u.name} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{u.name}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>@{u.username}{u.email ? ` · ${u.email}` : ""}</Text>
                </View>
                {u.isSuperAdmin ? <Pill label="Admin" color="#2563EB" /> : u.banned ? <Pill label={L("Banned", "নিষিদ্ধ")} color="#B91C1C" /> : u.restricted ? <Pill label={L("Limited", "সীমিত")} color="#B45309" /> : null}
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
      {d?.products.length ? (
        <>
          <SectionTitle title={L("Products", "পণ্য")} />
          <Card style={{ paddingVertical: 4 }}>
            {d.products.map((p: any, i: number) => (
              <Pressable key={p.id} testID={`sr-product-${p.id}`} onPress={() => nav.push({ name: "product", id: p.id })} style={[st.row, { paddingVertical: 10, borderBottomWidth: i < d.products.length - 1 ? 0.5 : 0, borderBottomColor: theme.cardBorder }]}>
                <Thumb uri={p.image} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{taka(p.price)}{p.unit ? `/${p.unit}` : ""}{p.seller ? ` · ${p.seller}` : ""}</Text>
                </View>
                {p.hidden ? <Pill label={L("Hidden", "লুকানো")} color="#64748B" /> : null}
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
      {d?.shops.length ? (
        <>
          <SectionTitle title={L("Shops", "দোকান")} />
          <Card style={{ paddingVertical: 4 }}>
            {d.shops.map((s: any, i: number) => (
              <Pressable key={s.id} testID={`sr-shop-${s.id}`} onPress={() => nav.push({ name: "store", id: s.id })} style={[st.row, { paddingVertical: 10, borderBottomWidth: i < d.shops.length - 1 ? 0.5 : 0, borderBottomColor: theme.cardBorder }]}>
                <Thumb uri={s.logo} size={40} icon="briefcase" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{s.name}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{s.location || s.status}</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
      {d?.orders.length ? (
        <>
          <SectionTitle title={L("Orders", "অর্ডার")} />
          <Card style={{ paddingVertical: 4 }}>
            {d.orders.map((o: any, i: number) => (
              <Pressable key={o.id} testID={`sr-order-${o.id}`} onPress={() => nav.push({ name: "order", id: o.id })} style={[st.row, { paddingVertical: 10, borderBottomWidth: i < d.orders.length - 1 ? 0.5 : 0, borderBottomColor: theme.cardBorder }]}>
                <Thumb size={40} icon="shopping-bag" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>#{String(o.id).slice(-8).toUpperCase()} · {taka(o.total)}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{o.buyerName} · {fmtDate(o.createdAt)}</Text>
                </View>
                <Pill label={statusLabel(o.status, L)} color={STATUS_COLOR[o.status] || "#64748B"} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
      {d?.support.length ? (
        <>
          <SectionTitle title={L("Support chats", "সাপোর্ট চ্যাট")} />
          <Card style={{ paddingVertical: 4 }}>
            {d.support.map((t: any, i: number) => (
              <Pressable key={t.id} testID={`sr-thread-${t.id}`} onPress={() => nav.push({ name: "thread", id: t.id })} style={[st.row, { paddingVertical: 10, borderBottomWidth: i < d.support.length - 1 ? 0.5 : 0, borderBottomColor: theme.cardBorder }]}>
                <Avatar name={t.userName} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{t.userName}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{t.lastMessage}</Text>
                </View>
                <AppIcon name="message-circle" size={18} color={theme.primary} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </Page>
  );
}

/* =============================================================================================
 * Farmers Official: messages that show in people's Chats from the official page
 * ============================================================================================= */
export function OfficialScreen({ target, targetName }: { target?: string; targetName?: string }) {
  const { theme, isDark } = useTheme();
  const L = useL();
  const list = useLoader<any[]>(() => apiGet("/api/admin/manage/official"), []);
  const [to, setTo] = useState<"all" | "one">(target ? "one" : "all");
  const [who, setWho] = useState(target || "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [push, setPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async () => {
    const sendTo = to === "all" ? "all" : who.trim();
    if (!body.trim() || (to === "one" && !sendTo)) return;
    if (to === "all" && !(await confirmAsk(L("Send to everyone?", "সবাইকে পাঠাবেন?"), L("Every user will get this in Chats.", "সব ব্যবহারকারী চ্যাটে এটি পাবেন।"), L("Send", "পাঠান"), L("Cancel", "বাতিল")))) return;
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await apiPost("/api/admin/manage/official", { title: title.trim(), body: body.trim(), target: sendTo, notify: push });
      setMsg({ ok: true, text: L(`Sent to ${r.recipients} ${r.recipients === 1 ? "person" : "people"}`, `${r.recipients} জনকে পাঠানো হয়েছে`) });
      setTitle("");
      setBody("");
      list.load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Error" });
    }
    setBusy(false);
  };
  return (
    <Page testID="admin-official" onRefresh={list.load}>
      <LinearGradient colors={["#2563EB", "#0E7490"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
          <Feather name="check-circle" size={26} color="#2563EB" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>Farmers Official</Text>
          <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{L("Messages appear in people's Chats from this verified page. Nobody can reply or pretend to be it.", "মেসেজ এই ভেরিফায়েড পেজ থেকে মানুষের চ্যাটে দেখাবে। কেউ উত্তর দিতে বা এর মতো সাজতে পারবে না।")}</Text>
        </View>
      </LinearGradient>
      <Card>
        <Text style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>{L("Send to", "কাকে পাঠাবেন")}</Text>
        <RadioGroup row testID="official-to" value={to} onChange={(v) => setTo(v as any)} options={[
          { value: "all", label: L("Everyone", "সবাই"), sub: L("All users", "সব ব্যবহারকারী"), icon: "users" },
          { value: "one", label: targetName && to === "one" ? targetName : L("One person", "একজন"), sub: L("By username or email", "ইউজারনেম বা ইমেইল দিয়ে"), icon: "user" },
        ]} />
        <View style={{ height: 12 }} />
        {to === "one" && !target ? <Field label={L("Username or email", "ইউজারনেম বা ইমেইল")} value={who} onChange={setWho} testID="official-who" placeholder="rahim or rahim@mail.com" /> : null}
        <Field label={L("Title (optional)", "শিরোনাম (ঐচ্ছিক)")} value={title} onChange={setTitle} testID="official-title" maxLength={120} placeholder={L("e.g. Eid offer", "যেমন ঈদ অফার")} />
        <Field label={L("Message", "মেসেজ")} value={body} onChange={setBody} testID="official-body" multiline maxLength={2000} placeholder={L("Write the message people will read in Chats", "চ্যাটে মানুষ যে মেসেজ পড়বে তা লিখুন")} />
        <ToggleRow testID="official-push" icon="bell" label={L("Also notify", "নোটিফিকেশনও দিন")} sub={L("Adds it to the bell, and sends a phone push where push is turned on", "বেলে যোগ হবে, আর পুশ চালু থাকলে ফোনে পুশ যাবে")} value={push} onChange={setPush} />
        <View style={{ height: 14 }} />
        {msg ? <Text testID="official-result" style={{ color: msg.ok ? "#047857" : "#B91C1C", fontWeight: "700", marginBottom: 10 }}>{msg.text}</Text> : null}
        <Btn testID="official-send" icon="send" label={L("Send as Farmers Official", "Farmers Official হিসেবে পাঠান")} busy={busy} disabled={!body.trim() || (to === "one" && !who.trim())} onPress={send} />
      </Card>
      <SectionTitle title={L("Sent", "পাঠানো হয়েছে")} />
      {list.loading && !list.data ? <Loading rows={2} /> : null}
      {list.error ? <ErrorBox text={list.error} onRetry={list.load} /> : null}
      {list.data && !list.data.length ? <Card><Empty icon="send" text={L("No official messages yet", "এখনও কোনো অফিসিয়াল মেসেজ নেই")} /></Card> : null}
      {(list.data || []).map((m: any) => (
        <Card key={m.id} testID={`official-${m.id}`}>
          <View style={[st.row, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                <Pill icon={m.toAll ? "users" : "user"} label={m.toAll ? L("Everyone", "সবাই") : m.targetName || L("One person", "একজন")} color={m.toAll ? "#2563EB" : "#7C3AED"} />
                <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{fmtDate(m.createdAt)}{m.adminName ? ` · ${m.adminName}` : ""}</Text>
              </View>
              {m.title ? <Text style={{ color: theme.text, fontWeight: "800", fontSize: 14.5 }}>{m.title}</Text> : null}
              <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{m.body}</Text>
            </View>
            <Pressable testID={`official-del-${m.id}`} hitSlop={8} onPress={async () => {
              if (!(await confirmAsk(L("Delete this message?", "মেসেজটি মুছবেন?"), L("It disappears from people's Chats.", "এটি মানুষের চ্যাট থেকে মুছে যাবে।"), L("Delete", "মুছুন"), L("Cancel", "বাতিল")))) return;
              try { await apiDelete(`/api/admin/manage/official/${m.id}`); list.load(); } catch {}
            }}>
              <Feather name="trash-2" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </Card>
      ))}
    </Page>
  );
}

/* =============================================================================================
 * Carousel ads (Connect / Home / Market billboards)
 * ============================================================================================= */
const PLACE = (L: ReturnType<typeof useL>) => [
  { value: "all", label: L("Everywhere", "সব জায়গায়") },
  { value: "connect", label: L("Connect", "কানেক্ট") },
  { value: "home", label: L("Home", "হোম") },
  { value: "market", label: L("Market", "মার্কেট") },
];
const SWATCHES: [string, string][] = [["#16A34A", "#0E7490"], ["#2563EB", "#7C3AED"], ["#EA580C", "#DB2777"], ["#0F766E", "#15803D"], ["#B45309", "#EA580C"], ["#334155", "#0F172A"]];

function AdPreview({ ad, L }: { ad: any; L: ReturnType<typeof useL> }) {
  const { Image } = require("expo-image");
  const { mediaUrl } = require("@/lib/api");
  return (
    <LinearGradient colors={[ad.color1 || "#16A34A", ad.color2 || "#0E7490"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 16, minHeight: 120, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }} numberOfLines={2}>{L(ad.titleEn || "Title", ad.titleBn || ad.titleEn || "শিরোনাম")}</Text>
        {ad.subtitleEn || ad.subtitleBn ? <Text style={{ color: "rgba(255,255,255,.88)", fontSize: 13, marginTop: 4 }} numberOfLines={2}>{L(ad.subtitleEn, ad.subtitleBn || ad.subtitleEn)}</Text> : null}
        {ad.ctaEn || ad.ctaBn ? (
          <View style={{ alignSelf: "flex-start", marginTop: 10, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 12, height: 28, justifyContent: "center" }}>
            <Text style={{ color: ad.color1 || "#16A34A", fontWeight: "800", fontSize: 12.5 }}>{L(ad.ctaEn, ad.ctaBn || ad.ctaEn)}</Text>
          </View>
        ) : null}
      </View>
      {ad.image ? <Image source={{ uri: mediaUrl(ad.image) }} style={{ width: 84, height: 84, borderRadius: 16 }} contentFit="cover" /> : (
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,.18)", alignItems: "center", justifyContent: "center" }}>
          <Feather name={(ad.icon as any) || "tag"} size={28} color="#fff" />
        </View>
      )}
    </LinearGradient>
  );
}

export function AdsScreen() {
  const { theme } = useTheme();
  const L = useL();
  const nav = useAdminNav();
  const list = useLoader<any[]>(() => apiGet("/api/admin/manage/ads"), []);
  const ads = list.data || [];
  const move = async (i: number, dir: -1 | 1) => {
    const ids = ads.map((a) => a.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await apiPost("/api/admin/manage/ads/reorder", { ids }); list.load(); } catch {}
  };
  return (
    <Page testID="admin-ads" onRefresh={list.load}>
      <Btn testID="ad-new" icon="plus" label={L("New ad", "নতুন বিজ্ঞাপন")} onPress={() => nav.push({ name: "adForm" })} />
      <View style={{ height: 6 }} />
      <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginVertical: 8, lineHeight: 18 }}>{L("Ads slide in the carousel on the page you choose, in this order. Until you add one, the app shows its built-in cards.", "বিজ্ঞাপন আপনার বাছাই করা পেজের ক্যারোসেলে এই ক্রমে দেখাবে। একটিও না থাকলে অ্যাপের নিজস্ব কার্ড দেখাবে।")}</Text>
      {list.loading && !list.data ? <Loading rows={2} /> : null}
      {list.error ? <ErrorBox text={list.error} onRetry={list.load} /> : null}
      {list.data && !ads.length ? <Card><Empty icon="image" text={L("No ads yet", "এখনও কোনো বিজ্ঞাপন নেই")} action={L("Create the first", "প্রথমটি তৈরি করুন")} onAction={() => nav.push({ name: "adForm" })} /></Card> : null}
      {ads.map((a, i) => (
        <Card key={a.id} testID={`ad-${a.id}`} style={{ padding: 12 }}>
          <Pressable onPress={() => nav.push({ name: "adForm", id: a.id })} style={{ opacity: a.active ? 1 : 0.55 }}>
            <AdPreview ad={a} L={L} />
          </Pressable>
          <View style={[st.row, { marginTop: 10, flexWrap: "wrap", gap: 8 }]}>
            <Pill label={PLACE(L).find((p) => p.value === a.placement)?.label || a.placement} color="#2563EB" icon="map-pin" />
            {!a.active ? <Pill label={L("Hidden", "লুকানো")} color="#64748B" /> : a.endsAt && new Date(a.endsAt) < new Date() ? <Pill label={L("Ended", "শেষ")} color="#B45309" /> : <Pill label={L("Live", "চালু")} color="#15803D" />}
            <View style={{ flex: 1 }} />
            <Pressable testID={`ad-up-${a.id}`} disabled={i === 0} onPress={() => move(i, -1)} hitSlop={6} style={{ padding: 6, opacity: i === 0 ? 0.3 : 1 }}><Feather name="arrow-up" size={18} color={theme.text} /></Pressable>
            <Pressable testID={`ad-down-${a.id}`} disabled={i === ads.length - 1} onPress={() => move(i, 1)} hitSlop={6} style={{ padding: 6, opacity: i === ads.length - 1 ? 0.3 : 1 }}><Feather name="arrow-down" size={18} color={theme.text} /></Pressable>
            <Pressable testID={`ad-edit-${a.id}`} onPress={() => nav.push({ name: "adForm", id: a.id })} hitSlop={6} style={{ padding: 6 }}><Feather name="edit-2" size={18} color={theme.primary} /></Pressable>
          </View>
        </Card>
      ))}
    </Page>
  );
}

export function AdForm({ id }: { id?: string }) {
  const { theme } = useTheme();
  const L = useL();
  const nav = useAdminNav();
  const existing = useLoader<any[]>(() => (id ? apiGet("/api/admin/manage/ads") : Promise.resolve([])), [id]);
  const [f, setF] = useState<any>({ titleEn: "", titleBn: "", subtitleEn: "", subtitleBn: "", ctaEn: "", ctaBn: "", icon: "tag", color1: "#16A34A", color2: "#0E7490", image: "", placement: "all", linkType: "none", linkTarget: "", active: true, endsAt: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    const a = id && existing.data?.find((x) => x.id === id);
    if (a) setF({ ...a, endsAt: a.endsAt ? String(a.endsAt).slice(0, 10) : "" });
  }, [existing.data, id]);
  const set = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const body = { ...f, endsAt: f.endsAt || null };
      if (id) await apiPut(`/api/admin/manage/ads/${id}`, body);
      else await apiPost("/api/admin/manage/ads", body);
      nav.pop();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
    setBusy(false);
  };
  if (id && existing.loading && !existing.data) return <Page><Loading /></Page>;
  return (
    <Page testID="admin-ad-form">
      <AdPreview ad={f} L={L} />
      <View style={{ height: 16 }} />
      <Card>
        <Field label={L("Title (English)", "শিরোনাম (ইংরেজি)")} value={f.titleEn} onChange={set("titleEn")} testID="ad-title-en" maxLength={80} />
        <Field label={L("Title (Bangla)", "শিরোনাম (বাংলা)")} value={f.titleBn} onChange={set("titleBn")} testID="ad-title-bn" maxLength={80} />
        <Field label={L("Line under it (English)", "নিচের লাইন (ইংরেজি)")} value={f.subtitleEn} onChange={set("subtitleEn")} testID="ad-sub-en" maxLength={160} />
        <Field label={L("Line under it (Bangla)", "নিচের লাইন (বাংলা)")} value={f.subtitleBn} onChange={set("subtitleBn")} testID="ad-sub-bn" maxLength={160} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={L("Button (English)", "বাটন (ইংরেজি)")} value={f.ctaEn} onChange={set("ctaEn")} testID="ad-cta-en" maxLength={30} placeholder="Shop now" /></View>
          <View style={{ flex: 1 }}><Field label={L("Button (Bangla)", "বাটন (বাংলা)")} value={f.ctaBn} onChange={set("ctaBn")} testID="ad-cta-bn" maxLength={30} placeholder="এখনই কিনুন" /></View>
        </View>
      </Card>
      <SectionTitle title={L("Look", "দেখতে")} />
      <Card>
        <Text style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>{L("Colours", "রং")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          {SWATCHES.map(([a, b]) => {
            const on = f.color1 === a && f.color2 === b;
            return (
              <Pressable key={a + b} testID={`ad-swatch-${a.slice(1)}`} onPress={() => setF((p: any) => ({ ...p, color1: a, color2: b }))} style={{ borderRadius: 22, padding: 3, borderWidth: 2, borderColor: on ? theme.text : "transparent" }}>
                <LinearGradient colors={[a, b]} style={{ width: 38, height: 38, borderRadius: 19 }} />
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>{L("Picture", "ছবি")}</Text>
        <View style={[st.row, { marginBottom: 6 }]}>
          <Thumb uri={f.image} size={56} icon="image" />
          <Btn small kind="soft" icon="upload" label={f.image ? L("Change", "বদলান") : L("Add a picture", "ছবি যোগ করুন")} onPress={async () => { const u = await pickAndUpload(); if (u) set("image")(u); }} testID="ad-image" />
          {f.image ? <Btn small kind="ghost" label={L("Remove", "সরান")} onPress={() => set("image")("")} /> : null}
        </View>
      </Card>
      <SectionTitle title={L("Where and when", "কোথায় ও কখন")} />
      <Card>
        <RadioGroup row testID="ad-placement" options={PLACE(L)} value={f.placement} onChange={set("placement")} />
        <View style={{ height: 14 }} />
        <Text style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>{L("Tapping it opens", "ট্যাপ করলে খুলবে")}</Text>
        <RadioGroup row testID="ad-link" value={f.linkType} onChange={set("linkType")} options={[
          { value: "none", label: L("Nothing", "কিছু না") },
          { value: "category", label: L("A category", "একটি ক্যাটাগরি") },
          { value: "product", label: L("A product", "একটি পণ্য") },
          { value: "support", label: L("Support chat", "সাপোর্ট চ্যাট") },
          { value: "url", label: L("A website", "একটি ওয়েবসাইট") },
        ]} />
        <View style={{ height: 12 }} />
        {f.linkType === "category" || f.linkType === "product" || f.linkType === "url" ? (
          <Field label={f.linkType === "url" ? "https://…" : f.linkType === "category" ? L("Category name", "ক্যাটাগরির নাম") : L("Product ID", "পণ্যের আইডি")} value={f.linkTarget} onChange={set("linkTarget")} testID="ad-link-target" />
        ) : null}
        <Field label={L("Last day (optional, YYYY-MM-DD)", "শেষ দিন (ঐচ্ছিক, YYYY-MM-DD)")} value={f.endsAt} onChange={set("endsAt")} testID="ad-ends" placeholder="2026-12-31" />
        <ToggleRow testID="ad-active" icon="eye" label={L("Show this ad", "এই বিজ্ঞাপন দেখান")} value={!!f.active} onChange={set("active")} />
      </Card>
      {err ? <ErrorBox text={err} /> : null}
      <Btn testID="ad-save" icon="check" label={L("Save ad", "বিজ্ঞাপন সেভ করুন")} busy={busy} disabled={!f.titleEn.trim()} onPress={save} />
      {id ? (
        <Btn testID="ad-delete" kind="dangerSoft" icon="trash-2" label={L("Delete ad", "বিজ্ঞাপন মুছুন")} style={{ marginTop: 10 }} onPress={async () => {
          if (!(await confirmAsk(L("Delete this ad?", "বিজ্ঞাপন মুছবেন?"), f.titleEn, L("Delete", "মুছুন"), L("Cancel", "বাতিল")))) return;
          try { await apiDelete(`/api/admin/manage/ads/${id}`); nav.pop(); } catch (e: any) { setErr(e?.message || "Error"); }
        }} />
      ) : null}
    </Page>
  );
}
