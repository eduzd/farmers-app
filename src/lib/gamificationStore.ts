import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Badge {
  id: string;
  nameEn: string;
  nameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  icon: string;
  color: string;
  category: "participation" | "social" | "commerce" | "expertise" | "special";
  requirement: number;
  requirementType: string;
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: number;
}

export interface Level {
  level: number;
  nameEn: string;
  nameBn: string;
  minPoints: number;
}

export const BADGES: Badge[] = [
  // Participation Badges
  {
    id: "first-post",
    nameEn: "First Post",
    nameBn: "প্রথম পোস্ট",
    descriptionEn: "Create your first post in the community",
    descriptionBn: "কমিউনিটিতে আপনার প্রথম পোস্ট তৈরি করুন",
    icon: "edit-3",
    color: "#2FA36B",
    category: "participation",
    requirement: 1,
    requirementType: "posts",
  },
  {
    id: "active-poster",
    nameEn: "Active Poster",
    nameBn: "সক্রিয় পোস্টার",
    descriptionEn: "Create 10 posts in the community",
    descriptionBn: "কমিউনিটিতে ১০টি পোস্ট তৈরি করুন",
    icon: "file-text",
    color: "#2563EB",
    category: "participation",
    requirement: 10,
    requirementType: "posts",
  },
  {
    id: "prolific-writer",
    nameEn: "Prolific Writer",
    nameBn: "বিখ্যাত লেখক",
    descriptionEn: "Create 50 posts in the community",
    descriptionBn: "কমিউনিটিতে ৫০টি পোস্ট তৈরি করুন",
    icon: "book",
    color: "#7C3AED",
    category: "participation",
    requirement: 50,
    requirementType: "posts",
  },
  {
    id: "daily-visitor",
    nameEn: "Daily Visitor",
    nameBn: "দৈনিক দর্শক",
    descriptionEn: "Visit the app 7 days in a row",
    descriptionBn: "টানা ৭ দিন অ্যাপে প্রবেশ করুন",
    icon: "calendar",
    color: "#EA8A0C",
    category: "participation",
    requirement: 7,
    requirementType: "streak",
  },
  // Social Badges
  {
    id: "community-helper",
    nameEn: "Community Helper",
    nameBn: "কমিউনিটি সাহায্যকারী",
    descriptionEn: "Comment on 20 posts to help others",
    descriptionBn: "অন্যদের সাহায্য করতে ২০টি পোস্টে মন্তব্য করুন",
    icon: "message-circle",
    color: "#0D9488",
    category: "social",
    requirement: 20,
    requirementType: "comments",
  },
  {
    id: "popular-member",
    nameEn: "Popular Member",
    nameBn: "জনপ্রিয় সদস্য",
    descriptionEn: "Get 100 followers",
    descriptionBn: "১০০ জন অনুসরণকারী পান",
    icon: "users",
    color: "#DB2777",
    category: "social",
    requirement: 100,
    requirementType: "followers",
  },
  {
    id: "influencer",
    nameEn: "Influencer",
    nameBn: "প্রভাবশালী",
    descriptionEn: "Get 500 followers",
    descriptionBn: "৫০০ জন অনুসরণকারী পান",
    icon: "star",
    color: "#673AB7",
    category: "social",
    requirement: 500,
    requirementType: "followers",
  },
  {
    id: "referral-champion",
    nameEn: "Referral Champion",
    nameBn: "রেফারেল চ্যাম্পিয়ন",
    descriptionEn: "Refer 5 friends to the app",
    descriptionBn: "অ্যাপে ৫ জন বন্ধুকে রেফার করুন",
    icon: "share-2",
    color: "#3F51B5",
    category: "social",
    requirement: 5,
    requirementType: "referrals",
  },
  // Commerce Badges
  {
    id: "first-sale",
    nameEn: "First Sale",
    nameBn: "প্রথম বিক্রয়",
    descriptionEn: "Make your first sale on the marketplace",
    descriptionBn: "মার্কেটপ্লেসে আপনার প্রথম বিক্রয় করুন",
    icon: "shopping-cart",
    color: "#FF5722",
    category: "commerce",
    requirement: 1,
    requirementType: "sales",
  },
  {
    id: "trusted-seller",
    nameEn: "Trusted Seller",
    nameBn: "বিশ্বস্ত বিক্রেতা",
    descriptionEn: "Complete 25 successful sales",
    descriptionBn: "২৫টি সফল বিক্রয় সম্পন্ন করুন",
    icon: "shield",
    color: "#795548",
    category: "commerce",
    requirement: 25,
    requirementType: "sales",
  },
  {
    id: "top-seller",
    nameEn: "Top Seller",
    nameBn: "শীর্ষ বিক্রেতা",
    descriptionEn: "Complete 100 successful sales",
    descriptionBn: "১০০টি সফল বিক্রয় সম্পন্ন করুন",
    icon: "award",
    color: "#F5B700",
    category: "commerce",
    requirement: 100,
    requirementType: "sales",
  },
  {
    id: "product-master",
    nameEn: "Product Master",
    nameBn: "পণ্য মাস্টার",
    descriptionEn: "List 20 products in the marketplace",
    descriptionBn: "মার্কেটপ্লেসে ২০টি পণ্য তালিকাভুক্ত করুন",
    icon: "package",
    color: "#475569",
    category: "commerce",
    requirement: 20,
    requirementType: "products",
  },
  // Expertise Badges
  {
    id: "knowledge-seeker",
    nameEn: "Knowledge Seeker",
    nameBn: "জ্ঞান অন্বেষণকারী",
    descriptionEn: "Use the AI assistant 10 times",
    descriptionBn: "AI সহায়ক ১০ বার ব্যবহার করুন",
    icon: "cpu",
    color: "#00ACC1",
    category: "expertise",
    requirement: 10,
    requirementType: "ai_usage",
  },
  {
    id: "disease-detective",
    nameEn: "Disease Detective",
    nameBn: "রোগ ডিটেক্টিভ",
    descriptionEn: "Use disease detection 5 times",
    descriptionBn: "রোগ সনাক্তকরণ ৫ বার ব্যবহার করুন",
    icon: "search",
    color: "#65A30D",
    category: "expertise",
    requirement: 5,
    requirementType: "disease_detection",
  },
  {
    id: "expert-consultant",
    nameEn: "Expert Consultant",
    nameBn: "বিশেষজ্ঞ পরামর্শদাতা",
    descriptionEn: "Consult with 5 different experts",
    descriptionBn: "৫ জন বিভিন্ন বিশেষজ্ঞের সাথে পরামর্শ করুন",
    icon: "user-check",
    color: "#009688",
    category: "expertise",
    requirement: 5,
    requirementType: "expert_consultations",
  },
  // Special Badges
  {
    id: "welfare-member",
    nameEn: "Welfare Member",
    nameBn: "কল্যাণ সদস্য",
    descriptionEn: "Join the Fish Welfare Association",
    descriptionBn: "মৎস্য কল্যাণ সমিতিতে যোগ দিন",
    icon: "heart",
    color: "#1D4ED8",
    category: "special",
    requirement: 1,
    requirementType: "welfare_membership",
  },
  {
    id: "summit-member",
    nameEn: "Summit Member",
    nameBn: "সামিট সদস্য",
    descriptionEn: "Register for the International Fish Summit",
    descriptionBn: "আন্তর্জাতিক মৎস্য সামিটে নিবন্ধন করুন",
    icon: "globe",
    color: "#0D47A1",
    category: "special",
    requirement: 1,
    requirementType: "summit_membership",
  },
];

