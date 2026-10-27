import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface TrustFactor {
  id: string;
  nameEn: string;
  nameBn: string;
  weight: number;
  maxScore: number;
  currentScore: number;
  icon: string;
}

export interface TrustLevel {
  id: string;
  nameEn: string;
  nameBn: string;
  minScore: number;
  color: string;
  icon: string;
  benefits: string[];
}

export const TRUST_LEVELS: TrustLevel[] = [
  {
    id: "new",
    nameEn: "New Member",
    nameBn: "নতুন সদস্য",
    minScore: 0,
    color: "#7A8CA3",
    icon: "user",
    benefits: ["basic_access"],
  },
  {
    id: "verified",
    nameEn: "Verified",
    nameBn: "যাচাইকৃত",
    minScore: 30,
    color: "#2E96EF",
    icon: "check-circle",
    benefits: ["basic_access", "sell_products"],
  },
  {
    id: "trusted",
    nameEn: "Trusted",
    nameBn: "বিশ্বস্ত",
    minScore: 60,
    color: "#2E96EF",
    icon: "shield",
    benefits: ["basic_access", "sell_products", "priority_support", "featured_listing"],
  },
  {
    id: "elite",
    nameEn: "Elite Seller",
    nameBn: "এলিট সেলার",
    minScore: 85,
    color: "#F5B700",
    icon: "award",
    benefits: ["basic_access", "sell_products", "priority_support", "featured_listing", "lower_fees", "elite_badge"],
  },
];

export interface UserReport {
  id: string;
  reporterId: string;
  reason: string;
  description: string;
  status: "pending" | "reviewed" | "resolved";
  createdAt: number;
}

interface TrustScoreState {
  userId: string;
  trustScore: number;
  trustFactors: TrustFactor[];
  reports: UserReport[];
  isVerified: boolean;
  verificationDate: number | null;
  
  calculateScore: () => number;
  getTrustLevel: () => TrustLevel;
  updateFactor: (factorId: string, score: number) => void;
  addReport: (report: Omit<UserReport, "id" | "createdAt" | "status">) => void;
  setVerified: (verified: boolean) => void;
  getScoreBreakdown: () => { factor: TrustFactor; percentage: number }[];
}

const DEFAULT_TRUST_FACTORS: TrustFactor[] = [
  {
    id: "profile_complete",
    nameEn: "Profile Completeness",
    nameBn: "প্রোফাইল সম্পূর্ণতা",
    weight: 0.15,
    maxScore: 100,
    currentScore: 70,
    icon: "user",
  },
  {
    id: "verification",
    nameEn: "Identity Verification",
    nameBn: "পরিচয় যাচাই",
    weight: 0.20,
    maxScore: 100,
    currentScore: 0,
    icon: "shield",
  },
  {
    id: "transaction_history",
    nameEn: "Transaction History",
    nameBn: "লেনদেন ইতিহাস",
    weight: 0.25,
    maxScore: 100,
    currentScore: 50,
    icon: "activity",
  },
  {
    id: "reviews",
    nameEn: "Customer Reviews",
    nameBn: "গ্রাহক রিভিউ",
    weight: 0.20,
    maxScore: 100,
    currentScore: 80,
    icon: "star",
  },
  {
    id: "response_rate",
    nameEn: "Response Rate",
    nameBn: "প্রতিক্রিয়া হার",
    weight: 0.10,
    maxScore: 100,
    currentScore: 90,
    icon: "message-circle",
  },
  {
    id: "community_engagement",
    nameEn: "Community Engagement",
    nameBn: "কমিউনিটি এনগেজমেন্ট",
    weight: 0.10,
    maxScore: 100,
    currentScore: 60,
    icon: "users",
  },
];

export const useTrustScoreStore = create<TrustScoreState>()(
  persist(
    (set, get) => ({
      userId: "",
      trustScore: 0,
      trustFactors: DEFAULT_TRUST_FACTORS,
      reports: [],
      isVerified: false,
      verificationDate: null,

      calculateScore: () => {
        const factors = get().trustFactors;
        const reports = get().reports.filter((r) => r.status !== "resolved");
        
        let weightedScore = factors.reduce((sum, factor) => {
          return sum + (factor.currentScore / factor.maxScore) * factor.weight * 100;
        }, 0);

        const reportPenalty = reports.length * 5;
        weightedScore = Math.max(0, weightedScore - reportPenalty);

        const finalScore = Math.round(Math.min(100, weightedScore));
        set({ trustScore: finalScore });
        return finalScore;
      },

      getTrustLevel: () => {
        const score = get().trustScore || get().calculateScore();
        return TRUST_LEVELS.slice().reverse().find((level) => score >= level.minScore) || TRUST_LEVELS[0];
      },

      updateFactor: (factorId: string, score: number) => {
        set((state) => ({
          trustFactors: state.trustFactors.map((f) =>
            f.id === factorId ? { ...f, currentScore: Math.min(f.maxScore, Math.max(0, score)) } : f
          ),
        }));
        get().calculateScore();
      },

      addReport: (report) => {
        const newReport: UserReport = {
          id: Date.now().toString(),
          ...report,
          status: "pending",
          createdAt: Date.now(),
        };
        set((state) => ({
          reports: [...state.reports, newReport],
        }));
        get().calculateScore();
      },

      setVerified: (verified: boolean) => {
        set({
          isVerified: verified,
          verificationDate: verified ? Date.now() : null,
        });
        get().updateFactor("verification", verified ? 100 : 0);
      },

      getScoreBreakdown: () => {
        const factors = get().trustFactors;
        return factors.map((factor) => ({
          factor,
          percentage: (factor.currentScore / factor.maxScore) * factor.weight * 100,
        }));
      },
    }),
    {
      name: "trust-score-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const getUserTrustBadge = (score: number): { color: string; icon: string; label: string; labelBn: string } => {
  const level = TRUST_LEVELS.slice().reverse().find((l) => score >= l.minScore) || TRUST_LEVELS[0];
  return {
    color: level.color,
    icon: level.icon,
    label: level.nameEn,
    labelBn: level.nameBn,
  };
};
