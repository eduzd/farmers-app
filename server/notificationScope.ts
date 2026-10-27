import { sql } from "drizzle-orm";

/**
 * Which notifications belong to the Marketplace bell and which to the Home bell.
 *
 * Market: orders (buyer and seller), your shop, market price alerts, quotes on your buying
 * requests, reviews of your products, and the admin hiding or removing one of your products.
 * Home: everything else (likes, comments, follows, new posts, voice rooms, answers, official
 * accounts, support, reminders, account limits...).
 *
 * A notification is market when its type is always about the market, when it was created with
 * data.market = true, or (for older reviews and moderation notices) when the product it points
 * at is a marketplace listing.
 */
export const MARKET_TYPES = ["order", "store", "price", "rfq"] as const;

export const marketPredicate = sql`coalesce((
  app_notifications.type IN ('order', 'store', 'price', 'rfq')
  OR app_notifications.data->>'market' = 'true'
  OR (
    app_notifications.type IN ('review', 'moderation')
    AND coalesce(app_notifications.data->>'market', '') <> 'false'
    AND EXISTS (
      SELECT 1 FROM catalog_items ci
      WHERE ci.kind = 'listings'
        AND ci.id = coalesce(app_notifications.data->>'itemId', app_notifications.data->>'targetId')
    )
  )
), false)`; // coalesce: a missing data field must count as "not market", never as unknown

export type NotificationScope = "market" | "home" | "all";

export function parseScope(v: unknown): NotificationScope {
  return v === "market" || v === "home" ? v : "all";
}

/** The SQL condition for one scope (a no-op for "all"). */
export function scopeCondition(scope: NotificationScope) {
  if (scope === "market") return sql` AND ${marketPredicate}`;
  if (scope === "home") return sql` AND NOT ${marketPredicate}`;
  return sql``;
}
