import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, TextInput, Text, ScrollView, FlatList, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderButton, useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { saveCalcRecord, getCalcRecords, CalcRecord } from '@/offline/db/records';
import { saveDraft, getDraft, deleteDraft } from '@/offline/db/drafts';
import { getSetting, setSetting } from '@/offline/db/database';
import { Language } from '@/offline/i18n/translations';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
function useColors() {
  const { theme } = useTheme();
  return {
    text: theme.text,
    textSecondary: theme.textSecondary,
    textTertiary: theme.iconSecondary,
    background: theme.backgroundRoot,
    backgroundSecondary: theme.backgroundSecondary,
    card: theme.card,
    border: theme.inputBorder,
    primary: theme.primary,
    error: theme.error,
    success: theme.success,
  };
}

interface RowData {
  weight: string;
  pieces: string;
}

interface BepariSettings {
  base_price_per_kg: number;
  target_avg_weight_kg: number;
  step_grams: number;
  step_price_change: number;
  deduction_per_mon: number;
  kg_per_mon: number;
  alt_threshold_grams: number;
  alt_price_per_kg: number;
  alt_target_weight_kg: number;
}

const defaultSettings: BepariSettings = {
  base_price_per_kg: 300,
  target_avg_weight_kg: 1.5,
  step_grams: 100,
  step_price_change: 5,
  deduction_per_mon: 0,
  kg_per_mon: 40,
  alt_threshold_grams: 300,
  alt_price_per_kg: 250,
  alt_target_weight_kg: 1.0,
};

interface CalculationResult {
  totalWeight: number;
  totalPieces: number;
  avgWeight: number;
  pricePerKg: number;
  pakaWeight: number;
  totalDeduction: number;
  netAmount: number;
  perPiece: number;
  usingAltPrice: boolean;
}

function calculateResults(rows: RowData[], settings: BepariSettings): CalculationResult | null {
  const validRows = rows.filter(r => r.weight && r.pieces);
  if (validRows.length === 0) return null;

  let totalWeight = 0;
  let totalPieces = 0;

  validRows.forEach(row => {
    totalWeight += parseFloat(row.weight) || 0;
    totalPieces += parseInt(row.pieces) || 0;
  });

  if (totalPieces === 0) return null;

  const avgWeight = totalWeight / totalPieces;
  
  const diffFromTarget = Math.abs(avgWeight - settings.target_avg_weight_kg) * 1000;
  const usingAltPrice = diffFromTarget >= settings.alt_threshold_grams;
  
  let pricePerKg: number;
  if (usingAltPrice) {
    const altDiffGrams = (avgWeight - settings.alt_target_weight_kg) * 1000;
    const altSteps = Math.round(altDiffGrams / settings.step_grams);
    pricePerKg = settings.alt_price_per_kg + (altSteps * settings.step_price_change);
  } else {
    const diffGrams = (avgWeight - settings.target_avg_weight_kg) * 1000;
    const steps = Math.round(diffGrams / settings.step_grams);
    pricePerKg = settings.base_price_per_kg + (steps * settings.step_price_change);
  }

  const monCount = totalWeight / settings.kg_per_mon;
  const totalDeduction = monCount * settings.deduction_per_mon;
  const pakaWeight = totalWeight - totalDeduction;

  const netAmount = pakaWeight * pricePerKg;
  const perPiece = netAmount / totalPieces;

  return {
    totalWeight,
    totalPieces,
    avgWeight,
    pricePerKg,
    pakaWeight,
    totalDeduction,
    netAmount,
    perPiece,
    usingAltPrice,
  };
}

interface LocalRecord {
  id: string;
  created_at: number;
  outputs_json: string;
  inputs_json: string;
}

