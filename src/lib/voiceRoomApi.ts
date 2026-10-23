// Voice rooms over HTTP (list, setup page, permission). The live room itself goes over the
// chat socket: see src/lib/voiceRoom/useVoiceRoom.ts and server/voiceRooms.ts.
import { apiGet, apiPost } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";

/** An error from the server that keeps its code (and the live room id for ALREADY_LIVE). */
export class VoiceRoomError extends Error {
  code?: string;
  roomId?: string;
  status: number;
  constructor(message: string, status: number, code?: string, roomId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.roomId = roomId;
  }
}

async function post<T>(path: string, body: any): Promise<T> {
  const token = useAuthStore.getState().token;
  const r = await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new VoiceRoomError(data?.error || `HTTP ${r.status}`, r.status, data?.code, data?.roomId);
  return data as T;
}

export type VoiceRole = "host" | "moderator" | "speaker" | "audience";
export const onStage = (r: VoiceRole) => r !== "audience";

export interface VoiceRoomCard {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "live" | "scheduled" | "ended";
  isPrivate: boolean;
  scheduledFor?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  hostId: string;
  hostName: string;
  hostAvatar: string | null;
  hostProfileRole?: string | null;
  speakers: number;
  listeners: number;
  stageLimit?: number;
  stage: { userId: string; name: string; avatar: string | null }[];
}

export interface VoiceMember {
  userId: string;
  name: string;
  avatar: string | null;
  profileRole: string | null;
  role: VoiceRole;
  muted: boolean;
  hand: boolean;
  handAt: number;
  invitedToStage: boolean;
  online: boolean;
  epoch: number;
}

export interface VoiceRoomState {
  id: string;
  hostId: string;
  title: string;
  description: string;
  category: string;
  isPrivate: boolean;
  postId: string | null;
  startedAt: string;
  stageLimit: number;
  stageShown: number;
  stageMax: number;
  roomLimit: number;
  chatOn: boolean;
  members: VoiceMember[];
}

export interface VoiceChatMessage {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  role: VoiceRole;
  text: string;
  at: string;
}

export const VOICE_CATEGORIES: { id: string; en: string; bn: string; icon: string }[] = [
  { id: "general", en: "General", bn: "সাধারণ", icon: "message-circle" },
  { id: "crop", en: "Crops", bn: "ফসল", icon: "sun" },
  { id: "livestock", en: "Livestock", bn: "গবাদি পশু", icon: "heart" },
  { id: "fishery", en: "Fishery", bn: "মৎস্য", icon: "droplet" },
  { id: "poultry", en: "Poultry", bn: "হাঁস-মুরগি", icon: "feather" },
  { id: "market", en: "Market", bn: "বাজার", icon: "trending-up" },
  { id: "health", en: "Health", bn: "স্বাস্থ্য", icon: "activity" },
  { id: "weather", en: "Weather", bn: "আবহাওয়া", icon: "cloud" },
];

export const REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F44F}", "\u{1F602}", "\u{1F64F}", "\u{1F525}", "\u{1F33E}"];

export async function fetchVoicePermission(): Promise<{ canCreate: boolean; reason: string; who: string; stageLimit: number; stageMax: number }> {
  return apiGet("/api/voice-rooms/permission");
}

export async function fetchVoiceRooms(category?: string): Promise<{ rooms: VoiceRoomCard[]; scheduled: VoiceRoomCard[] }> {
  const q = category && category !== "all" ? `?category=${encodeURIComponent(category)}` : "";
  return apiGet(`/api/voice-rooms${q}`);
}

export async function fetchVoiceRoom(id: string): Promise<VoiceRoomCard> {
  return apiGet(`/api/voice-rooms/${encodeURIComponent(id)}`);
}

export interface CreateVoiceRoomInput {
  title: string;
  description: string;
  category: string;
  isPrivate: boolean;
  shareToFeed: boolean;
  communityId?: string | null;
  scheduledFor?: string | null;
  stageLimit: number;
  speakers: string[];
  moderators: string[];
}

