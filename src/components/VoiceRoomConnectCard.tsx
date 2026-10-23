import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { isLoggedIn } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fetchVoicePermission, fetchVoiceRooms } from "@/lib/voiceRoomApi";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Connect tab: the voice rooms card. Everyone can open the rooms; only people the admin allows see "Start a room". */
export function VoiceRoomConnectCard() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { language } = useI18n();
  const bn = language === "bn";
  const [canCreate, setCanCreate] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (!isLoggedIn()) return;
        fetchVoicePermission()
          .then((p) => alive && setCanCreate(!!p.canCreate))
          .catch(() => alive && setCanCreate(false));
        fetchVoiceRooms()
          .then((r) => {
            if (!alive) return;
            setLive(r.rooms?.length ?? 0);
            setUpcoming(r.scheduled?.length ?? 0);
          })
          .catch(() => alive && setLive(null));
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const status =
    live == null
      ? bn
        ? "লাইভ আলোচনা শুনুন ও কথা বলুন"
        : "Listen in and talk live"
      : live > 0
        ? bn
          ? `${live.toLocaleString("bn-BD")}টি রুম এখন লাইভ`
          : `${live} live now`
        : upcoming > 0
          ? bn
            ? `${upcoming.toLocaleString("bn-BD")}টি রুম আসছে`
            : `${upcoming} coming up`
          : bn
            ? "এখন কোনো লাইভ রুম নেই"
            : "No live rooms right now";

  return (
    <View style={[styles.card, { backgroundColor: theme.primarySoft, borderColor: theme.border }]} testID="connect-voice-rooms">
      <Pressable
        onPress={() => navigation.navigate("VoiceRooms")}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={bn ? "ভয়েস রুম খুলুন" : "Open voice rooms"}
        testID="connect-voice-rooms-open"
      >
        <View style={[styles.icon, { backgroundColor: theme.primary }]}>
          <Feather name="mic" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText style={styles.title}>{bn ? "ভয়েস রুম" : "Voice rooms"}</ThemedText>
          <View style={styles.statusRow}>
            {live ? <View style={[styles.dot, { backgroundColor: "#E5484D" }]} /> : null}
            <ThemedText style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
              {status}
            </ThemedText>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      </Pressable>
      {canCreate ? (
        <Pressable
          onPress={() => navigation.navigate("VoiceRoomCreate")}
          style={[styles.create, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          testID="connect-voice-room-create"
        >
          <Feather name="plus" size={16} color="#fff" />
          <ThemedText style={styles.createText}>{bn ? "নতুন রুম শুরু করুন" : "Start a room"}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sub: { fontSize: 13, flexShrink: 1 },
  create: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: BorderRadius.full,
    paddingVertical: 10,
  },
  createText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
