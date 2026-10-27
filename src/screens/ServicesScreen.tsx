import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@/components/icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - Spacing.xl * 3) / 2;

interface ServiceItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  colors: [string, string];
  badge?: string;
  badgeColor?: string;
  route: string;
}

const SERVICES: ServiceItem[] = [
  {
    id: "experts",
    title: "বিশেষজ্ঞ",
    subtitle: "কৃষি বিশেষজ্ঞদের সাথে কথা বলুন",
    icon: "award",
    colors: ["#4ECDC4", "#2ECC71"],
    route: "Experts",
  },
  {
    id: "groups",
    title: "গ্রুপ ও ফোরাম",
    subtitle: "বিষয়ভিত্তিক গ্রুপে যোগ দিন",
    icon: "users",
    colors: ["#3498DB", "#2980B9"],
    route: "Groups",
  },
  {
    id: "polls",
    title: "পোল ও সার্ভে",
    subtitle: "কমিউনিটির মতামত জানুন",
    icon: "bar-chart-2",
    colors: ["#9B59B6", "#8E44AD"],
    route: "Polls",
  },
  {
    id: "dailyTips",
    title: "দৈনিক টিপস",
    subtitle: "কৃষি পরামর্শ",
    icon: "sun",
    colors: ["#F39C12", "#E67E22"],
    route: "DailyTips",
  },
  {
    id: "voiceRooms",
    title: "ভয়েস রুম",
    subtitle: "লাইভ অডিও আলোচনা",
    icon: "radio",
    colors: ["#FF4BB7", "#FF4BB7"],
    badge: "LIVE",
    badgeColor: "#DA2F2F",
    route: "VoiceRooms",
  },
  {
    id: "expertQA",
    title: "বিশেষজ্ঞ প্রশ্নোত্তর",
    subtitle: "লাইভ সেশনে জিজ্ঞাসা করুন",
    icon: "help-circle",
    colors: ["#2ECC71", "#27AE60"],
    route: "ExpertQA",
  },
  {
    id: "nearbyFarmers",
    title: "কাছের কৃষক",
    subtitle: "আপনার এলাকার কৃষকদের খুঁজুন",
    icon: "map-pin",
    colors: ["#1ABC9C", "#16A085"],
    route: "NearbyFarmers",
  },
  {
    id: "stories",
    title: "স্টোরি",
    subtitle: "২৪ ঘণ্টার আপডেট",
    icon: "circle",
    colors: ["#FF6B6B", "#FF4BB7"],
    badge: "NEW",
    badgeColor: "#FF4BB7",
    route: "Stories",
  },
  {
    id: "notifications",
    title: "নোটিফিকেশন",
    subtitle: "সব আপডেট এক জায়গায়",
    icon: "bell",
    colors: ["#B25E09", "#B25E09"],
    badge: "3",
    badgeColor: "#DA2F2F",
    route: "Notifications",
  },
  {
    id: "leaderboard",
    title: "লিডারবোর্ড",
    subtitle: "সেরা কৃষকদের দেখুন",
    icon: "trending-up",
    colors: ["#F5B700", "#B25E09"],
    route: "Leaderboard",
  },
  {
    id: "userSearch",
    title: "ব্যবহারকারী খুঁজুন",
    subtitle: "কৃষক ও বিশেষজ্ঞ খুঁজুন",
    icon: "search",
    colors: ["#00BB77", "#39B1FE"],
    route: "UserSearch",
  },
  {
    id: "announcements",
    title: "ঘোষণা",
    subtitle: "গুরুত্বপূর্ণ নোটিশ",
    icon: "volume-2",
    colors: ["#4A5568", "#4A5568"],
    route: "Announcements",
  },
  {
    id: "rewards",
    title: "রিওয়ার্ড",
    subtitle: "পয়েন্ট আয় করুন",
    icon: "gift",
    colors: ["#3D38D0", "#3D38D0"],
    badge: "3,500",
    badgeColor: "#2E96EF",
    route: "Rewards",
  },
  {
    id: "liveStream",
    title: "লাইভ স্ট্রিম",
    subtitle: "লাইভ ভিডিও দেখুন",
    icon: "video",
    colors: ["#DA2F2F", "#DA2F2F"],
    badge: "LIVE",
    badgeColor: "#DA2F2F",
    route: "LiveStream",
  },
  {
    id: "trending",
    title: "ট্রেন্ডিং",
    subtitle: "জনপ্রিয় টপিক",
    icon: "trending-up",
    colors: ["#B25E09", "#B25E09"],
    route: "Trending",
  },
  {
    id: "challenges",
    title: "চ্যালেঞ্জ",
    subtitle: "পুরস্কার জিতুন",
    icon: "award",
    colors: ["#F5B700", "#F5B700"],
    badge: "NEW",
    badgeColor: "#F5B700",
    route: "Challenges",
  },
  {
    id: "dailyCheckIn",
    title: "দৈনিক চেক-ইন",
    subtitle: "প্রতিদিন পয়েন্ট পান",
    icon: "calendar",
    colors: ["#2E96EF", "#39B1FE"],
    route: "DailyCheckIn",
  },
  {
    id: "featuredFarmers",
    title: "ফিচার্ড কৃষক",
    subtitle: "সেরা কৃষকদের দেখুন",
    icon: "star",
    colors: ["#2E96EF", "#2E96EF"],
    route: "FeaturedFarmers",
  },
  {
    id: "knowledgeWiki",
    title: "জ্ঞানভাণ্ডার",
    subtitle: "কৃষি তথ্য ভাণ্ডার",
    icon: "book",
    colors: ["#3D38D0", "#3D38D0"],
    route: "KnowledgeWiki",
  },
  {
    id: "mentorship",
    title: "মেন্টরশিপ",
    subtitle: "অভিজ্ঞদের কাছ থেকে শিখুন",
    icon: "user-check",
    colors: ["#00BB77", "#39B1FE"],
    route: "Mentorship",
  },
  {
    id: "cropEncyclopedia",
    title: "ফসল বিশ্বকোষ",
    subtitle: "সব ফসল সম্পর্কে জানুন",
    icon: "book-open",
    colors: ["#00BB77", "#00BB77"],
    route: "CropEncyclopedia",
  },
  {
    id: "farmTours",
    title: "ফার্ম ট্যুর",
    subtitle: "সফল খামার পরিদর্শন",
    icon: "navigation",
    colors: ["#B25E09", "#B25E09"],
    route: "FarmTours",
  },
  {
    id: "skillExchange",
    title: "দক্ষতা বিনিময়",
    subtitle: "জ্ঞান শেয়ার করুন",
    icon: "refresh-cw",
    colors: ["#3D38D0", "#3D38D0"],
    route: "SkillExchange",
  },
  {
    id: "communityStats",
    title: "কমিউনিটি স্ট্যাটস",
    subtitle: "রিয়েল-টাইম ডাটা",
    icon: "bar-chart",
    colors: ["#4A5568", "#4A5568"],
    route: "CommunityStats",
  },
  {
    id: "savedPosts",
    title: "সেভ করা",
    subtitle: "বুকমার্ক করা পোস্ট",
    icon: "bookmark",
    colors: ["#795548", "#5D4037"],
    route: "SavedPosts",
  },
  {
    id: "helpCenter",
    title: "হেল্প সেন্টার",
    subtitle: "সহায়তা নিন",
    icon: "life-buoy",
    colors: ["#FF4BB7", "#FF4BB7"],
    route: "HelpCenter",
  },
  {
    id: "activityFeed",
    title: "কার্যকলাপ",
    subtitle: "সাম্প্রতিক কার্যকলাপ",
    icon: "activity",
    colors: ["#3D38D0", "#512DA8"],
    route: "ActivityFeed",
  },
  {
    id: "qrScanner",
    title: "QR স্ক্যানার",
    subtitle: "পণ্য ও বিক্রেতা যাচাই",
    icon: "maximize",
    colors: ["#1E88E5", "#3D38D0"],
    badge: "NEW",
    badgeColor: "#2E96EF",
    route: "QRScanner",
  },
  {
    id: "farmAnalytics",
    title: "ফার্ম অ্যানালিটিক্স",
    subtitle: "উৎপাদন ও আয়ের বিশ্লেষণ",
    icon: "pie-chart",
    colors: ["#00897B", "#00695C"],
    route: "FarmAnalytics",
  },
  {
    id: "veterinary",
    title: "পশু চিকিৎসা",
    subtitle: "ভেটেরিনারি সেবা",
    icon: "heart",
    colors: ["#E53935", "#DA2F2F"],
    badge: "জরুরি",
    badgeColor: "#DA2F2F",
    route: "Veterinary",
  },
  {
    id: "contractFarming",
    title: "চুক্তিভিত্তিক চাষ",
    subtitle: "কোম্পানির সাথে চুক্তি",
    icon: "file-text",
    colors: ["#5E35B1", "#4527A0"],
    route: "ContractFarming",
  },
  {
    id: "agriNews",
    title: "কৃষি সংবাদ",
    subtitle: "সর্বশেষ কৃষি খবর",
    icon: "rss",
    colors: ["#FB8C00", "#EF6C00"],
    badge: "LIVE",
    badgeColor: "#B25E09",
    route: "AgriNews",
  },
  {
    id: "priceAlert",
    title: "মূল্য সতর্কতা",
    subtitle: "দাম পরিবর্তনের নোটিশ",
    icon: "bell",
    colors: ["#43A047", "#2E96EF"],
    route: "PriceAlert",
  },
  {
    id: "recipeFinder",
    title: "রেসিপি খুঁজুন",
    subtitle: "রান্নার রেসিপি",
    icon: "coffee",
    colors: ["#F4511E", "#D84315"],
    route: "RecipeFinder",
  },
  {
    id: "warehouse",
    title: "গুদাম সেবা",
    subtitle: "স্টোরেজ সুবিধা খুঁজুন",
    icon: "archive",
    colors: ["#6D4C41", "#5D4037"],
    route: "Warehouse",
  },
  {
    id: "qualityTesting",
    title: "গুণমান পরীক্ষা",
    subtitle: "ল্যাব টেস্টিং সেবা",
    icon: "check-square",
    colors: ["#00ACC1", "#00838F"],
    route: "QualityTesting",
  },
  {
    id: "medicalServices",
    title: "স্বাস্থ্য সেবা",
    subtitle: "ডাক্তার খুঁজুন ও আলোচনা",
    icon: "plus-circle",
    colors: ["#DA2F2F", "#DA2F2F"],
    badge: "NEW",
    badgeColor: "#DA2F2F",
    route: "MedicalServices",
  },
  {
    id: "landServices",
    title: "ভূমি সেবা",
    subtitle: "জমি সমস্যা ও সমাধান",
    icon: "map",
    colors: ["#00875A", "#00875A"],
    badge: "NEW",
    badgeColor: "#00BB77",
    route: "LandServices",
  },
  {
    id: "wasteManagement",
    title: "বর্জ্য ব্যবস্থাপনা",
    subtitle: "রিসাইক্লিং ও পরিবেশ",
    icon: "trash-2",
    colors: ["#00BB77", "#2E96EF"],
    badge: "NEW",
    badgeColor: "#00BB77",
    route: "WasteManagement",
  },
  {
    id: "waterServices",
    title: "পানি সেবা",
    subtitle: "সেচ ও পানি সমস্যা",
    icon: "droplet",
    colors: ["#0284C7", "#0369A1"],
    badge: "NEW",
    badgeColor: "#2E96EF",
    route: "WaterServices",
  },
  {
    id: "electricityServices",
    title: "বিদ্যুৎ সেবা",
    subtitle: "সোলার ও বৈদ্যুতিক সমস্যা",
    icon: "zap",
    colors: ["#D97706", "#B25E09"],
    badge: "NEW",
    badgeColor: "#B25E09",
    route: "ElectricityServices",
  },
];

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const handleServicePress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(route as any);
  };

  const renderServiceCard = (service: ServiceItem, index: number) => (
    <Animated.View
      key={service.id}
      entering={FadeInUp.delay(index * 50).duration(400)}
      style={styles.cardWrapper}
    >
      <Pressable
        onPress={() => handleServicePress(service.route)}
        style={({ pressed }) => [
          styles.serviceCard,
          { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)" },
          pressed && styles.cardPressed,
        ]}
      >
        <LinearGradient
          colors={service.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <AppIcon name={service.icon} size={24} color="#FFF" />
        </LinearGradient>
        
        <ThemedText style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
          {service.title}
        </ThemedText>
        <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
          {service.subtitle}
        </ThemedText>
        
        {service.badge ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: service.badgeColor || "#DA2F2F" },
            ]}
          >
            <ThemedText style={styles.badgeText}>{service.badge}</ThemedText>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={isDark ? ["#202936", "#202936"] : ["#F3FAFF", "#e9ecef"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.headerSection}>
          <View style={[styles.headerIcon, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
            <Feather name="grid" size={32} color={theme.primary} />
          </View>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            সেবা সমূহ
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            আপনার জন্য {SERVICES.length}+ সেবা
          </ThemedText>
        </Animated.View>

        <View style={styles.categorySeparator}>
          <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
          <ThemedText style={[styles.categoryLabel, { color: theme.textSecondary, backgroundColor: isDark ? "#202936" : "#F3FAFF" }]}>
            কমিউনিটি
          </ThemedText>
          <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
        </View>

        <View style={styles.gridContainer}>
          {SERVICES.slice(0, 8).map((service, index) => renderServiceCard(service, index))}
        </View>

        <View style={styles.categorySeparator}>
          <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
          <ThemedText style={[styles.categoryLabel, { color: theme.textSecondary, backgroundColor: isDark ? "#202936" : "#F3FAFF" }]}>
            শিক্ষা ও জ্ঞান
          </ThemedText>
          <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
        </View>

        <View style={styles.gridContainer}>
          {SERVICES.slice(8, 16).map((service, index) => renderServiceCard(service, index + 8))}
        </View>

        <View style={styles.categorySeparator}>
          <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
          <ThemedText style={[styles.categoryLabel, { color: theme.textSecondary, backgroundColor: isDark ? "#202936" : "#F3FAFF" }]}>
            অন্যান্য সেবা
          </ThemedText>
          <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
        </View>

        <View style={styles.gridContainer}>
          {SERVICES.slice(16).map((service, index) => renderServiceCard(service, index + 16))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "DMSans_700Bold",
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  categorySeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: Spacing.md,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  serviceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    minHeight: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "DMSans_700Bold",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
