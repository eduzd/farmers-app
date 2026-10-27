import React, { useEffect, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPut } from "@/lib/api";
import {
  useL, useLoader, Page, Card, SectionTitle, Btn, Field, KV, Loading, ErrorBox, Text, ToggleRow, Pill,
  taka, fmtDate, statusLabel, STATUS_COLOR, confirmAsk, st,
} from "./ui";
import { StepFill, StepPop, CurrentHalo, FadeSlideIn, OrderProgressBar, useStepStagger, bnDigits } from "@/components/OrderProgressMotion";

/**
 * Orders move one way only, one step at a time:
 *   Pending -> Confirmed -> Packing -> Shipped -> Delivered
 * A finished step stays ticked and can't be picked again. Cancel is possible until delivery.
 * The server enforces the same rule (PUT /api/admin/manage/orders/:id answers 409 otherwise).
 */
export const ORDER_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;

export function nextSteps(status: string): string[] {
  if (status === "delivered" || status === "cancelled") return [];
  const i = (ORDER_FLOW as readonly string[]).indexOf(status);
  return [...(i >= 0 && ORDER_FLOW[i + 1] ? [ORDER_FLOW[i + 1]] : []), "cancelled"];
}

type L = ReturnType<typeof useL>;

function stepText(s: string, L: L, pickup: boolean) {
  switch (s) {
    case "pending": return { title: L("Order placed", "অর্ডার করা হয়েছে"), hint: L("The buyer placed the order", "ক্রেতা অর্ডার করেছেন") };
    case "confirmed": return { title: L("Confirmed", "নিশ্চিত"), hint: L("You checked the order and stock", "অর্ডার ও স্টক যাচাই করা হয়েছে") };
    case "processing": return { title: L("Packing", "প্যাকিং"), hint: L("The seller is packing the items", "বিক্রেতা পণ্য প্যাক করছেন") };
    case "shipped": return pickup
      ? { title: L("Ready for pickup", "নেওয়ার জন্য প্রস্তুত"), hint: L("The buyer can collect it now", "ক্রেতা এখন নিতে পারবেন") }
      : { title: L("Shipped", "পাঠানো হয়েছে"), hint: L("On the way to the buyer", "ক্রেতার কাছে যাচ্ছে") };
    case "delivered": return pickup
      ? { title: L("Picked up", "নেওয়া হয়েছে"), hint: L("The buyer has the order", "ক্রেতা অর্ডার পেয়েছেন") }
      : { title: L("Delivered", "ডেলিভারি হয়েছে"), hint: L("The buyer has the order", "ক্রেতা অর্ডার পেয়েছেন") };
    default: return { title: statusLabel(s, L), hint: "" };
  }
}

function actionText(next: string, L: L, pickup: boolean): { label: string; icon: keyof typeof Feather.glyphMap } {
  switch (next) {
    case "confirmed": return { label: L("Confirm order", "অর্ডার নিশ্চিত করুন"), icon: "check-circle" };
    case "processing": return { label: L("Start packing", "প্যাকিং শুরু করুন"), icon: "package" };
    case "shipped": return pickup ? { label: L("Mark ready for pickup", "নেওয়ার জন্য প্রস্তুত করুন"), icon: "map-pin" } : { label: L("Mark as shipped", "পাঠানো হয়েছে চিহ্নিত করুন"), icon: "truck" };
    case "delivered": return pickup ? { label: L("Mark as picked up", "নেওয়া হয়েছে চিহ্নিত করুন"), icon: "check-square" } : { label: L("Mark as delivered", "ডেলিভারি হয়েছে চিহ্নিত করুন"), icon: "check-square" };
    default: return { label: statusLabel(next, L), icon: "arrow-right" };
  }
}

