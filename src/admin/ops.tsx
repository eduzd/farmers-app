import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { AdminUserSheet, AdminCatalogTab, AdminNotifyTab, AdminDeliveryTab } from "@/components/admin/ManageTabs";
import {
  useAdminNav, useL, useLoader, useDebounced, Page, Card, SectionTitle, Pill, Chip, ChipRow, SearchBox, Btn, Field, KV, Empty, Loading, ErrorBox, Thumb, Stat,
  taka, STATUS_COLOR, ORDER_STATUSES, statusLabel, fmtDate, st,
} from "./ui";
import { OrderRow } from "./shop";

import { AppIcon } from "@/components/icons/AppIcon";
import { ChatPhoto } from "@/components/ChatPhoto";
import { VoiceMessagePlayer } from "@/components/VoiceMessagePlayer";
import { PhotoViewer } from "@/components/PhotoViewer";
/* ======================= HOME ======================= */
export function HomeTab({ supportUnread }: { supportUnread: number }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const sum = useLoader<any>(() => apiGet("/api/admin/manage/summary"), []);
  const shop = useLoader<any>(() => apiGet("/api/admin/manage/shop/overview"), []);
  const reload = () => { sum.load(); shop.load(); nav.refreshBadges(); };
  const s = sum.data || {};
  const o = shop.data || {};
  return (
    <Page onRefresh={reload} testID="admin-home">
      {sum.error ? <ErrorBox text={sum.error} onRetry={reload} /> : null}
      <View style={[st.grid, { marginBottom: 10 }]}>
        <Stat testID="stat-users" label={L("Users", "ব্যবহারকারী")} value={s.users ?? "…"} icon="users" color="#2563EB" onPress={() => nav.push({ name: "users" })} />
        <Stat testID="stat-orders" label={L("Pending orders", "অপেক্ষমাণ অর্ডার")} value={o.pendingOrders ?? "…"} icon="shopping-bag" color="#B45309" onPress={() => nav.goTab("orders")} />
        <Stat testID="stat-products" label={L("Products", "পণ্য")} value={o.products ?? "…"} icon="package" color="#0E7490" onPress={() => nav.goTab("shop", "products")} />
        <Stat testID="stat-shops" label={L("Shops", "দোকান")} value={o.stores ?? "…"} icon="briefcase" color="#7C3AED" onPress={() => nav.goTab("shop", "shops")} />
        <Stat testID="stat-support" label={L("Unread help", "অপঠিত সাহায্য")} value={supportUnread} icon="message-circle" color="#DB2777" onPress={() => nav.goTab("support")} />
        <Stat label={L("Revenue", "আয়")} value={s.revenue !== undefined ? taka(s.revenue) : "…"} icon="dollar-sign" color="#047857" />
      </View>
      <SectionTitle title={L("Shortcuts", "শর্টকাট")} />
      <View style={[st.grid, { marginBottom: 10 }]}>
        {([
          ["add-product", L("Add product", "পণ্য যোগ"), "plus-square", () => nav.push({ name: "productForm" })],
          ["open-shop", L("Open a shop", "দোকান খুলুন"), "briefcase", () => nav.push({ name: "storeForm" })],
          ["categories", L("Categories", "ক্যাটাগরি"), "grid", () => nav.goTab("shop", "categories")],
          ["notify", L("Send notification", "নোটিফিকেশন পাঠান"), "bell", () => nav.goTab("more")],
        ] as [string, string, any, () => void][]).map(([k, label, icon, fn]) => (
          <Pressable key={k} testID={`shortcut-${k}`} onPress={fn} style={({ pressed }) => [{ flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.cardBorder, backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
            <AppIcon name={icon} size={18} color={theme.primary} />
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13.5, flex: 1 }} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <SectionTitle title={L("Recent orders", "সাম্প্রতিক অর্ডার")} action={L("All", "সব")} onAction={() => nav.goTab("orders")} />
      {shop.loading && !shop.data ? <Loading /> : null}
      {shop.data && !o.recentOrders?.length ? <Empty icon="shopping-bag" text={L("No orders yet", "এখনও কোনো অর্ডার নেই")} /> : null}
      {(o.recentOrders || []).map((x: any) => <OrderRow key={x.id} o={x} />)}
      <SectionTitle title={L("Low stock", "কম স্টক")} action={L("Products", "পণ্য")} onAction={() => nav.goTab("shop", "products")} />
      {shop.data && !o.lowStock?.length ? <Empty icon="box" text={L("Nothing is running low", "কোনো পণ্যের স্টক কম নয়")} /> : null}
      {(o.lowStock || []).map((p: any) => (
        <Card key={p.id} onPress={() => nav.push({ name: "product", id: p.id })}>
          <View style={st.row}>
            <Thumb uri={p.image} size={40} />
            <Text style={{ flex: 1, color: theme.text, fontWeight: "600" }} numberOfLines={1}>{p.name}</Text>
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
  const { theme } = useTheme();
  const L = useL();
  const th = useLoader<any>(() => apiGet(`/api/admin/manage/support/threads/${id}`), [id]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  useEffect(() => { nav.refreshBadges(); }, [th.data?.messages?.length]);
  useEffect(() => {
    const t = setInterval(() => th.load(), 6000);
    return () => clearInterval(t);
  }, [th.load]);
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true); setErr(null);
    try { await apiPost(`/api/admin/manage/support/threads/${id}/reply`, { body }); setText(""); await th.load(); } catch (e: any) { setErr(e?.message); } finally { setBusy(false); }
  };
  const setStatus = async (s: string) => {
    try { await apiPut(`/api/admin/manage/support/threads/${id}`, { status: s }); await th.load(); } catch (e: any) { setErr(e?.message); }
  };
  if (th.loading && !th.data) return <Page><Loading /></Page>;
  if (!th.data) return <Page><ErrorBox text={th.error || L("Conversation not found", "কথোপকথন পাওয়া যায়নি")} onRetry={th.load} /></Page>;
  const t = th.data.thread;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.backgroundRoot }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable testID="thread-open-user" onPress={() => nav.push({ name: "user", id: t.userId })} style={[st.row, { padding: 12, borderBottomWidth: 1, borderBottomColor: theme.cardBorder, backgroundColor: theme.card }]}>
        <Thumb uri={t.userAvatar} icon="user" size={38} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{t.userName || t.userEmail}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>{t.userEmail || t.userPhone}</Text>
        </View>
        <Btn testID="thread-toggle" small kind="ghost" icon={t.status === "open" ? "check" : "rotate-ccw"} label={t.status === "open" ? L("Close", "বন্ধ") : L("Reopen", "আবার খুলুন")} onPress={() => setStatus(t.status === "open" ? "closed" : "open")} />
      </Pressable>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 8, width: "100%", maxWidth: 900, alignSelf: "center" }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {th.data.messages.map((m: any) => (
          <View key={m.id} style={{ alignSelf: m.fromAdmin ? "flex-end" : "flex-start", maxWidth: "82%" }}>
            {m.kind === "image" && m.mediaId ? (
              <ChatPhoto mediaId={m.mediaId} width={m.width} height={m.height} onOpen={(uri) => setViewer(uri)} />
            ) : m.kind === "voice" && m.mediaId ? (
              <View style={{ backgroundColor: m.fromAdmin ? theme.primary : theme.card, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 }}>
                <VoiceMessagePlayer mediaId={m.mediaId} durationMs={m.durationMs ?? null} isMe={!!m.fromAdmin}
                  tint={m.fromAdmin ? "#fff" : theme.primary} trackColor={m.fromAdmin ? "rgba(255,255,255,0.35)" : theme.primary + "30"} textColor={m.fromAdmin ? "#fff" : theme.textSecondary} />
              </View>
            ) : (
              <View style={{ backgroundColor: m.fromAdmin ? theme.primary : theme.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: m.fromAdmin ? 0 : 1, borderColor: theme.cardBorder }}>
                <Text style={{ color: m.fromAdmin ? "#fff" : theme.text, fontSize: 14.5 }}>{m.body}</Text>
              </View>
            )}
            <Text style={{ color: theme.textTertiary, fontSize: 10.5, marginTop: 2, textAlign: m.fromAdmin ? "right" : "left" }}>
              {m.fromAdmin ? `${m.senderName || L("Admin", "অ্যাডমিন")} · ` : ""}{fmtDate(m.createdAt)}
            </Text>
          </View>
        ))}
      </ScrollView>
      {err ? <View style={{ paddingHorizontal: 12 }}><ErrorBox text={err} /></View> : null}
      <View style={[st.row, { padding: 10, backgroundColor: theme.card, gap: 8 }]}>
        <TextInput testID="reply-input" value={text} onChangeText={setText} placeholder={L("Write a reply…", "উত্তর লিখুন…")} placeholderTextColor={theme.textTertiary} multiline maxLength={2000}
          style={{ flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.backgroundSecondary, color: theme.text, fontSize: 14.5, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }} />
        <Pressable testID="reply-send" onPress={send} disabled={busy || !text.trim()} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", opacity: busy || !text.trim() ? 0.5 : 1 }}>
          <Feather name="send" size={18} color="#fff" />
        </Pressable>
      </View>
      <PhotoViewer images={viewer ? [viewer] : []} visible={!!viewer} onClose={() => setViewer(null)} />
    </KeyboardAvoidingView>
  );
}

/* ======================= USERS ======================= */
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
