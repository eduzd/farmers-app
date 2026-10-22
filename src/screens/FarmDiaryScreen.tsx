import React, { useState, useCallback } from "react";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Modal, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useCommunityList, createCommunity, deleteCommunity } from "@/lib/community";
import { isLoggedIn } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTr } from "@/lib/tr";
import { Spacing, BorderRadius } from "@/constants/theme";

import { useHeaderAddButton } from "@/components/HeaderAddButton";
interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  category: string;
  weather: string;
  mood: string;
}


const CATEGORIES = ["সব", "ফসল", "সার", "সমস্যা", "রোপণ", "সেচ", "বিক্রি"];

export default function FarmDiaryScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const tr = useTr();
  const { language } = useI18n();
  const loggedIn = isLoggedIn();
  const { items: serverEntries, reload } = useCommunityList<DiaryEntry & { remindAt?: string; reminded?: boolean; createdAtIso?: string }>("diary");
  const entries = loggedIn ? serverEntries : [];
  const [newCategory, setNewCategory] = useState("ফসল");
  const [remindIn, setRemindIn] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  useHeaderAddButton(() => setModalVisible(true), "New entry");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const filteredEntries = entries.filter((e) => selectedCategory === "সব" || e.category === selectedCategory);

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = { ফসল: "#2FA36B", সার: "#7C3AED", সমস্যা: "#DC2626", রোপণ: "#2563EB", সেচ: "#0D9488", বিক্রি: "#EA8A0C" };
    return colors[cat] || theme.primary;
  };

  const getWeatherIcon = (weather: string) => {
    const icons: Record<string, string> = { রোদ: "sun", মেঘলা: "cloud", বৃষ্টি: "cloud-rain" };
    return icons[weather] || "cloud";
  };

  const handleAddEntry = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert(tr("ত্রুটি"), tr("শিরোনাম ও বিবরণ লিখুন"));
      return;
    }
    if (!isLoggedIn()) {
      Alert.alert(tr("Log in to keep a farm diary"));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const now = new Date();
    try {
      await createCommunity("diary", {
        date: now.toLocaleDateString(language === "en" ? "en-GB" : "bn-BD", { day: "numeric", month: "short", year: "numeric" }),
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        weather: "রোদ",
        mood: "খুশি",
        remindAt: remindIn ? new Date(now.getTime() + remindIn * 86400000).toISOString() : undefined,
      });
      await reload();
    } catch (e: any) {
      Alert.alert(tr("ত্রুটি"), e.message);
      return;
    }
    setNewTitle("");
    setNewContent("");
    setRemindIn(0);
    setModalVisible(false);
  };
  const handleEntryPress = (item: DiaryEntry) => {
    Alert.alert(item.title, tr("Delete this diary entry?"), [
      { text: tr("না"), style: "cancel" },
      { text: tr("Delete"), style: "destructive", onPress: () => deleteCommunity("diary", item.id).then(reload).catch((e) => Alert.alert(tr("ত্রুটি"), e.message)) },
    ]);
  };

  const renderEntry = ({ item, index }: { item: DiaryEntry; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable onLongPress={() => handleEntryPress(item)} onPress={() => handleEntryPress(item)} style={[styles.entryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.entryHeader}>
          <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(item.category) }]} />
          <ThemedText style={[styles.entryDate, { color: theme.textSecondary }]}>{item.date}</ThemedText>
          <View style={styles.weatherContainer}>
            <Feather name={getWeatherIcon(item.weather) as any} size={14} color={theme.textSecondary} />
          </View>
        </View>
        <ThemedText style={[styles.entryTitle, { color: theme.text }]}>{item.title}</ThemedText>
        <ThemedText style={[styles.entryContent, { color: theme.textSecondary }]} numberOfLines={3}>{item.content}</ThemedText>
        <View style={styles.entryFooter}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + "20" }]}>
            <ThemedText style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>{tr(item.category)}</ThemedText>
          </View>
          {(item as any).remindAt ? (
            <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "20", marginLeft: Spacing.sm, flexDirection: "row", alignItems: "center", gap: 4 }]}>
              <Feather name="clock" size={11} color={theme.primary} />
              <ThemedText style={[styles.categoryText, { color: theme.primary }]}>
                {new Date((item as any).remindAt).toLocaleDateString(language === "en" ? "en-GB" : "bn-BD", { day: "numeric", month: "short" })}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn} style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filtersList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, { backgroundColor: selectedCategory === item ? theme.primary : theme.card, borderColor: selectedCategory === item ? theme.primary : theme.cardBorder }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedCategory(item); }}
            >
              <ThemedText style={[styles.chipText, { color: selectedCategory === item ? theme.white : theme.text }]}>{tr(item)}</ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="book-open" size={24} color={theme.primary} />
            <View style={styles.headerContent}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>{tr("খামার ডায়েরি")}</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{loggedIn ? tr("দৈনিক কার্যক্রম লিপিবদ্ধ করুন") : tr("Log in to keep a farm diary")}</ThemedText>
            </View>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{tr("নতুন এন্ট্রি")}</ThemedText>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={tr("শিরোনাম")}
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
              value={newContent}
              onChangeText={setNewContent}
              placeholder={tr("বিবরণ লিখুন...")}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md }}>
              {CATEGORIES.slice(1).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setNewCategory(c)}
                  style={[styles.filterChip, { marginRight: 0, backgroundColor: newCategory === c ? theme.primary : theme.card, borderColor: newCategory === c ? theme.primary : theme.cardBorder }]}
                >
                  <ThemedText style={[styles.chipText, { color: newCategory === c ? theme.white : theme.text }]}>{tr(c)}</ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText style={[styles.entryDate, { color: theme.textSecondary, marginBottom: Spacing.xs, flex: 0 }]}>{tr("Remind me")}</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md }}>
              {[0, 1, 3, 7].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setRemindIn(d)}
                  style={[styles.filterChip, { marginRight: 0, backgroundColor: remindIn === d ? theme.primary : theme.card, borderColor: remindIn === d ? theme.primary : theme.cardBorder }]}
                >
                  <ThemedText style={[styles.chipText, { color: remindIn === d ? theme.white : theme.text }]}>
                    {d === 0 ? tr("No reminder") : d === 1 ? tr("Tomorrow") : d === 3 ? tr("In 3 days") : tr("In a week")}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={handleAddEntry}>
              <ThemedText style={styles.saveButtonText}>{tr("সংরক্ষণ করুন")}</ThemedText>
            </Pressable>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filtersContainer: { zIndex: 1 },
  filtersList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
 },
  chipText: { fontSize: 14, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  headerCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md, marginBottom: Spacing.lg },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  headerSubtitle: { fontSize: 13 },
  entryCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  entryHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.xs },
  entryDate: { fontSize: 12, flex: 1 },
  weatherContainer: { marginLeft: "auto" },
  entryTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.xs },
  entryContent: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.sm },
  entryFooter: { flexDirection: "row" },
  categoryBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  categoryText: { fontSize: 11, fontWeight: "600" },
  separator: { height: Spacing.md },
  fab: { position: "absolute", bottom: 90, right: Spacing.lg, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Spacing.lg },
  modalContent: { borderRadius: BorderRadius.xl, padding: Spacing.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, marginBottom: Spacing.md },
  textArea: { height: 120, textAlignVertical: "top" },
  saveButton: { alignItems: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
