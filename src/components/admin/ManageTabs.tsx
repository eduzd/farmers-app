import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, RefreshControl } from "react-native";
import { Text, Switch } from "@/admin/ui";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { ModalBottomInset } from "@/components/ModalBottomInset";

import { AppIcon } from "@/components/icons/AppIcon";
/** Admin app tabs that control the whole platform: orders, seller stores, listings + community, notifications, and a per-user control sheet. */

const taka = (n: number) => `৳${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const STATUS_COLOR: Record<string, string> = { pending: "#B25E09", confirmed: "#3D38D0", processing: "#3D38D0", shipped: "#1F86DB", delivered: "#00875A", cancelled: "#DA2F2F" };

function useL() {
  const { language } = useI18n();
  return (en: string, bn: string) => (language === "bn" ? bn : en);
}

function useLoader<T>(fn: () => Promise<T>, deps: any[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await fn());
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  return { data, loading, error, load };
}

function Chip({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.chip, { borderColor: on ? theme.primary : theme.cardBorder, backgroundColor: on ? theme.primary + "15" : theme.card }]}>
      <Text style={[s.chipText, { color: on ? theme.primary : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}
function SmallBtn({ label, icon, color, onPress, testID, disabled }: { label: string; icon?: keyof typeof Feather.glyphMap; color: string; onPress: () => void; testID?: string; disabled?: boolean }) {
  return (
    <Pressable testID={testID} disabled={disabled} onPress={onPress} style={[s.sbtn, { borderColor: color + "55", backgroundColor: color + "12", opacity: disabled ? 0.5 : 1 }]}>
      {icon ? <AppIcon name={icon} size={13} color={color} /> : null}
      <Text style={[s.sbtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}
function Box({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return <View style={[s.box, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>{children}</View>;
}
function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { theme } = useTheme();
  return (
    <View style={[s.search, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
      <Feather name="search" size={16} color={theme.textSecondary} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.textSecondary} style={[s.searchInput, { color: theme.text }]} />
    </View>
  );
}
function State({ loading, error, empty, emptyText }: { loading: boolean; error: string | null; empty: boolean; emptyText: string }) {
  const { theme } = useTheme();
  if (loading) return <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />;
  if (error) return <Text style={[s.muted, { color: theme.error, padding: 12 }]}>{error}</Text>;
  if (empty) return <Text style={[s.muted, { color: theme.textSecondary, padding: 12 }]}>{emptyText}</Text>;
  return null;
}

// ================= Orders =================
export function AdminOrdersTab() {
  const { theme } = useTheme();
  const L = useL();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { data, loading, error, load } = useLoader<any[]>(() => apiGet(`/api/admin/manage/orders?status=${status}`), [status]);
  const list = (data || []).filter((o) => !q || `${o.id} ${o.buyerName} ${o.buyerEmail}`.toLowerCase().includes(q.toLowerCase()));
  const setOrder = async (id: string, body: any) => {
    try {
      setBusy(id);
      await apiPut(`/api/admin/manage/orders/${id}`, body);
      setMsg(L("Order updated", "অর্ডার আপডেট হয়েছে"));
      await load();
    } catch (e: any) {
      setMsg(e?.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <ScrollView style={s.fill} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Search value={q} onChange={setQ} placeholder={L("Search order, buyer name or email", "অর্ডার বা ক্রেতা খুঁজুন")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <Chip label={L("All", "সব")} on={!status} onPress={() => setStatus("")} />
        {STATUSES.map((x) => <Chip key={x} testID={`admin-order-filter-${x}`} label={x} on={status === x} onPress={() => setStatus(x)} />)}
      </ScrollView>
      {msg ? <Text style={[s.muted, { color: theme.primary, marginBottom: 8 }]}>{msg}</Text> : null}
      <State loading={loading} error={error} empty={!loading && list.length === 0} emptyText={L("No orders.", "কোনো অর্ডার নেই।")} />
      {!loading && list.map((o) => (
        <Box key={o.id}>
          <Pressable onPress={() => setOpen(open === o.id ? null : o.id)} style={s.rowTop} testID={`admin-order-${o.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: theme.text }]}>{o.id}</Text>
              <Text style={[s.muted, { color: theme.textSecondary }]}>{o.buyerName} · {o.itemCount} {L("items", "পণ্য")} · {new Date(o.createdAt).toLocaleDateString()}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.title, { color: theme.text }]}>{taka(o.total)}</Text>
              <Text style={[s.status, { color: STATUS_COLOR[o.status] || theme.textSecondary }]}>{o.status}</Text>
            </View>
          </Pressable>
          {open === o.id ? (
            <View style={{ marginTop: 10 }}>
              {(o.items || []).map((it: any, i: number) => (
                <Text key={i} style={[s.muted, { color: theme.text }]}>• {it.name || "Item"}{it.options ? ` (${Object.entries(it.options).map(([k, v]) => `${k}: ${v}`).join(", ")})` : ""} × {it.quantity || 1} — {taka((it.price || 0) * (it.quantity || 1))}</Text>
              ))}
              {o.checkout ? (
                <View testID={`admin-order-contact-${o.id}`} style={{ marginTop: 6 }}>
                  {o.checkout.contactPhone ? <Text style={[s.muted, { color: theme.text }]}>{L("Contact", "যোগাযোগ")}: {o.checkout.contactName} · {o.checkout.contactPhone}{o.checkout.altPhone ? ` / ${o.checkout.altPhone}` : ""}</Text> : null}
                  <Text style={[s.muted, { color: theme.textSecondary }]}>
                    {o.checkout.deliveryMethod === "pickup" ? L("Pick up from seller", "বিক্রেতার কাছ থেকে সংগ্রহ") : o.checkout.zone === "inside_dhaka" ? L("Inside Dhaka", "ঢাকার ভিতরে") : o.checkout.zone === "outside_dhaka" ? L("Outside Dhaka", "ঢাকার বাইরে") : o.checkout.division}
                    {" · "}{o.checkout.deliveryMethod}{o.checkout.address ? ` · ${o.checkout.address}` : ""}{o.checkout.district ? `, ${o.checkout.district}` : ""}
                  </Text>
                  <Text style={[s.muted, { color: theme.textSecondary }]}>{L("Subtotal", "সাবটোটাল")} {taka(o.checkout.subtotal)} · {L("Delivery", "ডেলিভারি")} {taka(o.checkout.deliveryFee)}{o.checkout.discount ? ` · −${taka(o.checkout.discount)}` : ""}</Text>
                </View>
              ) : null}
              {o.address ? <Text style={[s.muted, { color: theme.textSecondary, marginTop: 6 }]}>{[o.address.fullName || o.address.name, o.address.address, o.address.city, o.address.phone].filter(Boolean).join(" · ")}</Text> : null}
              <Text style={[s.muted, { color: theme.textSecondary, marginTop: 6 }]}>{L("Payment", "পেমেন্ট")}: {(o.paymentMethod || "-").toUpperCase()} · {L("Buyer", "ক্রেতা")}: {o.buyerEmail || "-"}</Text>
              {o.adminNote ? <Text style={[s.muted, { color: theme.textSecondary }]}>{L("Note", "নোট")}: {o.adminNote}</Text> : null}
              <Text style={[s.label, { color: theme.text }]}>{L("Set status", "অবস্থা ঠিক করুন")}</Text>
              <View style={s.wrap}>
                {STATUSES.filter((x) => x !== o.status).map((x) => (
                  <SmallBtn key={x} testID={`admin-set-${o.id}-${x}`} label={x} color={STATUS_COLOR[x]} disabled={busy === o.id} onPress={() => setOrder(o.id, { status: x })} />
                ))}
              </View>
              <View style={[s.wrap, { marginTop: 8 }]}>
                <SmallBtn label={L("Delete order", "অর্ডার মুছুন")} icon="trash-2" color={theme.error} disabled={busy === o.id}
                  onPress={async () => { try { await apiDelete(`/api/admin/manage/orders/${o.id}`); await load(); } catch (e: any) { setMsg(e?.message); } }} />
              </View>
            </View>
          ) : null}
        </Box>
      ))}
    </ScrollView>
  );
}

