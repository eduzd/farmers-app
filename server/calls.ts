// In-app voice calls (WebRTC).
//
// The server never carries the sound. It only passes the call set-up messages (offer,
// answer, network candidates) between the two people on a call over the signed-in
// /ws/chat socket. The sound itself goes phone to phone, directly or through a TURN
// relay when one is configured.
//
// Rules:
//  - only a signed-in socket can call, and the caller's name comes from the database;
//  - the person called must be a real user, not yourself;
//  - one call at a time per person (someone already on a call is "busy");
//  - at most 8 new calls per person per minute;
//  - set-up messages go only to the other person on that same call;
//  - unanswered calls stop after 45 seconds; a phone with the app in the background
//    gets a push notification and still receives the call when it reconnects.
import type { Express, Request, Response, NextFunction } from "express";
import type { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { sendPush } from "./push";

type SendToUser = (userId: string, message: any, except?: WebSocket) => boolean;

interface Call {
  callId: string;
  callerId: string;
  calleeId: string;
  callerName: string;
  callerAvatar: string | null;
  calleeName: string;
  status: "ringing" | "connected";
  createdAt: number;
  answeredAt?: number;
  acked: boolean;
  ringTimer?: ReturnType<typeof setTimeout>;
  pushTimer?: ReturnType<typeof setTimeout>;
  goneTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export const RING_TIMEOUT_MS = Number(process.env.CALL_RING_TIMEOUT_MS || 45000);
const RECONNECT_GRACE_MS = Number(process.env.CALL_RECONNECT_GRACE_MS || 20000);
const PUSH_IF_NO_ACK_MS = 2500;
const MAX_CALLS_PER_MINUTE = 8;

const calls = new Map<string, Call>();
const recent = new Map<string, number[]>();
let send: SendToUser = () => false;
let online: (userId: string) => boolean = () => false;

export function initCalls(deps: { sendToUser: SendToUser; userOnline: (userId: string) => boolean }) {
  send = deps.sendToUser;
  online = deps.userOnline;
}

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);

async function lookupUser(id: string): Promise<{ id: string; name: string; avatar: string | null; admin: boolean } | null> {
  if (!db) return null;
  try {
    const r = rowsOf(await db.execute(sql`SELECT id, name, username, avatar, is_super_admin, banned FROM users WHERE id::text = ${id} LIMIT 1`))[0];
    if (!r) return null;
    return { id: String(r.id), name: String(r.name || r.username || "Member").slice(0, 80), avatar: r.avatar || null, admin: !!r.is_super_admin && !r.banned };
  } catch {
    return null;
  }
}

function callOf(userId: string): Call | undefined {
  for (const c of calls.values()) if (c.callerId === userId || c.calleeId === userId) return c;
  return undefined;
}

function peerOf(call: Call, userId: string): string | null {
  if (call.callerId === userId) return call.calleeId;
  if (call.calleeId === userId) return call.callerId;
  return null;
}

function clearTimers(call: Call) {
  if (call.ringTimer) clearTimeout(call.ringTimer);
  if (call.pushTimer) clearTimeout(call.pushTimer);
  for (const t of call.goneTimers.values()) clearTimeout(t);
  call.goneTimers.clear();
}

function finish(call: Call, reason: string, opts: { notifyCaller?: any; notifyCallee?: any; except?: WebSocket } = {}) {
  clearTimers(call);
  calls.delete(call.callId);
  const base = { callId: call.callId, reason };
  send(call.callerId, opts.notifyCaller ?? { type: "call_ended", ...base }, opts.except);
  send(call.calleeId, opts.notifyCallee ?? { type: "call_ended", ...base }, opts.except);
  if (call.status === "ringing" && reason !== "declined") {
    void sendPush(call.calleeId, "Missed voice call", `${call.callerName} called you`, {
      type: "missed_call",
      callerId: call.callerId,
    }).catch(() => {});
  }
}

function incomingPayload(call: Call) {
  return {
    type: "incoming_call",
    callId: call.callId,
    callerId: call.callerId,
    callerName: call.callerName,
    callerAvatar: call.callerAvatar,
    expiresInMs: Math.max(0, RING_TIMEOUT_MS - (Date.now() - call.createdAt)),
  };
}

/** A socket just signed in: hand it any call that is still ringing for this person. */
export function onCallClientAuthed(userId: string, ws: WebSocket) {
  for (const call of calls.values()) {
    const gone = call.goneTimers.get(userId);
    if (gone) {
      clearTimeout(gone);
      call.goneTimers.delete(userId);
    }
    if (call.calleeId === userId && call.status === "ringing" && ws.readyState === 1) {
      ws.send(JSON.stringify(incomingPayload(call)));
    }
  }
}

/** All of this person's sockets are gone. Give them a short grace period to come back. */
export function onCallClientGone(userId: string) {
  if (online(userId)) return;
  for (const call of [...calls.values()]) {
    if (call.callerId !== userId && call.calleeId !== userId) continue;
    // A ringing phone that went to the background keeps ringing (it gets a push).
    if (call.status === "ringing" && call.calleeId === userId) continue;
    if (call.goneTimers.has(userId)) continue;
    call.goneTimers.set(
      userId,
      setTimeout(() => {
        call.goneTimers.delete(userId);
        if (calls.get(call.callId) !== call || online(userId)) return;
        finish(call, "peer_disconnected");
      }, call.status === "ringing" ? 5000 : RECONNECT_GRACE_MS),
    );
  }
}

/** Returns true when the message was a call message. */
export async function handleCallMessage(
  uid: string,
  ws: WebSocket,
  message: any,
  reply: (m: any) => void,
): Promise<boolean> {
  const type = String(message?.type || "");
  switch (type) {
    case "call_initiate": {
      const calleeId = String(message.calleeId || "").slice(0, 64);
      const clientRef = String(message.clientRef || "").slice(0, 64);
      if (!calleeId || calleeId === uid) {
        reply({ type: "call_failed", reason: "invalid_user", clientRef });
        return true;
      }
      const now = Date.now();
      const list = (recent.get(uid) || []).filter((t) => now - t < 60000);
      if (list.length >= MAX_CALLS_PER_MINUTE) {
        reply({ type: "call_failed", reason: "rate_limited", clientRef });
        return true;
      }
      list.push(now);
      recent.set(uid, list);
      const mine = callOf(uid);
      if (mine) {
        // A leftover call of mine (for example from a phone that lost signal) is ended first.
        finish(mine, "replaced");
      }
      const [caller, callee] = await Promise.all([lookupUser(uid), lookupUser(calleeId)]);
      if (!caller || !callee) {
        reply({ type: "call_failed", reason: "invalid_user", clientRef });
        return true;
      }
      if (callOf(calleeId)) {
        reply({ type: "call_failed", reason: "busy", clientRef });
        return true;
      }
      // Support calls (from the Support chat): a Farmers admin calling a user back shows as "Farmers Support";
      // a user calling Support shows their name with "Support call" on the admin's phone. Only checked roles count.
      let callerName = caller.name;
      let callerAvatar = caller.avatar;
      let calleeName = callee.name;
      if (message.support === true) {
        if (caller.admin) {
          callerName = "Farmers Support";
          callerAvatar = null;
        } else if (callee.admin) {
          callerName = `Support call · ${caller.name}`.slice(0, 80);
          calleeName = "Farmers Support";
        }
      }
      const call: Call = {
        callId: `call-${crypto.randomUUID()}`,
        callerId: uid,
        calleeId,
        callerName,
        callerAvatar,
        calleeName,
        status: "ringing",
        createdAt: now,
        acked: false,
        goneTimers: new Map(),
      };
      calls.set(call.callId, call);
      call.ringTimer = setTimeout(() => {
        if (calls.get(call.callId) === call && call.status === "ringing") finish(call, "no_answer");
      }, RING_TIMEOUT_MS);
      const delivered = send(calleeId, incomingPayload(call));
      // If no phone of theirs shows the call quickly, wake them with a push notification.
      call.pushTimer = setTimeout(
        () => {
          if (calls.get(call.callId) !== call || call.acked || call.status !== "ringing") return;
          void sendPush(calleeId, "Incoming voice call", `${call.callerName} is calling you. Open Farmers to answer.`, {
            type: "incoming_call",
            callId: call.callId,
            callerId: uid,
          }).catch(() => {});
        },
        delivered ? PUSH_IF_NO_ACK_MS : 0,
      );
      reply({
        type: "call_ringing",
        callId: call.callId,
        calleeId,
        calleeName,
        calleeAvatar: callee.avatar,
        calleeOnline: delivered,
        clientRef,
      });
      return true;
    }

    case "call_ack": {
      const call = calls.get(String(message.callId || ""));
      if (call && call.calleeId === uid) call.acked = true;
      return true;
    }

    case "call_accept": {
      const call = calls.get(String(message.callId || ""));
      if (!call || call.calleeId !== uid) {
        reply({ type: "call_ended", callId: message.callId, reason: "gone" });
        return true;
      }
      if (call.status !== "ringing") return true;
      call.status = "connected";
      call.answeredAt = Date.now();
      call.acked = true;
      if (call.ringTimer) clearTimeout(call.ringTimer);
      if (call.pushTimer) clearTimeout(call.pushTimer);
      send(call.callerId, { type: "call_accepted", callId: call.callId });
      // The callee's other phones/tabs stop ringing.
      send(uid, { type: "call_answered_elsewhere", callId: call.callId }, ws);
      return true;
    }

    case "call_reject": {
      const call = calls.get(String(message.callId || ""));
      if (!call || call.calleeId !== uid) return true;
      finish(call, "declined", {
        notifyCaller: { type: "call_rejected", callId: call.callId, reason: "declined" },
      });
      return true;
    }

    case "call_end": {
      const call = calls.get(String(message.callId || ""));
      if (!call || !peerOf(call, uid)) return true;
      finish(call, call.status === "ringing" && call.callerId === uid ? "cancelled" : "hangup");
      return true;
    }

    case "webrtc_offer":
    case "webrtc_answer":
    case "webrtc_ice_candidate": {
      const call = calls.get(String(message.callId || ""));
      if (!call || call.status !== "connected") return true;
      const peer = peerOf(call, uid);
      if (!peer) return true;
      if (message.targetUserId && String(message.targetUserId) !== peer) return true;
      const payload: any = { type, callId: call.callId, fromUserId: uid };
      if (type === "webrtc_offer") payload.offer = message.offer;
      if (type === "webrtc_answer") payload.answer = message.answer;
      if (type === "webrtc_ice_candidate") payload.candidate = message.candidate;
      // Keep the relayed payload small; real SDPs are a few KB.
      if (JSON.stringify(payload).length > 64 * 1024) return true;
      send(peer, payload);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// ICE servers: STUN is always there. A TURN relay (needed when both phones sit behind
// strict mobile-carrier networks) is used when configured on the server:
//   TURN_URLS=turn:host:3478,turns:host:5349  TURN_USERNAME=...  TURN_CREDENTIAL=...
// or Cloudflare TURN: CLOUDFLARE_TURN_KEY_ID=...  CLOUDFLARE_TURN_API_TOKEN=...
// ---------------------------------------------------------------------------
function authUser(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Please sign in" });
  try {
    const d = jwt.verify(h.slice(7), config.jwtSecret) as any;
    if (!d?.userId) throw new Error("no user");
    (req as any).callUserId = String(d.userId);
    next();
  } catch {
    res.status(401).json({ error: "Please sign in" });
  }
}

let cfCache: { at: number; servers: any[] } | null = null;

async function cfPost(path: string, keyId: string, token: string): Promise<any[]> {
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: 12 * 3600 }),
  });
  if (!r.ok) {
    console.warn("[calls] Cloudflare TURN credentials failed:", r.status);
    return [];
  }
  const j: any = await r.json().catch(() => null);
  const ice = j?.iceServers;
  return Array.isArray(ice) ? ice : ice ? [ice] : [];
}

