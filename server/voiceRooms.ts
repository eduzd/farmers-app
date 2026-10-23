// Voice rooms: live audio rooms with a stage (8 seats to start, the host can set 2 to 20) and an audience.
//
// - Who may start a room is set by the admin (Admin > More > Voice rooms):
//   "experts" (experts + people the admin picked, the default), "selected" (only picked people)
//   or "everyone". Admins can always start one. Checked here on the server.
// - Rooms are saved in voice_rooms (so a card in the community feed knows if its room is still
//   live, scheduled or over). Who is in a room right now lives in memory and goes over /ws/chat.
// - Roles: host (one, made the room), moderator (on stage, can manage hands and the stage),
//   speaker (on stage), audience (listens, can raise a hand). The host appoints moderators,
//   removes people from the room, and ends it.
// - The voice itself goes phone to phone (WebRTC). The server only relays set-up messages,
//   and only between two people in the same room when at least one of them is on stage.
import type { Express, Request, Response } from "express";
import type { WebSocket } from "ws";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { rows, iso as isoBase, str, wrap, requireUser, requireAdmin, audit, activeRestrictions } from "./platformRoutes";
import { notify } from "./featureRoutes";
import { ensureProfileColumns } from "./profileColumns";

/** Seats the stage starts with, and how many the room page shows before "More". */
/** Dates from the database as ISO text (timestamptz can come back as "... +00"). */
const iso = (v: any): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  try {
    return isoBase(v);
  } catch {
    return null;
  }
};
export const STAGE_LIMIT = 8;
/** The most seats a host can give the stage (every speaker's voice goes to every listener). */
export const STAGE_MAX = 20;
export const ROOM_LIMIT = 60;
const HOST_GRACE_MS = 90_000;
const MEMBER_GRACE_MS = 25_000;
const HOST_FIRST_JOIN_MS = 3 * 60_000;
const CATEGORIES = ["general", "crop", "livestock", "fishery", "poultry", "market", "health", "weather"];
const WHO = ["experts", "selected", "everyone"] as const;
type Who = (typeof WHO)[number];

type Role = "host" | "moderator" | "speaker" | "audience";
const onStage = (r: Role) => r !== "audience";

interface Member {
  userId: string;
  name: string;
  avatar: string | null;
  profileRole: string | null;
  role: Role;
  muted: boolean;
  hand: boolean;
  handAt: number;
  invitedToStage: boolean;
  joinedAt: number;
  online: boolean;
  epoch: number;
  ws: WebSocket | null;
  goneTimer: ReturnType<typeof setTimeout> | null;
}

interface ChatMsg {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  role: Role;
  text: string;
  at: string;
}
const CHAT_KEEP = 150;

interface LiveRoom {
  id: string;
  hostId: string;
  title: string;
  description: string;
  category: string;
  communityId: string | null;
  postId: string | null;
  isPrivate: boolean;
  /** How many seats the stage has (host included). The host picks 2 to 20; 8 to start. */
  stageLimit: number;
  createdAt: number;
  startedAt: number;
  /** People the host picked on the setup page: they go straight to the stage. */
  invitedSpeakers: Set<string>;
  invitedModerators: Set<string>;
  removed: Set<string>;
  members: Map<string, Member>;
  /** Text chat in the room (last CHAT_KEEP messages, memory only). */
  chat: ChatMsg[];
  chatOn: boolean;
  hostTimer: ReturnType<typeof setTimeout> | null;
}

const live = new Map<string, LiveRoom>();
const clampStage = (v: any) => Math.min(STAGE_MAX, Math.max(2, Math.round(Number(v)) || STAGE_LIMIT));
/** Which room each person is in right now (one at a time). */
const whereIs = new Map<string, string>();

let deps: { sendToUser: (uid: string, m: any) => boolean; userOnline: (uid: string) => boolean } | null = null;

// ------------------------------------------------------------------ tables

