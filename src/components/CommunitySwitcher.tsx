import React, { useState, forwardRef, useImperativeHandle } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
} from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { useCommunityStore, Community } from "@/lib/communityStore";
import { useI18n } from "@/lib/i18n";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ModalBottomInset } from "@/components/ModalBottomInset";

interface CommunitySwitcherProps {
  compact?: boolean;
}

export interface CommunitySwitcherRef {
  openModal: () => void;
}

export const CommunitySwitcher = forwardRef<CommunitySwitcherRef, CommunitySwitcherProps>(({ compact = false }, ref) => {
  const { theme, isDark } = useTheme();
  const { t, language } = useI18n();
  const { communities, activeCommunity, setActiveCommunity, memberships } = useCommunityStore();
  const [modalVisible, setModalVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    openModal: () => setModalVisible(true),
  }));

  if (!activeCommunity) {
    return null;
  }

  const getCommunityName = (community: Community) => {
    return language === "bn" ? community.nameBn || community.nameEn : community.nameEn || community.nameBn;
  };

  const handleSelectCommunity = async (community: Community) => {
    await setActiveCommunity(community.id);
    setModalVisible(false);
  };

  const isMember = (communityId: string) => {
    return memberships.some(m => m.communityId === communityId);
  };

  return (
    <>
      <Pressable
        style={[
          compact ? styles.switcherCompact : styles.switcher, 
          { backgroundColor: compact ? "transparent" : theme.backgroundSecondary, borderColor: compact ? "transparent" : theme.divider }
        ]}
        onPress={() => setModalVisible(true)}
      >
        <View style={[compact ? styles.communityIconCompact : styles.communityIcon, { backgroundColor: theme.primary }]}>
          <ThemedText style={compact ? styles.communityIconTextCompact : styles.communityIconText}>
            {getCommunityName(activeCommunity)?.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        {compact ? null : (
          <ThemedText style={[styles.communityName, { color: theme.text }]} numberOfLines={1}>
            {getCommunityName(activeCommunity)}
          </ThemedText>
        )}
        <Feather name="chevron-down" size={compact ? 14 : 16} color={theme.textSecondary} />
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                {t("community.selectCommunity")}
              </ThemedText>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <FlatList
              data={communities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isActive = item.id === activeCommunity?.id;
                const member = isMember(item.id);
                
                return (
                  <Pressable
                    style={[
                      styles.communityItem,
                      { borderBottomColor: theme.divider },
                      isActive && { backgroundColor: theme.backgroundSecondary },
                    ]}
                    onPress={() => handleSelectCommunity(item)}
                  >
                    <View
                      style={[
                        styles.itemIcon,
                        { backgroundColor: theme.primary },
                      ]}
                    >
                      <ThemedText style={styles.itemIconText}>
                        {getCommunityName(item)?.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={styles.itemInfo}>
                      <ThemedText style={[styles.itemName, { color: theme.text }]}>
                        {getCommunityName(item)}
                      </ThemedText>
                      {member ? (
                        <ThemedText style={[styles.itemStatus, { color: theme.success }]}>
                          {t("community.member")}
                        </ThemedText>
                      ) : null}
                    </View>
                    {isActive ? (
                      <Feather name="check" size={20} color={theme.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  communityIcon: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  communityIconText: {
    color: "#fff",
    fontSize: Typography.sizes.sm,
    fontWeight: "600",
  },
  switcherCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  communityIconCompact: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  communityIconTextCompact: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  communityName: {
    ...Typography.small,
    fontWeight: "500",
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
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    maxHeight: "60%",
    paddingBottom: Spacing["4xl"],
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    ...Typography.h4,
  },
  communityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIconText: {
    color: "#fff",
    fontSize: Typography.sizes.lg,
    fontWeight: "600",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Typography.body,
    fontWeight: "500",
  },
  itemStatus: {
    ...Typography.caption,
    marginTop: 2,
  },
});
