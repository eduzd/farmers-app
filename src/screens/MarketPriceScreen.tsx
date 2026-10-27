import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
interface PriceItem {
  id: string;
  name: string;
  icon: string;
  currentPrice: number;
  previousPrice: number;
  unit: string;
  trend: "up" | "down" | "stable";
  priceHistory: number[];
  location: string;
}

const CATEGORIES = ["সব", "শস্য", "সবজি", "মাছ", "ফল", "পশু"];

const PRICE_DATA: PriceItem[] = [];

const { width } = Dimensions.get("window");

function MiniChart({ data, trend, theme }: { data: number[]; trend: string; theme: any }) {
  const chartWidth = 80;
  const chartHeight = 30;
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = chartHeight - ((val - minVal) / range) * chartHeight;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const color = trend === "up" ? "#2E96EF" : trend === "down" ? "#DA2F2F" : theme.textSecondary;

  return (
    <View style={{ width: chartWidth, height: chartHeight }}>
      <View
        style={{
          width: chartWidth,
          height: chartHeight,
          backgroundColor: color + "10",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <View style={{ width: chartWidth, height: chartHeight, position: "relative" }}>
          {points.map((point, index) => (
            <View
              key={index}
              style={{
                position: "absolute",
                left: point.x - 2,
                top: point.y - 2,
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function MarketPriceScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [selectedPeriod, setSelectedPeriod] = useState("সপ্তাহ");

  const periods = ["দিন", "সপ্তাহ", "মাস"];

  const getChangePercentage = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(1);
  };

  const renderPriceCard = (item: PriceItem, index: number) => {
    const changePercent = getChangePercentage(item.currentPrice, item.previousPrice);
    const trendColor =
      item.trend === "up" ? "#2E96EF" : item.trend === "down" ? "#DA2F2F" : theme.textSecondary;

    return (
      <Animated.View
        key={item.id}
        entering={FadeInUp.delay(index * 50).springify()}
      >
        <Pressable
          style={[
            styles.priceCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          <View style={styles.cardLeft}>
            <View style={styles.itemHeader}>
              <ThemedText style={styles.itemIcon}>{item.icon}</ThemedText>
              <View style={styles.itemInfo}>
                <ThemedText style={[styles.itemName, { color: theme.text }]}>
                  {item.name}
                </ThemedText>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={10} color={theme.textSecondary} />
                  <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
                    {item.location}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.priceRow}>
              <ThemedText style={[styles.currentPrice, { color: theme.text }]}>
                ৳{item.currentPrice}
              </ThemedText>
              <ThemedText style={[styles.unitText, { color: theme.textSecondary }]}>
                /{item.unit}
              </ThemedText>
            </View>

            <View style={styles.changeRow}>
              <View
                style={[
                  styles.changeBadge,
                  { backgroundColor: trendColor + "15" },
                ]}
              >
                <AppIcon
                  name={
                    item.trend === "up"
                      ? "trending-up"
                      : item.trend === "down"
                      ? "trending-down"
                      : "minus"
                  }
                  size={12}
                  color={trendColor}
                />
                <ThemedText style={[styles.changeText, { color: trendColor }]}>
                  {item.trend === "stable" ? "স্থিতিশীল" : `${changePercent}%`}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.cardRight}>
            <MiniChart data={item.priceHistory} trend={item.trend} theme={theme} />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
        <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
          আজকের বাজার সারসংক্ষেপ
        </ThemedText>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <View style={[styles.summaryIcon, { backgroundColor: "#2E96EF15" }]}>
              <Feather name="trending-up" size={18} color="#2E96EF" />
            </View>
            <ThemedText style={[styles.summaryValue, { color: "#2E96EF" }]}>
              ৫টি
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              দাম বেড়েছে
            </ThemedText>
          </View>

          <View style={styles.summaryStat}>
            <View style={[styles.summaryIcon, { backgroundColor: "#DA2F2F15" }]}>
              <Feather name="trending-down" size={18} color="#DA2F2F" />
            </View>
            <ThemedText style={[styles.summaryValue, { color: "#DA2F2F" }]}>
              ২টি
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              দাম কমেছে
            </ThemedText>
          </View>

          <View style={styles.summaryStat}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.inputBorder }]}>
              <Feather name="minus" size={18} color={theme.textSecondary} />
            </View>
            <ThemedText style={[styles.summaryValue, { color: theme.textSecondary }]}>
              ২টি
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              স্থিতিশীল
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.filtersRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    selectedCategory === cat ? theme.primary : theme.backgroundRoot,
                  borderColor:
                    selectedCategory === cat ? theme.primary : theme.inputBorder,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCategory(cat);
              }}
            >
              <ThemedText
                style={[
                  styles.categoryChipText,
                  { color: selectedCategory === cat ? theme.buttonText : theme.text },
                ]}
              >
                {cat}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.periodRow}>
        {periods.map((period) => (
          <Pressable
            key={period}
            style={[
              styles.periodChip,
              {
                backgroundColor:
                  selectedPeriod === period ? theme.primary + "15" : "transparent",
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedPeriod(period);
            }}
          >
            <ThemedText
              style={[
                styles.periodText,
                { color: selectedPeriod === period ? theme.primary : theme.textSecondary },
              ]}
            >
              {period}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.priceList}>
        {PRICE_DATA.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
        {PRICE_DATA.map((item, index) => renderPriceCard(item, index))}
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
        <Feather name="info" size={16} color={theme.primary} />
        <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
          দামগুলো স্থানীয় বাজার থেকে সংগৃহীত এবং প্রতিদিন আপডেট হয়।
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryStat: {
    alignItems: "center",
    flex: 1,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  filtersRow: {
    marginBottom: Spacing.md,
  },
  categoriesScroll: {
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  periodRow: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  periodChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  periodText: {
    fontSize: 13,
    fontWeight: "500",
  },
  priceList: {
    gap: Spacing.sm,
  },
  priceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  cardLeft: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  itemIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.xs,
  },
  currentPrice: {
    fontSize: 22,
    fontWeight: "700",
  },
  unitText: {
    fontSize: 13,
    marginLeft: 2,
  },
  changeRow: {
    flexDirection: "row",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardRight: {
    marginLeft: Spacing.md,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
