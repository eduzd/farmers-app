import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalViews: number;
  followers: number;
  following: number;
  postsThisWeek: number;
  postsThisMonth: number;
  engagementRate: number;
  avgLikesPerPost: number;
  avgCommentsPerPost: number;
  topPerformingPosts: string[];
  peakActivityHour: number;
  mostActiveDay: string;
}

export interface CommunityStats {
  totalMembers: number;
  activeMembers: number;
  newMembersToday: number;
  newMembersThisWeek: number;
  totalPosts: number;
  postsToday: number;
  totalEvents: number;
  upcomingEvents: number;
  topContributors: { userId: string; name: string; points: number }[];
  growthRate: number;
  engagementRate: number;
}

export interface DailyActivity {
  date: string;
  posts: number;
  likes: number;
  comments: number;
  views: number;
}

interface AnalyticsState {
  userStats: UserStats;
  communityStats: CommunityStats;
  dailyActivity: DailyActivity[];
  
  updateUserStats: (stats: Partial<UserStats>) => void;
  incrementStat: (stat: keyof Pick<UserStats, "totalPosts" | "totalLikes" | "totalComments" | "totalShares" | "totalViews">) => void;
  recordDailyActivity: (activity: DailyActivity) => void;
  getWeeklyTrend: () => DailyActivity[];
  getMonthlyTrend: () => DailyActivity[];
}

const MOCK_USER_STATS: UserStats = {
  totalPosts: 45,
  totalLikes: 890,
  totalComments: 234,
  totalShares: 56,
  totalViews: 12500,
  followers: 156,
  following: 89,
  postsThisWeek: 5,
  postsThisMonth: 18,
  engagementRate: 7.2,
  avgLikesPerPost: 19.8,
  avgCommentsPerPost: 5.2,
  topPerformingPosts: ["post1", "post2", "post3"],
  peakActivityHour: 18,
  mostActiveDay: "Saturday",
};

const MOCK_COMMUNITY_STATS: CommunityStats = {
  totalMembers: 25678,
  activeMembers: 8934,
  newMembersToday: 45,
  newMembersThisWeek: 312,
  totalPosts: 156789,
  postsToday: 234,
  totalEvents: 45,
  upcomingEvents: 8,
  topContributors: [
    { userId: "u1", name: "রহিম আহমেদ", points: 12500 },
    { userId: "u2", name: "ফাতিমা বেগম", points: 10200 },
    { userId: "u3", name: "করিম উদ্দিন", points: 8900 },
    { userId: "u4", name: "নাসরিন আক্তার", points: 7500 },
    { userId: "u5", name: "আব্দুল করিম", points: 6800 },
  ],
  growthRate: 5.2,
  engagementRate: 34.8,
};

const generateDailyActivity = (): DailyActivity[] => {
  const activities: DailyActivity[] = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    activities.push({
      date: date.toISOString().split("T")[0],
      posts: Math.floor(Math.random() * 5) + 1,
      likes: Math.floor(Math.random() * 50) + 10,
      comments: Math.floor(Math.random() * 20) + 5,
      views: Math.floor(Math.random() * 200) + 50,
    });
  }
  
  return activities;
};

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      userStats: MOCK_USER_STATS,
      communityStats: MOCK_COMMUNITY_STATS,
      dailyActivity: generateDailyActivity(),

      updateUserStats: (stats) => {
        set((state) => ({
          userStats: { ...state.userStats, ...stats },
        }));
      },

      incrementStat: (stat) => {
        set((state) => ({
          userStats: {
            ...state.userStats,
            [stat]: (state.userStats[stat] as number) + 1,
          },
        }));
      },

      recordDailyActivity: (activity) => {
        set((state) => ({
          dailyActivity: [...state.dailyActivity.slice(-29), activity],
        }));
      },

      getWeeklyTrend: () => {
        return get().dailyActivity.slice(-7);
      },

      getMonthlyTrend: () => {
        return get().dailyActivity;
      },
    }),
    {
      name: "analytics-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