/** The step tracker with one button for the next step. */
export function OrderProgress({ order, onChanged }: { order: any; onChanged: () => Promise<any> | void }) {
  const { theme } = useTheme();
  const L = useL();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const status: string = order.status || "pending";
  const pickup = order.checkout?.deliveryMethod === "pickup";
  const history: any[] = Array.isArray(order.history) ? order.history : [];
  const cancelled = status === "cancelled";
  // How far the order got. For a cancelled order: the last step it reached before cancelling.
  let reached = (ORDER_FLOW as readonly string[]).indexOf(status);
  if (cancelled) {
    reached = 0;
    for (const h of history) {
      const i = (ORDER_FLOW as readonly string[]).indexOf(h?.status);
      if (i > reached) reached = i;
    }
  }
  if (reached < 0) reached = 0;
  const when = (s: string) => {
    if (s === "pending") return order.createdAt;
    const h = [...history].reverse().find((x) => x?.status === s);
    return h ? h.at || h.date || h.createdAt : null;
  };
  const next = (Array.isArray(order.next) ? order.next : nextSteps(status)).filter((s: string) => s !== "cancelled")[0];
  const canCancel = !cancelled && status !== "delivered";

  const go = async (to: string) => {
    const isCancel = to === "cancelled";
    const a = actionText(to, L, pickup);
    const ok = await confirmAsk(
      isCancel ? L("Cancel this order?", "এই অর্ডার বাতিল করবেন?") : `${a.label}?`,
      isCancel
        ? L("The buyer and seller are told. A cancelled order can't be opened again.", "ক্রেতা ও বিক্রেতাকে জানানো হবে। বাতিল অর্ডার আর চালু করা যাবে না।")
        : L("The buyer and seller get a notification. This step stays done and can't be undone.", "ক্রেতা ও বিক্রেতা নোটিফিকেশন পাবেন। এই ধাপ সম্পন্ন থাকবে, ফেরানো যাবে না।"),
      isCancel ? L("Cancel order", "অর্ডার বাতিল") : L("Yes, continue", "হ্যাঁ, এগিয়ে যান"),
      L("Go back", "ফিরে যান"),
    );
    if (!ok) return;
    setBusy(to); setErr(null);
    try {
      await apiPut(`/api/admin/manage/orders/${order.id}`, { status: to, note: note.trim() || undefined });
      setNote(""); setNoteOpen(false);
      await onChanged();
    } catch (e: any) {
      setErr(e?.message || L("Couldn't update the order", "অর্ডার আপডেট হয়নি"));
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  const stepIdx = cancelled ? reached : (ORDER_FLOW as readonly string[]).indexOf(status);
  // Animations follow the real status only: new steps fill in order, done steps never go back.
  const delayFor = useStepStagger(reached);
  const doneColor = cancelled ? "#7A8CA3" : theme.primary;
  return (
    <Card testID="order-progress">
      <View style={[st.row, { justifyContent: "space-between", marginBottom: 12 }]}>
        <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }}>{L("Order progress", "অর্ডারের অগ্রগতি")}</Text>
        {cancelled ? (
          <FadeSlideIn runKey="cancelled">
            <Pill label={L("Cancelled", "বাতিল")} color={STATUS_COLOR.cancelled} icon="x-circle" />
          </FadeSlideIn>
        ) : (
          <Text testID="order-step-count" style={{ color: theme.textSecondary, fontSize: 12.5, fontWeight: "600" }}>
            {L(`Step ${stepIdx + 1} of 5`, `ধাপ ${bnDigits(stepIdx + 1)} / ৫`)}
          </Text>
        )}
      </View>
      <View style={{ marginTop: -4, marginBottom: 14 }}>
        <OrderProgressBar
          testID="order-progress-bar"
          fraction={(reached + 1) / ORDER_FLOW.length}
          color={doneColor}
          trackColor={theme.cardBorder}
          label={cancelled ? L("Order cancelled", "অর্ডার বাতিল") : L(`Step ${stepIdx + 1} of 5`, `ধাপ ${bnDigits(stepIdx + 1)} / ৫`)}
        />
      </View>
      {ORDER_FLOW.map((s, i) => {
        const done = i <= reached;
        const isNow = !cancelled && i === reached;
        const isNext = !cancelled && s === next;
        const t = stepText(s, L, pickup);
        const at = done ? when(s) : null;
        const skipped = done && i > 0 && !at && i < reached;
        const color = done ? (cancelled ? "#7A8CA3" : theme.primary) : isNext ? theme.primary : theme.cardBorder;
        const last = i === ORDER_FLOW.length - 1;
        return (
          <View key={s} testID={`step-${s}`} accessibilityLabel={`${t.title}: ${done ? L("done", "সম্পন্ন") : L("not yet", "এখনও নয়")}`} style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center", width: 30 }}>
              <View style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}>
              {isNow ? <CurrentHalo runKey={status} color={color} size={30} delay={delayFor(i)} /> : null}
              <StepPop done={done} delay={delayFor(i)}>
              <View
                style={[
                  {
                    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                    backgroundColor: done ? color : "transparent", borderWidth: 2, borderColor: color,
                    borderStyle: isNext ? "dashed" : "solid",
                  },
                  isNow ? { transform: [{ scale: 1.08 }] } : null,
                  Platform.OS === "web" ? ({ transitionProperty: "background-color, transform", transitionDuration: "220ms" } as any) : null,
                ]}
              >
                {done ? <Feather name="check" size={16} color="#fff" /> : <Text style={{ color: isNext ? theme.primary : theme.textTertiary, fontWeight: "800", fontSize: 12.5 }}>{L(String(i + 1), bnDigits(i + 1))}</Text>}
              </View>
              </StepPop>
              </View>
              {!last ? (
                <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: theme.cardBorder, marginVertical: 2, borderRadius: 1, overflow: "hidden" }}>
                  <StepFill testID={`step-line-${s}`} filled={i < reached} color={doneColor} delay={delayFor(i + 1)} />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : 14, paddingTop: 4 }}>
              <View style={[st.row, { gap: 8 }]}>
                <Text style={{ color: done || isNext ? theme.text : theme.textTertiary, fontWeight: isNow ? "800" : "700", fontSize: 14.5 }}>{t.title}</Text>
                {isNow ? <FadeSlideIn runKey={status} delay={delayFor(i) + 200}><Pill label={L("Now", "এখন")} color={STATUS_COLOR[status] || theme.primary} /></FadeSlideIn> : null}
                {isNext ? <Pill label={L("Next", "পরের ধাপ")} color="#7A8CA3" /> : null}
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 2 }}>
                {skipped ? L("Skipped by the seller", "বিক্রেতা এই ধাপ বাদ দিয়েছেন") : at ? fmtDate(at) : t.hint}
              </Text>
            </View>
          </View>
        );
      })}
      {cancelled ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#DA2F2F12" }}>
          <Feather name="x-circle" size={18} color="#DA2F2F" />
          <Text style={{ color: theme.error, fontWeight: "700", flex: 1 }}>
            {L("This order was cancelled", "এই অর্ডার বাতিল হয়েছে")}{when("cancelled") ? ` · ${fmtDate(when("cancelled"))}` : ""}
          </Text>
        </View>
      ) : status === "delivered" ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: theme.primary + "14" }}>
          <Feather name="award" size={18} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: "700", flex: 1 }}>{L("Order complete. Nothing more to do.", "অর্ডার সম্পন্ন। আর কিছু করার নেই।")}</Text>
        </View>
      ) : null}
      {err ? <View style={{ marginTop: 10 }}><ErrorBox text={err} /></View> : null}
      {next ? (
        <View style={{ marginTop: 14, gap: 10 }}>
          <Btn testID={`next-step-${next}`} label={actionText(next, L, pickup).label} icon={actionText(next, L, pickup).icon} busy={busy === next} disabled={!!busy} onPress={() => go(next)} />
          <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: "center" }}>
            {L("Done steps stay ticked. Only the next step can be pressed.", "সম্পন্ন ধাপ টিক থাকবে। শুধু পরের ধাপটি চাপা যাবে।")}
          </Text>
          {noteOpen ? (
            <Field testID="order-note" label={L("Note saved with this step (optional)", "এই ধাপের সাথে নোট (ঐচ্ছিক)")} value={note} onChange={setNote} maxLength={300} placeholder={L("e.g. Called the buyer, sent with Pathao", "যেমন: ক্রেতাকে কল করা হয়েছে")} />
          ) : (
            <Pressable testID="order-add-note" onPress={() => setNoteOpen(true)} style={{ alignSelf: "center", flexDirection: "row", gap: 6, alignItems: "center", padding: 4 }}>
              <Feather name="edit-3" size={14} color={theme.primary} />
              <Text style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>{L("Add a note", "নোট যোগ করুন")}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {canCancel ? (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder, paddingTop: 12 }}>
          <Btn testID="cancel-order" small kind="dangerSoft" icon="x" label={L("Cancel order", "অর্ডার বাতিল করুন")} busy={busy === "cancelled"} disabled={!!busy} onPress={() => go("cancelled")} />
        </View>
      ) : null}
    </Card>
  );
}

