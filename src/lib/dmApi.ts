/**
 * Direct messages, voice messages and the Call button's contact lookup.
 * Every call needs the signed-in token; the server checks that only the two
 * people in a conversation can read it, send in it, or play its voice messages.
 */
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";

export interface DmMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  kind: "text" | "voice";
  mediaId: string | null;
  durationMs: number | null;
  createdAt: string;
  readAt: string | null;
  isMe: boolean;
}

export interface DmPage {
  otherId: string | null;
  hasAccount: boolean;
  messages: DmMessage[];
  seenUntil: string | null;
}

export interface DmContact {
  userId: string;
  name: string;
  phone: string | null;
  phoneSource: "store" | "profile" | null;
}

export class DmError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TIMEOUT_MS = 20000;
const VOICE_TIMEOUT_MS = 60000;

function token(): string | null {
  return useAuthStore.getState().getToken();
}

function url(path: string) {
  return new URL(path, getApiUrl()).toString();
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<T> {
  const t = token();
  if (!t) throw new DmError("Please sign in first", 401, "SIGNED_OUT");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url(path), {
      method,
      headers: { Authorization: `Bearer ${t}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new DmError("No connection. Check your internet and try again.", 0, "OFFLINE");
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new DmError(data?.error || "Something went wrong", res.status, data?.code);
  return data as T;
}

const enc = encodeURIComponent;

export function fetchMessages(otherId: string, since?: string | null): Promise<DmPage> {
  const q = since ? `&since=${enc(since)}` : "";
  return request<DmPage>("GET", `/api/dm/${enc(otherId)}/messages?withMeta=1${q}`);
}

export function sendText(otherId: string, content: string, clientId: string): Promise<DmMessage> {
  return request<DmMessage>("POST", `/api/dm/${enc(otherId)}/messages`, { content, clientId });
}

export interface DmReaction {
  messageId: string;
  userId: string;
  emoji: string | null;
  super: boolean;
}

/** Set (or change) my reaction on a message. `isSuper` is the tap-and-hold super reaction. */
export function setReaction(messageId: string, emoji: string, isSuper: boolean): Promise<DmReaction> {
  return request<DmReaction>("PUT", `/api/dm/messages/${enc(messageId)}/reaction`, { emoji, super: isSuper });
}

export function clearReaction(messageId: string): Promise<DmReaction> {
  return request<DmReaction>("DELETE", `/api/dm/messages/${enc(messageId)}/reaction`);
}

export function fetchReactions(ids: string[]): Promise<DmReaction[]> {
  return request<DmReaction[]>("POST", `/api/dm/reactions`, { ids });
}

export function fetchContact(otherId: string): Promise<DmContact> {
  return request<DmContact>("GET", `/api/dm/${enc(otherId)}/contact`);
}

export function fetchUnreadTotal(): Promise<{ total: number }> {
  return request<{ total: number }>("GET", "/api/dm/unread");
}

/** Save name/phone on the server so other people can see who they're talking to and call them. */
export function saveProfileToServer(p: { name?: string; phone?: string }): Promise<unknown> {
  return request("PUT", "/api/me/profile", p);
}

export function newClientId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function guessMime(uri: string): string {
  const u = uri.toLowerCase().split("?")[0];
  if (u.endsWith(".webm")) return "audio/webm";
  if (u.endsWith(".ogg")) return "audio/ogg";
  if (u.endsWith(".3gp")) return "audio/3gpp";
  if (u.endsWith(".aac")) return "audio/aac";
  if (u.endsWith(".wav")) return "audio/wav";
  return "audio/mp4"; // .m4a / .mp4 from the phone recorder
}

/** Upload a finished recording (a file on the phone, or a blob: URL in a browser). */
export async function sendVoice(otherId: string, recordingUri: string, durationMs: number, clientId: string): Promise<DmMessage> {
  let audio: string;
  let mime: string;
  if (Platform.OS === "web") {
    const blob = await (await fetch(recordingUri)).blob();
    mime = (blob.type || "audio/webm").split(";")[0];
    audio = await blobToDataUrl(blob);
  } else {
    mime = guessMime(recordingUri);
    audio = await FileSystem.readAsStringAsync(recordingUri, { encoding: FileSystem.EncodingType.Base64 });
  }
  return request<DmMessage>("POST", `/api/dm/${enc(otherId)}/voice`, { audio, mime, durationMs: Math.round(durationMs), clientId }, VOICE_TIMEOUT_MS);
}

const playable = new Map<string, string>();

/**
 * Get something the audio player can open for a voice message. The file needs the
 * sign-in token, so it is downloaded once (phone cache folder, or a blob in the browser)
 * and reused after that.
 */
export async function voicePlaybackUri(mediaId: string): Promise<string> {
  const known = playable.get(mediaId);
  if (known) return known;
  const t = token();
  if (!t) throw new DmError("Please sign in first", 401);
  const src = url(`/api/dm/media/${enc(mediaId)}`);
  if (Platform.OS === "web") {
    const res = await fetch(src, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) throw new DmError("Couldn't load the voice message", res.status);
    const objectUrl = URL.createObjectURL(await res.blob());
    playable.set(mediaId, objectUrl);
    return objectUrl;
  }
  const dir = `${FileSystem.cacheDirectory}voice/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const safe = mediaId.replace(/[^A-Za-z0-9_-]/g, "");
  // iPhones pick the decoder from the file extension, so keep the right one.
  for (const ext of Object.values(EXT)) {
    const p = `${dir}${safe}.${ext}`;
    const info = await FileSystem.getInfoAsync(p);
    if (info.exists && (info as any).size) {
      playable.set(mediaId, p);
      return p;
    }
  }
  const tmp = `${dir}${safe}.part`;
  const r = await FileSystem.downloadAsync(src, tmp, { headers: { Authorization: `Bearer ${t}` } });
  if (r.status !== 200) {
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    throw new DmError("Couldn't load the voice message", r.status);
  }
  const type = String(r.mimeType || r.headers?.["Content-Type"] || r.headers?.["content-type"] || "audio/mp4").split(";")[0].trim();
  const target = `${dir}${safe}.${EXT[type] || "m4a"}`;
  await FileSystem.moveAsync({ from: tmp, to: target });
  playable.set(mediaId, target);
  return target;
}

const EXT: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/3gpp": "3gp",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** Remember where my own just-sent recording is, so I can play it without downloading. */
export function rememberLocalVoice(mediaId: string, uri: string) {
  if (mediaId && uri) playable.set(mediaId, uri);
}

/** Small event bus: the live socket announces new messages, open chats refresh at once. */
type DmListener = (m: DmMessage) => void;
const listeners = new Set<DmListener>();
export function onLiveDm(fn: DmListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emitLiveDm(m: DmMessage) {
  listeners.forEach((fn) => {
    try {
      fn(m);
    } catch {}
  });
}

/** Same for reactions: the socket's { type: "dm_reaction" } reaches the open chat at once. */
type ReactionListener = (r: DmReaction) => void;
const reactionListeners = new Set<ReactionListener>();
export function onLiveReaction(fn: ReactionListener): () => void {
  reactionListeners.add(fn);
  return () => reactionListeners.delete(fn);
}
export function emitLiveReaction(r: DmReaction) {
  reactionListeners.forEach((fn) => {
    try {
      fn(r);
    } catch {}
  });
}
