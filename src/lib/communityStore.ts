import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "./query-client";

export type CommunityType = "agriculture" | "health" | "education" | "business" | "technology";

export interface CommunityTheme {
  light: { primary: string; accent: string; bg: string; text: string; card: string; border: string };
  dark: { primary: string; accent: string; bg: string; text: string; card: string; border: string };
}

export interface Community {
  id: string;
  slug: string;
  type: CommunityType;
  nameBn: string | null;
  nameEn: string | null;
  theme: CommunityTheme;
  status: string;
  visibility: string;
  modules: Record<string, any>;
  iconUrl: string | null;
  bannerUrl: string | null;
  icon: string;
}

export const DEFAULT_COMMUNITIES: Community[] = [
  {
    id: "agriculture",
    slug: "agriculture",
    type: "agriculture",
    nameBn: "কৃষি",
    nameEn: "Agriculture",
    icon: "sun",
    theme: {
      light: { primary: "#2E96EF", accent: "#00BB77", bg: "#F3FAFF", text: "#202936", card: "#FFFFFF", border: "#D6EAF8" },
      dark: { primary: "#66BB6A", accent: "#9CCC65", bg: "#121212", text: "#FFFFFF", card: "#1E1E1E", border: "#202936" },
    },
    status: "active",
    visibility: "public",
    modules: { tools: true, market: true, posts: true },
    iconUrl: null,
    bannerUrl: null,
  },
  {
    id: "health",
    slug: "health",
    type: "health",
    nameBn: "স্বাস্থ্য",
    nameEn: "Health",
    icon: "heart",
    theme: {
      light: { primary: "#FF4BB7", accent: "#F48FB1", bg: "#F3FAFF", text: "#202936", card: "#FFFFFF", border: "#D6EAF8" },
      dark: { primary: "#EC407A", accent: "#F06292", bg: "#121212", text: "#FFFFFF", card: "#1E1E1E", border: "#202936" },
    },
    status: "active",
    visibility: "public",
    modules: { tools: true, market: true, posts: true },
    iconUrl: null,
    bannerUrl: null,
  },
  {
    id: "education",
    slug: "education",
    type: "education",
    nameBn: "শিক্ষা",
    nameEn: "Education",
    icon: "book",
    theme: {
      light: { primary: "#2E96EF", accent: "#39B1FE", bg: "#F3FAFF", text: "#202936", card: "#FFFFFF", border: "#D6EAF8" },
      dark: { primary: "#42A5F5", accent: "#39B1FE", bg: "#121212", text: "#FFFFFF", card: "#1E1E1E", border: "#202936" },
    },
    status: "active",
    visibility: "public",
    modules: { tools: true, market: true, posts: true },
    iconUrl: null,
    bannerUrl: null,
  },
  {
    id: "business",
    slug: "business",
    type: "business",
    nameBn: "ব্যবসা",
    nameEn: "Business",
    icon: "briefcase",
    theme: {
      light: { primary: "#B25E09", accent: "#FFB74D", bg: "#F3FAFF", text: "#202936", card: "#FFFFFF", border: "#D6EAF8" },
      dark: { primary: "#FFA726", accent: "#FFB74D", bg: "#121212", text: "#FFFFFF", card: "#1E1E1E", border: "#202936" },
    },
    status: "active",
    visibility: "public",
    modules: { tools: true, market: true, posts: true },
    iconUrl: null,
    bannerUrl: null,
  },
  {
    id: "technology",
    slug: "technology",
    type: "technology",
    nameBn: "প্রযুক্তি",
    nameEn: "Technology",
    icon: "cpu",
    theme: {
      light: { primary: "#3D38D0", accent: "#BA68C8", bg: "#F3FAFF", text: "#202936", card: "#FFFFFF", border: "#D6EAF8" },
      dark: { primary: "#AB47BC", accent: "#BA68C8", bg: "#121212", text: "#FFFFFF", card: "#1E1E1E", border: "#202936" },
    },
    status: "active",
    visibility: "public",
    modules: { tools: true, market: true, posts: true },
    iconUrl: null,
    bannerUrl: null,
  },
];