export const LEVELS: Level[] = [
  { level: 1, nameEn: "Newcomer", nameBn: "নতুন সদস্য", minPoints: 0 },
  { level: 2, nameEn: "Beginner", nameBn: "শিক্ষানবিশ", minPoints: 100 },
  { level: 3, nameEn: "Explorer", nameBn: "অন্বেষক", minPoints: 250 },
  { level: 4, nameEn: "Contributor", nameBn: "অবদানকারী", minPoints: 500 },
  { level: 5, nameEn: "Enthusiast", nameBn: "উৎসাহী", minPoints: 1000 },
  { level: 6, nameEn: "Expert", nameBn: "বিশেষজ্ঞ", minPoints: 2000 },
  { level: 7, nameEn: "Master", nameBn: "মাস্টার", minPoints: 3500 },
  { level: 8, nameEn: "Champion", nameBn: "চ্যাম্পিয়ন", minPoints: 5000 },
  { level: 9, nameEn: "Legend", nameBn: "কিংবদন্তি", minPoints: 7500 },
  { level: 10, nameEn: "Grandmaster", nameBn: "গ্র্যান্ডমাস্টার", minPoints: 10000 },
];

export const POINT_VALUES = {
  post: 10,
  comment: 5,
  like: 2,
  share: 8,
  product: 15,
  sale: 25,
  purchase: 10,
  referral: 50,
  login: 5,
  ai_usage: 3,
  expert_consultation: 20,
  disease_detection: 5,
};