export function BepariCalculatorScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rows, setRows] = useState<RowData[]>([{ weight: '', pieces: '' }]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settings, setSettings] = useState<BepariSettings>(defaultSettings);
  const [savedRecords, setSavedRecords] = useState<CalcRecord[]>([]);
  const [localRecords, setLocalRecords] = useState<LocalRecord[]>([]);
  const [calculationName, setCalculationName] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const scrollViewRef = useRef<any>(null);

  const loadRecords = useCallback(async () => {
    try {
      const records = await getCalcRecords({ recordType: 'BEPARI' });
      setSavedRecords(records);
    } catch {}
  }, []);

  useEffect(() => {
    loadDraft();
    loadSettings();
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      saveDraft('bepari', { rows });
    }, 300);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [rows]);

  
  const loadDraft = async () => {
    const draft = await getDraft('bepari');
    if (draft?.rows?.length > 0) setRows(draft.rows);
  };

  const loadSettings = async () => {
    try {
      const saved = await getSetting('bepari_settings_v3');
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch {}
  };

  const saveSettingsHandler = async (newSettings: BepariSettings) => {
    setSettings(newSettings);
    await setSetting('bepari_settings_v3', JSON.stringify(newSettings));
    setSettingsVisible(false);
  };

  const results = useMemo(() => calculateResults(rows, settings), [rows, settings]);

  const updateRow = (index: number, field: 'weight' | 'pieces', value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    
    // Only add new row when BOTH weight AND pieces have values in the last row
    if (index === rows.length - 1) {
      const lastRow = newRows[index];
      if (lastRow.weight && lastRow.pieces) {
        newRows.push({ weight: '', pieces: '' });
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd?.({ animated: true });
        }, 100);
      }
    }
    setRows(newRows);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      const row = rows[index];
      Alert.alert(
        'ডিলিট করুন?',
        `শাড়ি ${index + 1}: ${row.weight || '0'} কেজি, ${row.pieces || '0'} পিস মুছে ফেলতে চান?`,
        [
          { text: 'বাতিল', style: 'cancel' },
          {
            text: 'ডিলিট',
            style: 'destructive',
            onPress: () => {
              const newRows = rows.filter((_, i) => i !== index);
              if (newRows.every(r => r.weight || r.pieces)) {
                newRows.push({ weight: '', pieces: '' });
              }
              setRows(newRows);
            },
          },
        ]
      );
    }
  };

  const handleSaveCalculation = async () => {
    if (!results) return;
    
    const recordId = editingRecordId || `local-${Date.now()}`;
    const newLocalRecord: LocalRecord = {
      id: recordId,
      created_at: Date.now(),
      outputs_json: JSON.stringify(results),
      inputs_json: JSON.stringify({ rows, settings, name: calculationName }),
    };
    
    if (editingRecordId) {
      setLocalRecords(prev => prev.map(r => r.id === editingRecordId ? newLocalRecord : r));
    } else {
      setLocalRecords(prev => [newLocalRecord, ...prev]);
    }
    
    try {
      await saveCalcRecord('BEPARI', { rows, settings, name: calculationName }, results, { 
        language: lang,
        title: calculationName || undefined,
      });
      loadRecords();
    } catch {}
  };

  const handleNewCalculation = async () => {
    await handleSaveCalculation();
    setRows([{ weight: '', pieces: '' }]);
    setCalculationName('');
    setEditingRecordId(null);
    deleteDraft('bepari').catch(() => {});
  };

  // Set up header buttons
  useLayoutEffect(() => {
    const savedCount = localRecords.length + savedRecords.length;
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          <HeaderButton onPress={handleDownloadPDF}>
            <Feather name="download" size={20} color={results ? colors.primary : colors.textTertiary} />
          </HeaderButton>
          <HeaderButton onPress={() => setDrawerVisible(true)}>
            <View style={styles.badgeContainer}>
              <Feather name="bookmark" size={20} color={colors.textSecondary} />
              {savedCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{savedCount > 9 ? '9+' : savedCount}</Text>
                </View>
              ) : null}
            </View>
          </HeaderButton>
          <HeaderButton onPress={handleNewCalculation}>
            <Feather name="plus" size={22} color={colors.primary} />
          </HeaderButton>
          <HeaderButton onPress={() => setSettingsVisible(true)}>
            <Feather name="settings" size={20} color={colors.textSecondary} />
          </HeaderButton>
        </View>
      ),
    });
  }, [navigation, colors, results, rows, settings, calculationName, localRecords, savedRecords]);

  const loadLocalRecord = (record: LocalRecord) => {
    try {
      const inputs = JSON.parse(record.inputs_json);
      if (inputs.rows && Array.isArray(inputs.rows)) {
        setRows([...inputs.rows, { weight: '', pieces: '' }]);
      }
      if (inputs.settings) {
        setSettings(inputs.settings);
      }
      if (inputs.name) {
        setCalculationName(inputs.name);
      }
      setEditingRecordId(record.id);
      setDrawerVisible(false);
    } catch {}
  };

  const formatNum = (n: number, d = 2) => n.toFixed(d);
  const fmtTaka = (n: number) => `৳${formatNum(n, 0)}`;

  const handleDownloadPDF = async () => {
    if (!results) {
      Alert.alert('তথ্য নেই', 'পিডিএফ তৈরি করতে প্রথমে হিসাব করুন');
      return;
    }

    const validRows = rows.filter(r => r.weight && r.pieces);
    const date = new Date().toLocaleDateString('bn-BD');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #16A34A; text-align: center; margin-bottom: 5px; }
          .date { text-align: center; color: #666; margin-bottom: 20px; }
          .title { text-align: center; font-size: 18px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background-color: #16A34A; color: white; }
          .result-box { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .result-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .result-label { color: #666; }
          .result-value { font-weight: bold; color: #333; }
          .total { font-size: 24px; color: #16A34A; text-align: center; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>{tr("ব্যাপারী হিসাব")}</h1>
        <p class="date">${date}</p>
        ${calculationName ? `<p class="title">${calculationName}</p>` : ''}
        
        <table>
          <tr><th>{tr("ক্রম")}</th><th>{tr("ওজন (কেজি)")}</th><th>{tr("পিস")}</th></tr>
          ${validRows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.weight}</td><td>${r.pieces}</td></tr>`).join('')}
        </table>

        <div class="result-box">
          <div class="result-row"><span class="result-label">{tr("মোট ওজন:")}</span><span class="result-value">${formatNum(results.totalWeight)} কেজি</span></div>
          <div class="result-row"><span class="result-label">{tr("মোট পিস:")}</span><span class="result-value">${results.totalPieces}</span></div>
          <div class="result-row"><span class="result-label">{tr("গড় ওজন:")}</span><span class="result-value">${formatNum(results.avgWeight * 1000, 0)} গ্রাম</span></div>
          <div class="result-row"><span class="result-label">{tr("দর (প্রতি কেজি):")}</span><span class="result-value">${fmtTaka(results.pricePerKg)}</span></div>
          <div class="result-row"><span class="result-label">{tr("পাকা ওজন:")}</span><span class="result-value">${formatNum(results.pakaWeight)} কেজি</span></div>
          <div class="result-row"><span class="result-label">{tr("কাটতি:")}</span><span class="result-value">${formatNum(results.totalDeduction)} কেজি</span></div>
        </div>

        <p class="total">মোট টাকা: ${fmtTaka(results.netAmount)}</p>
        <p style="text-align: center; color: #666;">প্রতি পিস: ${fmtTaka(results.perPiece)}</p>

        <p class="footer">{tr("Farmers App - ব্যাপারী ক্যালকুলেটর")}</p>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS === 'web') {
        Alert.alert('সফল', 'পিডিএফ তৈরি হয়েছে');
      } else {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'পিডিএফ তৈরি করতে সমস্যা হয়েছে');
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const renderSavedRecord = ({ item }: { item: CalcRecord }) => {
    const r = JSON.parse(item.outputs_json) as CalculationResult;
    return (
      <Pressable
        style={[styles.recordCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => navigation.navigate('CalculateRecordDetail', { id: item.id })}
      >
        <View style={styles.recordHeader}>
          <Text style={[styles.recordDate, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
          <Text style={[styles.recordAmount, { color: colors.primary }]}>{fmtTaka(r.netAmount)}</Text>
        </View>
        <View style={styles.recordStats}>
          <Text style={[styles.recordStat, { color: colors.text }]}>{formatNum(r.avgWeight, 3)} কেজি</Text>
          <Text style={[styles.recordStat, { color: colors.textSecondary }]}>{r.totalPieces} পিস</Text>
          <Text style={[styles.recordStat, { color: colors.textSecondary }]}>{formatNum(r.totalWeight)} কেজি</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.sm, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current Calculation - Summary Card */}
        {results ? (
          <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <View style={styles.mainHighlight}>
              <Text style={styles.mainValue}>{formatNum(results.avgWeight, 3)}</Text>
              <Text style={styles.mainLabel}>{tr("গড় ওজন (কেজি)")}</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{formatNum(results.totalWeight, 2)}</Text>
                <Text style={styles.statLabel}>{tr("মোট ওজন")}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{results.totalPieces}</Text>
                <Text style={styles.statLabel}>{tr("মোট পিস")}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{formatNum(results.pakaWeight, 2)}</Text>
                <Text style={styles.statLabel}>{tr("পাকা ওজন")}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{fmtTaka(results.pricePerKg)}</Text>
                <Text style={styles.statLabel}>{tr("দর/কেজি")}</Text>
              </View>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{tr("মোট টাকা")}</Text>
              <Text style={styles.totalValue}>{fmtTaka(results.netAmount)}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.backgroundSecondary }]}>
            <Feather name="edit-3" size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {tr("ওজন ও পিস লিখুন")}
            </Text>
          </View>
        )}

        {/* Calculation Name Input */}
        <View style={[styles.nameInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="tag" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.nameInput, { color: colors.text }]}
            value={calculationName}
            onChangeText={setCalculationName}
            placeholder={tr("হিসাবের নাম (যেমন: রুই মাছ)")}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Column Headers */}
        <View style={styles.columnHeaders}>
          <View style={styles.headerSpacer} />
          <Text style={[styles.columnHeader, { color: colors.textSecondary }]}>{tr("ওজন (কেজি)")}</Text>
          <View style={[styles.headerDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.columnHeader, { color: colors.textSecondary }]}>{tr("সংখ্যা (পিস)")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Input rows */}
        <View style={styles.inputSection}>
          {rows.map((row, index) => {
            const hasData = row.weight || row.pieces;
            return (
              <View
                key={index}
                style={[
                  styles.inputRow,
                  { 
                    backgroundColor: colors.card,
                    borderColor: hasData ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={[styles.rowNum, { backgroundColor: hasData ? colors.primary : colors.backgroundSecondary }]}>
                  <Text style={[styles.rowNumText, { color: hasData ? '#fff' : colors.textSecondary }]}>
                    {index + 1}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={row.weight}
                    onChangeText={(t) => updateRow(index, 'weight', t)}
                    placeholder={tr("০")}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />

                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={row.pieces}
                    onChangeText={(t) => updateRow(index, 'pieces', t)}
                    placeholder={tr("০")}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                  />
                </View>

                {rows.length > 1 && hasData ? (
                  <Pressable style={styles.removeBtn} onPress={() => removeRow(index)}>
                    <Feather name="x-circle" size={18} color={colors.error} />
                  </Pressable>
                ) : <View style={styles.removeBtn} />}
              </View>
            );
          })}
        </View>

        {/* Saved Records List - combines database and local records */}
        {(savedRecords.length > 0 || localRecords.length > 0) ? (
          <View style={styles.savedSection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              সংরক্ষিত হিসাব ({savedRecords.length + localRecords.length})
            </Text>
            {localRecords.map((record) => {
              const r = JSON.parse(record.outputs_json) as CalculationResult;
              return (
                <Pressable
                  key={record.id}
                  style={[styles.recordCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => loadLocalRecord(record)}
                >
                  <View style={styles.recordHeader}>
                    <Text style={[styles.recordDate, { color: colors.textSecondary }]}>{formatDate(record.created_at)}</Text>
                    <Text style={[styles.recordAmount, { color: colors.primary }]}>{fmtTaka(r.netAmount)}</Text>
                  </View>
                  <View style={styles.recordStats}>
                    <Text style={[styles.recordStat, { color: colors.text }]}>{formatNum(r.avgWeight, 3)} কেজি</Text>
                    <Text style={[styles.recordStat, { color: colors.textSecondary }]}>{r.totalPieces} পিস</Text>
                    <Text style={[styles.recordStat, { color: colors.textSecondary }]}>{formatNum(r.totalWeight)} কেজি</Text>
                  </View>
                </Pressable>
              );
            })}
            {savedRecords.map((record) => (
              <View key={record.id}>
                {renderSavedRecord({ item: record })}
              </View>
            ))}
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      <Modal visible={settingsVisible} animationType="slide" transparent onRequestClose={() => setSettingsVisible(false)}>
        <SettingsModal colors={colors} settings={settings} onSave={saveSettingsHandler} onClose={() => setSettingsVisible(false)} />
      </Modal>

      <Modal visible={drawerVisible} animationType="slide" transparent onRequestClose={() => setDrawerVisible(false)}>
        <View style={styles.drawerOverlay}>
          <View style={[styles.drawerContent, { backgroundColor: colors.card }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: colors.text }]}>{tr("সংরক্ষিত হিসাব")}</Text>
              <Pressable onPress={() => setDrawerVisible(false)} hitSlop={12}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            
            <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
              {localRecords.length === 0 && savedRecords.length === 0 ? (
                <View style={styles.emptyDrawer}>
                  <Feather name="bookmark" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyDrawerText, { color: colors.textSecondary }]}>
                    {tr("কোন হিসাব সংরক্ষিত নেই")}
                  </Text>
                </View>
              ) : null}
              
              {localRecords.map((record) => {
                const r = JSON.parse(record.outputs_json) as CalculationResult;
                const inputs = JSON.parse(record.inputs_json);
                return (
                  <Pressable
                    key={record.id}
                    style={[styles.drawerItem, { 
                      backgroundColor: editingRecordId === record.id ? colors.primary + '20' : colors.background,
                      borderColor: editingRecordId === record.id ? colors.primary : colors.border 
                    }]}
                    onPress={() => loadLocalRecord(record)}
                  >
                    <View style={styles.drawerItemHeader}>
                      <Text style={[styles.drawerItemName, { color: colors.text }]} numberOfLines={1}>
                        {inputs.name || 'হিসাব'}
                      </Text>
                      <Text style={[styles.drawerItemAmount, { color: colors.primary }]}>{fmtTaka(r.netAmount)}</Text>
                    </View>
                    <View style={styles.drawerItemStats}>
                      <Text style={[styles.drawerItemStat, { color: colors.textSecondary }]}>
                        {formatDate(record.created_at)} • {formatNum(r.avgWeight, 3)} কেজি • {r.totalPieces} পিস
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SettingsModal({
  colors,
  settings,
  onSave,
  onClose,
}: {
  colors: ReturnType<typeof useColors>;
  settings: BepariSettings;
  onSave: (s: BepariSettings) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const [basePrice, setBasePrice] = useState(settings.base_price_per_kg.toString());
  const [targetWeight, setTargetWeight] = useState(settings.target_avg_weight_kg.toString());
  const [stepGrams, setStepGrams] = useState(settings.step_grams.toString());
  const [stepChange, setStepChange] = useState(settings.step_price_change.toString());
  const [deductionPerMon, setDeductionPerMon] = useState(settings.deduction_per_mon.toString());
  const [altThreshold, setAltThreshold] = useState(settings.alt_threshold_grams.toString());
  const [altPrice, setAltPrice] = useState(settings.alt_price_per_kg.toString());
  const [altTargetWeight, setAltTargetWeight] = useState(settings.alt_target_weight_kg.toString());
  const insets = useSafeAreaInsets();

  const handleSave = () => {
    onSave({
      base_price_per_kg: parseFloat(basePrice) || 300,
      target_avg_weight_kg: parseFloat(targetWeight) || 1.5,
      step_grams: parseInt(stepGrams) || 100,
      step_price_change: parseFloat(stepChange) || 5,
      deduction_per_mon: parseFloat(deductionPerMon) || 0,
      kg_per_mon: 40,
      alt_threshold_grams: parseFloat(altThreshold) || 300,
      alt_price_per_kg: parseFloat(altPrice) || 250,
      alt_target_weight_kg: parseFloat(altTargetWeight) || 1.0,
    });
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{tr("সেটিংস")}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.settingSection, { color: colors.primary }]}>{tr("মূল্য নির্ধারণ")}</Text>
          
          <SettingField label="বেস দাম (টাকা/কেজি)" value={basePrice} onChange={setBasePrice} colors={colors} />
          <SettingField label="টার্গেট গড় ওজন (কেজি)" hint="এই ওজনে বেস দাম প্রযোজ্য" value={targetWeight} onChange={setTargetWeight} colors={colors} />
          <SettingField label="স্টেপ (গ্রাম)" hint="কত গ্রাম কম/বেশি হলে দাম পরিবর্তন" value={stepGrams} onChange={setStepGrams} colors={colors} />
          <SettingField label="প্রতি স্টেপে দাম পরিবর্তন (টাকা)" value={stepChange} onChange={setStepChange} colors={colors} />

          <Text style={[styles.settingSection, { color: colors.primary, marginTop: Spacing.lg }]}>{tr("ওজন ঘাটতি")}</Text>
          <SettingField label="প্রতি মনে ঘাটতি (কেজি)" hint="প্রতি ৪০ কেজিতে কত কেজি বাদ" value={deductionPerMon} onChange={setDeductionPerMon} colors={colors} />

          <Text style={[styles.settingSection, { color: colors.primary, marginTop: Spacing.lg }]}>{tr("বিকল্প দাম (৩০০+ গ্রাম কম/বেশি হলে)")}</Text>
          <SettingField label="থ্রেশহোল্ড (গ্রাম)" hint="টার্গেট থেকে এত গ্রাম কম/বেশি হলে বিকল্প দাম" value={altThreshold} onChange={setAltThreshold} colors={colors} />
          <SettingField label="বিকল্প বেস দাম (টাকা/কেজি)" value={altPrice} onChange={setAltPrice} colors={colors} />
          <SettingField label="বিকল্প টার্গেট ওজন (কেজি)" value={altTargetWeight} onChange={setAltTargetWeight} colors={colors} />
        </ScrollView>

        <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
          <Feather name="check" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{tr("সেভ করুন")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SettingField({
  label,
  hint,
  value,
  onChange,
  colors,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      {hint ? <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>{hint}</Text> : null}
      <TextInput
        style={[styles.fieldInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: Spacing.md },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  mainHighlight: {
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    marginBottom: Spacing.sm,
  },
  mainValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
  },
  mainLabel: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  totalLabel: {
    fontSize: Typography.sizes.md,
    color: 'rgba(255,255,255,0.9)',
  },
  totalValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: '800',
    color: '#fff',
  },
  emptyCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.xs,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 6,
    height: 48,
  },
  rowNum: {
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: BorderRadius.md - 1,
    borderBottomLeftRadius: BorderRadius.md - 1,
  },
  rowNumText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  inputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.xl,
    fontWeight: '600',
    paddingVertical: 10,
  },
  suffix: {
    fontSize: Typography.sizes.sm,
    marginLeft: 4,
  },
  removeBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedSection: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  recordCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: Typography.sizes.xs,
  },
  recordAmount: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },
  recordStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  recordStat: {
    fontSize: Typography.sizes.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
  },
  settingSection: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  fieldRow: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    marginBottom: 2,
  },
  fieldHint: {
    fontSize: Typography.sizes.xs,
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    gap: 6,
  },
  saveBtnText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  nameInput: {
    flex: 1,
    fontSize: Typography.sizes.md,
    padding: 0,
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  columnHeader: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  headerDivider: {
    width: 1,
    height: 12,
  },
  inputDivider: {
    width: 1,
    height: 24,
  },
  badgeContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  drawerContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  drawerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  drawerList: {
    flex: 1,
  },
  emptyDrawer: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  emptyDrawerText: {
    fontSize: Typography.sizes.md,
    marginTop: Spacing.md,
  },
  drawerItem: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  drawerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  drawerItemName: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    flex: 1,
  },
  drawerItemAmount: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  drawerItemStats: {
    flexDirection: 'row',
  },
  drawerItemStat: {
    fontSize: Typography.sizes.sm,
  },
});
