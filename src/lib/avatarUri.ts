import { getApiUrl } from "@/lib/query-client";

/** Profile photos uploaded to the server are stored as "/api/avatars/<id>?v=...". */
export function resolveAvatarUri(avatar?: string | null): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith("/")) return `${getApiUrl()}${avatar}`;
  return avatar;
}