interface GamificationState {
  points: number;
  earnedBadges: EarnedBadge[];
  loginStreak: number;
  lastLoginDate: string | null;
  stats: {
    posts: number;
    comments: number;
    sales: number;
    products: number;
    followers: number;
    referrals: number;
    ai_usage: number;
    disease_detection: number;
    expert_consultations: number;
    welfare_membership: number;
    summit_membership: number;
  };

  addPoints: (action: keyof typeof POINT_VALUES) => void;
  earnBadge: (badgeId: string) => void;
  incrementStat: (stat: keyof GamificationState["stats"]) => void;
  recordLogin: () => void;
  getLevel: () => { current: Level; next: Level | null; progress: number };
  checkBadges: () => void;
}

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      points: 0,
      earnedBadges: [],
      loginStreak: 0,
      lastLoginDate: null,
      stats: {
        posts: 0,
        comments: 0,
        sales: 0,
        products: 0,
        followers: 0,
        referrals: 0,
        ai_usage: 0,
        disease_detection: 0,
        expert_consultations: 0,
        welfare_membership: 0,
        summit_membership: 0,
      },

      addPoints: (action) => {
        const pointValue = POINT_VALUES[action];
        set((state) => ({ points: state.points + pointValue }));
      },

      earnBadge: (badgeId) => {
        const { earnedBadges } = get();
        if (earnedBadges.some((eb) => eb.badgeId === badgeId)) return;

        set((state) => ({
          earnedBadges: [
            ...state.earnedBadges,
            { badgeId, earnedAt: Date.now() },
          ],
        }));
      },

      incrementStat: (stat) => {
        set((state) => ({
          stats: {
            ...state.stats,
            [stat]: state.stats[stat] + 1,
          },
        }));
        get().checkBadges();
      },

      recordLogin: () => {
        const today = new Date().toDateString();
        const { lastLoginDate, loginStreak } = get();

        if (lastLoginDate === today) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        let newStreak = 1;
        if (lastLoginDate === yesterday.toDateString()) {
          newStreak = loginStreak + 1;
        }

        set({
          loginStreak: newStreak,
          lastLoginDate: today,
          points: get().points + POINT_VALUES.login,
        });

        get().checkBadges();
      },

      getLevel: () => {
        const { points } = get();
        let currentLevel = LEVELS[0];
        let nextLevel: Level | null = LEVELS[1];

        for (let i = LEVELS.length - 1; i >= 0; i--) {
          if (points >= LEVELS[i].minPoints) {
            currentLevel = LEVELS[i];
            nextLevel = LEVELS[i + 1] || null;
            break;
          }
        }

        let progress = 100;
        if (nextLevel) {
          const pointsInLevel = points - currentLevel.minPoints;
          const pointsNeeded = nextLevel.minPoints - currentLevel.minPoints;
          progress = Math.min((pointsInLevel / pointsNeeded) * 100, 100);
        }

        return { current: currentLevel, next: nextLevel, progress };
      },

      checkBadges: () => {
        const { stats, loginStreak, earnedBadges, earnBadge } = get();

        BADGES.forEach((badge) => {
          if (earnedBadges.some((eb) => eb.badgeId === badge.id)) return;

          let currentValue = 0;
          switch (badge.requirementType) {
            case "posts":
              currentValue = stats.posts;
              break;
            case "comments":
              currentValue = stats.comments;
              break;
            case "sales":
              currentValue = stats.sales;
              break;
            case "products":
              currentValue = stats.products;
              break;
            case "followers":
              currentValue = stats.followers;
              break;
            case "referrals":
              currentValue = stats.referrals;
              break;
            case "ai_usage":
              currentValue = stats.ai_usage;
              break;
            case "disease_detection":
              currentValue = stats.disease_detection;
              break;
            case "expert_consultations":
              currentValue = stats.expert_consultations;
              break;
            case "welfare_membership":
              currentValue = stats.welfare_membership;
              break;
            case "summit_membership":
              currentValue = stats.summit_membership;
              break;
            case "streak":
              currentValue = loginStreak;
              break;
          }

          if (currentValue >= badge.requirement) {
            earnBadge(badge.id);
          }
        });
      },
    }),
    {
      name: "gamification-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
