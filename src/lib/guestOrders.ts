import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getApiUrl } from "@/lib/query-client";

/**
 * Orders placed without an account (guest checkout).
 * Each order gets a random key made on this phone; the server keeps only a hash of it.
 * The order id + key opens the order (this phone remembers them, and the order link carries them).
 */
const KEY = "farmers.guestOrders.v1";

export interface SavedGuestOrder {
  id: string;
  key: string;
  total: number;
  createdAt: string;
  contactName?: string;
}

export function makeGuestKey(): string {
  try {
    return (Crypto.randomUUID() + Crypto.randomUUID()).replace(/-/g, "");
  } catch {
    const bytes = Crypto.getRandomBytes(32);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

export async function listGuestOrders(): Promise<SavedGuestOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((o) => o && o.id && o.key) : [];
  } catch {
    return [];
  }
}

export async function saveGuestOrder(o: SavedGuestOrder) {
  const list = (await listGuestOrders()).filter((x) => x.id !== o.id);
  list.unshift(o);
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
}

export async function findGuestKey(id: string): Promise<string | null> {
  return (await listGuestOrders()).find((o) => o.id === id)?.key || null;
}

/** Public link that opens a product, shop or guest order (web version; the app opens it too). */
export function publicLink(path: string) {
  const base = getApiUrl().replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
}

export const guestOrderLink = (id: string, key: string) => publicLink(`/order/${encodeURIComponent(id)}?k=${encodeURIComponent(key)}`);

async function call(method: string, path: string, key: string) {
  const r = await fetch(new URL(path, getApiUrl()).toString(), { method, headers: { "X-Guest-Key": key } });
  let data: any = null;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
  return data;
}

export const fetchGuestOrder = (id: string, key: string) => call("GET", `/api/guest-orders/${encodeURIComponent(id)}`, key);
export const cancelGuestOrder = (id: string, key: string) => call("POST", `/api/guest-orders/${encodeURIComponent(id)}/cancel`, key);
