import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userInitials: string;
  userAvatarId?: string;
  userAvatarColor?: string;
  isVerifiedPurchase: boolean;
  rating: number;
  title: string;
  content: string;
  images: string[];
  helpfulCount: number;
  notHelpfulCount: number;
  sellerReply?: {
    content: string;
    repliedAt: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ReviewSummary {
  productId: string;
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  verifiedPurchaseCount: number;
  withPhotosCount: number;
}

interface ProductReviewState {
  reviews: ProductReview[];
  userVotes: Record<string, "helpful" | "not_helpful">;
  
  addReview: (review: Omit<ProductReview, "id" | "createdAt" | "updatedAt" | "helpfulCount" | "notHelpfulCount">) => void;
  updateReview: (reviewId: string, updates: Partial<ProductReview>) => void;
  deleteReview: (reviewId: string) => void;
  addSellerReply: (reviewId: string, content: string) => void;
  voteReview: (reviewId: string, vote: "helpful" | "not_helpful") => void;
  getProductReviews: (productId: string) => ProductReview[];
  getReviewSummary: (productId: string) => ReviewSummary;
  getUserReviews: (userId: string) => ProductReview[];
  canUserReview: (productId: string, userId: string) => boolean;
}

const MOCK_REVIEWS: ProductReview[] = [
  {
    id: "r1",
    productId: "demo_1",
    userId: "u1",
    userName: "করিম সাহেব",
    userInitials: "কস",
    isVerifiedPurchase: true,
    rating: 5,
    title: "চমৎকার মানের টমেটো!",
    content: "অনেক তাজা এবং সুস্বাদু। পরিবারের সবাই খুব পছন্দ করেছে। আবার অর্ডার করব।",
    images: ["https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200"],
    helpfulCount: 24,
    notHelpfulCount: 2,
    createdAt: Date.now() - 7 * 24 * 3600000,
    updatedAt: Date.now() - 7 * 24 * 3600000,
    sellerReply: {
      content: "ধন্যবাদ আপনার সুন্দর রিভিউর জন্য! আমরা সবসময় সেরা মানের পণ্য দেওয়ার চেষ্টা করি।",
      repliedAt: Date.now() - 6 * 24 * 3600000,
    },
  },
  {
    id: "r2",
    productId: "demo_1",
    userId: "u2",
    userName: "ফাতেমা বেগম",
    userInitials: "ফব",
    isVerifiedPurchase: true,
    rating: 4,
    title: "ভালো, কিন্তু দাম একটু বেশি",
    content: "টমেটোর মান ভালো, কিন্তু দাম স্থানীয় বাজারের চেয়ে একটু বেশি। তবে জৈব হওয়ায় এটা গ্রহণযোগ্য।",
    images: [],
    helpfulCount: 12,
    notHelpfulCount: 3,
    createdAt: Date.now() - 14 * 24 * 3600000,
    updatedAt: Date.now() - 14 * 24 * 3600000,
  },
  {
    id: "r3",
    productId: "demo_1",
    userId: "u3",
    userName: "রহিম উদ্দিন",
    userInitials: "রউ",
    isVerifiedPurchase: false,
    rating: 3,
    title: "মোটামুটি",
    content: "আশা করেছিলাম আরো ভালো হবে। কিছু টমেটো একটু পাকা ছিল।",
    images: [],
    helpfulCount: 5,
    notHelpfulCount: 8,
    createdAt: Date.now() - 21 * 24 * 3600000,
    updatedAt: Date.now() - 21 * 24 * 3600000,
  },
];

export const useProductReviewStore = create<ProductReviewState>()(
  persist(
    (set, get) => ({
      reviews: MOCK_REVIEWS,
      userVotes: {},

      addReview: (review) => {
        const newReview: ProductReview = {
          id: Date.now().toString(),
          ...review,
          helpfulCount: 0,
          notHelpfulCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          reviews: [newReview, ...state.reviews],
        }));
      },

      updateReview: (reviewId, updates) => {
        set((state) => ({
          reviews: state.reviews.map((r) =>
            r.id === reviewId ? { ...r, ...updates, updatedAt: Date.now() } : r
          ),
        }));
      },

      deleteReview: (reviewId) => {
        set((state) => ({
          reviews: state.reviews.filter((r) => r.id !== reviewId),
        }));
      },

      addSellerReply: (reviewId, content) => {
        set((state) => ({
          reviews: state.reviews.map((r) =>
            r.id === reviewId
              ? { ...r, sellerReply: { content, repliedAt: Date.now() } }
              : r
          ),
        }));
      },

      voteReview: (reviewId, vote) => {
        const currentVote = get().userVotes[reviewId];
        
        set((state) => {
          let newReviews = state.reviews;
          let newUserVotes = { ...state.userVotes };

          if (currentVote === vote) {
            delete newUserVotes[reviewId];
            newReviews = state.reviews.map((r) => {
              if (r.id === reviewId) {
                return {
                  ...r,
                  helpfulCount: vote === "helpful" ? r.helpfulCount - 1 : r.helpfulCount,
                  notHelpfulCount: vote === "not_helpful" ? r.notHelpfulCount - 1 : r.notHelpfulCount,
                };
              }
              return r;
            });
          } else {
            newUserVotes[reviewId] = vote;
            newReviews = state.reviews.map((r) => {
              if (r.id === reviewId) {
                return {
                  ...r,
                  helpfulCount: vote === "helpful"
                    ? r.helpfulCount + 1
                    : currentVote === "helpful"
                    ? r.helpfulCount - 1
                    : r.helpfulCount,
                  notHelpfulCount: vote === "not_helpful"
                    ? r.notHelpfulCount + 1
                    : currentVote === "not_helpful"
                    ? r.notHelpfulCount - 1
                    : r.notHelpfulCount,
                };
              }
              return r;
            });
          }

          return { reviews: newReviews, userVotes: newUserVotes };
        });
      },

      getProductReviews: (productId) => {
        return get().reviews.filter((r) => r.productId === productId);
      },

      getReviewSummary: (productId) => {
        const productReviews = get().getProductReviews(productId);
        
        const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let totalRating = 0;
        let verifiedCount = 0;
        let withPhotosCount = 0;

        productReviews.forEach((r) => {
          ratingBreakdown[r.rating as keyof typeof ratingBreakdown]++;
          totalRating += r.rating;
          if (r.isVerifiedPurchase) verifiedCount++;
          if (r.images.length > 0) withPhotosCount++;
        });

        return {
          productId,
          averageRating: productReviews.length > 0 ? totalRating / productReviews.length : 0,
          totalReviews: productReviews.length,
          ratingBreakdown,
          verifiedPurchaseCount: verifiedCount,
          withPhotosCount,
        };
      },

      getUserReviews: (userId) => {
        return get().reviews.filter((r) => r.userId === userId);
      },

      canUserReview: (productId, userId) => {
        const existingReview = get().reviews.find(
          (r) => r.productId === productId && r.userId === userId
        );
        return !existingReview;
      },
    }),
    {
      name: "product-review-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
