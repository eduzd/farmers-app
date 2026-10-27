import React, { useState, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, ScrollView, ActivityIndicator, Dimensions, Platform } from "react-native";
import { TextInput } from "@/components/MayaText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useCompanyStore } from "@/lib/companyStore";
import { CompanyProduct } from "@/lib/storage";

import { AppIcon } from "@/components/icons/AppIcon";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PRODUCT_CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2;

const PRODUCT_CATEGORIES = [
  { id: "all", label: "সব", icon: "grid" },
  { id: "seeds", label: "বীজ", icon: "sun" },
  { id: "fertilizer", label: "সার", icon: "droplet" },
  { id: "pesticide", label: "কীটনাশক", icon: "shield" },
  { id: "equipment", label: "যন্ত্রপাতি", icon: "tool" },
  { id: "feed", label: "খাদ্য", icon: "package" },
  { id: "medicine", label: "ওষুধ", icon: "heart" },
  { id: "organic", label: "অর্গানিক", icon: "zap" },
  { id: "other", label: "অন্যান্য", icon: "more-horizontal" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "নতুন" },
  { id: "price_low", label: "দাম কম" },
  { id: "price_high", label: "দাম বেশি" },
  { id: "name", label: "নাম" },
  { id: "stock", label: "স্টক" },
];

const UNITS = ["কেজি", "পিস", "লিটার", "প্যাকেট", "বস্তা", "সেট", "গ্রাম", "মন", "বোতল", "বক্স"];

const CONDITION_OPTIONS = [
  { id: "new", label: "নতুন", icon: "star" },
  { id: "fresh", label: "তাজা", icon: "zap" },
  { id: "organic", label: "অর্গানিক", icon: "heart" },
  { id: "premium", label: "প্রিমিয়াম", icon: "award" },
];

const DELIVERY_OPTIONS = [
  { id: "same_day", label: "একই দিন" },
  { id: "next_day", label: "পরের দিন" },
  { id: "2_3_days", label: "২-৩ দিন" },
  { id: "1_week", label: "১ সপ্তাহ" },
  { id: "pickup_only", label: "শুধু পিকআপ" },
];

