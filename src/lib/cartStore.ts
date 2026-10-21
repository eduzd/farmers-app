import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  currency: string;
  unit: string;
  quantity: number;
  image: string;
  seller: string;
  /** Chosen product options, e.g. { Size: "5 kg", Grade: "A" }. */
  options?: Record<string, string>;
}

const optKey = (o?: Record<string, string>) =>
  o ? Object.keys(o).sort().map((k) => `${k}=${o[k]}`).join("|") : "";

interface CartState {
  items: CartItem[];
  isLoading: boolean;

  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  loadCart: () => Promise<void>;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isLoading: false,

  addItem: async (item) => {
    const { items } = get();
    const same = (i: CartItem) => i.productId === item.productId && optKey(i.options) === optKey(item.options);
    const existingItem = items.find(same);

    let newItems: CartItem[];
    if (existingItem) {
      newItems = items.map((i) =>
        same(i)
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
      );
    } else {
      const newItem: CartItem = {
        ...item,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      };
      newItems = [...items, newItem];
    }

    set({ items: newItems });
    await AsyncStorage.setItem("cart", JSON.stringify(newItems));
  },

  removeItem: async (id) => {
    const { items } = get();
    const newItems = items.filter((item) => item.id !== id);
    set({ items: newItems });
    await AsyncStorage.setItem("cart", JSON.stringify(newItems));
  },

  updateQuantity: async (id, quantity) => {
    const { items } = get();
    if (quantity <= 0) {
      const newItems = items.filter((item) => item.id !== id);
      set({ items: newItems });
      await AsyncStorage.setItem("cart", JSON.stringify(newItems));
    } else {
      const newItems = items.map((item) =>
        item.id === id ? { ...item, quantity } : item
      );
      set({ items: newItems });
      await AsyncStorage.setItem("cart", JSON.stringify(newItems));
    }
  },

  clearCart: async () => {
    set({ items: [] });
    await AsyncStorage.removeItem("cart");
  },

  loadCart: async () => {
    set({ isLoading: true });
    const data = await AsyncStorage.getItem("cart");
    if (data) {
      set({ items: JSON.parse(data) });
    }
    set({ isLoading: false });
  },

  getTotal: () => {
    const { items } = get();
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  },

  getItemCount: () => {
    const { items } = get();
    return items.reduce((count, item) => count + item.quantity, 0);
  },
}));
