import { create } from "zustand";
import { saveThemePreference, getThemePreference } from "./storage";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeState {
  preference: ThemePreference;
  isLoading: boolean;
  
  setPreference: (preference: ThemePreference) => Promise<void>;
  loadPreference: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: "system",
  isLoading: true,
  
  setPreference: async (preference) => {
    await saveThemePreference(preference);
    set({ preference });
  },
  
  loadPreference: async () => {
    set({ isLoading: true });
    const preference = await getThemePreference();
    set({ preference, isLoading: false });
  },
}));
