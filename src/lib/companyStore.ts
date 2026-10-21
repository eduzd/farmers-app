import { create } from "zustand";
import {
  Company,
  CompanyProduct,
  CompanyReview,
  CompanyChat,
  saveCompany,
  getCompany,
  getUserCompany,
  saveUserCompany,
  saveCompanyProducts,
  getCompanyProducts,
  saveCompanyReviews,
  getCompanyReviews,
  saveCompanyChats,
  getCompanyChats,
  addCompanyToList,
} from "./storage";

interface CompanyState {
  company: Company | null;
  products: CompanyProduct[];
  reviews: CompanyReview[];
  chats: CompanyChat[];
  isLoading: boolean;

  loadCompany: (userId: string) => Promise<void>;
  createCompany: (userId: string, companyData: Omit<Company, "id" | "ownerId" | "createdAt" | "rating" | "reviewsCount" | "followersCount" | "productsCount">) => Promise<Company>;
  updateCompany: (updates: Partial<Company>) => Promise<void>;
  
  addProduct: (product: Omit<CompanyProduct, "id" | "companyId" | "createdAt" | "rating" | "reviewsCount">) => Promise<void>;
  updateProduct: (productId: string, updates: Partial<CompanyProduct>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  
  loadReviews: () => Promise<void>;
  loadChats: () => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  company: null,
  products: [],
  reviews: [],
  chats: [],
  isLoading: false,

  loadCompany: async (userId: string) => {
    set({ isLoading: true });
    try {
      const company = await getUserCompany(userId);
      if (company) {
        const products = await getCompanyProducts(company.id);
        const reviews = await getCompanyReviews(company.id);
        let chats = await getCompanyChats(company.id);
        
        // Sample chats saved by older versions are dropped; only real customer chats stay.
        const sampleIds = new Set(["chat_1", "chat_2", "chat_3", "chat_4", "chat_5"]);
        if (chats.some((c) => sampleIds.has(c.id) && /^user_\d+$/.test(c.customerId))) {
          chats = chats.filter((c) => !(sampleIds.has(c.id) && /^user_\d+$/.test(c.customerId)));
          await saveCompanyChats(company.id, chats);
        }
        
        set({ company, products, reviews, chats });
      }
    } catch (error) {
      console.error("Error loading company:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createCompany: async (userId, companyData) => {
    const company: Company = {
      id: `company_${Date.now()}`,
      ownerId: userId,
      ...companyData,
      verified: false,
      rating: 0,
      reviewsCount: 0,
      followersCount: 0,
      productsCount: 0,
      totalSales: 0,
      responseRate: 100,
      responseTime: "১ ঘন্টার মধ্যে",
      shipOnTime: 100,
      establishedYear: new Date().getFullYear(),
      returnPolicy: "৭ দিনের মধ্যে রিটার্ন গ্রহণযোগ্য",
      shippingPolicy: "সারা বাংলাদেশে ডেলিভারি",
      paymentMethods: ["cash", "bkash", "nagad"],
      businessHours: "সকাল ৯টা - রাত ৯টা",
      createdAt: new Date().toISOString(),
    };

    await saveCompany(company);
    await saveUserCompany(userId, company.id);
    await addCompanyToList(company);
    set({ company });
    return company;
  },

  updateCompany: async (updates) => {
    const { company } = get();
    if (!company) return;

    const updatedCompany = { ...company, ...updates };
    await saveCompany(updatedCompany);
    set({ company: updatedCompany });
  },

  addProduct: async (productData) => {
    const { company, products } = get();
    if (!company) return;

    const product: CompanyProduct = {
      id: `product_${Date.now()}`,
      companyId: company.id,
      ...productData,
      rating: 0,
      reviewsCount: 0,
      createdAt: new Date().toISOString(),
    };

    const updatedProducts = [...products, product];
    await saveCompanyProducts(company.id, updatedProducts);
    
    const updatedCompany = { ...company, productsCount: updatedProducts.length };
    await saveCompany(updatedCompany);
    
    set({ products: updatedProducts, company: updatedCompany });
  },

  updateProduct: async (productId, updates) => {
    const { company, products } = get();
    if (!company) return;

    const updatedProducts = products.map((p) =>
      p.id === productId ? { ...p, ...updates } : p
    );
    await saveCompanyProducts(company.id, updatedProducts);
    set({ products: updatedProducts });
  },

  deleteProduct: async (productId) => {
    const { company, products } = get();
    if (!company) return;

    const updatedProducts = products.filter((p) => p.id !== productId);
    await saveCompanyProducts(company.id, updatedProducts);
    
    const updatedCompany = { ...company, productsCount: updatedProducts.length };
    await saveCompany(updatedCompany);
    
    set({ products: updatedProducts, company: updatedCompany });
  },

  loadReviews: async () => {
    const { company } = get();
    if (!company) return;
    
    const reviews = await getCompanyReviews(company.id);
    set({ reviews });
  },

  loadChats: async () => {
    const { company } = get();
    if (!company) return;
    
    const chats = await getCompanyChats(company.id);
    set({ chats });
  },
}));
