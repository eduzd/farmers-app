import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

import { tr, useTr } from "@/lib/tr";
const ANIMAL_TYPES = [
  {
    id: 'fish_carp',
    name: 'রুই/কাতলা',
    category: 'মাছ',
    icon: 'droplet',
    feedRate: 3,
    fcr: 1.8,
    tips: 'দৈনিক দেহের ওজনের ৩% খাবার দিন। সকাল ও বিকেলে সমান ভাগে।',
  },
  {
    id: 'fish_tilapia',
    name: 'তেলাপিয়া',
    category: 'মাছ',
    icon: 'droplet',
    feedRate: 5,
    fcr: 1.5,
    tips: 'দৈনিক দেহের ওজনের ৫% খাবার দিন। ছোট অবস্থায় ৮-১০%।',
  },
  {
    id: 'fish_pangasius',
    name: 'পাঙ্গাশ',
    category: 'মাছ',
    icon: 'droplet',
    feedRate: 4,
    fcr: 1.6,
    tips: 'দৈনিক দেহের ওজনের ৪% খাবার দিন। ভাসমান খাবার ব্যবহার করুন।',
  },
  {
    id: 'fish_shrimp',
    name: 'চিংড়ি',
    category: 'মাছ',
    icon: 'droplet',
    feedRate: 4,
    fcr: 2.0,
    tips: 'দৈনিক দেহের ওজনের ৪% খাবার দিন। রাতে বেশি খায়।',
  },
  {
    id: 'poultry_broiler',
    name: 'ব্রয়লার মুরগি',
    category: 'পোল্ট্রি',
    icon: 'feather',
    feedRate: 100,
    fcr: 1.7,
    tips: 'প্রতি ১০০০ মুরগির জন্য দৈনিক প্রায় ১০০ কেজি খাবার।',
  },
  {
    id: 'poultry_layer',
    name: 'লেয়ার মুরগি',
    category: 'পোল্ট্রি',
    icon: 'feather',
    feedRate: 115,
    fcr: 2.2,
    tips: 'প্রতি মুরগি দৈনিক ১১০-১২০ গ্রাম খাবার প্রয়োজন।',
  },
  {
    id: 'cattle_dairy',
    name: 'দুধাল গরু',
    category: 'গবাদি',
    icon: 'box',
    feedRate: 3,
    fcr: 0,
    tips: 'দেহের ওজনের ৩% শুষ্ক খাবার + ২ কেজি দানাদার প্রতি লিটার দুধের জন্য।',
  },
  {
    id: 'cattle_beef',
    name: 'মাংসল গরু',
    category: 'গবাদি',
    icon: 'box',
    feedRate: 2.5,
    fcr: 8,
    tips: 'দেহের ওজনের ২.৫% শুষ্ক খাবার। ঘাস + দানাদার মিশ্রণ।',
  },
  {
    id: 'goat',
    name: 'ছাগল',
    category: 'গবাদি',
    icon: 'triangle',
    feedRate: 4,
    fcr: 6,
    tips: 'দেহের ওজনের ৪% খাবার। ঘাস, খড় ও দানাদার মিশ্রণ।',
  },
  {
    id: 'duck',
    name: 'হাঁস',
    category: 'পোল্ট্রি',
    icon: 'feather',
    feedRate: 150,
    fcr: 2.8,
    tips: 'প্রতি হাঁস দৈনিক ১৫০ গ্রাম খাবার + পানিতে চারণ।',
  },
];

const CATEGORIES = ['সব', 'মাছ', 'পোল্ট্রি', 'গবাদি'];

