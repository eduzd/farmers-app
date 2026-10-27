import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import {
  useAdminNav, useL, useLoader, useDebounced, Page, Card, SectionTitle, Pill, Chip, ChipRow, SearchBox, Btn, Field, KV, Empty, Loading, ErrorBox, Thumb, Stat, ToggleRow,
  taka, STATUS_COLOR, statusLabel, fmtDate, pickAndUpload, confirmAsk, st, ShopSection,
  Text,
} from "./ui";

import { AppIcon } from "@/components/icons/AppIcon";
import { useNavigation } from "@react-navigation/native";
export type Category = { id: string; slug: string; nameEn: string; nameBn: string; icon: string; color: string; sortOrder: number; active: boolean; productCount?: number };

/* ======================= VIEW AS BUYER ======================= */
/**
 * Opens the main app's own product page or shop page, exactly as buyers get it, in preview mode (a bar on top,
 * and buttons that would buy, save, follow, message or call do nothing). Data comes from the admin-only
 * preview routes, so hidden products and suspended shops open too, with a note that buyers can't see them.
 */
export function useBuyerPreview() {
  const navigation = useNavigation<any>();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setError(null);
    try { await fn(); } catch (e: any) { setError(e?.message || "Couldn't open the preview"); } finally { setBusy(null); }
  };
  const openProduct = (id: string) => run(`p-${id}`, async () => {
    const r: any = await apiGet(`/api/admin/manage/preview/products/${encodeURIComponent(id)}`);
    navigation.navigate("ProductDetail", { product: r.product, preview: { kind: "product", reasons: r.reasons || [] } });
  });
  const openStore = (id: string) => run(`s-${id}`, async () => {
    navigation.navigate("ShopPage", { slug: id, preview: { kind: "shop" } });
  });
  return { openProduct, openStore, busy, error };
}

/** Products and shops made in this session: their page opens with a "see it as buyers do" prompt. */
import { justCreatedProducts as justCreated } from "./productForm";

function PreviewIconBtn({ testID, onPress, busy, label }: { testID: string; onPress: () => void; busy?: boolean; label: string }) {
  const { theme } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? theme.primary + "2A" : theme.primary + "14", opacity: busy ? 0.6 : 1 })}>
      <Feather name="eye" size={17} color={theme.primary} />
    </Pressable>
  );
}

function JustCreatedCard({ text, label, onPress, busy, testID }: { text: string; label: string; onPress: () => void; busy?: boolean; testID: string }) {
  const { theme } = useTheme();
  return (
    <Card testID={testID} style={{ backgroundColor: theme.primary + "12", borderWidth: 1, borderColor: theme.primary + "40" }}>
      <View style={st.row}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}>
          <Feather name="check" size={18} color="#fff" />
        </View>
        <Text style={{ color: theme.text, fontWeight: "700", flex: 1, fontSize: 14 }}>{text}</Text>
      </View>
      <Btn testID={`${testID}-view`} icon="eye" label={label} busy={busy} onPress={onPress} style={{ marginTop: 12 }} />
    </Card>
  );
}

export function useCategories() {
  return useLoader<Category[]>(() => apiGet("/api/admin/manage/categories"), []);
}
function catName(cats: Category[] | null, slug: string, L: ReturnType<typeof useL>) {
  const c = cats?.find((x) => x.slug === slug);
  return c ? L(c.nameEn, c.nameBn) : slug;
}

/* ======================= SHOP TAB ======================= */
export function ShopTab({ section, setSection }: { section: ShopSection; setSection: (s: ShopSection) => void }) {
  const { theme } = useTheme();
  const L = useL();
  const tabs: [ShopSection, string, keyof typeof Feather.glyphMap][] = [
    ["products", L("Products", "পণ্য"), "package"],
    ["shops", L("Shops", "দোকান"), "briefcase"],
    ["categories", L("Categories", "ক্যাটাগরি"), "grid"],
  ];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", padding: 4, margin: 14, marginBottom: 0, borderRadius: 12, backgroundColor: theme.backgroundSecondary, maxWidth: 872, width: "100%", alignSelf: "center" }}>
        {tabs.map(([k, label, icon]) => (
          <Pressable key={k} testID={`shop-section-${k}`} onPress={() => setSection(k)}
            style={{ flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 38, borderRadius: 9, backgroundColor: section === k ? theme.card : "transparent" }}>
            <AppIcon name={icon} size={14} color={section === k ? theme.primary : theme.textSecondary} />
            <Text style={{ fontWeight: "700", fontSize: 13, color: section === k ? theme.primary : theme.textSecondary }} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {section === "products" ? <ProductsList /> : section === "shops" ? <ShopsList /> : <CategoriesList />}
    </View>
  );
}

function ProductRow({ p, cats, onPress, onPreview, previewBusy }: { p: any; cats: Category[] | null; onPress: () => void; onPreview?: () => void; previewBusy?: boolean }) {
  const { theme } = useTheme();
  const L = useL();
  return (
    <Card onPress={onPress} testID={`product-${p.id}`}>
      <View style={st.row}>
        <Thumb uri={p.image} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14.5 }} numberOfLines={1}>{p.name}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
            {p.storeName || p.ownerName || L("No shop", "দোকান নেই")} · {catName(cats, p.category, L)}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ color: theme.text, fontWeight: "800", fontSize: 13 }}>{taka(p.price)}/{p.unit || "kg"}</Text>
            <Pill label={p.quantity > 0 ? `${L("Stock", "স্টক")} ${p.quantity}` : L("Out of stock", "স্টক শেষ")} color={p.quantity > 0 ? "#00875A" : "#DA2F2F"} />
            {p.hidden ? <Pill label={L("Hidden", "লুকানো")} color="#B25E09" /> : null}
            {p.orders ? <Pill label={`${p.orders} ${L("orders", "অর্ডার")}`} color="#3D38D0" /> : null}
          </View>
        </View>
        {onPreview ? <PreviewIconBtn testID={`product-preview-${p.id}`} onPress={onPreview} busy={previewBusy} label={L("View as buyer", "ক্রেতার চোখে দেখুন")} /> : null}
        <Feather name="chevron-right" size={18} color={theme.textTertiary} />
      </View>
    </Card>
  );
}

