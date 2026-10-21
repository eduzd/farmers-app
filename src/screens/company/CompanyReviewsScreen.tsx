import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useCompanyStore } from "@/lib/companyStore";
import { CompanyReview } from "@/lib/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FILTER_OPTIONS = [
  { id: "all", label: "সব" },
  { id: "5", label: "5 স্টার" },
  { id: "4", label: "4 স্টার" },
  { id: "3", label: "3 স্টার" },
  { id: "2", label: "2 স্টার" },
  { id: "1", label: "1 স্টার" },
  { id: "with_photo", label: "ছবি সহ" },
  { id: "with_reply", label: "উত্তর সহ" },
];

export default function CompanyReviewsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { company, reviews } = useCompanyStore();

  const [filterBy, setFilterBy] = useState("all");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const ratingBreakdown = useMemo(() => {
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review) => {
      const rating = Math.round(review.rating);
      if (rating >= 1 && rating <= 5) {
        breakdown[rating as keyof typeof breakdown]++;
      }
    });
    return breakdown;
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (filterBy === "all") return reviews;
    if (filterBy === "with_photo") return reviews.filter((r) => r.images && r.images.length > 0);
    if (filterBy === "with_reply") return reviews.filter((r) => r.sellerReply);
    const ratingFilter = parseInt(filterBy);
    return reviews.filter((r) => Math.round(r.rating) === ratingFilter);
  }, [reviews, filterBy]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("bn-BD", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "আজ";
    if (diffDays === 1) return "গতকাল";
    if (diffDays < 7) return `${diffDays} দিন আগে`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} সপ্তাহ আগে`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} মাস আগে`;
    return formatDate(dateString);
  };

  const renderStars = (rating: number, size: number = 14) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Feather
            key={star}
            name="star"
            size={size}
            color={star <= rating ? "#F5B700" : theme.textSecondary + "40"}
          />
        ))}
      </View>
    );
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !replyingTo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReplyText("");
    setReplyingTo(null);
  };

  const getRatingPercentage = (rating: number) => {
    if (reviews.length === 0) return 0;
    return (ratingBreakdown[rating as keyof typeof ratingBreakdown] / reviews.length) * 100;
  };

  const renderReview = ({ item }: { item: CompanyReview }) => (
    <View style={[styles.reviewCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={styles.reviewHeader}>
        <UserAvatar
          initials={item.userInitials}
          size="medium"
          isWelfareMember={item.isWelfareMember}
        />
        <View style={styles.reviewInfo}>
          <View style={styles.reviewNameRow}>
            <ThemedText type="h4">{item.userName}</ThemedText>
            {item.verified ? (
              <View style={[styles.verifiedBadge, { backgroundColor: "#16A34A" }]}>
                <Feather name="check" size={10} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <View style={styles.ratingRow}>
            {renderStars(item.rating)}
            <ThemedText style={[styles.dateText, { color: theme.textSecondary }]}>
              {formatRelativeDate(item.createdAt)}
            </ThemedText>
          </View>
        </View>
        <Pressable
          style={[styles.menuButton, { backgroundColor: theme.surface }]}
          onPress={() =>
            Alert.alert(item.userName || "Review", undefined, [
              { text: "Report review", onPress: () => Alert.alert("Reported", "Thanks, our team will check this review.") },
              { text: "Cancel", style: "cancel" },
            ])
          }
        >
          <Feather name="more-horizontal" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      {item.productName ? (
        <View style={[styles.productTag, { backgroundColor: theme.surface }]}>
          <Feather name="package" size={12} color={theme.textSecondary} />
          <ThemedText style={[styles.productTagText, { color: theme.textSecondary }]}>
            {item.productName}
          </ThemedText>
        </View>
      ) : null}

      <ThemedText style={[styles.commentText, { color: theme.text }]}>
        {item.comment}
      </ThemedText>

      {item.images && item.images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
          {item.images.map((_: string, index: number) => (
            <View key={index} style={[styles.reviewImage, { backgroundColor: theme.surface }]}>
              <Feather name="image" size={24} color={theme.textSecondary} />
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.reviewActions}>
        <Pressable style={styles.actionItem}>
          <Feather name="thumbs-up" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
            সহায়ক ({item.helpfulCount || 0})
          </ThemedText>
        </Pressable>
        <Pressable 
          style={styles.actionItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setReplyingTo(item.id);
          }}
        >
          <Feather name="message-circle" size={16} color={theme.primary} />
          <ThemedText style={[styles.actionText, { color: theme.primary }]}>উত্তর দিন</ThemedText>
        </Pressable>
      </View>

      {item.sellerReply ? (
        <View style={[styles.sellerReplyBox, { backgroundColor: theme.primary + "08", borderColor: theme.primary + "20" }]}>
          <View style={styles.sellerReplyHeader}>
            <View style={[styles.sellerBadge, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.sellerBadgeText}>বিক্রেতা</ThemedText>
            </View>
            <ThemedText style={[styles.replyDate, { color: theme.textSecondary }]}>
              {formatRelativeDate(item.sellerReplyDate || item.createdAt)}
            </ThemedText>
          </View>
          <ThemedText style={[styles.sellerReplyText, { color: theme.text }]}>
            {item.sellerReply}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  if (!company) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot, paddingTop: Spacing.xl }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
          প্রথমে কোম্পানি প্রোফাইল তৈরি করুন
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <View style={[styles.summarySection, { paddingTop: Spacing.xl }]}>
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryLeft}>
                <ThemedText style={[styles.bigRating, { color: theme.text }]}>
                  {company.rating.toFixed(1)}
                </ThemedText>
                {renderStars(Math.round(company.rating), 18)}
                <ThemedText style={[styles.totalReviews, { color: theme.textSecondary }]}>
                  {reviews.length} টি রিভিউ
                </ThemedText>
              </View>
              <View style={styles.breakdownSection}>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <View key={rating} style={styles.breakdownRow}>
                    <ThemedText style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
                      {rating}
                    </ThemedText>
                    <Feather name="star" size={12} color="#F5B700" />
                    <View style={[styles.breakdownBarBg, { backgroundColor: theme.surface }]}>
                      <View
                        style={[
                          styles.breakdownBar,
                          { backgroundColor: "#F5B700", width: `${getRatingPercentage(rating)}%` },
                        ]}
                      />
                    </View>
                    <ThemedText style={[styles.breakdownCount, { color: theme.textSecondary }]}>
                      {ratingBreakdown[rating as keyof typeof ratingBreakdown]}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.satisfactionRow}>
              <View style={styles.satisfactionItem}>
                <Feather name="smile" size={20} color="#16A34A" />
                <View>
                  <ThemedText style={styles.satisfactionValue}>৯৮%</ThemedText>
                  <ThemedText style={[styles.satisfactionLabel, { color: theme.textSecondary }]}>
                    সন্তুষ্টির হার
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.satisfactionDivider, { backgroundColor: theme.cardBorder }]} />
              <View style={styles.satisfactionItem}>
                <Feather name="repeat" size={20} color="#2563EB" />
                <View>
                  <ThemedText style={styles.satisfactionValue}>৮৫%</ThemedText>
                  <ThemedText style={[styles.satisfactionLabel, { color: theme.textSecondary }]}>
                    পুনরায় অর্ডার
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.filterSection, { backgroundColor: theme.backgroundRoot }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.filterChip,
                  { borderColor: theme.cardBorder },
                  filterBy === option.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => setFilterBy(option.id)}
              >
                <ThemedText
                  style={[styles.filterChipText, filterBy === option.id && { color: "#FFFFFF" }]}
                >
                  {option.label}
                  {option.id !== "all" && option.id !== "with_photo" && option.id !== "with_reply" ? (
                    ` (${ratingBreakdown[parseInt(option.id) as keyof typeof ratingBreakdown]})`
                  ) : null}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.reviewsSection}>
          {filteredReviews.length > 0 ? (
            filteredReviews.map((review) => (
              <View key={review.id}>{renderReview({ item: review })}</View>
            ))
          ) : (
            <View style={styles.emptyList}>
              <LinearGradient
                colors={[theme.primary + "30", theme.primary + "10"]}
                style={styles.emptyIcon}
              >
                <Feather name="star" size={48} color={theme.primary} />
              </LinearGradient>
              <ThemedText type="h4" style={styles.emptyTitle}>
                {filterBy === "all" ? "কোনো রিভিউ নেই" : "এই ফিল্টারে কোনো রিভিউ নেই"}
              </ThemedText>
              <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>
                {filterBy === "all"
                  ? "গ্রাহকরা আপনার কোম্পানি বা পণ্যের রিভিউ দিলে এখানে দেখা যাবে"
                  : "অন্য ফিল্টার চেষ্টা করুন"}
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={replyingTo !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyingTo(null)}
      >
        <View style={styles.replyModalBackdrop}>
          <View style={[styles.replyModalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.replyModalHeader}>
              <ThemedText type="h4">উত্তর দিন</ThemedText>
              <Pressable onPress={() => setReplyingTo(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <TextInput
              style={[styles.replyInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
              placeholder="আপনার উত্তর লিখুন..."
              placeholderTextColor={theme.textSecondary}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              autoFocus
            />
            <Pressable
              style={[styles.sendReplyButton, { backgroundColor: theme.primary }]}
              onPress={handleSendReply}
            >
              <Feather name="send" size={18} color="#FFFFFF" />
              <ThemedText style={styles.sendReplyText}>পাঠান</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
  summarySection: {
    paddingHorizontal: Spacing.lg,
  },
  summaryCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadows.small,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  summaryLeft: {
    alignItems: "center",
    paddingRight: Spacing.xl,
    borderRightWidth: 1,
    borderRightColor: "transparent",
  },
  bigRating: {
    fontSize: 52,
    fontFamily: "PlusJakartaSans_700Bold",
    lineHeight: 58,
  },
  totalReviews: {
    marginTop: Spacing.sm,
    fontSize: 13,
  },
  breakdownSection: {
    flex: 1,
    paddingLeft: Spacing.lg,
    gap: Spacing.xs,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  breakdownLabel: {
    width: 14,
    fontSize: 12,
    textAlign: "center",
  },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  breakdownBar: {
    height: 6,
    borderRadius: 3,
  },
  breakdownCount: {
    width: 24,
    fontSize: 11,
    textAlign: "right",
  },
  satisfactionRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  satisfactionItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  satisfactionDivider: {
    width: 1,
    height: 40,
  },
  satisfactionValue: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  satisfactionLabel: {
    fontSize: 11,
  },
  filterSection: {
    paddingVertical: Spacing.md,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  filterChipText: {
    fontSize: 13,
  },
  reviewsSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 2,
  },
  emptyList: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    marginBottom: Spacing.sm,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  reviewCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  reviewInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  reviewNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  dateText: {
    fontSize: 12,
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  productTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  productTagText: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 24,
    marginTop: Spacing.sm,
  },
  imagesScroll: {
    marginTop: Spacing.md,
  },
  reviewImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  reviewActions: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    gap: Spacing.xl,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 13,
  },
  sellerReplyBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  sellerReplyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sellerBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  sellerBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  replyDate: {
    fontSize: 11,
  },
  sellerReplyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  replyModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  replyModalContent: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadows.large,
  },
  replyModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  replyInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    minHeight: 100,
    textAlignVertical: "top",
  },
  sendReplyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  sendReplyText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
