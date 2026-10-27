import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Path, G, Circle, Ellipse, Rect, Line, Defs, ClipPath } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export interface AvatarOption {
  id: string;
  initials: string;
  backgroundColor: string;
  hairStyle: number;
  faceStyle: number;
  eyeStyle: number;
  mouthStyle: number;
  accessory: number;
  shirtStyle: number;
  beardStyle: number;
}

const BACKGROUNDS = [
  "#FFF1DE", "#E3F4FF", "#FCE7F3", "#D8FFF2", "#FEE2E2", 
  "#E0E7FF", "#CFFAFE", "#FDE68A", "#C7D2FE", "#B0FFE2",
  "#FBCFE8", "#CFEBFF", "#FED7AA", "#DDD6FE", "#BBF7D0",
  "#F5D0FE", "#99F6E4", "#FECACA", "#C4B5FD", "#6EE7B7",
];

export const AVATAR_OPTIONS: AvatarOption[] = Array.from({ length: 30 }, (_, i) => ({
  id: `avatar-${i + 1}`,
  initials: "",
  backgroundColor: BACKGROUNDS[i % BACKGROUNDS.length],
  hairStyle: i % 10,
  faceStyle: i % 3,
  eyeStyle: i % 5,
  mouthStyle: i % 5,
  accessory: i % 6,
  shirtStyle: i % 6,
  beardStyle: i % 4,
}));

