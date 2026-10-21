import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Products the user opened recently, newest first, kept on the device. */
const KEY = "recently_viewed_v1";
const MAX = 12;

interface RecentState {
  items: any[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (product: any) => void;
  clear: () => void;
}

export const useRecentlyViewedStore = create<RecentState>((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ items: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  add: (product) => {
    if (!product?.id) return;
    const { id, name, price, currency, unit, image, seller, location, rating, category, quantity, ownerId, sellerId, description, companyId } = product;
    const slim = { id: String(id), name, price, currency, unit, image, seller, location, rating, category, quantity, ownerId, sellerId, description, companyId };
    const items = [slim, ...get().items.filter((p) => String(p.id) !== String(id))].slice(0, MAX);
    set({ items });
    AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
  },
  clear: () => {
    set({ items: [] });
    AsyncStorage.removeItem(KEY).catch(() => {});
  },
}));
