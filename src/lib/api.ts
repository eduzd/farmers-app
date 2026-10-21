import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";

/** Small JSON client for the pass-4 server features (notifications, favorites, reviews, follows, orders, community lists). */
function headers(json = false): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function api<T = any>(method: string, path: string, body?: any): Promise<T> {
  const r = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data as T;
}

export const apiGet = <T = any>(path: string) => api<T>("GET", path);
export const apiPost = <T = any>(path: string, body: any = {}) => api<T>("POST", path, body);
export const apiPut = <T = any>(path: string, body: any = {}) => api<T>("PUT", path, body);
export const apiDelete = <T = any>(path: string) => api<T>("DELETE", path);

/** True when there is a real logged-in account the server accepts. */
export function isLoggedIn() {
  const s = useAuthStore.getState();
  return !!s.token && s.isAuthenticated;
}

export function currentUserId(): string | null {
  return (useAuthStore.getState().user as any)?.id || null;
}

/** Absolute URL for a server path such as /uploads/x.jpg (leaves http(s)/data URLs alone). */
export function mediaUrl(u?: string | null) {
  if (!u) return "";
  if (/^(https?:|data:|file:|blob:)/.test(u)) return u;
  return `${getApiUrl()}${u.startsWith("/") ? "" : "/"}${u}`;
}

/** Upload an image given as a data URL (web) or base64 + mime (native). Returns the server URL path. */
export async function uploadImage(dataUrl: string): Promise<string> {
  const r = await apiPost<{ url: string }>("/api/uploads", { dataUrl });
  return r.url;
}

/** "5 min ago" style label from an ISO date, in the app language. */
export function timeAgo(isoDate: string | Date | null | undefined, lang: string = "bn") {
  if (!isoDate) return "";
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  const en = lang === "en";
  const bnDigits = (n: number) => String(n).replace(/\d/g, (x) => "০১২৩৪৫৬৭৮৯"[Number(x)]);
  const f = (n: number, enU: string, bnU: string) => (en ? `${n} ${enU}${n === 1 ? "" : "s"} ago` : `${bnDigits(n)} ${bnU} আগে`);
  if (s < 60) return en ? "just now" : "এইমাত্র";
  if (s < 3600) return f(Math.floor(s / 60), "min", "মিনিট");
  if (s < 86400) return f(Math.floor(s / 3600), "hour", "ঘণ্টা");
  if (s < 86400 * 30) return f(Math.floor(s / 86400), "day", "দিন");
  return d.toLocaleDateString(en ? "en-GB" : "bn-BD");
}
