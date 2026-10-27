import { useColorScheme as useDeviceColorScheme } from "react-native";
import { Colors, CommunityAccents, ThemeColors } from "@/constants/theme";
import { useThemeStore } from "@/lib/themeStore";
import { useCommunityStore } from "@/lib/communityStore";
import { useThemeScope } from "@/contexts/ThemeScope";
import { MayaColors } from "@/constants/mayaTheme";

/**
 * Returns the active colour set. Communities only change the accent
 * (primary / primaryTint / primarySoft); surfaces and text always come from
 * the design system so every community stays readable in light and dark.
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

  const accent = activeCommunity ? CommunityAccents[activeCommunity.type] : undefined;
  // The Maya-style marketplace has one fixed palette, whatever the community.
  const theme: ThemeColors = scope === "maya"
    ? MayaColors[colorScheme]
    : accent && activeCommunity?.type !== "agriculture"
      ? {
          ...baseTheme,
          primary: isDark ? accent.dark : accent.light,
          primaryTint: isDark ? accent.dark : accent.light,
          primarySoft: isDark ? accent.softDark : accent.soft,
          link: isDark ? accent.dark : accent.light,
          tabIconSelected: isDark ? accent.dark : accent.light,
          gradientStart: isDark ? accent.dark : accent.light,
          gradientEnd: isDark ? accent.light : accent.dark,
        }
      : baseTheme;

  return {
    theme,
    isDark,
    colorScheme,
    scope,
    communityTheme: activeCommunity?.theme?.[colorScheme],
  };
}
