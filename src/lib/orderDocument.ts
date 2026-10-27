import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, isLoggedIn } from "@/lib/api";
import { fetchGuestOrder } from "@/lib/guestOrders";
import { useOrdersStore } from "@/lib/ordersStore";
import { orderLineText } from "@shared/selling";

/**
 * Printable order ("order details" PDF) for buyers, after an order is placed.
 *
 * The order always comes from where the buyer is already allowed to read it:
 *  - signed in: GET /api/orders/:id (server checks buyer / seller / admin), else the copy on this phone;
 *  - guest: GET /api/guest-orders/:id with the order's private key (only this phone or the order link has it).
 * The document never carries the guest key or the order link, so sharing the PDF doesn't give access.
 *
 * Print: native print dialog (Android / iOS), or the browser's print window on the web.
 * Save PDF: a real PDF file on the phone (Android: saved to a folder you pick, once; iOS: share sheet / Files).
 * On the web the browser's print window has "Save as PDF" as a destination.
 */

export interface OrderDoc {
  id: string;
  status: string;
  createdAt?: string | null;
  total: number;
  items: { name: string; price: number; quantity: number; lineTotal?: number; unit?: string; sellAs?: string; packSize?: number; packUnit?: string; options?: Record<string, string> }[];
  paymentMethod: string;
  payment?: { status?: string; trxId?: string; note?: string } | null;
  checkout?: any;
  shippingAddress?: { fullName?: string; address?: string; city?: string; phone?: string } | null;
  guest?: boolean;
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function normalize(o: any, guest: boolean): OrderDoc {
  return {
    id: String(o.id),
    status: String(o.status || "pending"),
    createdAt: o.createdAt || null,
    total: num(o.total),
    items: (o.items || []).map((i: any) => ({
      name: String(i?.name || ""),
      price: num(i?.price),
      quantity: num(i?.quantity) || 1,
      ...(i?.lineTotal != null && Number.isFinite(Number(i.lineTotal)) ? { lineTotal: Number(i.lineTotal) } : {}),
      ...(i?.unit ? { unit: String(i.unit), sellAs: i.sellAs, packSize: i.packSize, packUnit: i.packUnit } : {}),
      ...(i?.options && typeof i.options === "object" ? { options: i.options } : {}),
    })),
    paymentMethod: String(o.paymentMethod || o.payment?.method || "cod"),
    payment: o.payment || null,
    checkout: o.checkout || null,
    shippingAddress: o.shippingAddress || null,
    guest,
  };
}

/** Load the order for printing. Throws a readable error when it can't be opened. */
export async function loadOrderDoc(id: string, guestKey?: string | null): Promise<OrderDoc> {
  if (guestKey) return normalize(await fetchGuestOrder(id, guestKey), true);
  if (isLoggedIn()) {
    try {
      return normalize(await apiGet(`/api/orders/${encodeURIComponent(id)}`), false);
    } catch (e) {
      // offline (or an order kept only on this phone): fall back to the phone's copy below
      const local = useOrdersStore.getState().getOrderById(id);
      if (!local) throw e;
    }
  }
  const local: any = useOrdersStore.getState().getOrderById(id);
  if (!local) throw new Error("Order not found");
  return normalize({ ...local, paymentMethod: local.paymentMethod }, false);
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] as string);
const money = (n: number) => `৳${(Math.round(num(n) * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STATUS: Record<string, [string, string]> = {
  pending: ["Order placed", "অর্ডার করা হয়েছে"],
  confirmed: ["Confirmed", "নিশ্চিত"],
  processing: ["Processing", "প্রস্তুত হচ্ছে"],
  shipped: ["Shipped", "পাঠানো হয়েছে"],
  delivered: ["Delivered", "ডেলিভারি হয়েছে"],
  cancelled: ["Cancelled", "বাতিল"],
};
const SLOT: Record<string, [string, string]> = {
  morning: ["Morning (9am–12pm)", "সকাল (৯টা–১২টা)"],
  afternoon: ["Afternoon (12–4pm)", "দুপুর (১২টা–৪টা)"],
  evening: ["Evening (4–8pm)", "বিকেল (৪টা–৮টা)"],
};
const METHOD: Record<string, [string, string]> = {
  home: ["Home delivery", "হোম ডেলিভারি"],
  express: ["Express delivery", "এক্সপ্রেস ডেলিভারি"],
  pickup: ["Pick up from seller", "বিক্রেতার কাছ থেকে সংগ্রহ"],
};

/** Payment line that never says "paid" unless the shop confirmed the payment. */
export function paymentText(o: OrderDoc, bn: boolean): { method: string; status: string; tone: "ok" | "wait" | "bad" } {
  const L = (en: string, b: string) => (bn ? b : en);
  const p = o.payment || {};
  if (o.paymentMethod === "rocket") {
    const trx = p.trxId ? ` · TrxID ${p.trxId}` : "";
    if (p.status === "verified") return { method: `Rocket${trx}`, status: L("Paid · payment confirmed by the shop", "পরিশোধিত · দোকান পেমেন্ট নিশ্চিত করেছে"), tone: "ok" };
    if (p.status === "rejected") return { method: `Rocket${trx}`, status: L("Payment not confirmed", "পেমেন্ট নিশ্চিত হয়নি"), tone: "bad" };
    return { method: `Rocket${trx}`, status: L("Payment waiting for check", "পেমেন্ট যাচাইয়ের অপেক্ষায়"), tone: "wait" };
  }
  if (o.paymentMethod === "bkash") return { method: "bKash", status: L("Payment status not confirmed here", "পেমেন্টের অবস্থা এখানে নিশ্চিত নয়"), tone: "wait" };
  if (o.paymentMethod === "card") return { method: L("Card", "কার্ড"), status: L("Payment status not confirmed here", "পেমেন্টের অবস্থা এখানে নিশ্চিত নয়"), tone: "wait" };
  // cash on delivery
  if (o.status === "cancelled") return { method: L("Cash on delivery", "ক্যাশ অন ডেলিভারি"), status: L("Order cancelled · nothing to pay", "অর্ডার বাতিল · কিছু দিতে হবে না"), tone: "bad" };
  if (o.status === "delivered") return { method: L("Cash on delivery", "ক্যাশ অন ডেলিভারি"), status: L("Delivered · cash on delivery", "ডেলিভারি হয়েছে · ক্যাশ অন ডেলিভারি"), tone: "ok" };
  return { method: L("Cash on delivery", "ক্যাশ অন ডেলিভারি"), status: L(`Not paid yet · pay ${money(o.total)} when you receive it`, `এখনো পরিশোধ হয়নি · পণ্য পেলে ${money(o.total)} দিন`), tone: "wait" };
}

export const orderFileName = (id: string) => `Farmers-order-${String(id).replace(/[^A-Za-z0-9_-]+/g, "-")}`;

/** The printable page: Maya-style (navy ink, sky blue, hairline cards), English or Bangla. */
export function orderDocHtml(o: OrderDoc, bn: boolean): string {
  const L = (en: string, b: string) => (bn ? b : en);
  const c = o.checkout || {};
  const ship = o.shippingAddress || {};
  const locale = bn ? "bn-BD" : "en-GB";
  const when = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  };
  const st = STATUS[o.status] || [o.status, o.status];
  const pay = paymentText(o, bn);
  const name = c.contactName || ship.fullName || "";
  const phone = [c.contactPhone || ship.phone, c.altPhone].filter(Boolean).join(" / ");
  const method = c.deliveryMethod ? METHOD[c.deliveryMethod] : null;
  const zone = c.zone === "inside_dhaka" ? L("Inside Dhaka", "ঢাকার ভিতরে") : c.zone === "outside_dhaka" ? L("Outside Dhaka", "ঢাকার বাইরে") : "";
  const address =
    c.deliveryMethod === "pickup"
      ? ""
      : [c.address || ship.address, c.upazila && !(c.address || "").includes(c.upazila) ? c.upazila : "", c.district, c.division].filter(Boolean).join(", ") ||
        [ship.address, ship.city].filter(Boolean).join(", ");
  const deliveryDay = c.deliveryDate
    ? (() => {
        const d = new Date(`${c.deliveryDate}T00:00:00`);
        return isNaN(d.getTime()) ? String(c.deliveryDate) : d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      })()
    : "";
  const slot = c.timeSlot && SLOT[c.timeSlot] ? SLOT[c.timeSlot][bn ? 1 : 0] : "";

  const rows = o.items
    .map((it, i) => {
      const line = it.lineTotal ?? it.price * it.quantity;
      const opts = it.options ? Object.entries(it.options).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ") : "";
      return `<tr><td class="n">${i + 1}</td><td><div class="item">${esc(it.name)}</div>${opts ? `<div class="muted small">${opts}</div>` : ""}</td>