const methodLabel = (m: string, L: L) =>
  m === "express" ? L("Express, next day", "এক্সপ্রেস, পরের দিন") : m === "pickup" ? L("Buyer picks up from the seller", "ক্রেতা বিক্রেতার কাছ থেকে নেবেন") : L("Home delivery", "হোম ডেলিভারি");
const methodIcon = (m: string): keyof typeof Feather.glyphMap => (m === "express" ? "zap" : m === "pickup" ? "map-pin" : "truck");
export const payLabel = (p: string, L: L) =>
  (({ cod: L("Cash on delivery", "ক্যাশ অন ডেলিভারি"), bkash: "bKash", nagad: "Nagad", rocket: "Rocket", card: L("Card", "কার্ড") } as Record<string, string>)[String(p || "").toLowerCase()] || p || "—");

/** Where and how the order goes: method, area, receiver, address, time. */
export function DeliveryInfo({ order }: { order: any }) {
  const { theme } = useTheme();
  const L = useL();
  const c = order.checkout;
  const a = order.address || {};
  if (!c) {
    return (
      <Card>
        <KV icon="user" k={L("Receiver", "প্রাপক")} v={a.name || order.buyerName} />
        <KV icon="phone" k={L("Phone", "ফোন")} v={a.phone || order.buyerPhone} />
        <KV icon="home" k={L("Address", "ঠিকানা")} v={[a.address || a.street, a.area, a.district || a.city].filter(Boolean).join(", ")} />
      </Card>
    );
  }
  const m = c.deliveryMethod || "home";
  return (
    <Card testID="order-delivery">
      <View style={[st.row, { gap: 12, marginBottom: 6 }]}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.primary + "16", alignItems: "center", justifyContent: "center" }}>
          <Feather name={methodIcon(m)} size={19} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: "800", fontSize: 15 }}>{methodLabel(m, L)}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>
            {m === "pickup" ? L("No delivery charge", "কোনো ডেলিভারি চার্জ নেই") : c.zone === "inside_dhaka" ? L("Inside Dhaka", "ঢাকার ভেতরে") : L("Outside Dhaka", "ঢাকার বাইরে")}
            {` · ${taka(c.deliveryFee)}`}
          </Text>
        </View>
      </View>
      <KV icon="user" k={L("Receiver", "প্রাপক")} v={c.contactName || order.buyerName} />
      <KV icon="phone" k={L("Phone", "ফোন")} v={[c.contactPhone, c.altPhone].filter(Boolean).join(" / ")} />
      {m !== "pickup" ? <KV icon="home" k={L("Address", "ঠিকানা")} v={[c.address, c.upazila, c.district, c.division].filter(Boolean).join(", ")} /> : null}
      {c.deliveryDate || c.timeSlot ? <KV icon="calendar" k={L("Preferred time", "পছন্দের সময়")} v={[c.deliveryDate, c.timeSlot].filter(Boolean).join(" · ")} /> : null}
      {c.notes ? <KV icon="message-square" k={L("Buyer's note", "ক্রেতার নোট")} v={c.notes} /> : null}
    </Card>
  );
}

