import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { AdCarousel, AdCard } from "@/components/AdCarousel";
import { HelpFab } from "@/components/HelpButton";
import { ModalBottomInset } from "@/components/ModalBottomInset";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiGet, apiPut, isLoggedIn } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";

import { ChatIcon } from "@/components/icons/ChatIcon";
import { useIsOnline, useOnlineSet } from "@/lib/liveStatus";
import { IconButton } from "@/components/ui";
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Field {
  id: string;
  label: string;
  labelBn: string;
}
interface Professional {
  id: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  field: string | null;
  title: string | null;
  about: string | null;
}
interface MyExpertProfile {
  isExpert: boolean;
  field: string | null;
  title: string | null;
  about: string | null;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "?";

/**
 * Connect: real experts on Farmers (vets, fish health, crop doctors, feed and soil
 * specialists). Only accounts registered with the expert role are listed, straight from the
 * server; nothing is made up. Tap Message to chat with one, or the card to see their profile.
 * An expert sees a card at the top to set their specialty, title and a short "about".
 */
export default function ConnectScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const tabBarHeight = useBottomTabBarHeight();
  const bn = useI18n((s) => s.language) === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  const signedInId = useAuthStore((s) => s.user?.id);

  const [fields, setFields] = useState<Field[]>([]);
  const [field, setField] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyExpertProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const onlineSet = useOnlineSet();
  const activeFilters = (field ? 1 : 0) + (onlineOnly ? 1 : 0);