export async function createVoiceRoom(input: CreateVoiceRoomInput): Promise<{ id: string; status: "live" | "scheduled"; postId: string | null }> {
  return post("/api/voice-rooms", input);
}

export async function startScheduledVoiceRoom(id: string) {
  return post<{ id: string; status: string }>(`/api/voice-rooms/${encodeURIComponent(id)}/start`, {});
}

export async function endVoiceRoom(id: string) {
  return apiPost(`/api/voice-rooms/${encodeURIComponent(id)}/end`, {});
}

export function voiceCategoryLabel(id: string, bn: boolean) {
  const c = VOICE_CATEGORIES.find((x) => x.id === id);
  return c ? (bn ? c.bn : c.en) : id;
}

export function formatRoomTime(isoText: string | null | undefined, bn: boolean) {
  if (!isoText) return "";
  const d = new Date(isoText);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString(bn ? "bn-BD" : "en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `${bn ? "আজ" : "Today"}, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `${bn ? "আগামীকাল" : "Tomorrow"}, ${time}`;
  return `${d.toLocaleDateString(bn ? "bn-BD" : "en-US", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

/** Words for the reasons the server gives (vr_error / HTTP codes). */
export function voiceReasonText(reason: string, bn: boolean): string {
  const t: Record<string, [string, string]> = {
    not_found: ["This voice room doesn't exist.", "এই ভয়েস রুমটি নেই।"],
    ended: ["This voice room has ended.", "এই ভয়েস রুমটি শেষ হয়ে গেছে।"],
    not_started: ["This room hasn't started yet.", "এই রুমটি এখনো শুরু হয়নি।"],
    removed: ["The host removed you from this room.", "হোস্ট আপনাকে এই রুম থেকে সরিয়ে দিয়েছেন।"],
    private: ["This is a private room. Only people the host added can join.", "এটি প্রাইভেট রুম। শুধু হোস্টের যোগ করা মানুষ যোগ দিতে পারেন।"],
    full: ["This room is full.", "এই রুমটি ভর্তি।"],
    not_allowed: ["You can't do that here.", "এখানে এটি করা যাবে না।"],
    stage_full: ["The stage is full. Add a seat or move someone to the audience.", "মঞ্চ ভর্তি। আসন বাড়ান বা কাউকে শ্রোতাদের মধ্যে পাঠান।"],
    stage_has_more: ["More people are on the stage than that. Move someone off first.", "মঞ্চে এর চেয়ে বেশি মানুষ আছেন। আগে কাউকে নামান।"],
    chat_off: ["The host turned the chat off.", "হোস্ট চ্যাট বন্ধ করেছেন।"],
    restricted: ["The admin has stopped your account from sending messages for now.", "অ্যাডমিন আপাতত আপনার বার্তা পাঠানো বন্ধ রেখেছেন।"],
    slow_down: ["Slow down a little.", "একটু ধীরে।"],
    offline: ["You're offline. Reconnecting…", "আপনি অফলাইনে। আবার যুক্ত হচ্ছে…"],
    host_left: ["The host left, so the room ended.", "হোস্ট চলে গেছেন, তাই রুম শেষ।"],
    host_ended: ["The host ended the room.", "হোস্ট রুমটি শেষ করেছেন।"],
    admin_ended: ["An admin ended the room.", "অ্যাডমিন রুমটি শেষ করেছেন।"],
    joined_elsewhere: ["You joined this room on another device.", "আপনি অন্য ডিভাইসে এই রুমে যোগ দিয়েছেন।"],
    mic_denied: ["Allow the microphone so others can hear you.", "অন্যরা যেন শুনতে পায়, মাইক্রোফোনের অনুমতি দিন।"],
  };
  const v = t[reason];
  return v ? (bn ? v[1] : v[0]) : bn ? "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।" : "Something went wrong. Try again.";
}