// ================= Stores (sellers) =================
export function AdminStoresTab() {
  const { theme } = useTheme();
  const L = useL();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const { data, loading, error, load } = useLoader<any[]>(() => apiGet("/api/admin/manage/stores"), []);
  const list = (data || []).filter((x) => !q || `${x.name} ${x.ownerEmail} ${x.ownerName}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <ScrollView style={s.fill} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Search value={q} onChange={setQ} placeholder={L("Search stores or owners", "দোকান খুঁজুন")} />
      {msg ? <Text style={[s.muted, { color: theme.primary, marginBottom: 8 }]}>{msg}</Text> : null}
      <State loading={loading} error={error} empty={!loading && list.length === 0} emptyText={L("No seller stores yet.", "এখনো কোনো দোকান নেই।")} />
      {!loading && list.map((x) => (
        <Box key={x.id}>
          <View style={s.rowTop}>
            <View style={[s.logo, { backgroundColor: x.themeColor || theme.primary }]}><Text style={{ color: "#fff", fontWeight: "700" }}>{(x.name || "S")[0].toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: theme.text }]}>{x.name}</Text>
              <Text style={[s.muted, { color: theme.textSecondary }]}>{x.ownerName} · {x.ownerEmail}</Text>
              <Text style={[s.muted, { color: theme.textSecondary }]}>{x.products} {L("products", "পণ্য")} · {x.orders} {L("orders", "অর্ডার")} · {taka(x.revenue)}</Text>
            </View>
            <Text style={[s.status, { color: x.status === "active" ? theme.success : theme.error }]}>{x.status}</Text>
          </View>
          <View style={[s.wrap, { marginTop: 10 }]}>
            {x.status === "active" ? (
              <SmallBtn testID={`suspend-${x.id}`} label={L("Suspend store", "দোকান স্থগিত")} icon="pause-circle" color={theme.error}
                onPress={async () => { try { await apiPut(`/api/admin/manage/stores/${x.id}`, { status: "suspended", reason: "Suspended by admin" }); setMsg(`${x.name}: suspended`); load(); } catch (e: any) { setMsg(e?.message); } }} />
            ) : (
              <SmallBtn testID={`activate-${x.id}`} label={L("Reactivate", "আবার চালু")} icon="play-circle" color={theme.success}
                onPress={async () => { try { await apiPut(`/api/admin/manage/stores/${x.id}`, { status: "active" }); setMsg(`${x.name}: active`); load(); } catch (e: any) { setMsg(e?.message); } }} />
            )}
          </View>
        </Box>
      ))}
    </ScrollView>
  );
}

// ================= Listings + community moderation =================
const KINDS = ["listings", "experts", "events", "polls", "questions", "rfqs", "diary"];
export function AdminCatalogTab() {
  const { theme } = useTheme();
  const L = useL();
  const [kind, setKind] = useState("listings");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const { data, loading, error, load } = useLoader<any[]>(() => apiGet(`/api/admin/manage/catalog?kind=${kind}`), [kind]);
  const list = (data || []).filter((x) => !q || `${x.title} ${x.ownerName}`.toLowerCase().includes(q.toLowerCase()));
  const act = async (fn: () => Promise<any>, m: string) => {
    try { await fn(); setMsg(m); load(); } catch (e: any) { setMsg(e?.message); }
  };
  return (
    <ScrollView style={s.fill} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {KINDS.map((k) => <Chip key={k} testID={`kind-${k}`} label={k} on={kind === k} onPress={() => setKind(k)} />)}
      </ScrollView>
      <Search value={q} onChange={setQ} placeholder={L("Search", "খুঁজুন")} />
      {msg ? <Text style={[s.muted, { color: theme.primary, marginBottom: 8 }]}>{msg}</Text> : null}
      <State loading={loading} error={error} empty={!loading && list.length === 0} emptyText={L("Nothing here.", "কিছু নেই।")} />
      {!loading && list.map((x) => (
        <Box key={x.id}>
          <View style={s.rowTop}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: theme.text }]} numberOfLines={2}>{x.title}</Text>
              <Text style={[s.muted, { color: theme.textSecondary }]}>
                {x.ownerName || L("Sample data", "নমুনা")}{x.price != null ? ` · ${taka(x.price)}` : ""}{x.quantity != null ? ` · ${L("stock", "স্টক")} ${x.quantity}` : ""}
              </Text>
            </View>
            {x.hidden ? <Text style={[s.status, { color: theme.error }]}>{L("hidden", "লুকানো")}</Text> : null}
          </View>
          <View style={[s.wrap, { marginTop: 10 }]}>
            <SmallBtn testID={`hide-${x.id}`} label={x.hidden ? L("Show", "দেখান") : L("Hide", "লুকান")} icon={x.hidden ? "eye" : "eye-off"} color={theme.primary}
              onPress={() => act(() => apiPut(`/api/admin/manage/catalog/${kind}/${x.id}`, { hidden: !x.hidden }), x.hidden ? L("Visible again", "আবার দেখা যাবে") : L("Hidden", "লুকানো হয়েছে"))} />
            <SmallBtn testID={`del-${x.id}`} label={L("Delete", "মুছুন")} icon="trash-2" color={theme.error}
              onPress={() => act(() => apiDelete(`/api/admin/manage/catalog/${kind}/${x.id}`), L("Deleted", "মুছে ফেলা হয়েছে"))} />
          </View>
        </Box>
      ))}
    </ScrollView>
  );
}

// ================= Notifications =================
export function AdminNotifyTab() {
  const { theme } = useTheme();
  const L = useL();
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <ScrollView style={s.fill} contentContainerStyle={s.pad}>
      <Box>
        <Text style={[s.label, { color: theme.text, marginTop: 0 }]}>{L("Send to", "পাঠান")}</Text>
        <View style={s.wrap}>
          {[["all", L("Everyone", "সবাই")], ["buyers", L("Buyers", "ক্রেতা")], ["sellers", L("Sellers", "বিক্রেতা")]].map(([v, l]) => <Chip key={v} label={l} on={audience === v} onPress={() => setAudience(v)} />)}
        </View>
        <Text style={[s.label, { color: theme.text }]}>{L("Title", "শিরোনাম")}</Text>
        <TextInput testID="notify-title" value={title} onChangeText={setTitle} style={[s.input, { color: theme.text, borderColor: theme.cardBorder }]} placeholderTextColor={theme.textSecondary} placeholder={L("Market closed on Friday", "শুক্রবার বাজার বন্ধ")} />
        <Text style={[s.label, { color: theme.text }]}>{L("Message", "বার্তা")}</Text>
        <TextInput testID="notify-body" value={body} onChangeText={setBody} multiline style={[s.input, { color: theme.text, borderColor: theme.cardBorder, minHeight: 90, textAlignVertical: "top" }]} />
        {msg ? <Text style={[s.muted, { color: theme.primary, marginTop: 8 }]}>{msg}</Text> : null}
        <View style={{ marginTop: 12 }}>
          <SmallBtn testID="notify-send" label={busy ? L("Sending…", "পাঠানো হচ্ছে…") : L("Send notification", "নোটিফিকেশন পাঠান")} icon="send" color={theme.primary} disabled={busy || !title.trim() || !body.trim()}
            onPress={async () => {
              try { setBusy(true); const r = await apiPost<{ sent: number }>("/api/admin/manage/notify", { title, body, audience }); setMsg(L(`Sent to ${r.sent} people`, `${r.sent} জনকে পাঠানো হয়েছে`)); setTitle(""); setBody(""); } catch (e: any) { setMsg(e?.message); } finally { setBusy(false); }
            }} />
        </View>
      </Box>
    </ScrollView>
  );
}

// ================= Marketplace panel on the overview =================
/** Live marketplace numbers on the admin overview; each tile opens the tab that manages it. */
export function AdminMarketplacePanel({ onOpen, onOpenSellerHub }: { onOpen: (tab: "orders" | "stores" | "listings" | "delivery") => void; onOpenSellerHub?: () => void }) {
  const { theme } = useTheme();
  const L = useL();
  const { data } = useLoader<any>(() => apiGet("/api/admin/manage/summary"), []);
  const pending = Number(data?.ordersByStatus?.pending || 0);
  const tiles: { tab: "orders" | "stores" | "listings" | "delivery"; icon: any; color: string; label: string; value: string; sub: string }[] = [
    { tab: "orders", icon: "shopping-bag", color: "#B25E09", label: L("Orders", "অর্ডার"), value: String(data?.orders ?? "–"), sub: pending ? L(`${pending} waiting`, `${pending}টি অপেক্ষায়`) : L("None waiting", "কোনো অপেক্ষা নেই") },
    { tab: "stores", icon: "briefcase", color: "#2E96EF", label: L("Sellers", "বিক্রেতা"), value: String(data?.stores ?? "–"), sub: data?.suspendedStores ? L(`${data.suspendedStores} suspended`, `${data.suspendedStores}টি স্থগিত`) : L("All active", "সব চালু") },
    { tab: "listings", icon: "package", color: "#3D38D0", label: L("Listings", "লিস্টিং"), value: String(data?.listings ?? "–"), sub: data?.hiddenListings ? L(`${data.hiddenListings} hidden`, `${data.hiddenListings}টি লুকানো`) : L("All visible", "সব দৃশ্যমান") },
    { tab: "delivery", icon: "truck", color: "#00BB77", label: L("Sales", "বিক্রি"), value: data ? taka(data.revenue) : "–", sub: L("Delivery charges", "ডেলিভারি চার্জ") },
  ];
  return (
    <View testID="admin-marketplace-panel" style={{ marginBottom: 16 }}>
      <View style={[s.rowTop, { marginBottom: 8, alignItems: "center" }]}>
        <Text style={[s.title, { color: theme.text, flex: 1 }]}>{L("Marketplace", "মার্কেটপ্লেস")}</Text>
        {onOpenSellerHub ? <SmallBtn testID="admin-open-seller-hub" label={L("Seller Hub", "সেলার হাব")} icon="external-link" color={theme.primary} onPress={onOpenSellerHub} /> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tiles.map((t) => (
          <Pressable key={t.tab} testID={`mp-tile-${t.tab}`} onPress={() => onOpen(t.tab)}
            style={({ pressed }) => [{ flexGrow: 1, flexBasis: 150, minWidth: 140, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.cardBorder, backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.color + "18" }}>
                <AppIcon name={t.icon} size={15} color={t.color} />
              </View>
              <Text style={[s.muted, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>{t.label}</Text>
              <Feather name="chevron-right" size={14} color={theme.textSecondary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text }} numberOfLines={1}>{t.value}</Text>
            <Text style={[s.muted, { color: t.tab === "orders" && pending ? "#B25E09" : theme.textSecondary }]} numberOfLines={1}>{t.sub}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ================= Delivery charges =================
export function AdminDeliveryTab() {
  const { theme } = useTheme();
  const L = useL();
  const { data, loading, error, load } = useLoader<any>(() => apiGet("/api/admin/manage/delivery"), []);
  const [f, setF] = useState<Record<string, string>>({});
  const [express, setExpress] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) {
      setF({ insideDhaka: String(data.insideDhaka), outsideDhaka: String(data.outsideDhaka), express: String(data.express), freeOver: String(data.freeOver) });
      setExpress(data.expressEnabled !== false);
    }
  }, [data]);
  const fields: [string, string, string][] = [
    ["insideDhaka", L("Inside Dhaka (৳)", "ঢাকার ভিতরে (৳)"), L("Home delivery charge inside Dhaka", "ঢাকার ভিতরে হোম ডেলিভারি চার্জ")],
    ["outsideDhaka", L("Outside Dhaka (৳)", "ঢাকার বাইরে (৳)"), L("Home delivery charge outside Dhaka", "ঢাকার বাইরে হোম ডেলিভারি চার্জ")],
    ["express", L("Express, inside Dhaka (৳)", "এক্সপ্রেস, ঢাকার ভিতরে (৳)"), L("Next-day delivery charge", "পরের দিন ডেলিভারি চার্জ")],
    ["freeOver", L("Free delivery over (৳)", "এর বেশি হলে ফ্রি ডেলিভারি (৳)"), L("0 turns free delivery off", "০ দিলে ফ্রি ডেলিভারি বন্ধ")],
  ];
  return (
    <ScrollView style={s.fill} contentContainerStyle={s.pad}>
      <State loading={loading} error={error} empty={false} emptyText="" />
      {data ? (
        <Box>
          <Text style={[s.title, { color: theme.text }]}>{L("Delivery charges", "ডেলিভারি চার্জ")}</Text>
          <Text style={[s.muted, { color: theme.textSecondary }]}>{L("Checkout uses these for every order. Set your own rates.", "চেকআউটে প্রতিটি অর্ডারে এগুলো ব্যবহার হয়। নিজের রেট দিন।")}</Text>
          {fields.map(([k, label, hint]) => (
            <View key={k}>
              <Text style={[s.label, { color: theme.text }]}>{label}</Text>
              <TextInput testID={`delivery-${k}`} value={f[k] ?? ""} onChangeText={(v) => setF({ ...f, [k]: v.replace(/[^0-9]/g, "") })} keyboardType="number-pad"
                style={[s.input, { color: theme.text, borderColor: theme.cardBorder }]} placeholder={hint} placeholderTextColor={theme.textSecondary} />
            </View>
          ))}
          <View style={[s.rowTop, { marginTop: 12 }]}>
            <Text style={[s.muted, { color: theme.text, flex: 1 }]}>{L("Offer express delivery", "এক্সপ্রেস ডেলিভারি চালু")}</Text>
            <Switch value={express} onValueChange={setExpress} testID="delivery-express-enabled" />
          </View>
          {msg ? <Text style={[s.muted, { color: theme.primary, marginTop: 8 }]}>{msg}</Text> : null}
          <View style={{ marginTop: 12 }}>
            <SmallBtn testID="delivery-save" label={busy ? L("Saving…", "সেভ হচ্ছে…") : L("Save charges", "চার্জ সেভ করুন")} icon="save" color={theme.primary} disabled={busy}
              onPress={async () => {
                try {
                  setBusy(true);
                  await apiPut("/api/admin/manage/delivery", { ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v || 0)])), expressEnabled: express });
                  setMsg(L("Saved. Checkout uses the new charges now.", "সেভ হয়েছে। চেকআউটে নতুন চার্জ চালু।"));
                  await load();
                } catch (e: any) { setMsg(e?.message); } finally { setBusy(false); }
              }} />
          </View>
        </Box>
      ) : null}
    </ScrollView>
  );
}

// ================= Per-user control sheet =================
const ROLES = ["farmer", "buyer", "trader", "expert", "user"];
export function AdminUserSheet({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const { theme } = useTheme();
  const L = useL();
  const { data: u, loading, error, load } = useLoader<any>(() => apiGet(`/api/admin/manage/users/${userId}`), [userId]);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const update = async (body: any, m: string) => {
    try { await apiPut(`/api/admin/manage/users/${userId}`, body); setMsg(m); await load(); onChanged(); } catch (e: any) { setMsg(e?.message); }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.back}>
        <View style={[s.sheet, { backgroundColor: theme.backgroundRoot }]}>
          <View style={s.rowTop}>
            <Text style={[s.h, { color: theme.text, flex: 1 }]}>{L("Manage user", "ব্যবহারকারী পরিচালনা")}</Text>
            <Pressable onPress={onClose} hitSlop={10} testID="user-sheet-close"><Feather name="x" size={22} color={theme.text} /></Pressable>
          </View>
          <State loading={loading} error={error} empty={false} emptyText="" />
          {u ? (
            <ScrollView style={{ maxHeight: 560 }}>
              <Box>
                <Text style={[s.title, { color: theme.text }]}>{u.name}</Text>
                <Text style={[s.muted, { color: theme.textSecondary }]}>{u.email} · @{u.username}{u.phone ? ` · ${u.phone}` : ""}</Text>
                <Text style={[s.muted, { color: theme.textSecondary }]}>{u.orders} {L("orders", "অর্ডার")} · {taka(u.spent)} · {u.listings} {L("listings", "লিস্টিং")}{u.store ? ` · ${L("Store", "দোকান")}: ${u.store.name} (${u.store.status})` : ""}</Text>
                {u.banned ? <Text style={[s.status, { color: theme.error, marginTop: 4 }]}>{L("Banned", "নিষিদ্ধ")}{u.bannedReason ? `: ${u.bannedReason}` : ""}</Text> : null}
              </Box>
              <Box>
                <View style={s.switchRow}><Text style={[s.title, { color: theme.text, flex: 1 }]}>{L("Verified", "যাচাইকৃত")}</Text><Switch testID="user-verified" value={!!u.verified} onValueChange={(v) => update({ verified: v }, L("Saved", "সংরক্ষিত"))} /></View>
                <View style={s.switchRow}><Text style={[s.title, { color: theme.text, flex: 1 }]}>{L("Admin rights", "অ্যাডমিন অধিকার")}</Text><Switch testID="user-admin" value={!!u.isSuperAdmin} onValueChange={(v) => update({ isSuperAdmin: v }, L("Saved", "সংরক্ষিত"))} /></View>
                <Text style={[s.label, { color: theme.text }]}>{L("Role", "ভূমিকা")}</Text>
                <View style={s.wrap}>{ROLES.map((r) => <Chip key={r} label={r} on={u.role === r} onPress={() => update({ role: r }, L("Role changed", "ভূমিকা পরিবর্তন হয়েছে"))} />)}</View>
              </Box>
              <Box>
                <Text style={[s.label, { color: theme.text, marginTop: 0 }]}>{L("Set a new password", "নতুন পাসওয়ার্ড")}</Text>
                <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder={L("At least 8 characters", "কমপক্ষে ৮ অক্ষর")} placeholderTextColor={theme.textSecondary} style={[s.input, { color: theme.text, borderColor: theme.cardBorder }]} />
                <View style={{ marginTop: 8 }}>
                  <SmallBtn label={L("Save password", "পাসওয়ার্ড সংরক্ষণ")} icon="key" color={theme.primary} disabled={pw.length < 8}
                    onPress={async () => { try { await apiPut(`/api/admin/manage/users/${userId}/password`, { password: pw }); setPw(""); setMsg(L("Password changed", "পাসওয়ার্ড পরিবর্তন হয়েছে")); } catch (e: any) { setMsg(e?.message); } }} />
                </View>
              </Box>
              <Box>
                <Text style={[s.label, { color: theme.text, marginTop: 0 }]}>{L("Message this user", "এই ব্যবহারকারীকে বার্তা")}</Text>
                <TextInput value={note} onChangeText={setNote} placeholder={L("Notification text", "নোটিফিকেশন")} placeholderTextColor={theme.textSecondary} style={[s.input, { color: theme.text, borderColor: theme.cardBorder }]} />
                <View style={{ marginTop: 8 }}>
                  <SmallBtn label={L("Send", "পাঠান")} icon="send" color={theme.primary} disabled={!note.trim()}
                    onPress={async () => { try { await apiPost("/api/admin/manage/notify", { userId, title: L("Message from admin", "অ্যাডমিনের বার্তা"), body: note }); setNote(""); setMsg(L("Sent", "পাঠানো হয়েছে")); } catch (e: any) { setMsg(e?.message); } }} />
                </View>
              </Box>
              {(u.recentOrders || []).length ? (
                <Box>
                  <Text style={[s.label, { color: theme.text, marginTop: 0 }]}>{L("Recent orders", "সাম্প্রতিক অর্ডার")}</Text>
                  {u.recentOrders.map((o: any) => (
                    <Text key={o.id} style={[s.muted, { color: theme.text }]}>{o.id} · {taka(o.total)} · <Text style={{ color: STATUS_COLOR[o.status] }}>{o.status}</Text></Text>
                  ))}
                </Box>
              ) : null}
              {msg ? <Text style={[s.muted, { color: theme.primary, marginBottom: 8 }]}>{msg}</Text> : null}
              <View style={[s.wrap, { marginBottom: 16 }]}>
                {u.banned ? (
                  <SmallBtn testID="user-unban" label={L("Unban", "নিষেধাজ্ঞা তুলুন")} icon="user-check" color={theme.success} onPress={() => update({ banned: false }, L("Unbanned", "নিষেধাজ্ঞা তোলা হয়েছে"))} />
                ) : (
                  <SmallBtn testID="user-ban" label={L("Ban account", "অ্যাকাউন্ট নিষিদ্ধ")} icon="slash" color={theme.error} disabled={u.isSuperAdmin} onPress={() => update({ banned: true, bannedReason: "Banned by admin" }, L("Banned", "নিষিদ্ধ করা হয়েছে"))} />
                )}
              </View>
            </ScrollView>
          ) : null}
          <ModalBottomInset />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  pad: { padding: 16, paddingBottom: 40 },
  box: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 15, fontWeight: "600" },
  h: { fontSize: 18, fontWeight: "700" },
  muted: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  status: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginRight: 6,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
 },
  chipText: { fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  sbtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  sbtnText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  logo: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  back: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { width: "100%", maxWidth: 640, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
});
