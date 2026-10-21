import { getApiUrl } from "@/lib/query-client";

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

export async function fetchServerPosts(communityId: string, bn: boolean): Promise<FeedPost[]> {
  const res = await fetch(`${getApiUrl()}/api/posts?communityId=${encodeURIComponent(communityId)}`);
  if (!res.ok) throw new Error(`posts ${res.status}`);
  const rows: {
    id: string;
    content: string | null;
    media: string[] | null;
    createdAt: string;
    author: { id: string; name: string | null; avatar: string | null } | null;
  }[] = await res.json();
  return rows.map((r) => {
    const name = r.author?.name || (bn ? "সদস্য" : "Member");
    return {
      id: r.id,
      author: { id: r.author?.id, name, avatar: r.author?.avatar || "", initials: initialsOf(name) },
      content: r.content || "",
      image: r.media?.[0],
      likes: 0,
      comments: 0,
      views: 0,
      isLiked: false,
      isSaved: false,
      createdAt: timeAgo(r.createdAt, bn),
      shared: true,
    };
  });
}

export async function createServerPost(token: string, communityId: string, content: string, media: string[]) {
  const res = await fetch(`${getApiUrl()}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ communityId, content, media }),
  });
  if (!res.ok) throw new Error(`create post ${res.status}`);
  return res.json();
}
