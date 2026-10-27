import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { askConfirm, type ConfirmTone } from "@/components/ConfirmSheet";
import { View, Text as RNText, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl, Platform, type TextProps, type TextStyle } from "react-native";
import { TextInput } from "@/components/MayaText";
import { FontFamily, BanglaFontFamily } from "@/constants/theme";
import { MayaColors, MayaFontFamily, MayaPalette, MayaRadius } from "@/constants/mayaTheme";
import { CustomSwitch } from "@/components/CustomSwitch";
import { Feather } from "@/components/icons/Feather";
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
  | { name: "users"; filter?: string }
  | { name: "thread"; id: string }
  | { name: "categoryForm"; id?: string }
  | { name: "search" }
  | { name: "official"; target?: string; targetName?: string; from?: string }
  | { name: "officialAccounts"; create?: boolean }
  | { name: "ads" }
  | { name: "adForm"; id?: string }
  | { name: "notifications" };
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
  pending: "#B25E09", confirmed: "#3D38D0", processing: "#3D38D0", shipped: "#1F86DB", delivered: "#00875A", cancelled: "#DA2F2F",
  open: "#00875A", closed: "#7A8CA3", active: "#00875A", suspended: "#DA2F2F", hidden: "#B25E09",
};
/**
 * The darker Maya accents (violet, amber, deep green, red, link blue) read poorly on the navy
 * dark-mode surfaces, so in dark mode they switch to the lighter step of the same Maya colour.
 */
const DARK_TONE: Record<string, string> = {
  "#3D38D0": "#8F8BFF", "#00875A": "#22D193", "#00BB77": "#22D193", "#B25E09": "#F2A23A", "#DA2F2F": "#F05252",
  "#1F86DB": "#6CC6FF", "#2E96EF": "#6CC6FF", "#7A8CA3": "#A9C2DC", "#4A5568": "#A9C2DC", "#FF4BB7": "#FF6EC4",
};
export const tone = (color: string, dark: boolean) => (dark ? DARK_TONE[String(color).toUpperCase()] || color : color);
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

// ---------------------------------------------------------------------------------------------
// Look and feel. The admin app uses the main app's Maya look (maya.net): Maya navy, sky blue and
// pink, DM Sans text with the condensed display face for big headings, solid navy buttons, flat
// white cards with a pale-blue 1px hairline and 12px corners, thin outline icons. Same switches,
// radio buttons and chat icon as the main app, plus a few admin-only pieces (stat tiles, hero band).
// ---------------------------------------------------------------------------------------------

const WEIGHT_FAMILY: Record<string, string> = {
  "400": FontFamily.regular, normal: FontFamily.regular, "500": FontFamily.medium, "600": FontFamily.semibold,
  "700": FontFamily.bold, bold: FontFamily.bold, "800": FontFamily.extrabold, "900": FontFamily.extrabold,
};
const BENGALI = /[\u0980-\u09FF]/;
const hasBangla = (c: React.ReactNode): boolean =>
  typeof c === "string" ? BENGALI.test(c) : Array.isArray(c) ? c.some(hasBangla) : typeof c === "number" ? false : false;

/** Text in the main app's font (DM Sans, Hind Siliguri for Bangla), picked from fontWeight. */
export function Text({ style, children, ...rest }: TextProps & { children?: React.ReactNode }) {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  let family = flat.fontFamily || WEIGHT_FAMILY[String(flat.fontWeight || "400")] || FontFamily.regular;
  if (hasBangla(children)) family = BanglaFontFamily[family] ?? family;
  return (
    <RNText {...rest} style={[flat, { fontFamily: family }, Platform.OS === "android" ? { fontWeight: undefined } : null]}>
      {children}
    </RNText>
  );
}

export const R = { card: MayaRadius.lg, tile: MayaRadius.md, field: MayaRadius.md, pill: MayaRadius.pill };
/**
 * Maya surfaces are flat: no drop shadow, just a 1px pale-blue hairline (navy-blue in dark
 * mode). Kept under the old name so every card, tile and panel in the admin app picks it up.
 */
export const shadow = (dark: boolean) => ({ borderWidth: 1, borderColor: MayaColors[dark ? "dark" : "light"].cardBorder });

/** Maya's heavy condensed display face for big headings (Bangla falls back to Hind Siliguri Bold). */
export const DISPLAY: TextStyle = { fontFamily: MayaFontFamily.display, fontWeight: "400", letterSpacing: 0.3 };

