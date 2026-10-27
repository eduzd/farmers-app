import React from "react";
import { Feather as ExpoFeather } from "@expo/vector-icons";
import { ThinIcon } from "./AppIcon";
import { FEATHER_PATHS } from "./featherPaths";
import { useThemeScope } from "@/contexts/ThemeScope";
import { useTheme } from "@/hooks/useTheme";
import { liftForDark } from "@/constants/mayaTheme";

type Props = React.ComponentProps<typeof ExpoFeather> & { fill?: string };

/**
 * Drop-in for `Feather` from @expo/vector-icons with the same props and glyph names.
 * Inside the Maya theme (the whole app) it draws Feather's geometry with Maya's thin
 * 1.5px outline stroke; anything it cannot draw falls back to the Feather font.
 */
function MayaFeather(props: Props) {
  const { name, size = 20, style, testID, fill } = props as any;
  const scope = useThemeScope();
  const { isDark } = useTheme();
  // Dark mode: deep red / violet / amber icons made for white cards get their light tone.
  const color = liftForDark((props as any).color, isDark) ?? (props as any).color;
  if (scope === "maya" && typeof name === "string" && FEATHER_PATHS[name]) {
    return (
      <ThinIcon
        name={name}
        size={size}
        color={typeof color === "string" ? color : undefined}
        style={style}
        testID={testID}
        fill={fill}
      />
    );
  }
  return <ExpoFeather {...props} color={color} />;
}

(MayaFeather as any).glyphMap = ExpoFeather.glyphMap;

export const Feather = MayaFeather as unknown as typeof ExpoFeather;
export default Feather;
