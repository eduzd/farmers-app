import type { Express, Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { notify } from "./featureRoutes";
import {
  rows, J, iso, str, wrap, requireUser, requireAdmin, audit, ensurePlatform, activeRestrictions, cleanRestrictions, RESTRICTION_KEYS,
} from "./platformRoutes";
import { registerOfficialRoutes } from "./officialRoutes";

/**
 * Admin moderation, the Farmers official page, carousel ads and admin search.
 *
 *  Moderation (admin only; the target is never yourself or another admin):
 *    GET    /api/admin/manage/users/:id/moderation        restrictions, ban, and how much the person has posted
 *    PUT    /api/admin/manage/users/:id/restrictions      { message, post, comment, sell, buy, days | until, reason }
 *    POST   /api/admin/manage/users/:id/ban               { reason, days }  (days 0 / missing = until unbanned)
 *    POST   /api/admin/manage/users/:id/unban
 *    POST   /api/admin/manage/users/:id/remove-content    { posts, comments, listings, community }
 *    DELETE /api/admin/manage/users/:id                   { confirm: their username or email }
 *  Restrictions are enforced for every request in platformGuard (code RESTRICTED), not just hidden in the app.
 *
 *  Official page ("Farmers Official" in every user's Chats; only admins can write, nobody can reply):
 *    GET  /api/official/messages     my official messages (to everyone + to me), oldest first; marks them read
 *    GET  /api/official/summary      { unread, last }
 *    POST /api/admin/manage/official { body, title?, target: "all" | userId, link? }   GET /official, DELETE /official/:id
 *
 *  Carousel ads:
 *    GET  /api/ads?placement=connect|home|market      every active ad in the admin's order (public; safety cap 50)
 *    GET/POST /api/admin/manage/ads, PUT/DELETE /api/admin/manage/ads/:id, POST /api/admin/manage/ads/reorder
 *
 *  Search:  GET /api/admin/manage/search?q=   users, products, shops, orders and support conversations at once
 */

export const OFFICIAL_ID = "farmers-official";
export const OFFICIAL_NAME = "Farmers Official";

let ready: Promise<void> | null = null;
export function ensureModeration() {
  if (!ready) {
    ready = (async () => {
      await ensurePlatform();
      const q = (s: any) => db.execute(s);
      await q(sql`CREATE TABLE IF NOT EXISTS official_messages (
        id varchar PRIMARY KEY, target_user_id varchar, title text, body text NOT NULL, link jsonb,
        created_by varchar, created_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE INDEX IF NOT EXISTS official_messages_target_idx ON official_messages (target_user_id, created_at)`);
      await q(sql`CREATE TABLE IF NOT EXISTS user_warnings (
        id varchar PRIMARY KEY, user_id varchar NOT NULL, reason text NOT NULL, created_by varchar, created_by_email text,
        withdrawn_at timestamp, created_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE INDEX IF NOT EXISTS user_warnings_user_idx ON user_warnings (user_id, created_at)`);
      await q(sql`CREATE TABLE IF NOT EXISTS official_reads (user_id varchar PRIMARY KEY, read_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE TABLE IF NOT EXISTS carousel_ads (
        id varchar PRIMARY KEY, placement varchar NOT NULL DEFAULT 'all', title_en text NOT NULL, title_bn text NOT NULL DEFAULT '',
        subtitle_en text NOT NULL DEFAULT '', subtitle_bn text NOT NULL DEFAULT '', cta_en varchar NOT NULL DEFAULT '', cta_bn varchar NOT NULL DEFAULT '',
        icon varchar NOT NULL DEFAULT 'tag', color1 varchar NOT NULL DEFAULT '#16A34A', color2 varchar NOT NULL DEFAULT '#0E7490',
        image text, link_type varchar NOT NULL DEFAULT 'none', link_target text, active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0, starts_at timestamp, ends_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
      // Official accounts: Farmers Official (the default, can't be removed) plus any the admins create
      // (Safety, Market news...). Each one is its own verified chat in people's Chats.
      await q(sql`CREATE TABLE IF NOT EXISTS official_accounts (
        id varchar PRIMARY KEY, name_en text NOT NULL, name_bn text NOT NULL DEFAULT '', about_en text NOT NULL DEFAULT '',
        about_bn text NOT NULL DEFAULT '', icon varchar NOT NULL DEFAULT 'check-circle', color varchar NOT NULL DEFAULT '#2563EB',
        is_default boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, created_by varchar,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`INSERT INTO official_accounts (id, name_en, name_bn, about_en, about_bn, is_default)
        VALUES (${OFFICIAL_ID}, ${OFFICIAL_NAME}, ${"ফার্মার্স অফিসিয়াল"}, ${"News and updates from the Farmers team"}, ${"ফার্মার্স টিমের খবর ও আপডেট"}, true)
        ON CONFLICT (id) DO NOTHING`);
      await q(sql`ALTER TABLE official_messages ADD COLUMN IF NOT EXISTS account_id varchar NOT NULL DEFAULT 'farmers-official'`);
      await q(sql`CREATE INDEX IF NOT EXISTS official_messages_account_idx ON official_messages (account_id, created_at)`);
      await q(sql`CREATE TABLE IF NOT EXISTS official_account_reads (
        user_id varchar NOT NULL, account_id varchar NOT NULL, read_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (user_id, account_id))`);
    })();
    ready.catch(() => (ready = null));
  }
  return ready;
}

const w = (fn: (req: Request, res: Response) => Promise<any>) =>
  wrap(async (req, res) => {
    await ensureModeration();
    return fn(req, res);
  });

const one = async (q: any) => Number(rows(await db.execute(q))[0]?.n || 0);
/** Runs a clean-up statement; a table that doesn't exist on this database is simply skipped. */
const tryRun = async (q: any) => {
  try {
    await db.execute(q);
  } catch {}
};
const tryCount = async (q: any) => {
  try {
    return await one(q);
  } catch {
    return 0;
  }
};

async function target(req: Request, res: Response) {
  const me = (req as any).admin;
  const t = rows(await db.execute(sql`SELECT * FROM users WHERE id = ${String(req.params.id)} LIMIT 1`))[0];
  if (!t || t.deleted_at) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  if (t.id === me.id) {
    res.status(400).json({ error: "You can't do this to your own account" });
    return null;
  }
  if (t.is_super_admin) {
    res.status(400).json({ error: "Remove admin rights from this account first" });
    return null;
  }
  return t;
}

const LABEL: Record<string, string> = { message: "sending messages", post: "posting in the community", comment: "commenting", sell: "selling", buy: "placing orders" };

/** Puts a message from Farmers Official in one person's chat list and rings their bell. */
export async function sendOfficial(createdBy: string | null, targetId: string, title: string, body: string) {
  const id = `off-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  await db.execute(sql`INSERT INTO official_messages (id, target_user_id, title, body, link, created_by)
    VALUES (${id}, ${targetId}, ${title || null}, ${body}, ${null}::jsonb, ${createdBy})`);
  await notify(targetId, "official", title || OFFICIAL_NAME, body.slice(0, 200), { screen: "OfficialChat", account: OFFICIAL_ID });
  return id;
}

async function activeWarnings(uid: string) {
  return rows(await db.execute(sql`SELECT * FROM user_warnings WHERE user_id = ${uid} AND withdrawn_at IS NULL ORDER BY created_at DESC`));
}

export function moderationOut(t: any) {
  const act = activeRestrictions(t.restrictions);
  return {
    banned: !!t.banned,
    bannedReason: t.banned_reason || "",
    bannedUntil: t.banned_until ? iso(t.banned_until) : null,
    restrictions: act,
    restricted: RESTRICTION_KEYS.some((k) => (act as any)[k]),
  };
}

function adOut(a: any) {
  return {
    id: a.id, placement: a.placement, titleEn: a.title_en, titleBn: a.title_bn, subtitleEn: a.subtitle_en, subtitleBn: a.subtitle_bn,
    ctaEn: a.cta_en, ctaBn: a.cta_bn, icon: a.icon, color1: a.color1, color2: a.color2, image: a.image || "",
    linkType: a.link_type, linkTarget: a.link_target || "", active: !!a.active, sortOrder: Number(a.sort_order || 0),
    startsAt: a.starts_at ? iso(a.starts_at) : null, endsAt: a.ends_at ? iso(a.ends_at) : null, updatedAt: iso(a.updated_at),
  };
}
const HEX = /^#[0-9a-fA-F]{6}$/;
const PLACEMENTS = ["all", "connect", "home", "market"];
const LINK_TYPES = ["none", "product", "category", "shop", "support", "url"];
function adFields(b: any, partial: boolean) {
  const o: any = {};
  if (!partial || b.titleEn !== undefined) {
    o.title_en = str(b.titleEn, 80);
    if (!o.title_en) return { error: "Write a title (English)" };
  }
  const t = (k: string, col: string, max: number) => {
    if (b[k] !== undefined) o[col] = str(b[k], max);
  };
  t("titleBn", "title_bn", 80); t("subtitleEn", "subtitle_en", 160); t("subtitleBn", "subtitle_bn", 160);
  t("ctaEn", "cta_en", 30); t("ctaBn", "cta_bn", 30); t("icon", "icon", 40); t("image", "image", 1000); t("linkTarget", "link_target", 500);
  if (b.placement !== undefined) {
    if (!PLACEMENTS.includes(b.placement)) return { error: "Choose where the ad shows" };
    o.placement = b.placement;
  }
  if (b.linkType !== undefined) {
    if (!LINK_TYPES.includes(b.linkType)) return { error: "Choose what the ad opens" };
    o.link_type = b.linkType;
  }
  for (const [k, col] of [["color1", "color1"], ["color2", "color2"]]) {
    if (b[k] !== undefined) {
      if (!HEX.test(String(b[k]))) return { error: "Colours must look like #16A34A" };
      o[col] = String(b[k]);
    }
  }
  if (o.link_type === "url" && o.link_target && !/^https:\/\//.test(o.link_target)) return { error: "Web links must start with https://" };
  if (b.active !== undefined) o.active = !!b.active;
  for (const [k, col] of [["startsAt", "starts_at"], ["endsAt", "ends_at"]]) {
    if (b[k] !== undefined) {
      if (!b[k]) o[col] = null;
      else {
        const d = new Date(b[k]);
        if (isNaN(d.getTime())) return { error: "Dates must look like 2026-11-01" };
        o[col] = d.toISOString();
      }
    }
  }
  return o;
}

export function registerModerationRoutes(app: Express) {
  ensureModeration().catch((e) => console.error("[moderation] init", e?.message));
  const A = "/api/admin/manage";

  // ================= MODERATION =================
  app.get(`${A}/users/:id/moderation`, requireAdmin, w(async (req, res) => {
    const t = rows(await db.execute(sql`SELECT * FROM users WHERE id = ${String(req.params.id)} LIMIT 1`))[0];
    if (!t || t.deleted_at) return res.status(404).json({ error: "User not found" });
    const id = t.id;
    res.json({
      ...moderationOut(t),
      isSuperAdmin: !!t.is_super_admin,
      counts: {
        posts: await tryCount(sql`SELECT count(*)::int AS n FROM posts WHERE author_id = ${id}`),
        comments: await tryCount(sql`SELECT count(*)::int AS n FROM post_comments WHERE user_id = ${id}`),
        listings: await tryCount(sql`SELECT count(*)::int AS n FROM catalog_items WHERE owner_id = ${id}`),
        community: await tryCount(sql`SELECT count(*)::int AS n FROM community_items WHERE owner_id = ${id}`),
        messagesSent: await tryCount(sql`SELECT count(*)::int AS n FROM direct_messages WHERE sender_id = ${id}`),
        reportsAgainst: await tryCount(sql`SELECT count(*)::int AS n FROM post_reports r JOIN posts p ON p.id = r.post_id WHERE p.author_id = ${id}`),
      },
      warnings: rows(await db.execute(sql`SELECT * FROM user_warnings WHERE user_id = ${id} ORDER BY created_at DESC LIMIT 30`)).map((x: any) => ({
        id: x.id, reason: x.reason, by: x.created_by_email || "", at: iso(x.created_at), withdrawn: !!x.withdrawn_at,
      })),
      activity: await (async () => {
        try {
          return rows(await db.execute(sql`SELECT action, admin_email, details, created_at FROM audit_logs WHERE target_type = 'user' AND target_id = ${id} ORDER BY created_at DESC LIMIT 40`)).map((x: any) => ({
            action: x.action, by: x.admin_email || "", at: iso(x.created_at), details: typeof x.details === "string" ? x.details.slice(0, 300) : "",
          }));
        } catch {
          return [];
        }
      })(),
    });
  }));

  app.put(`${A}/users/:id/restrictions`, requireAdmin, w(async (req, res) => {
    const t = await target(req, res);
    if (!t) return;
    const r = cleanRestrictions(req.body || {});
    const on = RESTRICTION_KEYS.filter((k) => (r as any)[k]);
    await db.execute(sql`UPDATE users SET restrictions = ${on.length ? JSON.stringify(r) : null}::jsonb WHERE id = ${t.id}`);
    const before = activeRestrictions(t.restrictions);
    const changed = RESTRICTION_KEYS.some((k) => !!(before as any)[k] !== !!(r as any)[k]) || (on.length && before.until !== r.until);
    if (changed) {
      if (on.length) {
        const until = r.until ? ` until ${new Date(r.until).toDateString()}` : "";
        await notify(t.id, "moderation", "Your account has limits", `The admin stopped your account from ${on.map((k) => LABEL[k]).join(", ")}${until}.${r.reason ? " Reason: " + r.reason : ""}`, { screen: "Support" });
      } else if (RESTRICTION_KEYS.some((k) => (before as any)[k])) {
        await notify(t.id, "moderation", "Limits removed", "The admin removed the limits on your account.", {});
      }
    }
    await audit(req, on.length ? "RESTRICT_USER" : "UNRESTRICT_USER", "user", t.id, r);
    const fresh = rows(await db.execute(sql`SELECT * FROM users WHERE id = ${t.id} LIMIT 1`))[0];
    res.json({ success: true, ...moderationOut(fresh) });
  }));

  app.post(`${A}/users/:id/ban`, requireAdmin, w(async (req, res) => {
    const t = await target(req, res);
    if (!t) return;
    const reason = str(req.body?.reason, 300);
    const days = Number(req.body?.days) || 0;
    // Warning first: a ban needs at least one warning, unless the admin says why it can't wait.
    const warned = (await activeWarnings(t.id)).length;
    if (!warned && !req.body?.skipWarning) {
      return res.status(409).json({ error: "Send this person a warning before you ban them, or say why the ban can't wait.", code: "WARN_FIRST" });
    }
    if (!warned && !reason) return res.status(400).json({ error: "Write why you're banning without a warning" });
    const until = days > 0 ? new Date(Date.now() + Math.min(days, 3650) * 86400000).toISOString() : null;
    await db.execute(sql`UPDATE users SET banned = true, banned_reason = ${reason || null}, banned_until = ${until} WHERE id = ${t.id}`);
    await tryRun(sql`DELETE FROM push_tokens WHERE user_id = ${t.id}`);
    await audit(req, "BAN_USER", "user", t.id, { reason, days });
    const fresh = rows(await db.execute(sql`SELECT * FROM users WHERE id = ${t.id} LIMIT 1`))[0];
    res.json({ success: true, ...moderationOut(fresh) });
  }));

  app.post(`${A}/users/:id/warn`, requireAdmin, w(async (req, res) => {
    const t = await target(req, res);
    if (!t) return;
    const reason = str(req.body?.reason, 500);
    if (!reason) return res.status(400).json({ error: "Write what the warning is for" });
    const me = (req as any).admin;
    const id = `warn-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    await db.execute(sql`INSERT INTO user_warnings (id, user_id, reason, created_by, created_by_email) VALUES (${id}, ${t.id}, ${reason}, ${me?.id || null}, ${me?.email || null})`);
    const n = (await activeWarnings(t.id)).length;
    await sendOfficial(me?.id || null, t.id, `Warning ${n}`, `${reason}\n\nPlease follow the Farmers community rules. More warnings can lead to limits on your account or a ban.`);
    await audit(req, "WARN_USER", "user", t.id, { reason, warning: n });
    res.status(201).json({ success: true, id, warnings: n });
  }));

  app.delete(`${A}/users/:id/warnings/:wid`, requireAdmin, w(async (req, res) => {
    const x = rows(await db.execute(sql`SELECT * FROM user_warnings WHERE id = ${String(req.params.wid)} AND user_id = ${String(req.params.id)} LIMIT 1`))[0];
    if (!x) return res.status(404).json({ error: "Warning not found" });
    await db.execute(sql`UPDATE user_warnings SET withdrawn_at = now() WHERE id = ${x.id}`);
    await audit(req, "WITHDRAW_WARNING", "user", x.user_id, { reason: x.reason });
    res.json({ success: true });
  }));

  app.post(`${A}/users/:id/message`, requireAdmin, w(async (req, res) => {
    const t = rows(await db.execute(sql`SELECT id FROM users WHERE id = ${String(req.params.id)} AND deleted_at IS NULL LIMIT 1`))[0];
    if (!t) return res.status(404).json({ error: "User not found" });
    const body = str(req.body?.body, 2000);
    if (!body) return res.status(400).json({ error: "Write the message first" });
    const title = str(req.body?.title, 120);
    const id = await sendOfficial((req as any).uid, t.id, title, body);
    await audit(req, "OFFICIAL_MESSAGE", "user", t.id, { title, length: body.length });
    res.status(201).json({ success: true, id });
  }));

  app.post(`${A}/users/:id/unban`, requireAdmin, w(async (req, res) => {
    const t = rows(await db.execute(sql`SELECT * FROM users WHERE id = ${String(req.params.id)} LIMIT 1`))[0];
    if (!t || t.deleted_at) return res.status(404).json({ error: "User not found" });
    await db.execute(sql`UPDATE users SET banned = false, banned_reason = null, banned_until = null WHERE id = ${t.id}`);
    await audit(req, "UNBAN_USER", "user", t.id, "");
    const fresh = rows(await db.execute(sql`SELECT * FROM users WHERE id = ${t.id} LIMIT 1`))[0];
    res.json({ success: true, ...moderationOut(fresh) });
  }));

  app.post(`${A}/users/:id/remove-content`, requireAdmin, w(async (req, res) => {
    const t = await target(req, res);
    if (!t) return;
    const b = req.body || {};
    const removed: Record<string, number> = {};
    if (b.posts) {
      removed.posts = await tryCount(sql`SELECT count(*)::int AS n FROM posts WHERE author_id = ${t.id}`);
      await tryRun(sql`DELETE FROM posts WHERE author_id = ${t.id}`);
    }
    if (b.comments) {
      removed.comments = await tryCount(sql`SELECT count(*)::int AS n FROM post_comments WHERE user_id = ${t.id}`);
      await tryRun(sql`DELETE FROM post_comments WHERE user_id = ${t.id}`);
    }
    if (b.listings) {
      removed.listings = await tryCount(sql`SELECT count(*)::int AS n FROM catalog_items WHERE owner_id = ${t.id} AND kind = 'listings'`);
      await tryRun(sql`DELETE FROM catalog_items WHERE owner_id = ${t.id} AND kind = 'listings'`);
    }
    if (b.community) {
      removed.community = await tryCount(sql`SELECT count(*)::int AS n FROM community_items WHERE owner_id = ${t.id}`);
      await tryRun(sql`DELETE FROM community_items WHERE owner_id = ${t.id}`);
    }
    if (!Object.keys(removed).length) return res.status(400).json({ error: "Choose what to remove" });
    await notify(t.id, "moderation", "Content removed by admin", "Some of your content was removed by the admin for breaking the community rules.", {});
    await audit(req, "REMOVE_USER_CONTENT", "user", t.id, removed);
    res.json({ success: true, removed });
  }));

  /**
   * Delete an account for good. Their posts, comments, listings, shop, messages, follows and
   * support chat are removed and their sign-in stops working. Orders they placed stay for the
   * shop's records, shown as "Deleted user" (the personal details are wiped).
   */
  app.delete(`${A}/users/:id`, requireAdmin, w(async (req, res) => {
    const t = await target(req, res);
    if (!t) return;
    const confirm = str(req.body?.confirm ?? req.query.confirm, 200).toLowerCase();
    if (!confirm || (confirm !== String(t.username || "").toLowerCase() && confirm !== String(t.email || "").toLowerCase())) {
      return res.status(400).json({ error: "Type the person's username or email to confirm", code: "CONFIRM" });
    }
    const id = t.id;
    const steps = [
      sql`DELETE FROM posts WHERE author_id = ${id}`,
      sql`DELETE FROM post_comments WHERE user_id = ${id}`,
      sql`DELETE FROM post_likes WHERE user_id = ${id}`,
      sql`DELETE FROM post_saves WHERE user_id = ${id}`,
      sql`DELETE FROM post_reports WHERE reporter_id = ${id}`,
      sql`DELETE FROM catalog_items WHERE owner_id = ${id}`,
      sql`DELETE FROM community_items WHERE owner_id = ${id}`,
      sql`DELETE FROM stores WHERE owner_id = ${id}`,
      sql`DELETE FROM follows WHERE follower_id = ${id} OR followee_id = ${id}`,
      sql`DELETE FROM dm_reactions WHERE user_id = ${id}`,
      sql`DELETE FROM dm_media WHERE sender_id = ${id} OR recipient_id = ${id}`,
      sql`DELETE FROM direct_messages WHERE sender_id = ${id} OR recipient_id = ${id}`,
      sql`DELETE FROM support_media WHERE thread_id IN (SELECT id FROM support_threads WHERE user_id = ${id})`,
      sql`DELETE FROM support_messages WHERE thread_id IN (SELECT id FROM support_threads WHERE user_id = ${id})`,
      sql`DELETE FROM support_threads WHERE user_id = ${id}`,
      sql`DELETE FROM app_notifications WHERE user_id = ${id}`,
      sql`DELETE FROM push_tokens WHERE user_id = ${id}`,
      sql`DELETE FROM favorites WHERE user_id = ${id}`,
      sql`DELETE FROM item_reviews WHERE user_id = ${id}`,
      sql`DELETE FROM user_relations WHERE user_id = ${id} OR target_id = ${id}`,
      sql`DELETE FROM user_addresses WHERE user_id = ${id}`,
      sql`DELETE FROM user_avatars WHERE user_id = ${id}`,
      sql`DELETE FROM user_about WHERE user_id = ${id}`,
      sql`DELETE FROM user_price_alerts WHERE user_id = ${id}`,
      sql`DELETE FROM user_oauth_providers WHERE user_id = ${id}`,
      sql`DELETE FROM official_messages WHERE target_user_id = ${id}`,
      sql`DELETE FROM official_reads WHERE user_id = ${id}`,
      sql`DELETE FROM official_account_reads WHERE user_id = ${id}`,
    ];
    for (const s of steps) await tryRun(s);
    // Remove the account row; if old records (orders) still point at it, keep an empty shell instead.
    let hard = false;
    try {
      await db.execute(sql`DELETE FROM users WHERE id = ${id}`);
      hard = true;
    } catch {}
    if (!hard) {
      const tag = crypto.randomBytes(5).toString("hex");
      await db.execute(sql`UPDATE users SET username = ${"deleted_" + tag}, email = NULL, name = 'Deleted user', avatar = NULL, phone = NULL,
        password = ${await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10)}, verified = false, is_super_admin = false,
        banned = true, banned_reason = 'Account deleted', banned_until = NULL, restrictions = NULL, deleted_at = now() WHERE id = ${id}`);
    }
    await audit(req, "DELETE_USER", "user", id, { username: t.username, email: t.email ? "(wiped)" : "", hard });
    res.json({ success: true, deleted: true });
  }));

  registerOfficialRoutes(app, A);

  // ================= CAROUSEL ADS =================
  app.get("/api/ads", w(async (req, res) => {
    const placement = str(req.query.placement, 20) || "all";
    const r = rows(await db.execute(sql`SELECT * FROM carousel_ads WHERE active
      AND (placement = 'all' OR placement = ${placement})
      AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
      ORDER BY sort_order ASC, created_at ASC LIMIT 50`));
    res.json(r.map(adOut));
  }));

  app.get(`${A}/ads`, requireAdmin, w(async (_req, res) => {
    res.json(rows(await db.execute(sql`SELECT * FROM carousel_ads ORDER BY sort_order ASC, created_at ASC`)).map(adOut));
  }));

  app.post(`${A}/ads`, requireAdmin, w(async (req, res) => {
    const f: any = adFields(req.body || {}, false);
    if (f.error) return res.status(400).json(f);
    const id = `ad-${crypto.randomUUID()}`;
    const sort = await one(sql`SELECT coalesce(max(sort_order), -1)::int + 1 AS n FROM carousel_ads`);
    await db.execute(sql`INSERT INTO carousel_ads (id, sort_order, title_en) VALUES (${id}, ${sort}, ${f.title_en})`);
    await applyAd(id, f);
    await audit(req, "CREATE_AD", "ad", id, { title: f.title_en });
    res.status(201).json(adOut(rows(await db.execute(sql`SELECT * FROM carousel_ads WHERE id = ${id}`))[0]));
  }));

  const applyAd = async (id: string, f: any) => {
    for (const [col, v] of Object.entries(f)) {
      // Column names come only from adFields' fixed list.
      await db.execute(sql`UPDATE carousel_ads SET ${sql.raw(col)} = ${v as any}, updated_at = now() WHERE id = ${id}`);
    }
  };

  app.put(`${A}/ads/:id`, requireAdmin, w(async (req, res) => {
    const a = rows(await db.execute(sql`SELECT id FROM carousel_ads WHERE id = ${String(req.params.id)} LIMIT 1`))[0];
    if (!a) return res.status(404).json({ error: "Ad not found" });
    const f: any = adFields(req.body || {}, true);
    if (f.error) return res.status(400).json(f);
    await applyAd(a.id, f);
    await audit(req, "UPDATE_AD", "ad", a.id, req.body || {});
    res.json(adOut(rows(await db.execute(sql`SELECT * FROM carousel_ads WHERE id = ${a.id}`))[0]));
  }));

  app.delete(`${A}/ads/:id`, requireAdmin, w(async (req, res) => {
    const a = rows(await db.execute(sql`SELECT id, title_en FROM carousel_ads WHERE id = ${String(req.params.id)} LIMIT 1`))[0];
    if (!a) return res.status(404).json({ error: "Ad not found" });
    await db.execute(sql`DELETE FROM carousel_ads WHERE id = ${a.id}`);
    await audit(req, "DELETE_AD", "ad", a.id, { title: a.title_en });
    res.json({ success: true });
  }));

  app.post(`${A}/ads/reorder`, requireAdmin, w(async (req, res) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 100) : [];
    let i = 0;
    for (const id of ids) await db.execute(sql`UPDATE carousel_ads SET sort_order = ${i++} WHERE id = ${id}`);
    res.json({ success: true });
  }));

  // ================= SEARCH =================
  app.get(`${A}/search`, requireAdmin, w(async (req, res) => {
    const q = str(req.query.q, 100).toLowerCase();
    if (q.length < 2) return res.json({ users: [], products: [], shops: [], orders: [], support: [] });
    const like = `%${q}%`;
    const users = rows(await db.execute(sql`SELECT id, name, username, email, phone, banned, is_super_admin, restrictions FROM users
      WHERE deleted_at IS NULL AND (lower(coalesce(name,'')) LIKE ${like} OR lower(username) LIKE ${like} OR lower(coalesce(email,'')) LIKE ${like} OR coalesce(phone,'') LIKE ${like} OR lower(id) = ${q})
      ORDER BY created_at DESC LIMIT 8`)).map((u: any) => ({
      id: u.id, name: u.name || u.username, username: u.username, email: u.email || "", phone: u.phone || "", banned: !!u.banned, isSuperAdmin: !!u.is_super_admin,
      restricted: RESTRICTION_KEYS.some((k) => (activeRestrictions(u.restrictions) as any)[k]),
    }));
    const products = rows(await db.execute(sql`SELECT id, data FROM catalog_items WHERE kind = 'listings'
      AND (lower(coalesce(data->>'name','')) LIKE ${like} OR lower(coalesce(data->>'seller','')) LIKE ${like} OR lower(id) LIKE ${like})
      ORDER BY created_at DESC LIMIT 8`)).map((p: any) => {
      const d = J(p.data) || {};
      return { id: p.id, name: d.name || "Product", price: Number(d.price) || 0, unit: d.unit || "", image: d.image || "", seller: d.seller || "", hidden: !!d.hidden, quantity: Number(d.quantity) || 0 };
    });
    const shops = rows(await db.execute(sql`SELECT id, name, logo, status, location FROM stores
      WHERE lower(name) LIKE ${like} OR lower(coalesce(location,'')) LIKE ${like} OR lower(id) LIKE ${like} ORDER BY created_at DESC LIMIT 6`))
      .map((s: any) => ({ id: s.id, name: s.name, logo: s.logo || "", status: s.status, location: s.location || "" }));
    const orders = rows(await db.execute(sql`SELECT o.id, o.total, o.status, o.created_at, u.name AS buyer_name FROM shop_orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE lower(o.id) LIKE ${like} OR lower(coalesce(u.name,'')) LIKE ${like} OR lower(coalesce(u.email,'')) LIKE ${like} ORDER BY o.created_at DESC LIMIT 6`))
      .map((o: any) => ({ id: o.id, total: Number(o.total) || 0, status: o.status, buyerName: o.buyer_name || "", createdAt: iso(o.created_at) }));
    let support: any[] = [];
    try {
      support = rows(await db.execute(sql`SELECT t.id, t.status, t.last_message, t.admin_unread, u.name AS user_name, u.username FROM support_threads t LEFT JOIN users u ON u.id = t.user_id
        WHERE lower(coalesce(u.name,'')) LIKE ${like} OR lower(coalesce(u.username,'')) LIKE ${like} OR lower(coalesce(t.last_message,'')) LIKE ${like}
        ORDER BY t.last_message_at DESC LIMIT 6`)).map((t: any) => ({ id: t.id, status: t.status, lastMessage: t.last_message || "", adminUnread: Number(t.admin_unread) || 0, userName: t.user_name || t.username || "" }));
    } catch {}
    res.json({ users, products, shops, orders, support });
  }));
}
