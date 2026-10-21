import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DisputeReason =
  | "item_not_received"
  | "item_damaged"
  | "wrong_item"
  | "quality_issue"
  | "seller_unresponsive"
  | "refund_issue"
  | "other";

export type DisputeStatus =
  | "open"
  | "under_review"
  | "awaiting_seller"
  | "awaiting_buyer"
  | "resolved"
  | "closed";

export type ResolutionType =
  | "full_refund"
  | "partial_refund"
  | "replacement"
  | "no_action"
  | "mutual_agreement";

export interface DisputeMessage {
  id: string;
  senderId: string;
  senderType: "buyer" | "seller" | "admin";
  content: string;
  attachments: string[];
  createdAt: number;
}

export interface Dispute {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  reason: DisputeReason;
  description: string;
  evidence: string[];
  status: DisputeStatus;
  resolution?: {
    type: ResolutionType;
    description: string;
    refundAmount?: number;
    resolvedAt: number;
    resolvedBy: string;
  };
  messages: DisputeMessage[];
  createdAt: number;
  updatedAt: number;
}

export const DISPUTE_REASONS: { id: DisputeReason; labelEn: string; labelBn: string; icon: string }[] = [
  { id: "item_not_received", labelEn: "Item Not Received", labelBn: "পণ্য পাইনি", icon: "package" },
  { id: "item_damaged", labelEn: "Item Damaged", labelBn: "পণ্য ক্ষতিগ্রস্ত", icon: "alert-triangle" },
  { id: "wrong_item", labelEn: "Wrong Item", labelBn: "ভুল পণ্য", icon: "x-circle" },
  { id: "quality_issue", labelEn: "Quality Issue", labelBn: "মানের সমস্যা", icon: "thumbs-down" },
  { id: "seller_unresponsive", labelEn: "Seller Unresponsive", labelBn: "সেলার সাড়া দিচ্ছে না", icon: "user-x" },
  { id: "refund_issue", labelEn: "Refund Issue", labelBn: "রিফান্ড সমস্যা", icon: "credit-card" },
  { id: "other", labelEn: "Other", labelBn: "অন্যান্য", icon: "help-circle" },
];

interface DisputeState {
  disputes: Dispute[];
  
  createDispute: (dispute: Omit<Dispute, "id" | "status" | "messages" | "createdAt" | "updatedAt">) => string;
  updateDisputeStatus: (disputeId: string, status: DisputeStatus) => void;
  addMessage: (disputeId: string, message: Omit<DisputeMessage, "id" | "createdAt">) => void;
  resolveDispute: (disputeId: string, resolution: Dispute["resolution"]) => void;
  getDisputesByBuyer: (buyerId: string) => Dispute[];
  getDisputesBySeller: (sellerId: string) => Dispute[];
  getDisputeById: (disputeId: string) => Dispute | undefined;
}

const MOCK_DISPUTES: Dispute[] = [];

export const useDisputeStore = create<DisputeState>()(
  persist(
    (set, get) => ({
      disputes: MOCK_DISPUTES,

      createDispute: (dispute) => {
        const newDispute: Dispute = {
          id: Date.now().toString(),
          ...dispute,
          status: "open",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          disputes: [newDispute, ...state.disputes],
        }));
        return newDispute.id;
      },

      updateDisputeStatus: (disputeId, status) => {
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === disputeId ? { ...d, status, updatedAt: Date.now() } : d
          ),
        }));
      },

      addMessage: (disputeId, message) => {
        const newMessage: DisputeMessage = {
          id: Date.now().toString(),
          ...message,
          createdAt: Date.now(),
        };
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === disputeId
              ? { ...d, messages: [...d.messages, newMessage], updatedAt: Date.now() }
              : d
          ),
        }));
      },

      resolveDispute: (disputeId, resolution) => {
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === disputeId
              ? { ...d, resolution, status: "resolved", updatedAt: Date.now() }
              : d
          ),
        }));
      },

      getDisputesByBuyer: (buyerId) => {
        return get().disputes.filter((d) => d.buyerId === buyerId);
      },

      getDisputesBySeller: (sellerId) => {
        return get().disputes.filter((d) => d.sellerId === sellerId);
      },

      getDisputeById: (disputeId) => {
        return get().disputes.find((d) => d.id === disputeId);
      },
    }),
    {
      name: "dispute-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v2: the sample entries older versions saved on the phone are removed; real ones stay.
      version: 2,
      migrate: (persisted: any) => {
        const sample = new Set(["d1"]);
        if (persisted && Array.isArray(persisted.disputes)) {
          persisted.disputes = persisted.disputes.filter((x: any) => !sample.has(x?.id));
        }
        return persisted;
      },
    }
  )
);
