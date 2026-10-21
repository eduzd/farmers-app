import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { fetchCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem, registerForEvent, myUserId } from "@/lib/catalog";
import { CatalogFormModal, FormField } from "@/components/CatalogFormModal";
import { Spacing, BorderRadius } from "@/constants/theme";

interface AgriEvent {
  id: string;
  title: string;
  type: "মেলা" | "প্রশিক্ষণ" | "সেমিনার" | "ওয়ার্কশপ";
  date: string;
  time: string;
  location: string;
  organizer: string;
  description: string;
  isFree: boolean;
  fee?: number;
  registered: boolean;
  spotsLeft: number;
  registrations?: string[];
  ownerId?: string | null;
}

const EVENTS: AgriEvent[] = [
  {
    id: "1",
    title: "জাতীয় কৃষি মেলা ২০২৬",
    type: "মেলা",
    date: "২৫-২৮ জানুয়ারি",
    time: "সকাল ৯টা - রাত ৯টা",
    location: "কৃষিবিদ ইনস্টিটিউট, ঢাকা",
    organizer: "কৃষি মন্ত্রণালয়",
    description: "বাংলাদেশের সবচেয়ে বড় কৃষি মেলা - নতুন প্রযুক্তি, বীজ, যন্ত্রপাতি প্রদর্শনী",
    isFree: true,
    registered: false,
    spotsLeft: 999,
  },
  {
    id: "2",
    title: "জৈব কৃষি প্রশিক্ষণ",
    type: "প্রশিক্ষণ",
    date: "১৫ ফেব্রুয়ারি",
    time: "সকাল ১০টা - বিকাল ৪টা",
    location: "বাংলাদেশ কৃষি বিশ্ববিদ্যালয়, ময়মনসিংহ",
    organizer: "কৃষি সম্প্রসারণ অধিদপ্তর",
    description: "হাতে-কলমে জৈব সার তৈরি ও জৈব চাষ পদ্ধতি শিখুন",
    isFree: false,
    fee: 500,
    registered: true,
    spotsLeft: 12,
  },
  {
    id: "3",
    title: "মৎস্য চাষ সেমিনার",
    type: "সেমিনার",
    date: "২০ ফেব্রুয়ারি",
    time: "বিকাল ৩টা - সন্ধ্যা ৬টা",
    location: "মৎস্য ভবন, ঢাকা",
    organizer: "মৎস্য অধিদপ্তর",
    description: "বায়োফ্লক ও RAS প্রযুক্তিতে মাছ চাষ - বিশেষজ্ঞদের আলোচনা",
    isFree: true,
    registered: false,
    spotsLeft: 45,
  },
  {
    id: "4",
    title: "স্মার্ট ফার্মিং ওয়ার্কশপ",
    type: "ওয়ার্কশপ",
    date: "১ মার্চ",
    time: "সকাল ১০টা - বিকাল ৫টা",
    location: "বিএসইসি, চট্টগ্রাম",
    organizer: "আগ্রো টেক বাংলাদেশ",
    description: "IoT, ড্রোন এবং AI ব্যবহার করে আধুনিক কৃষি প্রযুক্তি",
    isFree: false,
    fee: 1500,
    registered: false,
    spotsLeft: 25,
  },
  {
    id: "5",
    title: "বগুড়া কৃষি মেলা",
    type: "মেলা",
    date: "১০-১২ মার্চ",
    time: "সকাল ১০টা - রাত ৮টা",
    location: "শাহজাহান আলী স্টেডিয়াম, বগুড়া",
    organizer: "জেলা কৃষি অফিস",
    description: "উত্তরবঙ্গের বৃহত্তম কৃষি মেলা - স্থানীয় ফসল ও পণ্য প্রদর্শনী",
    isFree: true,
    registered: false,
    spotsLeft: 999,
  },
];

const EVENT_TYPES = ["সব", "মেলা", "প্রশিক্ষণ", "সেমিনার", "ওয়ার্কশপ"] as const;

