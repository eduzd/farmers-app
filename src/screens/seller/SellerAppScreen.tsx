import { useMarketCategories, categoryLabel } from "@/lib/marketCategories";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Image,
  Switch,
  useWindowDimensions,
  Platform,
  RefreshControl,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { apiGet, apiPost, apiPut, apiDelete, uploadImage, mediaUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import { getAppVariant, openVariantOnWeb } from "@/lib/appVariant";
import { S, STATUS_COLORS, NEXT_STATUS, THEME_SWATCHES } from "./sellerTheme";

import { AppIcon } from "@/components/icons/AppIcon";
type Store = {
  id: string; name: string; slug: string; tagline: string; description: string; logo: string; banner: string;
  themeColor: string; phone: string; location: string; category: string; status: string; statusReason: string;
};
type Stats = { products: number; outOfStock: number; orders: number; byStatus: Record<string, number>; revenue: number };
type ProductOption = { name: string; choices: { label: string; extra: number }[] };
type Product = { id: string; name: string; price: number; unit?: string; quantity?: number; minOrder?: number; options?: ProductOption[]; category?: string; description?: string; image?: string; active?: boolean; hidden?: boolean };
type OptionDraft = { name: string; choices: string };
const optionsToDraft = (o?: ProductOption[]): OptionDraft[] =>
  (o || []).map((g) => ({ name: g.name, choices: g.choices.map((c) => (c.extra ? `${c.label} +${c.extra}` : c.label)).join(", ") }));
/** "1 kg, 5 kg +350" -> [{label:"1 kg",extra:0},{label:"5 kg",extra:350}] */
const draftToOptions = (d: OptionDraft[]): ProductOption[] =>
  d
    .map((g) => ({
      name: g.name.trim(),
      choices: g.choices
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => {
          const m = c.match(/^(.*?)\s*\+\s*(\d+)\s*$/);
          return m ? { label: m[1].trim(), extra: Number(m[2]) } : { label: c, extra: 0 };
        }),
    }))
    .filter((g) => g.name && g.choices.length);
type Order = {
  id: string; total: number; itemCount: number; paymentMethod: string; status: string; createdAt: string;
  items: { name?: string; price?: number; quantity?: number; options?: Record<string, string> }[];
  checkout?: { contactName?: string; contactPhone?: string; altPhone?: string | null; zone?: string | null; deliveryMethod?: string; address?: string; district?: string; division?: string; deliveryDate?: string; timeSlot?: string; notes?: string; deliveryFee?: number } | null;
  shippingAddress?: { fullName?: string; name?: string; address?: string; city?: string; phone?: string } | null;
};
type Section = "dashboard" | "products" | "orders" | "store" | "account";

