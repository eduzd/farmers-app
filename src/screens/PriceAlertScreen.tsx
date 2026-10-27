import React, { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CatalogFormModal } from "@/components/CatalogFormModal";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { TextInput } from "@/components/MayaText";
import { CustomSwitch } from "@/components/CustomSwitch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { useHeaderAddButton } from "@/components/HeaderAddButton";
import { apiGet, apiPost, apiPut, apiDelete, isLoggedIn } from "@/lib/api";
import { tr, useTr } from "@/lib/tr";
import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
const MY_ALERTS: any[] = [];

const POPULAR_PRODUCTS: any[] = [];

export default function PriceAlertScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [alerts, setAlerts] = useState<typeof MY_ALERTS>([]);
  const server = isLoggedIn();
  const unitOf = (name: string) => {
    const p = POPULAR_PRODUCTS.find((x) => x.name === name);
    const m = p ? String(p.currentPrice).match(/\/(.+)$/) : null;
    return m ? m[1] : "";
  };
  const loadServer = async () => {
    // compare alerts with today's prices; matching alerts become notifications on the server
    const prices: Record<string, number> = {};
    for (const p of POPULAR_PRODUCTS) {
      const n = Number(String(p.currentPrice).replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[^0-9.]/g, ""));
      if (n) prices[p.name] = n;
    }
    await apiPost("/api/me/price-alerts/check", { prices }).catch(() => {});
    const list: any[] = await apiGet("/api/me/price-alerts");
    setAlerts(
      list.map((a) => ({
        id: a.id,
        product: a.product,
        condition: a.condition === "below" ? "নিচে" : "উপরে",
        price: a.target,
        unit: unitOf(a.product),
        active: a.active,
        triggered: !!a.triggeredAt,
      }))
    );
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [preset, setPreset] = useState<Record<string, any> | null>(null);
  useHeaderAddButton(() => {
    setPreset(null);
    setShowAddModal(true);
  }, "New alert");

  // Logged in: alerts live on the server (and trigger notifications). Guests: kept on the device.
  useEffect(() => {
    if (server) {
      loadServer().catch(() => {});
      return;
    }
    AsyncStorage.getItem("price_alerts").then((raw) => {
      if (raw) {
        try {
          setAlerts(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);
  useEffect(() => {
    if (!server) AsyncStorage.setItem("price_alerts", JSON.stringify(alerts)).catch(() => {});
  }, [alerts]);

  const toggleAlert = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const a0 = alerts.find((a) => a.id === id);
    setAlerts(alerts.map(a => a.id === id ? { ...a, active: !a.active, triggered: false } : a));
    if (server && a0) apiPut(`/api/me/price-alerts/${id}`, { active: !a0.active }).then(loadServer).catch(() => {});
  };

  const deleteAlert = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setAlerts(alerts.filter(a => a.id !== id));
    if (server) apiDelete(`/api/me/price-alerts/${id}`).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400)}>
          <LinearGradient
            colors={isDark ? ["#202936", "#202936"] : ["#E3F4FF", "#eff6ff"]}
            style={styles.infoCard}
          >
            <Feather name="bell" size={32} color={isDark ? "#60a5fa" : "#2E96EF"} />
            <View style={styles.infoContent}>
              <ThemedText style={[styles.infoTitle, { color: theme.text }]}>
                {tr("মূল্য সতর্কতা")}
              </ThemedText>
              <ThemedText style={[styles.infoDesc, { color: theme.textSecondary }]}>
                {tr("পণ্যের দাম পরিবর্তন হলে তাৎক্ষণিক নোটিফিকেশন পান")}
              </ThemedText>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4" style={{ color: theme.text }}>{tr("আমার সতর্কতা")}</ThemedText>
            <View style={[styles.alertCount, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.alertCountText}>{alerts.filter(a => a.active).length}</ThemedText>
            </View>
          </View>

          {alerts.map((alert, index) => (
            <Animated.View key={alert.id} entering={FadeInUp.delay(index * 60).duration(400)}>
              <View
                style={[
                  styles.alertCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: alert.triggered ? "#00BB77" : theme.cardBorder,
                    borderWidth: alert.triggered ? 2 : 1,
                  },
                ]}
              >
                {alert.triggered ? (
                  <View style={[styles.triggeredBadge, { backgroundColor: "#00BB77" }]}>
                    <Feather name="check" size={12} color="#fff" />
                    <ThemedText style={styles.triggeredText}>সক্রিয়!</ThemedText>
                  </View>
                ) : null}
                
                <View style={styles.alertHeader}>
                  <View style={styles.alertInfo}>
                    <ThemedText style={[styles.alertProduct, { color: theme.text }]}>{alert.product}</ThemedText>
                    <View style={styles.alertCondition}>
                      <AppIcon
                        name={alert.condition === "উপরে" ? "arrow-up" : "arrow-down"}
                        size={14}
                        color={alert.condition === "উপরে" ? "#00BB77" : "#DA2F2F"}
                      />
                      <ThemedText style={[styles.alertConditionText, { color: theme.textSecondary }]}>
                        ৳{alert.price}/{alert.unit} {alert.condition}
                      </ThemedText>
                    </View>
                  </View>
                  <CustomSwitch
                    value={alert.active}
                    onValueChange={() => toggleAlert(alert.id)}
                  />
                </View>
                
                <View style={styles.alertActions}>
                  <Pressable style={[styles.editButton, { backgroundColor: theme.primary + "15" }]}>
                    <Feather name="edit-2" size={16} color={theme.primary} />
                    <ThemedText style={[styles.editText, { color: theme.primary }]}>সম্পাদনা</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.deleteButton, { backgroundColor: "#DA2F2F15" }]}
                    onPress={() => deleteAlert(alert.id)}
                  >
                    <Feather name="trash-2" size={16} color="#DA2F2F" />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            জনপ্রিয় পণ্যের বর্তমান দাম
          </ThemedText>
          
          <View style={[styles.pricesCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {POPULAR_PRODUCTS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {POPULAR_PRODUCTS.map((product, index) => (
              <View
                key={index}
                style={[
                  styles.priceRow,
                  index < POPULAR_PRODUCTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
                ]}
              >
                <ThemedText style={[styles.productName, { color: theme.text }]}>{product.name}</ThemedText>
                <ThemedText style={[styles.productPrice, { color: theme.text }]}>{product.currentPrice}</ThemedText>
                <View
                  style={[
                    styles.trendBadge,
                    {
                      backgroundColor:
                        product.trend === "up" ? "#00BB7720" : product.trend === "down" ? "#DA2F2F20" : "#71717a20",
                    },
                  ]}
                >
                  <AppIcon
                    name={product.trend === "up" ? "trending-up" : product.trend === "down" ? "trending-down" : "minus"}
                    size={12}
                    color={product.trend === "up" ? "#00BB77" : product.trend === "down" ? "#DA2F2F" : "#71717a"}
                  />
                  <ThemedText
                    style={[
                      styles.trendText,
                      {
                        color: product.trend === "up" ? "#00BB77" : product.trend === "down" ? "#DA2F2F" : "#71717a",
                      },
                    ]}
                  >
                    {product.change}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.addAlertBtn, { backgroundColor: theme.primary + "15" }]}
                  accessibilityLabel="Set alert"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const m = String(product.currentPrice).match(/\/(.+)$/);
                    setPreset({ product: product.name, unit: m ? m[1] : "কেজি", condition: "উপরে" });
                    setShowAddModal(true);
                  }}
                >
                  <Feather name="bell" size={16} color={theme.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <CatalogFormModal
        visible={showAddModal}
        title={tr("নতুন সতর্কতা")}
        initial={preset}
        fields={[
          { key: "product", label: tr("পণ্য"), required: true },
          { key: "condition", label: tr("শর্ত (উপরে / নিচে)"), placeholder: "উপরে" },
          { key: "price", label: tr("দাম (টাকা)"), numeric: true, required: true },
          { key: "unit", label: tr("একক"), placeholder: "কেজি" },
        ]}
        submitLabel={tr("সংরক্ষণ করুন")}
        onClose={() => setShowAddModal(false)}
        onSubmit={async (v) => {
          const cond = /নিচ|below|down/i.test(String(v.condition)) ? "নিচে" : "উপরে";
          if (server) {
            try {
              await apiPost("/api/me/price-alerts", { product: v.product, condition: cond === "নিচে" ? "below" : "above", target: Number(v.price) });
              await loadServer();
              setShowAddModal(false);
            } catch (e: any) {
              return e.message;
            }
            return;
          }
          setAlerts((prev: any[]) => [
            { id: String(Date.now()), product: v.product, condition: cond, price: Number(v.price) || 0, unit: v.unit || "কেজি", active: true, triggered: false },
            ...prev,
          ]);
          setShowAddModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  infoDesc: { fontSize: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  alertCount: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  alertCountText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  alertCard: { borderRadius: BorderRadius.xl, padding: Spacing.md, marginBottom: Spacing.sm, position: "relative" },
  triggeredBadge: {
    position: "absolute",
    top: -8,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  triggeredText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  alertHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alertInfo: { flex: 1 },
  alertProduct: { fontSize: 16, fontWeight: "600" },
  alertCondition: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  alertConditionText: { fontSize: 14 },
  alertActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  editText: { fontSize: 14, fontWeight: "500" },
  deleteButton: { width: 44, height: 44, borderRadius: BorderRadius.lg, alignItems: "center", justifyContent: "center" },
  sectionTitle: { marginTop: Spacing.md, marginBottom: Spacing.md },
  pricesCard: { borderRadius: BorderRadius.xl, borderWidth: 1, overflow: "hidden" },
  priceRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.sm },
  productName: { flex: 1, fontSize: 14, fontWeight: "500" },
  productPrice: { fontSize: 14, fontWeight: "600" },
  trendBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.md, gap: 4 },
  trendText: { fontSize: 12, fontWeight: "600" },
  addAlertBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute",
    bottom: 100,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