export default function CompanyProductsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { company, products, addProduct, updateProduct, deleteProduct } = useCompanyStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CompanyProduct | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    discountPrice: "",
    unit: "কেজি",
    quantity: "",
    category: "",
    minOrder: "1",
    sku: "",
    brand: "",
    weight: "",
    condition: "new",
    deliveryTime: "2_3_days",
    tags: "",
    specifications: "",
    origin: "",
    harvestDate: "",
    expiryDate: "",
    isOrganic: false,
    isFeatured: false,
  });

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter((p) => p.category === selectedCategory);
    }

    switch (sortBy) {
      case "price_low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_high":
        result.sort((a, b) => b.price - a.price);
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "stock":
        result.sort((a, b) => b.quantity - a.quantity);
        break;
      case "newest":
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [products, searchQuery, selectedCategory, sortBy]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      discountPrice: "",
      unit: "কেজি",
      quantity: "",
      category: "",
      minOrder: "1",
      sku: "",
      brand: "",
      weight: "",
      condition: "new",
      deliveryTime: "2_3_days",
      tags: "",
      specifications: "",
      origin: "",
      harvestDate: "",
      expiryDate: "",
      isOrganic: false,
      isFeatured: false,
    });
    setEditingProduct(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleEdit = (product: CompanyProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      discountPrice: "",
      unit: product.unit,
      quantity: product.quantity.toString(),
      category: product.category,
      minOrder: "1",
      sku: "",
      brand: "",
      weight: "",
      condition: "new",
      deliveryTime: "2_3_days",
      tags: "",
      specifications: "",
      origin: "",
      harvestDate: "",
      expiryDate: "",
      isOrganic: false,
      isFeatured: false,
    });
    setShowAddModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.category) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        currency: "BDT",
        unit: formData.unit,
        quantity: parseInt(formData.quantity) || 0,
        category: formData.category,
        images: [],
        status: "active" as const,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
      } else {
        await addProduct(productData);
      }

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deleteProduct(productId);
    setShowDeleteConfirm(null);
  };

  const renderGridProduct = ({ item }: { item: CompanyProduct }) => (
    <Pressable
      style={[styles.gridProductCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      onPress={() => handleEdit(item)}
      onLongPress={() => setShowDeleteConfirm(item.id)}
    >
      <View style={[styles.gridProductImage, { backgroundColor: theme.surface }]}>
        <Feather name="package" size={36} color={theme.textSecondary} />
        {item.status === "active" && item.quantity > 0 ? null : (
          <View style={[styles.outOfStockOverlay, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
            <ThemedText style={styles.outOfStockText}>স্টক শেষ</ThemedText>
          </View>
        )}
      </View>
      <View style={styles.gridProductInfo}>
        <ThemedText numberOfLines={2} style={styles.gridProductName}>{item.name}</ThemedText>
        <ThemedText style={[styles.gridProductPrice, { color: theme.primary }]}>
          ৳{item.price.toLocaleString()}/{item.unit}
        </ThemedText>
        <View style={styles.gridProductMeta}>
          <View style={[styles.stockBadge, { backgroundColor: item.quantity > 0 ? "#00BB7715" : "#DA2F2F15" }]}>
            <ThemedText style={[styles.stockText, { color: item.quantity > 0 ? "#00BB77" : "#DA2F2F" }]}>
              {item.quantity > 0 ? `${item.quantity} স্টকে` : "স্টক আউট"}
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );

  const renderListProduct = ({ item }: { item: CompanyProduct }) => (
    <Pressable
      style={[styles.listProductCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      onPress={() => handleEdit(item)}
      onLongPress={() => setShowDeleteConfirm(item.id)}
    >
      <View style={[styles.listProductImage, { backgroundColor: theme.surface }]}>
        <Feather name="package" size={32} color={theme.textSecondary} />
      </View>
      <View style={styles.listProductInfo}>
        <ThemedText type="h4" numberOfLines={1}>{item.name}</ThemedText>
        <ThemedText numberOfLines={1} style={[styles.listProductDesc, { color: theme.textSecondary }]}>
          {item.description || "বিবরণ নেই"}
        </ThemedText>
        <View style={styles.listProductPriceRow}>
          <ThemedText style={[styles.listProductPrice, { color: theme.primary }]}>
            ৳{item.price.toLocaleString()}/{item.unit}
          </ThemedText>
          <View style={[styles.stockBadge, { backgroundColor: item.quantity > 0 ? "#00BB7715" : "#DA2F2F15" }]}>
            <ThemedText style={[styles.stockText, { color: item.quantity > 0 ? "#00BB77" : "#DA2F2F" }]}>
              {item.quantity > 0 ? `${item.quantity} স্টকে` : "স্টক আউট"}
            </ThemedText>
          </View>
        </View>
      </View>
      <View style={styles.listProductActions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
          onPress={() => handleEdit(item)}
        >
          <Feather name="edit-2" size={16} color={theme.primary} />
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: "#DA2F2F15" }]}
          onPress={() => setShowDeleteConfirm(item.id)}
        >
          <Feather name="trash-2" size={16} color="#DA2F2F" />
        </Pressable>
      </View>
    </Pressable>
  );

  if (!company) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot, paddingTop: Spacing.md }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
          প্রথমে কোম্পানি প্রোফাইল তৈরি করুন
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: Spacing.md }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="পণ্য খুঁজুন..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {PRODUCT_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              style={[
                styles.categoryChip,
                { borderColor: theme.cardBorder },
                selectedCategory === cat.id && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <AppIcon 
                name={cat.icon as any} 
                size={14} 
                color={selectedCategory === cat.id ? "#FFFFFF" : theme.textSecondary} 
              />
              <ThemedText 
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.id && { color: "#FFFFFF" },
                ]}
              >
                {cat.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.toolbarRow}>
          <ThemedText style={[styles.resultCount, { color: theme.textSecondary }]}>
            {filteredProducts.length} টি পণ্য
          </ThemedText>
          <View style={styles.toolbarActions}>
            <Pressable
              style={[styles.sortButton, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
              onPress={() => setShowSortModal(true)}
            >
              <Feather name="sliders" size={16} color={theme.text} />
              <ThemedText style={styles.sortButtonText}>
                {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
              </ThemedText>
            </Pressable>
            <View style={[styles.viewToggle, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Pressable
                style={[styles.viewButton, viewMode === "grid" && { backgroundColor: theme.primary }]}
                onPress={() => setViewMode("grid")}
              >
                <Feather name="grid" size={16} color={viewMode === "grid" ? "#FFFFFF" : theme.textSecondary} />
              </Pressable>
              <Pressable
                style={[styles.viewButton, viewMode === "list" && { backgroundColor: theme.primary }]}
                onPress={() => setViewMode("list")}
              >
                <Feather name="list" size={16} color={viewMode === "list" ? "#FFFFFF" : theme.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        key={viewMode}
        data={filteredProducts}
        renderItem={viewMode === "grid" ? renderGridProduct : renderListProduct}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === "grid" ? 2 : 1}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <LinearGradient
              colors={[theme.primary + "30", theme.primary + "10"]}
              style={styles.emptyIcon}
            >
              <Feather name="package" size={48} color={theme.primary} />
            </LinearGradient>
            <ThemedText type="h4" style={styles.emptyTitle}>
              {searchQuery || selectedCategory !== "all" ? "কোনো পণ্য পাওয়া যায়নি" : "কোনো পণ্য নেই"}
            </ThemedText>
            <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>
              {searchQuery || selectedCategory !== "all" 
                ? "অন্য কিছু খুঁজে দেখুন"
                : "আপনার প্রথম পণ্য যোগ করুন"}
            </ThemedText>
            {!searchQuery && selectedCategory === "all" ? (
              <Pressable
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={handleOpenAdd}
              >
                <Feather name="plus" size={18} color="#FFFFFF" />
                <ThemedText style={styles.addButtonText}>পণ্য যোগ করুন</ThemedText>
              </Pressable>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={handleOpenAdd}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable 
          style={styles.sortModalBackdrop}
          onPress={() => setShowSortModal(false)}
        >
          <View style={[styles.sortModalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <ThemedText type="h4" style={styles.sortModalTitle}>সাজান</ThemedText>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.sortOption,
                  sortBy === option.id && { backgroundColor: theme.primary + "15" },
                ]}
                onPress={() => {
                  setSortBy(option.id);
                  setShowSortModal(false);
                }}
              >
                <ThemedText style={sortBy === option.id ? { color: theme.primary } : undefined}>
                  {option.label}
                </ThemedText>
                {sortBy === option.id ? (
                  <Feather name="check" size={18} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showDeleteConfirm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(null)}
      >
        <View style={styles.deleteModalBackdrop}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={[styles.deleteIconCircle, { backgroundColor: "#DA2F2F20" }]}>
              <Feather name="trash-2" size={28} color="#DA2F2F" />
            </View>
            <ThemedText type="h4" style={styles.deleteModalTitle}>পণ্য মুছে ফেলুন?</ThemedText>
            <ThemedText style={[styles.deleteModalText, { color: theme.textSecondary }]}>
              এই পণ্যটি স্থায়ীভাবে মুছে যাবে
            </ThemedText>
            <View style={styles.deleteModalButtons}>
              <Pressable
                style={[styles.deleteModalButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowDeleteConfirm(null)}
              >
                <ThemedText>বাতিল</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.deleteModalButton, { backgroundColor: "#DA2F2F" }]}
                onPress={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              >
                <ThemedText style={{ color: "#FFFFFF" }}>মুছুন</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.cardBorder }, Platform.OS === "android" && { paddingTop: insets.top + Spacing.md }]}>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h4">
                {editingProduct ? "পণ্য সম্পাদনা" : "নতুন পণ্য"}
              </ThemedText>
              <View style={{ width: 24 }} />
            </View>

            <KeyboardAwareScrollViewCompat
              style={styles.modalContent}
              contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={100}
            >
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>পণ্যের নাম *</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="পণ্যের নাম লিখুন"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>বিবরণ</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="পণ্যের বিবরণ"
                placeholderTextColor={theme.textSecondary}
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>শ্রেণী *</ThemedText>
              <View style={styles.categoryGrid}>
                {PRODUCT_CATEGORIES.filter(c => c.id !== "all").map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      { borderColor: theme.cardBorder },
                      formData.category === cat.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setFormData({ ...formData, category: cat.id })}
                  >
                    <AppIcon 
                      name={cat.icon as any} 
                      size={14} 
                      color={formData.category === cat.id ? "#FFFFFF" : theme.textSecondary} 
                    />
                    <ThemedText 
                      style={[
                        styles.categoryOptionText,
                        formData.category === cat.id && { color: "#FFFFFF" },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>দাম (৳) *</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, price: text })}
                  placeholder="০"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>একক</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {UNITS.map((unit) => (
                    <Pressable
                      key={unit}
                      style={[
                        styles.unitChip,
                        { borderColor: theme.cardBorder },
                        formData.unit === unit && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setFormData({ ...formData, unit })}
                    >
                      <ThemedText style={formData.unit === unit ? { color: "#FFFFFF", fontSize: 12 } : { fontSize: 12 }}>
                        {unit}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>ছাড়ের দাম (৳)</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.discountPrice}
                  onChangeText={(text) => setFormData({ ...formData, discountPrice: text })}
                  placeholder="ঐচ্ছিক"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>ওজন</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.weight}
                  onChangeText={(text) => setFormData({ ...formData, weight: text })}
                  placeholder="যেমন: ১ কেজি"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>স্টক পরিমাণ</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.quantity}
                  onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>ন্যূনতম অর্ডার</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.minOrder}
                  onChangeText={(text) => setFormData({ ...formData, minOrder: text })}
                  placeholder="1"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={[styles.sectionDivider, { borderColor: theme.cardBorder }]}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>অতিরিক্ত তথ্য</ThemedText>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>ব্র্যান্ড/কোম্পানি</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.brand}
                  onChangeText={(text) => setFormData({ ...formData, brand: text })}
                  placeholder="ব্র্যান্ডের নাম"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>SKU/কোড</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.sku}
                  onChangeText={(text) => setFormData({ ...formData, sku: text })}
                  placeholder="পণ্য কোড"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>উৎস/এলাকা</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.origin}
                onChangeText={(text) => setFormData({ ...formData, origin: text })}
                placeholder="যেমন: রাজশাহী, বাংলাদেশ"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>পণ্যের অবস্থা</ThemedText>
              <View style={styles.optionGrid}>
                {CONDITION_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.optionChip,
                      { borderColor: theme.cardBorder },
                      formData.condition === option.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setFormData({ ...formData, condition: option.id })}
                  >
                    <AppIcon 
                      name={option.icon as any} 
                      size={14} 
                      color={formData.condition === option.id ? "#FFFFFF" : theme.textSecondary} 
                    />
                    <ThemedText 
                      style={[
                        styles.optionChipText,
                        formData.condition === option.id && { color: "#FFFFFF" },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>ডেলিভারি সময়</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {DELIVERY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.deliveryChip,
                      { borderColor: theme.cardBorder },
                      formData.deliveryTime === option.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setFormData({ ...formData, deliveryTime: option.id })}
                  >
                    <ThemedText 
                      style={[
                        styles.deliveryChipText,
                        formData.deliveryTime === option.id && { color: "#FFFFFF" },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>ট্যাগ/কীওয়ার্ড</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.tags}
                onChangeText={(text) => setFormData({ ...formData, tags: text })}
                placeholder="কমা দিয়ে আলাদা করুন: জৈব, তাজা, দেশি"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>বিশেষ বৈশিষ্ট্য</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.specifications}
                onChangeText={(text) => setFormData({ ...formData, specifications: text })}
                placeholder="পণ্যের বিশেষ বৈশিষ্ট্য লিখুন..."
                placeholderTextColor={theme.textSecondary}
                multiline
              />
            </View>

            <View style={styles.toggleGroup}>
              <Pressable
                style={[
                  styles.toggleOption,
                  { backgroundColor: theme.surface, borderColor: theme.cardBorder },
                  formData.isOrganic && { backgroundColor: "#00BB7715", borderColor: "#00BB77" },
                ]}
                onPress={() => setFormData({ ...formData, isOrganic: !formData.isOrganic })}
              >
                <Feather 
                  name="check-circle" 
                  size={20} 
                  color={formData.isOrganic ? "#00BB77" : theme.textSecondary} 
                />
                <View style={styles.toggleContent}>
                  <ThemedText style={[styles.toggleTitle, formData.isOrganic && { color: "#00BB77" }]}>
                    অর্গানিক পণ্য
                  </ThemedText>
                  <ThemedText style={[styles.toggleDesc, { color: theme.textSecondary }]}>
                    কীটনাশকমুক্ত প্রাকৃতিক পণ্য
                  </ThemedText>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.toggleOption,
                  { backgroundColor: theme.surface, borderColor: theme.cardBorder },
                  formData.isFeatured && { backgroundColor: "#B25E0915", borderColor: "#B25E09" },
                ]}
                onPress={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
              >
                <Feather 
                  name="star" 
                  size={20} 
                  color={formData.isFeatured ? "#B25E09" : theme.textSecondary} 
                />
                <View style={styles.toggleContent}>
                  <ThemedText style={[styles.toggleTitle, formData.isFeatured && { color: "#B25E09" }]}>
                    ফিচার্ড পণ্য
                  </ThemedText>
                  <ThemedText style={[styles.toggleDesc, { color: theme.textSecondary }]}>
                    প্রথমে দেখানো হবে
                  </ThemedText>
                </View>
              </Pressable>
            </View>

            <View style={[styles.tipCard, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
              <Feather name="info" size={18} color={theme.primary} />
              <ThemedText style={[styles.tipText, { color: theme.text }]}>
                পণ্যের ছবি যোগ করতে পণ্য সংরক্ষণ করার পর সম্পাদনা করুন
              </ThemedText>
            </View>

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <AppIcon name={editingProduct ? "check" : "plus"} size={18} color="#FFFFFF" />
                  <ThemedText style={styles.saveButtonText}>
                    {editingProduct ? "আপডেট করুন" : "পণ্য যোগ করুন"}
                  </ThemedText>
                </>
              )}
            </Pressable>
            </KeyboardAwareScrollViewCompat>
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
  },
  categoriesContainer: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
  },
  categoryChipText: {
    fontSize: 13,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultCount: {
    fontSize: 13,
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  sortButtonText: {
    fontSize: 13,
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  viewButton: {
    padding: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  gridRow: {
    justifyContent: "space-between",
  },
  gridProductCard: {
    width: PRODUCT_CARD_WIDTH,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
    ...Shadows.small,
  },
  gridProductImage: {
    width: "100%",
    height: PRODUCT_CARD_WIDTH * 0.9,
    justifyContent: "center",
    alignItems: "center",
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  outOfStockText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
  },
  gridProductInfo: {
    padding: Spacing.md,
  },
  gridProductName: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  gridProductPrice: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
  },
  gridProductMeta: {
    marginTop: Spacing.sm,
  },
  gridProductStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  gridStatText: {
    fontSize: 11,
    marginLeft: 2,
  },
  listProductCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  listProductImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  listProductInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  listProductDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  listProductPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  listProductPrice: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
  },
  stockBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  stockText: {
    fontSize: 11,
    fontFamily: "DMSans_500Medium",
  },
  listProductActions: {
    justifyContent: "center",
    gap: Spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyList: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    marginBottom: Spacing.sm,
  },
  emptyDescription: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
  },
  fab: {
    position: "absolute",
    bottom: 100,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.medium,
  },
  sortModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  sortModalContent: {
    width: SCREEN_WIDTH - Spacing.lg * 4,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadows.large,
  },
  sortModalTitle: {
    marginBottom: Spacing.md,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteModalContent: {
    width: SCREEN_WIDTH - Spacing.lg * 4,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: "center",
    ...Shadows.large,
  },
  deleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  deleteModalTitle: {
    marginBottom: Spacing.sm,
  },
  deleteModalText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  deleteModalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  deleteModalButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    marginBottom: Spacing.sm,
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
  },
  textInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  categoryOptionText: {
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
  },
  unitChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionDivider: {
    borderTopWidth: 1,
    paddingTop: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  optionChipText: {
    fontSize: 13,
  },
  deliveryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  deliveryChipText: {
    fontSize: 12,
  },
  toggleGroup: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  toggleOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...Shadows.medium,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
  },
});
