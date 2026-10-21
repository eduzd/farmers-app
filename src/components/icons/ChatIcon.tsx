import React from "react";
import Svg, { Path } from "react-native-svg";

type Props = { size?: number; color?: string };

// Rounded speech bubble with a bottom-left tail and two text lines (user's custom chat icon).
export function ChatIcon({ size = 20, color = "#292D32" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 3h4c3.9 0 7 3.1 7 7s-3.1 7-7 7h-1l-3.5 3.7c-.45.47-1.25.15-1.25-.5V16.8C5.2 16.2 3 13.4 3 10c0-3.9 3.1-7 7-7Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8.5 8.3h7M8.5 11.7h4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export default ChatIcon;
