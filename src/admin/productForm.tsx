/**
 * Admin "Add product" / "Edit product" form.
 *
 * Same data and the same rules as before (shared/selling.ts, checked again on the server), laid out so each
 * choice explains itself:
 *   - Quick start: one tap fills a common setup (fish by kg, a 25 kg feed sack, eggs by the dozen, ...)
 *   - How it's sold: what the unit means (1 maund = 40 kg), pack contents with common sizes
 *   - Price and stock: the price shown in other units too (per kg, per 100 g, per piece inside a pack)
 *   - How much buyers can order: minimum, maximum, the amount each + adds and the quick buttons,
 *     each with a plain example, a one-line summary and a stepper to try it like a buyer
 * Problems show under the field they belong to, as soon as two settings contradict each other.
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import {
  SELL_UNITS, PACK_CONTENT, PART_UNITS, SET_SIZE, UNIT_IN_BASE, MAX_QTY, round3, sellRule, clampQty, upperLimit, totalContentText, guessSellAs,
  type SellAs,
} from "@shared/selling";
import { n2s, bnNum, tk, numOk, unitName, checkProduct, convertNumbers, type LFn } from "./productFormRules";
import { useAdminNav, useL, useLoader, Page, Card, SectionTitle, Chip, ChipRow, SearchBox, Btn, Field, Loading, ErrorBox, Thumb, ToggleRow, pickAndUpload, st, Text } from "./ui";

type Category = { id: string; slug: string; nameEn: string; nameBn: string; color: string };

/** Ids of products added in this session (the product page can offer "see it as buyers do" for them). */
export const justCreatedProducts = new Set<string>();

/** Chip text for a unit, with its size where the name alone isn't obvious. */
const unitChip = (u: string, L: LFn) =>
  ({
    maund: L("maund (40 kg)", "মণ (৪০ কেজি)"), ton: L("ton (1000 kg)", "টন (১০০০ কেজি)"),
    dozen: L("dozen (12)", "ডজন (১২টি)"), hali: L("hali (4)", "হালি (৪টি)"), pair: L("pair (2)", "জোড়া (২টি)"),
  } as Record<string, string>)[u] || unitName(u, L);

/** One line under the unit choice saying what the price is for. */
function unitMeaning(sellAs: SellAs, unit: string, L: LFn): string {
  const u = unitName(unit, L);
  const m: Record<string, [string, string]> = {
    kg: ["1 kg = 1000 gram.", "১ কেজি = ১০০০ গ্রাম।"],
    g: ["Good for seeds, medicine and small amounts. 1000 gram = 1 kg.", "বীজ, ওষুধ ও অল্প পরিমাণের জন্য। ১০০০ গ্রাম = ১ কেজি।"],
    maund: ["1 maund = 40 kg. Good for rice, paddy and big amounts.", "১ মণ = ৪০ কেজি। চাল, ধান ও বেশি পরিমাণের জন্য।"],
    ton: ["1 ton = 1000 kg. For very large orders.", "১ টন = ১০০০ কেজি। খুব বড় অর্ডারের জন্য।"],
    litre: ["1 litre = 1000 ml.", "১ লিটার = ১০০০ মিলি।"],
    ml: ["For small bottles and medicine. 1000 ml = 1 litre.", "ছোট বোতল ও ওষুধের জন্য। ১০০০ মিলি = ১ লিটার।"],
    piece: ["Buyers pick how many pieces they want.", "ক্রেতা কয়টি পিস চান তা বেছে নেবেন।"],
    dozen: ["1 dozen = 12 pieces.", "১ ডজন = ১২টি।"], hali: ["1 hali = 4 pieces.", "১ হালি = ৪টি।"], pair: ["1 pair = 2 pieces.", "১ জোড়া = ২টি।"],
  };
  const base = sellAs === "pack" ? L(`The price is for one whole ${u}.`, `দাম পুরো এক ${u}-এর।`) : L(`The price is for 1 ${u}.`, `দাম ১ ${u}-এর।`);
  const extra = m[unit] ? L(m[unit][0], m[unit][1]) : "";
  return `${base} ${extra}`.trim();
}

