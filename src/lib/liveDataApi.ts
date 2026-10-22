import { apiGet, apiPost } from "./api";
import { initialsOf, timeAgo, type FeedPost } from "./feedApi";

/** A person as the server shows them to everyone (no email or phone). */
export interface PersonCard {
  id: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  profileRole: string | null;
  farmingCategory: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export function searchPeople(q: string, category = "all"): Promise<PersonCard[]> {
  return apiGet<PersonCard[]>(`/api/users/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`);
}

export function fetchLikers(postId: string): Promise<PersonCard[]> {
  return apiGet<PersonCard[]>(`/api/posts/${encodeURIComponent(postId)}/likers`);
}

/** Follow or unfollow; the server answers with the new state. */
export async function toggleFollow(userId: string): Promise<boolean> {
  const r = await apiPost<{ following: boolean }>(`/api/follows/${encodeURIComponent(userId)}`, {});
  return !!r?.following;
}

export interface TrendingHashtag {
  tag: string;
  postsCount: number;
  previousCount: number;
  /** Percent change against the period before; null when the tag is new. */
  growth: number | null;
}
export interface TrendingTopic {
  id: string;
  nameBn: string;
  nameEn: string;
  slug: string;
  postsCount: number;
}
export interface TrendingData {
  days: number;
  hashtags: TrendingHashtag[];
  topics: TrendingTopic[];
  posts: FeedPost[];
}

function toFeedPosts(list: any[], bn: boolean): FeedPost[] {
  return (list || []).map((p: any) => {
    const name = p.author?.name || (bn ? "সদস্য" : "Member");
    const badge = p.author?.profileRole === "expert" ? "expert" : p.author?.farmingCategory || p.author?.profileRole || undefined;
    return {
      id: p.id,
      author: { id: p.author?.id, name, avatar: p.author?.avatar || "", initials: initialsOf(name), badge },
      content: p.content || "",
      image: p.media?.[0],
      likes: Number(p.likeCount || 0),
      comments: Number(p.commentCount || 0),
      views: 0,
      isLiked: !!p.likedByMe,
      isSaved: false,
      createdAt: timeAgo(p.createdAt, bn),
      shared: true,
    } as FeedPost;
  });
}

export async function fetchTrending(bn: boolean, days = 7): Promise<TrendingData> {
  const r = await apiGet<any>(`/api/trending?days=${days}`);
  const posts = toFeedPosts(r?.posts, bn);
  return { days: r?.days || days, hashtags: r?.hashtags || [], topics: r?.topics || [], posts };
}

export type RatingSummary = Record<string, { average: number; count: number }>;

/** Real product ratings from buyer reviews. Products with no reviews are left out. */
export function fetchRatings(ids: string[]): Promise<RatingSummary> {
  const clean = ids.filter(Boolean).slice(0, 300);
  if (!clean.length) return Promise.resolve({});
  return apiGet<RatingSummary>(`/api/reviews-summary?ids=${clean.map(encodeURIComponent).join(",")}`);
}

export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** One person's posts from the server, newest first. */
export async function fetchUserPosts(userId: string, bn: boolean): Promise<FeedPost[]> {
  return toFeedPosts(await apiGet<any[]>(`/api/users/${encodeURIComponent(userId)}/posts`), bn);
}
