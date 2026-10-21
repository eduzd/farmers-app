import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiPost, apiDelete, isLoggedIn } from "@/lib/api";

/** Saved (wishlist) product. Stored on the server for logged-in users, on the device for guests. */
export interface FavoriteItem {
  itemId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  seller?: string;
  unit?: string;
  currency?: string;
  inStock?: boolean;
  addedAt?: string;
  product?: any;
}

const KEY = "favorites_v1";

interface FavState {
  items: FavoriteItem[];
  loaded: boolean;
  load: () => Promise<void>;
  isFavorite: (id: string) => boolean;
  toggle: (item: FavoriteItem) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

export const useFavoritesStore = create<FavState>((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    try {
      if (isLoggedIn()) {
        const list = await apiGet<FavoriteItem[]>("/api/me/favorites");
        set({ items: list, loaded: true });
        return;
      }
      const raw = await AsyncStorage.getItem(KEY);
      set({ items: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  isFavorite: (id) => get().items.some((i) => i.itemId === id),
  toggle: async (item) => {
    const exists = get().isFavorite(item.itemId);
    const next = exists ? get().items.filter((i) => i.itemId !== item.itemId) : [{ ...item, addedAt: new Date().toISOString() }, ...get().items];
    set({ items: next });
    try {
      if (isLoggedIn()) {
        const { itemId, ...data } = item;
        if (exists) await apiDelete(`/api/me/favorites/${encodeURIComponent(itemId)}`);
        else await apiPost("/api/me/favorites", { itemId, data, force: true });
        await get().load();
      } else {
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
      }
    } catch {
      // keep optimistic state
    }
    return !exists;
  },
  remove: async (id) => {
    const item = get().items.find((i) => i.itemId === id);
    if (item) await get().toggle(item);
  },
}));
