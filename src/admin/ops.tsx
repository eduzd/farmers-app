import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { AdminUserSheet, AdminCatalogTab, AdminNotifyTab, AdminDeliveryTab } from "@/components/admin/ManageTabs";
import {
  useAdminNav, useL, useLoader, useDebounced, Page, Card, SectionTitle, Pill, Chip, ChipRow, SearchBox, Btn, Field, KV, Empty, Loading, ErrorBox, Thumb, Stat,
  taka, STATUS_COLOR, ORDER_STATUSES, statusLabel, fmtDate, st,
  Text, Hero, shadow, ListRow, ToggleRow, RadioGroup, Avatar, Segmented,
} from "./ui";
import { OrderRow } from "./shop";

import { AppIcon } from "@/components/icons/AppIcon";
import { ChatPhoto } from "@/components/ChatPhoto";
import { VoiceMessagePlayer } from "@/components/VoiceMessagePlayer";
import { PhotoViewer } from "@/components/PhotoViewer";
/* ======================= HOME ======================= */
export function HomeTab({ supportUnread }: { supportUnread: number }) {
  const nav = useAdminNav();
  const { theme, isDark } = useTheme();
  const L = useL();
  const sum = useLoader<any>(() => apiGet("/api/admin/manage/summary"), []);
  const shop = useLoader<any>(() => apiGet("/api/admin/manage/shop/overview"), []);
  const reload = () => { sum.load(); shop.load(); nav.refreshBadges(); };
  const s = sum.data || {};
  const o = shop.data || {};
  const h = new Date().getHours();
  const hello = h < 12 ? L("Good morning", "শুভ সকাল") : h < 17 ? L("Good afternoon", "শুভ অপরাহ্ন") : L("Good evening", "শুভ সন্ধ্যা");
  const shortcuts: [string, string, any, string, () => void][] = [
    ["add-product", L("Add product", "পণ্য যোগ"), "plus-square", "#16A34A", () => nav.push({ name: "productForm" })],
    ["official", L("Official message", "অফিসিয়াল মেসেজ"), "send", "#2563EB", () => nav.push({ name: "official" })],
    ["ads", L("Carousel ads", "ক্যারোসেল বিজ্ঞাপন"), "image", "#DB2777", () => nav.push({ name: "ads" })],
    ["restricted", L("Restricted users", "সীমিত ব্যবহারকারী"), "shield", "#B45309", () => nav.push({ name: "users", filter: "restricted" })],
    ["open-shop", L("Open a shop", "দোকান খুলুন"), "briefcase", "#7C3AED", () => nav.push({ name: "storeForm" })],
    ["categories", L("Categories", "ক্যাটাগরি"), "grid", "#0E7490", () => nav.goTab("shop", "categories")],
    ["notify", L("Notification", "নোটিফিকেশন"), "bell", "#EA580C", () => nav.goTab("more")],
    ["search", L("Search all", "সব খুঁজুন"), "search", "#475569", () => nav.push({ name: "search" })],
  ];
  return (
    <Page onRefresh={reload} testID="admin-home">
      <Hero testID="admin-hero">
        <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 13.5, fontWeight: "600" }}>{hello}</Text>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2, letterSpacing: -0.3 }} numberOfLines={1}>{L("Farmers at a glance", "এক নজরে Farmers")}</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ color: "rgba(255,255,255,.8)", fontSize: 12.5, fontWeight: "600" }}>{L("Sales (all orders except cancelled)", "বিক্রি (বাতিল ছাড়া সব অর্ডার)")}</Text>
            <Text testID="hero-revenue" style={{ color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }} numberOfLines={1}>{s.revenue !== undefined ? taka(s.revenue) : "…"}</Text>
          </View>
          <Pressable testID="hero-pending" onPress={() => nav.goTab("orders")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,.18)", paddingHorizontal: 12, height: 36, borderRadius: 18, opacity: pressed ? 0.8 : 1 })}>
            <Feather name="clock" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{`${o.pendingOrders ?? "…"} ${L("to approve", "অনুমোদন বাকি")}`}</Text>
          </Pressable>
        </View>
      </Hero>
      {sum.error ? <ErrorBox text={sum.error} onRetry={reload} /> : null}
      <View style={[st.grid, { marginBottom: 6 }]}>
        <Stat testID="stat-users" label={L("Users", "ব্যবহারকারী")} value={s.users ?? "…"} icon="users" color="#2563EB" onPress={() => nav.push({ name: "users" })} hint={s.banned || s.restricted ? `${s.banned || 0} ${L("banned", "নিষিদ্ধ")} · ${s.restricted || 0} ${L("limited", "সীমিত")}` : undefined} />
        <Stat testID="stat-orders" label={L("Pending orders", "অপেক্ষমাণ অর্ডার")} value={o.pendingOrders ?? "…"} icon="shopping-bag" color="#B45309" onPress={() => nav.goTab("orders")} />
        <Stat testID="stat-products" label={L("Products", "পণ্য")} value={o.products ?? "…"} icon="package" color="#0E7490" onPress={() => nav.goTab("shop", "products")} />
        <Stat testID="stat-shops" label={L("Shops", "দোকান")} value={o.stores ?? "…"} icon="briefcase" color="#7C3AED" onPress={() => nav.goTab("shop", "shops")} />
        <Stat testID="stat-support" label={L("Unread help", "অপঠিত সাহায্য")} value={supportUnread} icon="message-circle" color="#DB2777" onPress={() => nav.goTab("support")} />
        <Stat testID="stat-reports" label={L("Open reports", "খোলা রিপোর্ট")} value={s.openReports ?? "…"} icon="flag" color="#DC2626" onPress={() => nav.goTab("more")} />
      </View>
      <SectionTitle title={L("Quick actions", "দ্রুত কাজ")} />
      <View style={[st.grid, { marginBottom: 6 }]}>
        {shortcuts.map(([k, label, icon, color, fn]) => (
          <Pressable key={k} testID={`shortcut-${k}`} onPress={fn} style={({ pressed }) => [{ flexBasis: "22%", minWidth: 132, flexGrow: 1, padding: 14, borderRadius: 18, backgroundColor: theme.card, opacity: pressed ? 0.82 : 1, gap: 10 }, shadow(isDark)]}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
              <AppIcon name={icon} size={19} color={color} />
            </View>
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13.5 }} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <SectionTitle title={L("Recent orders", "সাম্প্রতিক অর্ডার")} action={L("All", "সব")} onAction={() => nav.goTab("orders")} />
      {shop.loading && !shop.data ? <Loading rows={2} /> : null}
      {shop.data && !o.recentOrders?.length ? <Card><Empty icon="shopping-bag" text={L("No orders yet. New orders show up here first.", "এখনও কোনো অর্ডার নেই। নতুন অর্ডার প্রথমে এখানে দেখাবে।")} /></Card> : null}
      {(o.recentOrders || []).map((x: any) => <OrderRow key={x.id} o={x} />)}
      <SectionTitle title={L("Low stock", "কম স্টক")} action={L("Products", "পণ্য")} onAction={() => nav.goTab("shop", "products")} />
      {shop.data && !o.lowStock?.length ? <Card><Empty icon="box" text={L("Nothing is running low", "কোনো পণ্যের স্টক কম নয়")} /></Card> : null}
      {(o.lowStock || []).map((p: any) => (
        <Card key={p.id} onPress={() => nav.push({ name: "product", id: p.id })}>
          <View style={st.row}>
            <Thumb uri={p.image} size={44} />
            <Text style={{ flex: 1, color: theme.text, fontWeight: "700" }} numberOfLines={1}>{p.name}</Text>
            <Pill label={`${L("Stock", "স্টক")} ${p.quantity}`} color={p.quantity > 0 ? "#B45309" : "#B91C1C"} />
          </View>
        </Card>
      ))}
    </Page>
  );
}

