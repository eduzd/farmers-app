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
  totalPosts: 0,
  totalLikes: 0,
  totalComments: 0,
  totalShares: 0,
  totalViews: 0,
  followers: 0,
  following: 0,
  postsThisWeek: 0,
  postsThisMonth: 0,
  engagementRate: 0,
  avgLikesPerPost: 0,
  avgCommentsPerPost: 0,
  topPerformingPosts: [],
  peakActivityHour: 0,
  mostActiveDay: "Saturday",
};

const MOCK_COMMUNITY_STATS: CommunityStats = {
  totalMembers: 0,
  activeMembers: 0,
  newMembersToday: 0,
  newMembersThisWeek: 0,
  totalPosts: 0,
  postsToday: 0,
  totalEvents: 0,
  upcomingEvents: 0,
  topContributors: [],
  growthRate: 0,
  engagementRate: 0,
};

// No made-up activity: the chart stays empty until real activity is recorded.
const generateDailyActivity = (): DailyActivity[] => [];

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
      // v2: drop the made-up numbers older versions saved on the phone.
      version: 2,
      migrate: (persisted: any) => {
        if (persisted) {
          persisted.userStats = MOCK_USER_STATS;
          persisted.communityStats = MOCK_COMMUNITY_STATS;
        }
        return persisted;
      },
    }
  )
);
