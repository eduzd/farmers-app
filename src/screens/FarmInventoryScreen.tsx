import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal, FlatList, Alert } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@/components/icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp, SlideInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ModalBottomInset } from "@/components/ModalBottomInset";

import { AppIcon } from "@/components/icons/AppIcon";
interface InventoryItem {
  id: string;
  name: string;
  nameBn: string;
  quantity: number;
  unit: string;
  unitBn: string;
  category: string;
  purchaseDate: string;
  expiryDate?: string;
  price: number;
  supplier?: string;
  notes?: string;
  lowStockThreshold: number;
}

interface InventoryCategory {
  id: string;
  name: string;
  nameBn: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  items: InventoryItem[];
}

const INITIAL_CATEGORIES: InventoryCategory[] = [
  {
    id: "seeds",
    name: "Seeds",
    nameBn: "বীজ",
    icon: "sun",
    color: "#2E96EF",
    items: [],
  },
  {
    id: "fertilizers",
    name: "Fertilizers",
    nameBn: "সার",
    icon: "package",
    color: "#795548",
    items: [],
  },
  {
    id: "pesticides",
    name: "Pesticides",
    nameBn: "কীটনাশক",
    icon: "shield",
    color: "#DA2F2F",
    items: [],
  },
  {
    id: "equipment",
    name: "Equipment",
    nameBn: "যন্ত্রপাতি",
    icon: "tool",
    color: "#4A5568",
    items: [],
  },
  {
    id: "harvest",
    name: "Harvest",
    nameBn: "ফসল",
    icon: "box",
    color: "#B25E09",
    items: [],
  },
  {
    id: "feed",
    name: "Animal Feed",
    nameBn: "পশু খাদ্য",
    icon: "heart",
    color: "#FF4BB7",
    items: [],
  },
];