/** Common setups, one tap fills how it's sold and the order rules (never the price). */
type Template = { key: string; en: string; bn: string; icon: keyof typeof Feather.glyphMap; v: Record<string, string> };
const TEMPLATES: Template[] = [
  { key: "fish-kg", en: "Fish by kg", bn: "মাছ কেজিতে", icon: "anchor", v: { sellAs: "weight", unit: "kg", step: "0.5", minOrder: "1", maxOrder: "", presets: "1, 2, 5, 10" } },
  { key: "feed-sack", en: "Feed sack, 25 kg", bn: "খাদ্যের বস্তা, ২৫ কেজি", icon: "package", v: { sellAs: "pack", unit: "sack", packSize: "25", packUnit: "kg", step: "", minOrder: "", maxOrder: "", presets: "1, 2, 5, 10" } },
  { key: "rice-maund", en: "Rice by maund", bn: "চাল মণে", icon: "layers", v: { sellAs: "weight", unit: "maund", step: "0.5", minOrder: "1", maxOrder: "", presets: "1, 2, 5" } },
  { key: "eggs-dozen", en: "Eggs by dozen", bn: "ডিম ডজনে", icon: "grid", v: { sellAs: "dozen", unit: "dozen", step: "", minOrder: "", maxOrder: "", presets: "1, 2, 5" } },
  { key: "eggs-hali", en: "Eggs by hali", bn: "ডিম হালিতে", icon: "grid", v: { sellAs: "dozen", unit: "hali", step: "", minOrder: "", maxOrder: "", presets: "1, 2, 3, 5" } },
  { key: "fry-piece", en: "Fish fry by piece", bn: "পোনা পিসে", icon: "box", v: { sellAs: "piece", unit: "piece", step: "50", minOrder: "100", maxOrder: "", presets: "100, 500, 1000" } },
  { key: "med-bottle", en: "Medicine bottle, 500 ml", bn: "ওষুধের বোতল, ৫০০ মিলি", icon: "plus-square", v: { sellAs: "pack", unit: "bottle", packSize: "500", packUnit: "ml", step: "", minOrder: "", maxOrder: "", presets: "1, 2, 5" } },
  { key: "liquid-litre", en: "BKC or oil by litre", bn: "বিকেসি বা তেল লিটারে", icon: "droplet", v: { sellAs: "volume", unit: "litre", step: "0.5", minOrder: "1", maxOrder: "", presets: "1, 5, 10, 20" } },
  { key: "seed-gram", en: "Seeds by gram", bn: "বীজ গ্রামে", icon: "feather", v: { sellAs: "weight", unit: "g", step: "50", minOrder: "100", maxOrder: "", presets: "100, 250, 500, 1000" } },
];

const PACK_SIZES: Record<string, number[]> = { kg: [1, 5, 10, 20, 25, 40, 50], g: [100, 250, 500], litre: [1, 2, 5, 10, 20, 200], ml: [100, 250, 500, 1000], pieces: [6, 10, 12, 30, 100] };
const stepChoices = (unit: string) => (PART_UNITS.includes(unit) ? [0.25, 0.5, 1, 2, 5, 10] : unit === "g" || unit === "ml" ? [1, 10, 50, 100, 250, 500] : [1, 2, 5, 10, 50, 100]);

function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>{children}</View>;
}

