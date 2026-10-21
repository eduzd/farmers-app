import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SubscriptionFrequency = "daily" | "weekly" | "biweekly" | "monthly";
export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface SubscriptionItem {
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  currency: string;
}

export interface Subscription {
  id: string;
  userId: string;
  sellerId: string;
  sellerName: string;
  items: SubscriptionItem[];
  frequency: SubscriptionFrequency;
  nextDelivery: number;
  deliveryDay?: number;
  deliveryAddress: string;
  totalAmount: number;
  discountPercent: number;
  status: SubscriptionStatus;
  startDate: number;
  pausedUntil?: number;
  deliveryCount: number;
  createdAt: number;
}

interface SubscriptionState {
  subscriptions: Subscription[];
  
  createSubscription: (sub: Omit<Subscription, "id" | "createdAt" | "deliveryCount" | "status">) => string;
  updateSubscription: (subId: string, updates: Partial<Subscription>) => void;
  pauseSubscription: (subId: string, pauseUntil?: number) => void;
  resumeSubscription: (subId: string) => void;
  cancelSubscription: (subId: string) => void;
  skipNextDelivery: (subId: string) => void;
  getUserSubscriptions: (userId: string) => Subscription[];
  getActiveSubscriptions: (userId: string) => Subscription[];
}

const MOCK_SUBSCRIPTIONS: Subscription[] = [];

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      subscriptions: MOCK_SUBSCRIPTIONS,

      createSubscription: (sub) => {
        const newSub: Subscription = {
          id: Date.now().toString(),
          ...sub,
          status: "active",
          deliveryCount: 0,
          createdAt: Date.now(),
        };
        set((state) => ({
          subscriptions: [newSub, ...state.subscriptions],
        }));
        return newSub.id;
      },

      updateSubscription: (subId, updates) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === subId ? { ...s, ...updates } : s
          ),
        }));
      },

      pauseSubscription: (subId, pauseUntil) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === subId ? { ...s, status: "paused" as const, pausedUntil: pauseUntil } : s
          ),
        }));
      },

      resumeSubscription: (subId) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === subId ? { ...s, status: "active" as const, pausedUntil: undefined } : s
          ),
        }));
      },

      cancelSubscription: (subId) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === subId ? { ...s, status: "cancelled" as const } : s
          ),
        }));
      },

      skipNextDelivery: (subId) => {
        const sub = get().subscriptions.find((s) => s.id === subId);
        if (!sub) return;

        const frequencyDays: Record<SubscriptionFrequency, number> = {
          daily: 1,
          weekly: 7,
          biweekly: 14,
          monthly: 30,
        };

        const newNextDelivery = sub.nextDelivery + frequencyDays[sub.frequency] * 24 * 3600000;
        
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === subId ? { ...s, nextDelivery: newNextDelivery } : s
          ),
        }));
      },

      getUserSubscriptions: (userId) => {
        return get().subscriptions.filter((s) => s.userId === userId);
      },

      getActiveSubscriptions: (userId) => {
        return get().subscriptions.filter((s) => s.userId === userId && s.status === "active");
      },
    }),
    {
      name: "subscription-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v2: the sample entries older versions saved on the phone are removed; real ones stay.
      version: 2,
      migrate: (persisted: any) => {
        const sample = new Set(["sub1", "sub2"]);
        if (persisted && Array.isArray(persisted.subscriptions)) {
          persisted.subscriptions = persisted.subscriptions.filter((x: any) => !sample.has(x?.id));
        }
        return persisted;
      },
    }
  )
);

export const FREQUENCY_OPTIONS: { id: SubscriptionFrequency; labelEn: string; labelBn: string; days: number }[] = [
  { id: "daily", labelEn: "Daily", labelBn: "প্রতিদিন", days: 1 },
  { id: "weekly", labelEn: "Weekly", labelBn: "সাপ্তাহিক", days: 7 },
  { id: "biweekly", labelEn: "Every 2 Weeks", labelBn: "প্রতি ২ সপ্তাহ", days: 14 },
  { id: "monthly", labelEn: "Monthly", labelBn: "মাসিক", days: 30 },
];