/* ======================= ORDERS ======================= */
export function OrdersTab() {
  const L = useL();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useLoader<any[]>(() => apiGet(`/api/admin/manage/orders?status=${status}&q=${encodeURIComponent(dq)}`), [status, dq]);
  return (
    <Page onRefresh={list.load} testID="admin-orders">
      <SearchBox testID="order-search" value={q} onChange={setQ} placeholder={L("Search by buyer, order number", "ক্রেতা বা অর্ডার নম্বর খুঁজুন")} />
      <ChipRow>
        <Chip label={L("All", "সব")} on={!status} onPress={() => setStatus("")} />
        {ORDER_STATUSES.map((s) => <Chip key={s} testID={`order-status-${s}`} label={statusLabel(s, L)} color={STATUS_COLOR[s]} on={status === s} onPress={() => setStatus(s)} />)}
      </ChipRow>
      {list.error ? <ErrorBox text={list.error} onRetry={list.load} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && !list.data.length ? <Empty icon="shopping-bag" text={L("No orders found", "কোনো অর্ডার পাওয়া যায়নি")} /> : null}
      {(list.data || []).map((o) => <OrderRow key={o.id} o={o} />)}
    </Page>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const o = useLoader<any>(() => apiGet(`/api/admin/manage/orders/${id}`), [id]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (o.loading && !o.data) return <Page><Loading /></Page>;
  if (!o.data) return <Page><ErrorBox text={o.error || L("Order not found", "অর্ডার পাওয়া যায়নি")} onRetry={o.load} /></Page>;
  const d = o.data;
  const setStatus = async (s: string) => {
    setBusy(s); setErr(null);
    try { await apiPut(`/api/admin/manage/orders/${id}`, { status: s, note: note.trim() || undefined }); setNote(""); await o.load(); } catch (e: any) { setErr(e?.message); } finally { setBusy(null); }
  };
  const addr = d.address || {};
  return (
    <Page onRefresh={o.load} testID="order-detail">
      {err ? <ErrorBox text={err} /> : null}
      <Card>
        <View style={[st.row, { justifyContent: "space-between" }]}>
          <Text style={{ color: theme.text, fontWeight: "800", fontSize: 17 }}>#{String(d.id).slice(-6).toUpperCase()}</Text>
          <Pill label={statusLabel(d.status, L)} color={STATUS_COLOR[d.status] || "#64748B"} />
        </View>
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 4 }}>{fmtDate(d.createdAt)} · {d.paymentMethod || "—"}</Text>
        <Text style={{ color: theme.text, fontWeight: "800", fontSize: 20, marginTop: 8 }}>{taka(d.total)}</Text>
      </Card>
      <SectionTitle title={L("Buyer", "ক্রেতা")} />
      <Card>
        <KV k={L("Name", "নাম")} v={d.buyerName} testID="order-open-buyer" onPress={d.buyerId ? () => nav.push({ name: "user", id: d.buyerId }) : undefined} />
        <KV k={L("Email", "ইমেইল")} v={d.buyerEmail} />
        <KV k={L("Phone", "ফোন")} v={addr.phone || d.buyerPhone} />
        <KV k={L("Deliver to", "ঠিকানা")} v={[addr.name, addr.address || addr.street, addr.area, addr.district || addr.city].filter(Boolean).join(", ")} />
      </Card>
      <SectionTitle title={`${L("Items", "পণ্য")} (${d.items.length})`} />
      {d.items.map((it: any, i: number) => {
        const p = it?.productId ? d.products?.[it.productId] : null;
        return (
          <Card key={i} testID={`order-item-${i}`} onPress={p ? () => nav.push({ name: "product", id: p.id }) : undefined}>
            <View style={st.row}>
              <Thumb uri={it.image} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{it.name || p?.name || L("Item", "পণ্য")}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                  {it.quantity} × {taka(it.price)}{p?.storeName || it.seller ? ` · ${p?.storeName || it.seller}` : ""}
                </Text>
              </View>
              {p ? <Feather name="chevron-right" size={18} color={theme.textTertiary} /> : <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{L("removed", "মুছে ফেলা")}</Text>}
            </View>
          </Card>
        );
      })}
      {d.sellers?.length ? (
        <>
          <SectionTitle title={L("Sellers", "বিক্রেতা")} />
          <Card>
            {d.sellers.map((s: any) => (
              <KV key={s.id} k={s.name || s.email} v={s.storeName || L("No shop", "দোকান নেই")} onPress={() => (s.storeId ? nav.push({ name: "store", id: s.storeId }) : nav.push({ name: "user", id: s.id }))} />
            ))}
          </Card>
        </>
      ) : null}
      <SectionTitle title={L("Change status", "স্ট্যাটাস পরিবর্তন")} />
      <Card>
        <Field testID="order-note" label={L("Note for history (optional)", "নোট (ঐচ্ছিক)")} value={note} onChange={setNote} maxLength={300} />
        <View style={[st.grid, { gap: 8 }]}>
          {ORDER_STATUSES.filter((s) => s !== d.status).map((s) => (
            <Btn key={s} testID={`set-status-${s}`} small kind={s === "cancelled" ? "danger" : "soft"} label={statusLabel(s, L)} busy={busy === s} onPress={() => setStatus(s)} />
          ))}
        </View>
      </Card>
      {d.history?.length ? (
        <>
          <SectionTitle title={L("History", "ইতিহাস")} />
          <Card>
            {[...d.history].reverse().map((h: any, i: number) => (
              <View key={i} style={{ paddingVertical: 6 }}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>{statusLabel(h.status, L)}{h.note ? ` · ${h.note}` : ""}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{fmtDate(h.at || h.date || h.createdAt)}{h.by ? ` · ${h.by}` : ""}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Page>
  );
}

/* ======================= SUPPORT ======================= */
export function SupportTab() {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useLoader<any[]>(() => apiGet(`/api/admin/manage/support/threads?status=${status}&q=${encodeURIComponent(dq)}`), [status, dq]);
  useEffect(() => {
    const t = setInterval(() => list.load(), 10000);
    return () => clearInterval(t);
  }, [list.load]);
  return (
    <Page onRefresh={() => { list.load(); nav.refreshBadges(); }} testID="admin-support">
      <SearchBox testID="support-search" value={q} onChange={setQ} placeholder={L("Search people or messages", "মানুষ বা মেসেজ খুঁজুন")} />
      <ChipRow>
        {[["open", L("Open", "খোলা")], ["closed", L("Closed", "বন্ধ")], ["", L("All", "সব")]].map(([k, label]) => (
          <Chip key={k || "all"} testID={`support-filter-${k || "all"}`} label={label} on={status === k} onPress={() => setStatus(k)} />
        ))}
      </ChipRow>
      {list.error ? <ErrorBox text={list.error} onRetry={list.load} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && !list.data.length ? <Empty icon="message-circle" text={L("No conversations here", "এখানে কোনো কথোপকথন নেই")} /> : null}
      {(list.data || []).map((t) => (
        <Card key={t.id} testID={`thread-${t.id}`} onPress={() => nav.push({ name: "thread", id: t.id })}>
          <View style={st.row}>
            <Thumb uri={t.userAvatar} icon="user" size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={[st.row, { gap: 6 }]}>
                <Text style={{ color: theme.text, fontWeight: t.adminUnread ? "800" : "700", flex: 1 }} numberOfLines={1}>{t.userName || t.userEmail}</Text>
                <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{fmtDate(t.lastMessageAt)}</Text>
              </View>
              <Text style={{ color: t.adminUnread ? theme.text : theme.textSecondary, fontSize: 13 }} numberOfLines={1}>
                {t.lastFromAdmin ? L("You: ", "আপনি: ") : ""}{t.lastMessage}
              </Text>
            </View>
            {t.adminUnread ? (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{t.adminUnread}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ))}
    </Page>
  );
}

export function ThreadView({ id }: { id: string }) {
  const nav = useAdminNav();
  const L = useL();
  const { theme } = useTheme();
  const [meta, setMeta] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const closed = meta?.status === "closed";
  const toggle = async () => {
    setBusy(true);
    try {
      const r = await apiPut(`/api/admin/manage/support/threads/${id}`, { status: closed ? "open" : "closed" });
      setMeta((m: any) => ({ ...m, status: r?.status || (closed ? "open" : "closed") }));
      nav.refreshBadges();
    } catch {}
    setBusy(false);
  };
  const { SupportConversation } = require("@/screens/SupportChatScreen");
  return (
    <SupportConversation
      admin={{
        threadId: id,
        userName: meta?.userName || "",
        userAvatar: meta?.userAvatar || null,
        onBack: () => { nav.pop(); nav.refreshBadges(); },
        onOpenUser: meta?.userId ? () => nav.push({ name: "user", id: meta.userId }) : undefined,
        onMeta: setMeta,
        onChanged: nav.refreshBadges,
        headerRight: (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {meta?.userId ? (
              <Pressable testID="thread-user" accessibilityLabel={L("Open profile", "প্রোফাইল দেখুন")} onPress={() => nav.push({ name: "user", id: meta.userId })} hitSlop={6} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <Feather name="user" size={20} color={theme.text} />
              </Pressable>
            ) : null}
            <Pressable testID="thread-toggle" disabled={busy || !meta} accessibilityLabel={closed ? L("Reopen", "আবার খুলুন") : L("Mark solved", "সমাধান হয়েছে")} onPress={toggle} hitSlop={6}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 10, borderRadius: 16, marginRight: 4, backgroundColor: closed ? theme.backgroundSecondary : theme.primary + "18" }}>
              <Feather name={closed ? "rotate-ccw" : "check"} size={15} color={closed ? theme.textSecondary : theme.primary} />
              <Text style={{ color: closed ? theme.textSecondary : theme.primary, fontWeight: "700", fontSize: 12.5 }}>{closed ? L("Reopen", "খুলুন") : L("Solved", "সমাধান")}</Text>
            </Pressable>
          </View>
        ),
      }}
    />
  );
}

export function UsersList() {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const dq = useDebounced(q);
  const list = useLoader<any[]>(() => apiGet(`/api/admin/manage/users?q=${encodeURIComponent(dq)}&filter=${filter}`), [dq, filter]);
  return (
    <Page onRefresh={list.load} testID="admin-users">
      <SearchBox testID="user-search" value={q} onChange={setQ} placeholder={L("Search name, email, phone", "নাম, ইমেইল, ফোন খুঁজুন")} />
      <ChipRow>
        {[["all", L("All", "সব")], ["sellers", L("Shop owners", "দোকানি")], ["buyers", L("Buyers", "ক্রেতা")], ["admins", L("Admins", "অ্যাডমিন")], ["banned", L("Banned", "ব্যানড")]].map(([k, label]) => (
          <Chip key={k} label={label} on={filter === k} onPress={() => setFilter(k)} />
        ))}
      </ChipRow>
      {list.error ? <ErrorBox text={list.error} onRetry={list.load} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && !list.data.length ? <Empty icon="users" text={L("No users found", "কোনো ব্যবহারকারী পাওয়া যায়নি")} /> : null}
      {(list.data || []).map((u) => (
        <Card key={u.id} testID={`user-${u.id}`} onPress={() => nav.push({ name: "user", id: u.id })}>
          <View style={st.row}>
            <Thumb uri={u.avatar} icon="user" size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{u.name}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{u.email || u.phone || `@${u.username}`}</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {u.isSuperAdmin ? <Pill label={L("Admin", "অ্যাডমিন")} color="#7C3AED" /> : null}
                {u.banned ? <Pill label={L("Banned", "ব্যানড")} color="#B91C1C" /> : null}
                {u.store ? <Pill label={u.store.name} color="#0E7490" /> : null}
                {u.orders ? <Pill label={`${u.orders} ${L("orders", "অর্ডার")}`} color="#1D4ED8" /> : null}
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textTertiary} />
          </View>
        </Card>
      ))}
    </Page>
  );
}

export function UserDetail({ id }: { id: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const u = useLoader<any>(() => apiGet(`/api/admin/manage/users/${id}`), [id]);
  const [manage, setManage] = useState(false);
  if (u.loading && !u.data) return <Page><Loading /></Page>;
  if (!u.data) return <Page><ErrorBox text={u.error || L("User not found", "ব্যবহারকারী পাওয়া যায়নি")} onRetry={u.load} /></Page>;
  const d = u.data;
  return (
    <Page onRefresh={u.load} testID="user-detail">
      <Card>
        <View style={st.row}>
          <Thumb uri={d.avatar} icon="user" size={60} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: theme.text, fontWeight: "800", fontSize: 17 }}>{d.name}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>@{d.username}</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Pill label={d.banned ? L("Banned", "ব্যানড") : L("Active", "সক্রিয়")} color={d.banned ? "#B91C1C" : "#047857"} />
              {d.isSuperAdmin ? <Pill label={L("Admin", "অ্যাডমিন")} color="#7C3AED" /> : null}
              {d.verified ? <Pill label={L("Verified", "যাচাইকৃত")} color="#1D4ED8" /> : null}
            </View>
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          <KV k={L("Email", "ইমেইল")} v={d.email} />
          <KV k={L("Phone", "ফোন")} v={d.phone} />
          <KV k={L("Role", "ভূমিকা")} v={d.role} />
          <KV k={L("Joined", "যোগ দিয়েছেন")} v={fmtDate(d.createdAt, false)} />
          {d.store ? <KV k={L("Shop", "দোকান")} v={d.store.name} testID="user-open-shop" onPress={() => nav.push({ name: "store", id: d.store.id })} /> : null}
          <KV k={L("Products listed", "তালিকাভুক্ত পণ্য")} v={String(d.listings || 0)} />
          <KV k={L("Total spent", "মোট খরচ")} v={taka(d.spent)} />
        </View>
        <View style={[st.grid, { marginTop: 10 }]}>
          <Btn testID="manage-user" small kind="soft" icon="settings" label={L("Manage account", "অ্যাকাউন্ট পরিচালনা")} onPress={() => setManage(true)} />
        </View>
      </Card>
      <SectionTitle title={`${L("Orders", "অর্ডার")} (${d.recentOrders?.length || 0})`} />
      {!d.recentOrders?.length ? <Empty icon="shopping-bag" text={L("No orders", "কোনো অর্ডার নেই")} /> : null}
      {(d.recentOrders || []).map((o: any) => <OrderRow key={o.id} o={{ ...o, buyerName: d.name }} />)}
      {manage ? <AdminUserSheet userId={id} onClose={() => setManage(false)} onChanged={() => u.load()} /> : null}
    </Page>
  );
}

/* ======================= MORE ======================= */
export function MoreTab({ onLogout, adminName }: { onLogout: () => void; adminName: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const [panel, setPanel] = useState<null | "moderation" | "notify" | "delivery">(null);
  if (panel) {
    return (
      <View style={{ flex: 1 }}>
        <Pressable onPress={() => setPanel(null)} style={[st.row, { padding: 12, gap: 8 }]} testID="more-back">
          <Feather name="arrow-left" size={18} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: "700" }}>{L("More", "আরও")}</Text>
        </Pressable>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingTop: 0, width: "100%", maxWidth: 900, alignSelf: "center" }}>
          {panel === "moderation" ? <AdminCatalogTab /> : panel === "notify" ? <AdminNotifyTab /> : <AdminDeliveryTab />}
        </ScrollView>
      </View>
    );
  }
  const items: [string, string, string, any, () => void][] = [
    ["users", L("Users", "ব্যবহারকারী"), L("Search, verify, ban, roles", "খুঁজুন, যাচাই, ব্যান, ভূমিকা"), "users", () => nav.push({ name: "users" })],
    ["moderation", L("Listings moderation", "তালিকা মডারেশন"), L("Jobs, rentals, services and more", "চাকরি, ভাড়া, সেবা ইত্যাদি"), "shield", () => setPanel("moderation")],
    ["notify", L("Send notification", "নোটিফিকেশন পাঠান"), L("To everyone or one person", "সবাইকে বা একজনকে"), "bell", () => setPanel("notify")],
    ["delivery", L("Delivery & payments", "ডেলিভারি ও পেমেন্ট"), L("Delivery zones and charges", "ডেলিভারি এলাকা ও চার্জ"), "truck", () => setPanel("delivery")],
    ["posts", L("Posts & reports", "পোস্ট ও রিপোর্ট"), L("Community posts and user reports", "কমিউনিটি পোস্ট ও রিপোর্ট"), "flag", () => nav.openClassic("reports")],
    ["content", L("Content & announcements", "কন্টেন্ট ও ঘোষণা"), L("Banners, tips, announcements", "ব্যানার, টিপস, ঘোষণা"), "layout", () => nav.openClassic("content")],
    ["analytics", L("Analytics", "অ্যানালিটিক্স"), L("Growth and activity", "বৃদ্ধি ও কার্যকলাপ"), "bar-chart-2", () => nav.openClassic("analytics")],
    ["settings", L("App settings", "অ্যাপ সেটিংস"), L("Features, maintenance, limits", "ফিচার, মেইনটেনেন্স, সীমা"), "sliders", () => nav.openClassic("settings")],
    ["logs", L("Activity log", "কার্যকলাপ লগ"), L("Every admin action", "সব অ্যাডমিন কাজ"), "list", () => nav.openClassic("logs")],
  ];
  return (
    <Page testID="admin-more">
      <Card>
        <View style={st.row}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary + "20", alignItems: "center", justifyContent: "center" }}>
            <Feather name="shield" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "800" }}>{adminName}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>{L("Farmers admin", "ফার্মার্স অ্যাডমিন")}</Text>
          </View>
        </View>
      </Card>
      {items.map(([k, title, sub, icon, fn]) => (
        <Card key={k} testID={`more-${k}`} onPress={fn} style={{ paddingVertical: 12 }}>
          <View style={st.row}>
            <AppIcon name={icon} size={19} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: "700" }}>{title}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{sub}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textTertiary} />
          </View>
        </Card>
      ))}
      <Btn testID="admin-logout" kind="ghost" icon="log-out" label={L("Sign out", "সাইন আউট")} onPress={onLogout} style={{ marginTop: 8 }} />
    </Page>
  );
}