  // Filter icon in the title bar, top right: specialty + "online now".
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: Spacing.lg }} testID="connect-filter-button">
          <IconButton
            icon="sliders"
            size={38}
            tone={activeFilters ? "primary" : "surface"}
            accessibilityLabel={bn ? "ফিল্টার" : "Filter"}
            onPress={() => setFilterOpen(true)}
          />
        </View>
      ),
    } as any);
  }, [navigation, activeFilters, bn]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (field) params.set("field", field);
      if (debounced) params.set("q", debounced);
      const qs = params.toString();
      const r: any = await apiGet(`/api/connect/professionals${qs ? `?${qs}` : ""}`);
      setFields(Array.isArray(r?.fields) ? r.fields : []);
      setItems(Array.isArray(r?.professionals) ? r.professionals : []);
    } catch (e: any) {
      setError(e?.message || "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [field, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMine = useCallback(() => {
    if (!isLoggedIn()) {
      setMine(null);
      return;
    }
    apiGet<MyExpertProfile>("/api/me/expert-profile")
      .then(setMine)
      .catch(() => setMine(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMine();
    }, [loadMine, signedInId]),
  );

  const fieldLabel = (id: string | null) => {
    const f = fields.find((x) => x.id === id);
    return f ? (bn ? f.labelBn : f.label) : L("Expert", "বিশেষজ্ঞ");
  };

  const openChat = (p: Professional) => {
    if (!isLoggedIn()) {
      Alert.alert(L("Sign in", "সাইন ইন"), L("Please sign in to message experts.", "বিশেষজ্ঞকে মেসেজ করতে সাইন ইন করুন।"));
      return;
    }
    navigation.navigate("Chat", { conversationId: p.id, userName: p.name, userInitials: initialsOf(p.name) });
  };

  const openProfile = (p: Professional) => {
    navigation.navigate("UserProfile", {
      user: {
        id: p.id,
        name: p.name,
        initials: initialsOf(p.name),
        avatar: p.avatar || undefined,
        role: "expert",
        verified: p.verified,
        followersCount: 0,
        followingCount: 0,
        location: "",
        bio: p.about || "",
      } as any,
    });
  };

  const renderItem = ({ item }: { item: Professional }) => (
    <Pressable
      onPress={() => openProfile(item)}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }, pressed && { opacity: 0.85 }]}
      testID="connect-card"
    >
      <UserAvatar name={item.name} avatar={item.avatar || undefined} badge="expert" userId={item.id} size={52} />
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {item.name}
          </ThemedText>
          {item.verified ? <Feather name="check-circle" size={14} color={theme.primary} style={{ marginLeft: 4 }} /> : null}
        </View>
        <ActiveNow userId={item.id} label={L("Active now", "এখন সক্রিয়")} />
        <ThemedText style={[styles.field, { color: theme.primary }]} numberOfLines={1}>
          {fieldLabel(item.field)}
        </ThemedText>
        {item.title ? (
          <ThemedText style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.title}
          </ThemedText>
        ) : null}
        {item.about ? (
          <ThemedText style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.about}
          </ThemedText>
        ) : null}
      </View>
      <Pressable
        onPress={() => openChat(item)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={L("Message", "মেসেজ")}
        style={[styles.msgBtn, { backgroundColor: theme.primary }]}
        testID="connect-message"
      >
        <ChatIcon size={20} color="#fff" />
      </Pressable>
    </Pressable>
  );

  // Promo / ad cards at the top of Connect (replaces the old intro line). Ad space is sold
  // through the Help chat for now; admin-managed ads are a later step.
  const adCards: AdCard[] = [
    {
      key: "advertise",
      icon: "volume-2",
      title: L("Advertise on Farmers", "Farmers-এ বিজ্ঞাপন দিন"),
      subtitle: L("Show your shop, feed or medicine to farmers here. Message us.", "আপনার দোকান, খাদ্য বা ওষুধ কৃষকদের দেখান। আমাদের মেসেজ করুন।"),
      cta: L("Contact", "যোগাযোগ"),
      colors: ["#7C2D12", "#EA580C"],
      onPress: () => (navigation as any).navigate("SupportChat"),
    },
    {
      key: "vet",
      icon: "heart",
      title: L("Animal doctors", "পশু চিকিৎসক"),
      subtitle: L("Cow, goat and poultry health advice", "গরু, ছাগল ও হাঁস-মুরগির চিকিৎসা পরামর্শ"),
      cta: L("See", "দেখুন"),
      colors: ["#14583A", "#2FA36B"],
      onPress: () => setField("vet"),
    },
    {
      key: "fish",
      icon: "anchor",
      title: L("Fish health experts", "মাছ বিশেষজ্ঞ"),
      subtitle: L("Pond water, feed and fish disease", "পুকুরের পানি, খাদ্য ও মাছের রোগ"),
      cta: L("See", "দেখুন"),
      colors: ["#1D4ED8", "#0D9488"],
      onPress: () => setField("fish"),
    },
  ];

  const header = (
    <View>
      <View style={{ marginBottom: Spacing.md }}>
        <AdCarousel cards={adCards} testID="connect-carousel" />
      </View>
      <View style={[styles.search, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
        <Feather name="search" size={16} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={L("Search experts", "বিশেষজ্ঞ খুঁজুন")}
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
          returnKeyType="search"
          testID="connect-search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        {[{ id: "", label: "All", labelBn: "সব" }, ...fields].map((f) => {
          const active = (field || "") === f.id;
          return (
            <Pressable
              key={f.id || "all"}
              onPress={() => setField(f.id || null)}
              style={[styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundDefault, borderColor: active ? theme.primary : theme.border }]}
            >
              <ThemedText style={[styles.chipText, { color: active ? "#fff" : theme.text }]} numberOfLines={1}>
                {bn ? f.labelBn : f.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      {mine?.isExpert ? (
        <Pressable
          onPress={() => setEditing(true)}
          style={[styles.mineCard, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}
          testID="connect-my-profile"
        >
          <Feather name="award" size={18} color={theme.primary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText style={styles.mineTitle}>{L("Your Connect profile", "আপনার Connect প্রোফাইল")}</ThemedText>
            <ThemedText style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={2}>
              {mine.field
                ? `${fieldLabel(mine.field)}${mine.title ? ` · ${mine.title}` : ""}`
                : L("Add your specialty so farmers can find you.", "আপনার বিশেষত্ব যোগ করুন, যাতে কৃষকরা আপনাকে খুঁজে পান।")}
            </ThemedText>
          </View>
          <Feather name="edit-2" size={16} color={theme.primary} />
        </Pressable>
      ) : null}
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator style={{ marginTop: Spacing["3xl"] }} color={theme.primary} />
  ) : error ? (
    <View style={styles.empty}>
      <Feather name="wifi-off" size={28} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>{L("Couldn't load experts.", "বিশেষজ্ঞদের তালিকা আনা যায়নি।")}</ThemedText>
      <Pressable onPress={() => { setLoading(true); load(); }} style={[styles.retry, { borderColor: theme.primary }]}>
        <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>{L("Try again", "আবার চেষ্টা করুন")}</ThemedText>
      </Pressable>
    </View>
  ) : (
    <View style={styles.empty}>
      <Feather name="users" size={28} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {field || debounced || onlineOnly
          ? L("No experts match this search yet.", "এই খোঁজে এখনো কোনো বিশেষজ্ঞ নেই।")
          : L(
              "No experts have joined yet. Accounts that sign up as an expert show up here.",
              "এখনো কোনো বিশেষজ্ঞ যোগ দেননি। যাঁরা বিশেষজ্ঞ হিসেবে অ্যাকাউন্ট খোলেন, তাঁরা এখানে দেখাবেন।",
            )}
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={onlineOnly ? items.filter((p) => onlineSet.has(p.id)) : items}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); loadMine(); }} tintColor={theme.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: tabBarHeight + 96, width: "100%", maxWidth: 720, alignSelf: "center" }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
      <HelpFab bottom={tabBarHeight + 16} testID="connect-help-fab" />
      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.filterBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable onPress={() => {}} style={[styles.filterSheet, { backgroundColor: theme.backgroundDefault }]} testID="connect-filter-sheet">
            <View style={styles.filterHead}>
              <ThemedText style={styles.filterTitle}>{L("Filter experts", "বিশেষজ্ঞ ফিল্টার")}</ThemedText>
              {activeFilters ? (
                <Pressable onPress={() => { setField(null); setOnlineOnly(false); }} hitSlop={8} testID="connect-filter-clear">
                  <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>{L("Clear", "মুছুন")}</ThemedText>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => setOnlineOnly((v) => !v)}
              style={[styles.filterRow, { borderColor: theme.border }]}
              testID="connect-filter-online"
              accessibilityRole="switch"
              accessibilityState={{ checked: onlineOnly }}
            >
              <View style={[styles.dotSample, { backgroundColor: "#22C55E" }]} />
              <ThemedText style={{ flex: 1 }}>{L("Online now", "এখন অনলাইন")}</ThemedText>
              <Feather name={onlineOnly ? "check-square" : "square"} size={20} color={onlineOnly ? theme.primary : theme.textSecondary} />
            </Pressable>
            <ThemedText style={[styles.filterLabel, { color: theme.textSecondary }]}>{L("Specialty", "বিশেষত্ব")}</ThemedText>
            <ScrollView style={{ maxHeight: 320 }}>
              {[{ id: "", label: "All", labelBn: "সব" }, ...fields].map((f) => {
                const active = (field || "") === f.id;
                return (
                  <Pressable
                    key={f.id || "all"}
                    onPress={() => setField(f.id || null)}
                    style={[styles.filterRow, { borderColor: theme.border }]}
                    testID={`connect-filter-field-${f.id || "all"}`}
                  >
                    <ThemedText style={{ flex: 1, color: active ? theme.primary : theme.text, fontWeight: active ? "700" : "400" }}>
                      {bn ? f.labelBn : f.label}
                    </ThemedText>
                    {active ? <Feather name="check" size={18} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setFilterOpen(false)} style={[styles.filterDone, { backgroundColor: theme.primary }]} testID="connect-filter-done">
              <ThemedText style={{ color: "#fff", fontWeight: "700" }}>{L("Show results", "ফলাফল দেখুন")}</ThemedText>
            </Pressable>
            <ModalBottomInset />
          </Pressable>
        </Pressable>
      </Modal>
      {mine?.isExpert ? (
        <ExpertProfileEditor
          visible={editing}
          fields={fields}
          initial={mine}
          bn={bn}
          onClose={() => setEditing(false)}
          onSaved={(p) => {
            setMine(p);
            setEditing(false);
            load();
          }}
        />
      ) : null}
    </View>
  );
}

function ExpertProfileEditor({
  visible,
  fields,
  initial,
  bn,
  onClose,
  onSaved,
}: {
  visible: boolean;
  fields: Field[];
  initial: MyExpertProfile;
  bn: boolean;
  onClose: () => void;
  onSaved: (p: MyExpertProfile) => void;
}) {
  const { theme } = useTheme();
  const L = (en: string, b: string) => (bn ? b : en);
  const [field, setField] = useState<string | null>(initial.field);
  const [title, setTitle] = useState(initial.title || "");
  const [about, setAbout] = useState(initial.about || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setField(initial.field);
      setTitle(initial.title || "");
      setAbout(initial.about || "");
    }
  }, [visible, initial]);

  const save = async () => {
    if (!field) {
      Alert.alert(L("Specialty", "বিশেষত্ব"), L("Please choose your specialty.", "আপনার বিশেষত্ব বেছে নিন।"));
      return;
    }
    setSaving(true);
    try {
      const r = await apiPut<MyExpertProfile>("/api/me/expert-profile", { field, title, about });
      onSaved(r);
    } catch (e: any) {
      Alert.alert(L("Not saved", "সেভ হয়নি"), e?.message || L("Please try again.", "আবার চেষ্টা করুন।"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.sheetHead}>
          <ThemedText style={styles.sheetTitle}>{L("Your Connect profile", "আপনার Connect প্রোফাইল")}</ThemedText>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.md }}>
          <ThemedText style={styles.label}>{L("Specialty", "বিশেষত্ব")}</ThemedText>
          <View style={styles.wrapChips}>
            {fields.map((f) => {
              const active = field === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setField(f.id)}
                  style={[styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundRoot, borderColor: active ? theme.primary : theme.border }]}
                >
                  <ThemedText style={[styles.chipText, { color: active ? "#fff" : theme.text }]}>{bn ? f.labelBn : f.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText style={styles.label}>{L("Title or qualification", "পদবি বা যোগ্যতা")}</ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            placeholder={L("e.g. DVM, Upazila Livestock Officer", "যেমন: ডিভিএম, উপজেলা প্রাণিসম্পদ কর্মকর্তা")}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
          />
          <ThemedText style={styles.label}>{L("About you", "আপনার সম্পর্কে")}</ThemedText>
          <TextInput
            value={about}
            onChangeText={setAbout}
            maxLength={300}
            multiline
            placeholder={L("What can you help farmers with?", "কৃষকদের কোন বিষয়ে সাহায্য করতে পারেন?")}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
          />
        </ScrollView>
        <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]} testID="connect-save">
          {saving ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.saveText}>{L("Save", "সেভ করুন")}</ThemedText>}
        </Pressable>
        <ModalBottomInset />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  filterBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  filterSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, width: "100%", maxWidth: 720, alignSelf: "center" },
  filterHead: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  filterTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  filterLabel: { marginTop: Spacing.md, marginBottom: 4, fontSize: 13, fontWeight: "600" },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  dotSample: { width: 10, height: 10, borderRadius: 5 },
  filterDone: { marginTop: Spacing.md, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  root: { flex: 1 },
  intro: { fontSize: 13, lineHeight: 19, marginBottom: Spacing.md },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, minWidth: 0 },
  chips: { gap: Spacing.sm, paddingVertical: Spacing.md, paddingRight: Spacing.lg },
  wrapChips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: "600" },
  mineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  mineTitle: { fontSize: 14, fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  cardBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  field: { fontSize: 13, fontWeight: "600", marginTop: 1 },
  sub: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  // Icon-only round chat button (same ChatIcon as the Chats tab).
  msgBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
  },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  activeText: { fontSize: 12, fontWeight: "600", color: "#16A34A" },
  empty: { alignItems: "center", paddingTop: Spacing["3xl"], paddingHorizontal: Spacing.xl, gap: Spacing.md },
  emptyText: { textAlign: "center", fontSize: 14, lineHeight: 20 },
  retry: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.lg, paddingVertical: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: "85%",
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "700", marginTop: Spacing.md, marginBottom: Spacing.sm },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 15 },
  inputMulti: { minHeight: 90, textAlignVertical: "top" },
  saveBtn: { height: 48, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center", marginTop: Spacing.sm, marginBottom: Spacing.sm },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

/** "Active now" under the specialist's name while the server says they have the app open.
 * The green dot on the avatar comes from UserAvatar (userId). Nothing shows while offline. */
function ActiveNow({ userId, label }: { userId: string; label: string }) {
  const online = useIsOnline(userId);
  if (!online) return null;
  return (
    <View style={styles.activeRow} testID="connect-active-now">
      <View style={styles.activeDot} />
      <ThemedText style={styles.activeText} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}
