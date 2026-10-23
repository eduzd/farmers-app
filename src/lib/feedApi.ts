import { getApiUrl } from "@/lib/query-client";
import type { VoiceRoomCard } from "@/lib/voiceRoomApi";

export interface PostPollOption {
  /** "a", "b", "c" ... (shown as A, B, C) */
  id: string;
  text: string;
  votes: number;
}

/** A poll inside a community post: the title, the options and the vote counts. */
export interface PostPoll {
  question: string;
  options: PostPollOption[];
  totalVotes: number;
  /** The option the signed-in person voted for, or null. */
  myVote: string | null;
}

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;

export interface FeedPost {
  id: string;
  author: {
    id?: string;
    name: string;
    avatar: string;
    initials: string;
    avatarId?: string;
    avatarColor?: string;
    isWelfareMember?: boolean;
    /** Profile badge: farming category, or the role picked at sign-up. */
    badge?: string;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  views: number;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string;
  /** true when the post lives on the server and other members can see it */
  shared?: boolean;
  /** Set when the post is a poll. */
  poll?: PostPoll | null;
  /** Set when the post shares a voice room (live, scheduled or ended). */
  voiceRoom?: VoiceRoomCard | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_FOR_TYPE: Record<string, string> = { agriculture: "farmer", health: "health" };

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

export function timeAgo(iso: string, bn: boolean): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  const toBn = (n: number) => (bn ? String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : String(n));
  if (mins < 1) return bn ? "এইমাত্র" : "Just now";
  if (mins < 60) return bn ? `${toBn(mins)} মিনিট আগে` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return bn ? `${toBn(hrs)} ঘণ্টা আগে` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return bn ? `${toBn(days)} দিন আগে` : `${days}d ago`;
}

/** Finds the server-side id of the active community (local ids are slugs). */
export async function resolveServerCommunityId(local?: { id: string; slug?: string; type?: string } | null) {
  if (local?.id && UUID.test(local.id)) return local.id;
  const res = await fetch(`${getApiUrl()}/api/communities`);
  if (!res.ok) throw new Error(`communities ${res.status}`);
  const list: { id: string; slug: string }[] = await res.json();
  const wanted = local?.slug || SLUG_FOR_TYPE[local?.type || "agriculture"] || "farmer";
  return (list.find((c) => c.slug === wanted) ?? list.find((c) => c.slug === "farmer") ?? list[0])?.id ?? null;
}

interface ServerPostRow {
  id: string;
  content: string | null;
  media: string[] | null;
  createdAt: string;
  commentCount?: number | string | null;
  likeCount?: number | string | null;
  likedByMe?: boolean | null;
  savedByMe?: boolean | null;
  poll?: PostPoll | null;
  voiceRoom?: VoiceRoomCard | null;
  author: {
    id: string;
    name: string | null;
    avatar: string | null;
    profileRole?: string | null;
    farmingCategory?: string | null;
  } | null;
}

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function normalizePoll(p: any): PostPoll | null {
  if (!p || !Array.isArray(p.options) || !p.options.length) return null;
  const options = p.options.map((o: any) => ({ id: String(o.id), text: String(o.text ?? ""), votes: Number(o.votes || 0) }));
  return {
    question: String(p.question ?? ""),
    options,
    totalVotes: options.reduce((a: number, o: PostPollOption) => a + o.votes, 0),
    myVote: p.myVote ? String(p.myVote) : null,
  };
}

function postFromRow(r: ServerPostRow, bn: boolean): FeedPost {
  const name = r.author?.name || (bn ? "সদস্য" : "Member");
  const badge = r.author?.profileRole === "expert" ? "expert" : r.author?.farmingCategory || r.author?.profileRole || undefined;
  return {
    id: r.id,
    author: { id: r.author?.id, name, avatar: r.author?.avatar || "", initials: initialsOf(name), badge },
    content: r.content || "",
    image: r.media?.[0],
    likes: Number(r.likeCount || 0),
    comments: Number(r.commentCount || 0),
    views: 0,
    isLiked: !!r.likedByMe,
    isSaved: !!r.savedByMe,
    createdAt: timeAgo(r.createdAt, bn),
    shared: true,
    poll: normalizePoll(r.poll),
    voiceRoom: r.voiceRoom || null,
  };
}

export async function fetchServerPosts(communityId: string, bn: boolean, token?: string | null): Promise<FeedPost[]> {
  const res = await fetch(`${getApiUrl()}/api/posts?communityId=${encodeURIComponent(communityId)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`posts ${res.status}`);
  const rows: ServerPostRow[] = await res.json();
  return rows.map((r) => postFromRow(r, bn));
}

/** One shared post, e.g. to open it from a like/comment notification. */
export async function fetchServerPost(postId: string, bn: boolean, token?: string | null): Promise<FeedPost> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`post ${res.status}`);
  return postFromRow(await res.json(), bn);
}

/** Like or unlike a shared post. The author gets a notification for a new like. */
export async function likeServerPost(token: string, postId: string, liked: boolean): Promise<{ liked: boolean; likes: number }> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ liked }),
  });
  if (!res.ok) throw new Error(`like ${res.status}`);
  return res.json();
}

async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json();
    if (j?.error) return String(j.error);
  } catch {}
  return fallback;
}

/** Save or unsave a shared post for the signed-in user. Throws if the server didn't store it. */
export async function setServerPostSaved(token: string, postId: string, saved: boolean): Promise<boolean> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ saved }),
  });
  if (!res.ok) throw new Error(await errorText(res, `save ${res.status}`));
  return !!(await res.json()).saved;
}

/** The signed-in user's saved posts, newest save first. */
export async function fetchSavedPosts(token: string, bn: boolean): Promise<FeedPost[]> {
  const res = await fetch(`${getApiUrl()}/api/me/saved-posts`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await errorText(res, `saved ${res.status}`));
  const rows: ServerPostRow[] = await res.json();
  return rows.map((r) => postFromRow(r, bn));
}

/** Delete your own post. The server refuses (403) for anyone else's post. */
export async function deleteServerPost(token: string, postId: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error(await errorText(res, `delete ${res.status}`));
}

/** Edit the text of your own post. */
export async function editServerPost(token: string, postId: string, content: string): Promise<string> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(await errorText(res, `edit ${res.status}`));
  return String((await res.json()).content ?? content);
}

/** Report someone else's post. Resolves with alreadyReported=true if you had reported it before. */
export async function reportServerPost(token: string, postId: string, reason: string, details?: string): Promise<{ alreadyReported: boolean }> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ reason, details }),
  });
  if (!res.ok) throw new Error(await errorText(res, `report ${res.status}`));
  const j = await res.json();
  return { alreadyReported: !!j.alreadyReported };
}

/** Mute or block someone (on=true), or undo it (on=false). */
export async function setUserRelation(token: string, kind: "mute" | "block", targetId: string, on: boolean): Promise<void> {
  const res = on
    ? await fetch(`${getApiUrl()}/api/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ kind, targetId }),
      })
    : await fetch(`${getApiUrl()}/api/relations/${kind}/${encodeURIComponent(targetId)}`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error(await errorText(res, `${kind} ${res.status}`));
}

