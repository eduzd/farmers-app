import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

type Props = { size?: number; color?: string };

// Round head over a rounded bust with a soft neck dip (user's custom profile icon).
export function ProfileIcon({ size = 20, color = "#292D32" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={7} r={3.75} stroke={color} strokeWidth={1.7} />
      <Path
        d="M6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-1.4c0-2.3-1.2-3.8-2.7-4.5-.5-.25-1-.2-1.45.1-.85.6-1.8.9-2.85.9s-2-.3-2.85-.9c-.45-.3-.95-.35-1.45-.1C6.2 13.3 5 14.8 5 17.1v1.4A1.5 1.5 0 0 0 6.5 20Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default ProfileIcon;