export interface CommunityMembership {
  communityId: string;
  role: string;
  status: string;
  community?: Community;
}

interface CommunityState {
  communities: Community[];
  memberships: CommunityMembership[];
  activeCommunityId: string | null;
  activeCommunity: Community | null;
  isLoading: boolean;
  error: string | null;

  loadCommunities: () => Promise<void>;
  setMemberships: (memberships: CommunityMembership[]) => void;
  setActiveCommunity: (communityId: string) => Promise<void>;
  joinCommunity: (communityId: string, token: string) => Promise<boolean>;
  leaveCommunity: (communityId: string, token: string) => Promise<boolean>;
  clearCommunityState: () => void;
}

const STORAGE_KEY = "active_community_id";

export const useCommunityStore = create<CommunityState>((set, get) => ({
  communities: [],
  memberships: [],
  activeCommunityId: null,
  activeCommunity: null,
  isLoading: false,
  error: null,

  loadCommunities: async () => {
    set({ isLoading: true, error: null });
    try {
      let communities: Community[] = DEFAULT_COMMUNITIES;
      
      try {
        const response = await fetch(`${getApiUrl()}/api/communities`);
        if (response.ok) {
          const serverCommunities = await response.json();
          if (serverCommunities && serverCommunities.length > 0) {
            communities = serverCommunities;
          }
        }
      } catch {
        console.log("Using default communities");
      }
      
      const storedId = await AsyncStorage.getItem(STORAGE_KEY);
      let activeCommunityId: string | null = storedId;
      
      if (!activeCommunityId && communities.length > 0) {
        activeCommunityId = communities[0].id;
      }
      
      if (activeCommunityId) {
        await AsyncStorage.setItem(STORAGE_KEY, activeCommunityId);
      }
      
      const activeCommunity = activeCommunityId
        ? communities.find((c: Community) => c.id === activeCommunityId) || communities[0]
        : communities[0];
      
      set({ communities, activeCommunityId: activeCommunity?.id || null, activeCommunity, isLoading: false });
    } catch (error: any) {
      console.error("Load communities error:", error);
      set({ communities: DEFAULT_COMMUNITIES, activeCommunity: DEFAULT_COMMUNITIES[0], activeCommunityId: DEFAULT_COMMUNITIES[0].id, error: null, isLoading: false });
    }
  },

  setMemberships: (memberships) => {
    set({ memberships });
  },

  setActiveCommunity: async (communityId: string) => {
    const { communities } = get();
    const community = communities.find(c => c.id === communityId);
    
    if (community) {
      await AsyncStorage.setItem(STORAGE_KEY, communityId);
      set({ activeCommunityId: communityId, activeCommunity: community });
    }
  },

  joinCommunity: async (communityId: string, token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/communities/${communityId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to join community");
      }
      
      const { memberships } = get();
      const community = get().communities.find(c => c.id === communityId);
      
      if (community) {
        set({
          memberships: [
            ...memberships,
            { communityId, role: "member", status: "active", community },
          ],
        });
      }
      
      return true;
    } catch (error: any) {
      console.error("Join community error:", error);
      set({ error: error.message });
      return false;
    }
  },

  leaveCommunity: async (communityId: string, token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/communities/${communityId}/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to leave community");
      }
      
      const { memberships, activeCommunityId } = get();
      const updatedMemberships = memberships.filter(m => m.communityId !== communityId);
      
      set({ memberships: updatedMemberships });
      
      if (activeCommunityId === communityId && updatedMemberships.length > 0) {
        get().setActiveCommunity(updatedMemberships[0].communityId);
      }
      
      return true;
    } catch (error: any) {
      console.error("Leave community error:", error);
      set({ error: error.message });
      return false;
    }
  },

  clearCommunityState: () => {
    AsyncStorage.removeItem(STORAGE_KEY);
    set({
      memberships: [],
      activeCommunityId: null,
      activeCommunity: null,
    });
  },
}));