/** Money: items, delivery, discount, total, how they pay. */
export function PaymentInfo({ order }: { order: any }) {
  const { theme } = useTheme();
  const L = useL();
  const c = order.checkout || {};
  const row = (k: string, v: string, strong?: boolean, color?: string) => (
    <View style={[st.row, { justifyContent: "space-between", paddingVertical: 5 }]}>
      <Text style={{ color: strong ? theme.text : theme.textSecondary, fontWeight: strong ? "800" : "500", fontSize: strong ? 16 : 13.5 }}>{k}</Text>
      <Text style={{ color: color || theme.text, fontWeight: strong ? "800" : "600", fontSize: strong ? 16 : 13.5 }}>{v}</Text>
    </View>
  );
  return (
    <Card testID="order-payment">
      {c.subtotal !== undefined ? row(L("Items", "পণ্য"), taka(c.subtotal)) : null}
      {c.deliveryFee !== undefined ? row(L("Delivery", "ডেলিভারি"), c.deliveryFee ? taka(c.deliveryFee) : L("Free", "ফ্রি")) : null}
      {c.discount ? row(`${L("Discount", "ছাড়")}${c.coupon ? ` (${c.coupon})` : ""}`, `−${taka(c.discount)}`, false, "#00875A") : null}
      <View style={{ height: 1, backgroundColor: theme.cardBorder, marginVertical: 6 }} />
      {row(L("Total", "মোট"), taka(order.total), true)}
      {row(L("Payment", "পেমেন্ট"), payLabel(order.paymentMethod, L))}
    </Card>
  );
}

/* ======================= DELIVERY CHARGES (settings) ======================= */

type Cfg = { insideDhaka: number; outsideDhaka: number; express: number; freeOver: number; expressEnabled: boolean };

