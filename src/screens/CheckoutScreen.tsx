import React, { useEffect, useMemo, useState } from "react";
import { MayaRadius } from "@/constants/mayaTheme";
import { View, StyleSheet, TextInput, Pressable, Modal, ActivityIndicator, Alert, ScrollView, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCartStore, cartRule, nextQty, canStepUp } from "@/lib/cartStore";
import { amountText, perUnitText, totalContentText } from "@shared/selling";
import { useOrdersStore } from "@/lib/ordersStore";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { getApiUrl } from "@/lib/query-client";
import { apiGet, apiPost, isLoggedIn } from "@/lib/api";
import { makeGuestKey, saveGuestOrder } from "@/lib/guestOrders";
import { DIVISIONS, divisionOf, divisionLabel } from "@/lib/bdLocations";
import { useTr } from "@/lib/tr";

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Method = "home" | "express" | "pickup";
type Payment = "cod" | "rocket";
/** Methods the admin turned on (admin > More > Payment settings). Server: GET /api/checkout/payment-methods. */
type PayMethod = { id: Payment; accountNumber?: string; accountName?: string; accountType?: "personal" | "merchant" | "agent"; instructionsEn?: string; instructionsBn?: string };
const ROCKET_COLOR = "#8C3494";
const rocketNum = (v: string) => {
  const m = v.replace(/[\s\-()]/g, "").match(/^(?:\+?88)?(01[3-9]\d{8}\d?)$/);
  return m ? m[1] : null;
};
const trxOk = (v: string) => /^[A-Z0-9]{6,20}$/.test(v.replace(/[\s\-]/g, "").toUpperCase());
type Zone = "inside_dhaka" | "outside_dhaka";

