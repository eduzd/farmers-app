import { navigationRef } from "@/lib/navigationRef";

/**
 * Opening a notification at the place it came from (a comment on your post, an order update,
 * a message, a new follower...). Taps in the Notifications list and taps on a phone push both go
 * through the NotificationOpen screen, which asks the server where this notification leads
 * (GET /api/me/notifications/:id/target: the server checks the post / order / comment still
 * exists and that this account may open it), then replaces itself with that screen, or says
 * plainly that the thing was removed or isn't available to this account.
 *
 * Only screens on SCREENS can be opened from a notification, whatever the data says.
 */
export type NotifPayload = {
  id?: string; // server notification id (n-...), when there is one
  type?: string;
  data?: Record<string, any>;
  title?: string;
  body?: string;
  createdAt?: string;
};

export type NotifTarget = { screen: string; params?: Record<string, any> };

export const SCREENS = [
  "PostDetail", "OrderDetail", "Chat", "UserProfile", "SupportChat", "AdminApp", "SellerApp",
  "Rfq", "ExpertQA", "PriceAlert", "FarmDiary", "OfficialChat", "Notice",
] as const;

export const NOTICE_TYPES = ["official", "moderation", "admin", "system", "warning", "announcement", "notice", "safety"];

const ID = /^[A-Za-z0-9_.:@-]{1,128}$/;
export const cleanId = (v: any): string => {
  const s = String(v ?? "");
  return ID.test(s) ? s : "";
};

export function isAllowedTarget(t: any): t is NotifTarget {
  return !!t && typeof t.screen === "string" && (SCREENS as readonly string[]).includes(t.screen);
}

/**
 * Where a notification leads, worked out on the phone from its own data. Used for pushes without
 * a server notification (calls) and when the server can't be reached; the server's answer wins.
 */
export function localTarget(p: NotifPayload): NotifTarget | null {
  const type = String(p.type || p.data?.type || "");
  const d = p.data || {};
  const screen = String(d.screen || "");
  if (type === "incoming_call") return null; // the call screen comes up by itself
  if (type === "official" || screen === "OfficialChat") return { screen: "OfficialChat", params: { account: cleanId(d.account) || "official" } };
  if (NOTICE_TYPES.includes(type)) return { screen: "Notice" };
  if (screen === "AdminSupport") return { screen: "AdminApp", params: cleanId(d.supportThreadId) ? { openThread: cleanId(d.supportThreadId) } : {} };
  if (type === "support" || screen === "Support") return { screen: "SupportChat" };
  if ((type === "message" && cleanId(d.userId)) || (type === "missed_call" && cleanId(d.callerId))) {
    const uid = cleanId(d.userId) || cleanId(d.callerId);
    const name = String(d.userName || (type === "missed_call" ? String(p.body || "").replace(/ called you.*$/, "") : String(p.title || "").replace(/^Message from /, "")) || "Farmer");
    return { screen: "Chat", params: { userId: uid, userName: name } };
  }
  if (cleanId(d.orderId)) return { screen: "OrderDetail", params: { orderId: cleanId(d.orderId) } };
  if (cleanId(d.postId)) {
    const commentId = cleanId(d.commentId);
    return { screen: "PostDetail", params: commentId ? { postId: cleanId(d.postId), commentId } : type === "comment" ? { postId: cleanId(d.postId), toComments: true } : { postId: cleanId(d.postId) } };
  }
  if (type === "follow" && cleanId(d.userId)) return { screen: "UserProfile", params: { userId: cleanId(d.userId), userName: String(d.userName || "") } };
  if (type === "rfq" || d.rfqId) return { screen: "Rfq" };
  if (type === "answer" || d.questionId) return { screen: "ExpertQA" };
  if (type === "price" || d.alertId) return { screen: "PriceAlert" };
  if (type === "reminder" || d.diaryId) return { screen: "FarmDiary" };
  if (type === "store" || type === "review" || d.storeId) return { screen: "SellerApp" };
  return p.title || p.body ? { screen: "Notice" } : null;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "F";

/** Params for the Chat screen from a target's {userId, userName}. */
export function chatParams(params: Record<string, any> = {}) {
  const name = String(params.userName || "Farmer");
  return { conversationId: String(params.userId), userName: name, userInitials: initialsOf(name) };
}

/** A profile from the server's public user, shaped like the app's PublicUser. */
export function profileUser(u: any) {
  const name = String(u?.name || u?.username || "Farmer");
  return {
    id: String(u?.id || ""), name, username: u?.username || undefined, initials: u?.initials || initialsOf(name),
    role: (["farmer", "buyer", "company", "expert"].includes(u?.role) ? u.role : "farmer") as any,
    avatar: u?.avatar || undefined, verified: !!u?.verified,
  };
}

// Pushes: the response listener and the cold-start check can both report the same tap; open it once.
const opened = new Set<string>();

/**
 * Open a notification from outside a screen (a push tap). Waits until the navigator is ready and
 * the signed-in screens exist (cold start: the saved sign-in is still loading), up to a minute;
 * if nobody signs in by then, nothing opens.
 */
export function openNotificationWhenReady(p: NotifPayload, key?: string, tries = 0) {
  if (key && tries === 0) {
    if (opened.has(key)) return;
    opened.add(key);
  }
  const ready = navigationRef.isReady() && (navigationRef.getRootState()?.routeNames || []).includes("NotificationOpen");
  if (ready) {
    navigationRef.navigate("NotificationOpen", { payload: p });
    return;
  }
  if (tries < 240) setTimeout(() => openNotificationWhenReady(p, key, tries + 1), 250);
}