export default function FeedCalculatorScreen() {
  const tr = useTr();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [selectedCategory, setSelectedCategory] = useState('সব');
  const [selectedAnimal, setSelectedAnimal] = useState('fish_carp');
  const [quantity, setQuantity] = useState('');
  const [avgWeight, setAvgWeight] = useState('');
  const [days, setDays] = useState('30');

  const animal = ANIMAL_TYPES.find(a => a.id === selectedAnimal);

  const filteredAnimals = selectedCategory === 'সব'
    ? ANIMAL_TYPES
    : ANIMAL_TYPES.filter(a => a.category === selectedCategory);

  const results = useMemo(() => {
    if (!animal) return null;
    
    const count = parseFloat(quantity) || 0;
    const weight = parseFloat(avgWeight) || 0;
    const totalDays = parseFloat(days) || 30;
    
    if (count === 0) return null;

    let dailyFeed = 0;
    let totalWeight = 0;

    if (animal.category === 'মাছ') {
      totalWeight = count * weight / 1000;
      dailyFeed = totalWeight * (animal.feedRate / 100);
    } else if (animal.category === 'পোল্ট্রি') {
      dailyFeed = (count * animal.feedRate) / 1000;
      totalWeight = count * weight / 1000;
    } else {
      totalWeight = count * weight;
      dailyFeed = totalWeight * (animal.feedRate / 100);
    }

    const totalFeed = dailyFeed * totalDays;
    const feedBags = Math.ceil(totalFeed / 25);

    return {
      dailyFeed,
      totalFeed,
      feedBags,
      totalWeight,
      fcr: animal.fcr,
    };
  }, [animal, quantity, avgWeight, days]);

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
    categoryScroll: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
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
    animalsScroll: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    animalCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginRight: Spacing.sm,
      alignItems: 'center',
      minWidth: 90,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    animalCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '15',
    },
    animalIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    animalName: {
      fontSize: Typography.sizes.xs,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    animalNameSelected: {
      color: theme.primary,
      fontWeight: '600',
    },
    inputSection: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    inputCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    inputRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    inputGroup: {
      flex: 1,
    },
    inputLabel: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
      marginBottom: Spacing.xs,
    },
    textInput: {
      fontSize: Typography.sizes.lg,
      color: theme.text,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
    inputUnit: {
      fontSize: Typography.sizes.xs,
      color: theme.textSecondary,
      marginTop: Spacing.xs,
    },
    resultsSection: {
      paddingHorizontal: Spacing.lg,
    },
    resultsCard: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
    },
    resultsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    resultItem: {
      width: '47%',
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
    },
    resultLabel: {
      fontSize: Typography.sizes.xs,
      color: 'rgba(255,255,255,0.8)',
      marginBottom: Spacing.xs,
    },
    resultValue: {
      fontSize: Typography.sizes.xl,
      fontWeight: '700',
      color: '#fff',
    },
    resultUnit: {
      fontSize: Typography.sizes.sm,
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '400',
    },
    tipCard: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    tipText: {
      flex: 1,
      fontSize: Typography.sizes.sm,
      color: 'rgba(255,255,255,0.9)',
      lineHeight: 20,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{tr("খাদ্য হিসাব")}</Text>
        <Text style={styles.subtitle}>{tr("মাছ, পোল্ট্রি ও গবাদি পশুর খাদ্য পরিমাণ")}</Text>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.animalsScroll}>
        {filteredAnimals.map(a => (
          <Pressable
            key={a.id}
            style={[
              styles.animalCard,
              selectedAnimal === a.id && styles.animalCardSelected,
            ]}
            onPress={() => setSelectedAnimal(a.id)}
          >
            <View style={[styles.animalIcon, { backgroundColor: theme.primary + '20' }]}>
              <Feather name={a.icon as any} size={20} color={theme.primary} />
            </View>
            <Text
              style={[
                styles.animalName,
                selectedAnimal === a.id && styles.animalNameSelected,
              ]}
            >
              {a.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.inputSection}>
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{tr("সংখ্যা")}</Text>
              <TextInput
                style={styles.textInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={styles.inputUnit}>
                {animal?.category === 'মাছ' ? 'পিস' : animal?.category === 'পোল্ট্রি' ? 'মুরগি/হাঁস' : 'মাথা'}
              </Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{tr("গড় ওজন")}</Text>
              <TextInput
                style={styles.textInput}
                value={avgWeight}
                onChangeText={setAvgWeight}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={styles.inputUnit}>
                {animal?.category === 'গবাদি' ? 'কেজি' : 'গ্রাম'}
              </Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{tr("সময়কাল")}</Text>
            <TextInput
              style={styles.textInput}
              value={days}
              onChangeText={setDays}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor={theme.textSecondary}
            />
            <Text style={styles.inputUnit}>{tr("দিন")}</Text>
          </View>
        </View>
      </View>

      {results ? (
        <View style={styles.resultsSection}>
          <View style={styles.resultsCard}>
            <View style={styles.resultsGrid}>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{tr("দৈনিক খাদ্য")}</Text>
                <Text style={styles.resultValue}>
                  {results.dailyFeed.toFixed(1)} <Text style={styles.resultUnit}>{tr("কেজি")}</Text>
                </Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>মোট খাদ্য ({days} দিন)</Text>
                <Text style={styles.resultValue}>
                  {results.totalFeed.toFixed(0)} <Text style={styles.resultUnit}>{tr("কেজি")}</Text>
                </Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{tr("ব্যাগ (২৫ কেজি)")}</Text>
                <Text style={styles.resultValue}>
                  {results.feedBags} <Text style={styles.resultUnit}>{tr("ব্যাগ")}</Text>
                </Text>
              </View>
              {results.fcr > 0 ? (
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>FCR</Text>
                  <Text style={styles.resultValue}>{results.fcr}</Text>
                </View>
              ) : null}
            </View>
            
            {animal ? (
              <View style={styles.tipCard}>
                <Feather name="info" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.tipText}>{animal.tips}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
