import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, TextInput, Pressable, Modal, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCartStore } from "@/lib/cartStore";
import { useOrdersStore } from "@/lib/ordersStore";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { getApiUrl } from "@/lib/query-client";
import { apiGet, apiPost, isLoggedIn } from "@/lib/api";
import { DIVISIONS, divisionOf, divisionLabel } from "@/lib/bdLocations";
import { useTr } from "@/lib/tr";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Method = "home" | "express" | "pickup";
type Payment = "cod" | "bkash";

interface Addr {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  division?: string;
  district: string;
  upazila?: string;
  area?: string;
  city?: string;
  address: string;
  isDefault?: boolean;
}

interface Quote {
  subtotal: number;
  deliveryMethod: Method;
  deliveryFee: number;
  discount: number;
  total: number;
  coupon: { code: string; description: string } | null;
  couponError: string | null;
  methodError: string | null;
  stockErrors: { productId: string; name: string; available: number }[];
  methods: { id: Method; label: string; days: string; fee: number | null; available: boolean }[];
  freeDeliveryOver: number;
}

const SLOTS = [
  { id: "morning", en: "Morning (9am–12pm)" },
  { id: "afternoon", en: "Afternoon (12–4pm)" },
  { id: "evening", en: "Evening (4–8pm)" },
];

const METHOD_ICON: Record<Method, any> = { home: "truck", express: "zap", pickup: "map-pin" };

/** Same rules as the server (server/checkoutRoutes.ts), used only when the quote can't be fetched. */
function localQuote(subtotal: number, method: Method, division: string): Quote {
  const dhaka = division === "Dhaka";
  const fee = (m: Method) => (m === "pickup" ? 0 : m === "express" ? (dhaka ? 150 : null) : subtotal >= 2000 ? 0 : dhaka ? 60 : 120);
  const f = fee(method) ?? (fee("home") as number);
  return {
    subtotal,
    deliveryMethod: fee(method) === null ? "home" : method,
    deliveryFee: f,
    discount: 0,
    total: subtotal + f,
    coupon: null,
    couponError: null,
    methodError: null,
    stockErrors: [],
    methods: [
      { id: "home", label: "Home delivery", days: "2-3 days", fee: fee("home"), available: true },
      { id: "express", label: "Express delivery", days: "Next day (Dhaka only)", fee: fee("express"), available: fee("express") !== null },
      { id: "pickup", label: "Pick up from seller", days: "When the seller confirms", fee: 0, available: true },
    ],
    freeDeliveryOver: 2000,
  };
}

function nextDays(n: number) {
  const out: { iso: string; date: Date }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.now() + i * 86400000);
    out.push({ iso: d.toISOString().slice(0, 10), date: d });
  }
  return out;
}

