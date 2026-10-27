import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  address: string;
  area: string;
  city: string;
  district: string;
  postalCode?: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  initials: string;
  role: "farmer" | "buyer" | "company" | "expert";
  farmingCategory?: string;
  phone?: string;
  location?: string;
  bio?: string;
  avatar?: string;
  avatarId?: string;
  avatarColor?: string;
  verified: boolean;
  country: string;
  language: string;
  themePreference?: "light" | "dark" | "system";
  createdAt: string;
  followersCount?: number;
  followingCount?: number;
  followers?: string[];
  following?: string[];
  addresses?: UserAddress[];
}

export interface PublicUser {
  id: string;
  name: string;
  username?: string;
  initials: string;
  role: "farmer" | "buyer" | "company" | "expert";
  farmingCategory?: string;
  location?: string;
  bio?: string;
  avatar?: string;
  avatarId?: string;
  avatarColor?: string;
  verified: boolean;
  isWelfareMember?: boolean;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  author: {
    name: string;
    initials: string;
    avatar?: string;
    avatarId?: string;
    avatarColor?: string;
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

export interface Product {
  id: string;
  sellerId: string;
  seller: {
    name: string;
    initials: string;
  };
  name: string;
  description: string;
  price: number;
  currency: string;
  unit: string;
  quantity: number;
  category: string;
  images: string[];
  location: string;
  rating: number;
  status: "active" | "sold" | "expired";
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participant: {
    name: string;
    initials: string;
    isOnline: boolean;
    isWelfareMember?: boolean;
    avatar?: string;
    avatarId?: string;
    avatarColor?: string;
  };
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isMe: boolean;
  readAt?: string;
  createdAt: string;
}

export interface Expert {
  id: string;
  userId: string;
  name: string;
  initials: string;
  specialty: string;
  credentials: string;
  experience: number;
  rating: number;
  consultationFee: number;
  currency: string;
  available: boolean;
  bio: string;
}

export interface RfqRequest {
  id: string;
  buyerId: string;
  buyer: {
    name: string;
    initials: string;
  };
  title: string;
  description: string;
  quantity: string;
  unit: string;
  deadline: string;
  status: "open" | "closed";
  bidsCount: number;
  createdAt: string;
}

export interface RfqBid {
  id: string;
  rfqId: string;
  sellerId: string;
  seller: {
    name: string;
    initials: string;
  };
  price: number;
  currency: string;
  notes: string;
  createdAt: string;
}

export interface Company {
  id: string;
  ownerId: string;
  name: string;
  logo?: string;
  coverImage?: string;
  initials: string;
  description: string;
  category: string;
  categories?: string[];
  address: string;
  phone: string;
  email: string;
  website?: string;
  verified: boolean;
  rating: number;
  reviewsCount: number;
  followersCount: number;
  productsCount: number;
  totalSales: number;
  responseRate: number;
  responseTime: string;
  shipOnTime: number;
  establishedYear: number;
  returnPolicy: string;
  shippingPolicy: string;
  paymentMethods: string[];
  businessHours: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
  };
  createdAt: string;
}

export interface CompanyProduct {
  id: string;
  companyId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  unit: string;
  quantity: number;
  category: string;
  images: string[];
  rating: number;
  reviewsCount: number;
  status: "active" | "out_of_stock" | "discontinued";
  createdAt: string;
}

export interface CompanyReview {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  userInitials: string;
  rating: number;
  comment: string;
  productId?: string;
  productName?: string;
  images?: string[];
  verified?: boolean;
  helpfulCount?: number;
  sellerReply?: string;
  sellerReplyDate?: string;
  createdAt: string;
  isWelfareMember?: boolean;
}

export interface CompanyChat {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerInitials: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
  isOnline?: boolean;
  isWelfareMember?: boolean;
}

const STORAGE_KEYS = {
  USER: "user",
  POSTS: "posts",
  PRODUCTS: "products",
  CONVERSATIONS: "conversations",
  MESSAGES: "messages",
  EXPERTS: "experts",
  RFQ_REQUESTS: "rfq_requests",
  RFQ_BIDS: "rfq_bids",
  ONBOARDING_COMPLETE: "onboarding_complete",
  THEME_PREFERENCE: "theme_preference",
  COMPANIES: "companies",
  COMPANY_PRODUCTS: "company_products",
  COMPANY_REVIEWS: "company_reviews",
  COMPANY_CHATS: "company_chats",
  ALL_COMPANIES: "all_companies",
};

// Theme preference storage
export const saveThemePreference = async (theme: "light" | "dark" | "system"): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, theme);
};

