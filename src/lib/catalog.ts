import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";

/** Client for the server catalog (experts, events, market listings). */
export type CatalogKind = "experts" | "events" | "listings";

function headers(json = false): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parse(r: Response) {
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export async function fetchCatalog<T = any>(kind: CatalogKind): Promise<T[]> {
  const r = await fetch(`${getApiUrl()}/api/catalog/${kind}`, { headers: headers() });
  return parse(r);
}

export async function createCatalogItem<T = any>(kind: CatalogKind, data: Record<string, any>): Promise<T> {
  const r = await fetch(`${getApiUrl()}/api/catalog/${kind}`, { method: "POST", headers: headers(true), body: JSON.stringify(data) });
  return parse(r);
}

export async function updateCatalogItem<T = any>(kind: CatalogKind, id: string, data: Record<string, any>): Promise<T> {
  const r = await fetch(`${getApiUrl()}/api/catalog/${kind}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: headers(true),
    body: JSON.stringify(data),
  });
  return parse(r);
}

export async function deleteCatalogItem(kind: CatalogKind, id: string) {
  const r = await fetch(`${getApiUrl()}/api/catalog/${kind}/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() });
  return parse(r);
}

export async function registerForEvent(id: string) {
  const r = await fetch(`${getApiUrl()}/api/catalog/events/${encodeURIComponent(id)}/register`, { method: "POST", headers: headers() });
  return parse(r);
}

/** True when the current session is a real account (not a guest) that the server will accept. */
export function canWrite() {
  const s = useAuthStore.getState();
  return !!s.token && s.isAuthenticated;
}

export function myUserId(): string | null {
  return (useAuthStore.getState().user as any)?.id || null;
}
