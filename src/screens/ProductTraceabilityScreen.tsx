import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal, Dimensions } from "react-native";
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

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
const { width } = Dimensions.get("window");

interface TracePoint {
  id: string;
  stage: string;
  stageBn: string;
  date: string;
  location: string;
  handler: string;
  notes?: string;
  temperature?: number;
  verified: boolean;
}

interface TracedProduct {
  id: string;
  name: string;
  category: string;
  categoryBn: string;
  batchNumber: string;
  productionDate: string;
  expiryDate?: string;
  farmer: {
    name: string;
    location: string;
    farmName: string;
    verified: boolean;
  };
  journey: TracePoint[];
  certifications: string[];
  organic: boolean;
}

const SAMPLE_PRODUCTS: TracedProduct[] = [];

const STAGE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  harvested: "sun",
  processed: "tool",
  packed: "package",
  shipped: "truck",
  delivered: "check-circle",
  sorted: "filter",
};

export default function ProductTraceabilityScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [searchCode, setSearchCode] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<TracedProduct | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [products, setProducts] = useState<TracedProduct[]>(SAMPLE_PRODUCTS);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "vegetables",
    location: "",
    organic: false,
  });

  const handleSearch = () => {
    const found = products.find(
      (p) => p.id.toLowerCase() === searchCode.toLowerCase() || p.batchNumber.toLowerCase() === searchCode.toLowerCase()
    );
    if (found) {
      setSelectedProduct(found);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleCreateProduct = () => {
    if (!newProduct.name || !newProduct.location) return;

    const product: TracedProduct = {
      id: `PRD${Date.now().toString().slice(-6)}`,
      name: newProduct.name,
      category: newProduct.category,
      categoryBn: newProduct.category === "vegetables" ? "সবজি" : newProduct.category === "fruit" ? "ফল" : "শস্য",
      batchNumber: `BATCH-2025-${Date.now().toString().slice(-4)}`,
      productionDate: new Date().toISOString().split("T")[0],
      farmer: {
        name: "আমার খামার",
        location: newProduct.location,
        farmName: "কৃষক অ্যাপ খামার",
        verified: true,
      },
      journey: [
        {
          id: "j1",
          stage: "harvested",
          stageBn: "উৎপাদন",
          date: new Date().toISOString().split("T")[0],
          location: newProduct.location,
          handler: "কৃষক",
          verified: true,
        },
      ],
      certifications: newProduct.organic ? ["জৈব পণ্য"] : [],
      organic: newProduct.organic,
    };

    setProducts((prev) => [product, ...prev]);
    setNewProduct({ name: "", category: "vegetables", location: "", organic: false });
    setShowCreateModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderJourneyTimeline = (journey: TracePoint[]) => (
    <View style={styles.timeline}>
      {journey.map((point, index) => (
        <View key={point.id} style={styles.timelineItem}>
          <View style={styles.timelineLeft}>
            <View
              style={[
                styles.timelineDot,
                { backgroundColor: point.verified ? "#2E96EF" : theme.textSecondary },
              ]}
            >
              <AppIcon
                name={STAGE_ICONS[point.stage] || "circle"}
                size={12}
                color="#FFF"
              />
            </View>
            {index < journey.length - 1 && (
              <View
                style={[
                  styles.timelineLine,
                  { backgroundColor: point.verified ? "#2E96EF" : theme.inputBorder },
                ]}
              />
            )}
          </View>
          <View style={[styles.timelineContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.timelineHeader}>
              <ThemedText style={styles.stageName}>{point.stageBn}</ThemedText>
              {point.verified && (
                <View style={[styles.verifiedBadge, { backgroundColor: "#2E96EF" + "20" }]}>
                  <Feather name="check" size={10} color="#2E96EF" />
                  <ThemedText style={[styles.verifiedText, { color: "#2E96EF" }]}>যাচাই</ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={[styles.timelineDate, { color: theme.textSecondary }]}>
              {point.date}
            </ThemedText>
            <View style={styles.timelineDetails}>
              <View style={styles.detailRow}>
                <Feather name="map-pin" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  {point.location}
                </ThemedText>
              </View>
              <View style={styles.detailRow}>
                <Feather name="user" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  {point.handler}
                </ThemedText>
              </View>
              {point.temperature ? (
                <View style={styles.detailRow}>
                  <Feather name="thermometer" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                    {point.temperature}°C
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );

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
            colors={["#00875A", "#004D40"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <View style={styles.headerIcon}>
              <Feather name="box" size={28} color="#FFF" />
            </View>
            <View style={styles.headerContent}>
              <ThemedText style={styles.headerTitle}>পণ্য ট্রেসেবিলিটি</ThemedText>
              <ThemedText style={styles.headerSubtitle}>
                QR কোড স্ক্যান করে পণ্যের উৎস জানুন
              </ThemedText>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)}>
          <View style={[styles.searchCard, { backgroundColor: theme.card }]}>
            <ThemedText style={styles.sectionTitle}>পণ্য খুঁজুন</ThemedText>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder="পণ্য আইডি বা ব্যাচ নম্বর"
                placeholderTextColor={theme.textSecondary}
                value={searchCode}
                onChangeText={setSearchCode}
              />
              <Pressable
                style={[styles.searchButton, { backgroundColor: theme.primary }]}
                onPress={handleSearch}
              >
                <Feather name="search" size={20} color="#FFF" />
              </Pressable>
            </View>
            <View style={styles.scanSection}>
              <Pressable style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="camera" size={24} color={theme.primary} />
                <ThemedText style={[styles.scanButtonText, { color: theme.primary }]}>
                  QR কোড স্ক্যান করুন
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)}>
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: "#2E96EF" }]}
              onPress={() => setShowCreateModal(true)}
            >
              <Feather name="plus" size={20} color="#FFF" />
              <ThemedText style={styles.actionButtonText}>নতুন পণ্য</ThemedText>
            </Pressable>
            <Pressable style={[styles.actionButton, { backgroundColor: "#2E96EF" }]}>
              <Feather name="download" size={20} color="#FFF" />
              <ThemedText style={styles.actionButtonText}>QR ডাউনলোড</ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300)}>
          <View style={[styles.productsCard, { backgroundColor: theme.card }]}>
            <ThemedText style={styles.sectionTitle}>আমার পণ্যসমূহ</ThemedText>

            {products.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {products.map((product, index) => (
              <Animated.View key={product.id} entering={SlideInRight.delay(index * 60)}>
                <Pressable
                  style={[styles.productCard, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => {
                    setSelectedProduct(product);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={[styles.productIcon, { backgroundColor: product.organic ? "#2E96EF" + "20" : theme.primary + "20" }]}>
                    <Feather name="box" size={24} color={product.organic ? "#2E96EF" : theme.primary} />
                  </View>
                  <View style={styles.productInfo}>
                    <View style={styles.productHeader}>
                      <ThemedText style={styles.productName}>{product.name}</ThemedText>
                      {product.organic && (
                        <View style={[styles.organicBadge, { backgroundColor: "#2E96EF" + "20" }]}>
                          <ThemedText style={[styles.organicText, { color: "#2E96EF" }]}>জৈব</ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={[styles.productId, { color: theme.textSecondary }]}>
                      {product.id} | {product.batchNumber}
                    </ThemedText>
                    <View style={styles.productMeta}>
                      <View style={styles.metaItem}>
                        <Feather name="calendar" size={12} color={theme.textSecondary} />
                        <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                          {product.productionDate}
                        </ThemedText>
                      </View>
                      <View style={styles.metaItem}>
                        <Feather name="map-pin" size={12} color={theme.textSecondary} />
                        <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                          {product.farmer.location}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400)}>
          <View style={[styles.benefitsCard, { backgroundColor: theme.card }]}>
            <ThemedText style={styles.sectionTitle}>ট্রেসেবিলিটির সুবিধা</ThemedText>
            <View style={styles.benefitsList}>
              {[
                { icon: "shield" as const, title: "বিশ্বাসযোগ্যতা", desc: "ক্রেতারা পণ্যের উৎস জানতে পারে" },
                { icon: "trending-up" as const, title: "বেশি দাম", desc: "স্বচ্ছতার কারণে ভালো দাম পাওয়া যায়" },
                { icon: "award" as const, title: "সার্টিফিকেশন", desc: "জৈব ও মান সার্টিফিকেট প্রদর্শন" },
                { icon: "users" as const, title: "গ্রাহক আস্থা", desc: "সরাসরি কৃষক থেকে ক্রেতা সম্পর্ক" },
              ].map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={[styles.benefitIcon, { backgroundColor: theme.primary + "15" }]}>
                    <AppIcon name={benefit.icon} size={20} color={theme.primary} />
                  </View>
                  <View style={styles.benefitContent}>
                    <ThemedText style={styles.benefitTitle}>{benefit.title}</ThemedText>
                    <ThemedText style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                      {benefit.desc}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal visible={selectedProduct !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{selectedProduct?.name}</ThemedText>
              <Pressable onPress={() => setSelectedProduct(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedProduct && (
                <>
                  <View style={[styles.productDetailsCard, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={styles.detailsGrid}>
                      <View style={styles.gridItem}>
                        <ThemedText style={[styles.gridLabel, { color: theme.textSecondary }]}>পণ্য আইডি</ThemedText>
                        <ThemedText style={styles.gridValue}>{selectedProduct.id}</ThemedText>
                      </View>
                      <View style={styles.gridItem}>
                        <ThemedText style={[styles.gridLabel, { color: theme.textSecondary }]}>ব্যাচ নম্বর</ThemedText>
                        <ThemedText style={styles.gridValue}>{selectedProduct.batchNumber}</ThemedText>
                      </View>
                      <View style={styles.gridItem}>
                        <ThemedText style={[styles.gridLabel, { color: theme.textSecondary }]}>উৎপাদন</ThemedText>
                        <ThemedText style={styles.gridValue}>{selectedProduct.productionDate}</ThemedText>
                      </View>
                      <View style={styles.gridItem}>
                        <ThemedText style={[styles.gridLabel, { color: theme.textSecondary }]}>মেয়াদ</ThemedText>
                        <ThemedText style={styles.gridValue}>{selectedProduct.expiryDate || "-"}</ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.farmerCard, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={styles.farmerHeader}>
                      <View style={[styles.farmerAvatar, { backgroundColor: theme.primary + "20" }]}>
                        <Feather name="user" size={24} color={theme.primary} />
                      </View>
                      <View style={styles.farmerInfo}>
                        <View style={styles.farmerNameRow}>
                          <ThemedText style={styles.farmerName}>{selectedProduct.farmer.name}</ThemedText>
                          {selectedProduct.farmer.verified && (
                            <Feather name="check-circle" size={14} color="#2E96EF" style={{ marginLeft: 4 }} />
                          )}
                        </View>
                        <ThemedText style={[styles.farmName, { color: theme.textSecondary }]}>
                          {selectedProduct.farmer.farmName}
                        </ThemedText>
                        <ThemedText style={[styles.farmLocation, { color: theme.textSecondary }]}>
                          {selectedProduct.farmer.location}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  {selectedProduct.certifications.length > 0 && (
                    <View style={styles.certificationsSection}>
                      <ThemedText style={styles.subSectionTitle}>সার্টিফিকেশন</ThemedText>
                      <View style={styles.certificationsList}>
                        {selectedProduct.certifications.map((cert, index) => (
                          <View key={index} style={[styles.certBadge, { backgroundColor: "#2E96EF" + "15" }]}>
                            <Feather name="award" size={12} color="#2E96EF" />
                            <ThemedText style={[styles.certText, { color: "#2E96EF" }]}>{cert}</ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.journeySection}>
                    <ThemedText style={styles.subSectionTitle}>পণ্যের যাত্রা</ThemedText>
                    {renderJourneyTimeline(selectedProduct.journey)}
                  </View>
                </>
              )}
            </ScrollView>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>নতুন পণ্য যোগ করুন</ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>পণ্যের নাম</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="যেমন: আমন ধান"
                  placeholderTextColor={theme.textSecondary}
                  value={newProduct.name}
                  onChangeText={(text) => setNewProduct((prev) => ({ ...prev, name: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>ক্যাটাগরি</ThemedText>
                <View style={styles.categoryButtons}>
                  {[
                    { id: "vegetables", label: "সবজি" },
                    { id: "fruit", label: "ফল" },
                    { id: "rice", label: "চাল" },
                    { id: "fish", label: "মাছ" },
                  ].map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.categoryButton,
                        { backgroundColor: newProduct.category === cat.id ? theme.primary : theme.backgroundSecondary },
                      ]}
                      onPress={() => setNewProduct((prev) => ({ ...prev, category: cat.id }))}
                    >
                      <ThemedText
                        style={[
                          styles.categoryButtonText,
                          { color: newProduct.category === cat.id ? "#FFF" : theme.text },
                        ]}
                      >
                        {cat.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>উৎপাদন স্থান</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="যেমন: রাজশাহী"
                  placeholderTextColor={theme.textSecondary}
                  value={newProduct.location}
                  onChangeText={(text) => setNewProduct((prev) => ({ ...prev, location: text }))}
                />
              </View>

              <Pressable
                style={[styles.organicToggle, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => setNewProduct((prev) => ({ ...prev, organic: !prev.organic }))}
              >
                <View style={styles.organicToggleContent}>
                  <Feather name="check-circle" size={20} color="#2E96EF" />
                  <ThemedText style={styles.organicToggleText}>জৈব পণ্য</ThemedText>
                </View>
                <View
                  style={[
                    styles.toggle,
                    { backgroundColor: newProduct.organic ? "#2E96EF" : theme.inputBorder },
                  ]}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      { transform: [{ translateX: newProduct.organic ? 20 : 0 }] },
                    ]}
                  />
                </View>
              </Pressable>
            </ScrollView>

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleCreateProduct}
            >
              <Feather name="check" size={20} color="#FFF" />
              <ThemedText style={styles.saveButtonText}>পণ্য তৈরি করুন</ThemedText>
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
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  searchCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  searchRow: {
    flexDirection: "row",
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  scanSection: {
    marginTop: Spacing.md,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  productsCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: Spacing.sm,
  },
  organicBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  organicText: {
    fontSize: 10,
    fontWeight: "600",
  },
  productId: {
    fontSize: 12,
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: "row",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  metaText: {
    fontSize: 11,
    marginLeft: 4,
  },
  benefitsCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  benefitsList: {},
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  benefitDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
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
  productDetailsCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    width: "50%",
    paddingVertical: Spacing.xs,
  },
  gridLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  farmerCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  farmerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  farmerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  farmerInfo: {
    flex: 1,
  },
  farmerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  farmerName: {
    fontSize: 15,
    fontWeight: "600",
  },
  farmName: {
    fontSize: 13,
    marginTop: 2,
  },
  farmLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  certificationsSection: {
    marginBottom: Spacing.md,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  certificationsList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  certBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    marginBottom: 6,
  },
  certText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  journeySection: {
    marginTop: Spacing.sm,
  },
  timeline: {},
  timelineItem: {
    flexDirection: "row",
  },
  timelineLeft: {
    alignItems: "center",
    width: 30,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginLeft: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  stageName: {
    fontSize: 14,
    fontWeight: "600",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: "500",
    marginLeft: 2,
  },
  timelineDate: {
    fontSize: 11,
    marginBottom: 6,
  },
  timelineDetails: {},
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    marginLeft: 6,
  },
  inputGroup: {
    marginBottom: Spacing.md,
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
  categoryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  organicToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  organicToggleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  organicToggleText: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: Spacing.sm,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF",
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
