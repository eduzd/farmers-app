/**
 * Which bell a notification belongs to. The Marketplace bell shows marketplace notifications
 * (orders, your shop, price alerts, quotes, product reviews, admin changes to your products);
 * the Home bell shows the rest. The server decides for stored notifications (it sends
 * `market`); this is the same rule for a push that arrived while the app was open.
 */
export type NotificationScope = "market" | "home" | "all";

const MARKET_TYPES = new Set(["order", "store", "price", "rfq"]);

export function isMarketNotification(type: string | undefined, data?: Record<string, any> | null, serverMarket?: boolean): boolean {
  if (typeof serverMarket === "boolean") return serverMarket;
  const m = data?.market;
  if (m === true || m === "true") return true;
  if (m === false || m === "false") return false;
  return MARKET_TYPES.has(String(type || data?.type || ""));
}

export function inScope(scope: NotificationScope, isMarket: boolean): boolean {
  if (scope === "market") return isMarket;
  if (scope === "home") return !isMarket;
  return true;
}

export function parseScope(v: unknown): NotificationScope {
  return v === "market" || v === "home" ? v : "all";
}