/** Same rule as the server (normalizeBdPhone): 01XXXXXXXXX, optionally with +88 / 88. */
export const bdPhone = (v: string) => {
  const m = String(v || "").replace(/[\s\-()]/g, "").match(/^(?:\+?88)?(01[3-9]\d{8})$/);
  return m ? m[1] : null;
};

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
  itemErrors?: { productId: string; name: string; error: string }[];
  zone?: Zone;
  zones?: { id: Zone; fee: number }[];
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
function localQuote(subtotal: number, method: Method, zone: Zone): Quote {
  const dhaka = zone === "inside_dhaka";
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
    itemErrors: [],
    zone,
    zones: [{ id: "inside_dhaka", fee: 60 }, { id: "outside_dhaka", fee: 120 }],
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
  const { items, getTotal, clearCart, updateQuantity, removeItem } = useCartStore();
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

  // ---------- delivery area (inside / outside Dhaka) ----------
  const [zone, setZone] = useState<Zone>(division === "Dhaka" ? "inside_dhaka" : "outside_dhaka");
  useEffect(() => {
    setZone(division === "Dhaka" ? "inside_dhaka" : "outside_dhaka");
  }, [division]);

  // ---------- contact for this order ----------
  const [contact, setContact] = useState({ name: "", phone: "", alt: "" });
  const [contactTouched, setContactTouched] = useState(false);
  useEffect(() => {
    if (contactTouched) return;
    const src = usingSaved && selectedAddr ? selectedAddr : form;
    setContact((c) => ({ ...c, name: src.fullName || "", phone: src.phone || "" }));
  }, [usingSaved, selectedId, form.fullName, form.phone, contactTouched]);
  const editContact = (k: "name" | "phone" | "alt") => (v: string) => {
    setContactTouched(true);
    setContact((c) => ({ ...c, [k]: v }));
  };
  const phoneOk = !!bdPhone(contact.phone);
  const altOk = !contact.alt.trim() || !!bdPhone(contact.alt);

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
  const [payMethods, setPayMethods] = useState<PayMethod[] | null>(null);
  const [rocketFrom, setRocketFrom] = useState("");
  const [rocketTrx, setRocketTrx] = useState("");
  const [copied, setCopied] = useState(false);
  const loadPayMethods = () =>
    apiGet<{ methods: PayMethod[] }>("/api/checkout/payment-methods")
      .then((r) => {
        const list = Array.isArray(r?.methods) ? r.methods.filter((m) => m.id === "cod" || m.id === "rocket") : [];
        setPayMethods(list);
        setPayment((cur) => (list.some((m) => m.id === cur) ? cur : list[0]?.id || "cod"));
      })
      .catch(() => setPayMethods((cur) => cur || [{ id: "cod" }]));
  useEffect(() => {
    loadPayMethods();
  }, []);
  const rocket = payMethods?.find((m) => m.id === "rocket");
  const rocketOk = payment !== "rocket" || (!!rocket && !!rocketNum(rocketFrom) && trxOk(rocketTrx));
  const payOk = !!payMethods && payMethods.some((m) => m.id === payment) && rocketOk;
  const [quote, setQuote] = useState<Quote>(() => localQuote(getTotal(), "home", "inside_dhaka"));
  const [quoting, setQuoting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [placed, setPlaced] = useState<{ id: string; total: number } | null>(null);

  useEffect(() => {
    apiGet("/api/coupons").then(setCoupons).catch(() => {});
  }, []);

  const itemsKey = items.map((i) => `${i.productId}:${i.quantity}:${i.price}:${JSON.stringify(i.options || {})}`).join("|");
  useEffect(() => {
    let live = true;
    setQuoting(true);
    apiPost<Quote>("/api/checkout/quote", {
      items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, options: i.options })),
      deliveryMethod: method,
      division,
      zone,
      couponCode,
    })
      .then((q) => {
        if (!live) return;
        setQuote(q);
        if (q.deliveryMethod !== method) setMethod(q.deliveryMethod);
      })
      .catch(() => live && setQuote(localQuote(getTotal(), method, zone)))
      .finally(() => live && setQuoting(false));
    return () => {
      live = false;
    };
  }, [itemsKey, method, division, zone, couponCode]);

  const applyCoupon = (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCouponInput(code.toUpperCase());
    setCouponCode(code.trim().toUpperCase());
  };

  const formValid = usingSaved
    ? true
    : !!((form.fullName.trim() || contact.name.trim()) && (form.phone.trim().length >= 6 || phoneOk) && form.district.trim() && form.address.trim());
  const zoneOk = method === "pickup" || zone === "outside_dhaka" || division === "Dhaka";
  const contactOk = !!contact.name.trim() && phoneOk && altOk;
  const canPlace =
    items.length > 0 && formValid && contactOk && zoneOk && payOk && !isProcessing && quote.stockErrors.length === 0 && !(quote.itemErrors || []).length;

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
    let orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    // No account: the order gets a random key; only this phone/browser (and the order link) can open it.
    const guestKey = loggedIn ? "" : makeGuestKey();
    const ship = shipping();
    const checkout = {
      deliveryMethod: method,
      zone,
      contactName: contact.name.trim(),
      contactPhone: bdPhone(contact.phone) || contact.phone.trim(),
      altPhone: contact.alt.trim() ? bdPhone(contact.alt) || contact.alt.trim() : "",
      address: ship.address,
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
          ...(guestKey ? { guestKey } : {}),
          shippingAddress: { fullName: checkout.contactName || ship.fullName, address: ship.address, city: ship.city, phone: checkout.contactPhone || ship.phone },
          total: quote.total,
          itemCount: items.reduce((n, i) => n + (Number.isInteger(i.quantity) ? i.quantity || 1 : 1), 0),
          paymentMethod: payment,
          ...(payment === "rocket" ? { payment: { senderNumber: rocketNum(rocketFrom), trxId: rocketTrx.replace(/[\s\-]/g, "").toUpperCase() } } : {}),
          checkout,
          items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, image: i.image, unit: i.unit, ...(i.options ? { options: i.options } : {}) })),
        }),
      });
      const data = await r.json().catch(() => null);
      if (r.status >= 400 && String(data?.code || "").startsWith("payment_method")) {
        // The admin changed payment settings while the buyer was on this page.
        setIsProcessing(false);
        loadPayMethods();
        Alert.alert(isBn ? "পেমেন্ট পদ্ধতি" : "Payment method", isBn ? "এই পেমেন্ট পদ্ধতি এখন বন্ধ। অন্য একটি বেছে নিন।" : data?.error || "");
        return;
      }
      if (r.status >= 400 && String(data?.code || "").startsWith("rocket")) {
        setIsProcessing(false);
        const bn: Record<string, string> = {
          rocket_sender: "যে রকেট নম্বর থেকে টাকা পাঠিয়েছেন সেটি লিখুন",
          rocket_trxid: "রকেটের মেসেজ থেকে ট্রানজেকশন আইডি (TrxID) লিখুন",
          rocket_trxid_used: "এই ট্রানজেকশন আইডি আগেই অন্য একটি অর্ডারে ব্যবহার হয়েছে",
        };
        Alert.alert("Rocket", isBn ? bn[data.code] || data?.error : data?.error || "");
        return;
      }
      if (r.status === 409) {
        setIsProcessing(false);
        Alert.alert(tr("Not enough stock"), data?.error || "");
        return;
      }
      if (r.status >= 400 && r.status < 500) {
        // The server checks phone, delivery area, quantities and options; don't keep a local copy of a rejected order.
        setIsProcessing(false);
        Alert.alert(tr("Please check your order"), tr(data?.error || "Something is missing"));
        return;
      }
      if (r.ok) {
        savedOnServer = !!token;
        if (typeof data?.id === "string" && data.id) orderId = data.id;
        if (typeof data?.total === "number") finalTotal = data.total;
        serverCheckout = data?.checkout || null;
      } else if (guestKey) {
        // A guest order only exists on the server, so don't pretend it went through.
        setIsProcessing(false);
        if (r.status === 429) Alert.alert(isBn ? "একটু পরে চেষ্টা করুন" : "Please try again later", isBn ? "এই সংযোগ থেকে অনেকগুলো অর্ডার হয়েছে। একটু পরে আবার চেষ্টা করুন বা দোকানে কল করুন।" : data?.error || "");
        else Alert.alert(isBn ? "অর্ডার হয়নি" : "Order not placed", isBn ? "সার্ভারে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।" : "Something went wrong on our side. Please try again in a moment.");
        return;
      }
    } catch {
      if (guestKey) {
        setIsProcessing(false);
        Alert.alert(isBn ? "ইন্টারনেট সংযোগ নেই" : "You're offline", isBn ? "অ্যাকাউন্ট ছাড়া অর্ডার করতে ইন্টারনেট লাগবে। সংযোগ পেলে আবার চেষ্টা করুন।" : "Ordering without an account needs the internet. Please try again when you're connected.");
        return;
      }
      // offline: keep the local order only (cash on delivery). A Rocket payment must reach the server with its TrxID.
      if (payment === "rocket") {
        setIsProcessing(false);
        Alert.alert("Rocket", isBn ? "ইন্টারনেট সংযোগ নেই। সংযোগ পেলে আবার অর্ডার করুন; আপনার TrxID রাখা আছে।" : "You're offline. Place the order again when you're connected; your TrxID is still filled in.");
        return;
      }
    }

    if (loggedIn && !usingSaved && saveAddress) {
      apiPost("/api/me/addresses", {
        label: "Home",
        fullName: ship.fullName || contact.name.trim(),
        phone: ship.phone || bdPhone(contact.phone) || contact.phone.trim(),
        division: ship.division,
        district: ship.district,
        upazila: ship.upazila,
        address: form.address.trim(),
      }).catch(() => {});
    }

    if (guestKey) {
      await saveGuestOrder({ id: orderId, key: guestKey, total: finalTotal, createdAt: new Date().toISOString(), contactName: checkout.contactName }).catch(() => {});
      setIsProcessing(false);
      clearCart();
      setPlaced({ id: orderId, total: finalTotal });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    await addOrder({
      id: orderId,
      onServer: savedOnServer,
      items: items.map((item) => {
        const r = cartRule(item);
        return { id: item.id, productId: item.productId, name: item.name, price: item.price, quantity: item.quantity, image: item.image, options: item.options, unit: r.unit, sellAs: r.sellAs, ...(r.packSize ? { packSize: r.packSize, packUnit: r.packUnit } : {}) };
      }),
      total: finalTotal,
      currency: "৳",
      status: "pending",
      shippingAddress: { fullName: checkout.contactName || ship.fullName, address: ship.address, city: ship.city, phone: checkout.contactPhone || ship.phone },
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
  const money = (n: number) => `৳${(Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const freeLeft = method === "home" && quote.deliveryFee > 0 ? quote.freeDeliveryOver - quote.subtotal : 0;

  // ---------- progress (redesign: numbered steps + live progress bar) ----------
  const addrDone = items.length > 0 && formValid && contactOk;
  const deliveryDone = addrDone && zoneOk;
  const payDone = deliveryDone && payOk;
  const reviewDone = canPlace;
  const STEPS = [
    { key: "address", en: "Address", bn: "ঠিকানা", done: addrDone },
    { key: "delivery", en: "Delivery", bn: "ডেলিভারি", done: deliveryDone },
    { key: "payment", en: "Payment", bn: "পেমেন্ট", done: payDone },
    { key: "review", en: "Review", bn: "যাচাই", done: reviewDone },
  ];
  const currentStep = Math.max(0, STEPS.findIndex((x) => !x.done));
  const itemCount = items.length;
  const missing: { testHint: boolean; text: string } | null =
    items.length === 0
      ? { testHint: false, text: isBn ? "কার্ট খালি" : "Your cart is empty" }
      : !formValid
        ? { testHint: false, text: isBn ? "ডেলিভারির ঠিকানা লিখুন" : "Add your delivery address" }
        : !contactOk
          ? { testHint: true, text: tr("Add a valid contact number") }
          : !zoneOk
            ? { testHint: false, text: isBn ? "ডেলিভারি এলাকা বেছে নিন" : "Choose your delivery area" }
            : !payOk
              ? { testHint: false, text: payment === "rocket" ? (isBn ? "রকেট নম্বর আর TrxID লিখুন" : "Add your Rocket number and TrxID") : isBn ? "পেমেন্ট পদ্ধতি বেছে নিন" : "Choose a payment method" }
              : quote.stockErrors.length || (quote.itemErrors || []).length
                ? { testHint: false, text: isBn ? "কিছু পণ্যে সমস্যা আছে, নিচে দেখুন" : "Some items need a fix, see below" }
                : null;

  const card = [styles.section, { backgroundColor: theme.white }, Shadows.small];
  const input = [styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: "transparent" }];
  const chip = (active: boolean, disabled = false) => [
    styles.chip,
    { backgroundColor: active ? theme.primary : theme.backgroundSecondary, borderColor: active ? theme.primary : "transparent", opacity: disabled ? 0.5 : 1 },
  ];
  const chipText = (active: boolean) => [styles.chipText, { color: active ? "#FFFFFF" : theme.text, fontWeight: active ? ("700" as const) : ("500" as const) }];
  const Header = ({ icon, title, step, done, sub }: { icon: any; title: string; step?: number; done?: boolean; sub?: string }) => (
    <View style={styles.sectionHeader}>
      {step ? (
        <View style={[styles.stepBadge, { backgroundColor: done ? theme.primary : theme.primarySoft }]}>
          {done ? <AppIcon name="check" size={14} color="#FFFFFF" /> : <ThemedText style={{ color: theme.primary, fontWeight: "800", fontSize: 13 }}>{isBn ? "০১২৩৪৫৬৭৮৯"[step] : step}</ThemedText>}
        </View>
      ) : (
        <View style={[styles.iconBadge, { backgroundColor: theme.primarySoft }]}>
          <AppIcon name={icon} size={15} color={theme.primary} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText type="h4" style={{ color: theme.text }}>
          {title}
        </ThemedText>
        {sub ? <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: 1 }}>{sub}</ThemedText> : null}
      </View>
      {step ? <AppIcon name={icon} size={18} color={done ? theme.primary : theme.textTertiary} /> : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.scrollContent, { paddingTop: Spacing.md, paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {/* Progress */}
          <View testID="checkout-progress" style={[styles.progressCard, { backgroundColor: theme.white }, Shadows.small]}>
            <View style={styles.progressTop}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600", letterSpacing: 0.3 }}>
                  {isBn ? `ধাপ ${"০১২৩৪৫৬৭৮৯"[Math.min(currentStep + 1, 4)]} / ৪` : `STEP ${Math.min(currentStep + 1, 4)} OF 4`}
                </ThemedText>
                <ThemedText type="h3" style={{ color: theme.text }}>{isBn ? "অর্ডার সম্পূর্ণ করুন" : "Complete your order"}</ThemedText>
              </View>
              <View style={[styles.totalPill, { backgroundColor: theme.primarySoft }]}>
                <AppIcon name="shopping-bag" size={13} color={theme.primary} />
                <ThemedText style={{ color: theme.primary, fontWeight: "800", fontSize: 13 }}>{quoting ? "…" : money(quote.total)}</ThemedText>
              </View>
            </View>
            <View style={styles.stepsRow}>
              {STEPS.map((st, idx) => {
                const active = idx === currentStep && !st.done;
                return (
                  <View key={st.key} style={styles.stepCol} testID={`checkout-step-${st.key}${st.done ? "-done" : ""}`}>
                    <View style={[styles.stepBar, { backgroundColor: st.done ? theme.primary : active ? theme.accent : theme.backgroundTertiary }]} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      {st.done ? <AppIcon name="check-circle" size={12} color={theme.primary} /> : null}
                      <ThemedText numberOfLines={1} style={{ fontSize: 12, fontWeight: st.done || active ? "700" : "500", color: st.done ? theme.primary : active ? theme.text : theme.textTertiary }}>
                        {isBn ? st.bn : st.en}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </View>
            {items.length ? (
              <Pressable testID="checkout-items-strip" onPress={() => navigation.navigate("Cart" as any)} style={[styles.itemsStrip, { backgroundColor: theme.backgroundRoot }]}>
                <View style={{ flexDirection: "row" }}>
                  {items.slice(0, 4).map((i, idx) => (
                    <View key={i.id} style={[styles.thumbStack, { marginLeft: idx ? -12 : 0, borderColor: theme.white, backgroundColor: theme.primarySoft, zIndex: 10 - idx }]}>
                      {i.image ? <Image source={{ uri: i.image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <AppIcon name="package" size={16} color={theme.primary} />}
                    </View>
                  ))}
                  {items.length > 4 ? (
                    <View style={[styles.thumbStack, { marginLeft: -12, borderColor: theme.white, backgroundColor: theme.primary }]}>
                      <ThemedText style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 12 }}>+{items.length - 4}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText style={{ color: theme.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
                    {isBn ? `${itemCount.toLocaleString("bn-BD")}টি পণ্য` : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
                  </ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>{items.map((i) => i.name).join(", ")}</ThemedText>
                </View>
                <ThemedText style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>{isBn ? "কার্ট" : "Cart"}</ThemedText>
                <AppIcon name="chevron-right" size={16} color={theme.primary} />
              </Pressable>
            ) : null}
          </View>

          {!loggedIn ? (
            <View testID="checkout-guest-note" style={[styles.section, { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.primarySoft }]}>
              <AppIcon name="user-check" size={18} color={theme.primary} />
              <ThemedText style={{ color: theme.text, flex: 1, fontSize: 13 }}>
                {isBn ? "অ্যাকাউন্ট ছাড়াই অর্ডার করছেন। শুধু নাম, ফোন নম্বর আর ঠিকানা দিন।" : "You're ordering without an account. Just add your name, phone and address."}
              </ThemedText>
              <Pressable testID="checkout-guest-login" hitSlop={8} onPress={() => navigation.navigate("Login" as any)}>
                <ThemedText style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>{isBn ? "লগ ইন" : "Log in"}</ThemedText>
              </Pressable>
            </View>
          ) : null}
          {/* Address */}
          <View style={card}>
            <Header icon="map-pin" step={1} done={formValid && items.length > 0} title={tr("Delivery address")} sub={isBn ? "কোথায় পৌঁছে দেব" : "Where should we bring it?"} />
            {savedAddrs.length > 0 ? (
              <View style={styles.rowWrap}>
                <Pressable style={chip(!useNew)} onPress={() => setUseNew(false)}>
                  <AppIcon name="bookmark" size={13} color={!useNew ? "#FFFFFF" : theme.text} />
                  <ThemedText style={chipText(!useNew)}>{tr("Saved address")}</ThemedText>
                </Pressable>
                <Pressable style={chip(useNew)} onPress={() => setUseNew(true)}>
                  <AppIcon name="plus" size={13} color={useNew ? "#FFFFFF" : theme.text} />
                  <ThemedText style={chipText(useNew)}>{tr("New address")}</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {usingSaved && selectedAddr ? (
              <Pressable style={[styles.savedCard, { borderColor: theme.primary, backgroundColor: theme.primarySoft }]} onPress={() => setAddrModal(true)}>
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
                    <AppIcon name={saveAddress ? "check-square" : "square"} size={18} color={theme.primary} />
                    <ThemedText style={{ color: theme.text, fontSize: 14 }}>{tr("Save this address for next time")}</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>

          {/* Contact for this order */}
          <View style={card} testID="checkout-contact">
            <Header icon="phone" step={2} done={contactOk} title={tr("Contact number")} />
            <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginBottom: Spacing.sm }}>
              {tr("The seller and delivery person will call this number.")}
            </ThemedText>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <ThemedText style={[styles.label, { color: theme.text }]}>{tr("Receiver's name")}</ThemedText>
                <TextInput testID="input-contact-name" style={input} value={contact.name} onChangeText={editContact("name")} placeholder={tr("Full name")} placeholderTextColor={theme.textSecondary} />
              </View>
              <View style={styles.formCol}>
                <ThemedText style={[styles.label, { color: theme.text }]}>{tr("Mobile number")}</ThemedText>
                <TextInput testID="input-contact-phone" style={[input, contact.phone && !phoneOk ? { borderColor: "#DC2626" } : null]} value={contact.phone} onChangeText={editContact("phone")} placeholder="01XXXXXXXXX" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" maxLength={16} />
              </View>
            </View>
            {contact.phone && !phoneOk ? (
              <ThemedText style={{ color: "#DC2626", fontSize: 12, marginBottom: Spacing.sm }}>{tr("Enter a Bangladeshi mobile number, like 01712345678")}</ThemedText>
            ) : null}
            <ThemedText style={[styles.label, { color: theme.text }]}>{tr("Second number (optional)")}</ThemedText>
            <TextInput testID="input-contact-alt" style={[input, !altOk ? { borderColor: "#DC2626" } : null]} value={contact.alt} onChangeText={editContact("alt")} placeholder="01XXXXXXXXX" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" maxLength={16} />
            {!altOk ? <ThemedText style={{ color: "#DC2626", fontSize: 12 }}>{tr("Enter a Bangladeshi mobile number, like 01712345678")}</ThemedText> : null}
          </View>

          {/* Delivery area */}
          {method !== "pickup" ? (
            <View style={card} testID="checkout-zone">
              <Header icon="map" title={tr("Delivery area")} />
              <View style={styles.formRow}>
                {(["inside_dhaka", "outside_dhaka"] as Zone[]).map((z) => {
                  const active = zone === z;
                  const disabled = z === "inside_dhaka" && division !== "Dhaka";
                  const fee = (quote.zones || []).find((x) => x.id === z)?.fee;
                  return (
                    <Pressable
                      key={z}
                      testID={`zone-${z}`}
                      disabled={disabled}
                      onPress={() => setZone(z)}
                      style={[styles.option, styles.formCol, { borderColor: active ? theme.primary : theme.inputBorder, backgroundColor: active ? `${theme.primary}10` : "transparent", opacity: disabled ? 0.5 : 1 }]}
                    >
                      <View style={[styles.radioOuter, { borderColor: active ? theme.primary : theme.textSecondary }]}>
                        {active ? <View style={[styles.radioInner, { backgroundColor: theme.primary }]} /> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <ThemedText style={[styles.bold, { color: theme.text }]}>{z === "inside_dhaka" ? tr("Inside Dhaka") : tr("Outside Dhaka")}</ThemedText>
                        <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                          {fee === undefined ? "" : `${tr("Home delivery")} ${money(fee)}`}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {division !== "Dhaka" ? (
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{tr("Inside Dhaka needs an address in Dhaka division.")}</ThemedText>
              ) : null}
            </View>
          ) : null}

          {/* Delivery method */}
          <View style={card}>
            <Header icon="truck" step={3} done={deliveryDone} title={tr("Delivery method")} />
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
                  <AppIcon name={METHOD_ICON[m.id]} size={20} color={theme.text} />
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
              <View testID="free-delivery-meter" style={[styles.freeMeter, { backgroundColor: theme.accentSoft }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <AppIcon name="gift" size={14} color={theme.accent} />
                  <ThemedText style={{ color: theme.text, fontSize: 12.5, flex: 1 }}>
                    {tr("Add")} <ThemedText style={{ color: theme.text, fontWeight: "800", fontSize: 12.5 }}>{money(freeLeft)}</ThemedText> {tr("more for free home delivery")}
                  </ThemedText>
                </View>
                <View style={[styles.meterTrack, { backgroundColor: theme.white }]}>
                  <LinearGradient
                    colors={[theme.accent, theme.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.meterFill, { width: `${Math.max(6, Math.min(100, (quote.subtotal / Math.max(1, quote.freeDeliveryOver)) * 100))}%` as any }]}
                  />
                </View>
              </View>
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
                <AppIcon name="check-circle" size={16} color={theme.success || theme.primary} />
                <ThemedText style={{ color: theme.success || theme.primary, fontSize: 13, flex: 1 }}>
                  {quote.coupon.code}: {tr(quote.coupon.description)}
                </ThemedText>
              </View>
            ) : couponCode && quote.couponError ? (
              <View style={styles.checkRow}>
                <AppIcon name="alert-circle" size={16} color="#DC2626" />
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
            <Header icon="credit-card" step={4} done={payDone} title={tr("Payment Method")} />
            {payMethods === null ? <ActivityIndicator color={theme.primary} style={{ marginVertical: Spacing.sm }} /> : null}
            {payMethods && payMethods.length === 0 ? (
              <ThemedText style={{ color: "#DC2626", fontSize: 13 }}>
                {isBn ? "এই মুহূর্তে পেমেন্ট বন্ধ আছে। একটু পরে আবার চেষ্টা করুন।" : "Payments are paused right now. Please try again later."}
              </ThemedText>
            ) : null}
            {payMethods?.some((m) => m.id === "cod") ? (
              <Pressable testID="pay-cod" onPress={() => setPayment("cod")} style={[styles.option, { borderColor: payment === "cod" ? theme.primary : theme.inputBorder, backgroundColor: payment === "cod" ? `${theme.primary}10` : "transparent" }]}>
                <View style={[styles.radioOuter, { borderColor: payment === "cod" ? theme.primary : theme.textSecondary }]}>
                  {payment === "cod" ? <View style={[styles.radioInner, { backgroundColor: theme.primary }]} /> : null}
                </View>
                <AppIcon name="dollar-sign" size={20} color={theme.text} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText style={[styles.bold, { color: theme.text }]}>{tr("Cash on Delivery")}</ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{tr("Pay when you receive your order")}</ThemedText>
                </View>
              </Pressable>
            ) : null}
            {rocket ? (
              <Pressable testID="pay-rocket" onPress={() => setPayment("rocket")} style={[styles.option, { borderColor: payment === "rocket" ? ROCKET_COLOR : theme.inputBorder, backgroundColor: payment === "rocket" ? `${ROCKET_COLOR}10` : "transparent" }]}>
                <View style={[styles.radioOuter, { borderColor: payment === "rocket" ? ROCKET_COLOR : theme.textSecondary }]}>
                  {payment === "rocket" ? <View style={[styles.radioInner, { backgroundColor: ROCKET_COLOR }]} /> : null}
                </View>
                <AppIcon name="smartphone" size={20} color={ROCKET_COLOR} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText style={[styles.bold, { color: theme.text }]}>{isBn ? "রকেট" : "Rocket"}</ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{isBn ? "রকেটে টাকা পাঠিয়ে TrxID দিন" : "Send money with Rocket, then enter the TrxID"}</ThemedText>
                </View>
              </Pressable>
            ) : null}
            {rocket && payment === "rocket" ? (
              <View testID="rocket-panel" style={{ borderRadius: MayaRadius.sm, borderWidth: 1, borderColor: `${ROCKET_COLOR}40`, backgroundColor: `${ROCKET_COLOR}08`, padding: Spacing.md, marginTop: Spacing.xs, gap: 8 }}>
                <ThemedText style={{ color: theme.text, fontSize: 13.5, lineHeight: 20 }}>
                  {isBn
                    ? `১. রকেট অ্যাপ বা *322# থেকে ${rocket.accountType === "merchant" ? "পেমেন্ট" : rocket.accountType === "agent" ? "ক্যাশ ইন" : "সেন্ড মানি"} করে ${money(quote.total)} পাঠান এই নম্বরে:`
                    : `1. In the Rocket app or *322#, use ${rocket.accountType === "merchant" ? "Payment" : rocket.accountType === "agent" ? "Cash In" : "Send Money"} to send ${money(quote.total)} to:`}
                </ThemedText>
                <Pressable
                  testID="rocket-copy"
                  onPress={() => {
                    Clipboard.setStringAsync(rocket.accountNumber || "").catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.white, borderRadius: MayaRadius.sm, borderWidth: 1, borderColor: theme.inputBorder, padding: Spacing.sm }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText testID="rocket-number" style={{ color: theme.text, fontSize: 18, fontWeight: "800", letterSpacing: 1 }}>{rocket.accountNumber}</ThemedText>
                    {rocket.accountName ? <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{rocket.accountName}</ThemedText> : null}
                  </View>
                  <AppIcon name={copied ? "check" : "copy"} size={18} color={ROCKET_COLOR} />
                  <ThemedText style={{ color: ROCKET_COLOR, fontWeight: "700", fontSize: 12.5 }}>{copied ? (isBn ? "কপি হয়েছে" : "Copied") : isBn ? "কপি" : "Copy"}</ThemedText>
                </Pressable>
                {(isBn ? rocket.instructionsBn || rocket.instructionsEn : rocket.instructionsEn || rocket.instructionsBn) ? (
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12.5, lineHeight: 18 }}>{isBn ? rocket.instructionsBn || rocket.instructionsEn : rocket.instructionsEn || rocket.instructionsBn}</ThemedText>
                ) : null}
                <ThemedText style={{ color: theme.text, fontSize: 13.5, marginTop: 4 }}>
                  {isBn ? "২. তারপর নিচে লিখুন:" : "2. Then fill in:"}
                </ThemedText>
                <TextInput
                  testID="rocket-from"
                  style={input}
                  value={rocketFrom}
                  onChangeText={(v) => setRocketFrom(v.replace(/[^\d+]/g, "").slice(0, 15))}
                  keyboardType="phone-pad"
                  placeholder={isBn ? "যে রকেট নম্বর থেকে পাঠিয়েছেন" : "Rocket number you sent from"}
                  placeholderTextColor={theme.textSecondary}
                />
                {rocketFrom.trim() && !rocketNum(rocketFrom) ? (
                  <ThemedText style={{ color: "#DC2626", fontSize: 12 }}>{isBn ? "০১ দিয়ে শুরু ১১ বা ১২ সংখ্যার নম্বর লিখুন" : "Use the 11 or 12 digit number that starts with 01"}</ThemedText>
                ) : null}
                <TextInput
                  testID="rocket-trx"
                  style={input}
                  value={rocketTrx}
                  onChangeText={(v) => setRocketTrx(v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 20))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={isBn ? "ট্রানজেকশন আইডি (TrxID)" : "Transaction ID (TrxID)"}
                  placeholderTextColor={theme.textSecondary}
                />
                {rocketTrx.trim() && !trxOk(rocketTrx) ? (
                  <ThemedText style={{ color: "#DC2626", fontSize: 12 }}>{isBn ? "রকেটের মেসেজে থাকা TrxID লিখুন (৬ থেকে ২০ অক্ষর)" : "Type the TrxID from Rocket's message (6 to 20 letters or digits)"}</ThemedText>
                ) : null}
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
                  {isBn ? "অ্যাডমিন TrxID মিলিয়ে দেখে আপনার পেমেন্ট নিশ্চিত করবেন। নিশ্চিত হলে নোটিফিকেশন পাবেন।" : "An admin matches your TrxID in Rocket and confirms the payment. You'll get a notification when it's checked."}
                </ThemedText>
              </View>
            ) : null}
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
            <Header icon="shopping-bag" step={5} done={reviewDone} title={tr("Order Summary")} sub={isBn ? "অর্ডার দেওয়ার আগে একবার দেখে নিন" : "Check everything before you place the order"} />
            {items.map((i) => {
              const err = quote.stockErrors.find((e) => e.productId === i.productId);
              const itemErr = (quote.itemErrors || []).find((e) => e.productId === i.productId);
              return (
                <View key={i.id} style={[styles.summaryItem, { borderBottomColor: theme.divider }]} testID={`summary-item-${i.productId}`}>
                  <View style={[styles.summaryThumb, { backgroundColor: theme.primarySoft }]}>
                    {i.image ? <Image source={{ uri: i.image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <AppIcon name="package" size={18} color={theme.primary} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>{i.name}</ThemedText>
                    {i.options && Object.keys(i.options).length ? (
                      <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={2}>
                        {Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </ThemedText>
                    ) : null}
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {money(i.price)} {perUnitText(cartRule(i), language === "bn")}
                      {totalContentText(cartRule(i), i.quantity, language === "bn") ? ` · ${totalContentText(cartRule(i), i.quantity, language === "bn")}` : ""}
                    </ThemedText>
                    {err ? (
                      <ThemedText style={{ color: "#DC2626", fontSize: 12 }}>
                        {tr("Only")} {amountText(cartRule(i), err.available, language === "bn")} {tr("left")}
                      </ThemedText>
                    ) : null}
                    {itemErr ? <ThemedText style={{ color: "#DC2626", fontSize: 12 }}>{tr(itemErr.error)}</ThemedText> : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <ThemedText style={{ color: theme.text, fontWeight: "600" }}>{money(i.price * i.quantity)}</ThemedText>
                    <View style={[styles.stepper, { borderColor: "transparent", backgroundColor: theme.backgroundSecondary }]}>
                      <Pressable testID={`qty-minus-${i.productId}`} hitSlop={6} style={styles.stepBtn} onPress={() => (nextQty(i, -1) === 0 ? removeItem(i.id) : updateQuantity(i.id, nextQty(i, -1)))}>
                        <AppIcon name={nextQty(i, -1) === 0 ? "trash-2" : "minus"} size={14} color={nextQty(i, -1) === 0 ? "#DC2626" : theme.text} />
                      </Pressable>
                      <ThemedText testID={`qty-${i.productId}`} style={{ color: theme.text, minWidth: 26, textAlign: "center", fontWeight: "600" }}>{amountText(cartRule(i), i.quantity, language === "bn")}</ThemedText>
                      <Pressable testID={`qty-plus-${i.productId}`} hitSlop={6} style={styles.stepBtn} disabled={!!err || !canStepUp(i)} onPress={() => updateQuantity(i.id, nextQty(i, 1))}>
                        <AppIcon name="plus" size={14} color={err || !canStepUp(i) ? theme.textSecondary : theme.text} />
                      </Pressable>
                    </View>
                  </View>
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
            <View style={[styles.summaryRow, styles.totalRow, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="h4" style={{ color: theme.text }}>{tr("Total")}</ThemedText>
              <ThemedText type="h3" style={{ color: theme.primary }}>{money(quote.total)}</ThemedText>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.footer, { backgroundColor: theme.white, paddingBottom: insets.bottom + Spacing.md }, Shadows.small]}>
        <View style={styles.inner}>
          {missing ? (
            <View style={[styles.hintRow, { backgroundColor: theme.accentSoft }]}>
              <AppIcon name="info" size={13} color={theme.warning} />
              <ThemedText testID={missing.testHint ? "checkout-hint" : "checkout-next"} style={{ color: theme.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{missing.text}</ThemedText>
            </View>
          ) : null}
          <View style={styles.footerInner}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                {tr("Total")} · {isBn ? `${itemCount.toLocaleString("bn-BD")}টি পণ্য` : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
              </ThemedText>
              <ThemedText type="h3" style={{ color: theme.text }}>{quoting ? "…" : money(quote.total)}</ThemedText>
              {quote.discount > 0 ? (
                <ThemedText style={{ color: theme.success, fontSize: 11, fontWeight: "700" }}>{isBn ? `${money(quote.discount)} সাশ্রয়` : `You save ${money(quote.discount)}`}</ThemedText>
              ) : quote.deliveryFee === 0 && method !== "pickup" ? (
                <ThemedText style={{ color: theme.success, fontSize: 11, fontWeight: "700" }}>{isBn ? "ফ্রি ডেলিভারি" : "Free delivery"}</ThemedText>
              ) : null}
            </View>
            <Pressable testID="button-place-order" disabled={!canPlace} onPress={handlePlaceOrder} style={({ pressed }) => [styles.placeBtnWrap, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <LinearGradient
                colors={canPlace ? [theme.primary, theme.primaryDark] : [theme.textTertiary, theme.textTertiary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.placeBtn}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <AppIcon name={payment === "rocket" ? "smartphone" : "lock"} size={16} color="#FFFFFF" />
                    <ThemedText style={styles.placeText} numberOfLines={1}>{tr("Place Order")}</ThemedText>
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Saved address picker */}
      <Modal visible={addrModal} transparent animationType="slide" onRequestClose={() => setAddrModal(false)}>
        <Pressable style={[styles.overlay, styles.sheetOverlay]} onPress={() => setAddrModal(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.white, paddingBottom: insets.bottom + Spacing.lg }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundTertiary }]} />
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
                  {a.id === selectedId ? <AppIcon name="check" size={18} color={theme.primary} /> : null}
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
            <View style={[styles.successRing, { backgroundColor: theme.primarySoft }]}>
              <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.successIcon}>
                <AppIcon name="check" size={40} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <ThemedText type="h3" style={{ color: theme.text, textAlign: "center" }}>{tr("Order placed!")}</ThemedText>
            <View style={[styles.orderChip, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                {tr("Order")} <ThemedText style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>{placed?.id}</ThemedText> · <ThemedText style={{ color: theme.primary, fontWeight: "800", fontSize: 13 }}>{placed ? money(placed.total) : ""}</ThemedText>
              </ThemedText>
            </View>
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs, fontSize: 13 }}>
              {method === "pickup"
                ? tr("The seller will tell you when it's ready to pick up.")
                : `${tr("Delivery")}: ${dayLabel(days.find((d) => d.iso === deliveryDate)?.date || days[0].date, days.findIndex((d) => d.iso === deliveryDate))}, ${tr(SLOTS.find((s) => s.id === slot)?.en || "")}`}
            </ThemedText>
            {payment === "rocket" ? (
              <ThemedText testID="placed-rocket" style={{ color: ROCKET_COLOR, textAlign: "center", marginTop: Spacing.xs, fontSize: 13, fontWeight: "600" }}>
                {isBn ? `রকেট পেমেন্ট যাচাইয়ের অপেক্ষায় · TrxID ${rocketTrx}` : `Rocket payment waiting for check · TrxID ${rocketTrx}`}
              </ThemedText>
            ) : null}
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs, fontSize: 12 }}>
              {loggedIn
                ? tr("You'll get a notification each time the seller updates it.")
                : isBn
                  ? "অ্যাকাউন্ট ছাড়াই অর্ডার হয়েছে। দোকান নিশ্চিত করতে আপনাকে কল করতে পারে। অর্ডারের অবস্থা দেখতে \"অর্ডার দেখুন\" চাপুন।"
                  : "Ordered without an account. The shop may call you to confirm. Tap Track order to see its status any time."}
            </ThemedText>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: theme.primary, marginTop: Spacing.lg }]}
              onPress={() => {
                const id = placed!.id;
                setPlaced(null);
                if (!loggedIn) navigation.replace("GuestOrder", { orderId: id });
                else navigation.replace("OrderDetail", { orderId: id });
              }}
            >
              <ThemedText style={styles.placeText}>{tr("Track order")}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: theme.primarySoft, marginTop: Spacing.sm }]}
              onPress={() => {
                setPlaced(null);
                if (!loggedIn) navigation.navigate("ShopPage", undefined as any);
                else navigation.navigate("Main" as any, { screen: "Market" });
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
  section: { borderRadius: MayaRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  iconBadge: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  progressCard: { borderRadius: MayaRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.md },
  progressTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  totalPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full },
  stepsRow: { flexDirection: "row", gap: 6 },
  stepCol: { flex: 1, minWidth: 0, gap: 6 },
  stepBar: { height: 5, borderRadius: 3 },
  itemsStrip: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.sm, paddingRight: Spacing.md, borderRadius: MayaRadius.lg },
  thumbStack: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  summaryThumb: { width: 54, height: 54, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  totalRow: { marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: MayaRadius.lg, marginBottom: 0 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: MayaRadius.sm, marginBottom: Spacing.sm },
  placeBtnWrap: { borderRadius: BorderRadius.full, overflow: "hidden", minWidth: 170 },
  modalBtn: { height: 50, borderRadius: BorderRadius.full, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  freeMeter: { borderRadius: MayaRadius.md, padding: Spacing.md, gap: 8, marginTop: Spacing.xs },
  meterTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  meterFill: { height: 8, borderRadius: 4 },
  sheetOverlay: { justifyContent: "flex-end", padding: 0 },
  sheet: { width: "100%", maxWidth: 760, alignSelf: "center", borderTopLeftRadius: MayaRadius.xl, borderTopRightRadius: MayaRadius.xl, padding: Spacing.lg, paddingTop: Spacing.sm },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: Spacing.md },
  successRing: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  orderChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
 },
  chipText: { fontSize: 13, fontWeight: "500" },
  savedCard: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: MayaRadius.lg, borderWidth: 1.5, marginTop: Spacing.md },
  bold: { fontWeight: "600", fontSize: 14 },
  formRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  formCol: { flexGrow: 1, flexBasis: 220, minWidth: 0, marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: "500", marginBottom: Spacing.xs },
  input: { height: 48, paddingHorizontal: Spacing.md, fontSize: 15, borderWidth: 1.5, borderRadius: MayaRadius.md },
  textArea: { height: 80, paddingTop: Spacing.sm },
  checkRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  option: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderRadius: MayaRadius.lg, borderWidth: 1.5, marginBottom: Spacing.sm },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  couponRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  applyBtn: { height: 48, paddingHorizontal: Spacing.lg, borderRadius: MayaRadius.md, alignItems: "center", justifyContent: "center" },
  couponChip: { borderWidth: 1, borderStyle: "dashed", borderRadius: MayaRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, flexBasis: 150, flexGrow: 1, minWidth: 0 },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 4, paddingVertical: 2 },
  stepBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: Spacing.sm },
  divider: { height: 1, marginVertical: Spacing.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: Spacing.md, paddingHorizontal: Spacing.lg, borderTopLeftRadius: MayaRadius.xl, borderTopRightRadius: MayaRadius.xl },
  footerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md },
  placeBtn: { height: 52, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.full, alignItems: "center", justifyContent: "center" },
  placeText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: Spacing.lg },
  modalCard: { width: "100%", maxWidth: 420, borderRadius: MayaRadius.xl, padding: Spacing.xl },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
});
