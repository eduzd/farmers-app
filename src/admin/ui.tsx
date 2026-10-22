import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView, RefreshControl, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { mediaUrl, uploadImage } from "@/lib/api";

import { AppIcon } from "@/components/icons/AppIcon";
/** Shared building blocks for the Farmers Admin app (src/admin). */

export type Route =
  | { name: "product"; id: string }
  | { name: "productForm"; id?: string; storeId?: string }
  | { name: "store"; id: string }
  | { name: "storeForm"; id?: string }
  | { name: "order"; id: string }
  | { name: "user"; id: string }
  | { name: "users" }
  | { name: "thread"; id: string }
  | { name: "categoryForm"; id?: string };
export type TabName = "home" | "shop" | "orders" | "support" | "more";
export type ShopSection = "products" | "shops" | "categories";

export const AdminNav = createContext<{
  push: (r: Route) => void;
  pop: () => void;
  goTab: (t: TabName, shop?: ShopSection) => void;
  refreshBadges: () => void;
  openClassic: (tab: string) => void;
}>({ push: () => {}, pop: () => {}, goTab: () => {}, refreshBadges: () => {}, openClassic: () => {} });
export const useAdminNav = () => useContext(AdminNav);

export function useL() {
  const { language } = useI18n();
  return (en: string, bn: string) => (language === "bn" ? bn : en);
}

