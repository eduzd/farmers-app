import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ReportReason = 
  | "spam" 
  | "harassment" 
  | "hate_speech" 
  | "violence" 
  | "misinformation" 
  | "inappropriate" 
  | "copyright" 
  | "scam" 
  | "other";

export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export type ReportableType = "post" | "comment" | "user" | "product" | "message";

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetType: ReportableType;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}

export const REPORT_REASONS: { value: ReportReason; labelEn: string; labelBn: string }[] = [
  { value: "spam", labelEn: "Spam or advertising", labelBn: "স্প্যাম বা বিজ্ঞাপন" },
  { value: "harassment", labelEn: "Harassment or bullying", labelBn: "হয়রানি বা বুলিং" },
  { value: "hate_speech", labelEn: "Hate speech", labelBn: "ঘৃণামূলক বক্তব্য" },
  { value: "violence", labelEn: "Violence or threats", labelBn: "সহিংসতা বা হুমকি" },
  { value: "misinformation", labelEn: "Misinformation", labelBn: "ভুল তথ্য" },
  { value: "inappropriate", labelEn: "Inappropriate content", labelBn: "অনুপযুক্ত কন্টেন্ট" },
  { value: "copyright", labelEn: "Copyright violation", labelBn: "কপিরাইট লঙ্ঘন" },
  { value: "scam", labelEn: "Scam or fraud", labelBn: "প্রতারণা বা জালিয়াতি" },
  { value: "other", labelEn: "Other", labelBn: "অন্যান্য" },
];

interface ReportState {
  reports: Report[];
  myReports: Report[];
  blockedUsers: string[];
  
  submitReport: (report: Omit<Report, "id" | "status" | "createdAt">) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  isUserBlocked: (userId: string) => boolean;
  getMyReports: () => Report[];
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      myReports: [],
      blockedUsers: [],

      submitReport: (reportData) => {
        const newReport: Report = {
          ...reportData,
          id: `report-${Date.now()}`,
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          reports: [...state.reports, newReport],
          myReports: [...state.myReports, newReport],
        }));
      },

      blockUser: (userId) => {
        set((state) => ({
          blockedUsers: [...new Set([...state.blockedUsers, userId])],
        }));
      },

      unblockUser: (userId) => {
        set((state) => ({
          blockedUsers: state.blockedUsers.filter((id) => id !== userId),
        }));
      },

      isUserBlocked: (userId) => {
        return get().blockedUsers.includes(userId);
      },

      getMyReports: () => get().myReports,
    }),
    {
      name: "report-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
