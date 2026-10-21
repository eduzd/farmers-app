import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiPut, isLoggedIn } from "@/lib/api";

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  currency: string;
  status: OrderStatus;
  shippingAddress: {
    fullName: string;
    address: string;
    city: string;
    phone: string;
  };
  paymentMethod: "cod" | "card" | "bkash";
  checkout?: {
    deliveryMethod?: "home" | "express" | "pickup";
    division?: string;
    district?: string;
    upazila?: string;
    deliveryDate?: string;
    timeSlot?: string;
    notes?: string;
    subtotal?: number;
    deliveryFee?: number;
    discount?: number;
    coupon?: string | null;
    total?: number;
  } | null;
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  /** set for orders stored on the server */
  onServer?: boolean;
  history?: { status: OrderStatus; at: string }[];
  buyer?: { id: string; name: string; initials?: string } | null;
  role?: "buyer" | "seller";
}

/** Map a server order (/api/me/orders or /api/me/sales) to the app's Order shape. */
function fromServer(o: any, role: "buyer" | "seller"): Order {
  const addr = o.shippingAddress || {};
  return {
    id: o.id,
    items: (o.items || []).map((i: any, idx: number) => ({
      id: `${o.id}-${idx}`,
      productId: String(i.productId || ""),
      name: i.name || "",
      price: Number(i.price || 0),
      quantity: Number(i.quantity || 1),
      image: i.image || "",
    })),
    total: Number(o.total || 0),
    currency: "৳",
    status: o.status,
    shippingAddress: { fullName: addr.fullName || o.buyer?.name || "", address: addr.address || "", city: addr.city || "", phone: addr.phone || "" },
    paymentMethod: o.paymentMethod === "card" ? "card" : o.paymentMethod === "bkash" ? "bkash" : "cod",
    checkout: o.checkout || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    onServer: true,
    history: o.history,
    buyer: o.buyer || null,
    role,
  };
}

interface OrdersState {
  orders: Order[];
  sales: Order[];
  isLoading: boolean;
  
  addOrder: (order: Omit<Order, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<Order>;
  loadSales: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  loadOrders: () => Promise<void>;
  getOrderById: (orderId: string) => Order | undefined;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  sales: [],
  isLoading: false,
  
  addOrder: async (orderData) => {
    const order: Order = {
      ...orderData,
      id: orderData.id || `ORD-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trackingNumber: `TRK${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    };
    
    const { orders } = get();
    const newOrders = [order, ...orders];
    set({ orders: newOrders });
    await AsyncStorage.setItem("orders", JSON.stringify(newOrders));
    
    return order;
  },
  
  updateOrderStatus: async (orderId, status) => {
    const { orders, sales } = get();
    const target = [...orders, ...sales].find((o) => o.id === orderId);
    if (target?.onServer && isLoggedIn()) {
      // throws with the server's message (e.g. not allowed) so the screen can show it
      const r = await apiPut(`/api/orders/${encodeURIComponent(orderId)}/status`, { status });
      const patch = (o: Order) => (o.id === orderId ? { ...o, status, history: r.history, updatedAt: new Date().toISOString() } : o);
      set({ orders: orders.map(patch), sales: sales.map(patch) });
      await AsyncStorage.setItem("orders", JSON.stringify(get().orders.filter((o) => !o.onServer)));
      return;
    }
    const newOrders = orders.map((order) =>
      order.id === orderId
        ? { ...order, status, updatedAt: new Date().toISOString() }
        : order
    );
    set({ orders: newOrders });
    await AsyncStorage.setItem("orders", JSON.stringify(newOrders));
  },
  
  loadOrders: async () => {
    set({ isLoading: true });
    try {
      const data = await AsyncStorage.getItem("orders");
      let local: Order[] = data ? JSON.parse(data) : [];
      if (isLoggedIn()) {
        try {
          const server: any[] = await apiGet("/api/me/orders");
          const ids = new Set(server.map((o) => o.id));
          local = local.filter((o) => !ids.has(o.id));
          const merged = [...server.map((o) => fromServer(o, "buyer")), ...local];
          merged.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
          set({ orders: merged });
        } catch {
          set({ orders: local });
        }
      } else {
        set({ orders: local });
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
    set({ isLoading: false });
  },
  
  loadSales: async () => {
    if (!isLoggedIn()) return set({ sales: [] });
    try {
      const server: any[] = await apiGet("/api/me/sales");
      set({ sales: server.map((o) => fromServer(o, "seller")) });
    } catch {
      // offline
    }
  },

  getOrderById: (orderId) => {
    const { orders, sales } = get();
    return orders.find((order) => order.id === orderId) || sales.find((order) => order.id === orderId);
  },
}));