export function DeliverySettings() {
  const { theme } = useTheme();
  const L = useL();
  const cfg = useLoader<Cfg>(() => apiGet("/api/admin/manage/delivery"), []);
  const [f, setF] = useState<Record<string, string>>({});
  const [expressOn, setExpressOn] = useState(true);
  const [freeOn, setFreeOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const reset = (d: Cfg) => {
    setF({ insideDhaka: String(d.insideDhaka), outsideDhaka: String(d.outsideDhaka), express: String(d.express), freeOver: String(d.freeOver || 2000) });
    setExpressOn(d.expressEnabled !== false);
    setFreeOn((d.freeOver || 0) > 0);
  };
  useEffect(() => { if (cfg.data) reset(cfg.data); }, [cfg.data]);
  if (cfg.loading && !cfg.data) return <Page><Loading /></Page>;
  if (!cfg.data) return <Page><ErrorBox text={cfg.error || L("Couldn't load delivery charges", "ডেলিভারি চার্জ লোড হয়নি")} onRetry={cfg.load} /></Page>;
  const d = cfg.data;
  const num = (k: string) => Number(f[k]);
  const bad = (k: string) => !/^\d{1,6}$/.test(String(f[k] ?? "").trim()) || num(k) > 100000;
  const errors: string[] = [];
  if (bad("insideDhaka")) errors.push(L("Inside Dhaka: write a whole number of taka", "ঢাকার ভেতরে: টাকার পূর্ণ সংখ্যা লিখুন"));
  if (bad("outsideDhaka")) errors.push(L("Outside Dhaka: write a whole number of taka", "ঢাকার বাইরে: টাকার পূর্ণ সংখ্যা লিখুন"));
  if (expressOn && bad("express")) errors.push(L("Express: write a whole number of taka", "এক্সপ্রেস: টাকার পূর্ণ সংখ্যা লিখুন"));
  if (freeOn && (bad("freeOver") || num("freeOver") < 1)) errors.push(L("Free delivery: write the order amount", "ফ্রি ডেলিভারি: অর্ডারের পরিমাণ লিখুন"));
  const out: Cfg = {
    insideDhaka: num("insideDhaka") || 0, outsideDhaka: num("outsideDhaka") || 0,
    express: expressOn ? num("express") || 0 : d.express, expressEnabled: expressOn, freeOver: freeOn ? num("freeOver") || 0 : 0,
  };
  const changed = JSON.stringify(out) !== JSON.stringify({ insideDhaka: d.insideDhaka, outsideDhaka: d.outsideDhaka, express: d.express, expressEnabled: d.expressEnabled !== false, freeOver: d.freeOver || 0 });
  const fee = (inDhaka: boolean, sub: number) => (out.freeOver > 0 && sub >= out.freeOver ? 0 : inDhaka ? out.insideDhaka : out.outsideDhaka);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await apiPut("/api/admin/manage/delivery", out);
      setMsg({ ok: true, text: L("Saved. Checkout uses the new charges now.", "সংরক্ষিত। চেকআউটে এখন নতুন চার্জ ব্যবহার হচ্ছে।") });
      await cfg.load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || L("Couldn't save", "সংরক্ষণ হয়নি") });
    } finally {
      setBusy(false);
    }
  };
  const small = 500, big = out.freeOver > 0 ? out.freeOver : 2500;
  return (
    <Page onRefresh={cfg.load} testID="delivery-settings">
      <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
        {L("These charges apply to every order in the marketplace. Buyers see them at checkout. Products don't have their own delivery settings.", "এই চার্জ মার্কেটপ্লেসের সব অর্ডারে প্রযোজ্য। ক্রেতারা চেকআউটে দেখেন। পণ্যের আলাদা ডেলিভারি সেটিং নেই।")}
      </Text>
      <SectionTitle title={L("1. Home delivery", "১. হোম ডেলিভারি")} />
      <Card>
        <Field testID="delivery-insideDhaka" label={L("Inside Dhaka", "ঢাকার ভেতরে")} prefix="৳" keyboardType="number-pad" value={f.insideDhaka || ""} onChange={(v) => setF({ ...f, insideDhaka: v.replace(/[^\d]/g, "") })} />
        <Field testID="delivery-outsideDhaka" label={L("Outside Dhaka", "ঢাকার বাইরে")} prefix="৳" keyboardType="number-pad" value={f.outsideDhaka || ""} onChange={(v) => setF({ ...f, outsideDhaka: v.replace(/[^\d]/g, "") })} />
      </Card>
      <SectionTitle title={L("2. Free delivery", "২. ফ্রি ডেলিভারি")} />
      <Card>
        <ToggleRow testID="delivery-free" icon="gift" label={L("Free home delivery for big orders", "বড় অর্ডারে ফ্রি হোম ডেলিভারি")} sub={freeOn ? L(`From ${taka(out.freeOver)} and up`, `${taka(out.freeOver)} বা তার বেশি হলে`) : L("Off: every order pays delivery", "বন্ধ: সব অর্ডারে ডেলিভারি চার্জ")} value={freeOn} onChange={setFreeOn} />
        {freeOn ? <Field testID="delivery-freeOver" label={L("Free when the items cost at least", "পণ্যের দাম কমপক্ষে এত হলে ফ্রি")} prefix="৳" keyboardType="number-pad" value={f.freeOver || ""} onChange={(v) => setF({ ...f, freeOver: v.replace(/[^\d]/g, "") })} /> : null}
      </Card>
      <SectionTitle title={L("3. Express delivery", "৩. এক্সপ্রেস ডেলিভারি")} />
      <Card>
        <ToggleRow testID="delivery-express-on" icon="zap" label={L("Offer next-day express", "পরের দিন এক্সপ্রেস চালু")} sub={L("Inside Dhaka only. Never free.", "শুধু ঢাকার ভেতরে। কখনো ফ্রি নয়।")} value={expressOn} onChange={setExpressOn} />
        {expressOn ? <Field testID="delivery-express" label={L("Express charge", "এক্সপ্রেস চার্জ")} prefix="৳" keyboardType="number-pad" value={f.express || ""} onChange={(v) => setF({ ...f, express: v.replace(/[^\d]/g, "") })} /> : null}
      </Card>
      <SectionTitle title={L("4. Pickup", "৪. পিকআপ")} />
      <Card>
        <View style={[st.row, { gap: 10 }]}>
          <Feather name="map-pin" size={18} color={theme.primary} />
          <Text style={{ color: theme.textSecondary, flex: 1, fontSize: 13 }}>{L("Buyers can always pick up from the seller for free. Nothing to set.", "ক্রেতারা সবসময় বিক্রেতার কাছ থেকে ফ্রিতে নিতে পারেন। কিছু সেট করতে হবে না।")}</Text>
        </View>
      </Card>
      <SectionTitle title={L("What buyers will pay", "ক্রেতারা কত দেবেন")} />
      <Card testID="delivery-preview">
        {[
          [L(`${taka(small)} order, inside Dhaka`, `${taka(small)} অর্ডার, ঢাকার ভেতরে`), fee(true, small)],
          [L(`${taka(small)} order, outside Dhaka`, `${taka(small)} অর্ডার, ঢাকার বাইরে`), fee(false, small)],
          [L(`${taka(big)} order, outside Dhaka`, `${taka(big)} অর্ডার, ঢাকার বাইরে`), fee(false, big)],
          ...(expressOn ? [[L("Express, inside Dhaka", "এক্সপ্রেস, ঢাকার ভেতরে"), out.express] as [string, number]] : []),
        ].map(([k, v], i) => (
          <View key={i} style={[st.row, { justifyContent: "space-between", paddingVertical: 5 }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13.5, flex: 1 }}>{k as string}</Text>
            <Text style={{ color: Number(v) === 0 ? "#00875A" : theme.text, fontWeight: "700" }}>{Number(v) === 0 ? L("Free", "ফ্রি") : taka(Number(v))}</Text>
          </View>
        ))}
      </Card>
      {errors.length ? <View style={{ gap: 4 }}>{errors.map((e) => <Text key={e} style={{ color: theme.error, fontSize: 12.5 }}>• {e}</Text>)}</View> : null}
      {msg ? <Text style={{ color: msg.ok ? "#00875A" : "#DA2F2F", fontWeight: "600" }}>{msg.text}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {changed ? <Btn kind="ghost" label={L("Undo changes", "পরিবর্তন বাদ দিন")} onPress={() => reset(d)} /> : null}
        <Btn testID="delivery-save" style={{ flex: 1 }} icon="save" label={changed ? L("Save charges", "চার্জ সংরক্ষণ") : L("No changes", "কোনো পরিবর্তন নেই")} disabled={!changed || errors.length > 0} busy={busy} onPress={save} />
      </View>
    </Page>
  );
}
