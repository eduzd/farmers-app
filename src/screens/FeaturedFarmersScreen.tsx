import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
const { width } = Dimensions.get("window");

interface FeaturedFarmer {
  id: string;
  name: string;
  avatar: string;
  coverImage: string;
  location: string;
  specialty: string;
  story: string;
  followers: number;
  posts: number;
  achievements: string[];
  isFollowing: boolean;
  featuredFor: string;
  rating: number;
}

const FEATURED_FARMERS: FeaturedFarmer[] = [];

const RISING_STARS: FeaturedFarmer[] = [];

export default function FeaturedFarmersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [farmers, setFarmers] = useState(FEATURED_FARMERS);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleFollow = (farmerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFarmers(prev =>
      prev.map(f => (f.id === farmerId ? { ...f, isFollowing: !f.isFollowing, followers: f.isFollowing ? f.followers - 1 : f.followers + 1 } : f))
    );
  };

  const renderFeatured = ({ item, index }: { item: FeaturedFarmer; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 100)}>
      <Pressable
        style={[styles.featuredCard]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Image source={{ uri: item.coverImage }} style={styles.coverImage} contentFit="cover" />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={styles.coverGradient} />
        
        <View style={styles.featuredBadge}>
          <Feather name="award" size={12} color="#F5B700" />
          <ThemedText style={styles.featuredBadgeText}>{item.featuredFor}</ThemedText>
        </View>

        <View style={styles.featuredContent}>
          <View style={styles.avatarRow}>
            <Image source={{ uri: item.avatar }} style={styles.featuredAvatar} />
            <View style={styles.featuredInfo}>
              <ThemedText style={styles.featuredName}>{item.name}</ThemedText>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={10} color="rgba(255,255,255,0.8)" />
                <ThemedText style={styles.locationText}>{item.location}</ThemedText>
              </View>
            </View>
            <View style={styles.ratingBadge}>
              <Feather name="star" size={12} color="#F5B700" />
              <ThemedText style={styles.ratingText}>{item.rating}</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.specialty}>{item.specialty}</ThemedText>
          <ThemedText style={styles.story} numberOfLines={2}>{item.story}</ThemedText>

          <View style={styles.achievementsRow}>
            {item.achievements.slice(0, 2).map((ach, idx) => (
              <View key={idx} style={styles.achievementBadge}>
                <ThemedText style={styles.achievementText}>{ach}</ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.featuredFooter}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{(item.followers / 1000).toFixed(1)}k</ThemedText>
                <ThemedText style={styles.statLabel}>ফলোয়ার</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{item.posts}</ThemedText>
                <ThemedText style={styles.statLabel}>পোস্ট</ThemedText>
              </View>
            </View>
            <Pressable
              style={[styles.followButton, item.isFollowing && styles.followingButton]}
              onPress={() => handleFollow(item.id)}
            >
              <ThemedText style={[styles.followButtonText, item.isFollowing && { color: "#2FA36B" }]}>
                {item.isFollowing ? "ফলো করছেন" : "ফলো করুন"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderRisingStar = ({ item, index }: { item: FeaturedFarmer; index: number }) => (
    <Animated.View entering={FadeInRight.delay(index * 50)}>
      <Pressable
        style={[styles.risingCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Image source={{ uri: item.avatar }} style={styles.risingAvatar} />
        <View style={styles.risingInfo}>
          <ThemedText style={[styles.risingName, { color: theme.text }]}>{item.name}</ThemedText>
          <ThemedText style={[styles.risingSpecialty, { color: theme.textSecondary }]}>{item.specialty}</ThemedText>
          <View style={[styles.risingBadge, { backgroundColor: "#2FA36B15" }]}>
            <Feather name="trending-up" size={10} color="#2FA36B" />
            <ThemedText style={[styles.risingBadgeText, { color: "#2FA36B" }]}>{item.featuredFor}</ThemedText>
          </View>
        </View>
        <Pressable
          style={[styles.risingFollowBtn, { backgroundColor: item.isFollowing ? theme.card : theme.primary }]}
          onPress={() => handleFollow(item.id)}
        >
          <AppIcon name={item.isFollowing ? "check" : "plus"} size={16} color={item.isFollowing ? theme.primary : "#fff"} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <ThemedText style={[styles.title, { color: theme.text }]}>ফিচার্ড কৃষক</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            কমিউনিটির সেরা ও অনুপ্রেরণাদায়ী কৃষকরা
          </ThemedText>
        </Animated.View>

        <View style={styles.featuredSection}>
          {farmers.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
          {farmers.map((farmer, index) => renderFeatured({ item: farmer, index }))}
        </View>

        <View style={styles.risingSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Feather name="trending-up" size={18} color="#2FA36B" />
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>উদীয়মান তারকা</ThemedText>
            </View>
            <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              দ্রুত জনপ্রিয়তা পাচ্ছেন
            </ThemedText>
          </View>
          {RISING_STARS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
          {RISING_STARS.map((farmer, index) => renderRisingStar({ item: farmer, index }))}
        </View>

        <Animated.View entering={FadeInUp.delay(400)} style={[styles.ctaCard, { backgroundColor: theme.primary }]}>
          <Feather name="award" size={32} color="#fff" />
          <View style={styles.ctaContent}>
            <ThemedText style={styles.ctaTitle}>ফিচার্ড হতে চান?</ThemedText>
            <ThemedText style={styles.ctaDescription}>
              সক্রিয় থাকুন, মানসম্মত পোস্ট করুন এবং কমিউনিটিকে সাহায্য করুন
            </ThemedText>
          </View>
          <Pressable style={styles.ctaButton}>
            <ThemedText style={styles.ctaButtonText}>আরও জানুন</ThemedText>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { paddingTop: Spacing.md, marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  featuredSection: { gap: Spacing.lg },
  featuredCard: { borderRadius: BorderRadius.xl, overflow: "hidden", height: 320 },
  coverImage: { width: "100%", height: "100%", position: "absolute" },
  coverGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: "70%" },
  featuredBadge: { position: "absolute", top: Spacing.md, left: Spacing.md, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4 },
  featuredBadgeText: { color: "#F5B700", fontSize: 11, fontWeight: "600" },
  featuredContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: Spacing.md },
  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  featuredAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: "#fff" },
  featuredInfo: { flex: 1, marginLeft: Spacing.sm },
  featuredName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  ratingBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4 },
  ratingText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  specialty: { color: "#2FA36B", fontSize: 13, fontWeight: "500", marginBottom: 4 },
  story: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 18, marginBottom: Spacing.sm },
  achievementsRow: { flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.md },
  achievementBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  achievementText: { color: "#fff", fontSize: 10 },
  featuredFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statsRow: { flexDirection: "row", gap: Spacing.lg },
  statItem: { alignItems: "center" },
  statValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10 },
  followButton: { backgroundColor: "#fff", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  followingButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#2FA36B" },
  followButtonText: { color: "#000", fontSize: 13, fontWeight: "600" },
  risingSection: { marginTop: Spacing.xl },
  sectionHeader: { marginBottom: Spacing.md },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  sectionSubtitle: { fontSize: 12, marginTop: 2 },
  risingCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  risingAvatar: { width: 50, height: 50, borderRadius: 25 },
  risingInfo: { flex: 1, marginLeft: Spacing.md },
  risingName: { fontSize: 15, fontWeight: "600" },
  risingSpecialty: { fontSize: 12, marginTop: 2 },
  risingBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4, alignSelf: "flex-start", marginTop: 4 },
  risingBadgeText: { fontSize: 10, fontWeight: "500" },
  risingFollowBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  ctaCard: { marginTop: Spacing.xl, padding: Spacing.lg, borderRadius: BorderRadius.xl, flexDirection: "row", alignItems: "center" },
  ctaContent: { flex: 1, marginLeft: Spacing.md },
  ctaTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ctaDescription: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
  ctaButton: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  ctaButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
