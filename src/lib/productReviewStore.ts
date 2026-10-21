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

const MOCK_REVIEWS: ProductReview[] = [];

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
      // v2: the sample entries older versions saved on the phone are removed; real ones stay.
      version: 2,
      migrate: (persisted: any) => {
        const sample = new Set(["r1", "r2", "r3"]);
        if (persisted && Array.isArray(persisted.reviews)) {
          persisted.reviews = persisted.reviews.filter((x: any) => !sample.has(x?.id));
        }
        return persisted;
      },
    }
  )
);