function ProductsList() {
  const nav = useAdminNav();
  const L = useL();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const dq = useDebounced(q);
  const cats = useCategories();
  const pv = useBuyerPreview();
  const list = useLoader<any[]>(
    () => apiGet(`/api/admin/manage/products?q=${encodeURIComponent(dq)}&category=${encodeURIComponent(cat)}&status=${status}`),
    [dq, cat, status],
  );
  return (
    <Page onRefresh={list.load} refreshing={false} testID="admin-products">
      <View style={[st.row, { marginBottom: 10 }]}>
        <View style={{ flex: 1 }}>
          <SearchBox testID="product-search" value={q} onChange={setQ} placeholder={L("Search products, shops, sellers", "পণ্য, দোকান, বিক্রেতা খুঁজুন")} />
        </View>
        <Btn testID="add-product" icon="plus" label={L("Add", "যোগ")} onPress={() => nav.push({ name: "productForm" })} style={{ marginBottom: 10 }} />
      </View>
      <ChipRow>
        {[["", L("All", "সব")], ["visible", L("Visible", "দেখা যাচ্ছে")], ["hidden", L("Hidden", "লুকানো")], ["out", L("Out of stock", "স্টক শেষ")]].map(([k, label]) => (
          <Chip key={k || "all"} testID={`product-status-${k || "all"}`} label={label} on={status === k} onPress={() => setStatus(k)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label={L("All categories", "সব ক্যাটাগরি")} on={!cat} onPress={() => setCat("")} />
        {(cats.data || []).map((c) => (
          <Chip key={c.id} testID={`product-cat-${c.slug}`} label={L(c.nameEn, c.nameBn)} on={cat === c.slug} color={c.color} onPress={() => setCat(c.slug)} />
        ))}
      </ChipRow>
      {list.error ? <ErrorBox text={list.error} onRetry={list.load} /> : null}
      {pv.error ? <ErrorBox text={pv.error} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && !list.data.length ? <Empty icon="package" text={dq || cat || status ? L("No products match", "কোনো পণ্য মিলেনি") : L("No products yet", "এখনও কোনো পণ্য নেই")} /> : null}
      {list.data?.length ? <Text style={{ color: "#7A8CA3", fontSize: 12, marginBottom: 8 }}>{list.data.length} {L("products", "টি পণ্য")}</Text> : null}
      {(list.data || []).map((p) => (
        <ProductRow key={p.id} p={p} cats={cats.data} onPress={() => nav.push({ name: "product", id: p.id })} onPreview={() => pv.openProduct(p.id)} previewBusy={pv.busy === `p-${p.id}`} />
      ))}
    </Page>
  );
}

function ShopsList() {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const list = useLoader<any[]>(() => apiGet("/api/admin/manage/stores"), []);
  const pv = useBuyerPreview();
  const rowsF = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list.data || []).filter((x) => (!status || x.status === status) && (!s || `${x.name} ${x.ownerName} ${x.ownerEmail} ${x.location || ""} ${x.phone || ""}`.toLowerCase().includes(s)));
  }, [list.data, q, status]);
  return (
    <Page onRefresh={list.load} testID="admin-shops">
      <View style={[st.row, { marginBottom: 10 }]}>
        <View style={{ flex: 1 }}>
          <SearchBox testID="shop-search" value={q} onChange={setQ} placeholder={L("Search shops, owners, places", "দোকান, মালিক, জায়গা খুঁজুন")} />
        </View>
        <Btn testID="add-shop" icon="plus" label={L("Add", "যোগ")} onPress={() => nav.push({ name: "storeForm" })} style={{ marginBottom: 10 }} />
      </View>
      <ChipRow>
        {[["", L("All", "সব")], ["active", L("Active", "সক্রিয়")], ["suspended", L("Suspended", "স্থগিত")]].map(([k, label]) => (
          <Chip key={k || "all"} label={label} on={status === k} onPress={() => setStatus(k)} />
        ))}
      </ChipRow>
      {list.error ? <ErrorBox text={list.error} onRetry={list.load} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && !rowsF.length ? <Empty icon="briefcase" text={L("No shops found", "কোনো দোকান পাওয়া যায়নি")} /> : null}
      {rowsF.map((s) => (
        <Card key={s.id} testID={`shop-${s.id}`} onPress={() => nav.push({ name: "store", id: s.id })}>
          <View style={st.row}>
            <Thumb uri={s.logo} icon="briefcase" size={46} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14.5 }} numberOfLines={1}>{s.name}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{s.companyShop ? L("Company shop", "কোম্পানির দোকান") : s.ownerName || s.ownerEmail}{s.location ? ` · ${s.location}` : ""}</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Pill label={statusLabel(s.status, L)} color={STATUS_COLOR[s.status] || "#7A8CA3"} />
                <Pill label={`${s.products} ${L("products", "পণ্য")}`} color="#1F86DB" />
                <Pill label={`${s.orders} ${L("orders", "অর্ডার")}`} color="#3D38D0" />
              </View>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 13 }}>{taka(s.revenue)}</Text>
              <PreviewIconBtn testID={`shop-preview-${s.id}`} onPress={() => pv.openStore(s.id)} label={L("View shop as buyer", "ক্রেতার চোখে দোকান দেখুন")} />
            </View>
          </View>
        </Card>
      ))}
    </Page>
  );
}

