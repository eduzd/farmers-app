import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

export type CommunityKind = "polls" | "questions" | "rfqs" | "diary";

/** Server-backed list for polls, expert questions, RFQs and the farm diary. Reloads when the screen gets focus. */
export function useCommunityList<T = any>(kind: CommunityKind) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await apiGet<T[]>(`/api/community/${kind}`);
      setItems(list);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "error");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  /** Replace one item in the list with the server's updated copy. */
  const patch = useCallback((updated: any) => {
    setItems((prev) => prev.map((i: any) => (i.id === updated.id ? updated : i)));
  }, []);

  return { items, setItems, loading, error, reload, patch };
}

export const createCommunity = (kind: CommunityKind, data: any) => apiPost(`/api/community/${kind}`, data);
export const updateCommunity = (kind: CommunityKind, id: string, data: any) => apiPut(`/api/community/${kind}/${encodeURIComponent(id)}`, data);
export const deleteCommunity = (kind: CommunityKind, id: string) => apiDelete(`/api/community/${kind}/${encodeURIComponent(id)}`);
export const communityAction = (kind: CommunityKind, id: string, action: string, body: any = {}) =>
  apiPost(`/api/community/${kind}/${encodeURIComponent(id)}/${action}`, body);
