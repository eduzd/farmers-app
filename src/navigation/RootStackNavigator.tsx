import { useI18n } from "@/lib/i18n";
import { tr } from "@/lib/tr";
import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigatorScreenParams } from "@react-navigation/native";

import { useAuthStore, MembershipApplication } from "@/lib/authStore";
import { useTheme } from "@/hooks/useTheme";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";
import LandingScreen from "@/screens/LandingScreen";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import OnboardingRoleScreen from "@/screens/OnboardingRoleScreen";
import OnboardingProfileScreen from "@/screens/OnboardingProfileScreen";
import SupportScreen from "@/screens/SupportScreen";
import PostDetailScreen from "@/screens/PostDetailScreen";
import ChatScreen from "@/screens/ChatScreen";
import RfqScreen from "@/screens/RfqScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ApplicationDetailScreen from "@/screens/ApplicationDetailScreen";
import ApplicationsListScreen from "@/screens/ApplicationsListScreen";
import ProductDetailScreen from "@/screens/ProductDetailScreen";
import CartScreen from "@/screens/CartScreen";
import CheckoutScreen from "@/screens/CheckoutScreen";
import OrdersScreen from "@/screens/OrdersScreen";
import OrderDetailScreen from "@/screens/OrderDetailScreen";
import ToolsScreen from "@/screens/ToolsScreen";
import DiseaseDetectorScreen from "@/screens/DiseaseDetectorScreen";
import AIAssistantScreen from "@/screens/AIAssistantScreen";
import VoiceCallScreen from "@/screens/VoiceCallScreen";
import WeatherScreen from "@/screens/WeatherScreen";
import FarmNotesScreen from "@/screens/FarmNotesScreen";
import LandConverterScreen from "@/screens/LandConverterScreen";
import FertilizerCalculatorScreen from "@/screens/FertilizerCalculatorScreen";
import CropCalendarScreen from "@/screens/CropCalendarScreen";
import ProfitCalculatorScreen from "@/screens/ProfitCalculatorScreen";
import FeedCalculatorToolScreen from "@/screens/FeedCalculatorScreen";
import ExpertsScreen from "@/screens/ExpertsScreen";
import UserProfileScreen from "@/screens/UserProfileScreen";
import LikesListScreen from "@/screens/LikesListScreen";
import FollowersScreen from "@/screens/FollowersScreen";
import FollowingScreen from "@/screens/FollowingScreen";
import { PublicUser } from "@/lib/storage";
import {
  CalculateHomeScreen,
  BepariCalculatorScreen,
  AratCalculatorScreen,
  FeedCalculatorScreen,
  LedgerScreen,
  LedgerEntryScreen,
  HistoryScreen,
  MonthlySummaryScreen,
  CalculateSettingsScreen,
  RecordDetailScreen,
} from "@/screens/calculate";
import MainTabNavigator, { MainTabParamList } from "@/navigation/MainTabNavigator";
import CompanyTabNavigator from "@/navigation/CompanyTabNavigator";
import StoreViewScreen from "@/screens/StoreViewScreen";
import ShopPageScreen from "@/screens/ShopPageScreen";
import ShopsHomeScreen from "@/screens/ShopsHomeScreen";
import SellerOnboardingScreen from "@/screens/SellerOnboardingScreen";
import AddressManagementScreen from "@/screens/AddressManagementScreen";
import PollsScreen from "@/screens/PollsScreen";
import GroupsScreen from "@/screens/GroupsScreen";
import GroupDetailScreen from "@/screens/GroupDetailScreen";
import WishlistScreen from "@/screens/WishlistScreen";
import FlashSaleScreen from "@/screens/FlashSaleScreen";
import BadgesScreen from "@/screens/BadgesScreen";
import ExpertQAScreen from "@/screens/ExpertQAScreen";
import WalletScreen from "@/screens/WalletScreen";
import MarketPriceScreen from "@/screens/MarketPriceScreen";
import ProductCompareScreen from "@/screens/ProductCompareScreen";
import AuctionScreen from "@/screens/AuctionScreen";
import BulkOrderScreen from "@/screens/BulkOrderScreen";
import DailyTipsScreen from "@/screens/DailyTipsScreen";
import NearbyFarmersScreen from "@/screens/NearbyFarmersScreen";
import DeliveryTrackingScreen from "@/screens/DeliveryTrackingScreen";
import VideoCoursesScreen from "@/screens/VideoCoursesScreen";
import CertificationScreen from "@/screens/CertificationScreen";
import InventoryScreen from "@/screens/InventoryScreen";
import LoanCalculatorScreen from "@/screens/LoanCalculatorScreen";
import EquipmentRentalScreen from "@/screens/EquipmentRentalScreen";
import GovernmentSchemesScreen from "@/screens/GovernmentSchemesScreen";
import SuccessStoriesScreen from "@/screens/SuccessStoriesScreen";
import PodcastsScreen from "@/screens/PodcastsScreen";
import EventsCalendarScreen from "@/screens/EventsCalendarScreen";
import SoilTestingScreen from "@/screens/SoilTestingScreen";
import TransportScreen from "@/screens/TransportScreen";
import EmergencyServicesScreen from "@/screens/EmergencyServicesScreen";
import InsuranceCalculatorScreen from "@/screens/InsuranceCalculatorScreen";
import LaborHiringScreen from "@/screens/LaborHiringScreen";
import ColdStorageScreen from "@/screens/ColdStorageScreen";
import CooperativeScreen from "@/screens/CooperativeScreen";
import WelfareAssociationScreen from "@/screens/WelfareAssociationScreen";
import InternationalFishSummitScreen from "@/screens/InternationalFishSummitScreen";
import SeedFinderScreen from "@/screens/SeedFinderScreen";
import FarmDiaryScreen from "@/screens/FarmDiaryScreen";
import VoiceRoomsScreen from "@/screens/VoiceRoomsScreen";
import VoiceRoomScreen from "@/screens/VoiceRoomScreen";
import VoiceRoomCreateScreen from "@/screens/VoiceRoomCreateScreen";
import StoriesScreen from "@/screens/StoriesScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import NotificationOpenScreen from "@/screens/NotificationOpenScreen";
import LeaderboardScreen from "@/screens/LeaderboardScreen";
import UserSearchScreen from "@/screens/UserSearchScreen";
import AnnouncementsScreen from "@/screens/AnnouncementsScreen";
import RewardsScreen from "@/screens/RewardsScreen";
import LiveStreamScreen from "@/screens/LiveStreamScreen";
import TrendingScreen from "@/screens/TrendingScreen";
import ChallengesScreen from "@/screens/ChallengesScreen";
import SavedPostsScreen from "@/screens/SavedPostsScreen";
import MyPostsScreen from "@/screens/MyPostsScreen";
import FeaturedFarmersScreen from "@/screens/FeaturedFarmersScreen";
import KnowledgeWikiScreen from "@/screens/KnowledgeWikiScreen";
import MentorshipScreen from "@/screens/MentorshipScreen";
import CommunityStatsScreen from "@/screens/CommunityStatsScreen";
import DailyCheckInScreen from "@/screens/DailyCheckInScreen";
import FarmToursScreen from "@/screens/FarmToursScreen";
import SkillExchangeScreen from "@/screens/SkillExchangeScreen";
import HelpCenterScreen from "@/screens/HelpCenterScreen";
import CropEncyclopediaScreen from "@/screens/CropEncyclopediaScreen";
import ActivityFeedScreen from "@/screens/ActivityFeedScreen";
import ServicesScreen from "@/screens/ServicesScreen";
import QRScannerScreen from "@/screens/QRScannerScreen";
import FarmAnalyticsScreen from "@/screens/FarmAnalyticsScreen";
import VeterinaryScreen from "@/screens/VeterinaryScreen";
import ContractFarmingScreen from "@/screens/ContractFarmingScreen";
import AgriNewsScreen from "@/screens/AgriNewsScreen";
import PriceAlertScreen from "@/screens/PriceAlertScreen";
import RecipeFinderScreen from "@/screens/RecipeFinderScreen";
import WarehouseScreen from "@/screens/WarehouseScreen";
import QualityTestingScreen from "@/screens/QualityTestingScreen";
import MedicalServicesScreen from "@/screens/MedicalServicesScreen";
import LandServicesScreen from "@/screens/LandServicesScreen";
import WasteManagementScreen from "@/screens/WasteManagementScreen";
import WaterServicesScreen from "@/screens/WaterServicesScreen";
import ElectricityServicesScreen from "@/screens/ElectricityServicesScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import AdminAppScreen from "@/admin/AdminAppScreen";
import SupportChatScreen from "@/screens/SupportChatScreen";
import SellerAppScreen from "@/screens/seller/SellerAppScreen";
import { getAppVariant } from "@/lib/appVariant";
import SmartFarmingScreen from "@/screens/SmartFarmingScreen";
import WeatherForecastScreen from "@/screens/WeatherForecastScreen";
import MarketPricesScreen from "@/screens/MarketPricesScreen";
import FarmInventoryScreen from "@/screens/FarmInventoryScreen";
import LivestockTrackerScreen from "@/screens/LivestockTrackerScreen";
import ProductTraceabilityScreen from "@/screens/ProductTraceabilityScreen";
import FishEncyclopediaScreen, { Fish } from "@/screens/FishEncyclopediaScreen";
import FishDetailScreen from "@/screens/FishDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { Product } from "@/screens/MarketScreen";

