import { Feather } from "@expo/vector-icons";
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
        { id: "ai-assistant", titleBn: "AI সহায়ক", titleEn: "AI Assistant", subtitleBn: "কৃষি প্রশ্নের উত্তর পান", subtitleEn: "Get answers to farming questions", icon: "message-square", colors: ["#7C3AED", "#7B1FA2"], screen: "AIAssistant" },
        { id: "disease-detector", titleBn: "রোগ শনাক্ত", titleEn: "Disease Detector", subtitleBn: "ছবি দিয়ে রোগ চিহ্নিত করুন", subtitleEn: "Identify diseases with photos", icon: "search", colors: ["#DB2777", "#C2185B"], badge: "AI", badgeColor: "#DB2777", screen: "DiseaseDetector" },
        { id: "weather-forecast", titleBn: "আবহাওয়া পূর্বাভাস", titleEn: "Weather Forecast", subtitleBn: "৭ দিনের আবহাওয়া", subtitleEn: "7-day weather forecast", icon: "cloud", colors: ["#2563EB", "#1976D2"], screen: "WeatherForecast" },
        { id: "market-prices", titleBn: "বাজার দর", titleEn: "Market Prices", subtitleBn: "লাইভ ফসলের দাম", subtitleEn: "Live crop prices", icon: "trending-up", colors: ["#FF5722", "#E64A19"], badge: "LIVE", badgeColor: "#FF5722", screen: "MarketPrices" },
      ],
    },
    {
      id: "calculators",
      titleBn: "হিসাব ক্যালকুলেটর",
      titleEn: "Calculators",
      tools: [
        { id: "calculate", titleBn: "ক্যালকুলেট", titleEn: "Calculate", subtitleBn: "মাছের হিসাব করুন", subtitleEn: "Calculate fish farming", icon: "dollar-sign", colors: ["#EA8A0C", "#F57C00"], badge: "Popular", badgeColor: "#EA8A0C", screen: "Calculate" },
        { id: "loan", titleBn: "ঋণ হিসাব", titleEn: "Loan Calculator", subtitleBn: "EMI ও সুদ হিসাব করুন", subtitleEn: "Calculate EMI & interest", icon: "credit-card", colors: ["#DC2626", "#D32F2F"], screen: "LoanCalculator" },
        { id: "fertilizer", titleBn: "সার হিসাব", titleEn: "Fertilizer Calculator", subtitleBn: "সারের পরিমাণ নির্ধারণ", subtitleEn: "Determine fertilizer amount", icon: "package", colors: ["#795548", "#5D4037"], screen: "FertilizerCalculator" },
        { id: "feed", titleBn: "খাদ্য হিসাব", titleEn: "Feed Calculator", subtitleBn: "পশুখাদ্যের পরিমাণ", subtitleEn: "Animal feed quantity", icon: "box", colors: ["#0D9488", "#0097A7"], screen: "FeedCalculator" },
        { id: "land-converter", titleBn: "জমি পরিমাপ", titleEn: "Land Converter", subtitleBn: "শতক, বিঘা, একর রূপান্তর", subtitleEn: "Convert land measurements", icon: "maximize-2", colors: ["#475569", "#455A64"], screen: "LandConverter" },
      ],
    },
    {
      id: "management",
      titleBn: "খামার ব্যবস্থাপনা",
      titleEn: "Farm Management",
      tools: [
        { id: "farm-inventory", titleBn: "ইনভেন্টরি", titleEn: "Inventory", subtitleBn: "বীজ, সার, যন্ত্রপাতি ট্র্যাক করুন", subtitleEn: "Track seeds, fertilizers, equipment", icon: "package", colors: ["#2FA36B", "#388E3C"], badge: "NEW", badgeColor: "#2FA36B", screen: "FarmInventory" },
        { id: "livestock-tracker", titleBn: "পশু ট্র্যাকার", titleEn: "Livestock Tracker", subtitleBn: "গরু, ছাগল, হাঁস-মুরগি ট্র্যাক", subtitleEn: "Track cattle, goats, poultry", icon: "heart", colors: ["#795548", "#5D4037"], badge: "NEW", badgeColor: "#795548", screen: "LivestockTracker" },
        { id: "product-trace", titleBn: "পণ্য ট্রেসেবিলিটি", titleEn: "Product Traceability", subtitleBn: "QR কোড দিয়ে পণ্যের উৎস জানুন", subtitleEn: "Track product origin with QR code", icon: "box", colors: ["#00796B", "#004D40"], badge: "NEW", badgeColor: "#00796B", screen: "ProductTraceability" },
        { id: "farm-analytics", titleBn: "বিশ্লেষণ", titleEn: "Analytics", subtitleBn: "খামারের পারফরম্যান্স দেখুন", subtitleEn: "View farm performance", icon: "bar-chart-2", colors: ["#3F51B5", "#303F9F"], screen: "FarmAnalytics" },
      ],
    },
  ],
  health: [
    {
      id: "ai",
      titleBn: "AI স্বাস্থ্য টুলস",
      titleEn: "AI Health Tools",
      tools: [
        { id: "health-assistant", titleBn: "স্বাস্থ্য সহায়ক", titleEn: "Health Assistant", subtitleBn: "AI স্বাস্থ্য পরামর্শ", subtitleEn: "AI health advice", icon: "message-square", colors: ["#DB2777", "#C2185B"], badge: "AI", badgeColor: "#DB2777", screen: "AIAssistant" },
        { id: "symptom-checker", titleBn: "লক্ষণ চেকার", titleEn: "Symptom Checker", subtitleBn: "লক্ষণ বিশ্লেষণ করুন", subtitleEn: "Analyze your symptoms", icon: "search", colors: ["#7C3AED", "#7B1FA2"], screen: "DiseaseDetector" },
        { id: "medicine-reminder", titleBn: "ওষুধ রিমাইন্ডার", titleEn: "Medicine Reminder", subtitleBn: "ওষুধ খাওয়ার সময়", subtitleEn: "Medicine schedule", icon: "bell", colors: ["#2563EB", "#1976D2"], screen: "DailyTips" },
      ],
    },
    {
      id: "services",
      titleBn: "স্বাস্থ্য সেবা",
      titleEn: "Health Services",
      tools: [
        { id: "doctors", titleBn: "ডাক্তার খুঁজুন", titleEn: "Find Doctors", subtitleBn: "কাছের ডাক্তার", subtitleEn: "Nearby doctors", icon: "user", colors: ["#2FA36B", "#388E3C"], screen: "Experts" },
        { id: "hospitals", titleBn: "হাসপাতাল", titleEn: "Hospitals", subtitleBn: "কাছের হাসপাতাল", subtitleEn: "Nearby hospitals", icon: "home", colors: ["#DC2626", "#D32F2F"], screen: "MedicalServices" },
        { id: "ambulance", titleBn: "অ্যাম্বুলেন্স", titleEn: "Ambulance", subtitleBn: "জরুরি সেবা", subtitleEn: "Emergency service", icon: "phone-call", colors: ["#FF5722", "#E64A19"], badge: "24/7", badgeColor: "#FF5722", screen: "EmergencyServices" },
        { id: "pharmacy", titleBn: "ফার্মেসি", titleEn: "Pharmacy", subtitleBn: "ওষুধ কিনুন", subtitleEn: "Buy medicines", icon: "shopping-bag", colors: ["#0D9488", "#0097A7"], screen: "ShopsHome" },
      ],
    },
    {
      id: "wellness",
      titleBn: "স্বাস্থ্যকর জীবন",
      titleEn: "Wellness",
      tools: [
        { id: "nutrition", titleBn: "পুষ্টি গাইড", titleEn: "Nutrition Guide", subtitleBn: "স্বাস্থ্যকর খাবার", subtitleEn: "Healthy food", icon: "coffee", colors: ["#65A30D", "#689F38"], screen: "RecipeFinder" },
        { id: "fitness", titleBn: "ফিটনেস", titleEn: "Fitness", subtitleBn: "ব্যায়াম গাইড", subtitleEn: "Exercise guide", icon: "activity", colors: ["#EA8A0C", "#F57C00"], screen: "VideoCourses" },
        { id: "mental-health", titleBn: "মানসিক স্বাস্থ্য", titleEn: "Mental Health", subtitleBn: "মনের যত্ন", subtitleEn: "Mind care", icon: "heart", colors: ["#7C3AED", "#7B1FA2"], screen: "ExpertQA" },
      ],
    },
  ],
  education: [
    {
      id: "learning",
      titleBn: "শিক্ষা টুলস",
      titleEn: "Learning Tools",
      tools: [
        { id: "ai-tutor", titleBn: "AI শিক্ষক", titleEn: "AI Tutor", subtitleBn: "AI টিউটর সাহায্য", subtitleEn: "AI tutor assistance", icon: "message-square", colors: ["#2563EB", "#1976D2"], badge: "AI", badgeColor: "#2563EB", screen: "AIAssistant" },
        { id: "video-courses", titleBn: "ভিডিও কোর্স", titleEn: "Video Courses", subtitleBn: "অনলাইন ক্লাস", subtitleEn: "Online classes", icon: "play-circle", colors: ["#DC2626", "#D32F2F"], screen: "VideoCourses" },
        { id: "books", titleBn: "ই-বুক", titleEn: "E-Books", subtitleBn: "ডিজিটাল বই", subtitleEn: "Digital books", icon: "book", colors: ["#2FA36B", "#388E3C"], screen: "KnowledgeWiki" },
      ],
    },
    {
      id: "exams",
      titleBn: "পরীক্ষা প্রস্তুতি",
      titleEn: "Exam Preparation",
      tools: [
        { id: "quizzes", titleBn: "কুইজ", titleEn: "Quizzes", subtitleBn: "প্র্যাকটিস প্রশ্ন", subtitleEn: "Practice questions", icon: "check-circle", colors: ["#EA8A0C", "#F57C00"], screen: "Challenges" },
        { id: "mock-tests", titleBn: "মক টেস্ট", titleEn: "Mock Tests", subtitleBn: "পরীক্ষা প্র্যাকটিস", subtitleEn: "Exam practice", icon: "file-text", colors: ["#7C3AED", "#7B1FA2"], screen: "Certification" },
        { id: "results", titleBn: "রেজাল্ট", titleEn: "Results", subtitleBn: "পরীক্ষার ফলাফল", subtitleEn: "Exam results", icon: "award", colors: ["#2FA36B", "#388E3C"], screen: "Badges" },
      ],
    },
    {
      id: "resources",
      titleBn: "শিক্ষা সম্পদ",
      titleEn: "Learning Resources",
      tools: [
        { id: "tutors", titleBn: "টিউটর খুঁজুন", titleEn: "Find Tutors", subtitleBn: "প্রাইভেট টিউটর", subtitleEn: "Private tutors", icon: "users", colors: ["#3F51B5", "#303F9F"], screen: "Experts" },
        { id: "study-groups", titleBn: "স্টাডি গ্রুপ", titleEn: "Study Groups", subtitleBn: "সহপাঠীদের সাথে পড়ুন", subtitleEn: "Study with classmates", icon: "users", colors: ["#0D9488", "#0097A7"], screen: "Groups" },
        { id: "scholarships", titleBn: "স্কলারশিপ", titleEn: "Scholarships", subtitleBn: "বৃত্তি খুঁজুন", subtitleEn: "Find scholarships", icon: "award", colors: ["#FF5722", "#E64A19"], screen: "GovernmentSchemes" },
      ],
    },
  ],
  business: [
    {
      id: "finance",
      titleBn: "আর্থিক টুলস",
      titleEn: "Financial Tools",
      tools: [
        { id: "profit-calc", titleBn: "লাভ-ক্ষতি", titleEn: "Profit/Loss", subtitleBn: "ব্যবসার হিসাব", subtitleEn: "Business calculations", icon: "trending-up", colors: ["#2FA36B", "#388E3C"], screen: "ProfitCalculator" },
        { id: "loan-calc", titleBn: "ঋণ হিসাব", titleEn: "Loan Calculator", subtitleBn: "EMI ক্যালকুলেটর", subtitleEn: "EMI calculator", icon: "credit-card", colors: ["#DC2626", "#D32F2F"], screen: "LoanCalculator" },
        { id: "invoice", titleBn: "ইনভয়েস", titleEn: "Invoice", subtitleBn: "বিল তৈরি করুন", subtitleEn: "Create bills", icon: "file-text", colors: ["#2563EB", "#1976D2"], screen: "Rfq" },
        { id: "wallet", titleBn: "ওয়ালেট", titleEn: "Wallet", subtitleBn: "ডিজিটাল পেমেন্ট", subtitleEn: "Digital payments", icon: "credit-card", colors: ["#EA8A0C", "#F57C00"], screen: "Wallet" },
      ],
    },
    {
      id: "management",
      titleBn: "ব্যবসা ব্যবস্থাপনা",
      titleEn: "Business Management",
      tools: [
        { id: "inventory", titleBn: "ইনভেন্টরি", titleEn: "Inventory", subtitleBn: "স্টক ম্যানেজমেন্ট", subtitleEn: "Stock management", icon: "package", colors: ["#7C3AED", "#7B1FA2"], screen: "FarmInventory" },
        { id: "orders", titleBn: "অর্ডার", titleEn: "Orders", subtitleBn: "অর্ডার ট্র্যাকিং", subtitleEn: "Order tracking", icon: "shopping-bag", colors: ["#0D9488", "#0097A7"], screen: "Orders" },
        { id: "analytics", titleBn: "বিশ্লেষণ", titleEn: "Analytics", subtitleBn: "ব্যবসার পারফরম্যান্স", subtitleEn: "Business performance", icon: "bar-chart-2", colors: ["#3F51B5", "#303F9F"], screen: "FarmAnalytics" },
      ],
    },
    {
      id: "market",
      titleBn: "মার্কেটিং",
      titleEn: "Marketing",
      tools: [
        { id: "ads", titleBn: "বিজ্ঞাপন", titleEn: "Ads", subtitleBn: "বিজ্ঞাপন দিন", subtitleEn: "Create ads", icon: "volume-2", colors: ["#FF5722", "#E64A19"], screen: "Announcements" },
        { id: "customers", titleBn: "কাস্টমার", titleEn: "Customers", subtitleBn: "গ্রাহক ম্যানেজমেন্ট", subtitleEn: "Customer management", icon: "users", colors: ["#65A30D", "#689F38"], screen: "NearbyFarmers" },
        { id: "reviews", titleBn: "রিভিউ", titleEn: "Reviews", subtitleBn: "গ্রাহকের মতামত", subtitleEn: "Customer feedback", icon: "star", colors: ["#F5B700", "#EA8A0C"], screen: "Leaderboard" },
      ],
    },
  ],
  technology: [
    {
      id: "ai",
      titleBn: "AI টুলস",
      titleEn: "AI Tools",
      tools: [
        { id: "ai-chat", titleBn: "AI চ্যাট", titleEn: "AI Chat", subtitleBn: "AI সহায়ক", subtitleEn: "AI Assistant", icon: "message-square", colors: ["#7C3AED", "#7B1FA2"], badge: "AI", badgeColor: "#7C3AED", screen: "AIAssistant" },
        { id: "code-helper", titleBn: "কোড হেল্পার", titleEn: "Code Helper", subtitleBn: "প্রোগ্রামিং সাহায্য", subtitleEn: "Programming help", icon: "code", colors: ["#2563EB", "#1976D2"], screen: "ExpertQA" },
        { id: "image-ai", titleBn: "ইমেজ AI", titleEn: "Image AI", subtitleBn: "ছবি বিশ্লেষণ", subtitleEn: "Image analysis", icon: "image", colors: ["#DB2777", "#C2185B"], screen: "DiseaseDetector" },
      ],
    },
    {
      id: "learning",
      titleBn: "টেক শিক্ষা",
      titleEn: "Tech Learning",
      tools: [
        { id: "tutorials", titleBn: "টিউটোরিয়াল", titleEn: "Tutorials", subtitleBn: "কোডিং শিখুন", subtitleEn: "Learn coding", icon: "play-circle", colors: ["#DC2626", "#D32F2F"], screen: "VideoCourses" },
        { id: "docs", titleBn: "ডকুমেন্টেশন", titleEn: "Documentation", subtitleBn: "টেক ডক্স", subtitleEn: "Tech docs", icon: "book", colors: ["#2FA36B", "#388E3C"], screen: "KnowledgeWiki" },
        { id: "community", titleBn: "কমিউনিটি", titleEn: "Community", subtitleBn: "ডেভেলপার ফোরাম", subtitleEn: "Developer forum", icon: "users", colors: ["#EA8A0C", "#F57C00"], screen: "Groups" },
      ],
    },
    {
      id: "tools",
      titleBn: "ডেভেলপার টুলস",
      titleEn: "Developer Tools",
      tools: [
        { id: "api", titleBn: "API টুলস", titleEn: "API Tools", subtitleBn: "API টেস্টিং", subtitleEn: "API testing", icon: "globe", colors: ["#0D9488", "#0097A7"], screen: "SoilTesting" },
        { id: "cloud", titleBn: "ক্লাউড সার্ভিস", titleEn: "Cloud Services", subtitleBn: "ক্লাউড ম্যানেজমেন্ট", subtitleEn: "Cloud management", icon: "cloud", colors: ["#3F51B5", "#303F9F"], screen: "ColdStorage" },
        { id: "security", titleBn: "সিকিউরিটি", titleEn: "Security", subtitleBn: "নিরাপত্তা টুলস", subtitleEn: "Security tools", icon: "shield", colors: ["#FF5722", "#E64A19"], screen: "EmergencyServices" },
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