/** Maya's solid button colour: navy in light mode, sky blue in dark mode (navy would vanish on navy). */
export const mayaSolid = (dark: boolean, theme: { primary: string }) => (dark ? theme.primary : MayaPalette.ink);

export function Page({ children, onRefresh, refreshing, testID, pad = true }: { children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean; testID?: string; pad?: boolean }) {
  const { theme } = useTheme();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ padding: pad ? 16 : 0, paddingBottom: 40, width: "100%", maxWidth: 920, alignSelf: "center" }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: any; onPress?: () => void; testID?: string }) {
  const { theme, isDark } = useTheme();
  const body = [st.card, { backgroundColor: theme.card }, shadow(isDark), style];
  if (onPress)
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [...body, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
        {children}
      </Pressable>
    );
  return <View testID={testID} style={body}>{children}</View>;
}

export function SectionTitle({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  const { theme } = useTheme();
  return (
    <View style={st.sectionRow}>
      <Text style={[st.section, DISPLAY, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      {action ? (
        <Pressable testID={testID} onPress={onAction} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>{action}</Text>
          <Feather name="chevron-right" size={15} color={theme.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({ label, color: raw, icon }: { label: string; color: string; icon?: keyof typeof Feather.glyphMap }) {
  const { isDark } = useTheme();
  const color = tone(raw, isDark);
  return (
    <View style={[st.pill, { backgroundColor: color + "1A" }]}>
      {icon ? <Feather name={icon} size={11} color={color} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />}
      <Text style={{ color, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Filter chip, the main app's rounded chip (filled when on). */
export function Chip({ label, on, onPress, testID, color, count }: { label: string; on: boolean; onPress: () => void; testID?: string; color?: string; count?: number }) {
  const { theme } = useTheme();
  const c = color || theme.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [st.chip, { backgroundColor: on ? c : theme.card, borderColor: on ? c : theme.cardBorder, opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={{ color: on ? "#fff" : theme.text, fontWeight: on ? "700" : "600", fontSize: 13 }} numberOfLines={1}>{label}</Text>
      {count ? (
        <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(255,255,255,.25)" : c + "1A" }}>
          <Text style={{ color: on ? "#fff" : c, fontSize: 10.5, fontWeight: "800" }}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 8 }} style={{ marginBottom: 12, flexGrow: 0 }}>
      {children}
    </ScrollView>
  );
}

export function SearchBox({ value, onChange, placeholder, testID, autoFocus }: { value: string; onChange: (s: string) => void; placeholder: string; testID?: string; autoFocus?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[st.search, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
      <Feather name="search" size={17} color={theme.textSecondary} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        style={[st.searchInput, { color: theme.text, fontFamily: FontFamily.medium }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
        returnKeyType="search"
        autoCapitalize="none"
        autoFocus={autoFocus}
      />
      {value ? (
        <Pressable onPress={() => onChange("")} hitSlop={8} accessibilityLabel="Clear">
          <Feather name="x-circle" size={17} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Btn({ label, onPress, icon, kind = "primary", busy, disabled, testID, small, style }: {
  label: string; onPress: () => void; icon?: keyof typeof Feather.glyphMap; kind?: "primary" | "ghost" | "danger" | "soft" | "dangerSoft"; busy?: boolean; disabled?: boolean; testID?: string; small?: boolean; style?: any;
}) {
  const { theme, isDark } = useTheme();
  // Maya buttons: solid navy primary (sky blue in dark mode), white with a dark 1px outline as the
  // second choice (ghost), pale-blue soft buttons, Maya red for destructive actions.
  const bg = kind === "primary" ? mayaSolid(isDark, theme) : kind === "danger" ? theme.error : kind === "soft" ? theme.primarySoft : kind === "dangerSoft" ? theme.error + "14" : theme.backgroundDefault;
  const fg = kind === "primary" || kind === "danger" ? "#FFFFFF" : kind === "dangerSoft" ? theme.error : kind === "ghost" ? theme.text : isDark ? theme.link : theme.primary;
  const border = kind === "ghost" ? theme.text : kind === "soft" ? theme.primarySoft : bg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [st.btn, small && st.btnSmall, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.9 : 1, transform: [{ scale: pressed && !disabled ? 0.96 : 1 }] }, Platform.OS === "web" ? ({ transitionProperty: "transform, opacity", transitionDuration: "120ms" } as any) : null, style]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon ? <AppIcon name={icon} size={small ? 14 : 17} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 12.5 : 14.5 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, multiline, keyboardType, testID, maxLength, hint, prefix }: {
  label: string; value: string; onChange: (s: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: any; testID?: string; maxLength?: number; hint?: string; prefix?: string;
}) {
  const { theme } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[st.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={[st.inputWrap, { backgroundColor: theme.inputBackground, borderColor: focus ? theme.primary : theme.inputBorder }, multiline && { alignItems: "flex-start" }]}>
        {prefix ? <Text style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 15, marginRight: 4, marginTop: multiline ? 12 : 0 }}>{prefix}</Text> : null}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          multiline={multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[st.input, { color: theme.text, fontFamily: FontFamily.medium }, multiline && { minHeight: 96, textAlignVertical: "top", paddingTop: 12 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
        />
      </View>
      {hint ? <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 5 }}>{hint}</Text> : null}
    </View>
  );
}

export function KV({ k, v, onPress, testID, icon }: { k: string; v: string; onPress?: () => void; testID?: string; icon?: keyof typeof Feather.glyphMap }) {
  const { theme } = useTheme();
  return (
    <Pressable testID={testID} disabled={!onPress} onPress={onPress} style={[st.kv, { borderBottomColor: theme.divider || theme.cardBorder }]}>
      {icon ? <Feather name={icon} size={15} color={theme.textSecondary} style={{ marginRight: 8 }} /> : null}
      <Text style={{ color: theme.textSecondary, fontSize: 13.5, flexShrink: 0, maxWidth: "45%" }} numberOfLines={1}>{k}</Text>
      <Text style={{ color: onPress ? theme.primary : theme.text, fontSize: 14, fontWeight: "600", flex: 1, textAlign: "right" }} numberOfLines={2}>{v}</Text>
      {onPress ? <Feather name="chevron-right" size={16} color={theme.primary} /> : null}
    </Pressable>
  );
}

export function Empty({ icon = "inbox", text, action, onAction }: { icon?: keyof typeof Feather.glyphMap; text: string; action?: string; onAction?: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 20, gap: 12 }} testID="admin-empty">
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.primarySoft, alignItems: "center", justifyContent: "center" }}>
        <AppIcon name={icon} size={30} color={theme.primary} />
      </View>
      <Text style={{ color: theme.textSecondary, textAlign: "center", fontSize: 14.5, lineHeight: 21, maxWidth: 320 }}>{text}</Text>
      {action && onAction ? <Btn small kind="soft" label={action} onPress={onAction} /> : null}
    </View>
  );
}

/** Skeleton rows while a list loads (instead of a lone spinner). */
export function Loading({ rows: n = 3 }: { rows?: number }) {
  const { theme, isDark } = useTheme();
  return (
    <View testID="admin-loading" style={{ paddingVertical: 4 }}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={[st.card, shadow(isDark), { backgroundColor: theme.card, flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <View style={{ width: 46, height: 46, borderRadius: MayaRadius.md, backgroundColor: theme.backgroundSecondary }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 12, width: "60%", borderRadius: 6, backgroundColor: theme.backgroundSecondary }} />
            <View style={{ height: 10, width: "35%", borderRadius: 5, backgroundColor: theme.backgroundSecondary }} />
          </View>
        </View>
      ))}
      <ActivityIndicator style={{ marginTop: 4 }} color={theme.primary} />
    </View>
  );
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const L = useL();
  const { theme } = useTheme();
  return (
    <View style={[st.error, { backgroundColor: theme.error + "14", borderColor: theme.error + "33" }]} testID="admin-error">
      <Feather name="alert-circle" size={18} color={theme.error} />
      <Text style={{ color: theme.error, flex: 1, fontSize: 13.5, lineHeight: 19 }}>{text}</Text>
      {onRetry ? <Btn small kind="dangerSoft" icon="refresh-cw" label={L("Retry", "আবার")} onPress={onRetry} /> : null}
    </View>
  );
}

export function Thumb({ uri, size = 52, icon = "package", round }: { uri?: string | null; size?: number; icon?: keyof typeof Feather.glyphMap; round?: boolean }) {
  const { theme } = useTheme();
  const { Image } = require("expo-image");
  const r = round ? size / 2 : Math.round(size * 0.28);
  return uri ? (
    <Image source={{ uri: mediaUrl(uri) }} style={{ width: size, height: size, borderRadius: r, backgroundColor: theme.backgroundSecondary }} contentFit="cover" />
  ) : (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: theme.primary + "14", alignItems: "center", justifyContent: "center" }}>
      <AppIcon name={icon} size={Math.round(size * 0.42)} color={theme.primary} />
    </View>
  );
}

/** Round initials / photo avatar, like the main app's. */
export function Avatar({ name, uri, size = 44, dot }: { name?: string; uri?: string | null; size?: number; dot?: "online" | "offline" | null }) {
  // Named export: the old require(...).default was undefined and crashed every screen with a person avatar.
  const { UserAvatar } = require("@/components/UserAvatar");
  return <UserAvatar name={name || "?"} avatar={uri || undefined} size={size} presence={dot ?? null} />;
}

export function Stat({ label, value, icon, color: raw, onPress, testID, hint }: { label: string; value: string | number; icon: keyof typeof Feather.glyphMap; color: string; onPress?: () => void; testID?: string; hint?: string }) {
  const { theme, isDark } = useTheme();
  const color = tone(raw, isDark);
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.stat, shadow(isDark), { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ width: 38, height: 38, borderRadius: MayaRadius.md, backgroundColor: color + "1A", alignItems: "center", justifyContent: "center" }}>
          <AppIcon name={icon} size={19} color={color} />
        </View>
        {onPress ? <Feather name="arrow-up-right" size={15} color={theme.textTertiary} /> : null}
      </View>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800", marginTop: 12, letterSpacing: -0.3 }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 12.5, fontWeight: "600", marginTop: 2 }} numberOfLines={1}>{label}</Text>
      {hint ? <Text style={{ color, fontSize: 11.5, fontWeight: "700", marginTop: 4 }} numberOfLines={1}>{hint}</Text> : null}
    </Pressable>
  );
}

/** The Maya navy band at the top of Home, with Maya's sky-blue and pink shapes. */
export function Hero({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { isDark } = useTheme();
  return (
    <View testID={testID} style={[st.hero, { backgroundColor: isDark ? "#1B2A40" : MayaPalette.ink }, isDark ? { borderWidth: 1, borderColor: MayaColors.dark.cardBorder } : null]}>
      <View style={{ position: "absolute", right: -46, top: -54, width: 170, height: 170, borderRadius: 85, backgroundColor: MayaPalette.sky, opacity: 0.22 }} />
      <View style={{ position: "absolute", right: 56, bottom: -64, width: 120, height: 120, borderRadius: 60, backgroundColor: MayaPalette.pink, opacity: 0.16 }} />
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: MayaPalette.sky }} />
      {children}
    </View>
  );
}

/** The main app's switch (Settings), with a label row around it. */
export function ToggleRow({ label, sub, value, onChange, testID, icon, disabled }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; testID?: string; icon?: keyof typeof Feather.glyphMap; disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[st.rowLine, { borderBottomColor: theme.divider || theme.cardBorder }]}
    >
      {icon ? (
        <View style={[st.rowIcon, { backgroundColor: theme.primary + "14" }]}>
          <AppIcon name={icon} size={17} color={theme.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: "600" }}>{label}</Text>
        {sub ? <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{sub}</Text> : null}
      </View>
      <View pointerEvents="none">
        <CustomSwitch value={value} onValueChange={onChange} disabled={disabled} />
      </View>
    </Pressable>
  );
}

/** Drop-in for React Native's Switch that looks like the main app's switch. */
export function Switch({ value, onValueChange, testID, disabled }: { value: boolean; onValueChange?: (v: boolean) => void; testID?: string; disabled?: boolean; [k: string]: any }) {
  return (
    <Pressable testID={testID} accessibilityRole="switch" accessibilityState={{ checked: !!value, disabled }} disabled={disabled} onPress={() => onValueChange?.(!value)} hitSlop={6}>
      <View pointerEvents="none">
        <CustomSwitch value={!!value} onValueChange={(v: boolean) => onValueChange?.(v)} disabled={disabled} />
      </View>
    </Pressable>
  );
}

/** The main app's radio button (Checkout): a ring that fills with a green dot. */
export function Radio({ on }: { on: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[st.radioOuter, { borderColor: on ? theme.primary : theme.textSecondary }]}>
      {on ? <View style={[st.radioInner, { backgroundColor: theme.primary }]} /> : null}
    </View>
  );
}

export function RadioGroup<T extends string>({ options, value, onChange, testID, row }: {
  options: { value: T; label: string; sub?: string; icon?: keyof typeof Feather.glyphMap; color?: string }[];
  value: T; onChange: (v: T) => void; testID?: string; row?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={row ? { flexDirection: "row", flexWrap: "wrap", gap: 8 } : { gap: 8 }} accessibilityRole="radiogroup" testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              st.radioRow,
              row && { flexGrow: 1, flexBasis: 140 },
              { borderColor: on ? theme.primary : theme.cardBorder, backgroundColor: on ? theme.primarySoft : theme.card, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Radio on={on} />
            {o.icon ? <AppIcon name={o.icon} size={18} color={o.color || theme.text} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{o.label}</Text>
              {o.sub ? <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 1 }} numberOfLines={2}>{o.sub}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tappable settings-style row with an icon tile and a chevron. */
export function ListRow({ icon, label, sub, onPress, testID, color, right, badge, last }: {
  icon: keyof typeof Feather.glyphMap; label: string; sub?: string; onPress?: () => void; testID?: string; color?: string; right?: React.ReactNode; badge?: number; last?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const c = tone(color || theme.primary, isDark);
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.rowLine, { borderBottomColor: last ? "transparent" : theme.divider || theme.cardBorder, opacity: pressed ? 0.75 : 1 }]}>
      <View style={[st.rowIcon, { backgroundColor: c + "16" }]}>
        <AppIcon name={icon} size={17} color={c} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: "600" }} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 1 }} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {badge ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
      {right}
      {onPress ? <Feather name="chevron-right" size={18} color={theme.textTertiary} /> : null}
    </Pressable>
  );
}

/** Two to four equal segments (like a tab switch inside a page). */
export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const { theme, isDark } = useTheme();
  return (
    <View style={[st.segWrap, { backgroundColor: theme.backgroundSecondary }]} testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} testID={testID ? `${testID}-${o.value}` : undefined} onPress={() => onChange(o.value)} style={[st.seg, on && [{ backgroundColor: theme.card }, shadow(isDark)]]}>
            <Text style={{ color: on ? theme.text : theme.textSecondary, fontWeight: on ? "800" : "600", fontSize: 13 }} numberOfLines={1}>
              {o.label}{o.count ? ` · ${o.count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export async function pickAndUpload(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const dataUrl = a.uri.startsWith("data:") ? a.uri : `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`;
  return mediaUrl(await uploadImage(dataUrl));
}

/**
 * Cross-platform confirm. Opens the Farmers bottom sheet (slides up, soft
 * spring, haptic tap) on phones and on the web. Resolves true only when the
 * confirm button is tapped; cancel, backdrop, Escape and back resolve false.
 */
export function confirmAsk(title: string, msg: string, ok: string, cancel: string, tone?: ConfirmTone): Promise<boolean> {
  return askConfirm({ title, message: msg, confirmText: ok, cancelText: cancel, tone });
}

export const st = StyleSheet.create({
  card: { borderRadius: MayaRadius.lg, padding: 16, marginBottom: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 10, gap: 10 },
  section: { fontSize: 18, flex: 1 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 15, height: 36, borderRadius: 18, borderWidth: 1 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: MayaRadius.md, borderWidth: 1, paddingHorizontal: 14, height: 46, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, height: 44 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, paddingHorizontal: 18, borderRadius: MayaRadius.md, borderWidth: 1 },
  btnSmall: { height: 36, paddingHorizontal: 13, borderRadius: MayaRadius.sm },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 7 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderRadius: MayaRadius.md, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, minHeight: 48, fontSize: 15, paddingVertical: 10 },
  kv: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  error: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: MayaRadius.md, padding: 12, marginBottom: 12 },
  stat: { flexGrow: 1, flexBasis: 150, minWidth: 140, borderRadius: MayaRadius.lg, padding: 14 },
  hero: { borderRadius: MayaRadius.xl, padding: 20, paddingLeft: 22, marginBottom: 16, overflow: "hidden" },
  rowLine: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 36, height: 36, borderRadius: MayaRadius.sm + 2, alignItems: "center", justifyContent: "center" },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: MayaRadius.md, paddingHorizontal: 14, paddingVertical: 12 },
  segWrap: { flexDirection: "row", borderRadius: MayaRadius.md, padding: 4, marginBottom: 14 },
  seg: { flex: 1, height: 36, borderRadius: MayaRadius.sm, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 6 },
});