const taka = (n: number) => `৳${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

export default function SellerAppScreen() {
  const navigation = useNavigation<any>();
  // Opened from the Farmers app (Profile > Seller Hub, admin overview): offer a way back.
  const canBack = getAppVariant() !== "seller" && navigation?.canGoBack?.();
  const goBack = () => navigation.goBack();
  const { language } = useI18n();
  const L = (en: string, bn: string) => (language === "bn" ? bn : en);
  const { user, logout } = useAuthStore();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [section, setSection] = useState<Section>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 2500);
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const me = await apiGet<{ store: Store | null; stats: Stats | null }>("/api/seller/me");
      setStore(me.store);
      setStats(me.stats);
      if (me.store) {
        const [p, o] = await Promise.all([apiGet<Product[]>("/api/seller/products"), apiGet<Order[]>("/api/me/sales")]);
        setProducts(p || []);
        setOrders(o || []);
      }
    } catch (e: any) {
      setError(e?.message || "Could not load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={[st.fill, st.center]}>
        <ActivityIndicator color={S.primary} size="large" />
      </View>
    );
  }

  if (!store) {
    return <CreateStore L={L} error={error} onCreated={() => { setLoading(true); load(); }} userName={user?.name || ""} onLogout={logout} onBack={canBack ? goBack : undefined} />;
  }

  const suspended = store.status !== "active";
  const pending = orders.filter((o) => o.status === "pending").length;
  const NAV: { id: Section; icon: keyof typeof Feather.glyphMap; label: string; badge?: number }[] = [
    { id: "dashboard", icon: "grid", label: L("Dashboard", "ড্যাশবোর্ড") },
    { id: "products", icon: "package", label: L("Products", "পণ্য") },
    { id: "orders", icon: "shopping-bag", label: L("Orders", "অর্ডার"), badge: pending },
    { id: "store", icon: "layout", label: L("Store", "দোকান") },
    { id: "account", icon: "user", label: L("Account", "অ্যাকাউন্ট") },
  ];

  const body = (
    <ScrollView
      style={st.fill}
      contentContainerStyle={[st.content, wide && { paddingHorizontal: 32 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {suspended ? (
        <View style={[st.banner, { backgroundColor: S.dangerSoft, borderColor: "#FECACA" }]}>
          <Feather name="alert-octagon" size={18} color={S.danger} />
          <Text style={[st.bannerText, { color: S.danger }]}>
            {L("Your store is suspended by the admin. Buyers can't see it and you can't make changes.", "অ্যাডমিন আপনার দোকান স্থগিত করেছেন।")}
            {store.statusReason ? ` ${L("Reason", "কারণ")}: ${store.statusReason}` : ""}
          </Text>
        </View>
      ) : null}
      {error ? <Text style={st.errorText}>{error}</Text> : null}
      {section === "dashboard" && <Dashboard L={L} store={store} stats={stats} orders={orders} products={products} go={setSection} wide={wide} />}
      {section === "products" && <Products L={L} products={products} disabled={suspended} reload={load} flash={flash} wide={wide} />}
      {section === "orders" && <Orders L={L} orders={orders} reload={load} flash={flash} />}
      {section === "store" && <StoreDesign L={L} store={store} disabled={suspended} onSaved={(s) => { setStore(s); flash(L("Store saved", "সংরক্ষিত হয়েছে")); }} wide={wide} />}
      {section === "account" && <Account L={L} userName={user?.name || ""} email={user?.email || ""} store={store} onLogout={logout} />}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[st.fill, { backgroundColor: wide ? S.sidebar : S.surface }]} edges={["top", "bottom"]}>
      <View style={[st.fill, { flexDirection: wide ? "row" : "column", backgroundColor: S.bg }]}>
        {wide ? (
          <View style={st.sidebar} testID="seller-sidebar">
            <View style={st.brandRow}>
              <View style={st.brandMark}><Feather name="briefcase" size={16} color="#fff" /></View>
              <View>
                <Text style={st.brand}>Seller Hub</Text>
                <Text style={st.brandSub} numberOfLines={1}>{store.name}</Text>
              </View>
            </View>
            {NAV.map((n) => (
              <Pressable key={n.id} testID={`seller-nav-${n.id}`} onPress={() => setSection(n.id)} style={[st.sideItem, section === n.id && st.sideItemActive]}>
                <AppIcon name={n.icon} size={17} color={section === n.id ? "#fff" : S.sidebarText} />
                <Text style={[st.sideLabel, section === n.id && { color: "#fff" }]}>{n.label}</Text>
                {n.badge ? <View style={st.badge}><Text style={st.badgeText}>{n.badge}</Text></View> : null}
              </Pressable>
            ))}
            {canBack ? (
              <Pressable testID="seller-back" onPress={goBack} style={[st.sideItem, { marginTop: "auto" }]}>
                <Feather name="arrow-left" size={17} color={S.sidebarText} />
                <Text style={st.sideLabel}>{L("Back to Farmers", "ফার্মার্সে ফিরুন")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={st.topbar}>
            {canBack ? (
              <Pressable testID="seller-back" onPress={goBack} hitSlop={10} accessibilityLabel={L("Back to Farmers", "ফার্মার্সে ফিরুন")}>
                <Feather name="arrow-left" size={20} color={S.text} />
              </Pressable>
            ) : null}
            <View style={st.brandMarkSm}><Feather name="briefcase" size={14} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.topTitle}>{NAV.find((n) => n.id === section)?.label}</Text>
              <Text style={st.topSub} numberOfLines={1}>Seller Hub · {store.name}</Text>
            </View>
            <Pressable onPress={() => { setRefreshing(true); load(); }} hitSlop={10} testID="seller-refresh">
              <Feather name="refresh-cw" size={18} color={S.muted} />
            </Pressable>
          </View>
        )}
        <View style={st.fill}>
          {body}
          {notice ? <View style={st.toast}><Feather name="check-circle" size={16} color="#fff" /><Text style={st.toastText}>{notice}</Text></View> : null}
        </View>
        {!wide ? (
          <View style={st.tabbar}>
            {NAV.map((n) => (
              <Pressable key={n.id} testID={`seller-nav-${n.id}`} onPress={() => setSection(n.id)} style={st.tabItem}>
                <View>
                  <AppIcon name={n.icon} size={20} color={section === n.id ? S.primary : S.faint} />
                  {n.badge ? <View style={st.tabBadge}><Text style={st.badgeText}>{n.badge}</Text></View> : null}
                </View>
                <Text style={[st.tabLabel, section === n.id && { color: S.primary }]} numberOfLines={1}>{n.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ---------------- small UI parts ----------------
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[st.card, style]}>{children}</View>;
}
function H({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={st.hRow}>
      <Text style={st.h}>{children}</Text>
      {right}
    </View>
  );
}
function Btn({ label, icon, onPress, kind = "primary", disabled, testID, small }: { label: string; icon?: keyof typeof Feather.glyphMap; onPress: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; testID?: string; small?: boolean }) {
  const bg = kind === "primary" ? S.primary : kind === "danger" ? S.dangerSoft : S.surface;
  const fg = kind === "primary" ? "#fff" : kind === "danger" ? S.danger : S.text;
  return (
    <Pressable testID={testID} disabled={disabled} onPress={onPress} style={[st.btn, small && st.btnSm, { backgroundColor: bg, borderColor: kind === "ghost" ? S.border : bg, opacity: disabled ? 0.5 : 1 }]}>
      {icon ? <AppIcon name={icon} size={small ? 14 : 16} color={fg} /> : null}
      <Text style={[st.btnText, small && { fontSize: 13 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}
function Field({ label, value, onChange, placeholder, multiline, keyboard, testID }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboard?: "numeric" | "phone-pad" | "default"; testID?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={S.faint}
        multiline={multiline}
        keyboardType={keyboard || "default"}
        style={[st.input, multiline && { minHeight: 84, textAlignVertical: "top" }]}
      />
    </View>
  );
}
function Pill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { fg: S.muted, bg: S.bg };
  return (
    <View style={[st.pill, { backgroundColor: c.bg }]}>
      <Text style={[st.pillText, { color: c.fg }]}>{status}</Text>
    </View>
  );
}
async function pickImage(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const dataUrl = a.uri.startsWith("data:") ? a.uri : `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`;
  return mediaUrl(await uploadImage(dataUrl));
}
function ImageField({ label, value, onChange, L, testID, disabled }: { label: string; value: string; onChange: (v: string) => void; L: any; testID?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={st.label}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={st.thumbBox}>
          {value ? <Image source={{ uri: value }} style={st.thumbImg} /> : <Feather name="image" size={18} color={S.faint} />}
        </View>
        <Btn small kind="ghost" icon="upload" testID={testID} disabled={busy || disabled} label={busy ? L("Uploading…", "আপলোড হচ্ছে…") : L("Upload photo", "ছবি আপলোড")}
          onPress={async () => {
            try { setBusy(true); setErr(null); const u = await pickImage(); if (u) onChange(u); } catch (e: any) { setErr(e?.message || "Upload failed"); } finally { setBusy(false); }
          }} />
        {value ? <Btn small kind="ghost" icon="x" label={L("Remove", "সরান")} onPress={() => onChange("")} disabled={disabled} /> : null}
      </View>
      {err ? <Text style={st.errorText}>{err}</Text> : null}
    </View>
  );
}

// Categories come from the server, so admin changes (rename, add, hide, reorder) show here too.
function CategoryChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cats = useMarketCategories();
  const { language } = useI18n();
  const bn = language === "bn";
  const list = cats.some((c) => c.slug === value) || !value ? cats : [...cats, { slug: value, nameEn: value, nameBn: value, icon: "grid", color: "#64748B" }];
  return (
    <>
      {list.map((c) => (
        <Pressable key={c.slug} testID={`seller-cat-${c.slug}`} onPress={() => onChange(c.slug)} style={[st.chip, value === c.slug && st.chipOn]}>
          <Text style={[st.chipText, value === c.slug && { color: S.primary }]}>{bn ? c.nameBn : c.nameEn}</Text>
        </Pressable>
      ))}
    </>
  );
}

// ---------------- create store (seller sign-up) ----------------
function CreateStore({ L, onCreated, error, userName, onLogout, onBack }: { L: any; onCreated: () => void; error: string | null; userName: string; onLogout: () => void; onBack?: () => void }) {
  const [f, setF] = useState({ name: "", category: "vegetables", location: "", phone: "", tagline: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(error);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <SafeAreaView style={[st.fill, { backgroundColor: S.bg }]}>
      <ScrollView contentContainerStyle={[st.content, { maxWidth: 560, width: "100%", alignSelf: "center" }]}>
        <View style={[st.brandRow, { marginBottom: 20 }]}>
          {onBack ? (
            <Pressable testID="seller-back" onPress={onBack} hitSlop={10} accessibilityLabel={L("Back to Farmers", "ফার্মার্সে ফিরুন")} style={{ marginRight: 4 }}>
              <Feather name="arrow-left" size={20} color={S.text} />
            </Pressable>
          ) : null}
          <View style={st.brandMark}><Feather name="briefcase" size={16} color="#fff" /></View>
          <Text style={[st.brand, { color: S.text }]}>Seller Hub</Text>
        </View>
        <Text style={st.title}>{L("Open your seller account", "বিক্রেতা অ্যাকাউন্ট খুলুন")}</Text>
        <Text style={st.subtitle}>
          {L(`Hi ${userName || "there"}, set up your store to start selling to Farmers buyers. You can change everything later.`, "আপনার দোকান তৈরি করুন এবং বিক্রি শুরু করুন। পরে সব বদলাতে পারবেন।")}
        </Text>
        <Card>
          <Field testID="store-name" label={L("Store name", "দোকানের নাম")} value={f.name} onChange={set("name")} placeholder="Green Valley Farm" />
          <Field label={L("Short tagline", "ট্যাগলাইন")} value={f.tagline} onChange={set("tagline")} placeholder={L("Fresh vegetables from Gazipur", "গাজীপুরের তাজা সবজি")} />
          <Text style={st.label}>{L("What do you sell?", "কী বিক্রি করেন?")}</Text>
          <View style={st.chips}>
            <CategoryChips value={f.category} onChange={set("category")} />
          </View>
          <Field label={L("Location", "অবস্থান")} value={f.location} onChange={set("location")} placeholder="Gazipur, Dhaka" />
          <Field label={L("Business phone", "ব্যবসার ফোন")} value={f.phone} onChange={set("phone")} keyboard="phone-pad" placeholder="01XXXXXXXXX" />
          {err ? <Text style={st.errorText}>{err}</Text> : null}
          <Btn testID="create-store" label={busy ? L("Creating…", "তৈরি হচ্ছে…") : L("Create store", "দোকান তৈরি করুন")} icon="check" disabled={busy || f.name.trim().length < 2}
            onPress={async () => {
              try { setBusy(true); setErr(null); await apiPost("/api/seller/register", f); onCreated(); } catch (e: any) { setErr(e?.message); } finally { setBusy(false); }
            }} />
        </Card>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          {Platform.OS === "web" ? <Btn kind="ghost" icon="arrow-left" label={L("Back to Farmers", "ফার্মার্সে ফিরুন")} onPress={() => openVariantOnWeb("main")} /> : null}
          <Btn kind="ghost" icon="log-out" label={L("Log out", "লগ আউট")} onPress={onLogout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------- dashboard ----------------
function Dashboard({ L, store, stats, orders, products, go, wide }: { L: any; store: Store; stats: Stats | null; orders: Order[]; products: Product[]; go: (s: Section) => void; wide: boolean }) {
  const kpis = [
    { label: L("Revenue", "আয়"), value: taka(stats?.revenue || 0), icon: "trending-up" as const, color: S.success },
    { label: L("Orders", "অর্ডার"), value: String(stats?.orders || 0), icon: "shopping-bag" as const, color: S.primary },
    { label: L("To confirm", "নিশ্চিত করতে হবে"), value: String(stats?.byStatus?.pending || 0), icon: "clock" as const, color: S.warning },
    { label: L("Products", "পণ্য"), value: String(stats?.products || 0), icon: "package" as const, color: "#7C3AED" },
    { label: L("Out of stock", "স্টক শেষ"), value: String(stats?.outOfStock || 0), icon: "alert-triangle" as const, color: S.danger },
  ];
  return (
    <View>
      <Text style={st.title}>{L("Welcome back", "স্বাগতম")}</Text>
      <Text style={st.subtitle}>{store.name} · {store.status === "active" ? L("Store is live", "দোকান চালু") : L("Suspended", "স্থগিত")}</Text>
      <View style={st.kpiGrid}>
        {kpis.map((k) => (
          <View key={k.label} style={[st.kpi, { flexBasis: wide ? "18%" : "46%" }]}>
            <View style={[st.kpiIcon, { backgroundColor: k.color + "14" }]}><AppIcon name={k.icon} size={16} color={k.color} /></View>
            <Text style={st.kpiValue}>{k.value}</Text>
            <Text style={st.kpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>
      <Card>
        <H right={<Pressable onPress={() => go("orders")}><Text style={st.link}>{L("View all", "সব দেখুন")}</Text></Pressable>}>{L("Recent orders", "সাম্প্রতিক অর্ডার")}</H>
        {orders.length === 0 ? <Text style={st.empty}>{L("No orders yet. They show up here when buyers order your products.", "এখনো কোনো অর্ডার নেই।")}</Text> : null}
        {orders.slice(0, 5).map((o) => (
          <View key={o.id} style={st.row}>
            <View style={{ flex: 1 }}>
              <Text style={st.rowTitle}>{o.id}</Text>
              <Text style={st.rowSub}>{o.itemCount} {L("items", "পণ্য")} · {new Date(o.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={st.rowMoney}>{taka(o.total)}</Text>
            <Pill status={o.status} />
          </View>
        ))}
      </Card>
      <Card>
        <H right={<Pressable onPress={() => go("products")}><Text style={st.link}>{L("Manage", "পরিচালনা")}</Text></Pressable>}>{L("Low stock", "কম স্টক")}</H>
        {products.filter((p) => (p.quantity ?? 0) <= 10).slice(0, 5).map((p) => (
          <View key={p.id} style={st.row}>
            <Text style={[st.rowTitle, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
            <Text style={[st.rowSub, { color: (p.quantity ?? 0) <= 0 ? S.danger : S.warning }]}>{p.quantity ?? 0} {p.unit || ""}</Text>
          </View>
        ))}
        {products.filter((p) => (p.quantity ?? 0) <= 10).length === 0 ? <Text style={st.empty}>{L("All products have enough stock.", "সব পণ্যের যথেষ্ট স্টক আছে।")}</Text> : null}
      </Card>
    </View>
  );
}

// ---------------- products ----------------
const emptyProduct = { name: "", price: "", unit: "kg", quantity: "", minOrder: "1", category: "vegetables", description: "", image: "" };
function Products({ L, products, disabled, reload, flash, wide }: { L: any; products: Product[]; disabled: boolean; reload: () => Promise<void>; flash: (m: string) => void; wide: boolean }) {
  const cats = useMarketCategories();
  const isBnLang = useI18n().language === "bn";
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [q, setQ] = useState("");
  const list = products.filter((p) => p.name?.toLowerCase().includes(q.toLowerCase()));
  return (
    <View>
      <H right={<Btn testID="add-product" small icon="plus" label={L("Add product", "পণ্য যোগ")} onPress={() => setEditing("new")} disabled={disabled} />}>{L("Products", "পণ্য")} ({products.length})</H>
      <View style={st.search}>
        <Feather name="search" size={16} color={S.faint} />
        <TextInput value={q} onChangeText={setQ} placeholder={L("Search products", "পণ্য খুঁজুন")} placeholderTextColor={S.faint} style={st.searchInput} />
      </View>
      <Card style={{ padding: 0 }}>
        {wide ? (
          <View style={[st.tr, st.thead]}>
            <Text style={[st.th, { flex: 3 }]}>{L("Product", "পণ্য")}</Text>
            <Text style={[st.th, { flex: 1 }]}>{L("Price", "দাম")}</Text>
            <Text style={[st.th, { flex: 1 }]}>{L("Stock", "স্টক")}</Text>
            <Text style={[st.th, { flex: 1 }]}>{L("Status", "অবস্থা")}</Text>
            <Text style={[st.th, { width: 90 }]} />
          </View>
        ) : null}
        {list.length === 0 ? <Text style={[st.empty, { padding: 16 }]}>{L("No products yet. Add your first one.", "এখনো কোনো পণ্য নেই।")}</Text> : null}
        {list.map((p) => (
          <View key={p.id} style={st.tr} testID={`product-row-${p.id}`}>
            <View style={{ flex: 3, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={st.thumbBox}>{p.image ? <Image source={{ uri: mediaUrl(p.image) || p.image }} style={st.thumbImg} /> : <Feather name="package" size={16} color={S.faint} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={st.rowTitle} numberOfLines={1}>{p.name}</Text>
                <Text style={st.rowSub} numberOfLines={1}>{categoryLabel(cats, p.category, isBnLang)}{!wide ? ` · ${taka(p.price)}/${p.unit || ""} · ${p.quantity ?? 0} ${L("in stock", "স্টকে")}` : ""}</Text>
              </View>
            </View>
            {wide ? <Text style={[st.td, { flex: 1 }]}>{taka(p.price)}/{p.unit}</Text> : null}
            {wide ? <Text style={[st.td, { flex: 1, color: (p.quantity ?? 0) <= 0 ? S.danger : S.text }]}>{p.quantity ?? 0}</Text> : null}
            {wide ? (
              <View style={{ flex: 1 }}>
                <Text style={[st.pillText, { color: p.hidden ? S.danger : p.active === false ? S.muted : S.success }]}>
                  {p.hidden ? L("Hidden by admin", "অ্যাডমিন লুকিয়েছেন") : p.active === false ? L("Draft", "খসড়া") : L("Live", "চালু")}
                </Text>
              </View>
            ) : null}
            <View style={{ width: 90, flexDirection: "row", justifyContent: "flex-end", gap: 14 }}>
              <Pressable hitSlop={8} onPress={() => setEditing(p)} disabled={disabled} testID={`edit-${p.id}`}><Feather name="edit-2" size={17} color={disabled ? S.faint : S.primary} /></Pressable>
              <Pressable hitSlop={8} disabled={disabled} testID={`delete-${p.id}`}
                onPress={async () => { try { await apiDelete(`/api/seller/products/${p.id}`); flash(L("Product deleted", "পণ্য মুছে ফেলা হয়েছে")); reload(); } catch (e: any) { flash(e?.message); } }}>
                <Feather name="trash-2" size={17} color={disabled ? S.faint : S.danger} />
              </Pressable>
            </View>
          </View>
        ))}
      </Card>
      {editing ? <ProductForm L={L} product={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); flash(L("Product saved", "পণ্য সংরক্ষিত")); reload(); }} /> : null}
    </View>
  );
}

function ProductForm({ L, product, onClose, onSaved }: { L: any; product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(() => (product ? { name: product.name || "", price: String(product.price ?? ""), unit: product.unit || "kg", quantity: String(product.quantity ?? ""), minOrder: String(product.minOrder ?? 1), category: product.category || "other", description: product.description || "", image: product.image || "" } : emptyProduct));
  const [opts, setOpts] = useState<OptionDraft[]>(() => optionsToDraft(product?.options));
  const [active, setActive] = useState(product?.active !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof emptyProduct) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    try {
      setBusy(true);
      setErr(null);
      const body = { ...f, price: Number(f.price), quantity: Number(f.quantity || 0), minOrder: Math.max(1, Number(f.minOrder || 1)), options: draftToOptions(opts), active };
      if (product) await apiPut(`/api/seller/products/${product.id}`, body);
      else await apiPost("/api/seller/products", body);
      onSaved();
    } catch (e: any) {
      setErr(e?.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={st.modalBack}>
        <View style={st.modal}>
          <H right={<Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={20} color={S.muted} /></Pressable>}>{product ? L("Edit product", "পণ্য সম্পাদনা") : L("New product", "নতুন পণ্য")}</H>
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            <Field testID="product-name" label={L("Name", "নাম")} value={f.name} onChange={set("name")} placeholder={L("Organic tomatoes", "জৈব টমেটো")} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field testID="product-price" label={L("Price (৳)", "দাম (৳)")} value={f.price} onChange={set("price")} keyboard="numeric" placeholder="80" /></View>
              <View style={{ flex: 1 }}><Field label={L("Unit", "একক")} value={f.unit} onChange={set("unit")} placeholder="kg" /></View>
              <View style={{ flex: 1 }}><Field testID="product-qty" label={L("Stock", "স্টক")} value={f.quantity} onChange={set("quantity")} keyboard="numeric" placeholder="100" /></View>
            </View>
            <Field testID="product-min-order" label={L("Minimum order", "সর্বনিম্ন অর্ডার")} value={f.minOrder} onChange={set("minOrder")} keyboard="numeric" placeholder="1" />
            <Text style={st.label}>{L("Options buyers choose (size, weight, grade…)", "ক্রেতার পছন্দের অপশন (সাইজ, ওজন, গ্রেড…)")}</Text>
            <Text style={st.rowSub}>{L("Separate choices with commas. Add +amount for a choice that costs more per unit, e.g. 1 kg, 5 kg +350", "কমা দিয়ে আলাদা করুন। বেশি দামের জন্য +টাকা লিখুন, যেমন 1 kg, 5 kg +350")}</Text>
            {opts.map((g, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}><Field testID={`option-name-${i}`} label={L("Option", "অপশন")} value={g.name} onChange={(v) => setOpts((o) => o.map((x, j) => (j === i ? { ...x, name: v } : x)))} placeholder={L("Weight", "ওজন")} /></View>
                <View style={{ flex: 2 }}><Field testID={`option-choices-${i}`} label={L("Choices", "পছন্দ")} value={g.choices} onChange={(v) => setOpts((o) => o.map((x, j) => (j === i ? { ...x, choices: v } : x)))} placeholder="1 kg, 5 kg +350" /></View>
                <Pressable onPress={() => setOpts((o) => o.filter((_, j) => j !== i))} hitSlop={8} style={{ paddingBottom: 14 }} testID={`option-remove-${i}`}><Feather name="trash-2" size={18} color={S.danger} /></Pressable>
              </View>
            ))}
            {opts.length < 5 ? <View style={{ alignItems: "flex-start", marginTop: 6 }}><Btn small kind="ghost" icon="plus" testID="add-option" label={L("Add option", "অপশন যোগ করুন")} onPress={() => setOpts((o) => [...o, { name: "", choices: "" }])} /></View> : null}
            <Text style={st.label}>{L("Category", "ক্যাটাগরি")}</Text>
            <View style={st.chips}>
              <CategoryChips value={f.category} onChange={set("category")} />
            </View>
            <ImageField L={L} label={L("Photo", "ছবি")} value={f.image} onChange={set("image")} />
            <Field label={L("Description", "বিবরণ")} value={f.description} onChange={set("description")} multiline />
            <View style={[st.row, { borderBottomWidth: 0 }]}>
              <Text style={[st.rowTitle, { flex: 1 }]}>{L("Visible to buyers", "ক্রেতারা দেখতে পাবে")}</Text>
              <Switch value={active} onValueChange={setActive} />
            </View>
            {err ? <Text style={st.errorText}>{err}</Text> : null}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn kind="ghost" label={L("Cancel", "বাতিল")} onPress={onClose} />
            <Btn testID="save-product" icon="check" label={busy ? L("Saving…", "সংরক্ষণ হচ্ছে…") : L("Save", "সংরক্ষণ")} onPress={save} disabled={busy || !f.name.trim() || !(Number(f.price) > 0)} />
          </View>
        </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------- orders ----------------
function Orders({ L, orders, reload, flash }: { L: any; orders: Order[]; reload: () => Promise<void>; flash: (m: string) => void }) {
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const statuses = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  const list = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const ACTION: Record<string, string> = {
    confirmed: L("Confirm", "নিশ্চিত"), processing: L("Start packing", "প্যাকিং শুরু"), shipped: L("Mark shipped", "পাঠানো হয়েছে"),
    delivered: L("Mark delivered", "পৌঁছে গেছে"), cancelled: L("Cancel", "বাতিল"),
  };
  return (
    <View>
      <H>{L("Orders", "অর্ডার")} ({orders.length})</H>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {statuses.map((s) => (
          <Pressable key={s} onPress={() => setFilter(s)} style={[st.chip, filter === s && st.chipOn]} testID={`order-filter-${s}`}>
            <Text style={[st.chipText, filter === s && { color: S.primary }]}>
              {s === "all" ? L("All", "সব") : s} {s === "all" ? orders.length : orders.filter((o) => o.status === s).length}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {list.length === 0 ? <Card><Text style={st.empty}>{L("No orders here.", "এখানে কোনো অর্ডার নেই।")}</Text></Card> : null}
      {list.map((o) => {
        const a = o.shippingAddress || {};
        return (
          <Card key={o.id}>
            <View style={st.hRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.rowTitle}>{o.id}</Text>
                <Text style={st.rowSub}>{new Date(o.createdAt).toLocaleString()} · {(o.paymentMethod || "").toUpperCase()}</Text>
              </View>
              <Pill status={o.status} />
            </View>
            {(o.items || []).map((it, i) => (
              <View key={i} style={st.itemLine}>
                <Text style={[st.td, { flex: 1 }]} numberOfLines={2}>{it.name || "Item"}{it.options ? ` (${Object.entries(it.options).map(([k, v]) => `${k}: ${v}`).join(", ")})` : ""} × {it.quantity || 1}</Text>
                <Text style={st.td}>{taka((it.price || 0) * (it.quantity || 1))}</Text>
              </View>
            ))}
            <View style={[st.itemLine, { borderTopWidth: 1, borderTopColor: S.border, marginTop: 6, paddingTop: 8 }]}>
              <Text style={[st.rowTitle, { flex: 1 }]}>{L("Total", "মোট")}</Text>
              <Text style={st.rowMoney}>{taka(o.total)}</Text>
            </View>
            {o.checkout?.contactPhone ? (
              <View style={{ marginTop: 8 }} testID={`seller-order-contact-${o.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={st.rowSub}><Feather name="user" size={12} color={S.muted} /> {o.checkout.contactName} · {o.checkout.contactPhone}{o.checkout.altPhone ? ` / ${o.checkout.altPhone}` : ""}</Text>
                  <Pressable testID={`call-buyer-${o.id}`} onPress={() => Linking.openURL(`tel:${o.checkout?.contactPhone}`)} hitSlop={6}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: S.primary + "14" }}>
                    <Feather name="phone-call" size={12} color={S.primary} />
                    <Text style={{ color: S.primary, fontSize: 12, fontWeight: "600" }}>{L("Call buyer", "ক্রেতাকে কল")}</Text>
                  </Pressable>
                </View>
                <Text style={st.rowSub}>
                  <Feather name="truck" size={12} color={S.muted} />{" "}
                  {o.checkout.deliveryMethod === "pickup" ? L("Buyer picks up", "ক্রেতা সংগ্রহ করবেন") : o.checkout.zone === "inside_dhaka" ? L("Inside Dhaka", "ঢাকার ভিতরে") : L("Outside Dhaka", "ঢাকার বাইরে")}
                  {o.checkout.deliveryMethod === "express" ? ` · ${L("Express", "এক্সপ্রেস")}` : ""}
                  {o.checkout.address ? ` · ${[o.checkout.address, o.checkout.district].filter(Boolean).join(", ")}` : ""}
                  {o.checkout.deliveryDate ? ` · ${o.checkout.deliveryDate} ${o.checkout.timeSlot || ""}` : ""}
                </Text>
                {o.checkout.notes ? <Text style={st.rowSub}>{L("Note", "নোট")}: {o.checkout.notes}</Text> : null}
              </View>
            ) : null}
            {!o.checkout?.contactPhone && a && (a.address || a.city) ? (
              <Text style={[st.rowSub, { marginTop: 6 }]}>
                <Feather name="map-pin" size={12} color={S.muted} /> {a.fullName || a.name || ""} · {[a.address, a.city].filter(Boolean).join(", ")} {a.phone ? `· ${a.phone}` : ""}
              </Text>
            ) : null}
            {(NEXT_STATUS[o.status] || []).length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {(NEXT_STATUS[o.status] || []).map((n) => (
                  <Btn key={n} small testID={`order-${o.id}-${n}`} kind={n === "cancelled" ? "danger" : n === NEXT_STATUS[o.status][0] ? "primary" : "ghost"} label={ACTION[n] || n} disabled={busy === o.id}
                    onPress={async () => {
                      try { setBusy(o.id); await apiPut(`/api/orders/${o.id}/status`, { status: n }); flash(`${o.id}: ${n}`); await reload(); } catch (e: any) { flash(e?.message); } finally { setBusy(null); }
                    }} />
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

// ---------------- store design ----------------
function StoreDesign({ L, store, disabled, onSaved, wide }: { L: any; store: Store; disabled: boolean; onSaved: (s: Store) => void; wide: boolean }) {
  const [f, setF] = useState({ name: store.name, tagline: store.tagline, description: store.description, logo: store.logo, banner: store.banner, themeColor: store.themeColor, phone: store.phone, location: store.location });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const preview = (
    <View style={st.preview} testID="store-preview">
      <View style={[st.previewBanner, { backgroundColor: f.themeColor }]}>
        {f.banner ? <Image source={{ uri: f.banner }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      </View>
      <View style={{ padding: 14 }}>
        <View style={[st.previewLogo, { borderColor: f.themeColor }]}>
          {f.logo ? <Image source={{ uri: f.logo }} style={{ width: "100%", height: "100%" }} /> : <Text style={{ fontWeight: "700", color: f.themeColor, fontSize: 18 }}>{(f.name || "S").slice(0, 1).toUpperCase()}</Text>}
        </View>
        <Text style={[st.title, { fontSize: 18, marginTop: 6 }]}>{f.name || L("Store name", "দোকানের নাম")}</Text>
        {f.tagline ? <Text style={st.rowSub}>{f.tagline}</Text> : null}
        {f.location ? <Text style={[st.rowSub, { marginTop: 4 }]}><Feather name="map-pin" size={11} /> {f.location}</Text> : null}
        <View style={[st.previewBtn, { backgroundColor: f.themeColor }]}><Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{L("Follow store", "ফলো করুন")}</Text></View>
      </View>
    </View>
  );
  return (
    <View>
      <H>{L("Store design", "দোকানের ডিজাইন")}</H>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 16, alignItems: "flex-start" }}>
        <Card style={{ flex: wide ? 3 : undefined, width: wide ? undefined : "100%" }}>
          <Field testID="design-name" label={L("Store name", "দোকানের নাম")} value={f.name} onChange={set("name")} />
          <Field testID="design-tagline" label={L("Tagline", "ট্যাগলাইন")} value={f.tagline} onChange={set("tagline")} />
          <Field label={L("About the store", "দোকান সম্পর্কে")} value={f.description} onChange={set("description")} multiline />
          <Text style={st.label}>{L("Brand color", "ব্র্যান্ড রং")}</Text>
          <View style={[st.chips, { marginBottom: 14 }]}>
            {THEME_SWATCHES.map((c) => (
              <Pressable key={c} testID={`swatch-${c}`} onPress={() => set("themeColor")(c)} style={[st.swatch, { backgroundColor: c }, f.themeColor === c && st.swatchOn]}>
                {f.themeColor === c ? <Feather name="check" size={14} color="#fff" /> : null}
              </Pressable>
            ))}
          </View>
          <ImageField L={L} label={L("Logo", "লোগো")} value={f.logo} onChange={set("logo")} disabled={disabled} />
          <ImageField L={L} label={L("Cover banner", "কভার ব্যানার")} value={f.banner} onChange={set("banner")} disabled={disabled} />
          <Field label={L("Business phone", "ব্যবসার ফোন")} value={f.phone} onChange={set("phone")} keyboard="phone-pad" />
          <Field label={L("Location", "অবস্থান")} value={f.location} onChange={set("location")} />
          {err ? <Text style={st.errorText}>{err}</Text> : null}
          <Btn testID="save-store" icon="check" label={busy ? L("Saving…", "সংরক্ষণ হচ্ছে…") : L("Save store", "সংরক্ষণ")} disabled={busy || disabled}
            onPress={async () => {
              try { setBusy(true); setErr(null); const r = await apiPut<{ store: Store }>("/api/seller/store", f); onSaved(r.store); } catch (e: any) { setErr(e?.message); } finally { setBusy(false); }
            }} />
        </Card>
        <View style={{ flex: wide ? 2 : undefined, width: wide ? undefined : "100%" }}>
          <Text style={[st.label, { marginBottom: 8 }]}>{L("How buyers see your store", "ক্রেতারা যেভাবে দেখবে")}</Text>
          {preview}
        </View>
      </View>
    </View>
  );
}

// ---------------- account ----------------
function Account({ L, userName, email, store, onLogout }: { L: any; userName: string; email: string; store: Store; onLogout: () => void }) {
  return (
    <View>
      <H>{L("Account", "অ্যাকাউন্ট")}</H>
      <Card>
        <View style={st.row}><Text style={[st.rowSub, { flex: 1 }]}>{L("Name", "নাম")}</Text><Text style={st.rowTitle}>{userName}</Text></View>
        <View style={st.row}><Text style={[st.rowSub, { flex: 1 }]}>{L("Email", "ইমেইল")}</Text><Text style={st.rowTitle}>{email}</Text></View>
        <View style={st.row}><Text style={[st.rowSub, { flex: 1 }]}>{L("Store link", "দোকানের লিংক")}</Text><Text style={st.rowTitle} selectable>/api/stores/{store.slug}</Text></View>
        <View style={[st.row, { borderBottomWidth: 0 }]}><Text style={[st.rowSub, { flex: 1 }]}>{L("Status", "অবস্থা")}</Text><Text style={[st.rowTitle, { color: store.status === "active" ? S.success : S.danger }]}>{store.status}</Text></View>
      </Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {Platform.OS === "web" && getAppVariant() === "seller" ? <Btn kind="ghost" icon="external-link" label={L("Open buyer app", "ক্রেতা অ্যাপ খুলুন")} onPress={() => openVariantOnWeb("main")} /> : null}
        <Btn kind="danger" icon="log-out" label={L("Log out", "লগ আউট")} onPress={onLogout} testID="seller-logout" />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", backgroundColor: S.bg },
  content: { padding: 16, paddingBottom: 40, maxWidth: 1200, width: "100%", alignSelf: "center" },
  sidebar: { width: 230, backgroundColor: S.sidebar, paddingVertical: 20, paddingHorizontal: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, marginBottom: 24 },
  brandMark: { width: 32, height: 32, borderRadius: 8, backgroundColor: S.primary, alignItems: "center", justifyContent: "center" },
  brandMarkSm: { width: 28, height: 28, borderRadius: 7, backgroundColor: S.primary, alignItems: "center", justifyContent: "center" },
  brand: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
  brandSub: { color: S.sidebarText, fontSize: 12, maxWidth: 160 },
  sideItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  sideItemActive: { backgroundColor: S.sidebarActive },
  sideLabel: { color: S.sidebarText, fontSize: 14, fontWeight: "500", flex: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: S.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  topbar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: S.surface, borderBottomWidth: 1, borderBottomColor: S.border },
  topTitle: { fontSize: 17, fontWeight: "700", color: S.text },
  topSub: { fontSize: 12, color: S.muted },
  tabbar: { flexDirection: "row", backgroundColor: S.surface, borderTopWidth: 1, borderTopColor: S.border, paddingTop: 8, paddingBottom: 6 },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11, color: S.faint, fontWeight: "500" },
  tabBadge: { position: "absolute", top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: S.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  title: { fontSize: 22, fontWeight: "700", color: S.text },
  subtitle: { fontSize: 14, color: S.muted, marginTop: 4, marginBottom: 16, lineHeight: 20 },
  card: { backgroundColor: S.surface, borderRadius: S.radius, borderWidth: 1, borderColor: S.border, padding: 16, marginBottom: 16 },
  hRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  h: { fontSize: 16, fontWeight: "700", color: S.text, flexShrink: 1 },
  link: { color: S.primary, fontWeight: "600", fontSize: 13 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  kpi: { flexGrow: 1, backgroundColor: S.surface, borderRadius: S.radius, borderWidth: 1, borderColor: S.border, padding: 14 },
  kpiIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  kpiValue: { fontSize: 20, fontWeight: "700", color: S.text },
  kpiLabel: { fontSize: 12, color: S.muted, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: S.border },
  rowTitle: { fontSize: 14, fontWeight: "600", color: S.text },
  rowSub: { fontSize: 12, color: S.muted, marginTop: 2 },
  rowMoney: { fontSize: 14, fontWeight: "700", color: S.text },
  empty: { color: S.muted, fontSize: 13, paddingVertical: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, borderWidth: 1 },
  btnSm: { paddingHorizontal: 12, paddingVertical: 7 },
  btnText: { fontSize: 14, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: S.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: S.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: S.text, backgroundColor: S.surface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: S.border, backgroundColor: S.surface, marginRight: 6,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
 },
  chipOn: { borderColor: S.primary, backgroundColor: S.primarySoft },
  chipText: { fontSize: 13, color: S.muted, fontWeight: "500", textTransform: "capitalize" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: S.border, borderRadius: 8, paddingHorizontal: 12, backgroundColor: S.surface, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: S.text },
  tr: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: S.border },
  thead: { backgroundColor: "#F8FAFC", paddingVertical: 10 },
  th: { fontSize: 12, fontWeight: "700", color: S.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  td: { fontSize: 14, color: S.text },
  thumbBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: S.bg, borderWidth: 1, borderColor: S.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  itemLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 3 },
  banner: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: S.radius, borderWidth: 1, marginBottom: 16 },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 19 },
  errorText: { color: S.danger, fontSize: 13, marginBottom: 10 },
  toast: { position: "absolute", bottom: 16, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: S.sidebar, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  modalBack: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 560, maxHeight: "100%", backgroundColor: S.surface, borderRadius: 12, padding: 18 },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  swatchOn: { borderWidth: 3, borderColor: "#CBD5E1" },
  preview: { backgroundColor: S.surface, borderRadius: 12, borderWidth: 1, borderColor: S.border, overflow: "hidden" },
  previewBanner: { height: 96, overflow: "hidden" },
  previewLogo: { width: 56, height: 56, borderRadius: 12, borderWidth: 2, backgroundColor: "#fff", marginTop: -40, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewBtn: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginTop: 12 },
});
