import React, { useCallback, useEffect, useState } from "react";
import { askConfirm } from "@/components/ConfirmSheet";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform, Share, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { isLoggedIn } from "@/lib/api";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  SavedGuestOrder, listGuestOrders, findGuestKey, saveGuestOrder, fetchGuestOrder, cancelGuestOrder, guestOrderLink,
} from "@/lib/guestOrders";

/**
 * A guest's order (bought without an account): status, items, delivery and payment.
 * Without an order id it lists the guest orders saved on this phone / browser.
 */
const STEPS = [
  { status: "pending", en: "Order placed", bn: "অর্ডার করা হয়েছে", icon: "file-text" },
  { status: "confirmed", en: "Confirmed", bn: "নিশ্চিত", icon: "check-circle" },
  { status: "processing", en: "Processing", bn: "প্রস্তুত হচ্ছে", icon: "package" },
  { status: "shipped", en: "Shipped", bn: "পাঠানো হয়েছে", icon: "truck" },
  { status: "delivered", en: "Delivered", bn: "ডেলিভারি হয়েছে", icon: "check" },
] as const;
const ORDER = STEPS.map((s) => s.status as string);
const taka = (n: any) => `৳${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

export default function GuestOrderScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bn = useI18n().language === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = (useRoute<RouteProp<RootStackParamList, "GuestOrder">>().params || {}) as { orderId?: string; k?: string };
  const loggedIn = isLoggedIn();
  const [order, setOrder] = useState<any>(null);
  const [key, setKey] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedGuestOrder[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    if (!params.orderId) {
      setSaved(await listGuestOrders());
      setLoading(false);
      return;
    }
    const k = params.k || (await findGuestKey(params.orderId));
    setKey(k);
    if (!k) {
      setError(L("Open the order link you saved to see this order.", "এই অর্ডার দেখতে আপনার সেভ করা অর্ডার লিংকটি খুলুন।"));
      setLoading(false);
      return;
    }
    try {
      const o = await fetchGuestOrder(params.orderId, k);
      setOrder(o);
      // opened from a link on a new phone/browser: remember it here too
      await saveGuestOrder({ id: o.id, key: k, total: o.total, createdAt: o.createdAt || new Date().toISOString(), contactName: o.checkout?.contactName });
    } catch (e: any) {
      setError(e?.message || L("Couldn't load the order", "অর্ডার লোড করা যায়নি"));
    } finally {
      setLoading(false);
    }
  }, [params.orderId, params.k, bn]);

  useEffect(() => {
    load();
  }, [load]);

  const close = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("ShopPage", undefined as any));

  const shareLink = async () => {
    if (!order || !key) return;
    const url = guestOrderLink(order.id, key);
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        Alert.alert(L("Link copied", "লিংক কপি হয়েছে"), L("Keep this link to check your order later. Don't share it with others.", "পরে অর্ডার দেখতে এই লিংকটি রাখুন। অন্যকে দেবেন না।"));
      } else await Share.share({ message: `${L("My Farmers order", "আমার Farmers অর্ডার")} ${order.id}: ${url}` });
    } catch {}
  };

  const doCancel = () => {
    if (!order || !key) return;
    const go = async () => {
      setBusy(true);
      try {
        setOrder(await cancelGuestOrder(order.id, key));
      } catch (e: any) {
        Alert.alert(L("Couldn't cancel", "বাতিল করা যায়নি"), e?.message || "");
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === "web") {
      void askConfirm({ title: L("Cancel this order?", "এই অর্ডারটি বাতিল করবেন?"), confirmText: L("Cancel order", "অর্ডার বাতিল"), cancelText: L("Keep order", "অর্ডার রাখুন"), tone: "danger" }).then((ok) => { if (ok) void go(); });
      return;
    }
    Alert.alert(L("Cancel this order?", "এই অর্ডারটি বাতিল করবেন?"), "", [
      { text: L("Keep order", "অর্ডার রাখুন"), style: "cancel" },
      { text: L("Cancel order", "অর্ডার বাতিল"), style: "destructive", onPress: go },
    ]);
  };

  const card = [styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }];
  const title = params.orderId ? L("Your order", "আপনার অর্ডার") : L("My orders", "আমার অর্ডার");

  const header = (
    <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: theme.backgroundRoot }]}>
      <Pressable testID="guest-order-back" hitSlop={10} onPress={close} style={styles.iconBtn}>
        <Feather name="arrow-left" size={22} color={theme.text} />
      </Pressable>
      <ThemedText type="h4" style={{ color: theme.text, flex: 1 }} numberOfLines={1}>{title}</ThemedText>
      {order && key ? (
        <Pressable testID="guest-order-share" hitSlop={10} onPress={shareLink} style={styles.iconBtn} accessibilityLabel={L("Save order link", "অর্ডার লিংক সেভ করুন")}>
          <Feather name="link" size={20} color={theme.text} />
        </Pressable>
      ) : null}
    </View>
  );

  if (loading)
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        {header}
        <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
      </View>
    );

  // ---- list of saved guest orders
  if (!params.orderId) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
          {(saved || []).length === 0 ? (
            <View style={[styles.center, { paddingTop: 60 }]}>
              <Feather name="shopping-bag" size={40} color={theme.textSecondary} />
              <ThemedText style={{ color: theme.textSecondary, marginTop: 10, textAlign: "center" }}>
                {L("No orders on this device yet.", "এই ডিভাইসে এখনো কোনো অর্ডার নেই।")}
              </ThemedText>
            </View>
          ) : (
            (saved || []).map((o) => (
              <Pressable key={o.id} testID={`guest-order-row-${o.id}`} onPress={() => navigation.push("GuestOrder", { orderId: o.id })} style={[card, styles.row]}>
                <View style={[styles.rowIcon, { backgroundColor: theme.primarySoft }]}>
                  <Feather name="package" size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{o.id}</ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                    {new Date(o.createdAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")} · {taka(o.total)}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  if (error || !order)
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        {header}
        <View style={[styles.center, { padding: 24 }]}>
          <Feather name="alert-circle" size={40} color={theme.textSecondary} />
          <ThemedText style={{ color: theme.text, marginTop: 10, textAlign: "center" }}>{error}</ThemedText>
          <Pressable onPress={load} style={[styles.pill, { borderColor: theme.primary, marginTop: 16 }]}>
            <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>{L("Try again", "আবার চেষ্টা করুন")}</ThemedText>
          </Pressable>
        </View>
      </View>
    );

  const cancelled = order.status === "cancelled";
  const reached = ORDER.indexOf(order.status);
  const c = order.checkout || {};
  const pay = order.payment;
  const payLabel =
    order.paymentMethod === "rocket"
      ? `Rocket${pay?.status === "verified" ? L(" · confirmed", " · নিশ্চিত") : pay?.status === "rejected" ? L(" · not confirmed", " · নিশ্চিত হয়নি") : L(" · being checked", " · যাচাই চলছে")}`
      : order.paymentMethod === "bkash"
        ? "bKash"
        : L("Cash on delivery", "ক্যাশ অন ডেলিভারি");

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.primary} />}
      >
        <View style={card}>
          <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{L("Order", "অর্ডার")}</ThemedText>
          <ThemedText testID="guest-order-id" style={{ color: theme.text, fontWeight: "800", fontSize: 16 }} selectable>{order.id}</ThemedText>
          <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
            {order.createdAt ? new Date(order.createdAt).toLocaleString(bn ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : ""}
          </ThemedText>
          <View style={[styles.guestNote, { backgroundColor: theme.primarySoft }]}>
            <Feather name="info" size={14} color={theme.primary} />
            <ThemedText style={{ color: theme.text, fontSize: 12, flex: 1 }}>
              {L("Ordered without an account. Tap the link icon to save this order's link; the shop may call you to confirm.", "অ্যাকাউন্ট ছাড়া অর্ডার করা হয়েছে। অর্ডারের লিংক সেভ করতে লিংক আইকনে ট্যাপ করুন; দোকান নিশ্চিত করতে আপনাকে কল করতে পারে।")}
            </ThemedText>
          </View>
        </View>

        <View style={card}>
          {cancelled ? (
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: theme.error }]}><Feather name="x" size={14} color="#fff" /></View>
              <ThemedText testID="guest-order-status" style={{ color: theme.error, fontWeight: "700" }}>{L("Cancelled", "বাতিল")}</ThemedText>
            </View>
          ) : (
            STEPS.map((s, i) => {
              const done = i <= reached;
              return (
                <View key={s.status} style={styles.stepRow}>
                  <View style={[styles.stepDot, { backgroundColor: done ? theme.primary : theme.backgroundSecondary }]}>
                    <Feather name={s.icon as any} size={13} color={done ? "#fff" : theme.textSecondary} />
                  </View>
                  <ThemedText testID={i === reached ? "guest-order-status" : undefined} style={{ color: done ? theme.text : theme.textSecondary, fontWeight: i === reached ? "800" : "500" }}>
                    {bn ? s.bn : s.en}
                  </ThemedText>
                </View>
              );
            })
          )}
        </View>

        <View style={card}>
          <ThemedText style={[styles.section, { color: theme.text }]}>{L("Items", "পণ্য")}</ThemedText>
          {(order.items || []).map((it: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              {it.image ? <Image source={{ uri: it.image }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { backgroundColor: theme.backgroundSecondary }]} />}
              <View style={{ flex: 1 }}>
                <ThemedText style={{ color: theme.text, fontWeight: "600" }} numberOfLines={2}>{it.name}</ThemedText>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {it.quantity} × {taka(it.price)}
                </ThemedText>
              </View>
              <ThemedText style={{ color: theme.text, fontWeight: "700" }}>{taka(it.lineTotal ?? (Number(it.price) || 0) * (Number(it.quantity) || 0))}</ThemedText>
            </View>
          ))}
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          {typeof c.subtotal === "number" ? (
            <>
              <View style={styles.sumRow}><ThemedText style={{ color: theme.textSecondary }}>{L("Subtotal", "সাবটোটাল")}</ThemedText><ThemedText style={{ color: theme.text }}>{taka(c.subtotal)}</ThemedText></View>
              <View style={styles.sumRow}><ThemedText style={{ color: theme.textSecondary }}>{L("Delivery fee", "ডেলিভারি ফি")}</ThemedText><ThemedText style={{ color: theme.text }}>{c.deliveryFee ? taka(c.deliveryFee) : L("Free", "ফ্রি")}</ThemedText></View>
              {c.discount ? <View style={styles.sumRow}><ThemedText style={{ color: theme.textSecondary }}>{L("Discount", "ছাড়")}</ThemedText><ThemedText style={{ color: theme.text }}>−{taka(c.discount)}</ThemedText></View> : null}
            </>
          ) : null}
          <View style={styles.sumRow}>
            <ThemedText style={{ color: theme.text, fontWeight: "800" }}>{L("Total", "মোট")}</ThemedText>
            <ThemedText testID="guest-order-total" style={{ color: theme.primary, fontWeight: "800", fontSize: 16 }}>{taka(order.total)}</ThemedText>
          </View>
        </View>

        <View style={card}>
          <ThemedText style={[styles.section, { color: theme.text }]}>{L("Delivery", "ডেলিভারি")}</ThemedText>
          <ThemedText style={{ color: theme.text, fontWeight: "600" }}>{c.contactName} · {c.contactPhone}</ThemedText>
          <ThemedText style={{ color: theme.textSecondary, marginTop: 2 }}>
            {c.deliveryMethod === "pickup"
              ? L("Pick up from seller", "বিক্রেতার কাছ থেকে নিন")
              : [c.address, c.upazila, c.district, c.division].filter(Boolean).join(", ")}
          </ThemedText>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <ThemedText style={[styles.section, { color: theme.text }]}>{L("Payment", "পেমেন্ট")}</ThemedText>
          <ThemedText style={{ color: theme.textSecondary }}>{payLabel}</ThemedText>
          {pay?.note ? <ThemedText style={{ color: theme.textSecondary, marginTop: 2 }}>{pay.note}</ThemedText> : null}
        </View>

        {order.status === "pending" ? (
          <Pressable testID="guest-order-cancel" disabled={busy} onPress={doCancel} style={[styles.pill, { borderColor: theme.error, alignSelf: "stretch", alignItems: "center", opacity: busy ? 0.6 : 1 }]}>
            <ThemedText style={{ color: theme.error, fontWeight: "700" }}>{busy ? L("Cancelling…", "বাতিল হচ্ছে…") : L("Cancel order", "অর্ডার বাতিল")}</ThemedText>
          </Pressable>
        ) : null}
        <Pressable testID="guest-order-shop" onPress={() => navigation.navigate("ShopPage", undefined as any)} style={[styles.pill, { backgroundColor: theme.primary, borderColor: theme.primary, alignSelf: "stretch", alignItems: "center" }]}>
          <ThemedText style={{ color: "#fff", fontWeight: "700" }}>{L("Continue shopping", "আরও কেনাকাটা করুন")}</ThemedText>
        </Pressable>
        {!loggedIn ? (
          <Pressable onPress={() => navigation.navigate("Signup" as any)} style={{ alignSelf: "center", padding: 8 }}>
            <ThemedText style={{ color: theme.primary, fontWeight: "600", fontSize: 13 }}>
              {L("Want to track orders in one place? Create an account (optional)", "এক জায়গায় অর্ডার দেখতে চান? অ্যাকাউন্ট খুলুন (ঐচ্ছিক)")}
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  guestNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 10, padding: 10, marginTop: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  section: { fontWeight: "800", marginBottom: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
});