export const taka = (n: number) => `৳${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
export const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
export const STATUS_COLOR: Record<string, string> = {
  pending: "#B45309", confirmed: "#1D4ED8", processing: "#6D28D9", shipped: "#0E7490", delivered: "#047857", cancelled: "#B91C1C",
  open: "#047857", closed: "#64748B", active: "#047857", suspended: "#B91C1C", hidden: "#B45309",
};
export const statusLabel = (s: string, L: ReturnType<typeof useL>) =>
  (({
    pending: L("Pending", "অপেক্ষমাণ"), confirmed: L("Confirmed", "নিশ্চিত"), processing: L("Processing", "প্রস্তুত হচ্ছে"), shipped: L("Shipped", "পাঠানো হয়েছে"),
    delivered: L("Delivered", "ডেলিভারি হয়েছে"), cancelled: L("Cancelled", "বাতিল"), open: L("Open", "খোলা"), closed: L("Closed", "বন্ধ"),
    active: L("Active", "সক্রিয়"), suspended: L("Suspended", "স্থগিত"), hidden: L("Hidden", "লুকানো"),
  } as Record<string, string>)[s] || s);

export function fmtDate(isoS?: string | null, withTime = true) {
  if (!isoS) return "";
  const d = new Date(isoS);
  if (isNaN(d.getTime())) return "";
  const date = `${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;
  if (!withTime) return date;
  const h = d.getHours(), m = d.getMinutes();
  return `${date}, ${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function useLoader<T>(fn: () => Promise<T>, deps: any[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await fn();
      if (alive.current) setData(d);
    } catch (e: any) {
      if (alive.current) setError(e?.message || "Failed to load");
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { setLoading(true); load(); }, [load]);
  return { data, loading, error, load, setData };
}

/** Debounced value for search boxes. */
export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function Page({ children, onRefresh, refreshing, testID, pad = true }: { children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean; testID?: string; pad?: boolean }) {
  const { theme } = useTheme();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ padding: pad ? 14 : 0, paddingBottom: 32, width: "100%", maxWidth: 900, alignSelf: "center" }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: any; onPress?: () => void; testID?: string }) {
  const { theme } = useTheme();
  const body = [st.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }, style];
  if (onPress)
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [...body, pressed && { opacity: 0.75 }]}>
        {children}
      </Pressable>
    );
  return <View testID={testID} style={body}>{children}</View>;
}

export function SectionTitle({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  const { theme } = useTheme();
  return (
    <View style={st.sectionRow}>
      <Text style={[st.section, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      {action ? (
        <Pressable testID={testID} onPress={onAction} hitSlop={8}>
          <Text style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[st.pill, { backgroundColor: color + "18" }]}>
      <Text style={{ color, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function Chip({ label, on, onPress, testID, color }: { label: string; on: boolean; onPress: () => void; testID?: string; color?: string }) {
  const { theme } = useTheme();
  const c = color || theme.primary;
  return (
    <Pressable testID={testID} onPress={onPress} style={[st.chip, { borderColor: on ? c : theme.cardBorder, backgroundColor: on ? c + "18" : theme.card }]}>
      <Text style={{ color: on ? c : theme.textSecondary, fontWeight: "700", fontSize: 12.5 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 8 }} style={{ marginBottom: 10, flexGrow: 0 }}>
      {children}
    </ScrollView>
  );
}

export function SearchBox({ value, onChange, placeholder, testID }: { value: string; onChange: (s: string) => void; placeholder: string; testID?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[st.search, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <Feather name="search" size={16} color={theme.textSecondary} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        style={[st.searchInput, { color: theme.text }]}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {value ? (
        <Pressable onPress={() => onChange("")} hitSlop={8}>
          <Feather name="x" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Btn({ label, onPress, icon, kind = "primary", busy, disabled, testID, small, style }: {
  label: string; onPress: () => void; icon?: keyof typeof Feather.glyphMap; kind?: "primary" | "ghost" | "danger" | "soft"; busy?: boolean; disabled?: boolean; testID?: string; small?: boolean; style?: any;
}) {
  const { theme } = useTheme();
  const bg = kind === "primary" ? theme.primary : kind === "danger" ? "#DC2626" : kind === "soft" ? theme.primary + "15" : "transparent";
  const fg = kind === "primary" || kind === "danger" ? "#fff" : theme.primary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [st.btn, small && st.btnSmall, { backgroundColor: bg, borderColor: kind === "ghost" ? theme.cardBorder : bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon ? <AppIcon name={icon} size={small ? 14 : 16} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 12.5 : 14 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, multiline, keyboardType, testID, maxLength }: {
  label: string; value: string; onChange: (s: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: any; testID?: string; maxLength?: number;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[st.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={[st.input, multiline && { minHeight: 84, textAlignVertical: "top" }, { color: theme.text, borderColor: theme.inputBorder, backgroundColor: theme.inputBackground }]}
      />
    </View>
  );
}

export function KV({ k, v, onPress, testID }: { k: string; v: string; onPress?: () => void; testID?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable testID={testID} disabled={!onPress} onPress={onPress} style={st.kv}>
      <Text style={{ color: theme.textSecondary, fontSize: 13, flexShrink: 0, marginRight: 12 }}>{k}</Text>
      <Text style={{ color: onPress ? theme.primary : theme.text, fontSize: 13.5, fontWeight: "600", flex: 1, textAlign: "right" }} numberOfLines={2}>
        {v || "—"}
      </Text>
      {onPress ? <Feather name="chevron-right" size={15} color={theme.primary} style={{ marginLeft: 4 }} /> : null}
    </Pressable>
  );
}

export function Empty({ icon = "inbox", text }: { icon?: keyof typeof Feather.glyphMap; text: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, gap: 10 }}>
      <AppIcon name={icon} size={30} color={theme.textTertiary} />
      <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

export function Loading() {
  const { theme } = useTheme();
  return <ActivityIndicator style={{ marginVertical: 30 }} color={theme.primary} />;
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const L = useL();
  return (
    <View style={[st.error]}>
      <Text style={{ color: "#B91C1C", fontSize: 13, flex: 1 }}>{text}</Text>
      {onRetry ? <Btn small kind="ghost" label={L("Retry", "আবার চেষ্টা")} onPress={onRetry} /> : null}
    </View>
  );
}

export function Thumb({ uri, size = 52, icon = "package" }: { uri?: string | null; size?: number; icon?: keyof typeof Feather.glyphMap }) {
  const { theme } = useTheme();
  const { Image } = require("expo-image");
  return uri ? (
    <Image source={{ uri: mediaUrl(uri) }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: theme.backgroundSecondary }} contentFit="cover" />
  ) : (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: "center", justifyContent: "center" }}>
      <AppIcon name={icon} size={size * 0.4} color={theme.textTertiary} />
    </View>
  );
}

export function Stat({ label, value, icon, color, onPress, testID }: { label: string; value: string | number; icon: keyof typeof Feather.glyphMap; color: string; onPress?: () => void; testID?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.stat, { backgroundColor: theme.card, borderColor: theme.cardBorder, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[st.statIcon, { backgroundColor: color + "18" }]}>
        <AppIcon name={icon} size={17} color={color} />
      </View>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: "800" }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export async function pickAndUpload(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const dataUrl = a.uri.startsWith("data:") ? a.uri : `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`;
  return mediaUrl(await uploadImage(dataUrl));
}

/** Cross-platform confirm (Alert on phones, window.confirm on web). */
export function confirmAsk(title: string, msg: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(typeof window !== "undefined" ? window.confirm(`${title}\n\n${msg}`) : true);
  const { Alert } = require("react-native");
  return new Promise((resolve) =>
    Alert.alert(title, msg, [
      { text: cancel, style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: "destructive", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

export const st = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 8, gap: 10 },
  section: { fontSize: 15.5, fontWeight: "800", flex: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14.5, height: 44, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, height: 44, borderRadius: 12, borderWidth: 1 },
  btnSmall: { height: 34, paddingHorizontal: 12, borderRadius: 10 },
  label: { fontSize: 12.5, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5 },
  kv: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  error: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, marginBottom: 10 },
  stat: { flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 4, minWidth: 140 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