export default function EventsCalendarScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const { t, language } = useI18n();
  const isBn = language === "bn";
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const loggedIn = useAuthStore((s) => s.isAuthenticated && !!s.token);
  const [selectedType, setSelectedType] = useState<string>("সব");
  const [events, setEvents] = useState<AgriEvent[]>(EVENTS);
  const [refreshing, setRefreshing] = useState(false);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; item: AgriEvent | null }>({ open: false, item: null });

  const load = useCallback(async () => {
    try {
      const me = myUserId();
      const list = await fetchCatalog<AgriEvent>("events");
      setEvents(list.map((e) => ({ ...e, registered: !!me && (e.registrations || []).includes(me) })));
      setLoadNote(null);
    } catch {
      setLoadNote(t("catalog.offline"));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const TYPE_LABEL: Record<string, string> = isBn
    ? {}
    : { "সব": "All", "মেলা": "Fair", "প্রশিক্ষণ": "Training", "সেমিনার": "Seminar", "ওয়ার্কশপ": "Workshop" };
  const typeLabel = (x: string) => TYPE_LABEL[x] || x;

  const canEdit = (e: AgriEvent) => isSuperAdmin || (!!e.ownerId && e.ownerId === myUserId());

  const FIELDS: FormField[] = [
    { key: "title", label: t("events.form.title"), required: true },
    { key: "type", label: t("events.form.type"), placeholder: "মেলা / প্রশিক্ষণ / সেমিনার / ওয়ার্কশপ" },
    { key: "date", label: t("events.form.date"), required: true, placeholder: "15 Nov" },
    { key: "time", label: t("events.form.time"), placeholder: "10:00 - 16:00" },
    { key: "location", label: t("events.form.location"), required: true },
    { key: "organizer", label: t("events.form.organizer") },
    { key: "fee", label: t("events.form.fee"), numeric: true, placeholder: "0" },
    { key: "spotsLeft", label: t("events.form.spots"), numeric: true, placeholder: "100" },
    { key: "description", label: t("events.form.description"), multiline: true },
  ];

  const saveEvent = async (v: Record<string, any>) => {
    const types = ["মেলা", "প্রশিক্ষণ", "সেমিনার", "ওয়ার্কশপ"];
    const en: Record<string, string> = { fair: "মেলা", training: "প্রশিক্ষণ", seminar: "সেমিনার", workshop: "ওয়ার্কশপ" };
    const type = types.includes(v.type) ? v.type : en[String(v.type || "").toLowerCase()] || "সেমিনার";
    const fee = Number(v.fee) || 0;
    const data = { ...v, type, fee, isFree: fee <= 0, spotsLeft: v.spotsLeft ?? 100 };
    if (form.item) await updateCatalogItem("events", form.item.id, data);
    else await createCatalogItem("events", data);
    setForm({ open: false, item: null });
    load();
  };

  const filteredEvents = events.filter(
    (e) => selectedType === "সব" || e.type === selectedType
  );

  const getTypeColor = (type: string) => {
    switch (type) {
      case "মেলা": return "#2FA36B";
      case "প্রশিক্ষণ": return "#2563EB";
      case "সেমিনার": return "#7C3AED";
      case "ওয়ার্কশপ": return "#EA8A0C";
      default: return theme.primary;
    }
  };

  const handleRegister = (event: AgriEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (event.registered) {
      Alert.alert(t("events.alreadyTitle"), t("events.alreadyBody"));
      return;
    }
    Alert.alert(
      t("events.registerTitle"),
      `${event.title}\n\n${event.isFree ? t("events.free") : `${t("events.fee")}: ৳${event.fee}`}\n\n${t("events.registerAsk")}`,
      [
        { text: t("common.no"), style: "cancel" },
        {
          text: t("common.yes"),
          onPress: async () => {
            if (loggedIn && !event.id.match(/^\d+$/)) {
              try {
                const updated = await registerForEvent(event.id);
                setEvents((prev) =>
                  prev.map((e) => (e.id === event.id ? { ...e, registered: true, spotsLeft: updated.spotsLeft ?? e.spotsLeft } : e))
                );
              } catch (err: any) {
                Alert.alert(t("common.error"), String(err?.message || err));
                return;
              }
            } else {
              setEvents((prev) =>
                prev.map((e) => (e.id === event.id ? { ...e, registered: true } : e))
              );
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const renderEvent = ({ item, index }: { item: AgriEvent; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <View style={[styles.eventCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.dateContainer}>
          <View style={[styles.dateBadge, { backgroundColor: getTypeColor(item.type) }]}>
            <ThemedText style={styles.dateText}>{item.date.split(" ")[0]}</ThemedText>
            <ThemedText style={styles.monthText}>
              {item.date.split(" ")[1] || ""}
            </ThemedText>
          </View>
        </View>

        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + "20" }]}>
              <ThemedText style={[styles.typeText, { color: getTypeColor(item.type) }]}>
                {typeLabel(item.type)}
              </ThemedText>
            </View>
            {item.isFree ? (
              <View style={[styles.freeBadge, { backgroundColor: "#2FA36B" }]}>
                <ThemedText style={styles.freeText}>{t("events.free")}</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <ThemedText style={[styles.eventTitle, { color: theme.text, flex: 1 }]}>{item.title}</ThemedText>
            {canEdit(item) ? (
              <Pressable onPress={() => setForm({ open: true, item })} hitSlop={8} accessibilityLabel={t("common.edit")}>
                <Feather name="edit-2" size={16} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <ThemedText style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.description}
          </ThemedText>

          <View style={styles.infoRow}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              {item.time}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.location}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <Feather name="users" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              {item.organizer}
            </ThemedText>
          </View>

          <View style={styles.actionRow}>
            <View style={styles.spotsContainer}>
              {item.spotsLeft < 50 ? (
                <ThemedText style={[styles.spotsText, { color: "#EA8A0C" }]}>
                  {t("events.spotsLeft").replace("{n}", String(item.spotsLeft))}
                </ThemedText>
              ) : null}
            </View>
            <Pressable
              style={[
                styles.registerButton,
                { backgroundColor: item.registered ? "#2FA36B" : theme.primary },
              ]}
              onPress={() => handleRegister(item)}
            >
              <Feather
                name={item.registered ? "check" : "calendar"}
                size={16}
                color="#fff"
              />
              <ThemedText style={styles.registerText}>
                {item.registered ? t("events.registered") : t("events.register")}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn} style={styles.typesContainer}>
        <FlatList
          horizontal
          data={EVENT_TYPES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.typesList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.typeChip,
                {
                  backgroundColor: selectedType === item ? theme.primary : theme.card,
                  borderColor: selectedType === item ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedType(item);
              }}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: selectedType === item ? theme.white : theme.text },
                ]}
              >
                {typeLabel(item)}
              </ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      {loggedIn ? (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm }}>
          <Pressable
            onPress={() => setForm({ open: true, item: null })}
            accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: Spacing.md, borderRadius: 18, backgroundColor: theme.primary }}
          >
            <Feather name="plus" size={16} color="#fff" />
            <ThemedText style={{ color: "#fff", fontWeight: "600" }}>{t("events.add")}</ThemedText>
          </Pressable>
        </View>
      ) : null}
      {loadNote ? (
        <ThemedText style={{ color: theme.textSecondary, fontSize: 12, paddingHorizontal: Spacing.lg, paddingTop: 6 }}>{loadNote}</ThemedText>
      ) : null}
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <CatalogFormModal
        visible={form.open}
        title={form.item ? t("events.edit") : t("events.add")}
        fields={FIELDS}
        initial={form.item}
        submitLabel={t("common.save")}
        onClose={() => setForm({ open: false, item: null })}
        onSubmit={saveEvent}
        deleteLabel={t("common.delete")}
        onDelete={
          form.item
            ? async () => {
                try {
                  await deleteCatalogItem("events", form.item!.id);
                } catch {}
                setForm({ open: false, item: null });
                load();
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  typesContainer: { zIndex: 1 },
  typesList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  typeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  eventCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  dateContainer: { padding: Spacing.sm },
  dateBadge: {
    width: 60,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  dateText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  monthText: { color: "#fff", fontSize: 11 },
  eventContent: { flex: 1, padding: Spacing.md, paddingLeft: Spacing.xs },
  eventHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  typeText: { fontSize: 11, fontWeight: "600" },
  freeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  freeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  eventTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.xs },
  description: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  infoText: { fontSize: 12, flex: 1 },
  actionRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.sm },
  spotsContainer: { flex: 1 },
  spotsText: { fontSize: 12, fontWeight: "500" },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  registerText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  separator: { height: Spacing.md },
});
