import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@/components/icons/Feather";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { isLoggedIn } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fetchVoiceRooms } from "@/lib/voiceRoomApi";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Connect tab: a small Voice rooms tile that sits beside the ad carousel, same height as an ad card.
 * Tapping it opens the Voice rooms list (the same page as Home > Services > ভয়েস রুম).
 * It has no create button: starting a room is only the mic icon next to the filter in the Connect title bar.
 */
export function VoiceRoomTile({ width, height = 148 }: { width: number; height?: number }) {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { language } = useI18n();
  const bn = language === "bn";
  const [live, setLive] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (isLoggedIn()) {
        fetchVoiceRooms()
          .then((r) => {
            if (!alive) return;
            setLive(r.rooms?.length ?? 0);
            setUpcoming(r.scheduled?.length ?? 0);
          })
          .catch(() => alive && setLive(null));
      }
      return () => {
        alive = false;
      };
    }, []),
  );

  const n = (x: number) => (bn ? x.toLocaleString("bn-BD") : String(x));
  const status =
    live == null
      ? bn
        ? "লাইভ শুনুন"
        : "Listen live"
      : live > 0
        ? bn
          ? `${n(live)}টি লাইভ`
          : `${n(live)} live`
        : upcoming > 0
          ? bn
            ? `${n(upcoming)}টি আসছে`
            : `${n(upcoming)} coming`
          : bn
            ? "এখন লাইভ নেই"
            : "None live";

  return (
    <Pressable
      onPress={() => navigation.navigate("VoiceRooms")}
      accessibilityRole="button"
      accessibilityLabel={bn ? `ভয়েস রুম খুলুন. ${status}` : `Open voice rooms. ${status}`}
      testID="connect-voice-rooms"
      style={({ pressed }) => [
        styles.tile,
        { width, height, backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: theme.primary }]}>
          <Feather name="mic" size={18} color={theme.buttonText} />
        </View>
        {live ? <View style={styles.liveDot} testID="connect-voice-rooms-live-dot" /> : null}
      </View>
      <View style={{ minWidth: 0 }}>
        <ThemedText style={styles.title} numberOfLines={2}>
          {bn ? "ভয়েস রুম" : "Voice rooms"}
        </ThemedText>
        <View style={styles.statusRow}>
          <ThemedText style={[styles.sub, { color: live ? "#E5484D" : theme.textSecondary }]} numberOfLines={1} testID="connect-voice-rooms-status">
            {status}
          </ThemedText>
          <Feather name="arrow-right" size={14} color={theme.textSecondary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md, justifyContent: "space-between", overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#E5484D", marginTop: 2 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  sub: { fontSize: 12, lineHeight: 16, flexShrink: 1, fontWeight: "600" },
});