export interface ServerComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  avatar: string | null;
  body: string;
  createdAt: string;
}

export async function fetchServerComments(postId: string): Promise<ServerComment[]> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}/comments`);
  if (!res.ok) throw new Error(`comments ${res.status}`);
  return res.json();
}

/** Adds a comment in your name. The post's author gets a notification. */
export async function createServerComment(token: string, postId: string, body: string): Promise<ServerComment> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`comment ${res.status}`);
  return res.json();
}

/** True for posts that live on the server (ids are UUIDs). */
export function isSharedPostId(id: string): boolean {
  return UUID.test(id);
}

export async function createServerPost(
  token: string,
  communityId: string,
  content: string,
  media: string[],
  poll?: { question: string; options: string[] } | null,
) {
  const res = await fetch(`${getApiUrl()}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(poll ? { communityId, content, media, poll } : { communityId, content, media }),
  });
  if (!res.ok) {
    const err: any = new Error(await errorText(res, `create post ${res.status}`));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Vote on a poll post (voting again moves your vote). Returns the poll with fresh counts. */
export async function voteServerPoll(token: string, postId: string, optionId: string): Promise<PostPoll> {
  const res = await fetch(`${getApiUrl()}/api/posts/${encodeURIComponent(postId)}/poll/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ optionId }),
  });
  if (!res.ok) throw new Error(await errorText(res, `vote ${res.status}`));
  const poll = normalizePoll((await res.json()).poll);
  if (!poll) throw new Error("vote");
  return poll;
}
