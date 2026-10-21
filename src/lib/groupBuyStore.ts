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

const MOCK_DEALS: GroupBuyDeal[] = [];

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
      // v2: the sample entries older versions saved on the phone are removed; real ones stay.
      version: 2,
      migrate: (persisted: any) => {
        const sample = new Set(["gb1", "gb2", "gb3"]);
        if (persisted && Array.isArray(persisted.deals)) {
          persisted.deals = persisted.deals.filter((x: any) => !sample.has(x?.id));
        }
        return persisted;
      },
    }
  )
);