export default function CheckoutScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { items, getTotal, clearCart } = useCartStore();
  const { addOrder } = useOrdersStore();
  const { language } = useI18n();
  const isBn = language === "bn";
  const { user } = useAuthStore();
  const loggedIn = isLoggedIn();

  // ---------- addresses ----------
  const localAddrs: Addr[] = ((user as any)?.addresses || []).map((a: any) => ({ ...a, division: a.division || divisionOf(`${a.district} ${a.city}`) || "" }));
  const [serverAddrs, setServerAddrs] = useState<Addr[]>([]);
  const savedAddrs = useMemo(() => [...serverAddrs, ...localAddrs.filter((l) => !serverAddrs.some((s) => s.id === l.id))], [serverAddrs, user]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [useNew, setUseNew] = useState(false);
  const [form, setForm] = useState({ fullName: (user as any)?.name || "", phone: (user as any)?.phone || "", division: "Dhaka", district: "", upazila: "", address: "" });
  const [saveAddress, setSaveAddress] = useState(true);
  const [addrModal, setAddrModal] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    apiGet<Addr[]>("/api/me/addresses")
      .then((list) => setServerAddrs(list.map((a) => ({ ...a, division: a.division || divisionOf(`${a.district} ${a.city}`) || "" }))))
      .catch(() => {});
  }, [loggedIn]);
  useEffect(() => {
    if (!selectedId && savedAddrs.length) setSelectedId((savedAddrs.find((a) => a.isDefault) || savedAddrs[0]).id);
  }, [savedAddrs]);

  const selectedAddr = savedAddrs.find((a) => a.id === selectedId) || null;
  const usingSaved = !useNew && !!selectedAddr;
  const division = (usingSaved ? selectedAddr?.division : form.division) || "Dhaka";

  // ---------- delivery, coupon, payment ----------
  const [method, setMethod] = useState<Method>("home");
  const days = useMemo(() => nextDays(3), []);
  const [deliveryDate, setDeliveryDate] = useState(days[0].iso);
  const [slot, setSlot] = useState("morning");
  const [notes, setNotes] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coupons, setCoupons] = useState<{ code: string; description: string; minOrder: number }[]>([]);
  const [payment, setPayment] = useState<Payment>("cod");
  const [quote, setQuote] = useState<Quote>(() => localQuote(getTotal(), "home", "Dhaka"));
  const [quoting, setQuoting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [placed, setPlaced] = useState<{ id: string; total: number } | null>(null);

  useEffect(() => {
    apiGet("/api/coupons").then(setCoupons).catch(() => {});
  }, []);

  const itemsKey = items.map((i) => `${i.productId}:${i.quantity}:${i.price}`).join("|");
  useEffect(() => {
    let live = true;
    setQuoting(true);
    apiPost<Quote>("/api/checkout/quote", {
      items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
      deliveryMethod: method,
      division,
      couponCode,
    })
      .then((q) => {
        if (!live) return;
        setQuote(q);
        if (q.deliveryMethod !== method) setMethod(q.deliveryMethod);
      })
      .catch(() => live && setQuote(localQuote(getTotal(), method, division)))
      .finally(() => live && setQuoting(false));
    return () => {
      live = false;
    };
  }, [itemsKey, method, division, couponCode]);

  const applyCoupon = (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCouponInput(code.toUpperCase());
    setCouponCode(code.trim().toUpperCase());
  };

  const formValid = usingSaved
    ? true
    : !!(form.fullName.trim() && form.phone.trim().length >= 6 && form.district.trim() && form.address.trim());
  const canPlace = items.length > 0 && formValid && !isProcessing && quote.stockErrors.length === 0;

  const shipping = () => {
    if (usingSaved && selectedAddr) {
      const a = selectedAddr;
      return {
        fullName: a.fullName,
        phone: a.phone,
        address: [a.address, a.upazila || a.area].filter(Boolean).join(", "),
        city: [a.district || a.city, a.division].filter(Boolean).join(", "),
        division: a.division || "",
        district: a.district || a.city || "",
        upazila: a.upazila || a.area || "",
      };
    }
    return {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      address: [form.address.trim(), form.upazila.trim()].filter(Boolean).join(", "),
      city: [form.district.trim(), form.division].filter(Boolean).join(", "),
      division: form.division,
      district: form.district.trim(),
      upazila: form.upazila.trim(),
    };
  };

  const handlePlaceOrder = async () => {
    if (!canPlace) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const ship = shipping();
    const checkout = {
      deliveryMethod: method,
      division: ship.division,
      district: ship.district,
      upazila: ship.upazila,
      deliveryDate: method === "pickup" ? "" : deliveryDate,
      timeSlot: method === "pickup" ? "" : slot,
      notes: notes.trim(),
      couponCode: quote.coupon?.code || "",
    };
    let savedOnServer = false;
    let finalTotal = quote.total;
    let serverCheckout: any = null;
    try {
      const token = useAuthStore.getState().token;
      const r = await fetch(`${getApiUrl()}/api/shop-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          id: orderId,
          shippingAddress: { fullName: ship.fullName, address: ship.address, city: ship.city, phone: ship.phone },
          total: quote.total,
          itemCount: items.reduce((n, i) => n + (i.quantity || 1), 0),
          paymentMethod: payment,
          checkout,
          items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, image: i.image, unit: i.unit })),
        }),
      });
      const data = await r.json().catch(() => null);
      if (r.status === 409) {
        setIsProcessing(false);
        Alert.alert(tr("Not enough stock"), data?.error || "");
        return;
      }
      if (r.ok) {
        savedOnServer = !!token;
        if (typeof data?.total === "number") finalTotal = data.total;
        serverCheckout = data?.checkout || null;
      }
    } catch {
      // offline: keep the local order only
    }

    if (loggedIn && !usingSaved && saveAddress) {
      apiPost("/api/me/addresses", {
        label: "Home",
        fullName: ship.fullName,
        phone: ship.phone,
        division: ship.division,
        district: ship.district,
        upazila: ship.upazila,
        address: form.address.trim(),
      }).catch(() => {});
    }

    await addOrder({
      id: orderId,
      onServer: savedOnServer,
      items: items.map((item) => ({ id: item.id, productId: item.productId, name: item.name, price: item.price, quantity: item.quantity, image: item.image })),
      total: finalTotal,
      currency: "৳",
      status: "pending",
      shippingAddress: { fullName: ship.fullName, address: ship.address, city: ship.city, phone: ship.phone },
      paymentMethod: payment,
      checkout: serverCheckout || { ...checkout, subtotal: quote.subtotal, deliveryFee: quote.deliveryFee, discount: quote.discount, coupon: quote.coupon?.code || null, total: finalTotal },
    } as any);

    setIsProcessing(false);
    clearCart();
    setPlaced({ id: orderId, total: finalTotal });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const dayLabel = (d: Date, i: number) =>
    i === 0 ? tr("Tomorrow") : d.toLocaleDateString(isBn ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
  const money = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
  const freeLeft = method === "home" && quote.deliveryFee > 0 ? quote.freeDeliveryOver - quote.subtotal : 0;

  const card = [styles.section, { backgroundColor: theme.white, borderColor: theme.cardBorder }];
  const input = [styles.input, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }];
  const chip = (active: boolean, disabled = false) => [
    styles.chip,
    { backgroundColor: active ? theme.primary : theme.card, borderColor: active ? theme.primary : theme.cardBorder, opacity: disabled ? 0.5 : 1 },
  ];
  const chipText = (active: boolean) => [styles.chipText, { color: active ? "#FFFFFF" : theme.text }];
  const Header = ({ icon, title }: { icon: any; title: string }) => (
    <View style={styles.sectionHeader}>
      <Feather name={icon} size={18} color={theme.primary} />
      <ThemedText type="h4" style={{ color: theme.text, flex: 1 }}>
        {title}
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.scrollContent, { paddingTop: Spacing.md, paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {/* Address */}
          <View style={card}>
            <Header icon="map-pin" title={tr("Delivery address")} />
            {savedAddrs.length > 0 ? (
              <View style={styles.rowWrap}>
                <Pressable style={chip(!useNew)} onPress={() => setUseNew(false)}>
                  <Feather name="bookmark" size={13} color={!useNew ? "#FFFFFF" : theme.text} />
                  <ThemedText style={chipText(!useNew)}>{tr("Saved address")}</ThemedText>
                </Pressable>
                <Pressable style={chip(useNew)} onPress={() => setUseNew(true)}>
                  <Feather name="plus" size={13} color={useNew ? "#FFFFFF" : theme.text} />
                  <ThemedText style={chipText(useNew)}>{tr("New address")}</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {usingSaved && selectedAddr ? (
              <Pressable style={[styles.savedCard, { borderColor: theme.primary, backgroundColor: theme.backgroundRoot }]} onPress={() => setAddrModal(true)}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText style={[styles.bold, { color: theme.text }]}>
                    {selectedAddr.fullName} · {selectedAddr.phone}
                  </ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={2}>
                    {[selectedAddr.address, selectedAddr.upazila || selectedAddr.area, selectedAddr.district || selectedAddr.city, selectedAddr.division ? divisionLabel(selectedAddr.division, isBn) : ""].filter(Boolean).join(", ")}
                  </ThemedText>
                </View>
                {savedAddrs.length > 1 ? (
                  <ThemedText style={{ color: theme.primary, fontWeight: "600", fontSize: 13 }}>{tr("Change")}</ThemedText>
                ) : null}
              </Pressable>
            ) : (
              <View>
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <ThemedText style={[styles.label, { color: theme.text }]}>{tr("Full name")}</ThemedText>
                    <TextInput style={input} value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} placeholder={tr("Full name")} placeholderTextColor={theme.textSecondary} />
                  </View>
                  <View style={styles.formCol}>
                    <ThemedText style={[styles.label, { color: theme.text }]}>{tr("Phone number")}</ThemedText>
                    <TextInput style={input} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="01XXXXXXXXX" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" />
                  </View>
                </View>
                <ThemedText style={[styles.label, { color: theme.text }]}>{tr("Division")}</ThemedText>
                <View style={[styles.rowWrap, { marginBottom: Spacing.md }]}>
                  {DIVISIONS.map((d) => (
                    <Pressable key={d.id} style={chip(form.division === d.id)} onPress={() => setForm({ ...form, division: d.id })}>
                      <ThemedText style={chipText(form.division === d.id)}>{divisionLabel(d.id, isBn)}</ThemedText>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <ThemedText style={[styles.label, { color: theme.text }]}>{tr("District")}</ThemedText>
                    <TextInput style={input} value={form.district} onChangeText={(v) => setForm({ ...form, district: v })} placeholder={tr("e.g. Bogura")} placeholderTextColor={theme.textSecondary} />
                  </View>
                  <View style={styles.formCol}>
                    <ThemedText style={[styles.label, { color: theme.text }]}>{tr("Upazila / Thana")}</ThemedText>
                    <TextInput style={input} value={form.upazila} onChangeText={(v) => setForm({ ...form, upazila: v })} placeholder={tr("e.g. Sherpur")} placeholderTextColor={theme.textSecondary} />
                  </View>
                </View>
                <ThemedText style={[styles.label, { color: theme.text }]}>{tr("Village / road / house")}</ThemedText>
                <TextInput style={[input, styles.textArea]} value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder={tr("Village, road, house number")} placeholderTextColor={theme.textSecondary} multiline textAlignVertical="top" />
                {loggedIn ? (
                  <Pressable style={styles.checkRow} onPress={() => setSaveAddress((v) => !v)}>
                    <Feather name={saveAddress ? "check-square" : "square"} size={18} color={theme.primary} />
                    <ThemedText style={{ color: theme.text, fontSize: 14 }}>{tr("Save this address for next time")}</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>

          {/* Delivery method */}
          <View style={card}>
            <Header icon="truck" title={tr("Delivery method")} />
            {quote.methods.map((m) => {
              const active = method === m.id;
              return (
                <Pressable
                  key={m.id}
                  disabled={!m.available}
                  onPress={() => setMethod(m.id)}
                  style={[styles.option, { borderColor: active ? theme.primary : theme.inputBorder, backgroundColor: active ? `${theme.primary}10` : "transparent", opacity: m.available ? 1 : 0.5 }]}
                >
                  <View style={[styles.radioOuter, { borderColor: active ? theme.primary : theme.textSecondary }]}>
                    {active ? <View style={[styles.radioInner, { backgroundColor: theme.primary }]} /> : null}
                  </View>
                  <Feather name={METHOD_ICON[m.id]} size={20} color={theme.text} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText style={[styles.bold, { color: theme.text }]}>{tr(m.label)}</ThemedText>
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{tr(m.days)}</ThemedText>
                  </View>
                  <ThemedText style={[styles.bold, { color: m.fee === 0 ? theme.success || theme.primary : theme.text }]}>
                    {m.fee === null ? "—" : m.fee === 0 ? tr("Free") : money(m.fee)}
                  </ThemedText>
                </Pressable>
              );
            })}
            {freeLeft > 0 ? (
              <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                {tr("Add")} {money(freeLeft)} {tr("more for free home delivery")}
              </ThemedText>
            ) : null}
          </View>

          {/* Date and time */}
          {method !== "pickup" ? (
            <View style={card}>
              <Header icon="clock" title={tr("Delivery time")} />
              <View style={[styles.rowWrap, { marginBottom: Spacing.sm }]}>
                {days.map((d, i) => (
                  <Pressable key={d.iso} style={chip(deliveryDate === d.iso)} onPress={() => setDeliveryDate(d.iso)}>
                    <ThemedText style={chipText(deliveryDate === d.iso)}>{dayLabel(d.date, i)}</ThemedText>
                  </Pressable>
                ))}
              </View>
              <View style={styles.rowWrap}>
                {SLOTS.map((s) => (
                  <Pressable key={s.id} style={chip(slot === s.id)} onPress={() => setSlot(s.id)}>
                    <ThemedText style={chipText(slot === s.id)}>{tr(s.en)}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={card}>
              <Header icon="info" title={tr("Pick-up")} />
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                {tr("The seller will message you with the pick-up place and time after confirming your order.")}
              </ThemedText>
            </View>
          )}

          {/* Coupon */}
          <View style={card}>
            <Header icon="tag" title={tr("Promo code")} />
            <View style={styles.couponRow}>
              <TextInput
                style={[input, { flex: 1, minWidth: 0 }]}
                value={couponInput}
                onChangeText={(v) => setCouponInput(v.toUpperCase())}
                placeholder={tr("Enter code")}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
              />
              {quote.coupon ? (
                <Pressable style={[styles.applyBtn, { borderColor: theme.primary, borderWidth: 1 }]} onPress={() => { setCouponCode(""); setCouponInput(""); }}>
                  <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>{tr("Remove")}</ThemedText>
                </Pressable>
              ) : (
                <Pressable style={[styles.applyBtn, { backgroundColor: couponInput.trim() ? theme.primary : theme.textSecondary }]} disabled={!couponInput.trim()} onPress={() => applyCoupon(couponInput)}>
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>{tr("Apply")}</ThemedText>
                </Pressable>
              )}
            </View>
            {quote.coupon ? (
              <View style={styles.checkRow}>
                <Feather name="check-circle" size={16} color={theme.success || theme.primary} />
                <ThemedText style={{ color: theme.success || theme.primary, fontSize: 13, flex: 1 }}>
                  {quote.coupon.code}: {tr(quote.coupon.description)}
                </ThemedText>
              </View>
            ) : couponCode && quote.couponError ? (
              <View style={styles.checkRow}>
                <Feather name="alert-circle" size={16} color="#DC2626" />
                <ThemedText style={{ color: "#DC2626", fontSize: 13, flex: 1 }}>{tr(quote.couponError)}</ThemedText>
              </View>
            ) : null}
            {!quote.coupon && coupons.length ? (
              <View style={[styles.rowWrap, { marginTop: Spacing.sm }]}>
                {coupons.map((c) => (
                  <Pressable key={c.code} style={[styles.couponChip, { borderColor: theme.primary }]} onPress={() => applyCoupon(c.code)}>
                    <ThemedText style={{ color: theme.primary, fontSize: 12, fontWeight: "700" }}>{c.code}</ThemedText>
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={2}>{tr(c.description)}</ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Payment */}
          <View style={card}>
            <Header icon="credit-card" title={tr("Payment Method")} />
            <Pressable onPress={() => setPayment("cod")} style={[styles.option, { borderColor: payment === "cod" ? theme.primary : theme.inputBorder, backgroundColor: payment === "cod" ? `${theme.primary}10` : "transparent" }]}>
              <View style={[styles.radioOuter, { borderColor: payment === "cod" ? theme.primary : theme.textSecondary }]}>
                {payment === "cod" ? <View style={[styles.radioInner, { backgroundColor: theme.primary }]} /> : null}
              </View>
              <Feather name="dollar-sign" size={20} color={theme.text} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText style={[styles.bold, { color: theme.text }]}>{tr("Cash on Delivery")}</ThemedText>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{tr("Pay when you receive your order")}</ThemedText>
              </View>
            </Pressable>
            <Pressable
              onPress={() => Alert.alert(tr("bKash payment"), tr("Online bKash payment turns on once the shop's bKash merchant keys are added. Please choose Cash on Delivery for now."))}
              style={[styles.option, { borderColor: theme.inputBorder, opacity: 0.6 }]}
            >
              <View style={[styles.radioOuter, { borderColor: theme.textSecondary }]} />
              <Feather name="smartphone" size={20} color="#E2136E" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText style={[styles.bold, { color: theme.text }]}>{tr("bKash")}</ThemedText>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{tr("Needs bKash merchant keys")}</ThemedText>
              </View>
            </Pressable>
          </View>

          {/* Notes */}
          <View style={card}>
            <Header icon="edit-3" title={tr("Order notes")} />
            <TextInput
              style={[input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={tr("Anything the seller should know (optional)")}
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          {/* Summary */}
          <View style={card}>
            <Header icon="shopping-bag" title={tr("Order Summary")} />
            {items.map((i) => {
              const err = quote.stockErrors.find((e) => e.productId === i.productId);
              return (
                <View key={i.id} style={styles.summaryItem}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText style={{ color: theme.text, fontSize: 14 }} numberOfLines={1}>{i.name}</ThemedText>
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {i.quantity} × {money(i.price)}{i.unit ? `/${i.unit}` : ""}
                    </ThemedText>
                    {err ? (
                      <ThemedText style={{ color: "#DC2626", fontSize: 12 }}>
                        {tr("Only")} {err.available} {tr("left")}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={{ color: theme.text, fontWeight: "600" }}>{money(i.price * i.quantity)}</ThemedText>
                </View>
              );
            })}
            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
            <View style={styles.summaryRow}>
              <ThemedText style={{ color: theme.textSecondary }}>{tr("Subtotal")}</ThemedText>
              <ThemedText style={{ color: theme.text }}>{money(quote.subtotal)}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={{ color: theme.textSecondary }}>{tr("Delivery fee")}</ThemedText>
              <ThemedText style={{ color: theme.text }}>{quote.deliveryFee ? money(quote.deliveryFee) : tr("Free")}</ThemedText>
            </View>
            {quote.discount > 0 ? (
              <View style={styles.summaryRow}>
                <ThemedText style={{ color: theme.success || theme.primary }}>{tr("Discount")} ({quote.coupon?.code})</ThemedText>
                <ThemedText style={{ color: theme.success || theme.primary }}>−{money(quote.discount)}</ThemedText>
              </View>
            ) : null}
            <View style={[styles.summaryRow, { marginTop: Spacing.xs }]}>
              <ThemedText type="h4" style={{ color: theme.text }}>{tr("Total")}</ThemedText>
              <ThemedText type="h4" style={{ color: theme.primary }}>{money(quote.total)}</ThemedText>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.footer, { backgroundColor: theme.white, borderTopColor: theme.cardBorder, paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={[styles.inner, styles.footerInner]}>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{tr("Total")}</ThemedText>
            <ThemedText type="h4" style={{ color: theme.text }}>{quoting ? "…" : money(quote.total)}</ThemedText>
          </View>
          <Pressable
            testID="button-place-order"
            style={[styles.placeBtn, { backgroundColor: canPlace ? theme.primary : theme.textSecondary }]}
            disabled={!canPlace}
            onPress={handlePlaceOrder}
          >
            {isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.placeText} numberOfLines={1}>{tr("Place Order")}</ThemedText>}
          </Pressable>
        </View>
      </View>

      {/* Saved address picker */}
      <Modal visible={addrModal} transparent animationType="fade" onRequestClose={() => setAddrModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setAddrModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.white }]} onPress={() => {}}>
            <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.md }}>{tr("Choose an address")}</ThemedText>
            <ScrollView style={{ maxHeight: 420 }}>
              {savedAddrs.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => { setSelectedId(a.id); setAddrModal(false); }}
                  style={[styles.savedCard, { borderColor: a.id === selectedId ? theme.primary : theme.cardBorder, marginBottom: Spacing.sm }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText style={[styles.bold, { color: theme.text }]}>{a.label} · {a.fullName}</ThemedText>
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={2}>
                      {[a.address, a.upazila || a.area, a.district || a.city].filter(Boolean).join(", ")}
                    </ThemedText>
                  </View>
                  {a.id === selectedId ? <Feather name="check" size={18} color={theme.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirmation */}
      <Modal visible={!!placed} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.white, alignItems: "center" }]}>
            <View style={[styles.successIcon, { backgroundColor: `${theme.primary}20` }]}>
              <Feather name="check" size={40} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={{ color: theme.text, textAlign: "center" }}>{tr("Order placed!")}</ThemedText>
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
              {tr("Order")} {placed?.id} · {placed ? money(placed.total) : ""}
            </ThemedText>
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs, fontSize: 13 }}>
              {method === "pickup"
                ? tr("The seller will tell you when it's ready to pick up.")
                : `${tr("Delivery")}: ${dayLabel(days.find((d) => d.iso === deliveryDate)?.date || days[0].date, days.findIndex((d) => d.iso === deliveryDate))}, ${tr(SLOTS.find((s) => s.id === slot)?.en || "")}`}
            </ThemedText>
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs, fontSize: 12 }}>
              {tr("You'll get a notification each time the seller updates it.")}
            </ThemedText>
            <Pressable
              style={[styles.placeBtn, { backgroundColor: theme.primary, alignSelf: "stretch", marginTop: Spacing.lg }]}
              onPress={() => {
                const id = placed!.id;
                setPlaced(null);
                navigation.replace("OrderDetail", { orderId: id });
              }}
            >
              <ThemedText style={styles.placeText}>{tr("Track order")}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.placeBtn, { borderColor: theme.primary, borderWidth: 1, alignSelf: "stretch", marginTop: Spacing.sm }]}
              onPress={() => {
                setPlaced(null);
                navigation.navigate("Main" as any, { screen: "Market" });
              }}
            >
              <ThemedText style={[styles.placeText, { color: theme.primary }]}>{tr("Continue shopping")}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  inner: { width: "100%", maxWidth: 760, alignSelf: "center" },
  section: { borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "500" },
  savedCard: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, marginTop: Spacing.md },
  bold: { fontWeight: "600", fontSize: 14 },
  formRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  formCol: { flexGrow: 1, flexBasis: 220, minWidth: 0, marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: "500", marginBottom: Spacing.xs },
  input: { height: 46, paddingHorizontal: Spacing.md, fontSize: 15, borderWidth: 1, borderRadius: BorderRadius.sm },
  textArea: { height: 80, paddingTop: Spacing.sm },
  checkRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  option: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, marginBottom: Spacing.sm },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  couponRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  applyBtn: { height: 46, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  couponChip: { borderWidth: 1, borderStyle: "dashed", borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, flexBasis: 150, flexGrow: 1, minWidth: 0 },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: Spacing.sm },
  divider: { height: 1, marginVertical: Spacing.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: Spacing.md, paddingHorizontal: Spacing.lg },
  footerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md },
  placeBtn: { height: 50, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.full, alignItems: "center", justifyContent: "center", minWidth: 150 },
  placeText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: Spacing.lg },
  modalCard: { width: "100%", maxWidth: 420, borderRadius: BorderRadius.lg, padding: Spacing.xl },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
});