<td>${esc(orderLineText(it as any, bn))}</td><td class="r">${money(it.price)}</td><td class="r b">${money(line)}</td></tr>`;
    })
    .join("");

  const sums: [string, string][] = [];
  if (typeof c.subtotal === "number") sums.push([L("Subtotal", "সাবটোটাল"), money(c.subtotal)]);
  if (typeof c.deliveryFee === "number") sums.push([L("Delivery fee", "ডেলিভারি ফি"), c.deliveryFee ? money(c.deliveryFee) : L("Free", "ফ্রি")]);
  const coupon = (typeof c.coupon === "string" ? c.coupon : c.coupon?.code) || c.couponCode || "";
  if (c.discount) sums.push([`${L("Discount", "ছাড়")}${coupon ? ` (${esc(coupon)})` : ""}`, `−${money(c.discount)}`]);

  const kv = (k: string, v: string) => (v ? `<div class="kv"><span class="muted">${k}</span><span>${v}</span></div>` : "");
  const title = orderFileName(o.id);

  return `<!doctype html><html lang="${bn ? "bn" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Hind+Siliguri:wght@400;500;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:14mm 12mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:'DM Sans','Hind Siliguri','Noto Sans Bengali','Noto Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#202936;font-size:12.5px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
:lang(bn) body, body:lang(bn){font-family:'Hind Siliguri','Noto Sans Bengali','DM Sans',system-ui,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:4px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:2px solid #202936}
.brand{font-size:22px;font-weight:700;letter-spacing:.2px}.brand span{color:#37B1FF}
.doc{font-size:13px;color:#545454;margin-top:2px}
.id{text-align:right}.id .no{font-size:15px;font-weight:700;word-break:break-all}
.badge{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;background:#E3F4FF;color:#202936}
.badge.cancelled{background:#FDECEC;color:#DA2F2F}.badge.delivered{background:#D8FFF2;color:#007A4E}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.card{border:1px solid #E6E6E6;border-radius:12px;padding:12px 14px;break-inside:avoid}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#2E96EF;margin:0 0 6px;font-weight:700}
:lang(bn) h2{text-transform:none;letter-spacing:0;font-size:13px}
.kv{display:flex;justify-content:space-between;gap:12px;padding:2px 0}.kv span:last-child{text-align:right}
.muted{color:#545454}.small{font-size:11px}.b{font-weight:700}.r{text-align:right;white-space:nowrap}.n{color:#8A8F98;width:22px}
table{width:100%;border-collapse:collapse;margin-top:2px}
th{font-size:11px;text-align:left;color:#545454;font-weight:500;border-bottom:1px solid #E6E6E6;padding:6px 6px}
th.r{text-align:right}
td{padding:8px 6px;border-bottom:1px solid #F0F0F0;vertical-align:top}
tr{break-inside:avoid}
.item{font-weight:500}
.sums{margin-left:auto;width:min(100%,300px);margin-top:8px}
.total{display:flex;justify-content:space-between;margin-top:6px;padding:9px 12px;border-radius:10px;background:#202936;color:#fff;font-size:15px;font-weight:700}
.pay .st{margin-top:4px;font-weight:700}.pay .ok{color:#007A4E}.pay .wait{color:#B25E09}.pay .bad{color:#DA2F2F}
.foot{margin-top:16px;padding-top:10px;border-top:1px solid #E6E6E6;color:#8A8F98;font-size:10.5px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media (max-width:520px){.grid{grid-template-columns:1fr}.top{flex-direction:column}.id{text-align:left}}
</style></head>
<body><div class="wrap">
<div class="top"><div><div class="brand">Farmers<span>.</span></div><div class="doc">${L("Order details", "অর্ডারের বিবরণ")}</div></div>
<div class="id"><div class="muted small">${L("Order number", "অর্ডার নম্বর")}</div><div class="no">${esc(o.id)}</div>
${o.createdAt ? `<div class="muted small">${L("Placed", "অর্ডারের সময়")}: ${esc(when(o.createdAt))}</div>` : ""}
<div class="badge ${esc(o.status)}">${esc(st[bn ? 1 : 0])}</div></div></div>

<div class="grid">
<div class="card"><h2>${L("Customer", "ক্রেতা")}</h2>
${name ? `<div class="b">${esc(name)}${o.guest ? ` <span class="muted small">(${L("no account", "অ্যাকাউন্ট ছাড়া")})</span>` : ""}</div>` : ""}
${phone ? `<div>${esc(phone)}</div>` : ""}
${address ? `<div class="muted">${esc(address)}</div>` : ""}</div>
<div class="card"><h2>${L("Delivery", "ডেলিভারি")}</h2>
${kv(L("Method", "পদ্ধতি"), method ? esc(method[bn ? 1 : 0]) + (zone ? ` · ${esc(zone)}` : "") : "")}
${kv(L("Date", "তারিখ"), esc(deliveryDay))}
${kv(L("Time", "সময়"), esc(slot))}
${c.notes ? `<div class="muted small" style="margin-top:4px">${L("Note", "নোট")}: ${esc(c.notes)}</div>` : ""}
${!method && !deliveryDay && !c.notes ? `<div class="muted">—</div>` : ""}</div>
</div>

<div class="card" style="margin-top:12px"><h2>${L("Items", "পণ্য")}</h2>
<table><thead><tr><th>#</th><th>${L("Item", "পণ্য")}</th><th>${L("Quantity", "পরিমাণ")}</th><th class="r">${L("Price", "দাম")}</th><th class="r">${L("Amount", "মোট")}</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="sums">${sums.map(([k, v]) => `<div class="kv"><span class="muted">${k}</span><span>${v}</span></div>`).join("")}
<div class="total"><span>${L("Total", "সর্বমোট")}</span><span>${money(o.total)}</span></div></div></div>

<div class="card pay" style="margin-top:12px"><h2>${L("Payment", "পেমেন্ট")}</h2>
<div>${esc(pay.method)}</div><div class="st ${pay.tone}">${esc(pay.status)}</div>
${o.payment?.note ? `<div class="muted small">${esc(o.payment.note)}</div>` : ""}</div>

<div class="foot"><span>${L("Prices in Bangladeshi taka (৳). Keep this for your records.", "দাম বাংলাদেশি টাকায় (৳)। আপনার রেকর্ডের জন্য রেখে দিন।")}</span>
<span>${L("Printed", "প্রিন্টের সময়")}: ${esc(when(new Date().toISOString()))}</span></div>
</div></body></html>`;
}

// ---------- web: print the document itself (expo-print on the web only prints the app page) ----------

function webPrint(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc: any = (globalThis as any).document;
      const frame = doc.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.setAttribute("data-testid", "order-print-frame");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
      const oldTitle = doc.title;
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        doc.title = oldTitle;
        setTimeout(() => frame.remove(), 1000);
      };
      frame.onload = async () => {
        try {
          const w = frame.contentWindow;
          const fonts = w?.document?.fonts;
          // wait for DM Sans / Hind Siliguri, but never more than 2.5 s (offline still prints with system fonts)
          if (fonts?.ready) await Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
          // browsers name the saved PDF after the page title
          doc.title = title;
          w.addEventListener?.("afterprint", cleanup);
          w.focus();
          w.print(); // Chrome / Edge wait here until the print window closes
          resolve();
          setTimeout(() => (doc.title = oldTitle), 1500);
          setTimeout(cleanup, 60000);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };
      frame.srcdoc = html;
      doc.body.appendChild(frame);
    } catch (e) {
      reject(e);
    }
  });
}

// ---------- native ----------

const SAF_DIR_KEY = "farmers.orderPdf.safDir";

async function nativePdfFile(html: string, name: string): Promise<string> {
  const Print = await import("expo-print");
  const FS = await import("expo-file-system/legacy");
  const { uri } = await Print.printToFileAsync({ html });
  const dest = `${FS.cacheDirectory}${name}.pdf`;
  await FS.deleteAsync(dest, { idempotent: true }).catch(() => {});
  await FS.moveAsync({ from: uri, to: dest });
  return dest;
}

async function shareFile(uri: string, bn: boolean) {
  const Sharing = await import("expo-sharing");
  if (!(await Sharing.isAvailableAsync())) throw new Error(bn ? "এই ফোনে শেয়ার করা যাচ্ছে না" : "Sharing isn't available on this phone");
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: bn ? "অর্ডারের PDF" : "Order PDF" });
}

/** Android: write the PDF into a folder the buyer picked (asked once, remembered). Returns false if they cancelled. */
async function androidSave(fileUri: string, name: string, bn: boolean): Promise<boolean> {
  const FS = await import("expo-file-system/legacy");
  const SAF = FS.StorageAccessFramework;
  const data = await FS.readAsStringAsync(fileUri, { encoding: FS.EncodingType.Base64 });
  const write = async (dir: string) => {
    const target = await SAF.createFileAsync(dir, name, "application/pdf");
    await FS.writeAsStringAsync(target, data, { encoding: FS.EncodingType.Base64 });
  };
  const saved = await AsyncStorage.getItem(SAF_DIR_KEY);
  if (saved) {
    try {
      await write(saved);
      return true;
    } catch {
      await AsyncStorage.removeItem(SAF_DIR_KEY);
    }
  }
  const perm = await SAF.requestDirectoryPermissionsAsync(SAF.getUriForDirectoryInRoot("Download"));
  if (!perm.granted) return false;
  await write(perm.directoryUri);
  await AsyncStorage.setItem(SAF_DIR_KEY, perm.directoryUri);
  return true;
}

export type DocAction = "print" | "pdf";

/** Print the order, or save it as a PDF. Shows its own error message; returns true when the dialog / save happened. */
export async function runOrderDoc(action: DocAction, o: OrderDoc, bn: boolean): Promise<boolean> {
  const html = orderDocHtml(o, bn);
  const name = orderFileName(o.id);
  const L = (en: string, b: string) => (bn ? b : en);
  try {
    if (Platform.OS === "web") {
      // Both buttons open the browser's print window; "Save as PDF" is a destination there.
      await webPrint(html, name);
      return true;
    }
    if (action === "print") {
      const Print = await import("expo-print");
      await Print.printAsync({ html });
      return true;
    }
    const file = await nativePdfFile(html, name);
    if (Platform.OS === "android") {
      const ok = await androidSave(file, name, bn).catch(() => false);
      if (ok) {
        Alert.alert(L("PDF saved", "PDF সেভ হয়েছে"), L(`${name}.pdf is in the folder you chose.`, `${name}.pdf আপনার বেছে নেওয়া ফোল্ডারে আছে।`), [
          { text: L("Share", "শেয়ার"), onPress: () => void shareFile(file, bn).catch(() => {}) },
          { text: L("OK", "ঠিক আছে"), style: "cancel" },
        ]);
        return true;
      }
    }
    await shareFile(file, bn);
    return true;
  } catch (e: any) {
    const msg = String(e?.message || "");
    // closing the print / share window isn't an error
    if (/cancel|dismiss|did not complete/i.test(msg)) return false;
    Alert.alert(action === "print" ? L("Couldn't print", "প্রিন্ট করা যায়নি") : L("Couldn't make the PDF", "PDF তৈরি করা যায়নি"), msg);
    return false;
  }
}
