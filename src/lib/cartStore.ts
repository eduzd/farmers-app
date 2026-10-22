import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sellRule, upperLimit, clampQty, round3, type SellAs } from "@shared/selling";

/** How the product is sold, copied from the product when it was added (the server checks it again at checkout). */
export interface CartSale {
  sellAs?: SellAs;
  step?: number;
  min?: number;
  max?: number | null;
  stock?: number | null;
  packSize?: number | null;
  packUnit?: string;
}

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
  sale?: CartSale;
}

/** The selling rule of a cart line. Lines added before sale info existed: whole numbers, step 1. */
export function cartRule(i: Pick<CartItem, "unit" | "sale">) {
  const s = i.sale || {};
  return sellRule({ sellAs: s.sellAs, unit: i.unit, step: s.step, minOrder: s.min, maxOrder: s.max, quantity: s.stock ?? undefined, packSize: s.packSize, packUnit: s.packUnit });
}
/** The amount after one tap on + or -; 0 means the line should go (below the minimum). */
export function nextQty(i: CartItem, dir: 1 | -1): number {
  const r = cartRule(i);
  const n = round3(i.quantity + dir * r.step);
  if (dir < 0) return n < r.min - 1e-9 ? 0 : n;
  return n > upperLimit(r) + 1e-9 ? i.quantity : n;
}
export function canStepUp(i: CartItem) {
  return nextQty(i, 1) !== i.quantity;
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
          ? { ...i, ...(item.sale ? { sale: item.sale } : {}), quantity: clampQty(cartRule({ unit: i.unit, sale: item.sale || i.sale }), round3(i.quantity + item.quantity)) }
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
    return round3(items.reduce((total, item) => total + item.price * item.quantity, 0));
  },

  getItemCount: () => {
    const { items } = get();
    // part amounts (2.5 kg) count as one item
    return items.reduce((count, item) => count + (Number.isInteger(item.quantity) ? item.quantity : 1), 0);
  },
}));
