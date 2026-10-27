import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

type Props = { size?: number; color?: string; fill?: string; style?: StyleProp<ViewStyle> | any; testID?: string };

// Support headset, drawn like the floating "Need help?" button on maya.net: black outline,
// ear cups filled with Maya mint (#D8FFF2), a mic arm curling down from the right cup.
export function HeadsetIcon({ size = 24, color = "#000000", fill = "#D8FFF2", style, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30" fill="none" style={style} testID={testID}>
      <Path
        d="M21.25 14.7556C21.25 14.3235 21.25 14.1075 21.315 13.915C21.504 13.3555 22.0023 13.1385 22.5014 12.9111C23.0625 12.6555 23.343 12.5277 23.621 12.5052C23.9366 12.4797 24.2527 12.5477 24.5225 12.6991C24.8801 12.8997 25.1295 13.2811 25.3849 13.5912C26.5641 15.0235 27.1536 15.7398 27.3694 16.5295C27.5435 17.1668 27.5435 17.8332 27.3694 18.4705C27.0548 19.6224 26.0606 20.588 25.3247 21.4817C24.9484 21.9389 24.7601 22.1675 24.5225 22.3009C24.2527 22.4522 23.9366 22.5202 23.621 22.4947C23.343 22.4722 23.0625 22.3445 22.5014 22.0889C22.0023 21.8615 21.504 21.6445 21.315 21.085C21.25 20.8925 21.25 20.6765 21.25 20.2444V14.7556Z"
        fill={fill}
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M8.75 14.7557C8.75 14.2117 8.73472 13.7227 8.29489 13.3402C8.13491 13.2011 7.92281 13.1045 7.49864 12.9112C6.93751 12.6557 6.65695 12.528 6.37895 12.5055C5.54489 12.438 5.09615 13.0072 4.61516 13.5915C3.43594 15.0237 2.84633 15.7398 2.63058 16.5296C2.45647 17.167 2.45647 17.8335 2.63058 18.4707C2.94525 19.6226 3.9394 20.5881 4.67526 21.482C5.13911 22.0453 5.58221 22.5593 6.37895 22.495C6.65695 22.4725 6.93751 22.3446 7.49864 22.0891C7.92281 21.8958 8.13491 21.7992 8.29489 21.6601C8.73472 21.2776 8.75 20.7887 8.75 20.2446V14.7557Z"
        fill={fill}
        stroke={color}
        strokeWidth={2}
      />
      <Path d="M25 13.125V11.25C25 6.41751 20.5229 2.5 15 2.5C9.47715 2.5 5 6.41751 5 11.25V13.125" stroke={color} strokeWidth={2} />
      <Path d="M25 21.875C25 27.5 20 27.5 15 27.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default HeadsetIcon;
