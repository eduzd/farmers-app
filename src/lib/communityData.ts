import { Feather } from "@/components/icons/Feather";
import { CommunityType } from "./communityStore";

export interface CommunityTool {
  id: string;
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  subtitleEn: string;
  icon: keyof typeof Feather.glyphMap;
  colors: [string, string];
  badge?: string;
  badgeColor?: string;
  screen?: string;
}

export interface CommunityToolCategory {
  id: string;
  titleBn: string;
  titleEn: string;
  tools: CommunityTool[];
}

export interface CommunityPost {
  id: string;
  communityType: CommunityType;
  author: {
    name: string;
    avatar: string;
    initials: string;
    isWelfareMember?: boolean;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  views: number;
  isLiked: boolean;
  createdAt: string;
}

export interface CommunityProduct {
  id: string;
  communityType: CommunityType;
  name: string;
  price: number;
  currency: string;
  unit: string;
  seller: string;
  location: string;
  rating: number;
  image: string;
  description?: string;
  quantity: number;
  category: string;
}

export const COMMUNITY_TOOLS: Record<CommunityType, CommunityToolCategory[]> = {
  agriculture: [
    {
      id: "ai",
      titleBn: "AI ও স্মার্ট টুলস",
      titleEn: "AI & Smart Tools",
      tools: [
        { id: "smart-farming", titleBn: "স্মার্ট ফার্মিং", titleEn: "Smart Farming", subtitleBn: "AI কৃষি সহায়ক", subtitleEn: "AI Agriculture Assistant", icon: "cpu", colors: ["#00C853", "#00A843"], badge: "NEW", badgeColor: "#00C853", screen: "SmartFarming" },
        { id: "ai-assistant", titleBn: "AI সহায়ক", titleEn: "AI Assistant", subtitleBn: "কৃষি প্রশ্নের উত্তর পান", subtitleEn: "Get answers to farming questions", icon: "message-square", colors: ["#3D38D0", "#3D38D0"], screen: "AIAssistant" },
        { id: "disease-detector", titleBn: "রোগ শনাক্ত", titleEn: "Disease Detector", subtitleBn: "ছবি দিয়ে রোগ চিহ্নিত করুন", subtitleEn: "Identify diseases with photos", icon: "search", colors: ["#FF4BB7", "#FF4BB7"], badge: "AI", badgeColor: "#FF4BB7", screen: "DiseaseDetector" },
        { id: "weather-forecast", titleBn: "আবহাওয়া পূর্বাভাস", titleEn: "Weather Forecast", subtitleBn: "৭ দিনের আবহাওয়া", subtitleEn: "7-day weather forecast", icon: "cloud", colors: ["#2E96EF", "#2E96EF"], screen: "WeatherForecast" },
        { id: "market-prices", titleBn: "বাজার দর", titleEn: "Market Prices", subtitleBn: "লাইভ ফসলের দাম", subtitleEn: "Live crop prices", icon: "trending-up", colors: ["#B25E09", "#B25E09"], badge: "LIVE", badgeColor: "#B25E09", screen: "MarketPrices" },
      ],
    },
    {
      id: "calculators",
      titleBn: "হিসাব ক্যালকুলেটর",
      titleEn: "Calculators",
      tools: [
        { id: "calculate", titleBn: "ক্যালকুলেট", titleEn: "Calculate", subtitleBn: "মাছের হিসাব করুন", subtitleEn: "Calculate fish farming", icon: "dollar-sign", colors: ["#B25E09", "#B25E09"], badge: "Popular", badgeColor: "#B25E09", screen: "Calculate" },
        { id: "loan", titleBn: "ঋণ হিসাব", titleEn: "Loan Calculator", subtitleBn: "EMI ও সুদ হিসাব করুন", subtitleEn: "Calculate EMI & interest", icon: "credit-card", colors: ["#DA2F2F", "#DA2F2F"], screen: "LoanCalculator" },
        { id: "fertilizer", titleBn: "সার হিসাব", titleEn: "Fertilizer Calculator", subtitleBn: "সারের পরিমাণ নির্ধারণ", subtitleEn: "Determine fertilizer amount", icon: "package", colors: ["#795548", "#5D4037"], screen: "FertilizerCalculator" },
        { id: "feed", titleBn: "খাদ্য হিসাব", titleEn: "Feed Calculator", subtitleBn: "পশুখাদ্যের পরিমাণ", subtitleEn: "Animal feed quantity", icon: "box", colors: ["#00BB77", "#39B1FE"], screen: "FeedCalculator" },
        { id: "land-converter", titleBn: "জমি পরিমাপ", titleEn: "Land Converter", subtitleBn: "শতক, বিঘা, একর রূপান্তর", subtitleEn: "Convert land measurements", icon: "maximize-2", colors: ["#4A5568", "#4A5568"], screen: "LandConverter" },
      ],
    },
    {
      id: "management",
      titleBn: "খামার ব্যবস্থাপনা",
      titleEn: "Farm Management",
      tools: [
        { id: "farm-inventory", titleBn: "ইনভেন্টরি", titleEn: "Inventory", subtitleBn: "বীজ, সার, যন্ত্রপাতি ট্র্যাক করুন", subtitleEn: "Track seeds, fertilizers, equipment", icon: "package", colors: ["#2E96EF", "#39B1FE"], badge: "NEW", badgeColor: "#2E96EF", screen: "FarmInventory" },
        { id: "livestock-tracker", titleBn: "পশু ট্র্যাকার", titleEn: "Livestock Tracker", subtitleBn: "গরু, ছাগল, হাঁস-মুরগি ট্র্যাক", subtitleEn: "Track cattle, goats, poultry", icon: "heart", colors: ["#795548", "#5D4037"], badge: "NEW", badgeColor: "#795548", screen: "LivestockTracker" },
        { id: "product-trace", titleBn: "পণ্য ট্রেসেবিলিটি", titleEn: "Product Traceability", subtitleBn: "QR কোড দিয়ে পণ্যের উৎস জানুন", subtitleEn: "Track product origin with QR code", icon: "box", colors: ["#00875A", "#004D40"], badge: "NEW", badgeColor: "#00875A", screen: "ProductTraceability" },
        { id: "farm-analytics", titleBn: "বিশ্লেষণ", titleEn: "Analytics", subtitleBn: "খামারের পারফরম্যান্স দেখুন", subtitleEn: "View farm performance", icon: "bar-chart-2", colors: ["#3D38D0", "#3D38D0"], screen: "FarmAnalytics" },
      ],
    },
  ],
  health: [
    {
      id: "ai",
      titleBn: "AI স্বাস্থ্য টুলস",
      titleEn: "AI Health Tools",
      tools: [
        { id: "health-assistant", titleBn: "স্বাস্থ্য সহায়ক", titleEn: "Health Assistant", subtitleBn: "AI স্বাস্থ্য পরামর্শ", subtitleEn: "AI health advice", icon: "message-square", colors: ["#FF4BB7", "#FF4BB7"], badge: "AI", badgeColor: "#FF4BB7", screen: "AIAssistant" },
        { id: "symptom-checker", titleBn: "লক্ষণ চেকার", titleEn: "Symptom Checker", subtitleBn: "লক্ষণ বিশ্লেষণ করুন", subtitleEn: "Analyze your symptoms", icon: "search", colors: ["#3D38D0", "#3D38D0"], screen: "DiseaseDetector" },
        { id: "medicine-reminder", titleBn: "ওষুধ রিমাইন্ডার", titleEn: "Medicine Reminder", subtitleBn: "ওষুধ খাওয়ার সময়", subtitleEn: "Medicine schedule", icon: "bell", colors: ["#2E96EF", "#2E96EF"], screen: "DailyTips" },
      ],
    },
    {
      id: "services",
      titleBn: "স্বাস্থ্য সেবা",
      titleEn: "Health Services",
      tools: [
        { id: "doctors", titleBn: "ডাক্তার খুঁজুন", titleEn: "Find Doctors", subtitleBn: "কাছের ডাক্তার", subtitleEn: "Nearby doctors", icon: "user", colors: ["#2E96EF", "#39B1FE"], screen: "Experts" },
        { id: "hospitals", titleBn: "হাসপাতাল", titleEn: "Hospitals", subtitleBn: "কাছের হাসপাতাল", subtitleEn: "Nearby hospitals", icon: "home", colors: ["#DA2F2F", "#DA2F2F"], screen: "MedicalServices" },
        { id: "ambulance", titleBn: "অ্যাম্বুলেন্স", titleEn: "Ambulance", subtitleBn: "জরুরি সেবা", subtitleEn: "Emergency service", icon: "phone-call", colors: ["#B25E09", "#B25E09"], badge: "24/7", badgeColor: "#B25E09", screen: "EmergencyServices" },
        { id: "pharmacy", titleBn: "ফার্মেসি", titleEn: "Pharmacy", subtitleBn: "ওষুধ কিনুন", subtitleEn: "Buy medicines", icon: "shopping-bag", colors: ["#00BB77", "#39B1FE"], screen: "ShopsHome" },
      ],
    },
    {
      id: "wellness",
      titleBn: "স্বাস্থ্যকর জীবন",
      titleEn: "Wellness",
      tools: [
        { id: "nutrition", titleBn: "পুষ্টি গাইড", titleEn: "Nutrition Guide", subtitleBn: "স্বাস্থ্যকর খাবার", subtitleEn: "Healthy food", icon: "coffee", colors: ["#00BB77", "#00BB77"], screen: "RecipeFinder" },
        { id: "fitness", titleBn: "ফিটনেস", titleEn: "Fitness", subtitleBn: "ব্যায়াম গাইড", subtitleEn: "Exercise guide", icon: "activity", colors: ["#B25E09", "#B25E09"], screen: "VideoCourses" },
        { id: "mental-health", titleBn: "মানসিক স্বাস্থ্য", titleEn: "Mental Health", subtitleBn: "মনের যত্ন", subtitleEn: "Mind care", icon: "heart", colors: ["#3D38D0", "#3D38D0"], screen: "ExpertQA" },
      ],
    },
  ],
  education: [
    {
      id: "learning",
      titleBn: "শিক্ষা টুলস",
      titleEn: "Learning Tools",
      tools: [
        { id: "ai-tutor", titleBn: "AI শিক্ষক", titleEn: "AI Tutor", subtitleBn: "AI টিউটর সাহায্য", subtitleEn: "AI tutor assistance", icon: "message-square", colors: ["#2E96EF", "#2E96EF"], badge: "AI", badgeColor: "#2E96EF", screen: "AIAssistant" },
        { id: "video-courses", titleBn: "ভিডিও কোর্স", titleEn: "Video Courses", subtitleBn: "অনলাইন ক্লাস", subtitleEn: "Online classes", icon: "play-circle", colors: ["#DA2F2F", "#DA2F2F"], screen: "VideoCourses" },
        { id: "books", titleBn: "ই-বুক", titleEn: "E-Books", subtitleBn: "ডিজিটাল বই", subtitleEn: "Digital books", icon: "book", colors: ["#2E96EF", "#39B1FE"], screen: "KnowledgeWiki" },
      ],
    },
    {
      id: "exams",
      titleBn: "পরীক্ষা প্রস্তুতি",
      titleEn: "Exam Preparation",
      tools: [
        { id: "quizzes", titleBn: "কুইজ", titleEn: "Quizzes", subtitleBn: "প্র্যাকটিস প্রশ্ন", subtitleEn: "Practice questions", icon: "check-circle", colors: ["#B25E09", "#B25E09"], screen: "Challenges" },
        { id: "mock-tests", titleBn: "মক টেস্ট", titleEn: "Mock Tests", subtitleBn: "পরীক্ষা প্র্যাকটিস", subtitleEn: "Exam practice", icon: "file-text", colors: ["#3D38D0", "#3D38D0"], screen: "Certification" },
        { id: "results", titleBn: "রেজাল্ট", titleEn: "Results", subtitleBn: "পরীক্ষার ফলাফল", subtitleEn: "Exam results", icon: "award", colors: ["#2E96EF", "#39B1FE"], screen: "Badges" },
      ],
    },
    {
      id: "resources",
      titleBn: "শিক্ষা সম্পদ",
      titleEn: "Learning Resources",
      tools: [
        { id: "tutors", titleBn: "টিউটর খুঁজুন", titleEn: "Find Tutors", subtitleBn: "প্রাইভেট টিউটর", subtitleEn: "Private tutors", icon: "users", colors: ["#3D38D0", "#3D38D0"], screen: "Experts" },
        { id: "study-groups", titleBn: "স্টাডি গ্রুপ", titleEn: "Study Groups", subtitleBn: "সহপাঠীদের সাথে পড়ুন", subtitleEn: "Study with classmates", icon: "users", colors: ["#00BB77", "#39B1FE"], screen: "Groups" },
        { id: "scholarships", titleBn: "স্কলারশিপ", titleEn: "Scholarships", subtitleBn: "বৃত্তি খুঁজুন", subtitleEn: "Find scholarships", icon: "award", colors: ["#B25E09", "#B25E09"], screen: "GovernmentSchemes" },
      ],
    },
  ],
  business: [
    {
      id: "finance",
      titleBn: "আর্থিক টুলস",
      titleEn: "Financial Tools",
      tools: [
        { id: "profit-calc", titleBn: "লাভ-ক্ষতি", titleEn: "Profit/Loss", subtitleBn: "ব্যবসার হিসাব", subtitleEn: "Business calculations", icon: "trending-up", colors: ["#2E96EF", "#39B1FE"], screen: "ProfitCalculator" },
        { id: "loan-calc", titleBn: "ঋণ হিসাব", titleEn: "Loan Calculator", subtitleBn: "EMI ক্যালকুলেটর", subtitleEn: "EMI calculator", icon: "credit-card", colors: ["#DA2F2F", "#DA2F2F"], screen: "LoanCalculator" },
        { id: "invoice", titleBn: "ইনভয়েস", titleEn: "Invoice", subtitleBn: "বিল তৈরি করুন", subtitleEn: "Create bills", icon: "file-text", colors: ["#2E96EF", "#2E96EF"], screen: "Rfq" },
        { id: "wallet", titleBn: "ওয়ালেট", titleEn: "Wallet", subtitleBn: "ডিজিটাল পেমেন্ট", subtitleEn: "Digital payments", icon: "credit-card", colors: ["#B25E09", "#B25E09"], screen: "Wallet" },
      ],
    },
    {
      id: "management",
      titleBn: "ব্যবসা ব্যবস্থাপনা",
      titleEn: "Business Management",
      tools: [
        { id: "inventory", titleBn: "ইনভেন্টরি", titleEn: "Inventory", subtitleBn: "স্টক ম্যানেজমেন্ট", subtitleEn: "Stock management", icon: "package", colors: ["#3D38D0", "#3D38D0"], screen: "FarmInventory" },
        { id: "orders", titleBn: "অর্ডার", titleEn: "Orders", subtitleBn: "অর্ডার ট্র্যাকিং", subtitleEn: "Order tracking", icon: "shopping-bag", colors: ["#00BB77", "#39B1FE"], screen: "Orders" },
        { id: "analytics", titleBn: "বিশ্লেষণ", titleEn: "Analytics", subtitleBn: "ব্যবসার পারফরম্যান্স", subtitleEn: "Business performance", icon: "bar-chart-2", colors: ["#3D38D0", "#3D38D0"], screen: "FarmAnalytics" },
      ],
    },
    {
      id: "market",
      titleBn: "মার্কেটিং",
      titleEn: "Marketing",
      tools: [
        { id: "ads", titleBn: "বিজ্ঞাপন", titleEn: "Ads", subtitleBn: "বিজ্ঞাপন দিন", subtitleEn: "Create ads", icon: "volume-2", colors: ["#B25E09", "#B25E09"], screen: "Announcements" },
        { id: "customers", titleBn: "কাস্টমার", titleEn: "Customers", subtitleBn: "গ্রাহক ম্যানেজমেন্ট", subtitleEn: "Customer management", icon: "users", colors: ["#00BB77", "#00BB77"], screen: "NearbyFarmers" },
        { id: "reviews", titleBn: "রিভিউ", titleEn: "Reviews", subtitleBn: "গ্রাহকের মতামত", subtitleEn: "Customer feedback", icon: "star", colors: ["#F5B700", "#B25E09"], screen: "Leaderboard" },
      ],
    },
  ],
  technology: [
    {
      id: "ai",
      titleBn: "AI টুলস",
      titleEn: "AI Tools",
      tools: [
        { id: "ai-chat", titleBn: "AI চ্যাট", titleEn: "AI Chat", subtitleBn: "AI সহায়ক", subtitleEn: "AI Assistant", icon: "message-square", colors: ["#3D38D0", "#3D38D0"], badge: "AI", badgeColor: "#3D38D0", screen: "AIAssistant" },
        { id: "code-helper", titleBn: "কোড হেল্পার", titleEn: "Code Helper", subtitleBn: "প্রোগ্রামিং সাহায্য", subtitleEn: "Programming help", icon: "code", colors: ["#2E96EF", "#2E96EF"], screen: "ExpertQA" },
        { id: "image-ai", titleBn: "ইমেজ AI", titleEn: "Image AI", subtitleBn: "ছবি বিশ্লেষণ", subtitleEn: "Image analysis", icon: "image", colors: ["#FF4BB7", "#FF4BB7"], screen: "DiseaseDetector" },
      ],
    },
    {
      id: "learning",
      titleBn: "টেক শিক্ষা",
      titleEn: "Tech Learning",
      tools: [
        { id: "tutorials", titleBn: "টিউটোরিয়াল", titleEn: "Tutorials", subtitleBn: "কোডিং শিখুন", subtitleEn: "Learn coding", icon: "play-circle", colors: ["#DA2F2F", "#DA2F2F"], screen: "VideoCourses" },
        { id: "docs", titleBn: "ডকুমেন্টেশন", titleEn: "Documentation", subtitleBn: "টেক ডক্স", subtitleEn: "Tech docs", icon: "book", colors: ["#2E96EF", "#39B1FE"], screen: "KnowledgeWiki" },
        { id: "community", titleBn: "কমিউনিটি", titleEn: "Community", subtitleBn: "ডেভেলপার ফোরাম", subtitleEn: "Developer forum", icon: "users", colors: ["#B25E09", "#B25E09"], screen: "Groups" },
      ],
    },
    {
      id: "tools",
      titleBn: "ডেভেলপার টুলস",
      titleEn: "Developer Tools",
      tools: [
        { id: "api", titleBn: "API টুলস", titleEn: "API Tools", subtitleBn: "API টেস্টিং", subtitleEn: "API testing", icon: "globe", colors: ["#00BB77", "#39B1FE"], screen: "SoilTesting" },
        { id: "cloud", titleBn: "ক্লাউড সার্ভিস", titleEn: "Cloud Services", subtitleBn: "ক্লাউড ম্যানেজমেন্ট", subtitleEn: "Cloud management", icon: "cloud", colors: ["#3D38D0", "#3D38D0"], screen: "ColdStorage" },
        { id: "security", titleBn: "সিকিউরিটি", titleEn: "Security", subtitleBn: "নিরাপত্তা টুলস", subtitleEn: "Security tools", icon: "shield", colors: ["#B25E09", "#B25E09"], screen: "EmergencyServices" },
      ],
    },
  ],
};

export const COMMUNITY_POSTS: CommunityPost[] = [];

export const COMMUNITY_PRODUCTS: CommunityProduct[] = [];

export function getPostsByCommunity(communityType: CommunityType | null): CommunityPost[] {
  if (!communityType) return COMMUNITY_POSTS;
  return COMMUNITY_POSTS.filter((post) => post.communityType === communityType);
}

export function getToolsByCommunity(communityType: CommunityType | null): CommunityToolCategory[] {
  if (!communityType) return COMMUNITY_TOOLS.agriculture;
  return COMMUNITY_TOOLS[communityType] || COMMUNITY_TOOLS.agriculture;
}

export function getProductsByCommunity(communityType: CommunityType | null): CommunityProduct[] {
  if (!communityType) return COMMUNITY_PRODUCTS;
  return COMMUNITY_PRODUCTS.filter((product) => product.communityType === communityType);
}
