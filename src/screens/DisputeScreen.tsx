import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, Alert } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useDisputeStore, DISPUTE_REASONS, Dispute, DisputeReason } from "@/lib/disputeStore";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import { ModalBottomInset } from "@/components/ModalBottomInset";

import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
const getStatusConfig = (status: Dispute["status"]) => {
  const configs: Record<string, { color: string; labelBn: string; labelEn: string; icon: string }> = {
    open: { color: "#B25E09", labelBn: "খোলা", labelEn: "Open", icon: "alert-circle" },
    under_review: { color: "#2E96EF", labelBn: "পর্যালোচনায়", labelEn: "Under Review", icon: "eye" },
    awaiting_seller: { color: "#3D38D0", labelBn: "সেলারের অপেক্ষায়", labelEn: "Awaiting Seller", icon: "clock" },
    awaiting_buyer: { color: "#3D38D0", labelBn: "ক্রেতার অপেক্ষায়", labelEn: "Awaiting Buyer", icon: "clock" },
    resolved: { color: "#2E96EF", labelBn: "সমাধান হয়েছে", labelEn: "Resolved", icon: "check-circle" },
    closed: { color: "#7A8CA3", labelBn: "বন্ধ", labelEn: "Closed", icon: "x-circle" },
  };
  return configs[status] || configs.open;
};