interface PostAuthor {
  id?: string;
  name: string;
  /** Profile badge (farming category or role). */
  badge?: string;
  avatar?: string;
  initials: string;
  avatarId?: string;
  avatarColor?: string;
  isWelfareMember?: boolean;
}

interface Post {
  id: string;
  author: PostAuthor;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  views: number;
  isLiked: boolean;
  createdAt: string;
  /** Lives on the server: likes and comments are shared and notify the author. */
  shared?: boolean;
  /** Saved by the signed-in user (server posts only). */
  isSaved?: boolean;
  /** Set when the post is a poll. */
  poll?: import("@/lib/feedApi").PostPoll | null;
  /** Set when the post shares a voice room. */
  voiceRoom?: import("@/lib/voiceRoomApi").VoiceRoomCard | null;
}

export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Signup: undefined;
  OnboardingRole: undefined;
  OnboardingProfile: undefined;
  Support: undefined;
  SupportChat: undefined;
  Main: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  PostDetail: { postId: string; post: Post; highlightCommentId?: string; scrollToComments?: boolean; commentMissing?: boolean };
  NotificationOpen: { payload: any; markedRead?: boolean };
  Chat: { conversationId: string; userName: string; userInitials: string; isWelfareMember?: boolean; draft?: string };
  Rfq: undefined;
  Settings: { openEditProfile?: boolean } | undefined;
  ProductDetail: { product: Product };
  Cart: undefined;
  Checkout: undefined;
  Orders: undefined;
  OrderDetail: { orderId: string };
  Tools: undefined;
  DiseaseDetector: undefined;
  AIAssistant: undefined;
  VoiceCall: undefined;
  Weather: undefined;
  FarmNotes: undefined;
  LandConverter: undefined;
  FertilizerCalculator: undefined;
  CropCalendar: undefined;
  ProfitCalculator: undefined;
  FeedCalculator: undefined;
  Experts: undefined;
  UserProfile: { user: PublicUser };
  LikesList: { postId: string; likesCount: number };
  Followers: { userId: string; userName: string };
  Following: { userId: string; userName: string };
  Calculate: undefined;
  CalculateBepari: undefined;
  CalculateArat: undefined;
  CalculateFeed: undefined;
  CalculateLedger: undefined;
  CalculateLedgerEntry: { id: string | null };
  CalculateHistory: undefined;
  CalculateMonthlySummary: undefined;
  CalculateSettings: undefined;
  CalculateRecordDetail: { id: string };
  CompanyDashboard: undefined;
  StoreView: { companyId: string };
  /** a shop from the server (company shop or seller's shop); no slug = list of all shops */
  ShopPage: { slug?: string } | undefined;
  ShopsHome: undefined;
  SellerOnboarding: undefined;
  AddressManagement: undefined;
  Polls: undefined;
  Groups: undefined;
  GroupDetail: { group: any };
  Wishlist: undefined;
  FlashSale: undefined;
  Badges: undefined;
  ExpertQA: undefined;
  Wallet: undefined;
  MarketPrice: undefined;
  ProductCompare: undefined;
  Auction: undefined;
  BulkOrder: undefined;
  DailyTips: undefined;
  NearbyFarmers: undefined;
  DeliveryTracking: undefined;
  VideoCourses: undefined;
  Certification: undefined;
  Inventory: undefined;
  LoanCalculator: undefined;
  EquipmentRental: undefined;
  GovernmentSchemes: undefined;
  SuccessStories: undefined;
  Podcasts: undefined;
  EventsCalendar: undefined;
  SoilTesting: undefined;
  Transport: undefined;
  EmergencyServices: undefined;
  InsuranceCalculator: undefined;
  LaborHiring: undefined;
  ColdStorage: undefined;
  Cooperative: undefined;
  WelfareAssociation: undefined;
  InternationalFishSummit: undefined;
  ApplicationsList: undefined;
  ApplicationDetail: { application: MembershipApplication };
  SeedFinder: undefined;
  FarmDiary: undefined;
  VoiceRooms: undefined;
  VoiceRoom: { roomId: string; room?: any; isHost?: boolean };
  VoiceRoomCreate: undefined;
  Stories: undefined;
  Notifications: undefined;
  Leaderboard: undefined;
  UserSearch: undefined;
  Announcements: undefined;
  Rewards: undefined;
  LiveStream: undefined;
  Trending: undefined;
  Challenges: undefined;
  SavedPosts: undefined;
  MyPosts: undefined;
  FeaturedFarmers: undefined;
  KnowledgeWiki: undefined;
  Mentorship: undefined;
  CommunityStats: undefined;
  DailyCheckIn: undefined;
  FarmTours: undefined;
  SkillExchange: undefined;
  HelpCenter: undefined;
  CropEncyclopedia: undefined;
  ActivityFeed: undefined;
  Services: undefined;
  QRScanner: undefined;
  FarmAnalytics: undefined;
  Veterinary: undefined;
  ContractFarming: undefined;
  AgriNews: undefined;
  PriceAlert: undefined;
  RecipeFinder: undefined;
  Warehouse: undefined;
  QualityTesting: undefined;
  MedicalServices: undefined;
  LandServices: undefined;
  WasteManagement: undefined;
  WaterServices: undefined;
  ElectricityServices: undefined;
  AdminDashboard: undefined;
  AdminApp: { openThread?: string } | undefined;
  SellerApp: undefined;
  SmartFarming: undefined;
  WeatherForecast: undefined;
  MarketPrices: undefined;
  FarmInventory: undefined;
  LivestockTracker: undefined;
  ProductTraceability: undefined;
  FishEncyclopedia: undefined;
  FishDetail: { fish: Fish };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  // re-render every screen title when the language changes (Bangla <-> English)
  useI18n((st) => st.language);
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading, onboardingComplete } = useAuthStore();
  const variant = getAppVariant();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      screenLayout={({ children, route, navigation }) => (
        <ScreenErrorBoundary
          screenName={route.name}
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        >
          {children}
        </ScreenErrorBoundary>
      )}
    >
      {!isAuthenticated ? (
        <>
          {variant === "admin" ? (
            // Admin app: open straight on the sign-in screen (the first screen is the start screen).
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          ) : null}
          <Stack.Screen
            name="Landing"
            component={LandingScreen}
            options={{ headerShown: false }}
          />
          {variant !== "admin" ? (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          ) : null}
          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Support"
            component={SupportScreen}
            options={{
              headerTitle: "",
              headerBackTitle: "Back",
            }}
          />
        </>
      ) : !onboardingComplete && variant === "main" ? (
        <>
          <Stack.Screen
            name="OnboardingRole"
            component={OnboardingRoleScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OnboardingProfile"
            component={OnboardingProfileScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <>
          {variant === "seller" ? (
            <Stack.Screen name="SellerApp" component={SellerAppScreen} options={{ headerShown: false, title: "Seller Hub" }} />
          ) : null}
          {variant === "admin" ? (
            <Stack.Screen name="AdminApp" component={AdminAppScreen} options={{ headerShown: false, title: "Farmers Admin" }} />
          ) : null}
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          {variant !== "seller" ? (
            <Stack.Screen name="SellerApp" component={SellerAppScreen} options={{ headerShown: false, title: "Seller Hub" }} />
          ) : null}
          {variant !== "admin" ? (
            <Stack.Screen name="AdminApp" component={AdminAppScreen} options={{ headerShown: false, title: "Farmers Admin" }} />
          ) : null}
          <Stack.Screen name="SupportChat" component={SupportChatScreen} options={{ headerShown: false, title: "Help" }} />
          <Stack.Screen
            name="PostDetail"
            component={PostDetailScreen}
            options={{
              headerTitle: tr("Post"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ route }) => ({
              headerTitle: route.params.userName,
              headerBackTitle: "Back",
              headerTransparent: false,
            })}
          />
          <Stack.Screen
            name="Rfq"
            component={RfqScreen}
            options={{
              headerTitle: tr("RFQ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              headerTitle: tr("Settings"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{
              headerTitle: tr("My Cart"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{
              headerTitle: tr("Checkout"),
              headerBackTitle: "Cart",
              headerTransparent: false,
            }}
          />
          <Stack.Screen
            name="Orders"
            component={OrdersScreen}
            options={{
              headerTitle: tr("My Orders"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen name="NotificationOpen" component={NotificationOpenScreen} options={{ headerTitle: tr("Notification"), headerBackTitle: "Back" }} />
          <Stack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={{
              headerTitle: tr("Order Details"),
              headerBackTitle: "Orders",
            }}
          />
          <Stack.Screen
            name="Tools"
            component={ToolsScreen}
            options={{
              headerTitle: tr("Tools"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="DiseaseDetector"
            component={DiseaseDetectorScreen}
            options={{
              headerTitle: tr("Disease Detector"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="AIAssistant"
            component={AIAssistantScreen}
            options={{
              headerTitle: tr("AI কৃষি সহায়ক"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="VoiceCall"
            component={VoiceCallScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Weather"
            component={WeatherScreen}
            options={{
              headerTitle: tr("আবহাওয়া"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="FarmNotes"
            component={FarmNotesScreen}
            options={{
              headerTitle: tr("ফার্ম নোটস"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="LandConverter"
            component={LandConverterScreen}
            options={{
              headerTitle: tr("জমি পরিমাপ"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="FertilizerCalculator"
            component={FertilizerCalculatorScreen}
            options={{
              headerTitle: tr("সার হিসাব"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="CropCalendar"
            component={CropCalendarScreen}
            options={{
              headerTitle: tr("ফসল ক্যালেন্ডার"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="ProfitCalculator"
            component={ProfitCalculatorScreen}
            options={{
              headerTitle: tr("লাভ-ক্ষতি হিসাব"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="FeedCalculator"
            component={FeedCalculatorToolScreen}
            options={{
              headerTitle: tr("খাদ্য হিসাব"),
              headerBackTitle: "Tools",
            }}
          />
          <Stack.Screen
            name="Experts"
            component={ExpertsScreen}
            options={{
              headerTitle: tr("Experts"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={({ route }) => ({
              headerTitle: route.params.user.name,
              headerBackTitle: "Back",
            })}
          />
          <Stack.Screen
            name="LikesList"
            component={LikesListScreen}
            options={{
              headerTitle: tr("লাইক করেছেন"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Followers"
            component={FollowersScreen}
            options={{
              headerTitle: tr("ফলোয়ার্স"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Following"
            component={FollowingScreen}
            options={{
              headerTitle: tr("ফলোয়িং"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Calculate"
            component={CalculateHomeScreen}
            options={{
              headerTitle: tr("ক্যালকুলেট"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateBepari"
            component={BepariCalculatorScreen}
            options={{
              headerTitle: tr("ব্যাপারী ক্যালকুলেটর"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateArat"
            component={AratCalculatorScreen}
            options={{
              headerTitle: tr("আড়ত ক্যালকুলেটর"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateFeed"
            component={FeedCalculatorScreen}
            options={{
              headerTitle: tr("খাদ্য ক্যালকুলেটর"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateLedger"
            component={LedgerScreen}
            options={{
              headerTitle: tr("খাতা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateLedgerEntry"
            component={LedgerEntryScreen}
            options={{
              headerTitle: tr("হিসাব এন্ট্রি"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateHistory"
            component={HistoryScreen}
            options={{
              headerTitle: tr("ইতিহাস"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateMonthlySummary"
            component={MonthlySummaryScreen}
            options={{
              headerTitle: tr("মাসিক সারাংশ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateSettings"
            component={CalculateSettingsScreen}
            options={{
              headerTitle: tr("সেটিংস"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CalculateRecordDetail"
            component={RecordDetailScreen}
            options={{
              headerTitle: tr("হিসাব বিবরণ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CompanyDashboard"
            component={CompanyTabNavigator}
            options={{
              headerTitle: tr("ভেন্ডর ড্যাশবোর্ড"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="SmartFarming"
            component={SmartFarmingScreen}
            options={{
              headerTitle: tr("স্মার্ট ফার্মিং"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="WeatherForecast"
            component={WeatherForecastScreen}
            options={{
              headerTitle: tr("আবহাওয়া পূর্বাভাস"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="MarketPrices"
            component={MarketPricesScreen}
            options={{
              headerTitle: tr("বাজার দর"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="FarmInventory"
            component={FarmInventoryScreen}
            options={{
              headerTitle: tr("ইনভেন্টরি"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="LivestockTracker"
            component={LivestockTrackerScreen}
            options={{
              headerTitle: tr("পশু ট্র্যাকার"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ProductTraceability"
            component={ProductTraceabilityScreen}
            options={{
              headerTitle: tr("পণ্য ট্রেসেবিলিটি"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="StoreView"
            component={StoreViewScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="ShopPage"
            component={ShopPageScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="ShopsHome"
            component={ShopsHomeScreen}
            options={{
              headerTitle: tr("দোকান সমূহ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="SellerOnboarding"
            component={SellerOnboardingScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AddressManagement"
            component={AddressManagementScreen}
            options={{
              headerTitle: tr("ঠিকানা ম্যানেজমেন্ট"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Polls"
            component={PollsScreen}
            options={{
              headerTitle: tr("পোল ও সার্ভে"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Groups"
            component={GroupsScreen}
            options={{
              headerTitle: tr("গ্রুপ ও ফোরাম"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="GroupDetail"
            component={GroupDetailScreen}
            options={({ route }) => ({
              headerTitle: route.params.group.name,
              headerBackTitle: "Back",
            })}
          />
          <Stack.Screen
            name="Wishlist"
            component={WishlistScreen}
            options={{
              headerTitle: tr("উইশলিস্ট"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="FlashSale"
            component={FlashSaleScreen}
            options={{
              headerTitle: tr("ফ্ল্যাশ সেল"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Badges"
            component={BadgesScreen}
            options={{
              headerTitle: tr("অ্যাচিভমেন্ট ব্যাজ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ExpertQA"
            component={ExpertQAScreen}
            options={{
              headerTitle: tr("এক্সপার্ট Q&A"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Wallet"
            component={WalletScreen}
            options={{
              headerTitle: tr("ওয়ালেট"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="MarketPrice"
            component={MarketPriceScreen}
            options={{
              headerTitle: tr("বাজার দর"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ProductCompare"
            component={ProductCompareScreen}
            options={{
              headerTitle: tr("পণ্য তুলনা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Auction"
            component={AuctionScreen}
            options={{
              headerTitle: tr("নিলাম"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="BulkOrder"
            component={BulkOrderScreen}
            options={{
              headerTitle: tr("বাল্ক অর্ডার"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="DailyTips"
            component={DailyTipsScreen}
            options={{
              headerTitle: tr("দৈনিক টিপস"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="NearbyFarmers"
            component={NearbyFarmersScreen}
            options={{
              headerTitle: tr("কাছের কৃষক ও দোকান"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="DeliveryTracking"
            component={DeliveryTrackingScreen}
            options={{
              headerTitle: tr("ডেলিভারি ট্র্যাকিং"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="VideoCourses"
            component={VideoCoursesScreen}
            options={{
              headerTitle: tr("ভিডিও কোর্স"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Certification"
            component={CertificationScreen}
            options={{
              headerTitle: tr("সার্টিফিকেশন"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Inventory"
            component={InventoryScreen}
            options={{
              headerTitle: tr("ইনভেন্টরি ম্যানেজমেন্ট"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="LoanCalculator"
            component={LoanCalculatorScreen}
            options={{
              headerTitle: tr("ঋণ ক্যালকুলেটর"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="EquipmentRental"
            component={EquipmentRentalScreen}
            options={{
              headerTitle: tr("যন্ত্রপাতি ভাড়া"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="GovernmentSchemes"
            component={GovernmentSchemesScreen}
            options={{
              headerTitle: tr("সরকারি প্রকল্প"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="SuccessStories"
            component={SuccessStoriesScreen}
            options={{
              headerTitle: tr("সফলতার গল্প"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Podcasts"
            component={PodcastsScreen}
            options={{
              headerTitle: tr("পডকাস্ট"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="EventsCalendar"
            component={EventsCalendarScreen}
            options={{
              headerTitle: tr("ইভেন্ট ক্যালেন্ডার"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="SoilTesting"
            component={SoilTestingScreen}
            options={{
              headerTitle: tr("মাটি পরীক্ষা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Transport"
            component={TransportScreen}
            options={{
              headerTitle: tr("পরিবহন সেবা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="EmergencyServices"
            component={EmergencyServicesScreen}
            options={{
              headerTitle: tr("জরুরি সেবা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="InsuranceCalculator"
            component={InsuranceCalculatorScreen}
            options={{
              headerTitle: tr("বীমা ক্যালকুলেটর"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="LaborHiring"
            component={LaborHiringScreen}
            options={{
              headerTitle: tr("শ্রমিক নিয়োগ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ColdStorage"
            component={ColdStorageScreen}
            options={{
              headerTitle: tr("হিমাগার"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Cooperative"
            component={CooperativeScreen}
            options={{
              headerTitle: tr("সমবায় সমিতি"),
            }}
          />
          <Stack.Screen
            name="WelfareAssociation"
            component={WelfareAssociationScreen}
            options={{
              headerTitle: tr("মৎস্য কল্যাণ সমিতি"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="InternationalFishSummit"
            component={InternationalFishSummitScreen}
            options={{
              headerTitle: tr("ইন্টারন্যাশনাল মৎস্য সামিট"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ApplicationsList"
            component={ApplicationsListScreen}
            options={{
              headerTitle: tr("আবেদনসমূহ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ApplicationDetail"
            component={ApplicationDetailScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="SeedFinder"
            component={SeedFinderScreen}
            options={{
              headerTitle: tr("বীজ খুঁজুন"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="FarmDiary"
            component={FarmDiaryScreen}
            options={{
              headerTitle: tr("খামার ডায়েরি"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="VoiceRooms"
            component={VoiceRoomsScreen}
            options={{
              headerTitle: tr("ভয়েস রুম"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="VoiceRoom"
            component={VoiceRoomScreen}
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="VoiceRoomCreate"
            component={VoiceRoomCreateScreen}
            options={{
              headerTitle: tr("New Room"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Stories"
            component={StoriesScreen}
            options={{
              headerTitle: tr("স্টোরি"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{
              headerTitle: tr("নোটিফিকেশন"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Leaderboard"
            component={LeaderboardScreen}
            options={{
              headerTitle: tr("লিডারবোর্ড"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="UserSearch"
            component={UserSearchScreen}
            options={{
              headerTitle: tr("ব্যবহারকারী খুঁজুন"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Announcements"
            component={AnnouncementsScreen}
            options={{
              headerTitle: tr("ঘোষণা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Rewards"
            component={RewardsScreen}
            options={{
              headerTitle: tr("রিওয়ার্ড"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="LiveStream"
            component={LiveStreamScreen}
            options={{
              headerTitle: tr("লাইভ স্ট্রিম"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Trending"
            component={TrendingScreen}
            options={{
              headerTitle: tr("ট্রেন্ডিং"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Challenges"
            component={ChallengesScreen}
            options={{
              headerTitle: tr("চ্যালেঞ্জ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="SavedPosts"
            component={SavedPostsScreen}
            options={{
              headerTitle: tr("সেভ করা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="MyPosts"
            component={MyPostsScreen}
            options={{
              headerTitle: tr("আমার পোস্ট"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="FeaturedFarmers"
            component={FeaturedFarmersScreen}
            options={{
              headerTitle: tr("ফিচার্ড কৃষক"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="KnowledgeWiki"
            component={KnowledgeWikiScreen}
            options={{
              headerTitle: tr("জ্ঞানভাণ্ডার"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Mentorship"
            component={MentorshipScreen}
            options={{
              headerTitle: tr("মেন্টরশিপ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CommunityStats"
            component={CommunityStatsScreen}
            options={{
              headerTitle: tr("কমিউনিটি স্ট্যাটস"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="DailyCheckIn"
            component={DailyCheckInScreen}
            options={{
              headerTitle: tr("দৈনিক চেক-ইন"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="FarmTours"
            component={FarmToursScreen}
            options={{
              headerTitle: tr("ফার্ম ট্যুর"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="SkillExchange"
            component={SkillExchangeScreen}
            options={{
              headerTitle: tr("দক্ষতা বিনিময়"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="HelpCenter"
            component={HelpCenterScreen}
            options={{
              headerTitle: tr("সাহায্য কেন্দ্র"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="CropEncyclopedia"
            component={CropEncyclopediaScreen}
            options={{
              headerTitle: tr("ফসল বিশ্বকোষ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ActivityFeed"
            component={ActivityFeedScreen}
            options={{
              headerTitle: tr("অ্যাক্টিভিটি"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Services"
            component={ServicesScreen}
            options={{
              headerTitle: tr("সেবা সমূহ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="QRScanner"
            component={QRScannerScreen}
            options={{
              headerTitle: tr("QR স্ক্যানার"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="FarmAnalytics"
            component={FarmAnalyticsScreen}
            options={{
              headerTitle: tr("ফার্ম অ্যানালিটিক্স"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Veterinary"
            component={VeterinaryScreen}
            options={{
              headerTitle: tr("পশু চিকিৎসা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ContractFarming"
            component={ContractFarmingScreen}
            options={{
              headerTitle: tr("চুক্তিভিত্তিক চাষ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="AgriNews"
            component={AgriNewsScreen}
            options={{
              headerTitle: tr("কৃষি সংবাদ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="PriceAlert"
            component={PriceAlertScreen}
            options={{
              headerTitle: tr("মূল্য সতর্কতা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="RecipeFinder"
            component={RecipeFinderScreen}
            options={{
              headerTitle: tr("রেসিপি খুঁজুন"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="Warehouse"
            component={WarehouseScreen}
            options={{
              headerTitle: tr("গুদাম খুঁজুন"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="QualityTesting"
            component={QualityTestingScreen}
            options={{
              headerTitle: tr("গুণমান পরীক্ষা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="MedicalServices"
            component={MedicalServicesScreen}
            options={{
              headerTitle: tr("স্বাস্থ্য সেবা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="LandServices"
            component={LandServicesScreen}
            options={{
              headerTitle: tr("ভূমি সেবা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="WasteManagement"
            component={WasteManagementScreen}
            options={{
              headerTitle: tr("বর্জ্য ব্যবস্থাপনা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="WaterServices"
            component={WaterServicesScreen}
            options={{
              headerTitle: tr("পানি সেবা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="ElectricityServices"
            component={ElectricityServicesScreen}
            options={{
              headerTitle: tr("বিদ্যুৎ সেবা"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="FishEncyclopedia"
            component={FishEncyclopediaScreen}
            options={{
              headerTitle: tr("মাছ চাষ"),
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="FishDetail"
            component={FishDetailScreen}
            options={{
              headerTitle: tr("মাছের বিবরণ"),
              headerBackTitle: "Back",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