export const getThemePreference = async (): Promise<"light" | "dark" | "system"> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE);
  // Only a known value: anything else (e.g. a quoted "dark") used to blank the whole app.
  const v = String(data || "").replace(/"/g, "").trim();
  return v === "light" || v === "dark" || v === "system" ? v : "system";
};

// User storage
export const saveUser = async (user: User): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

export const getUser = async (): Promise<User | null> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.USER);
  return data ? JSON.parse(data) : null;
};

export const clearUser = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEYS.USER);
};

// Posts storage
export const savePosts = async (posts: Post[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
};

export const getPosts = async (): Promise<Post[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.POSTS);
  return data ? JSON.parse(data) : [];
};

// Products storage
export const saveProducts = async (products: Product[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
};

export const getProducts = async (): Promise<Product[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
  return data ? JSON.parse(data) : [];
};

// Conversations storage
export const saveConversations = async (conversations: Conversation[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
};

export const getConversations = async (): Promise<Conversation[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
  return data ? JSON.parse(data) : [];
};

// Messages storage
export const saveMessages = async (conversationId: string, messages: Message[]): Promise<void> => {
  const key = `${STORAGE_KEYS.MESSAGES}_${conversationId}`;
  await AsyncStorage.setItem(key, JSON.stringify(messages));
};

export const getMessages = async (conversationId: string): Promise<Message[]> => {
  const key = `${STORAGE_KEYS.MESSAGES}_${conversationId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

// Experts storage
export const saveExperts = async (experts: Expert[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.EXPERTS, JSON.stringify(experts));
};

export const getExperts = async (): Promise<Expert[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.EXPERTS);
  return data ? JSON.parse(data) : [];
};

// RFQ storage
export const saveRfqRequests = async (requests: RfqRequest[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.RFQ_REQUESTS, JSON.stringify(requests));
};

export const getRfqRequests = async (): Promise<RfqRequest[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.RFQ_REQUESTS);
  return data ? JSON.parse(data) : [];
};

// Onboarding
export const setOnboardingComplete = async (): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
};

export const isOnboardingComplete = async (): Promise<boolean> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
  return data === "true";
};

// Company storage
export const saveCompany = async (company: Company): Promise<void> => {
  await AsyncStorage.setItem(`${STORAGE_KEYS.COMPANIES}_${company.id}`, JSON.stringify(company));
};

export const getCompany = async (companyId: string): Promise<Company | null> => {
  const data = await AsyncStorage.getItem(`${STORAGE_KEYS.COMPANIES}_${companyId}`);
  return data ? JSON.parse(data) : null;
};

export const getUserCompany = async (userId: string): Promise<Company | null> => {
  const data = await AsyncStorage.getItem(`${STORAGE_KEYS.COMPANIES}_owner_${userId}`);
  if (data) {
    const companyId = JSON.parse(data);
    return getCompany(companyId);
  }
  return null;
};

export const saveUserCompany = async (userId: string, companyId: string): Promise<void> => {
  await AsyncStorage.setItem(`${STORAGE_KEYS.COMPANIES}_owner_${userId}`, JSON.stringify(companyId));
};

export const saveCompanyProducts = async (companyId: string, products: CompanyProduct[]): Promise<void> => {
  await AsyncStorage.setItem(`${STORAGE_KEYS.COMPANY_PRODUCTS}_${companyId}`, JSON.stringify(products));
};

export const getCompanyProducts = async (companyId: string): Promise<CompanyProduct[]> => {
  const data = await AsyncStorage.getItem(`${STORAGE_KEYS.COMPANY_PRODUCTS}_${companyId}`);
  return data ? JSON.parse(data) : [];
};

export const saveCompanyReviews = async (companyId: string, reviews: CompanyReview[]): Promise<void> => {
  await AsyncStorage.setItem(`${STORAGE_KEYS.COMPANY_REVIEWS}_${companyId}`, JSON.stringify(reviews));
};

export const getCompanyReviews = async (companyId: string): Promise<CompanyReview[]> => {
  const data = await AsyncStorage.getItem(`${STORAGE_KEYS.COMPANY_REVIEWS}_${companyId}`);
  return data ? JSON.parse(data) : [];
};

export const saveCompanyChats = async (companyId: string, chats: CompanyChat[]): Promise<void> => {
  await AsyncStorage.setItem(`${STORAGE_KEYS.COMPANY_CHATS}_${companyId}`, JSON.stringify(chats));
};

export const getCompanyChats = async (companyId: string): Promise<CompanyChat[]> => {
  const data = await AsyncStorage.getItem(`${STORAGE_KEYS.COMPANY_CHATS}_${companyId}`);
  return data ? JSON.parse(data) : [];
};

// Older versions saved sample shops (owner "owner-1", "owner-2", ...). They are not real
// sellers, so they are dropped here and removed from the phone the first time this runs.
const isSampleCompany = (c: Company) => /^owner-/.test(String((c as any)?.ownerId || ""));

export const getAllCompanies = async (): Promise<Company[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.ALL_COMPANIES);
  const all: Company[] = data ? JSON.parse(data) : [];
  const real = all.filter((c) => !isSampleCompany(c));
  if (real.length !== all.length) {
    await AsyncStorage.setItem(STORAGE_KEYS.ALL_COMPANIES, JSON.stringify(real));
  }
  return real;
};

export const saveAllCompanies = async (companies: Company[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.ALL_COMPANIES, JSON.stringify(companies));
};

export const addCompanyToList = async (company: Company): Promise<void> => {
  const companies = await getAllCompanies();
  const existingIndex = companies.findIndex(c => c.id === company.id);
  if (existingIndex >= 0) {
    companies[existingIndex] = company;
  } else {
    companies.push(company);
  }
  await saveAllCompanies(companies);
  await saveCompany(company);
};

// Marketplace Product with company info
export interface MarketplaceProduct {
  id: string;
  companyId: string;
  company: {
    name: string;
    initials: string;
    verified: boolean;
    rating: number;
    location: string;
  };
  name: string;
  description: string;
  price: number;
  currency: string;
  unit: string;
  quantity: number;
  category: string;
  images: string[];
  rating: number;
  reviewsCount: number;
  status: "active" | "out_of_stock" | "discontinued";
  createdAt: string;
}

// Get all products from all companies for the marketplace
export const getAllMarketplaceProducts = async (): Promise<MarketplaceProduct[]> => {
  const companies = await getAllCompanies();
  const allProducts: MarketplaceProduct[] = [];

  for (const company of companies) {
    const products = await getCompanyProducts(company.id);
    for (const product of products) {
      if (product.status === "active") {
        allProducts.push({
          ...product,
          company: {
            name: company.name,
            initials: company.initials,
            verified: company.verified,
            rating: company.rating,
            location: company.address,
          },
        });
      }
    }
  }

  // Sort by createdAt (newest first)
  return allProducts.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

// Clear all data
export const clearAllData = async (): Promise<void> => {
  const keys = Object.values(STORAGE_KEYS);
  await AsyncStorage.multiRemove(keys);
};
