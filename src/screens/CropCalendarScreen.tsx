import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@/components/icons/Feather';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

import { AppIcon } from "@/components/icons/AppIcon";
const MONTHS = ['বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'];
const ENGLISH_MONTHS = ['এপ্রিল-মে', 'মে-জুন', 'জুন-জুলাই', 'জুলাই-আগস্ট', 'আগস্ট-সেপ্টে', 'সেপ্টে-অক্টো', 'অক্টো-নভে', 'নভে-ডিসে', 'ডিসে-জানু', 'জানু-ফেব্রু', 'ফেব্রু-মার্চ', 'মার্চ-এপ্রিল'];

const SEASONS = [
  { id: 'kharif1', name: 'খরিফ-১', months: [0, 1, 2, 3], color: '#00BB77' },
  { id: 'kharif2', name: 'খরিফ-২', months: [4, 5, 6, 7], color: '#2E96EF' },
  { id: 'rabi', name: 'রবি', months: [8, 9, 10, 11], color: '#B25E09' },
];

const CROPS = [
  {
    id: 'aus',
    name: 'আউশ ধান',
    category: 'ধান',
    plantingMonths: [0, 1],
    harvestMonths: [3, 4],
    color: '#00BB77',
    tips: 'বৈশাখ-জ্যৈষ্ঠ মাসে বপন, শ্রাবণ-ভাদ্র মাসে ফসল তোলা',
  },
  {
    id: 'aman',
    name: 'আমন ধান',
    category: 'ধান',
    plantingMonths: [2, 3],
    harvestMonths: [6, 7],
    color: '#2E96EF',
    tips: 'আষাঢ়-শ্রাবণে চারা রোপণ, কার্তিক-অগ্রহায়ণে কাটা',
  },
  {
    id: 'boro',
    name: 'বোরো ধান',
    category: 'ধান',
    plantingMonths: [8, 9],
    harvestMonths: [11, 0],
    color: '#3D38D0',
    tips: 'পৌষ-মাঘে রোপণ, চৈত্র-বৈশাখে ফসল তোলা',
  },
  {
    id: 'wheat',
    name: 'গম',
    category: 'শস্য',
    plantingMonths: [7, 8],
    harvestMonths: [10, 11],
    color: '#B25E09',
    tips: 'অগ্রহায়ণ-পৌষে বপন, ফাল্গুন-চৈত্রে ফসল',
  },
  {
    id: 'potato',
    name: 'আলু',
    category: 'সবজি',
    plantingMonths: [6, 7],
    harvestMonths: [9, 10],
    color: '#FF4BB7',
    tips: 'কার্তিক-অগ্রহায়ণে রোপণ, মাঘ-ফাল্গুনে তোলা',
  },
  {
    id: 'jute',
    name: 'পাট',
    category: 'আঁশ',
    plantingMonths: [11, 0],
    harvestMonths: [3, 4],
    color: '#00BB77',
    tips: 'চৈত্র-বৈশাখে বপন, শ্রাবণ-ভাদ্রে কাটা',
  },
  {
    id: 'mustard',
    name: 'সরিষা',
    category: 'তেল',
    plantingMonths: [6, 7],
    harvestMonths: [9, 10],
    color: '#EAB308',
    tips: 'কার্তিক-অগ্রহায়ণে বপন, মাঘ-ফাল্গুনে ফসল',
  },
  {
    id: 'onion',
    name: 'পেঁয়াজ',
    category: 'সবজি',
    plantingMonths: [7, 8],
    harvestMonths: [11, 0],
    color: '#DA2F2F',
    tips: 'অগ্রহায়ণ-পৌষে রোপণ, চৈত্র-বৈশাখে তোলা',
  },
  {
    id: 'garlic',
    name: 'রসুন',
    category: 'সবজি',
    plantingMonths: [6, 7],
    harvestMonths: [10, 11],
    color: '#B25E09',
    tips: 'কার্তিক-অগ্রহায়ণে রোপণ, ফাল্গুন-চৈত্রে তোলা',
  },
  {
    id: 'tomato',
    name: 'টমেটো',
    category: 'সবজি',
    plantingMonths: [5, 6],
    harvestMonths: [8, 9, 10],
    color: '#DA2F2F',
    tips: 'আশ্বিন-কার্তিকে চারা রোপণ, পৌষ থেকে ফল তোলা',
  },
  {
    id: 'sugarcane',
    name: 'আখ',
    category: 'শস্য',
    plantingMonths: [9, 10],
    harvestMonths: [7, 8, 9],
    color: '#84CC16',
    tips: 'মাঘ-ফাল্গুনে রোপণ, পরের বছর শ্রাবণ-আশ্বিনে কাটা',
  },
];