function Tile({ on, icon, title, sub, onPress, testID }: { on: boolean; icon: keyof typeof Feather.glyphMap; title: string; sub: string; onPress: () => void; testID?: string }) {
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

function Note({ icon = "info", text, tone = "info", testID }: { icon?: keyof typeof Feather.glyphMap; text: string; tone?: "info" | "error" | "ok"; testID?: string }) {
  const { theme } = useTheme();
  const c = tone === "error" ? theme.error : tone === "ok" ? theme.primary : theme.textSecondary;
  return (
    <View testID={testID} style={[st.row, { gap: 6, alignItems: "flex-start", marginTop: -6, marginBottom: 12 }]}>
      <Feather name={tone === "error" ? "alert-circle" : icon} size={13} color={c} style={{ marginTop: 2 }} />
      <Text style={{ color: c, fontSize: 12.5, flex: 1, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

export { unitName, checkProduct, convertNumbers };

export function ProductForm({ id, storeId }: { id?: string; storeId?: string }) {
  const nav = useAdminNav();
  const { theme } = useTheme();
  const L = useL();
  const bn = L("en", "bn") === "bn";
  const N = (s: string | number) => (bn ? bnNum(s) : String(s));
  const cats = useLoader<Category[]>(() => apiGet("/api/admin/manage/categories"), []);
  const stores = useLoader<any[]>(() => apiGet("/api/admin/manage/stores"), []);
  const existing = useLoader<any>(() => (id ? apiGet(`/api/admin/manage/products/${id}`) : Promise.resolve(null)), [id]);
  const blank = { name: "", price: "", quantity: "", unit: "kg", sellAs: "weight", packSize: "", packUnit: "kg", category: "", description: "", image: "", minOrder: "", maxOrder: "", step: "", presets: "", location: "", storeId: storeId || "", grade: "", variety: "", origin: "", harvestDate: "", shelfLife: "", storage: "", organic: false };
  const [f, setF] = useState<any>(blank);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [upl, setUpl] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shopQ, setShopQ] = useState("");
  const [tried, setTried] = useState(false);
  const [tpl, setTpl] = useState<string | null>(null);
  const [conv, setConv] = useState<{ from: string; to: string } | null>(null);
  const [customStep, setCustomStep] = useState(false);
  const [addQ, setAddQ] = useState("");
  const [tryQ, setTryQ] = useState<number | null>(null);
  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    const s2 = (v: any) => (v === null || v === undefined ? "" : String(v));
    setF({ ...blank, name: d.name, price: s2(d.price), quantity: s2(d.quantity), unit: d.unit || "kg", sellAs: guessSellAs(d), packSize: s2(d.packSize), packUnit: d.packUnit || "kg", category: d.category, description: d.description || "", image: d.image || "", minOrder: s2(d.minOrder), maxOrder: s2(d.maxOrder), step: s2(d.step), presets: Array.isArray(d.presets) ? d.presets.join(", ") : "", location: d.location || "", storeId: d.storeId || "", grade: d.grade || "", variety: d.variety || "", origin: d.origin || "", harvestDate: d.harvestDate || "", shelfLife: d.shelfLife || "", storage: d.storage || "", organic: !!d.organic });
    if (d.grade || d.variety || d.origin || d.harvestDate || d.shelfLife || d.storage || d.organic) setMore(true);
    if (d.step && !stepChoices(d.unit || "kg").includes(Number(d.step))) setCustomStep(true);
  }, [existing.data?.id]);
  const set = (k: string) => (v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const sellAs = f.sellAs as SellAs;
  const unitLabel = unitName(f.unit, L);
  const ruleFields = ["price", "quantity", "minOrder", "maxOrder", "step", "presets"];

  const pickSellAs = (k: SellAs) => { setConv(null); setTpl(null); setF((x: any) => ({ ...x, sellAs: k, unit: SELL_UNITS[k].includes(x.unit) ? x.unit : SELL_UNITS[k][0] })); };
  const pickUnit = (u: string) => {
    if (u === f.unit) return;
    const a = UNIT_IN_BASE[f.unit], b = UNIT_IN_BASE[u];
    // switching kg <-> gram etc.: offer to change the numbers already typed
    if (a && b && a.base === b.base && ruleFields.some((k) => String(f[k] || "").trim())) setConv({ from: f.unit, to: u });
    else setConv(null);
    if (!stepChoices(u).includes(Number(f.step || 1))) setCustomStep(!!f.step);
    set("unit")(u);
  };
  const applyConversion = () => {
    if (!conv) return;
    setF((x: any) => convertNumbers(x, conv.from, conv.to));
    setCustomStep(true);
    setConv(null);
  };
  const applyTemplate = (t: Template) => {
    setConv(null);
    setTpl(t.key);
    setCustomStep(!!t.v.step && !stepChoices(t.v.unit).includes(Number(t.v.step)));
    setF((x: any) => ({ ...x, packSize: "", packUnit: "kg", ...t.v }));
  };

  // ---------- numbers and checks ----------
  const { stepN, partOk, presetList, minN, maxN, fe, needed, badPresets, errors } = checkProduct(f, L, N);

  // ---------- helpers shown next to the fields ----------
  const price = Number(f.price) > 0 ? Number(f.price) : 0;
  const priceAlso: string[] = [];
  if (price) {
    const ub = UNIT_IN_BASE[f.unit];
    if (ub && sellAs !== "pack") {
      const perBase = price / ub.factor; // per kg or per litre
      const small = ub.base === "kg" ? "g" : "ml";
      if (f.unit !== ub.base) priceAlso.push(L(`${tk(perBase)} per ${unitName(ub.base, L)}`, `প্রতি ${unitName(ub.base, L)} ${tk(perBase)}`));
      if (f.unit === ub.base) priceAlso.push(L(`${tk(perBase * 0.1)} per 100 ${unitName(small, L)}`, `প্রতি ১০০ ${unitName(small, L)} ${tk(perBase * 0.1)}`));
      if (ub.base === "kg" && f.unit !== "maund" && f.unit !== "g") priceAlso.push(L(`${tk(perBase * 40)} per maund`, `প্রতি মণ ${tk(perBase * 40)}`));
    }
    if (sellAs === "pack" && Number(f.packSize) > 0) {
      const pu = UNIT_IN_BASE[f.packUnit];
      if (pu) priceAlso.push(L(`${tk(price / (Number(f.packSize) * pu.factor))} per ${unitName(pu.base, L)} inside`, `ভেতরের প্রতি ${unitName(pu.base, L)} ${tk(price / (Number(f.packSize) * pu.factor))}`));
      else if (f.packUnit === "pieces") priceAlso.push(L(`${tk(price / Number(f.packSize))} per piece inside`, `ভেতরের প্রতি পিস ${tk(price / Number(f.packSize))}`));
    }
    if (sellAs === "dozen" && SET_SIZE[f.unit]) priceAlso.push(L(`${tk(price / SET_SIZE[f.unit])} per piece`, `প্রতি পিস ${tk(price / SET_SIZE[f.unit])}`));
  }
  const rule = useMemo(() => sellRule({ sellAs, unit: f.unit, step: f.step, minOrder: f.minOrder, maxOrder: f.maxOrder, quantity: String(f.quantity).trim() === "" ? 0 : f.quantity, packSize: f.packSize, packUnit: f.packUnit, presets: presetList }),
    [sellAs, f.unit, f.step, f.minOrder, f.maxOrder, f.quantity, f.packSize, f.packUnit, f.presets]);
  const stockN = Number(f.quantity) > 0 ? Number(f.quantity) : 0;
  const stockAll = stockN ? totalContentText(rule, stockN, bn) : "";
  const rulesOk = !fe.step && !fe.minOrder && !fe.maxOrder;
  const summary = rulesOk
    ? L(
        `Buyers can order from ${n2s(minN)} ${unitLabel}${maxN ? ` up to ${n2s(maxN)} ${unitLabel}` : ", with no upper limit"} (never more than your stock). Each + adds ${n2s(stepN)} ${unitLabel}.`,
        `ক্রেতারা ${N(n2s(minN))} ${unitLabel} থেকে${maxN ? ` ${N(n2s(maxN))} ${unitLabel} পর্যন্ত` : " যত খুশি"} অর্ডার করতে পারবেন (স্টকের বেশি নয়)। প্রতি + চাপলে ${N(n2s(stepN))} ${unitLabel} যোগ হবে।`,
      )
    : "";
  // try it like a buyer: on a stock of 0 the shop shows out of stock, so try it with plenty in stock
  const tryRule = useMemo(() => ({ ...rule, stock: stockN > 0 ? rule.stock : null }), [rule, stockN]);
  const hi = upperLimit(tryRule);
  const q = clampQty(tryRule, tryQ ?? tryRule.min);
  const suggest = () => {
    const out: number[] = [];
    for (const k of [1, 2, 5, 10, 20, 50, 100]) {
      const v = round3(Math.ceil((minN * k) / stepN - 1e-9) * stepN);
      if (v > MAX_QTY || (maxN !== null && v > maxN) || (!partOk && !Number.isInteger(v))) break;
      if (!out.includes(v)) out.push(v);
      if (out.length >= 4) break;
    }
    set("presets")(out.join(", "));
  };
  const addPreset = () => {
    const v = Number(addQ);
    if (!(v > 0)) return;
    const list = [...new Set([...presetList, round3(v)])].sort((a, b) => a - b).slice(0, 6);
    set("presets")(list.join(", "));
    setAddQ("");
  };
  const removePreset = (v: number) => set("presets")(presetList.filter((x) => x !== v).join(", "));

  const save = async () => {
    setTried(true);
    if (errors.length) return;
    setBusy(true); setErr(null);
    const body: any = {
      name: f.name.trim(), price: Number(f.price), quantity: Number(f.quantity) || 0, unit: f.unit, sellAs, category: f.category, description: f.description, image: f.image, location: f.location,
      packSize: sellAs === "pack" ? Number(f.packSize) : null, packUnit: sellAs === "pack" ? f.packUnit : "",
      grade: f.grade, variety: f.variety, origin: f.origin, harvestDate: f.harvestDate, shelfLife: f.shelfLife, storage: f.storage, organic: !!f.organic,
      minOrder: f.minOrder ? Number(f.minOrder) : null,
      maxOrder: f.maxOrder ? Number(f.maxOrder) : null,
      step: f.step ? Number(f.step) : null,
      presets: presetList,
    };
    try {
      if (id) {
        await apiPut(`/api/admin/manage/products/${id}`, body);
        nav.pop();
      } else {
        const r = await apiPost("/api/admin/manage/products", { ...body, storeId: f.storeId || undefined });
        if (r?.id) justCreatedProducts.add(r.id);
        nav.pop();
        nav.push({ name: "product", id: r.id });
      }
    } catch (e: any) { setErr(e?.message); } finally { setBusy(false); }
  };
  if (id && existing.loading) return <Page><Loading /></Page>;
  const storeList = (stores.data || []).filter((s) => !shopQ || `${s.name} ${s.ownerName}`.toLowerCase().includes(shopQ.toLowerCase()));
  const label = (t: string, sub?: string) => (
    <View style={{ marginBottom: 7 }}>
      <Text style={[st.label, { color: theme.textSecondary, marginBottom: 0 }]}>{t}</Text>
      {sub ? <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
  const fieldErr = (k: string, testID?: string) => (fe[k] && (tried || String(f[k] || "").trim()) ? <Note tone="error" text={fe[k]} testID={testID || `pf-err-${k}`} /> : null);
  const GRADES = [L("Premium", "প্রিমিয়াম"), L("Grade A", "গ্রেড এ"), L("Grade B", "গ্রেড বি"), L("Export quality", "রপ্তানি মান")];
  const sec = (i: number, en: string, bnT: string) => L(`${id ? i - 1 : i}. ${en}`, `${N(id ? i - 1 : i)}. ${bnT}`);
  const packSizes = PACK_SIZES[f.packUnit] || [];
  return (
    <Page testID="product-form">
      {err ? <ErrorBox text={err} /> : null}
      {!id ? (
        <>
          <SectionTitle title={sec(1, "Shop", "দোকান")} />
          <Card>
            {label(L("Which shop sells it?", "কোন দোকান বিক্রি করবে?"))}
            <SearchBox value={shopQ} onChange={setShopQ} placeholder={L("Find a shop", "দোকান খুঁজুন")} testID="product-form-shop-search" />
            <ChipRow>
              <Chip label={L("Farmers (admin)", "ফার্মার্স (অ্যাডমিন)")} on={!f.storeId} onPress={() => set("storeId")("")} />
              {storeList.map((s) => <Chip key={s.id} testID={`pick-shop-${s.id}`} label={s.name} on={f.storeId === s.id} onPress={() => set("storeId")(s.id)} />)}
            </ChipRow>
          </Card>
        </>
      ) : null}
      <SectionTitle title={sec(2, "Basics", "মূল তথ্য")} />
      <Card>
        {label(L("Photo", "ছবি"))}
        <View style={[st.row, { marginBottom: 12 }]}>
          <Thumb uri={f.image} size={72} />
          <Btn kind="ghost" small icon="image" busy={upl} label={f.image ? L("Change photo", "ছবি বদলান") : L("Add photo", "ছবি যোগ করুন")}
            onPress={async () => { setUpl(true); try { const u = await pickAndUpload(); if (u) set("image")(u); } catch (e: any) { setErr(e?.message); } finally { setUpl(false); } }} />
          {f.image ? <Btn kind="ghost" small icon="x" label={L("Remove", "সরান")} onPress={() => set("image")("")} /> : null}
        </View>
        <Field testID="pf-name" label={L("Product name", "পণ্যের নাম")} value={f.name} onChange={set("name")} maxLength={120} placeholder={L("e.g. Miniket rice", "যেমন: মিনিকেট চাল")} />
        {label(L("Category", "ক্যাটাগরি"))}
        <View style={[st.grid, { marginBottom: 4, gap: 8 }]}>
          {(cats.data || []).map((c) => <Chip key={c.id} testID={`pf-cat-${c.slug}`} label={L(c.nameEn, c.nameBn)} color={c.color} on={f.category === c.slug} onPress={() => set("category")(c.slug)} />)}
        </View>
      </Card>

      <SectionTitle title={sec(3, "How is it sold?", "কীভাবে বিক্রি হবে?")} />
      <Card testID="pf-sell-as">
        {!id ? (
          <View testID="pf-templates">
            {label(L("Quick start (optional)", "দ্রুত শুরু (ঐচ্ছিক)"), L("Tap one to fill the settings below. You can change anything after.", "একটি ট্যাপ করলে নিচের সেটিং পূরণ হবে। পরে সব বদলাতে পারবেন।"))}
            <ChipRow>
              {TEMPLATES.map((t) => <Chip key={t.key} testID={`pf-tpl-${t.key}`} label={L(t.en, t.bn)} on={tpl === t.key} onPress={() => applyTemplate(t)} />)}
            </ChipRow>
            {tpl ? <Note tone="ok" icon="check" text={L("Filled in. Now add the price and stock, and check the rest.", "পূরণ হয়েছে। এখন দাম ও স্টক দিন, বাকিটা দেখে নিন।")} testID="pf-tpl-done" /> : null}
          </View>
        ) : null}
        {label(L("Sold by", "যেভাবে বিক্রি"))}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Tile testID="sell-weight" on={sellAs === "weight"} icon="activity" title={L("By weight", "ওজনে")} sub={L("kg, gram, maund, ton", "কেজি, গ্রাম, মণ, টন")} onPress={() => pickSellAs("weight")} />
          <Tile testID="sell-pack" on={sellAs === "pack"} icon="package" title={L("In packs", "প্যাকেটে")} sub={L("Bag, sack, bottle, jar… with a fixed amount inside", "ব্যাগ, বস্তা, বোতল, জার… ভেতরে নির্দিষ্ট পরিমাণ")} onPress={() => pickSellAs("pack")} />
          <Tile testID="sell-piece" on={sellAs === "piece"} icon="box" title={L("By piece", "পিস হিসেবে")} sub={L("Each one, e.g. a fish, a plant, fish fry", "প্রতিটি, যেমন মাছ, চারা, পোনা")} onPress={() => pickSellAs("piece")} />
          <Tile testID="sell-dozen" on={sellAs === "dozen"} icon="grid" title={L("Dozen, hali or pair", "ডজন, হালি বা জোড়া")} sub={L("12, 4 or 2 pieces, e.g. eggs", "১২, ৪ বা ২টি, যেমন ডিম")} onPress={() => pickSellAs("dozen")} />
          <Tile testID="sell-volume" on={sellAs === "volume"} icon="droplet" title={L("By litre", "লিটারে")} sub={L("Litre or ml, e.g. milk, oil, BKC", "লিটার বা মিলি, যেমন দুধ, তেল, বিকেসি")} onPress={() => pickSellAs("volume")} />
        </View>
        <View style={{ height: 14 }} />
        {SELL_UNITS[sellAs].length > 1 ? (
          <>
            {label(sellAs === "pack" ? L("What kind of pack?", "কোন ধরনের প্যাক?") : L("Price is per", "দাম যে এককে"))}
            <Wrap>{SELL_UNITS[sellAs].map((u) => <Chip key={u} testID={`pf-unit-${u}`} label={unitChip(u, L)} on={f.unit === u} onPress={() => pickUnit(u)} />)}</Wrap>
          </>
        ) : null}
        <Note text={unitMeaning(sellAs, f.unit, L)} testID="pf-unit-meaning" />
        {conv ? (
          <View testID="pf-convert" style={{ padding: 12, borderRadius: 12, backgroundColor: theme.primary + "12", marginBottom: 12, gap: 8 }}>
            <Text style={{ color: theme.text, fontSize: 13 }}>
              {L(`You changed ${unitName(conv.from, L)} to ${unitName(conv.to, L)}. Change the price, stock and order numbers to match?`,
                `${unitName(conv.from, L)} থেকে ${unitName(conv.to, L)} করেছেন। দাম, স্টক ও অর্ডারের সংখ্যাগুলোও মিলিয়ে বদলাবেন?`)}
            </Text>
            <View style={[st.row, { gap: 8, flexWrap: "wrap" }]}>
              <Btn small testID="pf-convert-yes" icon="refresh-cw" label={L("Yes, convert", "হ্যাঁ, বদলান")} onPress={applyConversion} />
              <Btn small kind="ghost" testID="pf-convert-no" label={L("Keep my numbers", "আমার সংখ্যা রাখুন")} onPress={() => setConv(null)} />
            </View>
          </View>
        ) : null}
        {sellAs === "pack" ? (
          <>
            {label(L(`What's inside one ${unitLabel}?`, `এক ${unitLabel}-এ কী পরিমাণ থাকে?`))}
            <Wrap>{PACK_CONTENT.map((u) => <Chip key={u} testID={`pf-pack-unit-${u}`} label={unitName(u, L)} on={f.packUnit === u} onPress={() => set("packUnit")(u)} />)}</Wrap>
            <Field testID="pf-pack-size" label={L(`Amount (${unitName(f.packUnit, L)})`, `পরিমাণ (${unitName(f.packUnit, L)})`)} value={f.packSize} onChange={set("packSize")} keyboardType="numeric" placeholder={packSizes[0] ? String(packSizes[0]) : "5"} />
            {fieldErr("packSize")}
            {packSizes.length ? <Wrap>{packSizes.map((v) => <Chip key={v} testID={`pf-pack-size-${v}`} label={`${N(v)} ${unitName(f.packUnit, L)}`} on={Number(f.packSize) === v} onPress={() => set("packSize")(String(v))} />)}</Wrap> : null}
            {Number(f.packSize) > 0 ? <Note tone="ok" icon="package" text={L(`One ${unitLabel} holds ${n2s(Number(f.packSize))} ${unitName(f.packUnit, L)}.`, `এক ${unitLabel}-এ ${N(n2s(Number(f.packSize)))} ${unitName(f.packUnit, L)} থাকে।`)} testID="pf-pack-sentence" /> : null}
          </>
        ) : null}
      </Card>

      <SectionTitle title={sec(4, "Price and stock", "দাম ও স্টক")} />
      <Card>
        <Field testID="pf-price" label={L(`Price for 1 ${unitLabel}`, `১ ${unitLabel}-এর দাম`)} prefix="৳" value={f.price} onChange={set("price")} keyboardType="numeric" placeholder={L("e.g. 80", "যেমন ৮০")} />
        {fieldErr("price")}
        {priceAlso.length ? <Note icon="repeat" text={L("Same as ", "অর্থাৎ ") + priceAlso.join(" · ")} testID="pf-price-also" /> : null}
        <Field testID="pf-qty" label={L(`Stock: how many ${unitLabel} do you have?`, `স্টক: আপনার কাছে কত ${unitLabel} আছে?`)} value={f.quantity} onChange={set("quantity")} keyboardType="numeric"
          hint={L("Buyers can't order more than this. 0 means out of stock.", "ক্রেতারা এর বেশি অর্ডার করতে পারবেন না। ০ মানে স্টক নেই।")} />
        {fieldErr("quantity")}
        {stockAll ? <Note icon="layers" text={stockAll} testID="pf-stock-all" /> : null}
      </Card>

      <SectionTitle title={sec(5, "How much can buyers order?", "ক্রেতা কতটুকু অর্ডার করতে পারবেন?")} />
      <Card testID="pf-order-rules">
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginBottom: 12 }}>
          {L("All optional. Leave them empty and buyers can order any amount, one at a time.", "সবগুলো ঐচ্ছিক। খালি রাখলে ক্রেতারা একটি একটি করে যেকোনো পরিমাণ অর্ডার করতে পারবেন।")}
        </Text>
        {label(L(`Each + adds (${unitLabel})`, `প্রতি + চাপলে যোগ হবে (${unitLabel})`), partOk ? L(`e.g. 0.5 lets buyers pick 1, 1.5, 2 ${unitLabel}…`, `যেমন ০.৫ দিলে ক্রেতা ১, ১.৫, ২ ${unitLabel}… নিতে পারবেন`) : L(`Whole ${unitLabel} only`, `শুধু পূর্ণ ${unitLabel}`))}
        <Wrap>
          {stepChoices(f.unit).map((v) => <Chip key={v} testID={`pf-step-${v}`} label={`${N(v)} ${unitLabel}`} on={!customStep && stepN === v && (!!f.step || v === 1)} onPress={() => { setCustomStep(false); set("step")(v === 1 ? "" : String(v)); }} />)}
          <Chip testID="pf-step-custom" label={L("Other", "অন্য")} on={customStep} onPress={() => setCustomStep(true)} />
        </Wrap>
        {customStep ? <Field testID="pf-step" label={L(`Other amount (${unitLabel})`, `অন্য পরিমাণ (${unitLabel})`)} value={f.step} onChange={set("step")} keyboardType="numeric" placeholder="1" /> : null}
        {fieldErr("step")}
        <View style={[st.row, { alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <Field testID="pf-min" label={L("Minimum order", "সর্বনিম্ন অর্ডার")} value={f.minOrder} onChange={set("minOrder")} keyboardType="numeric" placeholder={n2s(stepN)}
              hint={L(`The least one buyer can order. Empty = ${n2s(stepN)} ${unitLabel}`, `একজন ক্রেতা সবচেয়ে কম যতটুকু নিতে পারবেন। খালি = ${N(n2s(stepN))} ${unitLabel}`)} />
            {fieldErr("minOrder")}
          </View>
          <View style={{ flex: 1 }}>
            <Field testID="pf-max" label={L("Maximum per order", "প্রতি অর্ডারে সর্বোচ্চ")} value={f.maxOrder} onChange={set("maxOrder")} keyboardType="numeric" placeholder={L("No limit", "সীমা নেই")}
              hint={L("The most one buyer can order at once. Empty = no limit", "একজন ক্রেতা একবারে সবচেয়ে বেশি যতটুকু নিতে পারবেন। খালি = সীমা নেই")} />
            {fieldErr("maxOrder")}
          </View>
        </View>
        {label(L("Quick buttons (optional)", "দ্রুত বোতাম (ঐচ্ছিক)"), L("Ready amounts buyers can tap, up to 6", "ক্রেতারা ট্যাপ করে নিতে পারবেন এমন পরিমাণ, সর্বোচ্চ ৬টি"))}
        <Wrap>
          {presetList.map((v, i) => (
            <Pressable key={`${v}-${i}`} testID={`pf-preset-${v}`} onPress={() => removePreset(v)} accessibilityLabel={L(`Remove ${v}`, `${v} সরান`)}
              style={[st.chip, { borderColor: badPresets.includes(v) ? theme.error : theme.primary + "66", backgroundColor: badPresets.includes(v) ? theme.error + "12" : theme.primary + "10" }]}>
              <Text style={{ color: badPresets.includes(v) ? theme.error : theme.text, fontWeight: "700", fontSize: 13 }}>{N(Number.isFinite(v) ? n2s(v) : "?")} {unitLabel}</Text>
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>
          ))}
          {!presetList.length ? <Text style={{ color: theme.textTertiary, fontSize: 12.5, paddingVertical: 8 }}>{L("No quick buttons yet", "এখনো কোনো দ্রুত বোতাম নেই")}</Text> : null}
        </Wrap>
        <View style={[st.row, { gap: 8, alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}><Field testID="pf-preset-input" label={L(`Add an amount (${unitLabel})`, `পরিমাণ যোগ করুন (${unitLabel})`)} value={addQ} onChange={setAddQ} keyboardType="numeric" placeholder={n2s(minN)} /></View>
          <View style={{ paddingTop: 24, flexDirection: "row", gap: 8 }}>
            <Btn small icon="plus" testID="pf-preset-add" label={L("Add", "যোগ")} disabled={!(Number(addQ) > 0) || presetList.length >= 6} onPress={addPreset} />
            <Btn small kind="soft" icon="zap" testID="pf-preset-suggest" label={L("Suggest", "সাজেস্ট")} disabled={!rulesOk} onPress={suggest} />
          </View>
        </View>
        {fieldErr("presets")}
        {summary ? <Note tone="ok" icon="check-circle" text={summary} testID="pf-rule-summary" /> : null}

        <View testID="pf-preview" style={{ marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: theme.primary + "10" }}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{L("Try it like a buyer", "ক্রেতার মতো চেষ্টা করুন")}</Text>
          <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16, marginTop: 2 }}>
            {price ? tk(price) : "৳ —"} / {unitLabel}{sellAs === "pack" && Number(f.packSize) > 0 ? ` (${N(n2s(Number(f.packSize)))} ${unitName(f.packUnit, L)})` : ""}{sellAs === "dozen" && SET_SIZE[f.unit] ? ` (${N(SET_SIZE[f.unit])} ${L("pieces", "পিস")})` : ""}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 2 }}>
            {stockN > 0 ? L(`${n2s(stockN)} ${unitLabel} in stock`, `স্টকে ${N(n2s(stockN))} ${unitLabel}`) : L("Out of stock (shown here as if in stock)", "স্টক নেই (এখানে স্টক আছে ধরে দেখানো হচ্ছে)")}
            {f.organic ? ` · ${L("Organic", "জৈব")}` : ""}{f.grade ? ` · ${f.grade}` : ""}
          </Text>
          {rulesOk && hi >= tryRule.min ? (
            <>
              <View style={[st.row, { marginTop: 10, gap: 10 }]}>
                <Pressable testID="pf-try-minus" onPress={() => setTryQ(clampQty(tryRule, q - tryRule.step))} disabled={q <= tryRule.min}
                  style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.card, opacity: q <= tryRule.min ? 0.4 : 1 }}>
                  <Feather name="minus" size={16} color={theme.text} />
                </Pressable>
                <Text testID="pf-try-qty" style={{ color: theme.text, fontWeight: "800", fontSize: 15, minWidth: 70, textAlign: "center" }}>{N(n2s(q))} {unitLabel}</Text>
                <Pressable testID="pf-try-plus" onPress={() => setTryQ(clampQty(tryRule, q + tryRule.step))} disabled={q >= hi}
                  style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary, opacity: q >= hi ? 0.4 : 1 }}>
                  <Feather name="plus" size={16} color="#fff" />
                </Pressable>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  {price ? <Text testID="pf-try-total" style={{ color: theme.primary, fontWeight: "800", fontSize: 15 }}>{tk(price * q)}</Text> : null}
                  {totalContentText(tryRule, q, bn) ? <Text style={{ color: theme.textSecondary, fontSize: 11.5 }}>{totalContentText(tryRule, q, bn)}</Text> : null}
                </View>
              </View>
              {tryRule.presets.length ? (
                <View style={[st.row, { gap: 6, flexWrap: "wrap", marginTop: 10 }]}>
                  {tryRule.presets.map((v) => (
                    <Pressable key={v} onPress={() => setTryQ(v)} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: q === v ? theme.primary : theme.primary + "55", backgroundColor: q === v ? theme.primary + "18" : "transparent" }}>
                      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 12.5 }}>{N(n2s(v))} {unitLabel}</Text>
                      {price ? <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{tk(price * v)}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={{ color: theme.error, fontSize: 12.5, marginTop: 8 }}>
              {rulesOk ? L("With this stock and maximum, buyers can't order the minimum.", "এই স্টক ও সর্বোচ্চ দিয়ে ক্রেতারা সর্বনিম্ন পরিমাণও নিতে পারবেন না।") : L("Fix the order rules above to try it.", "চেষ্টা করতে উপরের অর্ডারের নিয়ম ঠিক করুন।")}
            </Text>
          )}
        </View>
      </Card>

      <SectionTitle title={sec(6, "More details", "আরও তথ্য")} />
      <Card>
        <ToggleRow testID="pf-organic" icon="feather" label={L("Organic / no chemicals", "জৈব / রাসায়নিক মুক্ত")} value={!!f.organic} onChange={set("organic")} />
        {!more ? (
          <Pressable testID="pf-more" onPress={() => setMore(true)} style={[st.row, { gap: 6, paddingVertical: 10 }]}>
            <Feather name="plus-circle" size={16} color={theme.primary} />
            <Text style={{ color: theme.primary, fontWeight: "700" }}>{L("Add grade, variety, origin, harvest date and storage", "গ্রেড, জাত, উৎস, সংগ্রহের তারিখ ও সংরক্ষণ যোগ করুন")}</Text>
          </Pressable>
        ) : (
          <>
            {label(L("Grade", "গ্রেড"))}
            <ChipRow>{GRADES.map((g) => <Chip key={g} label={g} on={f.grade === g} onPress={() => set("grade")(f.grade === g ? "" : g)} />)}</ChipRow>
            <Field testID="pf-variety" label={L("Variety or breed", "জাত")} value={f.variety} onChange={set("variety")} maxLength={80} placeholder={L("e.g. BRRI dhan 28, Rui", "যেমন: ব্রি ধান ২৮, রুই")} />
            <Field testID="pf-origin" label={L("Where it's from", "কোথা থেকে")} value={f.origin} onChange={set("origin")} maxLength={80} placeholder={L("e.g. Dinajpur", "যেমন: দিনাজপুর")} />
            <Field testID="pf-harvest" label={L("Harvest or packing date (YYYY-MM-DD)", "সংগ্রহ বা প্যাকিংয়ের তারিখ (YYYY-MM-DD)")} value={f.harvestDate} onChange={set("harvestDate")} maxLength={10} placeholder="2026-10-20" />
            {fieldErr("harvestDate")}
            <Field testID="pf-shelf" label={L("Stays fresh for", "কতদিন ভালো থাকে")} value={f.shelfLife} onChange={set("shelfLife")} maxLength={80} placeholder={L("e.g. 7 days", "যেমন: ৭ দিন")} />
            <Field testID="pf-storage" label={L("How to store", "কীভাবে সংরক্ষণ করবেন")} value={f.storage} onChange={set("storage")} maxLength={80} placeholder={L("e.g. Keep dry and cool", "যেমন: শুকনো ও ঠান্ডা জায়গায়")} />
          </>
        )}
        <Field label={L("Location", "লোকেশন")} value={f.location} onChange={set("location")} maxLength={120} />
        <Field testID="pf-desc" label={L("Description", "বিবরণ")} value={f.description} onChange={set("description")} multiline maxLength={2000} />
        <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{L("Delivery charges are the same for every product. Change them in More, Delivery charges.", "ডেলিভারি চার্জ সব পণ্যে একই। আরও > ডেলিভারি চার্জ থেকে বদলান।")}</Text>
      </Card>
      {tried && errors.length ? (
        <View testID="pf-errors" style={{ gap: 4, marginBottom: 10 }}>
          <Text style={{ color: theme.error, fontWeight: "700", fontSize: 13 }}>{L("Fix these first:", "আগে এগুলো ঠিক করুন:")}</Text>
          {errors.map((e) => <Text key={e} style={{ color: theme.error, fontSize: 12.5 }}>• {e}</Text>)}
        </View>
      ) : null}
      <Btn testID="save-product" icon="check" label={id ? L("Save changes", "পরিবর্তন সংরক্ষণ") : L("Add product", "পণ্য যোগ করুন")} busy={busy} onPress={save} />
    </Page>
  );
}
