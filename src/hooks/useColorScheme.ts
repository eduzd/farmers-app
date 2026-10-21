import { useColorScheme as useDeviceColorScheme } from "react-native";
import { useThemeStore } from "@/lib/themeStore";

export function useColorScheme(): "light" | "dark" {
  const deviceScheme = useDeviceColorScheme();
  const preference = useThemeStore((state) => state.preference);
  
  if (preference === "system") {
    return deviceScheme ?? "light";
  }
  
  return preference;
}
