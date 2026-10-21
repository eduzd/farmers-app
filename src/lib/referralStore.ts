import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Referral {
  id: string;
  referredUserId: string;
  referredUserName: string;
  referredUserInitials: string;
  referredAt: number;
  pointsEarned: number;
  status: "pending" | "completed";
}

export interface ReferralTier {
  id: string;
  nameEn: string;
  nameBn: string;
  minReferrals: number;
  bonusPoints: number;
  badgeColor: string;
  icon: string;
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { id: "starter", nameEn: "Starter", nameBn: "নতুন", minReferrals: 0, bonusPoints: 0, badgeColor: "#9E9E9E", icon: "user" },
  { id: "bronze", nameEn: "Bronze Referrer", nameBn: "ব্রোঞ্জ রেফারার", minReferrals: 5, bonusPoints: 100, badgeColor: "#CD7F32", icon: "award" },
  { id: "silver", nameEn: "Silver Referrer", nameBn: "সিলভার রেফারার", minReferrals: 15, bonusPoints: 300, badgeColor: "#C0C0C0", icon: "star" },
  { id: "gold", nameEn: "Gold Referrer", nameBn: "গোল্ড রেফারার", minReferrals: 30, bonusPoints: 600, badgeColor: "#F5B700", icon: "zap" },
  { id: "diamond", nameEn: "Diamond Referrer", nameBn: "ডায়মন্ড রেফারার", minReferrals: 50, bonusPoints: 1000, badgeColor: "#B9F2FF", icon: "diamond" },
  { id: "elite", nameEn: "Elite Referrer", nameBn: "এলিট রেফারার", minReferrals: 100, bonusPoints: 2500, badgeColor: "#7C3AED", icon: "crown" },
];

export const REFERRAL_POINTS = {
  referrer: 100,
  referred: 50,
};

interface ReferralState {
  referralCode: string;
  referrals: Referral[];
  totalEarned: number;
  currentTier: ReferralTier;
  referredBy: string | null;
  
  generateReferralCode: (userId: string) => void;
  addReferral: (referral: Omit<Referral, "id" | "referredAt" | "pointsEarned" | "status">) => void;
  completeReferral: (referralId: string) => void;
  setReferredBy: (code: string) => void;
  getCurrentTier: () => ReferralTier;
  getNextTier: () => ReferralTier | null;
  getReferralProgress: () => { current: number; next: number; percentage: number };
  getLeaderboard: () => { userId: string; name: string; count: number; tier: ReferralTier }[];
}

const generateCode = (userId: string): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomPart = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const userPart = userId.slice(-4).toUpperCase();
  return `${userPart}${randomPart}`;
};

export const useReferralStore = create<ReferralState>()(
  persist(
    (set, get) => ({
      referralCode: "",
      referrals: [],
      totalEarned: 0,
      currentTier: REFERRAL_TIERS[0],
      referredBy: null,

      generateReferralCode: (userId: string) => {
        const existingCode = get().referralCode;
        if (!existingCode) {
          set({ referralCode: generateCode(userId) });
        }
      },

      addReferral: (referral) => {
        const newReferral: Referral = {
          id: Date.now().toString(),
          ...referral,
          referredAt: Date.now(),
          pointsEarned: REFERRAL_POINTS.referrer,
          status: "pending",
        };
        
        set((state) => ({
          referrals: [...state.referrals, newReferral],
        }));
      },

      completeReferral: (referralId: string) => {
        set((state) => {
          const updatedReferrals = state.referrals.map((r) =>
            r.id === referralId ? { ...r, status: "completed" as const } : r
          );
          const completedCount = updatedReferrals.filter((r) => r.status === "completed").length;
          const newTier = REFERRAL_TIERS.slice().reverse().find((t) => completedCount >= t.minReferrals) || REFERRAL_TIERS[0];
          const totalEarned = updatedReferrals
            .filter((r) => r.status === "completed")
            .reduce((sum, r) => sum + r.pointsEarned, 0);
          
          return {
            referrals: updatedReferrals,
            totalEarned,
            currentTier: newTier,
          };
        });
      },

      setReferredBy: (code: string) => {
        set({ referredBy: code });
      },

      getCurrentTier: () => {
        const completedCount = get().referrals.filter((r) => r.status === "completed").length;
        return REFERRAL_TIERS.slice().reverse().find((t) => completedCount >= t.minReferrals) || REFERRAL_TIERS[0];
      },

      getNextTier: () => {
        const completedCount = get().referrals.filter((r) => r.status === "completed").length;
        return REFERRAL_TIERS.find((t) => t.minReferrals > completedCount) || null;
      },

      getReferralProgress: () => {
        const completedCount = get().referrals.filter((r) => r.status === "completed").length;
        const currentTier = get().getCurrentTier();
        const nextTier = get().getNextTier();
        
        if (!nextTier) {
          return { current: completedCount, next: currentTier.minReferrals, percentage: 100 };
        }
        
        const progress = completedCount - currentTier.minReferrals;
        const needed = nextTier.minReferrals - currentTier.minReferrals;
        const percentage = Math.min(100, (progress / needed) * 100);
        
        return { current: completedCount, next: nextTier.minReferrals, percentage };
      },

      // No real referral leaderboard yet; never show made-up people.
      getLeaderboard: () => [],
    }),
    {
      name: "referral-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