/** Cloudflare TURN (free for the first 1,000 GB a month). Port 53 addresses are dropped:
 *  many phones and networks block them and they only slow the connection down. */
async function cloudflareTurn(): Promise<any[]> {
  const keyId = (process.env.CLOUDFLARE_TURN_KEY_ID || "").trim();
  const token = (process.env.CLOUDFLARE_TURN_API_TOKEN || "").trim();
  if (!keyId || !token) return [];
  if (cfCache && Date.now() - cfCache.at < 6 * 3600 * 1000) return cfCache.servers;
  try {
    let servers = await cfPost("generate-ice-servers", keyId, token);
    if (!servers.length) servers = await cfPost("generate", keyId, token);
    servers = servers
      .map((s: any) => ({ ...s, urls: [].concat(s.urls || s.url || []).filter((u: string) => !/:53(\?|$)/.test(u)) }))
      .filter((s: any) => s.urls.length && s.urls.some((u: string) => /^turns?:/.test(u)));
    if (servers.length) cfCache = { at: Date.now(), servers };
    return servers;
  } catch (e: any) {
    console.warn("[calls] Cloudflare TURN credentials failed:", e?.message || e);
    return [];
  }
}

/** Which relay is set up (no secrets), for /api/health. */
export function turnStatus(): string {
  if (process.env.CLOUDFLARE_TURN_KEY_ID && process.env.CLOUDFLARE_TURN_API_TOKEN) return "cloudflare";
  if (process.env.TURN_URLS && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) return "custom";
  return "none";
}

export async function iceServers(): Promise<{ iceServers: any[]; turn: boolean }> {
  const list: any[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const urls = (process.env.TURN_URLS || "").split(",").map((s) => s.trim()).filter(Boolean);
  let turn = false;
  if (urls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    list.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
    turn = true;
  }
  const cf = await cloudflareTurn();
  if (cf.length) {
    list.push(...cf);
    turn = true;
  }
  return { iceServers: list, turn };
}

export function registerCallRoutes(app: Express) {
  app.get("/api/calls/ice-servers", authUser, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await iceServers());
  });
}