export default function FarmInventoryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [categories, setCategories] = useState<InventoryCategory[]>(INITIAL_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({});

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const totalValue = categories.reduce(
    (sum, cat) => sum + cat.items.reduce((itemSum, item) => itemSum + item.quantity * item.price, 0),
    0
  );
  const lowStockItems = categories.flatMap((cat) =>
    cat.items.filter((item) => item.quantity <= item.lowStockThreshold)
  );

  const filteredCategories = categories.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  }));

  const selectedCategoryData = selectedCategory
    ? filteredCategories.find((cat) => cat.id === selectedCategory)
    : null;

  const handleAddItem = useCallback(() => {
    if (!newItem.nameBn || !newItem.quantity || !selectedCategory) return;

    const item: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name || newItem.nameBn || "",
      nameBn: newItem.nameBn || "",
      quantity: newItem.quantity || 0,
      unit: newItem.unit || "kg",
      unitBn: newItem.unitBn || "কেজি",
      category: selectedCategory,
      purchaseDate: new Date().toISOString().split("T")[0],
      price: newItem.price || 0,
      supplier: newItem.supplier,
      lowStockThreshold: newItem.lowStockThreshold || 5,
    };

    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === selectedCategory ? { ...cat, items: [...cat.items, item] } : cat
      )
    );
    setNewItem({});
    setShowAddModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [newItem, selectedCategory]);

  const handleUpdateItem = useCallback(() => {
    if (!editingItem) return;

    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => (item.id === editingItem.id ? editingItem : item)),
      }))
    );
    setEditingItem(null);
    setShowEditModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [editingItem]);

  const handleDeleteItem = useCallback((itemId: string) => {
    Alert.alert("মুছে ফেলুন", "আপনি কি নিশ্চিত যে এই আইটেমটি মুছে ফেলতে চান?", [
      { text: "বাতিল", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          setCategories((prev) =>
            prev.map((cat) => ({
              ...cat,
              items: cat.items.filter((item) => item.id !== itemId),
            }))
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, []);

  const handleUpdateQuantity = useCallback((itemId: string, delta: number) => {
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) =>
          item.id === itemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        ),
      }))
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderCategoryCard = (category: InventoryCategory, index: number) => (
    <Animated.View key={category.id} entering={FadeInUp.delay(index * 80)}>
      <Pressable
        style={[
          styles.categoryCard,
          { backgroundColor: theme.card },
          selectedCategory === category.id && { borderColor: category.color, borderWidth: 2 },
        ]}
        onPress={() => {
          setSelectedCategory(selectedCategory === category.id ? null : category.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <View style={[styles.categoryIcon, { backgroundColor: category.color + "20" }]}>
          <AppIcon name={category.icon} size={24} color={category.color} />
        </View>
        <View style={styles.categoryInfo}>
          <ThemedText style={styles.categoryName}>{category.nameBn}</ThemedText>
          <ThemedText style={[styles.categoryCount, { color: theme.textSecondary }]}>
            {category.items.length} আইটেম
          </ThemedText>
        </View>
        <View style={styles.categoryValue}>
          <ThemedText style={[styles.valueAmount, { color: category.color }]}>
            {category.items.reduce((sum, item) => sum + item.quantity * item.price, 0).toLocaleString("bn-BD")}
          </ThemedText>
          <ThemedText style={[styles.valueLabel, { color: theme.textSecondary }]}>টাকা</ThemedText>
        </View>
        <AppIcon
          name={selectedCategory === category.id ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>
    </Animated.View>
  );

  const renderInventoryItem = ({ item, index }: { item: InventoryItem; index: number }) => {
    const isLowStock = item.quantity <= item.lowStockThreshold;
    const category = categories.find((cat) => cat.id === item.category);

    return (
      <Animated.View entering={SlideInRight.delay(index * 50)}>
        <Pressable
          style={[styles.itemCard, { backgroundColor: theme.card }]}
          onLongPress={() => {
            setEditingItem(item);
            setShowEditModal(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <View style={styles.itemHeader}>
            <View style={styles.itemTitleRow}>
              <ThemedText style={styles.itemName}>{item.nameBn}</ThemedText>
              {isLowStock && (
                <View style={[styles.lowStockBadge, { backgroundColor: "#DA2F2F" + "20" }]}>
                  <Feather name="alert-triangle" size={12} color="#DA2F2F" />
                  <ThemedText style={[styles.lowStockText, { color: "#DA2F2F" }]}>কম স্টক</ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={[styles.itemPrice, { color: theme.primary }]}>
              {item.price.toLocaleString("bn-BD")} টাকা/{item.unitBn}
            </ThemedText>
          </View>

          <View style={styles.itemDetails}>
            <View style={styles.quantityControl}>
              <Pressable
                style={[styles.quantityBtn, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => handleUpdateQuantity(item.id, -1)}
              >
                <Feather name="minus" size={16} color={theme.text} />
              </Pressable>
              <ThemedText style={styles.quantityText}>
                {item.quantity.toLocaleString("bn-BD")} {item.unitBn}
              </ThemedText>
              <Pressable
                style={[styles.quantityBtn, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => handleUpdateQuantity(item.id, 1)}
              >
                <Feather name="plus" size={16} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.itemMeta}>
              <View style={styles.metaRow}>
                <Feather name="calendar" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {item.purchaseDate}
                </ThemedText>
              </View>
              {item.supplier && (
                <View style={styles.metaRow}>
                  <Feather name="truck" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    {item.supplier}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.itemFooter}>
            <ThemedText style={[styles.totalValue, { color: category?.color || theme.primary }]}>
              মোট: {(item.quantity * item.price).toLocaleString("bn-BD")} টাকা
            </ThemedText>
            <View style={styles.itemActions}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => {
                  setEditingItem(item);
                  setShowEditModal(true);
                }}
              >
                <Feather name="edit-2" size={14} color={theme.primary} />
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#DA2F2F" + "20" }]}
                onPress={() => handleDeleteItem(item.id)}
              >
                <Feather name="trash-2" size={14} color="#DA2F2F" />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <LinearGradient
            colors={["#2E96EF", "#2E96EF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}>
                <Feather name="package" size={28} color="#FFF" />
              </View>
              <ThemedText style={styles.summaryTitle}>ইনভেন্টরি সারাংশ</ThemedText>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{totalItems.toLocaleString("bn-BD")}</ThemedText>
                <ThemedText style={styles.statLabel}>মোট আইটেম</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{totalValue.toLocaleString("bn-BD")}</ThemedText>
                <ThemedText style={styles.statLabel}>মোট মূল্য (টাকা)</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, lowStockItems.length > 0 && { color: "#FFEB3B" }]}>
                  {lowStockItems.length.toLocaleString("bn-BD")}
                </ThemedText>
                <ThemedText style={styles.statLabel}>কম স্টক</ThemedText>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="আইটেম খুঁজুন..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {lowStockItems.length > 0 && (
          <Animated.View entering={FadeInUp.delay(100)}>
            <View style={[styles.alertCard, { backgroundColor: "#FFF3E0" }]}>
              <Feather name="alert-circle" size={20} color="#B25E09" />
              <View style={styles.alertContent}>
                <ThemedText style={[styles.alertTitle, { color: "#E65100" }]}>স্টক সতর্কতা</ThemedText>
                <ThemedText style={[styles.alertText, { color: "#E65100" }]}>
                  {lowStockItems.length} টি আইটেম কম স্টকে আছে
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        <View style={styles.categoriesSection}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>ক্যাটেগরি</ThemedText>
            <Pressable
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                if (!selectedCategory) {
                  Alert.alert("ক্যাটেগরি নির্বাচন করুন", "নতুন আইটেম যোগ করতে প্রথমে একটি ক্যাটেগরি নির্বাচন করুন");
                  return;
                }
                setShowAddModal(true);
              }}
            >
              <Feather name="plus" size={16} color="#FFF" />
              <ThemedText style={styles.addButtonText}>নতুন যোগ করুন</ThemedText>
            </Pressable>
          </View>

          {filteredCategories.map((category, index) => renderCategoryCard(category, index))}
        </View>

        {selectedCategoryData && selectedCategoryData.items.length > 0 && (
          <View style={styles.itemsSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>
                {selectedCategoryData.nameBn} ({selectedCategoryData.items.length})
              </ThemedText>
            </View>
            {selectedCategoryData.items.map((item, index) => renderInventoryItem({ item, index }))}
          </View>
        )}

        {selectedCategoryData && selectedCategoryData.items.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              এই ক্যাটেগরিতে কোনো আইটেম নেই
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>নতুন আইটেম যোগ করুন</ThemedText>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>নাম</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="আইটেমের নাম"
                  placeholderTextColor={theme.textSecondary}
                  value={newItem.nameBn}
                  onChangeText={(text) => setNewItem((prev) => ({ ...prev, nameBn: text }))}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <ThemedText style={styles.inputLabel}>পরিমাণ</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={newItem.quantity?.toString()}
                    onChangeText={(text) => setNewItem((prev) => ({ ...prev, quantity: parseInt(text) || 0 }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                  <ThemedText style={styles.inputLabel}>একক</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="কেজি"
                    placeholderTextColor={theme.textSecondary}
                    value={newItem.unitBn}
                    onChangeText={(text) => setNewItem((prev) => ({ ...prev, unitBn: text }))}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>দাম (প্রতি একক)</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={newItem.price?.toString()}
                  onChangeText={(text) => setNewItem((prev) => ({ ...prev, price: parseInt(text) || 0 }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>সরবরাহকারী (ঐচ্ছিক)</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="সরবরাহকারীর নাম"
                  placeholderTextColor={theme.textSecondary}
                  value={newItem.supplier}
                  onChangeText={(text) => setNewItem((prev) => ({ ...prev, supplier: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>কম স্টক সীমা</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="5"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={newItem.lowStockThreshold?.toString()}
                  onChangeText={(text) => setNewItem((prev) => ({ ...prev, lowStockThreshold: parseInt(text) || 5 }))}
                />
              </View>
            </ScrollView>

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleAddItem}
            >
              <Feather name="check" size={20} color="#FFF" />
              <ThemedText style={styles.saveButtonText}>সংরক্ষণ করুন</ThemedText>
            </Pressable>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>আইটেম সম্পাদনা</ThemedText>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {editingItem && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>নাম</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    value={editingItem.nameBn}
                    onChangeText={(text) => setEditingItem((prev) => prev ? { ...prev, nameBn: text } : null)}
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <ThemedText style={styles.inputLabel}>পরিমাণ</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                      keyboardType="numeric"
                      value={editingItem.quantity.toString()}
                      onChangeText={(text) => setEditingItem((prev) => prev ? { ...prev, quantity: parseInt(text) || 0 } : null)}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                    <ThemedText style={styles.inputLabel}>একক</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                      value={editingItem.unitBn}
                      onChangeText={(text) => setEditingItem((prev) => prev ? { ...prev, unitBn: text } : null)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>দাম (প্রতি একক)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    keyboardType="numeric"
                    value={editingItem.price.toString()}
                    onChangeText={(text) => setEditingItem((prev) => prev ? { ...prev, price: parseInt(text) || 0 } : null)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>সরবরাহকারী</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    value={editingItem.supplier}
                    onChangeText={(text) => setEditingItem((prev) => prev ? { ...prev, supplier: text } : null)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>কম স্টক সীমা</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    keyboardType="numeric"
                    value={editingItem.lowStockThreshold.toString()}
                    onChangeText={(text) => setEditingItem((prev) => prev ? { ...prev, lowStockThreshold: parseInt(text) || 5 } : null)}
                  />
                </View>
              </ScrollView>
            )}

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleUpdateItem}
            >
              <Feather name="check" size={20} color="#FFF" />
              <ThemedText style={styles.saveButtonText}>আপডেট করুন</ThemedText>
            </Pressable>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: Spacing.sm,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFF",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  alertContent: {
    marginLeft: Spacing.md,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  alertText: {
    fontSize: 12,
    marginTop: 2,
  },
  categoriesSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "600",
  },
  categoryCount: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryValue: {
    alignItems: "flex-end",
    marginRight: Spacing.sm,
  },
  valueAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  valueLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  itemsSection: {
    marginBottom: Spacing.lg,
  },
  itemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  itemHeader: {
    marginBottom: Spacing.sm,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
  },
  lowStockBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  itemPrice: {
    fontSize: 14,
    marginTop: 4,
  },
  itemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: Spacing.md,
    minWidth: 80,
    textAlign: "center",
  },
  itemMeta: {
    alignItems: "flex-end",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  metaText: {
    fontSize: 11,
    marginLeft: 4,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    paddingTop: Spacing.sm,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemActions: {
    flexDirection: "row",
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
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
    fontWeight: "600",
  },
  modalBody: {
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
});
