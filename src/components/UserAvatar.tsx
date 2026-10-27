import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { resolveAvatarUri } from "@/lib/avatarUri";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Shadows } from "@/constants/theme";
import { NotionFace, AVATAR_OPTIONS } from "@/components/AvatarPicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PROFILE_BADGES } from "@/constants/profileBadges";
import { usePresence } from "@/lib/liveStatus";

interface UserAvatarProps {
  /** Shown when there is no photo/avatar. Derived from `name` if omitted. */
  initials?: string;
  name?: string;
  /** Preset or a pixel size. */
  size?: "small" | "medium" | "large" | number;
  isWelfareMember?: boolean;
  avatar?: string;
  avatarId?: string;
  avatarColor?: string;
  /** Profile badge key (farming category or role), shown on the bottom-left. */
  badge?: string;
  /** The person's account id. When given, a dot shows bottom-right: green while the server
   *  says they have the app open right now, gray when they don't (real presence, never guessed;
   *  no dot for sample people without an account). */
  userId?: string;
  /** Presence decided by the caller (e.g. "Support" = any admin online). Overrides userId's. */
  presence?: "online" | "offline" | null;
  style?: ViewStyle;
}

const SIZES = {
  small: {
    avatar: 28,
    fontSize: 11,
    badge: 16,
    badgeIcon: 8,
  },
  medium: {
    avatar: 48,
    fontSize: 16,
    badge: 22,
    badgeIcon: 11,
  },
  large: {
    avatar: 88,
    fontSize: 28,
    badge: 32,
    badgeIcon: 16,
  },
};

function VerifiedBadge({ size, color = "#00A86B" }: { size: number; color?: string }) {
  const darkerColor = "#008F5B";
  const lighterColor = "#4CD494";
  
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <SvgLinearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={lighterColor} />
          <Stop offset="50%" stopColor={color} />
          <Stop offset="100%" stopColor={darkerColor} />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M12 2C11.5 2 11 2.19 10.59 2.59L9.79 3.4C9.39 3.8 8.87 4 8.34 4H7C5.9 4 5 4.9 5 6V7.34C5 7.87 4.8 8.39 4.4 8.79L3.59 9.59C2.79 10.39 2.79 11.61 3.59 12.41L4.4 13.21C4.8 13.61 5 14.13 5 14.66V16C5 17.1 5.9 18 7 18H8.34C8.87 18 9.39 18.2 9.79 18.6L10.59 19.41C11.39 20.21 12.61 20.21 13.41 19.41L14.21 18.6C14.61 18.2 15.13 18 15.66 18H17C18.1 18 19 17.1 19 16V14.66C19 14.13 19.2 13.61 19.6 13.21L20.41 12.41C21.21 11.61 21.21 10.39 20.41 9.59L19.6 8.79C19.2 8.39 19 7.87 19 7.34V6C19 4.9 18.1 4 17 4H15.66C15.13 4 14.61 3.8 14.21 3.4L13.41 2.59C13 2.19 12.5 2 12 2Z"
        fill="url(#badgeGradient)"
      />
      <Path
        d="M10.5 14.5L8.5 12.5L9.91 11.08L10.5 11.67L14.09 8.08L15.5 9.5L10.5 14.5Z"
        fill="white"
      />
    </Svg>
  );
}

export function UserAvatar({ 
  initials: initialsProp,
  name,
  size = "medium", 
  isWelfareMember = false,
  avatar,
  avatarId,
  avatarColor,
  badge,
  userId,
  presence: presenceProp,
  style 
}: UserAvatarProps) {
  const { theme } = useTheme();
  const watchedPresence = usePresence(presenceProp === undefined ? userId : undefined);
  const presence = presenceProp === undefined ? watchedPresence : presenceProp;
  const sizeConfig =
    typeof size === "number"
      ? { avatar: size, fontSize: Math.round(size * 0.36), badge: Math.round(size * 0.38), badgeIcon: Math.round(size * 0.2) }
      : SIZES[size];
  const initials =
    initialsProp ??
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  
  const backgroundColor = avatarColor || theme.primary;
  
  const notionAvatar = avatarId ? AVATAR_OPTIONS.find(a => a.id === avatarId) : null;
  const badgeInfo = badge ? PROFILE_BADGES[badge] : undefined;
  const profileBadgeSize = Math.max(14, Math.round(sizeConfig.avatar * 0.36));
  const onlineSize = Math.max(9, Math.round(sizeConfig.avatar * 0.28));

  return (
    <View style={[styles.container, style]}>
      {avatar ? (
        <Image 
          source={{ uri: resolveAvatarUri(avatar) }}
          style={[
            styles.avatarImage, 
            { 
              width: sizeConfig.avatar,
              height: sizeConfig.avatar,
              borderRadius: sizeConfig.avatar / 2,
            }
          ]}
          contentFit="cover"
        />
      ) : notionAvatar ? (
        <NotionFace avatar={notionAvatar} size={sizeConfig.avatar} animated={false} />
      ) : (
        <View 
          style={[
            styles.avatar, 
            { 
              backgroundColor,
              width: sizeConfig.avatar,
              height: sizeConfig.avatar,
              borderRadius: sizeConfig.avatar / 2,
            }
          ]}
        >
          <ThemedText 
            style={[
              styles.avatarText, 
              { fontSize: sizeConfig.fontSize }
            ]}
          >
            {initials}
          </ThemedText>
        </View>
      )}
      {badgeInfo ? (
        <View
          accessibilityLabel={badgeInfo.label}
          style={[
            styles.badgeContainer,
            styles.profileBadge,
            {
              width: profileBadgeSize,
              height: profileBadgeSize,
              borderRadius: badgeInfo.shape === "square" ? Math.round(profileBadgeSize * 0.3) : profileBadgeSize / 2,
              backgroundColor: badgeInfo.color,
              borderColor: theme.backgroundDefault,
              borderWidth: Math.max(1.5, Math.round(profileBadgeSize * 0.12)),
              bottom: -2,
              left: -2,
            },
          ]}
        >
          <MaterialCommunityIcons name={badgeInfo.icon} size={Math.round(profileBadgeSize * 0.6)} color="#FFFFFF" />
        </View>
      ) : null}
      {/* Corners never shared: profile badge bottom-left, online dot bottom-right, welfare tick top-right. */}
      {isWelfareMember ? (
        <View style={[styles.badgeContainer, styles.welfareTopRight]}>
          <VerifiedBadge size={Math.max(14, Math.round(sizeConfig.avatar * 0.34))} color="#00A86B" />
        </View>
      ) : null}
      {presence ? (
        <View
          accessibilityLabel={presence === "online" ? "Online" : "Offline"}
          testID={presence === "online" ? "online-dot" : "offline-dot"}
          style={[
            styles.onlineDot,
            {
              backgroundColor: presence === "online" ? "#00BB77" : "#9CA3AF",
              width: onlineSize,
              height: onlineSize,
              borderRadius: onlineSize / 2,
              borderWidth: Math.max(1.5, Math.round(onlineSize * 0.2)),
              borderColor: theme.backgroundDefault,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  profileBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  welfareTopRight: {
    left: undefined,
    bottom: undefined,
    top: -4,
    right: -4,
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "#00BB77",
  },
  badgeContainer: {
    position: "absolute",
    bottom: -4,
    left: -4,
    ...Shadows.small,
  },
});
