import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "react-native";
import { useCommunityList, createCommunity, updateCommunity, communityAction } from "@/lib/community";
import { isLoggedIn, timeAgo } from "@/lib/api";
import { CatalogFormModal } from "@/components/CatalogFormModal";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";

import { tr, useTr } from "@/lib/tr";
import { ModalBottomInset } from "@/components/ModalBottomInset";
interface RfqRequest {
  id: string;
  buyer: {
    name: string;
    initials: string;
    isWelfareMember?: boolean;
  };
  title: string;
  description: string;
  quantity: string;
  unit: string;
  deadline: string;
  status: "open" | "closed";
  bidsCount: number;
  createdAt: string;
  createdAtIso?: string;
  isMine?: boolean;
  bids?: { userId: string; name: string; price: number; note?: string }[];
  myBid?: { price: number } | null;
}


export default function RfqScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<"open" | "my">("open");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRfq, setNewRfq] = useState({
    title: "",
    description: "",
    quantity: "",
    unit: "kg",
    deadline: "",
  });

  const { language } = useI18n();
  useTr();
  const { items, reload, patch } = useCommunityList<RfqRequest>("rfqs");
  const [bidFor, setBidFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const shown = activeTab === "my" ? items.filter((r) => r.isMine) : items.filter((r) => r.status === "open" || r.isMine);

  const handleSubmitBid = (rfqId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const r = items.find((x) => x.id === rfqId);
    if (!isLoggedIn()) {
      Alert.alert(tr("Log in to submit a bid"));
      return;
    }
    if (r?.isMine) {
      updateCommunity("rfqs", rfqId, { status: r.status === "open" ? "closed" : "open" })
        .then(patch)
        .catch((e) => Alert.alert(tr("ত্রুটি"), e.message));
      return;
    }
    setBidFor(rfqId);
  };

  const handleCreateRfq = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLoggedIn()) {
      Alert.alert(tr("Log in to post a request"));
      return;
    }
    if (!newRfq.title.trim()) {
      Alert.alert(tr("ত্রুটি"), tr("Enter a title"));
      return;
    }
    try {
      await createCommunity("rfqs", newRfq);
      setNewRfq({ title: "", description: "", quantity: "", unit: "kg", deadline: "" });
      setShowCreateModal(false);
      setActiveTab("my");
      reload();
    } catch (e: any) {
      Alert.alert(tr("ত্রুটি"), e.message);
    }
  };

  const renderRfq = ({ item }: { item: RfqRequest }) => (
    <View style={[styles.rfqCard, { backgroundColor: theme.white }]}>
      <View style={styles.rfqHeader}>
        <UserAvatar
          initials={item.buyer.initials}
          size="medium"
          isWelfareMember={item.buyer.isWelfareMember}
        />
        <View style={styles.buyerInfo}>
          <ThemedText style={[styles.buyerName, { color: theme.text }]}>
            {item.buyer.name}
          </ThemedText>
          <ThemedText style={[styles.rfqTime, { color: theme.textSecondary }]}>
            {item.createdAtIso && !item.id.includes("-seed-") ? timeAgo(item.createdAtIso, language) : tr(item.createdAt)}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === "open" ? "#00BB7720" : theme.backgroundSecondary }]}>
          <ThemedText
            style={[
              styles.statusText,
              { color: item.status === "open" ? "#00BB77" : theme.textSecondary },
            ]}
          >
            {item.status === "open" ? tr("Open") : tr("Closed")}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.rfqTitle, { color: theme.text }]}>
        {item.title}
      </ThemedText>
      <ThemedText style={[styles.rfqDescription, { color: theme.textSecondary }]} numberOfLines={expanded === item.id ? undefined : 2}>
        {item.description}
      </ThemedText>

      <View style={styles.rfqDetails}>
        <View style={styles.detailItem}>
          <Feather name="package" size={16} color={theme.iconSecondary || theme.textSecondary} />
          <ThemedText style={[styles.detailText, { color: theme.text }]}>
            {item.quantity} {item.unit}
          </ThemedText>
        </View>
        <View style={styles.detailItem}>
          <Feather name="calendar" size={16} color={theme.iconSecondary || theme.textSecondary} />
          <ThemedText style={[styles.detailText, { color: theme.text }]}>
            {item.deadline}
          </ThemedText>
        </View>
        <View style={styles.detailItem}>
          <Feather name="users" size={16} color={theme.iconSecondary || theme.textSecondary} />
          <ThemedText style={[styles.detailText, { color: theme.text }]}>
            {item.bidsCount} {tr("bids")}
          </ThemedText>
        </View>
      </View>

      {expanded === item.id ? (
        <View style={{ marginBottom: Spacing.md }}>
          {item.myBid ? (
            <ThemedText style={[styles.detailText, { color: theme.primary }]}>
              {tr("Your bid")}: ৳{item.myBid.price}
            </ThemedText>
          ) : null}
          {item.isMine
            ? (item.bids || []).length
              ? (item.bids || []).map((b) => (
                  <ThemedText key={b.userId} style={[styles.detailText, { color: theme.text, marginTop: 4 }]}>
                    {b.name}: ৳{b.price}{b.note ? ` · ${b.note}` : ""}
                  </ThemedText>
                ))
              : (
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>{tr("No bids yet")}</ThemedText>
              )
            : null}
        </View>
      ) : null}

      <View style={styles.rfqActions}>
        <Pressable
          style={({ pressed }) => [
            styles.viewButton,
            { borderColor: theme.inputBorder },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setExpanded(expanded === item.id ? null : item.id)}
        >
          <ThemedText style={[styles.viewButtonText, { color: theme.text }]}>
            {expanded === item.id ? tr("Hide details") : tr("View Details")}
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.bidButton,
            { backgroundColor: theme.primary },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => handleSubmitBid(item.id)}
        >
          <ThemedText style={[styles.bidButtonText, { color: theme.white }]}>
            {item.isMine ? (item.status === "open" ? tr("Close request") : tr("Reopen")) : item.myBid ? tr("Update bid") : tr("Submit Bid")}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.tabsContainer, { paddingTop: Spacing.md }]}>
        <Pressable
          style={[
            styles.tab,
            activeTab === "open" && [styles.activeTab, { borderBottomColor: theme.primary }],
          ]}
          onPress={() => setActiveTab("open")}
        >
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === "open" ? theme.primary : theme.textSecondary },
            ]}
          >
            {t("rfq.openRequests")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            activeTab === "my" && [styles.activeTab, { borderBottomColor: theme.primary }],
          ]}
          onPress={() => setActiveTab("my")}
        >
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === "my" ? theme.primary : theme.textSecondary },
            ]}
          >
            {t("rfq.myRequests")}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("rfq.newRequest")}
          style={[styles.newBtn, { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowCreateModal(true);
          }}
        >
          <Feather name="plus" size={20} color={theme.white} />
        </Pressable>
      </View>

      <FlatList
        data={shown}
        ListEmptyComponent={
          <ThemedText style={[styles.rfqDescription, { color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xl }]}>
            {activeTab === "my" ? tr("You haven't posted any requests yet") : tr("No open requests")}
          </ThemedText>
        }
        keyExtractor={(item) => item.id}
        renderItem={renderRfq}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />


      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCreateModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                {t("rfq.createRequest")}
              </ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <KeyboardAwareScrollViewCompat
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.xl },
              ]}
            >
              <View style={styles.formGroup}>
                <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                  {t("rfq.productNeeded")}
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                  placeholder={tr("e.g., Organic Tomatoes")}
                  placeholderTextColor={theme.textSecondary}
                  value={newRfq.title}
                  onChangeText={(text) => setNewRfq({ ...newRfq, title: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                  {tr("Description")}
                </ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                  placeholder={tr("Describe your requirements...")}
                  placeholderTextColor={theme.textSecondary}
                  value={newRfq.description}
                  onChangeText={(text) => setNewRfq({ ...newRfq, description: text })}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                    {t("rfq.quantityNeeded")}
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                    placeholder={tr("e.g., 500")}
                    placeholderTextColor={theme.textSecondary}
                    value={newRfq.quantity}
                    onChangeText={(text) => setNewRfq({ ...newRfq, quantity: text })}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.formGroup, { width: 100 }]}>
                  <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                    {tr("Unit")}
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                    placeholder={tr("kg")}
                    placeholderTextColor={theme.textSecondary}
                    value={newRfq.unit}
                    onChangeText={(text) => setNewRfq({ ...newRfq, unit: text })}
                  />
                </View>
              </View>

              <Pressable
                style={[styles.submitButton, { backgroundColor: theme.primary }]}
                onPress={handleCreateRfq}
              >
                <ThemedText style={[styles.submitButtonText, { color: theme.white }]}>
                  {t("rfq.createRequest")}
                </ThemedText>
              </Pressable>
            </KeyboardAwareScrollViewCompat>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
      <CatalogFormModal
        visible={!!bidFor}
        title={tr("Submit Bid")}
        fields={[
          { key: "price", label: tr("Your price (৳ per unit)"), numeric: true, required: true },
          { key: "note", label: tr("Note"), multiline: true },
        ]}
        submitLabel={tr("Submit")}
        onClose={() => setBidFor(null)}
        onSubmit={async (v) => {
          try {
            const r = await communityAction("rfqs", bidFor as string, "bids", { price: Number(v.price), note: v.note || "" });
            patch(r);
            setBidFor(null);
            Alert.alert(tr("Bid sent"), tr("The buyer has been notified."));
          } catch (e: any) {
            return e.message;
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  listContent: {
    padding: Spacing.lg,
  },
  rfqCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  rfqHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  buyerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  buyerName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  rfqTime: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  rfqTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
    marginBottom: Spacing.sm,
  },
  rfqDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  rfqDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailText: {
    fontSize: 13,
    fontWeight: "500",
  },
  rfqActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  viewButton: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  bidButton: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  bidButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  separator: {
    height: Spacing.md,
  },
  newBtn: {
    alignSelf: "center",
    marginLeft: Spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalKeyboard: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing["2xl"],
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
    marginBottom: Spacing.sm,
  },
  input: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    textAlignVertical: "center",
  },
  textArea: {
    height: 80,
    paddingTop: Spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  submitButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
});