function CategoriesList() {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const cats = useCategories();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const move = async (i: number, d: number) => {
    const list = [...(cats.data || [])];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    cats.setData(list);
    setBusy(list[j].id);
    try {
      await apiPost("/api/admin/manage/categories/reorder", { ids: list.map((c) => c.id) });
    } catch (e: any) {
      setErr(e?.message);
      cats.load();
    } finally {
      setBusy(null);
    }
  };
  return (
    <Page onRefresh={cats.load} testID="admin-categories">
      <View style={[st.row, { marginBottom: 6 }]}>
        <Text style={{ flex: 1, color: theme.textSecondary, fontSize: 12.5 }}>
          {L("Changes show in the marketplace and Seller Hub right away. No app update needed.", "পরিবর্তন সাথে সাথে মার্কেটপ্লেস ও সেলার হাবে দেখা যাবে। অ্যাপ আপডেট লাগবে না।")}
        </Text>
        <Btn testID="add-category" icon="plus" label={L("Add", "যোগ")} onPress={() => nav.push({ name: "categoryForm" })} />
      </View>
      {err ? <ErrorBox text={err} /> : null}
      {cats.error ? <ErrorBox text={cats.error} onRetry={cats.load} /> : null}
      {cats.loading && !cats.data ? <Loading /> : null}
      {(cats.data || []).map((c, i) => (
        <Card key={c.id} testID={`category-${c.slug}`} style={{ paddingVertical: 10 }}>
          <View style={st.row}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.color + "20", alignItems: "center", justifyContent: "center" }}>
              <AppIcon name={(c.icon as any) || "grid"} size={18} color={c.color} />
            </View>
            <Pressable style={{ flex: 1, gap: 2 }} onPress={() => nav.push({ name: "categoryForm", id: c.id })}>
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14.5 }} numberOfLines={1}>{c.nameEn} · {c.nameBn}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pill label={`${c.productCount ?? 0} ${L("products", "পণ্য")}`} color="#1F86DB" />
                {!c.active ? <Pill label={L("Hidden", "লুকানো")} color="#B25E09" /> : null}
              </View>
            </Pressable>
            <Pressable testID={`cat-up-${c.slug}`} disabled={i === 0 || !!busy} onPress={() => move(i, -1)} hitSlop={6} style={{ padding: 6, opacity: i === 0 ? 0.3 : 1 }}>
              <Feather name="arrow-up" size={18} color={theme.textSecondary} />
            </Pressable>
            <Pressable testID={`cat-down-${c.slug}`} disabled={i === (cats.data?.length || 0) - 1 || !!busy} onPress={() => move(i, 1)} hitSlop={6} style={{ padding: 6, opacity: i === (cats.data?.length || 0) - 1 ? 0.3 : 1 }}>
              <Feather name="arrow-down" size={18} color={theme.textSecondary} />
            </Pressable>
            <Pressable testID={`cat-edit-${c.slug}`} onPress={() => nav.push({ name: "categoryForm", id: c.id })} hitSlop={6} style={{ padding: 6 }}>
              <Feather name="edit-2" size={17} color={theme.primary} />
            </Pressable>
          </View>
        </Card>
      ))}
    </Page>
  );
}

const ICONS = ["grid", "feather", "sun", "layers", "droplet", "tool", "package", "heart", "zap", "coffee", "anchor", "github", "truck", "shopping-bag", "box", "activity", "thermometer", "umbrella", "wind", "star"];
const COLORS = ["#00BB77", "#2E96EF", "#00BB77", "#B25E09", "#B25E09", "#DA2F2F", "#FF4BB7", "#3D38D0", "#2E96EF", "#39B1FE", "#1F86DB", "#B25E09", "#4A5568"];