export default function DisputeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { language } = useI18n();
  const isBn = language === "bn";
  const { user } = useAuthStore();
  
  const { disputes, createDispute, getDisputesByBuyer } = useDisputeStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [orderId, setOrderId] = useState("");

  const myDisputes = user?.id ? getDisputesByBuyer(user.id) : disputes;

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setEvidence([...evidence, ...result.assets.map((a) => a.uri)]);
    }
  };

  const handleSubmitDispute = () => {
    if (!selectedReason || !description.trim() || !orderId.trim()) {
      Alert.alert(
        isBn ? "তথ্য অসম্পূর্ণ" : "Incomplete",
        isBn ? "সব তথ্য পূরণ করুন" : "Please fill all required fields"
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    createDispute({
      orderId: orderId,
      orderNumber: `#${orderId}`,
      buyerId: user?.id || "guest",
      buyerName: user?.name || "Guest",
      sellerId: "seller1",
      sellerName: "সেলার",
      reason: selectedReason,
      description,
      evidence,
    });

    setShowCreateModal(false);
    setSelectedReason(null);
    setDescription("");
    setEvidence([]);
    setOrderId("");

    Alert.alert(
      isBn ? "সফল!" : "Success!",
      isBn ? "আপনার সমস্যা জমা দেওয়া হয়েছে। শীঘ্রই সমাধান করা হবে।" : "Your dispute has been submitted. We will resolve it soon."
    );
  };

  const renderDispute = ({ item: dispute, index }: { item: Dispute; index: number }) => {
    const statusConfig = getStatusConfig(dispute.status);
    const reasonConfig = DISPUTE_REASONS.find((r) => r.id === dispute.reason);

    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <Pressable
          style={[styles.disputeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        >
          <View style={styles.disputeHeader}>
            <View style={styles.orderInfo}>
              <ThemedText style={[styles.orderNumber, { color: theme.text }]}>
                {isBn ? "অর্ডার" : "Order"} {dispute.orderNumber}
              </ThemedText>
              <ThemedText style={[styles.disputeDate, { color: theme.textSecondary }]}>
                {new Date(dispute.createdAt).toLocaleDateString(isBn ? "bn-BD" : "en-US")}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + "20" }]}>
              <AppIcon name={statusConfig.icon as any} size={12} color={statusConfig.color} />
              <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                {isBn ? statusConfig.labelBn : statusConfig.labelEn}
              </ThemedText>
            </View>
          </View>

          <View style={styles.reasonRow}>
            <View style={[styles.reasonIcon, { backgroundColor: theme.primary + "15" }]}>
              <AppIcon name={reasonConfig?.icon as any} size={16} color={theme.primary} />
            </View>
            <ThemedText style={[styles.reasonText, { color: theme.text }]}>
              {isBn ? reasonConfig?.labelBn : reasonConfig?.labelEn}
            </ThemedText>
          </View>

          <ThemedText style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
            {dispute.description}
          </ThemedText>

          {dispute.evidence.length > 0 ? (
            <View style={styles.evidenceRow}>
              {dispute.evidence.slice(0, 3).map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.evidenceThumb} contentFit="cover" />
              ))}
              {dispute.evidence.length > 3 ? (
                <View style={[styles.moreEvidence, { backgroundColor: theme.backgroundRoot }]}>
                  <ThemedText style={[styles.moreText, { color: theme.textSecondary }]}>
                    +{dispute.evidence.length - 3}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.messagesInfo}>
            <ChatIcon size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.messagesCount, { color: theme.textSecondary }]}>
              {dispute.messages.length} {isBn ? "মেসেজ" : "messages"}
            </ThemedText>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={myDisputes}
        renderItem={renderDispute}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Animated.View entering={FadeIn}>
            <Pressable
              style={[styles.createButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCreateModal(true);
              }}
            >
              <Feather name="plus" size={20} color="#FFF" />
              <ThemedText style={styles.createButtonText}>
                {isBn ? "নতুন সমস্যা রিপোর্ট করুন" : "Report New Issue"}
              </ThemedText>
            </Pressable>
          </Animated.View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isBn ? "কোনো সমস্যা নেই" : "No disputes"}
            </ThemedText>
          </View>
        }
      />

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                {isBn ? "সমস্যা রিপোর্ট করুন" : "Report Issue"}
              </ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.cardBorder }]}
                placeholder={isBn ? "অর্ডার নম্বর" : "Order Number"}
                placeholderTextColor={theme.textSecondary}
                value={orderId}
                onChangeText={setOrderId}
              />

              <ThemedText style={[styles.label, { color: theme.text }]}>
                {isBn ? "সমস্যার ধরন" : "Issue Type"}
              </ThemedText>
              <View style={styles.reasonGrid}>
                {DISPUTE_REASONS.map((reason) => (
                  <Pressable
                    key={reason.id}
                    style={[
                      styles.reasonOption,
                      { backgroundColor: theme.card, borderColor: theme.cardBorder },
                      selectedReason === reason.id && { borderColor: theme.primary, backgroundColor: theme.primary + "15" },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedReason(reason.id);
                    }}
                  >
                    <AppIcon
                      name={reason.icon as any}
                      size={18}
                      color={selectedReason === reason.id ? theme.primary : theme.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.reasonOptionText,
                        { color: selectedReason === reason.id ? theme.primary : theme.text },
                      ]}
                    >
                      {isBn ? reason.labelBn : reason.labelEn}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: theme.card, color: theme.text, borderColor: theme.cardBorder },
                ]}
                placeholder={isBn ? "বিস্তারিত বর্ণনা করুন..." : "Describe the issue..."}
                placeholderTextColor={theme.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />

              <Pressable
                style={[styles.uploadButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                onPress={handlePickImage}
              >
                <Feather name="camera" size={20} color={theme.primary} />
                <ThemedText style={[styles.uploadText, { color: theme.text }]}>
                  {isBn ? "প্রমাণ আপলোড করুন (ছবি)" : "Upload Evidence (Photos)"}
                </ThemedText>
              </Pressable>

              {evidence.length > 0 ? (
                <View style={styles.evidencePreview}>
                  {evidence.map((uri, i) => (
                    <View key={i} style={styles.previewWrapper}>
                      <Image source={{ uri }} style={styles.previewImage} contentFit="cover" />
                      <Pressable
                        style={styles.removeImage}
                        onPress={() => setEvidence(evidence.filter((_, idx) => idx !== i))}
                      >
                        <Feather name="x" size={14} color="#FFF" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <Pressable
                style={[styles.submitButton, { backgroundColor: theme.primary }]}
                onPress={handleSubmitDispute}
              >
                <ThemedText style={styles.submitButtonText}>
                  {isBn ? "জমা দিন" : "Submit"}
                </ThemedText>
              </Pressable>
            </View>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.lg,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: "#FFF",
  },
  disputeCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  disputeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  orderInfo: {},
  orderNumber: {
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
  },
  disputeDate: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "DMSans_600SemiBold",
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  reasonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  reasonText: {
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
  },
  description: {
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    marginBottom: Spacing.sm,
  },
  evidenceRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  evidenceThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  moreEvidence: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  moreText: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
  },
  messagesInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  messagesCount: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
  },
  modalBody: {
    padding: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    marginBottom: Spacing.md,
  },
  textArea: {
    height: 100,
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  reasonOptionText: {
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  uploadText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
  },
  evidencePreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  previewWrapper: {
    position: "relative",
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
  },
  removeImage: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#DA2F2F",
    justifyContent: "center",
    alignItems: "center",
  },
  submitButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: "#FFF",
  },
});