let ready: Promise<void> | null = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await ensureProfileColumns();
      await db.execute(sql`CREATE TABLE IF NOT EXISTS voice_rooms (
        id text PRIMARY KEY,
        host_id text NOT NULL,
        title text NOT NULL,
        description text NOT NULL DEFAULT '',
        category text NOT NULL DEFAULT 'general',
        community_id text,
        post_id text,
        is_private boolean NOT NULL DEFAULT false,
        status text NOT NULL DEFAULT 'live',
        scheduled_for timestamptz,
        speakers jsonb NOT NULL DEFAULT '[]'::jsonb,
        moderators jsonb NOT NULL DEFAULT '[]'::jsonb,
        stage_limit integer NOT NULL DEFAULT 8,
        created_at timestamptz NOT NULL DEFAULT now(),
        started_at timestamptz,
        ended_at timestamptz,
        end_reason text
      )`);
      await db.execute(sql`ALTER TABLE voice_rooms ADD COLUMN IF NOT EXISTS stage_limit integer NOT NULL DEFAULT 8`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS voice_rooms_post_idx ON voice_rooms (post_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS voice_rooms_status_idx ON voice_rooms (status)`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS voice_room_hosts (
        user_id text PRIMARY KEY,
        added_by text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS voice_room_settings (
        key text PRIMARY KEY,
        value text NOT NULL
      )`);
      // Nobody is connected to a room after a restart, so rooms that were live are over.
      await db.execute(sql`UPDATE voice_rooms SET status = 'ended', ended_at = now(), end_reason = 'server_restart' WHERE status = 'live'`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

async function getWho(): Promise<Who> {
  await ensureTables();
  const r = rows(await db.execute(sql`SELECT value FROM voice_room_settings WHERE key = 'who'`));
  const v = r[0]?.value;
  return (WHO as readonly string[]).includes(v) ? (v as Who) : "experts";
}

async function person(uid: string) {
  const r = rows(
    await db.execute(sql`SELECT id, name, username, avatar, profile_role, coalesce(is_super_admin, false) AS is_admin,
      coalesce(banned, false) AS banned FROM users WHERE id = ${uid} LIMIT 1`),
  );
  const u = r[0];
  if (!u) return null;
  return {
    id: String(u.id),
    name: String(u.name || u.username || "Farmer"),
    avatar: u.avatar || null,
    profileRole: u.profile_role || null,
    isAdmin: !!u.is_admin,
    banned: !!u.banned,
  };
}

async function restrictionsOf(uid: string) {
  try {
    const r = rows(await db.execute(sql`SELECT restrictions FROM users WHERE id = ${uid} LIMIT 1`));
    return activeRestrictions(r[0]?.restrictions || {});
  } catch {
    return {};
  }
}

/** Can this person start a voice room? Decided by the admin's setting. */
export async function canHost(uid: string): Promise<{ allowed: boolean; reason: string; who: Who }> {
  const who = await getWho();
  const me = await person(uid);
  if (!me || me.banned) return { allowed: false, reason: "no_account", who };
  if (me.isAdmin) return { allowed: true, reason: "admin", who };
  if (who === "everyone") return { allowed: true, reason: "everyone", who };
  const picked = rows(await db.execute(sql`SELECT 1 FROM voice_room_hosts WHERE user_id = ${uid}`)).length > 0;
  if (picked) return { allowed: true, reason: "selected", who };
  if (who === "experts" && me.profileRole === "expert") return { allowed: true, reason: "expert", who };
  return { allowed: false, reason: who === "experts" ? "experts_only" : "selected_only", who };
}

// ------------------------------------------------------------------ state out

function memberOut(m: Member) {
  return {
    userId: m.userId,
    name: m.name,
    avatar: m.avatar,
    profileRole: m.profileRole,
    role: m.role,
    muted: m.muted,
    hand: m.hand,
    handAt: m.handAt,
    invitedToStage: m.invitedToStage,
    online: m.online,
    epoch: m.epoch,
  };
}

function roomState(room: LiveRoom) {
  const members = [...room.members.values()];
  return {
    id: room.id,
    hostId: room.hostId,
    title: room.title,
    description: room.description,
    category: room.category,
    isPrivate: room.isPrivate,
    postId: room.postId,
    startedAt: new Date(room.startedAt).toISOString(),
    stageLimit: room.stageLimit,
    stageShown: STAGE_LIMIT,
    stageMax: STAGE_MAX,
    roomLimit: ROOM_LIMIT,
    chatOn: room.chatOn,
    members: members.map(memberOut),
  };
}

function counts(room: LiveRoom) {
  let speakers = 0;
  let listeners = 0;
  for (const m of room.members.values()) onStage(m.role) ? speakers++ : listeners++;
  return { speakers, listeners };
}

function sendWs(ws: WebSocket | null, msg: any) {
  if (ws && (ws as any).readyState === 1) {
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch {}
  }
  return false;
}

function toMember(m: Member, msg: any) {
  if (!sendWs(m.ws, msg)) return false;
  return true;
}

function broadcast(room: LiveRoom) {
  const state = roomState(room);
  for (const m of room.members.values()) toMember(m, { type: "vr_state", room: state });
}

function stageCount(room: LiveRoom) {
  let n = 0;
  for (const m of room.members.values()) if (onStage(m.role)) n++;
  return n;
}

/** Is there a free seat on the stage? When the host brings someone up and the stage is full,
 *  the stage gets one more seat (up to STAGE_MAX). */
function seatFree(room: LiveRoom, byHost: boolean) {
  if (stageCount(room) < room.stageLimit) return true;
  if (!byHost || room.stageLimit >= STAGE_MAX) return false;
  room.stageLimit += 1;
  void db.execute(sql`UPDATE voice_rooms SET stage_limit = ${room.stageLimit} WHERE id = ${room.id}`).catch(() => {});
  return true;
}

async function endRoom(room: LiveRoom, reason: string) {
  if (live.get(room.id) !== room) return;
  live.delete(room.id);
  if (room.hostTimer) clearTimeout(room.hostTimer);
  for (const m of room.members.values()) {
    if (m.goneTimer) clearTimeout(m.goneTimer);
    toMember(m, { type: "vr_ended", roomId: room.id, reason });
    if (whereIs.get(m.userId) === room.id) whereIs.delete(m.userId);
  }
  room.members.clear();
  try {
    await db.execute(sql`UPDATE voice_rooms SET status = 'ended', ended_at = now(), end_reason = ${reason} WHERE id = ${room.id}`);
  } catch (e: any) {
    console.error("[voice-rooms] end", e?.message);
  }
}

function removeMember(room: LiveRoom, uid: string, opts: { notify?: string } = {}) {
  const m = room.members.get(uid);
  if (!m) return;
  if (m.goneTimer) clearTimeout(m.goneTimer);
  room.members.delete(uid);
  if (whereIs.get(uid) === room.id) whereIs.delete(uid);
  if (opts.notify) toMember(m, { type: opts.notify, roomId: room.id });
  if (uid === room.hostId) {
    void endRoom(room, "host_left");
    return;
  }
  broadcast(room);
}

function armHostTimer(room: LiveRoom, ms: number) {
  if (room.hostTimer) clearTimeout(room.hostTimer);
  room.hostTimer = setTimeout(() => {
    room.hostTimer = null;
    const h = room.members.get(room.hostId);
    if (h?.online) return;
    void endRoom(room, "host_left");
  }, ms);
}

function liveFromRow(r: any): LiveRoom {
  const speakers = Array.isArray(r.speakers) ? r.speakers : typeof r.speakers === "string" ? JSON.parse(r.speakers || "[]") : [];
  const mods = Array.isArray(r.moderators) ? r.moderators : typeof r.moderators === "string" ? JSON.parse(r.moderators || "[]") : [];
  return {
    id: r.id,
    hostId: String(r.host_id),
    title: r.title,
    description: r.description || "",
    category: r.category || "general",
    communityId: r.community_id || null,
    postId: r.post_id || null,
    isPrivate: !!r.is_private,
    stageLimit: clampStage(r.stage_limit),
    createdAt: new Date(iso(r.created_at) || Date.now()).getTime(),
    startedAt: Date.now(),
    invitedSpeakers: new Set(speakers.map(String)),
    invitedModerators: new Set(mods.map(String)),
    removed: new Set(),
    members: new Map(),
    chat: [],
    chatOn: true,
    hostTimer: null,
  };
}

// ------------------------------------------------------------------ feed cards

function cardFor(r: any, host: any) {
  const lr = live.get(r.id);
  const c = lr ? counts(lr) : { speakers: 0, listeners: 0 };
  return {
    id: r.id,
    title: r.title,
    description: r.description || "",
    category: r.category || "general",
    status: lr ? "live" : r.status === "scheduled" ? "scheduled" : "ended",
    isPrivate: !!r.is_private,
    scheduledFor: iso(r.scheduled_for),
    startedAt: iso(r.started_at),
    endedAt: iso(r.ended_at),
    hostId: String(r.host_id),
    hostName: host?.name || host?.username || "Farmer",
    hostAvatar: host?.avatar || null,
    hostProfileRole: host?.profile_role || null,
    speakers: c.speakers,
    listeners: c.listeners,
    stageLimit: lr ? lr.stageLimit : clampStage(r.stage_limit),
    stage: lr
      ? [...lr.members.values()].filter((m) => onStage(m.role)).slice(0, 4).map((m) => ({ userId: m.userId, name: m.name, avatar: m.avatar }))
      : [],
  };
}

/** Adds a `voiceRoom` card to feed posts that were shared from a voice room. */
export async function attachVoiceRooms<T extends { id: any }>(posts: T[]): Promise<T[]> {
  if (!posts?.length) return posts;
  try {
    await ensureTables();
    const ids = posts.map((p) => String(p.id));
    const r = rows(
      await db.execute(sql`SELECT v.*, u.name AS host_name, u.username AS host_username, u.avatar AS host_avatar, u.profile_role AS host_profile_role
        FROM voice_rooms v LEFT JOIN users u ON u.id = v.host_id
        WHERE v.post_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`),
    );
    if (!r.length) return posts;
    const byPost = new Map(r.map((x: any) => [String(x.post_id), x]));
    return posts.map((p: any) => {
      const x = byPost.get(String(p.id));
      if (!x) return p;
      return { ...p, voiceRoom: cardFor(x, { name: x.host_name, username: x.host_username, avatar: x.host_avatar, profile_role: x.host_profile_role }) };
    });
  } catch (e: any) {
    console.error("[voice-rooms] attach", e?.message);
    return posts;
  }
}

// ------------------------------------------------------------------ websocket

export function initVoiceRooms(d: { sendToUser: (uid: string, m: any) => boolean; userOnline: (uid: string) => boolean }) {
  deps = d;
  void ensureTables().catch((e) => console.error("[voice-rooms] tables", e?.message));
}

/** A socket closed: its person gets a short grace period before leaving their room. */
export function onVoiceClientGone(uid: string, ws: WebSocket) {
  const roomId = whereIs.get(uid);
  const room = roomId ? live.get(roomId) : null;
  const m = room?.members.get(uid);
  if (!room || !m || m.ws !== ws) return;
  m.online = false;
  m.ws = null;
  if (m.goneTimer) clearTimeout(m.goneTimer);
  if (uid === room.hostId) {
    armHostTimer(room, HOST_GRACE_MS);
  } else {
    m.goneTimer = setTimeout(() => {
      m.goneTimer = null;
      if (room.members.get(uid) === m && !m.online) removeMember(room, uid);
    }, MEMBER_GRACE_MS);
  }
  broadcast(room);
}

const lastHand = new Map<string, number>();
const lastChat = new Map<string, number>();
const lastReact = new Map<string, number>();
export const REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F44F}", "\u{1F602}", "\u{1F64F}", "\u{1F525}", "\u{1F33E}"];

export async function handleVoiceRoomMessage(uid: string, ws: WebSocket, message: any, reply: (m: any) => void) {
  const type = String(message?.type || "");
  const roomId = str(message?.roomId, 80);
  const room = roomId ? live.get(roomId) : undefined;
  const fail = (reason: string, extra: any = {}) => reply({ type: "vr_error", roomId, request: type, reason, ...extra });

  if (type === "vr_join") {
    if (!room) {
      await ensureTables();
      const r = rows(await db.execute(sql`SELECT status, scheduled_for FROM voice_rooms WHERE id = ${roomId}`))[0];
      if (!r) return fail("not_found");
      if (r.status === "scheduled") return fail("not_started", { scheduledFor: iso(r.scheduled_for) });
      return fail("ended");
    }
    if (room.removed.has(uid)) return fail("removed");
    const me = await person(uid);
    if (!me || me.banned) return fail("not_allowed");
    const isHost = uid === room.hostId;
    if (room.isPrivate && !isHost && !room.invitedSpeakers.has(uid) && !room.invitedModerators.has(uid) && !me.isAdmin) return fail("private");
    // Leave any other room first.
    const other = whereIs.get(uid);
    if (other && other !== room.id) {
      const o = live.get(other);
      if (o) removeMember(o, uid, { notify: "vr_left" });
    }
    let m = room.members.get(uid);
    if (m) {
      // Back again (reconnect, or the same person on another phone).
      if (m.ws && m.ws !== ws) sendWs(m.ws, { type: "vr_left", roomId: room.id, reason: "joined_elsewhere" });
      if (m.goneTimer) clearTimeout(m.goneTimer);
      m.goneTimer = null;
      m.ws = ws;
      m.online = true;
      m.epoch++;
    } else {
      if (room.members.size >= ROOM_LIMIT && !isHost) return fail("full");
      let role: Role = "audience";
      if (isHost) role = "host";
      else if (room.invitedModerators.has(uid) && stageCount(room) < room.stageLimit) role = "moderator";
      else if (room.invitedSpeakers.has(uid) && stageCount(room) < room.stageLimit) role = "speaker";
      m = {
        userId: uid,
        name: me.name,
        avatar: me.avatar,
        profileRole: me.profileRole,
        role,
        muted: role !== "host",
        hand: false,
        handAt: 0,
        invitedToStage: false,
        joinedAt: Date.now(),
        online: true,
        epoch: 1,
        ws,
        goneTimer: null,
      };
      room.members.set(uid, m);
    }
    whereIs.set(uid, room.id);
    if (isHost && room.hostTimer) {
      clearTimeout(room.hostTimer);
      room.hostTimer = null;
    }
    reply({ type: "vr_joined", roomId: room.id, you: uid, room: roomState(room), chat: room.chat.slice(-60) });
    broadcast(room);
    return;
  }

  if (!room) return fail("ended");
  const me = room.members.get(uid);
  if (!me || me.ws !== ws) return fail("not_in_room");
  const isHost = me.role === "host";
  const canManage = isHost || me.role === "moderator";
  const targetId = str(message?.userId, 80);
  const target = targetId ? room.members.get(targetId) : undefined;
  /** Moderators can't act on the host or on other moderators. */
  const canActOn = (t: Member) => t.userId !== uid && t.role !== "host" && (isHost || t.role !== "moderator");
  const bump = (m: Member) => {
    m.epoch++;
  };

  switch (type) {
    case "vr_leave":
      removeMember(room, uid);
      return reply({ type: "vr_left", roomId: room.id });

    case "vr_hand": {
      if (onStage(me.role)) return fail("already_on_stage");
      const up = !!message?.up;
      if (up) {
        const last = lastHand.get(uid) || 0;
        if (Date.now() - last < 1500) return fail("slow_down");
        lastHand.set(uid, Date.now());
      }
      me.hand = up;
      me.handAt = up ? Date.now() : 0;
      broadcast(room);
      if (up) {
        for (const m of room.members.values())
          if (m.role === "host" || m.role === "moderator") toMember(m, { type: "vr_hand_raised", roomId: room.id, userId: uid, name: me.name });
      }
      return;
    }

    case "vr_mute": {
      if (!onStage(me.role)) return fail("not_on_stage");
      me.muted = !!message?.muted;
      return broadcast(room);
    }

    case "vr_accept": // accept a raised hand
    case "vr_reject": {
      if (!canManage) return fail("not_allowed");
      if (!target || onStage(target.role)) return fail("no_request");
      if (type === "vr_reject") {
        target.hand = false;
        target.handAt = 0;
        toMember(target, { type: "vr_hand_declined", roomId: room.id });
        return broadcast(room);
      }
      if (!target.hand) return fail("no_request");
      if (!seatFree(room, isHost)) return fail("stage_full");
      target.role = "speaker";
      target.hand = false;
      target.handAt = 0;
      target.invitedToStage = false;
      target.muted = true;
      bump(target);
      toMember(target, { type: "vr_on_stage", roomId: room.id, by: me.name });
      return broadcast(room);
    }

    case "vr_invite": {
      // Ask someone in the audience to come up to the stage; they say yes or no.
      if (!canManage) return fail("not_allowed");
      if (!target || onStage(target.role)) return fail("not_in_audience");
      if (stageCount(room) >= room.stageLimit && !(isHost && room.stageLimit < STAGE_MAX)) return fail("stage_full");
      target.invitedToStage = true;
      toMember(target, { type: "vr_invited", roomId: room.id, by: me.name });
      return broadcast(room);
    }

    case "vr_invite_reply": {
      if (!me.invitedToStage) return fail("no_invite");
      me.invitedToStage = false;
      if (message?.accept) {
        if (!seatFree(room, true)) {
          broadcast(room);
          return fail("stage_full");
        }
        me.role = "speaker";
        me.hand = false;
        me.handAt = 0;
        me.muted = true;
        bump(me);
      }
      return broadcast(room);
    }

    case "vr_to_audience": {
      // Take someone off the stage (or step down yourself).
      const t = targetId && targetId !== uid ? target : me;
      if (!t || !onStage(t.role)) return fail("not_on_stage");
      if (t.role === "host") return fail("host_stays");
      if (t !== me && !(canManage && canActOn(t))) return fail("not_allowed");
      t.role = "audience";
      t.muted = true;
      t.hand = false;
      bump(t);
      if (t !== me) toMember(t, { type: "vr_off_stage", roomId: room.id, by: me.name });
      return broadcast(room);
    }

    case "vr_host_mute": {
      if (!canManage) return fail("not_allowed");
      if (!target || !onStage(target.role) || !canActOn(target)) return fail("not_allowed");
      target.muted = true;
      toMember(target, { type: "vr_muted_by", roomId: room.id, by: me.name });
      return broadcast(room);
    }

    case "vr_make_moderator": {
      if (!isHost) return fail("not_allowed");
      if (!target || target.role === "host" || target.role === "moderator") return fail("not_allowed");
      if (!onStage(target.role)) {
        if (!seatFree(room, true)) return fail("stage_full");
        target.muted = true;
        target.hand = false;
        target.invitedToStage = false;
        bump(target);
      }
      target.role = "moderator";
      toMember(target, { type: "vr_made_moderator", roomId: room.id, by: me.name });
      return broadcast(room);
    }

    case "vr_remove_moderator": {
      if (!isHost) return fail("not_allowed");
      if (!target || target.role !== "moderator") return fail("not_allowed");
      target.role = "speaker";
      return broadcast(room);
    }

    case "vr_remove": {
      // Take someone out of the room; they can't come back to this room.
      if (!canManage) return fail("not_allowed");
      if (!target || !canActOn(target)) return fail("not_allowed");
      room.removed.add(target.userId);
      removeMember(room, target.userId, { notify: "vr_removed" });
      return;
    }

    case "vr_chat": {
      // Anyone in the room (audience too) can write in the room chat.
      const text = str(message?.text, 500);
      if (!text) return fail("empty");
      if (!room.chatOn && !canManage) return fail("chat_off");
      const act: any = await restrictionsOf(uid);
      if (act.message || act.comment) return fail("restricted");
      const last = lastChat.get(uid) || 0;
      if (Date.now() - last < 700) return fail("slow_down");
      lastChat.set(uid, Date.now());
      const msg: ChatMsg = {
        id: `c${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`,
        userId: uid,
        name: me.name,
        avatar: me.avatar,
        role: me.role,
        text,
        at: new Date().toISOString(),
      };
      room.chat.push(msg);
      if (room.chat.length > CHAT_KEEP) room.chat.splice(0, room.chat.length - CHAT_KEEP);
      for (const m of room.members.values()) toMember(m, { type: "vr_chat_msg", roomId: room.id, message: msg });
      return;
    }

    case "vr_chat_delete": {
      // The writer, the host or a moderator can take a chat message down.
      const id = str(message?.messageId, 60);
      const i = room.chat.findIndex((c) => c.id === id);
      if (i < 0) return fail("not_found");
      const c = room.chat[i];
      const author = room.members.get(c.userId);
      if (c.userId !== uid && !(canManage && (!author || canActOn(author) || c.userId === uid))) return fail("not_allowed");
      room.chat.splice(i, 1);
      for (const m of room.members.values()) toMember(m, { type: "vr_chat_deleted", roomId: room.id, messageId: id });
      return;
    }

    case "vr_react": {
      // A quick emoji reaction that floats up on everyone's screen (not saved).
      const emoji = str(message?.emoji, 8);
      if (!REACTIONS.includes(emoji)) return fail("unknown_reaction");
      const last = lastReact.get(uid) || 0;
      if (Date.now() - last < 400) return;
      lastReact.set(uid, Date.now());
      for (const m of room.members.values()) toMember(m, { type: "vr_reaction", roomId: room.id, userId: uid, emoji });
      return;
    }

    case "vr_chat_toggle": {
      // The host or a moderator turns the room chat on or off for the audience.
      if (!canManage) return fail("not_allowed");
      room.chatOn = !!message?.on;
      return broadcast(room);
    }

    case "vr_stage_limit": {
      // The host changes how many seats the stage has (2 to 20, never fewer than are on it now).
      if (!isHost) return fail("not_allowed");
      const n = clampStage(message?.limit);
      if (n < stageCount(room)) return fail("stage_has_more", { onStage: stageCount(room) });
      room.stageLimit = n;
      void db.execute(sql`UPDATE voice_rooms SET stage_limit = ${n} WHERE id = ${room.id}`).catch(() => {});
      return broadcast(room);
    }

    case "vr_end":
      if (!isHost) return fail("not_allowed");
      return void endRoom(room, "host_ended");

    case "vr_signal": {
      // WebRTC set-up between two people in this room; one of them must be on stage.
      if (!target || target.userId === uid) return fail("no_peer");
      if (!onStage(me.role) && !onStage(target.role)) return fail("no_peer");
      toMember(target, { type: "vr_signal", roomId: room.id, from: uid, key: str(message?.key, 200), data: message?.data ?? null });
      return;
    }

    default:
      return fail("unknown");
  }
}

// ------------------------------------------------------------------ http

function roomListOut(room: LiveRoom, host: any) {
  const c = counts(room);
  return {
    id: room.id,
    title: room.title,
    description: room.description,
    category: room.category,
    status: "live",
    isPrivate: room.isPrivate,
    hostId: room.hostId,
    hostName: host?.name || "Farmer",
    hostAvatar: host?.avatar || null,
    hostProfileRole: host?.profileRole || null,
    startedAt: new Date(room.startedAt).toISOString(),
    speakers: c.speakers,
    listeners: c.listeners,
    stageLimit: room.stageLimit,
    stage: [...room.members.values()].filter((m) => onStage(m.role)).slice(0, 4).map((m) => ({ userId: m.userId, name: m.name, avatar: m.avatar })),
  };
}

async function communityExists(id: string) {
  if (!id) return false;
  const r = rows(await db.execute(sql`SELECT 1 FROM communities WHERE id = ${id} LIMIT 1`));
  return r.length > 0;
}

async function startRoom(row: any) {
  const room = liveFromRow(row);
  live.set(room.id, room);
  await db.execute(sql`UPDATE voice_rooms SET status = 'live', started_at = now() WHERE id = ${room.id}`);
  armHostTimer(room, HOST_FIRST_JOIN_MS);
  return room;
}

async function shareToFeed(roomId: string, hostId: string, communityId: string, title: string, description: string, scheduledFor: string | null) {
  const line = scheduledFor ? "Voice room (scheduled)" : "Live voice room";
  const content = `🎙 ${line}: ${title}${description ? `\n${description}` : ""}`.slice(0, 2000);
  const r = rows(
    await db.execute(sql`INSERT INTO posts (community_id, author_id, content, media)
      VALUES (${communityId}, ${hostId}, ${content}, '[]'::jsonb) RETURNING id`),
  );
  const postId = r[0]?.id ? String(r[0].id) : null;
  if (postId) await db.execute(sql`UPDATE voice_rooms SET post_id = ${postId} WHERE id = ${roomId}`);
  return postId;
}

function idList(v: any, max: number) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => str(x, 80)).filter(Boolean))].slice(0, max);
}