export function CategoryForm({ id }: { id?: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const cats = useCategories();
  const cur = cats.data?.find((c) => c.id === id);
  const [f, setF] = useState({ nameEn: "", nameBn: "", icon: "grid", color: "#00BB77", active: true });
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (cur) setF({ nameEn: cur.nameEn, nameBn: cur.nameBn, icon: cur.icon, color: cur.color, active: cur.active }); }, [cur?.id]);
  if (id && !cur) return <Page>{cats.loading ? <Loading /> : <Empty text={L("Category not found", "ক্যাটাগরি পাওয়া যায়নি")} />}</Page>;
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (id) await apiPut(`/api/admin/manage/categories/${id}`, f);
      else await apiPost("/api/admin/manage/categories", f);
      nav.pop();
    } catch (e: any) { setErr(e?.message); } finally { setBusy(false); }
  };
  const del = async () => {
    const n = cur?.productCount || 0;
    if (n > 0 && !moveTo) { setErr(L(`${n} products use this category. Pick where to move them first.`, `${n}টি পণ্য এই ক্যাটাগরিতে আছে। আগে কোথায় সরাবেন বেছে নিন।`)); return; }
    if (!(await confirmAsk(L("Delete category?", "ক্যাটাগরি মুছবেন?"), cur?.nameEn || "", L("Delete", "মুছুন"), L("Cancel", "বাতিল")))) return;
    setBusy(true); setErr(null);
    try {
      await apiDelete(`/api/admin/manage/categories/${id}${moveTo ? `?reassign=${encodeURIComponent(moveTo)}` : ""}`);
      nav.pop();
    } catch (e: any) { setErr(e?.message); } finally { setBusy(false); }
  };
  return (
    <Page testID="category-form">
      {err ? <ErrorBox text={err} /> : null}
      <Card>
        <Field testID="cat-name-en" label={L("Name (English)", "নাম (ইংরেজি)")} value={f.nameEn} onChange={(v) => setF({ ...f, nameEn: v })} maxLength={60} />
        <Field testID="cat-name-bn" label={L("Name (Bangla)", "নাম (বাংলা)")} value={f.nameBn} onChange={(v) => setF({ ...f, nameBn: v })} maxLength={60} />
        <Text style={[st.label, { color: theme.textSecondary }]}>{L("Icon", "আইকন")}</Text>
        <View style={[st.grid, { marginBottom: 12 }]}>
          {ICONS.map((ic) => (
            <Pressable key={ic} onPress={() => setF({ ...f, icon: ic })} style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: f.icon === ic ? f.color : theme.cardBorder, backgroundColor: f.icon === ic ? f.color + "18" : theme.card }}>
              <AppIcon name={ic as any} size={18} color={f.icon === ic ? f.color : theme.textSecondary} />
            </Pressable>
          ))}
        </View>
        <Text style={[st.label, { color: theme.textSecondary }]}>{L("Colour", "রঙ")}</Text>
        <View style={[st.grid, { marginBottom: 12 }]}>
          {COLORS.map((c) => (
            <Pressable key={c} onPress={() => setF({ ...f, color: c })} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: 3, borderColor: f.color === c ? theme.text : "transparent" }} />
          ))}
        </View>
        <View style={[st.row, { marginBottom: 4 }]}>
          <Chip label={L("Shown in marketplace", "মার্কেটপ্লেসে দেখাবে")} on={f.active} onPress={() => setF({ ...f, active: true })} />
          <Chip label={L("Hidden", "লুকানো")} on={!f.active} color="#B25E09" onPress={() => setF({ ...f, active: false })} />
        </View>
      </Card>
      <Btn testID="save-category" icon="check" label={L("Save", "সংরক্ষণ")} busy={busy} disabled={!f.nameEn.trim()} onPress={save} />
      {id ? (
        <Card style={{ marginTop: 18 }}>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 6 }}>{L("Delete this category", "এই ক্যাটাগরি মুছুন")}</Text>
          {(cur?.productCount || 0) > 0 ? (
            <>
              <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginBottom: 8 }}>{L("Move its products to:", "এর পণ্যগুলো সরান:")}</Text>
              <ChipRow>
                {(cats.data || []).filter((c) => c.id !== id).map((c) => (
                  <Chip key={c.id} label={L(c.nameEn, c.nameBn)} on={moveTo === c.slug} onPress={() => setMoveTo(c.slug)} />
                ))}
              </ChipRow>
            </>
          ) : null}
          <Btn testID="delete-category" kind="danger" icon="trash-2" label={L("Delete", "মুছুন")} busy={busy} onPress={del} />
        </Card>
      ) : null}
    </Page>
  );
}

