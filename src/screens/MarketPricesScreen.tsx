import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

import { tr, useTr } from "@/lib/tr";
const { width } = Dimensions.get('window');

interface CropPrice {
  id: string;
  name: string;
  nameBn: string;
  category: string;
  currentPrice: number;
  previousPrice: number;
  unit: string;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  priceHistory: number[];
  markets: Array<{
    name: string;
    price: number;
  }>;
}

const CATEGORIES = [
  { id: 'all', name: 'সব', icon: 'grid' },
  { id: 'vegetables', name: 'সবজি', icon: 'leaf' },
  { id: 'fruits', name: 'ফল', icon: 'sun' },
  { id: 'grains', name: 'শস্য', icon: 'box' },
  { id: 'fish', name: 'মাছ', icon: 'droplet' },
];

const MOCK_PRICES: CropPrice[] = [];

export default function MarketPricesScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [prices, setPrices] = useState<CropPrice[]>(MOCK_PRICES);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrice, setSelectedPrice] = useState<CropPrice | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredPrices = prices.filter((price) => {
    const matchesCategory = selectedCategory === 'all' || price.category === selectedCategory;
    const matchesSearch = price.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      price.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleCategoryPress = async (categoryId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(categoryId);
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return '#16A34A';
      case 'down':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  const getTrendIcon = (trend: string): keyof typeof Feather.glyphMap => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'minus';
    }
  };

  const renderMiniChart = (priceHistory: number[], trend: string) => {
    const max = Math.max(...priceHistory);
    const min = Math.min(...priceHistory);
    const range = max - min || 1;
    const color = getTrendColor(trend);

    return (
      <View style={styles.miniChart}>
        {priceHistory.map((price, index) => {
          const height = ((price - min) / range) * 30 + 5;
          return (
            <View
              key={index}
              style={[
                styles.chartBar,
                {
                  height,
                  backgroundColor: index === priceHistory.length - 1 ? color : color + '40',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.backgroundRoot }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={tr("ফসল বা মাছ খুঁজুন...")}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => handleCategoryPress(category.id)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    selectedCategory === category.id ? '#16A34A' : theme.backgroundRoot,
                },
              ]}
            >
              <Feather
                name={category.icon as any}
                size={14}
                color={selectedCategory === category.id ? '#fff' : theme.text}
              />
              <ThemedText
                style={[
                  styles.categoryText,
                  { color: selectedCategory === category.id ? '#fff' : theme.text },
                ]}
              >
                {category.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.summaryCards}>
          <LinearGradient
            colors={['#16A34A', '#059669']}
            style={styles.summaryCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Feather name="trending-up" size={24} color="#fff" />
            <ThemedText style={styles.summaryValue}>{tr("৫")}</ThemedText>
            <ThemedText style={styles.summaryLabel}>{tr("দাম বেড়েছে")}</ThemedText>
          </LinearGradient>

          <LinearGradient
            colors={['#DC2626', '#DC2626']}
            style={styles.summaryCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Feather name="trending-down" size={24} color="#fff" />
            <ThemedText style={styles.summaryValue}>{tr("২")}</ThemedText>
            <ThemedText style={styles.summaryLabel}>{tr("দাম কমেছে")}</ThemedText>
          </LinearGradient>

          <LinearGradient
            colors={['#6B7280', '#4B5563']}
            style={styles.summaryCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Feather name="minus" size={24} color="#fff" />
            <ThemedText style={styles.summaryValue}>{tr("১")}</ThemedText>
            <ThemedText style={styles.summaryLabel}>{tr("স্থিতিশীল")}</ThemedText>
          </LinearGradient>
        </View>

        <ThemedText style={styles.sectionTitle}>{tr("আজকের বাজার দর")}</ThemedText>
        <ThemedText style={[styles.updateTime, { color: theme.textSecondary }]}>
          {tr("সর্বশেষ আপডেট: ১০ মিনিট আগে")}
        </ThemedText>

        {filteredPrices.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSelectedPrice(selectedPrice?.id === item.id ? null : item)}
            style={[styles.priceCard, { backgroundColor: theme.card }]}
          >
            <View style={styles.priceHeader}>
              <View style={styles.priceInfo}>
                <ThemedText style={styles.priceName}>{item.nameBn}</ThemedText>
                <ThemedText style={[styles.priceUnit, { color: theme.textSecondary }]}>
                  প্রতি {item.unit}
                </ThemedText>
              </View>

              {renderMiniChart(item.priceHistory, item.trend)}

              <View style={styles.priceRight}>
                <ThemedText style={styles.currentPrice}>৳{item.currentPrice}</ThemedText>
                <View style={[styles.changeRow, { backgroundColor: getTrendColor(item.trend) + '15' }]}>
                  <Feather
                    name={getTrendIcon(item.trend)}
                    size={12}
                    color={getTrendColor(item.trend)}
                  />
                  <ThemedText style={[styles.changeText, { color: getTrendColor(item.trend) }]}>
                    {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                  </ThemedText>
                </View>
              </View>
            </View>

            {selectedPrice?.id === item.id && (
              <View style={[styles.priceDetails, { borderTopColor: theme.inputBorder }]}>
                <ThemedText style={styles.detailsTitle}>{tr("বাজার ভিত্তিক দাম")}</ThemedText>
                {item.markets.map((market, index) => (
                  <View key={index} style={styles.marketRow}>
                    <Feather name="map-pin" size={14} color={theme.textSecondary} />
                    <ThemedText style={[styles.marketName, { color: theme.textSecondary }]}>
                      {market.name}
                    </ThemedText>
                    <ThemedText style={styles.marketPrice}>৳{market.price}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        ))}

        {filteredPrices.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {tr("কোনো ফলাফল পাওয়া যায়নি")}
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  categoriesScroll: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  summaryLabel: {
    color: '#fff',
    fontSize: 11,
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  updateTime: {
    fontSize: 12,
    marginBottom: Spacing.md,
  },
  priceCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  priceInfo: {
    flex: 1,
  },
  priceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  priceUnit: {
    fontSize: 12,
    marginTop: 2,
  },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 35,
    gap: 3,
  },
  chartBar: {
    width: 4,
    borderRadius: 2,
  },
  priceRight: {
    alignItems: 'flex-end',
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 2,
    marginTop: 4,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  priceDetails: {
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  detailsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  marketName: {
    flex: 1,
    fontSize: 13,
  },
  marketPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.md,
  },
});