function NotionFace({ avatar, size = 48, animated = true }: { avatar: AvatarOption; size?: number; animated?: boolean }) {
  const floatY = useSharedValue(0);
  const headTilt = useSharedValue(0);
  
  useEffect(() => {
    if (animated) {
      floatY.value = withRepeat(
        withSequence(
          withTiming(-1.5, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.5, { duration: 1500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
      headTilt.value = withRepeat(
        withSequence(
          withTiming(-0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: `${headTilt.value}deg` }
    ],
  }));

  const strokeColor = "#1A1A1A";
  const strokeWidth = 2;
  const fillColor = "#FFFFFF";

  const renderShirt = () => {
    switch (avatar.shirtStyle) {
      case 0:
        return (
          <G>
            <Path d="M22 72 Q22 66 35 62 L50 60 L65 62 Q78 66 78 72 L78 105 L22 105 Z" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
            <Path d="M42 62 L50 70 L58 62" stroke={strokeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Line x1="50" y1="70" x2="50" y2="85" stroke={strokeColor} strokeWidth={strokeWidth} />
          </G>
        );
      case 1:
        return (
          <G>
            <Path d="M22 72 Q22 66 35 62 L50 60 L65 62 Q78 66 78 72 L78 105 L22 105 Z" fill={strokeColor} stroke={strokeColor} strokeWidth={strokeWidth} />
            <Ellipse cx="50" cy="65" rx="10" ry="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
          </G>
        );
      case 2:
        return (
          <G>
            <Path d="M22 72 Q22 66 35 62 L50 60 L65 62 Q78 66 78 72 L78 105 L22 105 Z" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
            <Line x1="22" y1="75" x2="78" y2="75" stroke={strokeColor} strokeWidth="1.5" />
            <Line x1="22" y1="82" x2="78" y2="82" stroke={strokeColor} strokeWidth="1.5" />
            <Line x1="22" y1="89" x2="78" y2="89" stroke={strokeColor} strokeWidth="1.5" />
          </G>
        );
      case 3:
        return (
          <G>
            <Path d="M22 72 Q22 66 35 62 L50 60 L65 62 Q78 66 78 72 L78 105 L22 105 Z" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
            <Path d="M42 62 L46 68 L50 60 L54 68 L58 62" stroke={strokeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="50" cy="78" r="2" fill={strokeColor} />
            <Circle cx="50" cy="88" r="2" fill={strokeColor} />
          </G>
        );
      case 4:
        return (
          <G>
            <Path d="M22 72 Q22 66 35 62 L50 60 L65 62 Q78 66 78 72 L78 105 L22 105 Z" fill={strokeColor} stroke={strokeColor} strokeWidth={strokeWidth} />
            <Line x1="50" y1="60" x2="50" y2="105" stroke={fillColor} strokeWidth="8" />
          </G>
        );
      case 5:
      default:
        return (
          <G>
            <Path d="M22 72 Q22 66 35 62 L50 60 L65 62 Q78 66 78 72 L78 105 L22 105 Z" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
            <Rect x="40" y="66" width="20" height="12" rx="2" stroke={strokeColor} strokeWidth="1.5" fill="none" />
            <Line x1="50" y1="66" x2="50" y2="78" stroke={strokeColor} strokeWidth="1" />
            <Line x1="40" y1="72" x2="60" y2="72" stroke={strokeColor} strokeWidth="1" />
          </G>
        );
    }
  };

  const renderNeck = () => {
    return <Rect x="42" y="52" width="16" height="12" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />;
  };

  const renderEars = () => {
    return (
      <G>
        <Ellipse cx="27" cy="40" rx="4" ry="6" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
        <Ellipse cx="73" cy="40" rx="4" ry="6" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
      </G>
    );
  };

  const renderFace = () => {
    return <Ellipse cx="50" cy="38" rx="23" ry="26" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />;
  };

  const renderHair = () => {
    switch (avatar.hairStyle) {
      case 0:
        return (
          <G>
            <Path d="M27 35 Q28 12 50 8 Q72 12 73 35 L73 22 Q50 2 27 22 Z" fill={strokeColor} />
            <Path d="M35 16 Q32 8 42 10" fill={strokeColor} />
            <Path d="M50 12 Q54 4 58 12" fill={strokeColor} />
            <Path d="M65 16 Q68 8 58 10" fill={strokeColor} />
          </G>
        );
      case 1:
        return (
          <G>
            <Path d="M30 38 Q32 18 50 14 Q68 18 70 38 L70 25 Q50 10 30 25 Z" fill={strokeColor} />
            <Circle cx="62" cy="16" r="8" fill={strokeColor} />
          </G>
        );
      case 2:
        return (
          <G>
            <Path d="M28 40 Q30 16 50 10 Q70 16 72 40 L72 24 Q50 4 28 24 Z" fill={strokeColor} />
            <Path d="M28 40 L24 52" stroke={strokeColor} strokeWidth="6" strokeLinecap="round" />
            <Path d="M72 40 L76 52" stroke={strokeColor} strokeWidth="6" strokeLinecap="round" />
          </G>
        );
      case 3:
        return (
          <G>
            <Circle cx="34" cy="22" r="10" fill={strokeColor} />
            <Circle cx="50" cy="16" r="12" fill={strokeColor} />
            <Circle cx="66" cy="22" r="10" fill={strokeColor} />
            <Circle cx="28" cy="32" r="7" fill={strokeColor} />
            <Circle cx="72" cy="32" r="7" fill={strokeColor} />
            <Circle cx="40" cy="18" r="7" fill={strokeColor} />
            <Circle cx="60" cy="18" r="7" fill={strokeColor} />
          </G>
        );
      case 4:
        return (
          <G>
            <Path d="M30 40 Q32 20 50 16 Q68 20 70 40 L70 28 Q50 12 30 28 Z" fill={strokeColor} />
          </G>
        );
      case 5:
        return (
          <G>
            <Path d="M28 38 Q30 14 50 8 Q70 14 72 38 L72 22 Q50 2 28 22 Z" fill={strokeColor} />
            <Path d="M40 14 L36 2" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" />
            <Path d="M50 10 L50 -2" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" />
            <Path d="M60 14 L64 2" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" />
          </G>
        );
      case 6:
        return (
          <G>
            <Path d="M32 42 Q35 28 50 24 Q65 28 68 42 L68 32 Q50 20 32 32 Z" fill={strokeColor} opacity="0.7" />
          </G>
        );
      case 7:
        return (
          <G>
            <Path d="M26 42 Q26 12 50 6 Q74 12 74 42 L74 24 Q50 0 26 24 Z" fill={strokeColor} />
            <Path d="M26 42 L22 58" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
            <Path d="M74 42 L78 58" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
          </G>
        );
      case 8:
        return (
          <G>
            <Path d="M30 40 Q32 22 50 18 Q68 22 70 40 L70 30 Q50 16 30 30 Z" fill={strokeColor} />
            <Ellipse cx="50" cy="12" rx="12" ry="8" fill={strokeColor} />
          </G>
        );
      case 9:
      default:
        return (
          <G>
            <Path d="M28 38 Q30 16 50 10 Q70 16 72 38 L72 25 Q50 6 28 25 Z" fill={strokeColor} />
            <Path d="M72 38 Q80 35 82 48 Q80 62 72 68" stroke={strokeColor} strokeWidth="6" fill="none" strokeLinecap="round" />
          </G>
        );
    }
  };

  const renderEyes = () => {
    const eyeY = 38;
    const leftX = 42;
    const rightX = 58;

    switch (avatar.eyeStyle) {
      case 0:
        return (
          <G>
            <Circle cx={leftX} cy={eyeY} r="3" fill={strokeColor} />
            <Circle cx={rightX} cy={eyeY} r="3" fill={strokeColor} />
          </G>
        );
      case 1:
        return (
          <G>
            <Ellipse cx={leftX} cy={eyeY} rx="4" ry="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
            <Circle cx={leftX + 1} cy={eyeY} r="2" fill={strokeColor} />
            <Ellipse cx={rightX} cy={eyeY} rx="4" ry="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
            <Circle cx={rightX + 1} cy={eyeY} r="2" fill={strokeColor} />
          </G>
        );
      case 2:
        return (
          <G>
            <Path d={`M${leftX - 4} ${eyeY} Q${leftX} ${eyeY - 5} ${leftX + 4} ${eyeY}`} stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <Path d={`M${rightX - 4} ${eyeY} Q${rightX} ${eyeY - 5} ${rightX + 4} ${eyeY}`} stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </G>
        );
      case 3:
        return (
          <G>
            <Circle cx={leftX} cy={eyeY} r="3" fill={strokeColor} />
            <Path d={`M${rightX - 5} ${eyeY} Q${rightX} ${eyeY + 3} ${rightX + 5} ${eyeY}`} stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </G>
        );
      case 4:
      default:
        return (
          <G>
            <Line x1={leftX - 4} y1={eyeY} x2={leftX + 4} y2={eyeY} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
            <Line x1={rightX - 4} y1={eyeY} x2={rightX + 4} y2={eyeY} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          </G>
        );
    }
  };

  const renderEyebrows = () => {
    return (
      <G>
        <Path d="M36 30 Q42 28 48 30" stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" />
        <Path d="M52 30 Q58 28 64 30" stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" />
      </G>
    );
  };

  const renderNose = () => {
    return <Path d="M50 42 Q52 46 50 48" stroke={strokeColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  };

  const renderMouth = () => {
    switch (avatar.mouthStyle) {
      case 0:
        return <Path d="M44 52 Q50 58 56 52" stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" />;
      case 1:
        return <Line x1="45" y1="53" x2="55" y2="53" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />;
      case 2:
        return (
          <G>
            <Path d="M43 51 Q50 60 57 51" fill={strokeColor} />
          </G>
        );
      case 3:
        return <Path d="M46 52 Q50 56 54 52" stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" />;
      case 4:
      default:
        return (
          <G>
            <Ellipse cx="50" cy="54" rx="4" ry="4" fill={strokeColor} />
          </G>
        );
    }
  };

  const renderBeard = () => {
    switch (avatar.beardStyle) {
      case 1:
        return (
          <G>
            <Path d="M38 50 Q35 58 38 64 Q50 70 62 64 Q65 58 62 50" stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            <Line x1="42" y1="52" x2="40" y2="62" stroke={strokeColor} strokeWidth="1.5" />
            <Line x1="50" y1="54" x2="50" y2="66" stroke={strokeColor} strokeWidth="1.5" />
            <Line x1="58" y1="52" x2="60" y2="62" stroke={strokeColor} strokeWidth="1.5" />
          </G>
        );
      case 2:
        return (
          <G>
            <Path d="M42 54 Q44 58 50 58 Q56 58 58 54" stroke={strokeColor} strokeWidth="3" fill="none" strokeLinecap="round" />
          </G>
        );
      case 3:
        return (
          <G>
            <Path d="M36 48 Q34 56 38 64 Q50 72 62 64 Q66 56 64 48" fill={strokeColor} />
            <Path d="M44 52 Q50 58 56 52" stroke={fillColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          </G>
        );
      default:
        return null;
    }
  };

  const renderAccessory = () => {
    switch (avatar.accessory) {
      case 0:
        return (
          <G>
            <Circle cx="42" cy="38" r="7" stroke={strokeColor} strokeWidth="2" fill="none" />
            <Circle cx="58" cy="38" r="7" stroke={strokeColor} strokeWidth="2" fill="none" />
            <Line x1="49" y1="38" x2="51" y2="38" stroke={strokeColor} strokeWidth="2" />
            <Line x1="35" y1="36" x2="27" y2="34" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
            <Line x1="65" y1="36" x2="73" y2="34" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          </G>
        );
      case 1:
        return (
          <G>
            <Path d="M22 30 Q20 18 50 12 Q80 18 78 30" stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <Ellipse cx="50" cy="16" rx="22" ry="8" fill={strokeColor} />
          </G>
        );
      case 2:
        return (
          <G>
            <Path d="M24 34 Q22 24 50 18 Q78 24 76 34" stroke={strokeColor} strokeWidth="4" fill="none" strokeLinecap="round" />
            <Rect x="20" y="32" width="10" height="14" rx="3" fill={strokeColor} />
            <Rect x="70" y="32" width="10" height="14" rx="3" fill={strokeColor} />
          </G>
        );
      case 3:
        return (
          <G>
            <Circle cx="27" cy="46" r="4" stroke={strokeColor} strokeWidth="1.5" fill="none" />
            <Circle cx="73" cy="46" r="4" stroke={strokeColor} strokeWidth="1.5" fill="none" />
          </G>
        );
      case 4:
        return (
          <G>
            <Rect x="38" y="34" width="24" height="12" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
            <Line x1="50" y1="34" x2="50" y2="46" stroke={strokeColor} strokeWidth="1.5" />
            <Circle cx="44" cy="40" r="3" fill={strokeColor} opacity="0.4" />
            <Circle cx="56" cy="40" r="3" fill={strokeColor} opacity="0.2" />
          </G>
        );
      default:
        return null;
    }
  };

  const AnimatedView = Animated.View;

  return (
    <AnimatedView style={animated ? animatedStyle : undefined}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: avatar.backgroundColor }]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <ClipPath id="avatarClip">
              <Circle cx="50" cy="50" r="50" />
            </ClipPath>
          </Defs>
          <G clipPath="url(#avatarClip)">
            {renderShirt()}
            {renderNeck()}
            {renderEars()}
            {renderFace()}
            {renderHair()}
            {renderEyebrows()}
            {avatar.accessory === 0 || avatar.accessory === 4 ? renderAccessory() : renderEyes()}
            {avatar.accessory === 0 || avatar.accessory === 4 ? renderEyes() : null}
            {avatar.accessory !== 0 && avatar.accessory !== 4 ? renderAccessory() : null}
            {renderNose()}
            {avatar.beardStyle === 0 ? renderMouth() : null}
            {renderBeard()}
            {avatar.beardStyle !== 0 && avatar.beardStyle !== 3 ? renderMouth() : null}
          </G>
        </Svg>
      </View>
    </AnimatedView>
  );
}

interface AvatarPickerProps {
  selectedAvatar?: string;
  onSelectAvatar: (avatar: AvatarOption) => void;
}

export function AvatarPicker({ selectedAvatar, onSelectAvatar }: AvatarPickerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(false);

  const selectedAvatarData = AVATAR_OPTIONS.find(a => a.id === selectedAvatar);

  const handleSelectAvatar = (avatar: AvatarOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectAvatar(avatar);
    setIsVisible(false);
  };

  const renderAvatar = ({ item }: { item: AvatarOption }) => {
    const isSelected = selectedAvatar === item.id;
    return (
      <Pressable
        style={[
          styles.avatarItem,
          { borderColor: isSelected ? theme.primary : "transparent" },
          isSelected && { borderWidth: 3 },
        ]}
        onPress={() => handleSelectAvatar(item)}
      >
        <NotionFace avatar={item} size={60} animated={isSelected} />
        {isSelected ? (
          <View style={[styles.checkmark, { backgroundColor: theme.primary }]}>
            <Feather name="check" size={12} color="white" />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View>
      <Pressable
        style={[styles.triggerButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.inputBorder }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsVisible(true);
        }}
      >
        {selectedAvatarData ? (
          <NotionFace avatar={selectedAvatarData} size={48} />
        ) : (
          <View style={[styles.placeholderCircle, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="user" size={24} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.triggerContent}>
          <ThemedText style={[styles.triggerTitle, { color: theme.text }]}>
            Choose Avatar
          </ThemedText>
          <ThemedText style={[styles.triggerSubtitle, { color: theme.textSecondary }]}>
            {selectedAvatarData ? "Tap to change" : "Select a character"}
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </Pressable>

      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.cardBorder }, Platform.OS === "android" && { paddingTop: insets.top + Spacing.md }]}>
            <View style={styles.modalTitleRow}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Choose Your Avatar
              </ThemedText>
              <Pressable
                style={styles.closeButton}
                onPress={() => setIsVisible(false)}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Pick a character that represents you
            </ThemedText>
          </View>

          <FlatList
            data={AVATAR_OPTIONS}
            renderItem={renderAvatar}
            keyExtractor={(item) => item.id}
            numColumns={4}
            contentContainerStyle={[
              styles.avatarGrid,
              { paddingBottom: insets.bottom + Spacing.xl }
            ]}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.avatarRow}
          />
        </View>
      </Modal>
    </View>
  );
}

export { NotionFace, AvatarOption as NotionAvatarOption };

const styles = StyleSheet.create({
  triggerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  placeholderCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerContent: {
    flex: 1,
  },
  triggerTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  triggerSubtitle: {
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "DMSans_700Bold",
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    marginTop: Spacing.xs,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  avatarGrid: {
    padding: Spacing.lg,
  },
  avatarRow: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  avatarItem: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  checkmark: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
});
