// Market prices board (বাজার দর): real prices admins post each day per district, with the change from the
// day before, a 30-day chart per product, and a shortcut to set a price alert. No sample numbers.
import React, { useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Platform } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import {
  fetchMarketMeta,
  fetchMarketPrices,
  fetchPriceHistory,
  categoryLabel,
  unitLabel,
  bnNum,
  dayLabel,
  districtLabel,
  type MarketPrice,
} from "@/lib/marketPriceApi";

function History({ item, today, bn }: { item: MarketPrice; today: string; bn: boolean }) {
  const { theme } = useTheme();
  const q = useQuery({ queryKey: ["market-history", item.itemKey, item.district], queryFn: () => fetchPriceHistory(item.itemKey, item.district) });
  const pts = q.data?.points || [];
  if (q.isLoading) return <ActivityIndicator color={theme.primary} style={{ marginVertical: Spacing.md }} />;
  if (pts.length < 2)
    return (
      <ThemedText style={[styles.small, { color: theme.textSecondary, marginTop: Spacing.sm }]} testID="price-history-empty">
        {bn ? "চার্ট দেখাতে অন্তত দুই দিনের দর লাগবে।" : "The chart needs prices from at least two days."}
      </ThemedText>
    );
  const hi = Math.max(...pts.map((p) => p.max));
  const lo = Math.min(...pts.map((p) => p.min));
  const span = Math.max(1, hi - lo);
  return (
    <View style={{ marginTop: Spacing.md }} testID="price-history">
      <View style={styles.chart}>
        {pts.map((p) => {
          const h = 14 + ((p.avg - lo) / span) * 56;
          const last = p.date === pts[pts.length - 1].date;
          return (
            <View key={p.id} style={styles.barWrap}>
              <View style={[styles.bar, { height: h, backgroundColor: last ? theme.primary : theme.primary + "55" }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.rowBetween}>
        <ThemedText style={[styles.tiny, { color: theme.textSecondary }]}>{dayLabel(pts[0].date, today, bn)}</ThemedText>
        <ThemedText style={[styles.tiny, { color: theme.textSecondary }]}>
          {bn ? "সর্বনিম্ন" : "Low"} ৳{bnNum(lo, bn)} · {bn ? "সর্বোচ্চ" : "High"} ৳{bnNum(hi, bn)}
        </ThemedText>
        <ThemedText style={[styles.tiny, { color: theme.textSecondary }]}>{dayLabel(pts[pts.length - 1].date, today, bn)}</ThemedText>
      </View>
    </View>
  );
}

export default function MarketPricesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { language } = useI18n();
  const bn = language === "bn";
  const myLocation = String((useAuthStore((s: any) => s.user) as any)?.location || "");
  const [district, setDistrict] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const meta = useQuery({ queryKey: ["market-meta"], queryFn: fetchMarketMeta, staleTime: 60000 });
  const districts = meta.data?.districts || [];
  // Default to the user's own district when it has prices, else all districts.
  const mine = districts.find((d) => myLocation && myLocation.toLowerCase().includes(d.district.toLowerCase()));
  const sel = district ?? (mine ? mine.district : "all");
  const prices = useQuery({
    queryKey: ["market-prices", sel, category],
    queryFn: () => fetchMarketPrices(sel, category),
    enabled: !!meta.data,
  });
  const today = prices.data?.today || meta.data?.today || "";
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = prices.data?.items || [];
    return q ? list.filter((i) => i.nameEn.toLowerCase().includes(q) || i.nameBn.toLowerCase().includes(q)) : list;
  }, [prices.data, search]);
  const ups = items.filter((i) => i.trend === "up").length;
  const downs = items.filter((i) => i.trend === "down").length;
  const latest = items.reduce((m, i) => (i.date > m ? i.date : m), "");

  const tap = (k: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setOpen(open === k ? null : k);
  };
  const distName = (d: string) => districtLabel(d, bn);
  const card = { backgroundColor: theme.backgroundDefault, borderColor: theme.border };

  const chip = (key: string, label: string, active: boolean, onPress: () => void, testID: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      testID={testID}
      style={[styles.chip, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : theme.backgroundDefault }]}
    >
      <ThemedText style={[styles.chipText, { color: active ? "#fff" : theme.text }]}>{label}</ThemedText>
    </Pressable>
  );

  const renderItem = (i: MarketPrice, idx: number) => {
    const k = `${i.itemKey}|${i.district}`;
    const up = i.trend === "up";
    const down = i.trend === "down";
    const color = up ? theme.error : down ? theme.success : theme.textSecondary;
    const name = bn ? i.nameBn : i.nameEn;
    const other = bn ? i.nameEn : i.nameBn;
    return (
      <Animated.View key={k} entering={FadeInUp.delay(Math.min(idx, 10) * 30).duration(220)}>
        <Pressable onPress={() => tap(k)} style={({ pressed }) => [styles.item, card, pressed && { opacity: 0.92 }]} testID={`price-item-${i.itemKey}`}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {name}
              </ThemedText>
              <ThemedText style={[styles.small, { color: theme.textSecondary }]} numberOfLines={1}>
                {other && other !== name ? `${other} · ` : ""}
                {distName(i.district)}
                {i.market ? ` · ${i.market}` : ""}
              </ThemedText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <ThemedText style={[styles.price, { color: theme.text }]} testID={`price-range-${i.itemKey}`}>
                ৳{bnNum(i.min, bn)}
                {i.max !== i.min ? `–${bnNum(i.max, bn)}` : ""}
              </ThemedText>
              <ThemedText style={[styles.small, { color: theme.textSecondary }]}>/{unitLabel(i.unit, bn)}</ThemedText>
            </View>
          </View>
          <View style={[styles.rowBetween, { marginTop: Spacing.sm }]}>
            <View style={[styles.trend, { backgroundColor: color + "18" }]} testID={`price-trend-${i.itemKey}`}>
              <Feather name={up ? "trending-up" : down ? "trending-down" : "minus"} size={13} color={color} />
              <ThemedText style={[styles.trendText, { color }]}>
                {i.change === null
                  ? bn
                    ? "নতুন দর"
                    : "New price"
                  : i.change === 0
                    ? bn
                      ? "অপরিবর্তিত"
                      : "No change"
                    : `${up ? "+" : "−"}৳${bnNum(Math.abs(i.change), bn)} (${bnNum(Math.abs(i.changePct || 0), bn)}%)`}
              </ThemedText>
            </View>
            <ThemedText style={[styles.tiny, { color: theme.textSecondary }]}>
              {categoryLabel(i.category, bn)} · {dayLabel(i.date, today, bn)}
            </ThemedText>
          </View>
          {open === k ? (
            <View style={[styles.more, { borderTopColor: theme.border }]}>
              <ThemedText style={[styles.small, { color: theme.textSecondary }]}>
                {bn ? "গড় দাম" : "Average"} ৳{bnNum(i.avg, bn)}
                {i.prevAvg !== null && i.prevDate ? ` · ${dayLabel(i.prevDate, today, bn)} ৳${bnNum(i.prevAvg, bn)}` : ""}
              </ThemedText>
              <History item={i} today={today} bn={bn} />
              <Pressable
                onPress={() => navigation.navigate("PriceAlert")}
                style={[styles.alertBtn, { borderColor: theme.primary }]}
                testID={`price-alert-${i.itemKey}`}
              >
                <Feather name="bell" size={14} color={theme.primary} />
                <ThemedText style={[styles.alertText, { color: theme.primary }]}>
                  {bn ? `"${i.nameBn}" এর দামের অ্যালার্ট দিন` : `Set a price alert for "${i.nameEn}"`}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  };

  const loading = meta.isLoading || (prices.isLoading && !!meta.data);
  return (
    <ThemedView style={{ flex: 1 }} testID="market-prices-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={prices.isRefetching || meta.isRefetching}
            onRefresh={() => {
              void meta.refetch();
              void prices.refetch();
            }}
            tintColor={theme.primary}
          />
        }
      >
        <View style={[styles.hero, { backgroundColor: theme.primary }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.heroTitle}>{bn ? "আজকের বাজার দর" : "Today's market prices"}</ThemedText>
              <ThemedText style={styles.heroSub} testID="market-updated">
                {latest ? `${bn ? "সর্বশেষ দর" : "Latest prices"}: ${dayLabel(latest, today, bn)}` : bn ? "এডমিন প্রতিদিন দর দেন" : "Posted daily by the Farmers team"}
              </ThemedText>
            </View>
            <Feather name="bar-chart-2" size={30} color="rgba(255,255,255,0.85)" />
          </View>
          {items.length ? (
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroNum}>{bnNum(items.length, bn)}</ThemedText>
                <ThemedText style={styles.heroLbl}>{bn ? "পণ্য" : "Products"}</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroNum}>▲ {bnNum(ups, bn)}</ThemedText>
                <ThemedText style={styles.heroLbl}>{bn ? "দাম বেড়েছে" : "Went up"}</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroNum}>▼ {bnNum(downs, bn)}</ThemedText>
                <ThemedText style={styles.heroLbl}>{bn ? "দাম কমেছে" : "Went down"}</ThemedText>
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.search, card]}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={bn ? "পণ্য খুঁজুন (যেমন আলু, রুই)" : "Search products (e.g. potato, rui)"}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            testID="market-search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {districts.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chip("all", bn ? "সব জেলা" : "All districts", sel === "all", () => setDistrict("all"), "market-district-all")}
            {districts.map((d) =>
              chip(d.district, distName(d.district), sel === d.district, () => setDistrict(d.district), `market-district-${d.district}`),
            )}
          </ScrollView>
        ) : null}
        {(meta.data?.categories || []).length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
            {chip("all", bn ? "সব" : "All", category === "all", () => setCategory("all"), "market-cat-all")}
            {(meta.data?.categories || []).map((c) => chip(c, categoryLabel(c, bn), category === c, () => setCategory(c), `market-cat-${c}`))}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: Spacing.lg }}>
          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
          ) : meta.isError || prices.isError ? (
            <View style={styles.empty}>
              <Feather name="wifi-off" size={34} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {bn ? "দর আনা যায়নি। টেনে আবার চেষ্টা করুন।" : "Couldn't load prices. Pull down to try again."}
              </ThemedText>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty} testID="market-empty">
              <Feather name="bar-chart-2" size={34} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {search
                  ? bn
                    ? "এই নামে কোনো দর নেই।"
                    : "No prices match that name."
                  : bn
                    ? "এখনো কোনো দর দেওয়া হয়নি। এডমিন দর দিলে এখানে দেখাবে।"
                    : "No prices posted yet. They'll show here once the Farmers team posts them."}
              </ThemedText>
            </View>
          ) : (
            items.map(renderItem)
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  hero: { margin: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.88)", fontSize: 13, marginTop: 2 },
  heroStats: { flexDirection: "row", marginTop: Spacing.md, gap: Spacing.sm },
  heroStat: { flex: 1, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: BorderRadius.md, paddingVertical: 8, alignItems: "center" },
  heroNum: { color: "#fff", fontSize: 16, fontWeight: "800" },
  heroLbl: { color: "rgba(255,255,255,0.88)", fontSize: 11 },
  search: { flexDirection: "row", alignItems: "center", marginHorizontal: Spacing.lg, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, height: 44, outlineStyle: "none" as any },
  chips: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  item: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { fontSize: 16, fontWeight: "700" },
  price: { fontSize: 17, fontWeight: "800" },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  trend: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  trendText: { fontSize: 12, fontWeight: "700" },
  more: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.md, paddingTop: Spacing.sm },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 74, gap: 3, marginBottom: 4 },
  barWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "100%", maxWidth: 18, borderRadius: 4 },
  alertBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: 9, marginTop: Spacing.md },
  alertText: { fontSize: 13, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 300 },
});