export function registerVoiceRoomRoutes(app: Express) {
  const uidOf = (req: Request) => String((req as any).uid || "");

  app.get("/api/voice-rooms/permission", requireUser, wrap(async (req, res) => {
    const p = await canHost(uidOf(req));
    res.json({ canCreate: p.allowed, reason: p.reason, who: p.who, stageLimit: STAGE_LIMIT, stageMax: STAGE_MAX });
  }));

  // Live rooms (public ones, plus private ones you were invited to), and scheduled ones.
  app.get("/api/voice-rooms", requireUser, wrap(async (req, res) => {
    await ensureTables();
    const uid = uidOf(req);
    const category = str(req.query.category, 40);
    const out: any[] = [];
    for (const room of live.values()) {
      if (category && category !== "all" && room.category !== category) continue;
      if (room.isPrivate && room.hostId !== uid && !room.invitedSpeakers.has(uid) && !room.invitedModerators.has(uid) && !room.members.has(uid)) continue;
      const h = await person(room.hostId);
      out.push(roomListOut(room, h));
    }
    out.sort((a, b) => b.speakers + b.listeners - (a.speakers + a.listeners));
    const sch = rows(
      await db.execute(sql`SELECT v.*, u.name AS host_name, u.username AS host_username, u.avatar AS host_avatar, u.profile_role AS host_profile_role
        FROM voice_rooms v LEFT JOIN users u ON u.id = v.host_id
        WHERE v.status = 'scheduled' AND (v.is_private = false OR v.host_id = ${uid} OR v.speakers ? ${uid} OR v.moderators ? ${uid})
        ORDER BY v.scheduled_for ASC NULLS LAST LIMIT 30`),
    )
      .filter((r: any) => !category || category === "all" || r.category === category)
      .map((r: any) => cardFor(r, { name: r.host_name, username: r.host_username, avatar: r.host_avatar, profile_role: r.host_profile_role }));
    res.json({ rooms: out, scheduled: sch });
  }));

  app.get("/api/voice-rooms/:id", requireUser, wrap(async (req, res) => {
    await ensureTables();
    const r = rows(
      await db.execute(sql`SELECT v.*, u.name AS host_name, u.username AS host_username, u.avatar AS host_avatar, u.profile_role AS host_profile_role
        FROM voice_rooms v LEFT JOIN users u ON u.id = v.host_id WHERE v.id = ${str(req.params.id, 80)}`),
    )[0];
    if (!r) return res.status(404).json({ error: "This voice room doesn't exist." });
    res.json(cardFor(r, { name: r.host_name, username: r.host_username, avatar: r.host_avatar, profile_role: r.host_profile_role }));
  }));

  // The setup page's "Let's start!": make the room (now, or scheduled), and maybe share it to the feed.
  app.post("/api/voice-rooms", requireUser, wrap(async (req, res) => {
    await ensureTables();
    const uid = uidOf(req);
    const p = await canHost(uid);
    if (!p.allowed) return res.status(403).json({ error: "The admin hasn't allowed your account to start voice rooms.", code: "NOT_ALLOWED", reason: p.reason });
    const b = req.body || {};
    const title = str(b.title, 80);
    if (title.length < 3) return res.status(400).json({ error: "Give the room a name (at least 3 letters)." });
    const description = str(b.description, 400);
    const category = CATEGORIES.includes(str(b.category, 40)) ? str(b.category, 40) : "general";
    const isPrivate = !!b.isPrivate;
    const share = !!b.shareToFeed && !isPrivate;
    const communityId = str(b.communityId, 80);
    let scheduledFor: string | null = null;
    if (b.scheduledFor) {
      const t = new Date(String(b.scheduledFor)).getTime();
      if (!Number.isFinite(t)) return res.status(400).json({ error: "That start time isn't a real date." });
      if (t < Date.now() + 60_000) return res.status(400).json({ error: "Pick a start time in the future." });
      if (t > Date.now() + 60 * 86400000) return res.status(400).json({ error: "Pick a start time within the next 60 days." });
      scheduledFor = new Date(t).toISOString();
    }
    if (share) {
      if (!(await communityExists(communityId))) return res.status(400).json({ error: "Pick a community to share the room in." });
      const act: any = await restrictionsOf(uid);
      if (act.post) return res.status(403).json({ error: "The admin has stopped your account from posting in the community for now.", code: "RESTRICTED" });
    }
    // One live room per host at a time.
    if (!scheduledFor) {
      for (const room of live.values())
        if (room.hostId === uid) return res.status(409).json({ error: "You already have a live voice room.", code: "ALREADY_LIVE", roomId: room.id });
    }
    const stageLimit = clampStage(b.stageLimit ?? STAGE_LIMIT);
    const speakers = idList(b.speakers, STAGE_MAX - 1).filter((x) => x !== uid);
    const moderators = idList(b.moderators, STAGE_MAX - 1).filter((x) => x !== uid);
    const stageIds = [...new Set([...speakers, ...moderators])];
    if (stageIds.length > stageLimit - 1) return res.status(400).json({ error: `The stage has ${stageLimit} seats, you included. Pick fewer people or add seats.` });
    if (stageIds.length) {
      const found = rows(
        await db.execute(sql`SELECT id FROM users WHERE id IN (${sql.join(stageIds.map((i) => sql`${i}`), sql`, `)}) AND coalesce(banned, false) = false`),
      ).map((r: any) => String(r.id));
      if (found.length !== stageIds.length) return res.status(400).json({ error: "One of the people you picked can't join." });
    }
    const modSet = new Set(moderators);
    const spk = speakers.filter((x) => !modSet.has(x));
    const id = `vr-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
    await db.execute(sql`INSERT INTO voice_rooms (id, host_id, title, description, category, community_id, is_private, status, scheduled_for, speakers, moderators, stage_limit)
      VALUES (${id}, ${uid}, ${title}, ${description}, ${category}, ${communityId || null}, ${isPrivate}, ${scheduledFor ? "scheduled" : "live"},
        ${scheduledFor}, ${JSON.stringify(spk)}::jsonb, ${JSON.stringify(moderators)}::jsonb, ${stageLimit})`);
    let postId: string | null = null;
    if (share) postId = await shareToFeed(id, uid, communityId, title, description, scheduledFor);
    const row = rows(await db.execute(sql`SELECT * FROM voice_rooms WHERE id = ${id}`))[0];
    if (!scheduledFor) await startRoom(row);
    const me = await person(uid);
    const when = scheduledFor ? "scheduled" : "live";
    for (const pid of stageIds) {
      void notify(
        pid,
        "voice_room",
        modSet.has(pid) ? "You're a moderator in a voice room" : "You're invited to speak",
        `${me?.name || "Someone"} added you to the stage of "${title}" (${when}).`,
        { voiceRoomId: id },
      );
    }
    res.status(201).json({ id, status: scheduledFor ? "scheduled" : "live", postId, scheduledFor });
  }));

  // The host starts a scheduled room.
  app.post("/api/voice-rooms/:id/start", requireUser, wrap(async (req, res) => {
    await ensureTables();
    const uid = uidOf(req);
    const id = str(req.params.id, 80);
    const row = rows(await db.execute(sql`SELECT * FROM voice_rooms WHERE id = ${id}`))[0];
    if (!row) return res.status(404).json({ error: "This voice room doesn't exist." });
    if (String(row.host_id) !== uid) return res.status(403).json({ error: "Only the host can start this room." });
    if (live.has(id)) return res.json({ id, status: "live" });
    if (row.status !== "scheduled") return res.status(409).json({ error: "This room has already ended.", code: "ENDED" });
    for (const room of live.values())
      if (room.hostId === uid) return res.status(409).json({ error: "You already have a live voice room.", code: "ALREADY_LIVE", roomId: room.id });
    await startRoom(row);
    res.json({ id, status: "live" });
  }));

  // The host ends (or cancels a scheduled) room.
  app.post("/api/voice-rooms/:id/end", requireUser, wrap(async (req, res) => {
    await ensureTables();
    const uid = uidOf(req);
    const id = str(req.params.id, 80);
    const row = rows(await db.execute(sql`SELECT host_id, status FROM voice_rooms WHERE id = ${id}`))[0];
    if (!row) return res.status(404).json({ error: "This voice room doesn't exist." });
    if (String(row.host_id) !== uid) return res.status(403).json({ error: "Only the host can end this room." });
    const room = live.get(id);
    if (room) await endRoom(room, "host_ended");
    else await db.execute(sql`UPDATE voice_rooms SET status = 'ended', ended_at = now(), end_reason = 'host_cancelled' WHERE id = ${id} AND status <> 'ended'`);
    res.json({ ok: true });
  }));

  // ---------------- admin: who may start voice rooms
  const A = "/api/admin/manage/voice-rooms";

  async function adminView() {
    const who = await getWho();
    const hosts = rows(
      await db.execute(sql`SELECT h.user_id, h.created_at, u.name, u.username, u.email, u.avatar, u.profile_role
        FROM voice_room_hosts h JOIN users u ON u.id = h.user_id ORDER BY h.created_at DESC`),
    ).map((r: any) => ({
      id: String(r.user_id),
      name: r.name || r.username || "Farmer",
      username: r.username || "",
      email: r.email || "",
      avatar: r.avatar || null,
      profileRole: r.profile_role || null,
      addedAt: iso(r.created_at),
    }));
    const liveRooms: any[] = [];
    for (const room of live.values()) liveRooms.push(roomListOut(room, await person(room.hostId)));
    return { who, hosts, liveRooms, stageLimit: STAGE_LIMIT, stageMax: STAGE_MAX };
  }

  app.get(A, requireAdmin, wrap(async (_req, res) => {
    await ensureTables();
    res.json(await adminView());
  }));

  app.put(A, requireAdmin, wrap(async (req, res) => {
    await ensureTables();
    const who = str(req.body?.who, 20);
    if (!(WHO as readonly string[]).includes(who)) return res.status(400).json({ error: "Pick experts, selected or everyone." });
    await db.execute(sql`INSERT INTO voice_room_settings (key, value) VALUES ('who', ${who}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    await audit(req, "voice_rooms.who", "setting", "voice_rooms", { who });
    res.json(await adminView());
  }));

  app.put(`${A}/hosts/:userId`, requireAdmin, wrap(async (req, res) => {
    await ensureTables();
    const target = str(req.params.userId, 80);
    const u = await person(target);
    if (!u) return res.status(404).json({ error: "That account doesn't exist." });
    await db.execute(sql`INSERT INTO voice_room_hosts (user_id, added_by) VALUES (${target}, ${uidOf(req)}) ON CONFLICT (user_id) DO NOTHING`);
    await audit(req, "voice_rooms.host_add", "user", target, { name: u.name });
    res.json(await adminView());
  }));

  app.delete(`${A}/hosts/:userId`, requireAdmin, wrap(async (req, res) => {
    await ensureTables();
    const target = str(req.params.userId, 80);
    await db.execute(sql`DELETE FROM voice_room_hosts WHERE user_id = ${target}`);
    await audit(req, "voice_rooms.host_remove", "user", target, {});
    res.json(await adminView());
  }));

  app.post(`${A}/:id/end`, requireAdmin, wrap(async (req, res) => {
    const room = live.get(str(req.params.id, 80));
    if (!room) return res.status(404).json({ error: "That room isn't live." });
    await endRoom(room, "admin_ended");
    await audit(req, "voice_rooms.end", "voice_room", room.id, { title: room.title });
    res.json(await adminView());
  }));
}
