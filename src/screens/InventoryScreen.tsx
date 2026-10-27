import React, { useState, useCallback } from "react";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStock: number;
  purchasePrice: number;
  sellingPrice: number;
  lastUpdated: string;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

const INITIAL_INVENTORY: InventoryItem[] = [];

const CATEGORIES = ["সব", "সার", "বীজ", "কীটনাশক", "খাদ্য"];

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState("");

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredInventory = inventory.filter(
    (item) => selectedCategory === "সব" || item.category === selectedCategory
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_stock":
        return "#2E96EF";
      case "low_stock":
        return "#B25E09";
      case "out_of_stock":
        return "#DA2F2F";
      default:
        return theme.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "in_stock":
        return "পর্যাপ্ত";
      case "low_stock":
        return "কম স্টক";
      case "out_of_stock":
        return "স্টক নেই";
      default:
        return status;
    }
  };

  const handleAdjustStock = (item: InventoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
    setAdjustQuantity("");
    setModalVisible(true);
  };

  const handleSaveAdjustment = () => {
    if (!selectedItem || !adjustQuantity) return;

    const newQuantity = parseInt(adjustQuantity);
    if (isNaN(newQuantity) || newQuantity < 0) {
      Alert.alert("ত্রুটি", "সঠিক পরিমাণ দিন");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === selectedItem.id) {
          let status: InventoryItem["status"] = "in_stock";
          if (newQuantity === 0) status = "out_of_stock";
          else if (newQuantity < item.minStock) status = "low_stock";
          return { ...item, quantity: newQuantity, status, lastUpdated: "এইমাত্র" };
        }
        return item;
      })
    );
    setModalVisible(false);
  };

  const totalValue = inventory.reduce(
    (sum, item) => sum + item.quantity * item.sellingPrice,
    0
  );
  const lowStockCount = inventory.filter((item) => item.status === "low_stock").length;
  const outOfStockCount = inventory.filter((item) => item.status === "out_of_stock").length;

  const renderItem = ({ item, index }: { item: InventoryItem; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable
        style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => handleAdjustStock(item)}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleContainer}>
            <ThemedText style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </ThemedText>
            <View style={styles.categoryBadge}>
              <ThemedText style={[styles.categoryText, { color: theme.textSecondary }]}>
                {item.category}
              </ThemedText>
            </View>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "15" }]}
          >
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <ThemedText style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.quantityRow}>
          <View style={styles.quantityInfo}>
            <ThemedText style={[styles.quantityLabel, { color: theme.textSecondary }]}>
              বর্তমান স্টক
            </ThemedText>
            <ThemedText style={[styles.quantityValue, { color: theme.text }]}>
              {item.quantity} {item.unit}
            </ThemedText>
          </View>
          <View style={styles.quantityInfo}>
            <ThemedText style={[styles.quantityLabel, { color: theme.textSecondary }]}>
              ন্যূনতম স্টক
            </ThemedText>
            <ThemedText style={[styles.quantityValue, { color: theme.textSecondary }]}>
              {item.minStock} {item.unit}
            </ThemedText>
          </View>
          <View style={styles.quantityInfo}>
            <ThemedText style={[styles.quantityLabel, { color: theme.textSecondary }]}>
              মূল্য/একক
            </ThemedText>
            <ThemedText style={[styles.quantityValue, { color: theme.primary }]}>
              ৳{item.sellingPrice}
            </ThemedText>
          </View>
        </View>

        <View style={styles.itemFooter}>
          <ThemedText style={[styles.updatedText, { color: theme.textSecondary }]}>
            <Feather name="clock" size={12} /> আপডেট: {item.lastUpdated}
          </ThemedText>
          <ThemedText style={[styles.stockValue, { color: theme.text }]}>
            মোট: ৳{(item.quantity * item.sellingPrice).toLocaleString()}
          </ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn} style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoriesList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === item ? theme.primary : theme.card,
                  borderColor: selectedCategory === item ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(item);
              }}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: selectedCategory === item ? theme.white : theme.text },
                ]}
              >
                {item}
              </ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      <FlatList
        data={filteredInventory}
        ListEmptyComponent={<EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" />}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="package" size={22} color={theme.primary} />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                ৳{totalValue.toLocaleString()}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                মোট মূল্য
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#B25E09" + "15" }]}>
              <Feather name="alert-triangle" size={22} color="#B25E09" />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>{lowStockCount}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>কম স্টক</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#DA2F2F" + "15" }]}>
              <Feather name="x-circle" size={22} color="#DA2F2F" />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>{outOfStockCount}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>স্টক নেই</ThemedText>
            </View>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>স্টক আপডেট</ThemedText>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            {selectedItem ? (
              <>
                <ThemedText style={[styles.modalItemName, { color: theme.text }]}>
                  {selectedItem.name}
                </ThemedText>
                <ThemedText style={[styles.modalCurrentStock, { color: theme.textSecondary }]}>
                  বর্তমান স্টক: {selectedItem.quantity} {selectedItem.unit}
                </ThemedText>

                <View style={styles.inputContainer}>
                  <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                    নতুন পরিমাণ ({selectedItem.unit})
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder },
                    ]}
                    value={adjustQuantity}
                    onChangeText={setAdjustQuantity}
                    keyboardType="numeric"
                    placeholder="পরিমাণ লিখুন"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: theme.backgroundRoot }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <ThemedText style={[styles.modalButtonText, { color: theme.text }]}>বাতিল</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: theme.primary }]}
                    onPress={handleSaveAdjustment}
                  >
                    <ThemedText style={[styles.modalButtonText, { color: theme.white }]}>সংরক্ষণ</ThemedText>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoriesContainer: {
    zIndex: 1,
  },
  categoriesList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  itemCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  itemTitleContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  categoryBadge: {
    flexDirection: "row",
  },
  categoryText: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  quantityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  quantityInfo: {
    alignItems: "center",
  },
  quantityLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  updatedText: {
    fontSize: 11,
  },
  stockValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  separator: {
    height: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  modalCurrentStock: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    alignItems: "center",
    borderRadius: BorderRadius.md,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
