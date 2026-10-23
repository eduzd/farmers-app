// Admin: daily market prices (বাজার দর). Pick a district and day, add or edit products' lowest and highest
// prices, copy the last day's list as a start, and delete mistakes. Buyers and farmers see these on the
// Market prices board, and matching price alerts fire when today's prices are saved.
import React, { useMemo, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BD_DISTRICTS, PRICE_CATEGORY_LABELS, PRICE_UNIT_LABELS, categoryLabel, unitLabel, districtLabel } from "@/lib/marketPriceApi";
import { Page, Card, SectionTitle, Chip, ChipRow, Btn, Field, Empty, Loading, ErrorBox, SearchBox, Text, useL, useLoader, confirmAsk, st, taka } from "./ui";

type Row = { id: string; itemKey: string; nameEn: string; nameBn: string; category: string; unit: string; district: string; market: string; min: number; max: number; avg: number; date: string };
type ListResp = { date: string; district: string; rows: Row[]; recentDays: { date: string; count: number }[]; today: string };
const todayBD = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
const shift = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const blank = { id: "", nameEn: "", nameBn: "", category: "vegetables", unit: "kg", market: "", min: "", max: "" };

export function MarketPricesAdmin() {
  const { theme } = useTheme();
  const L = useL();
  const { language } = useI18n();
  const bn = language === "bn";
  const [district, setDistrict] = useState("Dhaka");
  const [date, setDate] = useState(todayBD());
  const [pickDistrict, setPickDistrict] = useState(false);
  const [dq, setDq] = useState("");
  const [form, setForm] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const list = useLoader<ListResp>(() => apiGet(`/api/admin/manage/market-prices?district=${encodeURIComponent(district)}&date=${date}`), [district, date]);
  const used = useLoader<{ itemKey: string; nameEn: string; nameBn: string; category: string; unit: string }[]>(() => apiGet("/api/admin/manage/market-prices/items"), []);
  const today = todayBD();
  const rows = list.data?.rows || [];

  const districts = useMemo(() => {
    const q = dq.trim().toLowerCase();
    return BD_DISTRICTS.filter(([en, b]) => !q || en.toLowerCase().includes(q) || b.includes(q));
  }, [dq]);
  const suggestions = useMemo(() => {
    if (!form || form.id) return [];
    const q = form.nameEn.trim().toLowerCase();
    const have = new Set(rows.map((r) => r.itemKey));
    return (used.data || []).filter((u) => !have.has(u.itemKey) && (!q || u.nameEn.toLowerCase().includes(q) || u.nameBn.includes(form.nameEn.trim()))).slice(0, 8);
  }, [form, used.data, rows]);

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key); setErr(null); setMsg(null);
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || L("Couldn't save. Try again.", "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।"));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      if (!form) return;
      const body = { nameEn: form.nameEn.trim(), nameBn: form.nameBn.trim(), category: form.category, unit: form.unit, market: form.market.trim(), min: Number(form.min), max: form.max === "" ? Number(form.min) : Number(form.max), district, date };
      if (form.id) {
        const r: any = await apiPut(`/api/admin/manage/market-prices/${form.id}`, body);
        setMsg(L(`Saved ${body.nameEn}.`, `${body.nameBn || body.nameEn} সংরক্ষিত।`) + (r?.alertsFired ? L(` ${r.alertsFired} price alert(s) sent.`, ` ${r.alertsFired}টি দামের অ্যালার্ট গেছে।`) : ""));
      } else {
        const r: any = await apiPost("/api/admin/manage/market-prices", body);
        setMsg(L(`Added ${body.nameEn}.`, `${body.nameBn || body.nameEn} যোগ হয়েছে।`) + (r?.alertsFired ? L(` ${r.alertsFired} price alert(s) sent.`, ` ${r.alertsFired}টি দামের অ্যালার্ট গেছে।`) : ""));
      }
      setForm(null);
      await Promise.all([list.load(), used.load()]);
    });

  const remove = async (r: Row) => {
    const yes = await confirmAsk(L("Delete price", "দর মুছুন"), L(`Delete ${r.nameEn} for this day?`, `এই দিনের ${r.nameBn} এর দর মুছবেন?`), L("Delete", "মুছুন"), L("Cancel", "বাতিল"));
    if (!yes) return;
    await run(`del-${r.id}`, async () => {
      await apiDelete(`/api/admin/manage/market-prices/${r.id}`);
      await list.load();
    });
  };

  const copyLast = () =>
    run("copy", async () => {
      const r: any = await apiPost("/api/admin/manage/market-prices/copy", { district, toDate: date });
      setMsg(L(`Copied ${r.copied} price(s) from ${r.fromDate}. Edit any that changed.`, `${r.fromDate} থেকে ${r.copied}টি দর কপি হয়েছে। যেগুলো বদলেছে সেগুলো ঠিক করুন।`));
      await list.load();
    });

  const set = (k: keyof typeof blank, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dateLabel = date === today ? L("Today", "আজ") : date === shift(today, -1) ? L("Yesterday", "গতকাল") : date;

  return (
    <Page testID="admin-market-prices" onRefresh={list.load} refreshing={list.loading}>
      {err ? <ErrorBox text={err} /> : null}
      {msg ? (
        <View style={[st.row, { gap: 8, marginBottom: 10 }]} testID="mp-msg">
          <Feather name="check-circle" size={16} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: "700", flex: 1 }}>{msg}</Text>
        </View>
      ) : null}

      <Card>
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginBottom: 10 }}>
          {L(
            "Post each day's lowest and highest price for a district. Farmers and buyers see them on the Market prices board, with the change from the last day. When you save today's prices, people's matching price alerts are sent.",
            "প্রতিদিন একটি জেলার সর্বনিম্ন ও সর্বোচ্চ দর দিন। কৃষক ও ক্রেতারা বাজার দর পাতায় আগের দিনের তুলনাসহ দেখবেন। আজকের দর সংরক্ষণ করলে মিলে যাওয়া দামের অ্যালার্ট চলে যায়।",
          )}
        </Text>
        <View style={[st.row, { gap: 10 }]}>
          <Pressable onPress={() => setPickDistrict((v) => !v)} testID="mp-district" style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 10 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 11.5 }}>{L("District", "জেলা")}</Text>
            <View style={[st.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontWeight: "800", fontSize: 15 }}>{districtLabel(district, bn)}</Text>
              <Feather name={pickDistrict ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
            </View>
          </Pressable>
          <View style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 10 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 11.5 }}>{L("Day", "দিন")}</Text>
            <View style={[st.row, { justifyContent: "space-between" }]}>
              <Pressable onPress={() => setDate(shift(date, -1))} hitSlop={10} testID="mp-day-prev">
                <Feather name="chevron-left" size={18} color={theme.text} />
              </Pressable>
              <Text style={{ fontWeight: "800", fontSize: 15 }} testID="mp-day">{dateLabel}</Text>
              <Pressable onPress={() => date < today && setDate(shift(date, 1))} hitSlop={10} testID="mp-day-next" disabled={date >= today}>
                <Feather name="chevron-right" size={18} color={date >= today ? theme.border : theme.text} />
              </Pressable>
            </View>
          </View>
        </View>
        {pickDistrict ? (
          <View style={{ marginTop: 10 }}>
            <SearchBox value={dq} onChange={setDq} placeholder={L("Search districts", "জেলা খুঁজুন")} testID="mp-district-search" />
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 8 }}>
                {districts.map(([en, b]) => (
                  <Chip key={en} label={bn ? b : en} on={district === en} onPress={() => { setDistrict(en); setPickDistrict(false); setDq(""); }} testID={`mp-d-${en}`} />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Card>

      <SectionTitle
        title={L(`${rows.length} price(s) · ${districtLabel(district, false)}`, `${rows.length}টি দর · ${districtLabel(district, true)}`)}
        action={form ? undefined : L("Add price", "দর যোগ করুন")}
        onAction={() => { setForm({ ...blank }); setMsg(null); }}
        testID="mp-add"
      />

      {form ? (
        <Card testID="mp-form">
          <Text style={{ fontWeight: "800", fontSize: 15, marginBottom: 6 }}>{form.id ? L("Edit price", "দর বদলান") : L("New price", "নতুন দর")}</Text>
          <Field label={L("Product name (English)", "পণ্যের নাম (ইংরেজিতে)")} value={form.nameEn} onChange={(v) => set("nameEn", v)} placeholder="Rui fish" testID="mp-name-en" maxLength={80} />
          {suggestions.length ? (
            <ChipRow>
              {suggestions.map((s) => (
                <Chip key={s.itemKey} label={bn ? s.nameBn : s.nameEn} on={false} onPress={() => setForm((f) => (f ? { ...f, nameEn: s.nameEn, nameBn: s.nameBn, category: s.category, unit: s.unit } : f))} testID={`mp-suggest-${s.itemKey}`} />
              ))}
            </ChipRow>
          ) : null}
          <Field label={L("Product name (Bangla)", "পণ্যের নাম (বাংলায়)")} value={form.nameBn} onChange={(v) => set("nameBn", v)} placeholder="রুই মাছ" testID="mp-name-bn" maxLength={80} />
          <Text style={[st.label, { color: theme.textSecondary, marginTop: 4 }]}>{L("Category", "ধরন")}</Text>
          <ChipRow>
            {Object.keys(PRICE_CATEGORY_LABELS).map((c) => (
              <Chip key={c} label={categoryLabel(c, bn)} on={form.category === c} onPress={() => set("category", c)} testID={`mp-cat-${c}`} />
            ))}
          </ChipRow>
          <Text style={[st.label, { color: theme.textSecondary, marginTop: 4 }]}>{L("Price per", "দাম প্রতি")}</Text>
          <ChipRow>
            {Object.keys(PRICE_UNIT_LABELS).map((u) => (
              <Chip key={u} label={unitLabel(u, bn)} on={form.unit === u} onPress={() => set("unit", u)} testID={`mp-unit-${u}`} />
            ))}
          </ChipRow>
          <View style={[st.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Field label={L("Lowest ৳", "সর্বনিম্ন ৳")} value={String(form.min)} onChange={(v) => set("min", v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" testID="mp-min" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={L("Highest ৳", "সর্বোচ্চ ৳")} value={String(form.max)} onChange={(v) => set("max", v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" testID="mp-max" hint={L("Leave empty if one price", "এক দাম হলে খালি রাখুন")} />
            </View>
          </View>
          <Field label={L("Market (optional)", "বাজার (ইচ্ছামতো)")} value={form.market} onChange={(v) => set("market", v)} placeholder="Karwan Bazar" testID="mp-market" maxLength={80} />
          <View style={[st.row, { gap: 10, marginTop: 6 }]}>
            <Btn label={L("Cancel", "বাতিল")} kind="ghost" onPress={() => setForm(null)} style={{ flex: 1 }} testID="mp-cancel" />
            <Btn label={L("Save", "সংরক্ষণ")} icon="check" onPress={save} busy={busy === "save"} disabled={!form.nameEn.trim() || !(Number(form.min) > 0)} style={{ flex: 1 }} testID="mp-save" />
          </View>
        </Card>
      ) : null}

      {list.loading && !list.data ? (
        <Loading />
      ) : list.error && !list.data ? (
        <ErrorBox text={list.error} onRetry={list.load} />
      ) : rows.length === 0 ? (
        <Card>
          <Empty icon="bar-chart-2" text={L("No prices for this district and day yet.", "এই জেলা ও দিনের কোনো দর এখনো নেই।")} />
          <Btn label={L("Copy the last day's prices", "আগের দিনের দর কপি করুন")} icon="copy" kind="soft" onPress={copyLast} busy={busy === "copy"} testID="mp-copy" />
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id} testID={`mp-row-${r.itemKey}`}>
            <View style={[st.row, { justifyContent: "space-between" }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontWeight: "800", fontSize: 15 }} numberOfLines={1}>{bn ? r.nameBn : r.nameEn}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {(bn ? r.nameEn : r.nameBn) + " · " + categoryLabel(r.category, bn)}{r.market ? ` · ${r.market}` : ""}
                </Text>
              </View>
              <Text style={{ fontWeight: "800", fontSize: 15 }}>
                {taka(r.min)}{r.max !== r.min ? `–${taka(r.max).slice(1)}` : ""}
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "500" }}>/{unitLabel(r.unit, bn)}</Text>
              </Text>
            </View>
            <View style={[st.row, { gap: 8, marginTop: 10 }]}>
              <Btn small kind="soft" icon="edit-2" label={L("Edit", "বদলান")} onPress={() => { setForm({ id: r.id, nameEn: r.nameEn, nameBn: r.nameBn, category: r.category, unit: r.unit, market: r.market, min: String(r.min), max: String(r.max) }); setMsg(null); }} testID={`mp-edit-${r.itemKey}`} />
              <Btn small kind="dangerSoft" icon="trash-2" label={L("Delete", "মুছুন")} onPress={() => remove(r)} busy={busy === `del-${r.id}`} testID={`mp-del-${r.itemKey}`} />
            </View>
          </Card>
        ))
      )}

      {(list.data?.recentDays || []).length ? (
        <>
          <SectionTitle title={L("Recent days", "সাম্প্রতিক দিন")} />
          <ChipRow>
            {(list.data?.recentDays || []).map((d) => (
              <Chip key={d.date} label={`${d.date === today ? L("Today", "আজ") : d.date}`} count={d.count} on={d.date === date} onPress={() => setDate(d.date)} testID={`mp-recent-${d.date}`} />
            ))}
          </ChipRow>
        </>
      ) : null}
    </Page>
  );
}
