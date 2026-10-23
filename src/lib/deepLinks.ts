import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { navigationRef } from "@/lib/navigationRef";

/**
 * Shared links that open without an account:
 *   /shop            all shops
 *   /shop/<slug>     one shop
 *   /product/<id>    one product
 *   /order/<id>?k=…  a guest's own order
 * Web reads them from the address bar; the app gets them as farmers://shop/<slug> etc.
 */
export type LinkTarget =
  | { name: "ShopPage"; params?: { slug?: string } }
  | { name: "ProductLink"; params: { productId: string } }
  | { name: "GuestOrder"; params: { orderId?: string; k?: string } };

export function parseLink(url: string | null | undefined): LinkTarget | null {
  if (!url) return null;
  let path = "";
  let query = "";
  try {
    const m = String(url).match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)([^?#]*)(\?[^#]*)?/i);
    if (m) {
      // farmers://shop/abc -> host "shop" + "/abc"; https://site/shop/abc -> "/shop/abc"
      const isWeb = /^https?:/i.test(url);
      path = isWeb ? m[2] : `/${m[1]}${m[2]}`;
      query = m[3] || "";
    } else {
      const [p, q] = String(url).split("?");
      path = p;
      query = q ? "?" + q : "";
    }
  } catch {
    return null;
  }
  const parts = path.split("/").filter(Boolean).map((x) => decodeURIComponent(x));
  const k = new URLSearchParams(query).get("k") || undefined;
  if (parts[0] === "shop" || parts[0] === "shops") return { name: "ShopPage", params: parts[1] ? { slug: parts[1] } : undefined };
  if (parts[0] === "product" && parts[1]) return { name: "ProductLink", params: { productId: parts[1] } };
  if (parts[0] === "order" || parts[0] === "orders") return { name: "GuestOrder", params: { orderId: parts[1], k } };
  return null;
}

let pending: LinkTarget | null = null;
let started = false;
const listeners = new Set<() => void>();

function setPending(t: LinkTarget | null) {
  if (!t) return;
  pending = t;
  listeners.forEach((l) => l());
}

/** Reads the link the app/page was opened with, and later links while it runs (once per app start). */
export function startLinkCapture() {
  if (started) return;
  started = true;
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location) setPending(parseLink(window.location.pathname + window.location.search));
    return;
  }
  Linking.getInitialURL().then((u) => setPending(parseLink(u))).catch(() => {});
  Linking.addEventListener("url", ({ url }) => setPending(parseLink(url)));
}

/** Opens a waiting shared link once the navigator is ready. Returns an unsubscribe function. */
export function consumeLinks(): () => void {
  let timer: any = null;
  const tryOpen = (tries = 0) => {
    if (!pending) return;
    if (!navigationRef.isReady()) {
      if (tries < 40) timer = setTimeout(() => tryOpen(tries + 1), 250);
      return;
    }
    const t = pending;
    pending = null;
    try {
      navigationRef.navigate(t.name as any, t.params as any);
    } catch {}
  };
  const l = () => tryOpen();
  listeners.add(l);
  tryOpen();
  return () => {
    listeners.delete(l);
    if (timer) clearTimeout(timer);
  };
}
