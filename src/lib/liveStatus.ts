import { useEffect, useSyncExternalStore } from "react";
import { AppState, AppStateStatus } from "react-native";
import { create } from "zustand";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";

/*
 * Live data from the server for the signed-in person:
 *  - unread counts: notifications (badge on the bell) and messages (badge on the Messages tab)
 *  - who is online (green dot on avatars). The app tells the server it's open every 30s while
 *    in the foreground and says "away" when it goes to the background.
 * Nothing here is made up: no server answer means no badge and no dot.
 */

const token = () => useAuthStore.getState().getToken();
const authed = (t: string) => ({ Authorization: `Bearer ${t}` });

// ---------- unread counts ----------
interface UnreadState {
  notifications: number;
  messages: number;
  set: (p: Partial<Pick<UnreadState, "notifications" | "messages">>) => void;
}
export const useUnreadCounts = create<UnreadState>((set) => ({
  notifications: 0,
  messages: 0,
  set: (p) => set(p),
}));

let unreadInflight: Promise<void> | null = null;
let unreadAgain = false;
/**
 * Re-read both counts from the server. Called on a timer, and after anything is marked read.
 * A call made while a read is already in flight runs once more afterwards, because that
 * earlier read may have started before the server marked things read (it would bring back
 * the old number and the badge would stay until the next timer).
 */
export function refreshUnreadCounts(): Promise<void> {
  const t = token();
  if (!t) {
    useUnreadCounts.getState().set({ notifications: 0, messages: 0 });
    return Promise.resolve();
  }
  if (unreadInflight) {
    unreadAgain = true;
    return unreadInflight;
  }
  unreadInflight = (async () => {
    const base = getApiUrl();
    const [n, m] = await Promise.all([
      fetch(`${base}/api/me/notifications/unread-count`, { headers: authed(t) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${base}/api/dm/unread`, { headers: authed(t) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const patch: Partial<UnreadState> = {};
    if (n && typeof n.unread === "number") patch.notifications = n.unread;
    if (m && typeof m.total === "number") patch.messages = m.total;
    useUnreadCounts.getState().set(patch);
  })().finally(() => {
    unreadInflight = null;
    if (unreadAgain) {
      unreadAgain = false;
      refreshUnreadCounts();
    }
  });
  return unreadInflight;
}

/** "99+" past 99, so the badge never grows wider than three characters. */
export function badgeText(n: number): string {
  return n > 99 ? "99+" : String(n);
}

// ---------- presence ----------
const watched = new Map<string, number>(); // userId -> how many avatars show it
let online = new Set<string>();
const listeners = new Set<() => void>();
let queryTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

async function queryPresence() {
  queryTimer = null;
  const t = token();
  const ids = [...watched.keys()];
  if (!t || !ids.length) {
    if (online.size) {
      online = new Set();
      emit();
    }
    return;
  }
  try {
    const r = await fetch(`${getApiUrl()}/api/presence/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authed(t) },
      body: JSON.stringify({ ids: ids.slice(0, 300) }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    online = new Set(Array.isArray(j.online) ? j.online : []);
  } catch {
    // Server not reachable: show nobody online rather than an old guess.
    online = new Set();
  }
  emit();
}

function scheduleQuery(delay = 250) {
  if (queryTimer) return;
  queryTimer = setTimeout(queryPresence, delay);
}

function watch(userId: string) {
  const had = watched.has(userId);
  watched.set(userId, (watched.get(userId) ?? 0) + 1);
  if (!had) scheduleQuery();
  return () => {
    const n = (watched.get(userId) ?? 1) - 1;
    if (n <= 0) watched.delete(userId);
    else watched.set(userId, n);
  };
}

/** true only while the server says this person has the app open right now. */
export function useIsOnline(userId?: string | null): boolean {
  useEffect(() => (userId ? watch(userId) : undefined), [userId]);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => (userId ? online.has(userId) : false),
    () => false,
  );
}

function beat(state: "active" | "away") {
  const t = token();
  if (!t) return;
  fetch(`${getApiUrl()}/api/presence/beat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authed(t) },
    body: JSON.stringify({ state }),
  }).catch(() => {});
}

/** Mounted once by the main tabs while signed in. */
export function useLiveStatus() {
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (!userId) {
      useUnreadCounts.getState().set({ notifications: 0, messages: 0 });
      online = new Set();
      emit();
      return;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      beat("active");
      refreshUnreadCounts();
      scheduleQuery(0);
    };
    const start = () => {
      if (timer) return;
      tick();
      timer = setInterval(tick, 20_000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onState = (s: AppStateStatus) => {
      if (s === "active") start();
      else {
        stop();
        beat("away");
      }
    };
    if (AppState.currentState !== "background") start();
    const sub = AppState.addEventListener("change", onState);
    return () => {
      sub.remove();
      stop();
      beat("away");
    };
  }, [userId]);
}
