import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface GroupBuyParticipant {
  userId: string;
  userName: string;
  userInitials: string;
  quantity: number;
  joinedAt: number;
}

export interface GroupBuyDeal {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  sellerId: string;
  sellerName: string;
  originalPrice: number;
  groupPrice: number;
  discountPercent: number;
  currency: string;
  unit: string;
  minParticipants: number;
  maxParticipants: number;
  currentParticipants: number;
  participants: GroupBuyParticipant[];
  status: "active" | "success" | "failed" | "expired";
  endsAt: number;
  createdAt: number;
}

interface GroupBuyState {
  deals: GroupBuyDeal[];
  
  createDeal: (deal: Omit<GroupBuyDeal, "id" | "currentParticipants" | "participants" | "status" | "createdAt">) => string;
  joinDeal: (dealId: string, participant: Omit<GroupBuyParticipant, "joinedAt">) => boolean;
  leaveDeal: (dealId: string, userId: string) => void;
  updateDealStatus: (dealId: string) => void;
  getActiveDeals: () => GroupBuyDeal[];
  getDealById: (dealId: string) => GroupBuyDeal | undefined;
  getUserDeals: (userId: string) => GroupBuyDeal[];
}

const getEndTime = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.getTime();
};

const MOCK_DEALS: GroupBuyDeal[] = [
  {
    id: "gb1",
    productId: "p1",
    productName: "জৈব টমেটো - ১০০ কেজি",
    productImage: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400",
    sellerId: "s1",
    sellerName: "সবুজ ফসল",
    originalPrice: 80,
    groupPrice: 65,
    discountPercent: 19,
    currency: "৳",
    unit: "কেজি",
    minParticipants: 10,
    maxParticipants: 20,
    currentParticipants: 7,
    participants: [
      { userId: "u1", userName: "করিম সাহেব", userInitials: "কস", quantity: 15, joinedAt: Date.now() - 24 * 3600000 },
      { userId: "u2", userName: "ফাতেমা বেগম", userInitials: "ফব", quantity: 10, joinedAt: Date.now() - 20 * 3600000 },
      { userId: "u3", userName: "রহিম উদ্দিন", userInitials: "রউ", quantity: 20, joinedAt: Date.now() - 18 * 3600000 },
      { userId: "u4", userName: "নাজমুল হাসান", userInitials: "নহ", quantity: 8, joinedAt: Date.now() - 12 * 3600000 },
      { userId: "u5", userName: "সালমা আক্তার", userInitials: "সা", quantity: 12, joinedAt: Date.now() - 8 * 3600000 },
      { userId: "u6", userName: "আব্দুল হক", userInitials: "আহ", quantity: 5, joinedAt: Date.now() - 4 * 3600000 },
      { userId: "u7", userName: "রুবিনা খাতুন", userInitials: "রখ", quantity: 10, joinedAt: Date.now() - 2 * 3600000 },
    ],
    status: "active",
    endsAt: getEndTime(48),
    createdAt: Date.now() - 48 * 3600000,
  },
  {
    id: "gb2",
    productId: "p2",
    productName: "দেশি মুরগির ডিম - ৫০০ হালি",
    productImage: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400",
    sellerId: "s2",
    sellerName: "মুক্ত মুরগি খামার",
    originalPrice: 180,
    groupPrice: 150,
    discountPercent: 17,
    currency: "৳",
    unit: "হালি",
    minParticipants: 15,
    maxParticipants: 30,
    currentParticipants: 12,
    participants: [],
    status: "active",
    endsAt: getEndTime(72),
    createdAt: Date.now() - 24 * 3600000,
  },
  {
    id: "gb3",
    productId: "p3",
    productName: "রুই মাছের পোনা - ৫০০০টি",
    productImage: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    sellerId: "s3",
    sellerName: "মৎস্য হ্যাচারি",
    originalPrice: 5,
    groupPrice: 4,
    discountPercent: 20,
    currency: "৳",
    unit: "পিস",
    minParticipants: 5,
    maxParticipants: 10,
    currentParticipants: 5,
    participants: [],
    status: "success",
    endsAt: Date.now() - 24 * 3600000,
    createdAt: Date.now() - 96 * 3600000,
  },
];

export const useGroupBuyStore = create<GroupBuyState>()(
  persist(
    (set, get) => ({
      deals: MOCK_DEALS,

      createDeal: (deal) => {
        const newDeal: GroupBuyDeal = {
          id: Date.now().toString(),
          ...deal,
          currentParticipants: 0,
          participants: [],
          status: "active",
          createdAt: Date.now(),
        };
        set((state) => ({
          deals: [newDeal, ...state.deals],
        }));
        return newDeal.id;
      },

      joinDeal: (dealId, participant) => {
        const deal = get().getDealById(dealId);
        if (!deal || deal.status !== "active" || deal.currentParticipants >= deal.maxParticipants) {
          return false;
        }

        const alreadyJoined = deal.participants.some((p) => p.userId === participant.userId);
        if (alreadyJoined) return false;

        const newParticipant: GroupBuyParticipant = {
          ...participant,
          joinedAt: Date.now(),
        };

        set((state) => ({
          deals: state.deals.map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  participants: [...d.participants, newParticipant],
                  currentParticipants: d.currentParticipants + 1,
                }
              : d
          ),
        }));

        get().updateDealStatus(dealId);
        return true;
      },

      leaveDeal: (dealId, userId) => {
        set((state) => ({
          deals: state.deals.map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  participants: d.participants.filter((p) => p.userId !== userId),
                  currentParticipants: Math.max(0, d.currentParticipants - 1),
                }
              : d
          ),
        }));
      },

      updateDealStatus: (dealId) => {
        const deal = get().getDealById(dealId);
        if (!deal) return;

        let newStatus = deal.status;
        const now = Date.now();

        if (deal.currentParticipants >= deal.minParticipants && deal.status === "active") {
          if (deal.currentParticipants >= deal.maxParticipants || now >= deal.endsAt) {
            newStatus = "success";
          }
        } else if (now >= deal.endsAt && deal.currentParticipants < deal.minParticipants) {
          newStatus = "failed";
        }

        if (newStatus !== deal.status) {
          set((state) => ({
            deals: state.deals.map((d) =>
              d.id === dealId ? { ...d, status: newStatus } : d
            ),
          }));
        }
      },

      getActiveDeals: () => {
        return get().deals.filter((d) => d.status === "active" && d.endsAt > Date.now());
      },

      getDealById: (dealId) => {
        return get().deals.find((d) => d.id === dealId);
      },

      getUserDeals: (userId) => {
        return get().deals.filter((d) =>
          d.participants.some((p) => p.userId === userId)
        );
      },
    }),
    {
      name: "group-buy-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