/* ======================= PRODUCT DETAIL / FORM ======================= */
export function ProductDetail({ id }: { id: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const cats = useCategories();
  const p = useLoader<any>(() => apiGet(`/api/admin/manage/products/${id}`), [id]);
  const pv = useBuyerPreview();
  const [fresh] = useState(() => justCreated.delete(id));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stock, setStock] = useState<string>("");
  useEffect(() => { if (p.data) setStock(String(p.data.quantity)); }, [p.data?.quantity]);
  const act = async (k: string, fn: () => Promise<any>) => {
    setBusy(k); setErr(null);
    try { await fn(); await p.load(); } catch (e: any) { setErr(e?.message); } finally { setBusy(null); }
  };
  if (p.loading && !p.data) return <Page><Loading /></Page>;
  if (!p.data) return <Page><ErrorBox text={p.error || L("Product not found", "পণ্য পাওয়া যায়নি")} onRetry={p.load} /></Page>;
  const d = p.data;
  return (
    <Page onRefresh={p.load} testID="product-detail">
      {err ? <ErrorBox text={err} /> : null}
      {pv.error ? <ErrorBox text={pv.error} /> : null}
      {fresh ? (
        <JustCreatedCard testID="product-created" text={L("Product added. See how it looks to buyers.", "পণ্য যোগ হয়েছে। ক্রেতারা কেমন দেখবেন দেখে নিন।")}
          label={L("View as buyer", "ক্রেতার চোখে দেখুন")} busy={pv.busy === `p-${id}`} onPress={() => pv.openProduct(id)} />
      ) : null}
      <Card>
        <View style={st.row}>
          <Thumb uri={d.image} size={84} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: theme.text, fontWeight: "800", fontSize: 17 }}>{d.name}</Text>
            <Text style={{ color: theme.text, fontWeight: "700" }}>{taka(d.price)} / {d.unit || "kg"}</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Pill label={d.hidden ? L("Hidden", "লুকানো") : L("Visible", "দেখা যাচ্ছে")} color={d.hidden ? "#B25E09" : "#00875A"} />
              <Pill label={catName(cats.data, d.category, L)} color="#1F86DB" />
              {d.featured ? <Pill label={L("Featured", "ফিচার্ড")} color="#3D38D0" /> : null}
            </View>
          </View>
        </View>
        {d.description ? <Text style={{ color: theme.textSecondary, marginTop: 10, fontSize: 13.5 }}>{d.description}</Text> : null}
        {fresh ? null : (
          <Btn testID="product-view-as-buyer" kind="soft" icon="eye" label={L("View as buyer", "ক্রেতার চোখে দেখুন")} busy={pv.busy === `p-${id}`}
            onPress={() => pv.openProduct(id)} style={{ marginTop: 12 }} />
        )}
      </Card>
      <View style={[st.grid, { marginBottom: 10 }]}>
        <Stat label={L("In stock", "স্টকে")} value={d.quantity} icon="box" color={d.quantity > 0 ? "#00875A" : "#DA2F2F"} />
        <Stat label={L("Sold", "বিক্রি")} value={d.sold || 0} icon="trending-up" color="#3D38D0" />
      </View>
      <Card>
        <KV k={L("Shop", "দোকান")} v={d.storeName || L("No shop", "দোকান নেই")} testID="product-open-shop" onPress={d.storeId ? () => nav.push({ name: "store", id: d.storeId }) : undefined} />
        <KV k={L("Owner", "মালিক")} v={d.ownerName || d.ownerEmail} testID="product-open-owner" onPress={d.ownerId ? () => nav.push({ name: "user", id: d.ownerId }) : undefined} />
        <KV k={L("Location", "লোকেশন")} v={d.location || ""} />
        <KV k={L("Added", "যোগ হয়েছে")} v={fmtDate(d.createdAt)} />
      </Card>
      <Card>
        <Text style={[st.label, { color: theme.textSecondary }]}>{L("Update stock", "স্টক আপডেট")}</Text>
        <View style={st.row}>
          <View style={{ flex: 1 }}><Field label="" value={stock} onChange={setStock} keyboardType="numeric" testID="product-stock" /></View>
          <Btn testID="save-stock" small label={L("Save", "সংরক্ষণ")} busy={busy === "stock"} style={{ marginBottom: 12 }} onPress={() => act("stock", () => apiPut(`/api/admin/manage/products/${id}`, { quantity: Number(stock) || 0 }))} />
        </View>
        <View style={[st.grid]}>
          <Btn testID="edit-product" kind="soft" icon="edit-2" label={L("Edit", "এডিট")} onPress={() => nav.push({ name: "productForm", id })} />
          <Btn testID="toggle-hidden" kind="ghost" icon={d.hidden ? "eye" : "eye-off"} label={d.hidden ? L("Show", "দেখান") : L("Hide", "লুকান")} busy={busy === "hide"}
            onPress={() => act("hide", () => apiPut(`/api/admin/manage/products/${id}`, { hidden: !d.hidden }))} />
          <Btn kind="ghost" icon="star" label={d.featured ? L("Unfeature", "ফিচার সরান") : L("Feature", "ফিচার")} busy={busy === "feat"}
            onPress={() => act("feat", () => apiPut(`/api/admin/manage/products/${id}`, { featured: !d.featured }))} />
          <Btn testID="delete-product" kind="danger" icon="trash-2" label={L("Delete", "মুছুন")} busy={busy === "del"}
            onPress={async () => {
              if (!(await confirmAsk(L("Delete product?", "পণ্য মুছবেন?"), d.name, L("Delete", "মুছুন"), L("Cancel", "বাতিল")))) return;
              setBusy("del");
              try { await apiDelete(`/api/admin/manage/products/${id}`); nav.pop(); } catch (e: any) { setErr(e?.message); setBusy(null); }
            }} />
        </View>
      </Card>
      <SectionTitle title={`${L("Who ordered", "কে অর্ডার করেছে")} (${d.orderList?.length || 0})`} />
      {!d.orderList?.length ? <Empty icon="shopping-bag" text={L("No orders for this product yet", "এখনও এই পণ্যের অর্ডার নেই")} /> : null}
      {(d.orderList || []).map((o: any) => <OrderRow key={o.id} o={o} productId={id} />)}
    </Page>
  );
}