const CATEGORIES = ['সব', 'ধান', 'শস্য', 'সবজি', 'তেল', 'আঁশ'];

export default function CropCalendarScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [selectedCategory, setSelectedCategory] = useState('সব');
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);

  const filteredCrops = selectedCategory === 'সব' 
    ? CROPS 
    : CROPS.filter(c => c.category === selectedCategory);

  const getCurrentBanglaMonth = () => {
    const now = new Date();
    const month = now.getMonth();
    const monthMap: Record<number, number> = {
      3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 0: 9, 1: 10, 2: 11
    };
    return monthMap[month] ?? 0;
  };

  const currentMonth = getCurrentBanglaMonth();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    content: {
      paddingTop: Spacing.md,
      paddingBottom: insets.bottom + Spacing.xl,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: Typography.sizes.xl,
      fontWeight: '700',
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
    },
    currentMonthCard: {
      marginHorizontal: Spacing.lg,
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    currentMonthLabel: {
      fontSize: Typography.sizes.sm,
      color: 'rgba(255,255,255,0.8)',
      marginBottom: Spacing.xs,
    },
    currentMonthName: {
      fontSize: 28,
      fontWeight: '700',
      color: '#fff',
    },
    currentMonthEnglish: {
      fontSize: Typography.sizes.sm,
      color: 'rgba(255,255,255,0.7)',
      marginTop: Spacing.xs,
    },
    categoryScroll: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    categoryChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.card,
      marginRight: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    categoryChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    categoryChipText: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
    },
    categoryChipTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    cropsList: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
    cropCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    cropHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      gap: Spacing.md,
    },
    cropIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cropInfo: {
      flex: 1,
    },
    cropName: {
      fontSize: Typography.sizes.md,
      fontWeight: '600',
      color: theme.text,
    },
    cropCategory: {
      fontSize: Typography.sizes.xs,
      color: theme.textSecondary,
    },
    cropMonths: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
    },
    monthsRow: {
      flexDirection: 'row',
      gap: 2,
    },
    monthCell: {
      flex: 1,
      height: 8,
      backgroundColor: theme.surface,
      borderRadius: 2,
    },
    monthCellPlanting: {
      backgroundColor: '#00BB77',
    },
    monthCellHarvest: {
      backgroundColor: '#B25E09',
    },
    monthCellCurrent: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    cropExpanded: {
      backgroundColor: theme.surface,
      padding: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.cardBorder,
    },
    tipText: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    legendRow: {
      flexDirection: 'row',
      gap: Spacing.lg,
      marginTop: Spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendText: {
      fontSize: Typography.sizes.xs,
      color: theme.textSecondary,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>ফসল ক্যালেন্ডার</Text>
        <Text style={styles.subtitle}>বাংলাদেশের ঋতু অনুযায়ী ফসল চাষের সময়সূচি</Text>
      </View>

      <View style={styles.currentMonthCard}>
        <Text style={styles.currentMonthLabel}>এখন চলছে</Text>
        <Text style={styles.currentMonthName}>{MONTHS[currentMonth]}</Text>
        <Text style={styles.currentMonthEnglish}>{ENGLISH_MONTHS[currentMonth]}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipSelected,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextSelected,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.cropsList}>
        {filteredCrops.map(crop => (
          <Pressable
            key={crop.id}
            style={styles.cropCard}
            onPress={() => setExpandedCrop(expandedCrop === crop.id ? null : crop.id)}
          >
            <View style={styles.cropHeader}>
              <View style={[styles.cropIcon, { backgroundColor: crop.color + '20' }]}>
                <Feather name="package" size={20} color={crop.color} />
              </View>
              <View style={styles.cropInfo}>
                <Text style={styles.cropName}>{crop.name}</Text>
                <Text style={styles.cropCategory}>{crop.category}</Text>
              </View>
              <AppIcon 
                name={expandedCrop === crop.id ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={theme.textSecondary} 
              />
            </View>
            
            <View style={styles.cropMonths}>
              <View style={styles.monthsRow}>
                {MONTHS.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.monthCell,
                      crop.plantingMonths.includes(index) && styles.monthCellPlanting,
                      crop.harvestMonths.includes(index) && styles.monthCellHarvest,
                      index === currentMonth && styles.monthCellCurrent,
                    ]}
                  />
                ))}
              </View>
            </View>

            {expandedCrop === crop.id ? (
              <View style={styles.cropExpanded}>
                <Text style={styles.tipText}>{crop.tips}</Text>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#00BB77' }]} />
                    <Text style={styles.legendText}>রোপণ/বপন</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#B25E09' }]} />
                    <Text style={styles.legendText}>ফসল তোলা</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
