import { useColorScheme as useDeviceColorScheme } from "react-native";
import { Colors, ThemeColors } from "@/constants/theme";
import { useThemeStore } from "@/lib/themeStore";
import { useCommunityStore } from "@/lib/communityStore";
import { useThemeScope } from "@/contexts/ThemeScope";
import { MayaColors } from "@/constants/mayaTheme";

/**
 * Returns the active colour set: the Maya palette (light or dark) for every
 * screen and every community.
 */
export function useTheme() {
  const deviceScheme = useDeviceColorScheme();
  const { preference } = useThemeStore();
  const { activeCommunity } = useCommunityStore();
  const scope = useThemeScope();

  const colorScheme: "light" | "dark" =
    preference === "system" ? (deviceScheme === "dark" ? "dark" : "light") : preference;
  const isDark = colorScheme === "dark";
  const baseTheme = Colors[colorScheme];

  // One Maya palette for the whole app, whatever the community.
  const theme: ThemeColors = scope === "maya" ? MayaColors[colorScheme] : baseTheme;

  return {
    theme,
    isDark,
    colorScheme,
    scope,
    communityTheme: activeCommunity?.theme?.[colorScheme],
  };
}