export function OrderRow({ o, productId }: { o: any; productId?: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const qty = productId ? (o.items || []).filter((it: any) => it?.productId === productId).reduce((n: number, it: any) => n + (Number(it.quantity) || 0), 0) : o.itemCount;
  return (
    <Card onPress={() => nav.push({ name: "order", id: o.id })} testID={`order-${o.id}`}>
      <View style={st.row}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{o.buyerName || L("Guest", "অতিথি")} · #{String(o.id).slice(-6).toUpperCase()}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
            {qty} {productId ? L("pcs", "টি") : L("items", "আইটেম")} · {fmtDate(o.createdAt)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={{ color: theme.text, fontWeight: "800" }}>{taka(o.total)}</Text>
          <Pill label={statusLabel(o.status, L)} color={STATUS_COLOR[o.status] || "#7A8CA3"} />
        </View>
      </View>
    </Card>
  );
}

function SellTile({ on, icon, title, sub, onPress, testID }: { on: boolean; icon: keyof typeof Feather.glyphMap; title: string; sub: string; onPress: () => void; testID?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress}
      style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: on ? theme.primary : theme.cardBorder, backgroundColor: on ? theme.primary + "10" : "transparent", transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={[st.row, { gap: 8 }]}>
        <Feather name={icon} size={18} color={on ? theme.primary : theme.textSecondary} />
        <Text style={{ color: on ? theme.primary : theme.text, fontWeight: "800", flex: 1 }}>{title}</Text>
        <Feather name={on ? "check-circle" : "circle"} size={16} color={on ? theme.primary : theme.textTertiary} />
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>{sub}</Text>
    </Pressable>
  );
}

export { ProductForm } from "./productForm";

/* ======================= SHOP (STORE) DETAIL / FORM ======================= */
export function StoreDetail({ id }: { id: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const cats = useCategories();
  const s = useLoader<any>(() => apiGet(`/api/admin/manage/stores/${id}`), [id]);
  const pv = useBuyerPreview();
  const [fresh] = useState(() => justCreated.delete(id));
  const [tab, setTab] = useState<"products" | "orders" | "customers">("products");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (s.loading && !s.data) return <Page><Loading /></Page>;
  if (!s.data) return <Page><ErrorBox text={s.error || L("Shop not found", "দোকান পাওয়া যায়নি")} onRetry={s.load} /></Page>;
  const d = s.data;
  const needle = q.trim().toLowerCase();
  const products = (d.products || []).filter((p: any) => !needle || p.name.toLowerCase().includes(needle));
  const orders = (d.orders || []).filter((o: any) => !needle || `${o.buyerName} ${o.id} ${o.status}`.toLowerCase().includes(needle));
  const customers = (d.customers || []).filter((c: any) => !needle || `${c.name} ${c.email}`.toLowerCase().includes(needle));
  const toggle = async () => {
    const to = d.status === "active" ? "suspended" : "active";
    if (to === "suspended" && !(await confirmAsk(L("Suspend shop?", "দোকান স্থগিত করবেন?"), d.name, L("Suspend", "স্থগিত"), L("Cancel", "বাতিল")))) return;
    setBusy(true); setErr(null);
    try { await apiPut(`/api/admin/manage/stores/${id}`, { status: to }); await s.load(); } catch (e: any) { setErr(e?.message); } finally { setBusy(false); }
  };
  return (
    <Page onRefresh={s.load} testID="store-detail">
      {err ? <ErrorBox text={err} /> : null}
      {pv.error ? <ErrorBox text={pv.error} /> : null}
      {fresh ? (
        <JustCreatedCard testID="store-created" text={L("Shop opened. See how it looks to buyers.", "দোকান খোলা হয়েছে। ক্রেতারা কেমন দেখবেন দেখে নিন।")}
          label={L("View shop as buyer", "ক্রেতার চোখে দোকান দেখুন")} busy={pv.busy === `s-${id}`} onPress={() => pv.openStore(id)} />
      ) : null}
      <Card>
        <View style={st.row}>
          <Thumb uri={d.logo} icon="briefcase" size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: theme.text, fontWeight: "800", fontSize: 17 }}>{d.name}</Text>
            {d.tagline ? <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{d.tagline}</Text> : null}
            <Pill label={statusLabel(d.status, L)} color={STATUS_COLOR[d.status] || "#7A8CA3"} />
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          {d.companyShop
            ? <KV k={L("Run by", "চালায়")} v={L("Farmers admins (company shop)", "ফার্মার্স অ্যাডমিন (কোম্পানির দোকান)")} testID="store-company" />
            : <KV k={L("Owner", "মালিক")} v={d.ownerName || d.ownerEmail} testID="store-open-owner" onPress={() => nav.push({ name: "user", id: d.ownerId })} />}
          <KV k={L("Phone", "ফোন")} v={d.phone || d.ownerPhone} />
          <KV k={L("Location", "লোকেশন")} v={d.location} />
          <KV k={L("Category", "ক্যাটাগরি")} v={d.category ? catName(cats.data, d.category, L) : ""} />
          <KV k={L("Opened", "খোলা হয়েছে")} v={fmtDate(d.createdAt, false)} />
        </View>
        {d.description ? <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 6 }}>{d.description}</Text> : null}
        <View style={[st.grid, { marginTop: 10 }]}>
          <Btn testID="store-view-as-buyer" small kind="primary" icon="eye" label={L("View as buyer", "ক্রেতার চোখে দেখুন")} onPress={() => pv.openStore(id)} />
          <Btn testID="edit-store" small kind="soft" icon="edit-2" label={L("Edit details", "তথ্য এডিট")} onPress={() => nav.push({ name: "storeForm", id })} />
          <Btn testID="store-add-product" small kind="soft" icon="plus" label={L("Add product", "পণ্য যোগ")} onPress={() => nav.push({ name: "productForm", storeId: id })} />
          <Btn testID="toggle-store" small kind={d.status === "active" ? "danger" : "primary"} icon={d.status === "active" ? "pause" : "play"} busy={busy}
            label={d.status === "active" ? L("Suspend", "স্থগিত") : L("Activate", "চালু করুন")} onPress={toggle} />
        </View>
      </Card>
      <View style={[st.grid, { marginBottom: 10 }]}>
        <Stat label={L("Products", "পণ্য")} value={d.products.length} icon="package" color="#1F86DB" onPress={() => setTab("products")} />
        <Stat label={L("Orders", "অর্ডার")} value={d.orders.length} icon="shopping-bag" color="#3D38D0" onPress={() => setTab("orders")} />
        <Stat label={L("Customers", "ক্রেতা")} value={d.customers.length} icon="users" color="#3D38D0" onPress={() => setTab("customers")} />
        <Stat label={L("Revenue", "আয়")} value={taka(d.revenue)} icon="dollar-sign" color="#00875A" />
      </View>
      <ChipRow>
        <Chip testID="store-tab-products" label={`${L("Products", "পণ্য")} (${d.products.length})`} on={tab === "products"} onPress={() => setTab("products")} />
        <Chip testID="store-tab-orders" label={`${L("Orders", "অর্ডার")} (${d.orders.length})`} on={tab === "orders"} onPress={() => setTab("orders")} />
        <Chip testID="store-tab-customers" label={`${L("Customers", "ক্রেতা")} (${d.customers.length})`} on={tab === "customers"} onPress={() => setTab("customers")} />
      </ChipRow>
      <SearchBox value={q} onChange={setQ} placeholder={L("Search in this shop", "এই দোকানে খুঁজুন")} testID="store-search" />
      {tab === "products" ? (products.length ? products.map((p: any) => <ProductRow key={p.id} p={p} cats={cats.data} onPress={() => nav.push({ name: "product", id: p.id })} onPreview={() => pv.openProduct(p.id)} previewBusy={pv.busy === `p-${p.id}`} />) : <Empty icon="package" text={L("No products", "কোনো পণ্য নেই")} />) : null}
      {tab === "orders" ? (orders.length ? orders.map((o: any) => <OrderRow key={o.id} o={o} />) : <Empty icon="shopping-bag" text={L("No orders", "কোনো অর্ডার নেই")} />) : null}
      {tab === "customers"
        ? customers.length
          ? customers.map((c: any) => (
              <Card key={c.id} onPress={() => nav.push({ name: "user", id: c.id })}>
                <View style={st.row}>
                  <Feather name="user" size={18} color={theme.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: "700" }}>{c.name || c.email}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>{c.email}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                </View>
              </Card>
            ))
          : <Empty icon="users" text={L("No customers yet", "এখনও কোনো ক্রেতা নেই")} />
        : null}
    </Page>
  );
}

