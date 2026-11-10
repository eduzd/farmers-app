import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

type Props = { size?: number; color?: string; style?: StyleProp<ViewStyle> | any; testID?: string };

// Solid share icon the user picked (4th icon, top row of their reference image, 2026-10-27):
// three filled dots joined by bold links that widen into the dots.
// This is THE share icon of the app: every share button (profile, posts, shop, product, polls,
// groups, tips, referral, invoices...) draws it, so it looks the same everywhere.
export function ShareIcon({ size = 20, color = "#202936", style, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} testID={testID}>
      <Path d="M6.45 14.18C13.59 9.01 10.97 10.21 19.55 8.18L17.55 3.82C10.41 8.99 13.03 7.79 4.45 9.82Z" fill={color} />
      <Path d="M4.45 14.18C13.03 16.21 10.41 15.01 17.55 20.18L19.55 15.82C10.97 13.79 13.59 14.99 6.45 9.82Z" fill={color} />
      <Circle cx={18.55} cy={6} r={3.4} fill={color} />
      <Circle cx={5.45} cy={12} r={3.4} fill={color} />
      <Circle cx={18.55} cy={18} r={3.4} fill={color} />
    </Svg>
  );
}

/** Icon names that mean share. They all draw ShareIcon. */
export const SHARE_ICON_NAMES = new Set<string>(["share-2", "share"]);

export function isShareIconName(name: unknown): boolean {
  return typeof name === "string" && SHARE_ICON_NAMES.has(name);
}

export default ShareIcon;
