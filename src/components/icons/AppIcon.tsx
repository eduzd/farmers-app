import React from "react";
import { Feather } from "@expo/vector-icons";
import { StyleSheet } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";
import { ChatIcon } from "./ChatIcon";
import { FEATHER_PATHS } from "./featherPaths";
import { useThemeScope } from "@/contexts/ThemeScope";
import { MAYA_ICON_STROKE, liftForDark } from "@/constants/mayaTheme";
import { useTheme } from "@/hooks/useTheme";

const SVG_TAGS: Record<string, React.ComponentType<any>> = {
  path: Path,
  circle: Circle,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
  rect: Rect,
  ellipse: Ellipse,
};

const camel = (k: string) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Feather geometry drawn with Maya's thin 1.5px rounded outline stroke. */
export function ThinIcon({
  name,
  size = 20,
  color = "#202936",
  style,
  testID,
  strokeWidth = MAYA_ICON_STROKE,
  fill = "none",
}: {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  testID?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const els = FEATHER_PATHS[name];
  if (!els) return null;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={StyleSheet.flatten(style)}
      testID={testID}
    >
      {els.map(([tag, attrs], i) => {
        const El = SVG_TAGS[tag];
        if (!El) return null;
        const props: Record<string, string> = {};
        for (const k of Object.keys(attrs)) props[camel(k)] = attrs[k];
        return <El key={i} {...props} />;
      })}
    </Svg>
  );
}

/** Feather icon names that mean chat / message / comment. They all draw the app's own ChatIcon. */
export const CHAT_ICON_NAMES = new Set<string>(["message-circle", "message-square"]);

export function isChatIconName(name: unknown): boolean {
  return typeof name === "string" && CHAT_ICON_NAMES.has(name);
}

type Props = React.ComponentProps<typeof Feather> & { fill?: string };

/**
 * Drop-in for <Feather name=...>: same props. Chat / message / comment names render the shared
 * ChatIcon (the Chats tab icon), every other name renders Feather as before.
 */
export function AppIcon(props: Props) {
  const { name, size = 20, style, testID, fill } = props as any;
  const scope = useThemeScope();
  const { isDark } = useTheme();
  // Dark mode: deep red / violet / amber icons made for white cards get their light tone.
  const color = liftForDark((props as any).color, isDark) ?? (props as any).color;
  if (isChatIconName(name)) {
    return <ChatIcon size={size} color={typeof color === "string" ? color : undefined} style={style} testID={testID} />;
  }
  // Maya marketplace: thin outline icons instead of the Feather font's 2px stroke.
  if (scope === "maya" && typeof name === "string" && FEATHER_PATHS[name]) {
    return <ThinIcon name={name} size={size} color={typeof color === "string" ? color : undefined} style={style} testID={testID} fill={fill} />;
  }
  return <Feather {...props} color={color} />;
}

export default AppIcon;