export function StoreForm({ id }: { id?: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const cats = useCategories();
  const existing = useLoader<any>(() => (id ? apiGet(`/api/admin/manage/stores/${id}`) : Promise.resolve(null)), [id]);
  const [f, setF] = useState<any>({ owner: "", name: "", tagline: "", description: "", phone: "", location: "", category: "", logo: "" });
  const [kind, setKind] = useState<"company" | "seller">("company");
  const [userQ, setUserQ] = useState("");
  const dq = useDebounced(userQ);
  const users = useLoader<any[]>(() => (!id && dq.trim().length >= 2 ? apiGet(`/api/admin/manage/users?q=${encodeURIComponent(dq)}`) : Promise.resolve([])), [dq, id]);
  const [busy, setBusy] = useState(false);
  const [upl, setUpl] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const d = existing.data;
    if (d) setF({ owner: d.ownerId, name: d.name, tagline: d.tagline || "", description: d.description || "", phone: d.phone || "", location: d.location || "", category: d.category || "", logo: d.logo || "" });
  }, [existing.data?.id]);
  const set = (k: string) => (v: string) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (id) { await apiPut(`/api/admin/manage/stores/${id}/details`, f); nav.pop(); }
      else {
        // a company shop has no owner account: the admins run it and add its products
        const r = await apiPost("/api/admin/manage/stores", { ...f, owner: kind === "company" ? "" : f.owner });
        if (r?.id) justCreated.add(r.id);
        nav.pop(); nav.push({ name: "store", id: r.id });
      }
    } catch (e: any) { setErr(e?.message); } finally { setBusy(false); }
  };
  if (id && existing.loading) return <Page><Loading /></Page>;
  const picked = (users.data || []).find((u) => u.id === f.owner);
  return (
    <Page testID="store-form">
      {err ? <ErrorBox text={err} /> : null}
      {!id ? (
        <Card>
          <Text style={[st.label, { color: theme.textSecondary }]}>{L("Who runs this shop?", "দোকানটি কে চালাবে?")}</Text>
          <View style={[st.row, { gap: 10, flexWrap: "wrap" }]}>
            <SellTile testID="store-kind-company" on={kind === "company"} icon="briefcase" title={L("Company shop", "কোম্পানির দোকান")}
              sub={L("You add its products here. Good for a company or brand.", "পণ্য আপনি এখান থেকে যোগ করবেন। কোম্পানি বা ব্র্যান্ডের জন্য।")} onPress={() => setKind("company")} />
            <SellTile testID="store-kind-seller" on={kind === "seller"} icon="user" title={L("A seller's shop", "বিক্রেতার দোকান")}
              sub={L("Give it to a user, who runs it from the Seller Hub.", "একজন ব্যবহারকারী সেলার হাব থেকে চালাবেন।")} onPress={() => setKind("seller")} />
          </View>
        </Card>
      ) : null}
      {!id && kind === "seller" ? (
        <Card>
          <Text style={[st.label, { color: theme.textSecondary }]}>{L("Shop owner", "দোকানের মালিক")}</Text>
          <SearchBox testID="owner-search" value={userQ} onChange={setUserQ} placeholder={L("Search by name, email or phone", "নাম, ইমেইল বা ফোন দিয়ে খুঁজুন")} />
          {(users.data || []).slice(0, 8).map((u) => (
            <Pressable key={u.id} testID={`pick-owner-${u.id}`} disabled={!!u.store} onPress={() => set("owner")(u.id)}
              style={[st.row, { paddingVertical: 8, opacity: u.store ? 0.45 : 1 }]}>
              <AppIcon name={f.owner === u.id ? "check-circle" : "circle"} size={18} color={f.owner === u.id ? theme.primary : theme.textTertiary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>{u.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{u.email || u.phone}{u.store ? ` · ${L("already has a shop", "ইতিমধ্যে দোকান আছে")}` : ""}</Text>
              </View>
            </Pressable>
          ))}
          {picked ? <Text style={{ color: theme.primary, fontWeight: "700", marginTop: 6 }}>{L("Owner:", "মালিক:")} {picked.name}</Text> : null}
        </Card>
      ) : null}
      <Card>
        <View style={[st.row, { marginBottom: 12 }]}>
          <Thumb uri={f.logo} icon="briefcase" size={60} />
          <Btn kind="ghost" small icon="image" busy={upl} label={L("Logo", "লোগো")}
            onPress={async () => { setUpl(true); try { const u = await pickAndUpload(); if (u) set("logo")(u); } catch (e: any) { setErr(e?.message); } finally { setUpl(false); } }} />
        </View>
        <Field testID="sf-name" label={L("Shop name", "দোকানের নাম")} value={f.name} onChange={set("name")} maxLength={80} />
        <Field label={L("Tagline", "ট্যাগলাইন")} value={f.tagline} onChange={set("tagline")} maxLength={120} />
        <Field label={L("Phone", "ফোন")} value={f.phone} onChange={set("phone")} keyboardType="phone-pad" maxLength={30} />
        <Field testID="sf-location" label={L("Location", "লোকেশন")} value={f.location} onChange={set("location")} maxLength={120} />
        <Text style={[st.label, { color: theme.textSecondary }]}>{L("Main category", "মূল ক্যাটাগরি")}</Text>
        <View style={[st.grid, { marginBottom: 12, gap: 8 }]}>
          {(cats.data || []).map((c) => <Chip key={c.id} label={L(c.nameEn, c.nameBn)} color={c.color} on={f.category === c.slug} onPress={() => set("category")(f.category === c.slug ? "" : c.slug)} />)}
        </View>
        <Field label={L("About the shop", "দোকান সম্পর্কে")} value={f.description} onChange={set("description")} multiline maxLength={2000} />
      </Card>
      <Btn testID="save-store" icon="check" label={id ? L("Save changes", "পরিবর্তন সংরক্ষণ") : L("Open shop", "দোকান খুলুন")} busy={busy}
        disabled={f.name.trim().length < 2 || (!id && kind === "seller" && !f.owner)} onPress={save} />
    </Page>
  );
}
