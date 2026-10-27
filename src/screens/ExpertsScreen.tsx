import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { fetchCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem, myUserId } from "@/lib/catalog";
import { CatalogFormModal, FormField } from "@/components/CatalogFormModal";

import { EmptyState } from "@/components/ui";
import { ChatIcon } from "@/components/icons/ChatIcon";
interface Expert {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  credentials: string;
  experience: number;
  rating: number;
  consultationFee: number;
  currency: string;
  available: boolean;
  bio: string;
  isWelfareMember?: boolean;
  ownerId?: string | null;
}

const EXPERTS: Expert[] = [];

export default function ExpertsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated && !!s.token);

  const [searchQuery, setSearchQuery] = useState("");
  const [experts, setExperts] = useState<Expert[]>(EXPERTS);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; item: Expert | null }>({ open: false, item: null });

  const load = useCallback(async () => {
    try {
      const list = await fetchCatalog<Expert>("experts");
      setExperts(list);
      setLoadNote(null);
    } catch {
      setLoadNote(t("catalog.offline"));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = (e: Expert) => isSuperAdmin || (!!e.ownerId && e.ownerId === myUserId());

  const FIELDS: FormField[] = [
    { key: "name", label: t("experts.form.name"), required: true },
    { key: "specialty", label: t("experts.form.specialty"), required: true },
    { key: "credentials", label: t("experts.form.credentials") },
    { key: "experience", label: t("experts.form.experience"), numeric: true },
    { key: "consultationFee", label: t("experts.form.fee"), numeric: true },
    { key: "bio", label: t("experts.form.bio"), multiline: true },
  ];

  const saveExpert = async (v: Record<string, any>) => {
    const initials = String(v.name)
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    if (form.item) {
      await updateCatalogItem("experts", form.item.id, { ...v, initials });
    } else {
      await createCatalogItem("experts", { rating: 5, currency: "BDT", available: true, ...v, initials });
    }
    setForm({ open: false, item: null });
    load();
  };

  const filteredExperts = experts.filter(
    (expert) =>
      expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expert.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBookConsultation = (expertId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const expert = experts.find(e => e.id === expertId);
    if (expert) {
      navigation.navigate("Chat", {
        conversationId: `expert-${expertId}`,
        userName: expert.name,
        userInitials: expert.initials,
      });
    }
  };

  const handleMessage = (expert: Expert) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Chat", {
      conversationId: `expert-${expert.id}`,
      userName: expert.name,
      userInitials: expert.initials,
    });
  };

  const renderExpert = ({ item }: { item: Expert }) => (
    <View style={[styles.expertCard, { backgroundColor: theme.white }]}>
      <View style={styles.expertHeader}>
        <UserAvatar
          initials={item.initials}
          size="medium"
          isWelfareMember={item.isWelfareMember}
        />
        {canEdit(item) ? (
          <Pressable
            onPress={() => setForm({ open: true, item })}
            hitSlop={8}
            accessibilityLabel={t("common.edit")}
            style={{ position: "absolute", right: 0, top: 0, padding: 4, zIndex: 2 }}
          >
            <Feather name="edit-2" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
        <View style={[styles.expertInfo, canEdit(item) && { paddingRight: 24 }]}>
          <View style={styles.nameRow}>
            <ThemedText style={[styles.expertName, { color: theme.text }]}>
              {item.name}
            </ThemedText>
            {item.available ? (
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <ThemedText style={styles.availableText}>{t("experts.available")}</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={[styles.specialty, { color: theme.primary }]}>
            {item.specialty}
          </ThemedText>
          <ThemedText style={[styles.credentials, { color: theme.textSecondary }]}>
            {item.credentials}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.bio, { color: theme.text }]} numberOfLines={2}>
        {item.bio}
      </ThemedText>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Feather name="briefcase" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
            {item.experience ?? 0} {t("experts.years")}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <Feather name="star" size={14} color="#F5B700" />
          <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
            {item.rating}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={[styles.feeText, { color: theme.text }]}>
            {item.currency} {item.consultationFee}
          </ThemedText>
          <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>
            {t("experts.perSession")}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.messageButton,
            { borderColor: theme.primary },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => handleMessage(item)}
        >
          <ChatIcon size={18} color={theme.primary} />
          <ThemedText style={[styles.actionButtonText, { color: theme.primary }]}>
            {t("experts.message")}
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.bookButton,
            { backgroundColor: item.available ? theme.primary : theme.backgroundSecondary },
            pressed && styles.buttonPressed,
            !item.available && styles.buttonDisabled,
          ]}
          onPress={() => handleBookConsultation(item.id)}
          disabled={!item.available}
        >
          <Feather name="calendar" size={18} color={item.available ? theme.white : theme.textSecondary} />
          <ThemedText
            style={[
              styles.actionButtonText,
              { color: item.available ? theme.white : theme.textSecondary },
            ]}
          >
            {t("experts.book")}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.searchSection,
          { paddingTop: Spacing.md, backgroundColor: theme.backgroundRoot },
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: theme.white }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t("experts.findExperts")}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {isSuperAdmin || isAuthenticated ? (
          <Pressable
            onPress={() => setForm({ open: true, item: null })}
            accessibilityRole="button"
            style={[styles.addBtn, { backgroundColor: theme.primary }]}
          >
            <Feather name="plus" size={16} color={theme.white} />
            <ThemedText style={{ color: theme.white, fontWeight: "600" }}>{t("experts.add")}</ThemedText>
          </Pressable>
        ) : null}
        {loadNote ? <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: 6 }}>{loadNote}</ThemedText> : null}
      </View>

      <FlatList
        data={filteredExperts}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderExpert}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <CatalogFormModal
        visible={form.open}
        title={form.item ? t("experts.edit") : t("experts.add")}
        fields={FIELDS}
        initial={form.item}
        submitLabel={t("common.save")}
        onClose={() => setForm({ open: false, item: null })}
        onSubmit={saveExpert}
        deleteLabel={t("common.delete")}
        onDelete={
          form.item
            ? async () => {
                try {
                  await deleteCatalogItem("experts", form.item!.id);
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
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 36,
    borderRadius: 18,
  },
  container: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 44,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    textAlignVertical: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  expertCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  expertHeader: {
    position: "relative",
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  expertInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  expertName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00BB77",
  },
  availableText: {
    fontSize: 12,
    color: "#00BB77",
    fontWeight: "500",
  },
  specialty: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
    marginBottom: 2,
  },
  credentials: {
    fontSize: 13,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
  },
  feeText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  feeLabel: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  messageButton: {
    borderWidth: 1,
  },
  bookButton: {},
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  separator: {
    height: Spacing.md,
  },
});
