import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderButton, useHeaderHeight } from '@react-navigation/elements';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Feather } from '@/components/icons/Feather';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '@/constants/theme';
import { saveCalcRecord, getCalcRecords, getCalcRecord, CalcRecord } from '@/offline/db/records';
import { saveDraft, getDraft, deleteDraft } from '@/offline/db/drafts';
import { getSetting, setSetting } from '@/offline/db/database';

import { tr, useTr } from "@/lib/tr";
import { useRowAutoAdvance } from "@/hooks/useRowAutoAdvance";
import { useI18n } from "@/lib/i18n";
type Language = 'bn' | 'en';

function useColors() {
  const { theme } = useTheme();
  return {
    text: theme.text,
    textSecondary: theme.textSecondary,
    textTertiary: theme.iconSecondary,
    background: theme.backgroundRoot,
    card: theme.card,
    border: theme.inputBorder,
    primary: theme.primary,
    error: theme.error,
    success: '#00BB77',
    warning: '#B25E09',
  };
}

const FISH_NAMES = ['সিলভার', 'রুই', 'কাতল', 'মিগেল', 'কালবাউশ', 'অন্যান্য'];

interface RowData {
  fishName: string;
  rate: string;
  weight: string;
}

interface AratSettings {
  commission_per_100: number;
}

const defaultSettings: AratSettings = {
  commission_per_100: 5,
};

interface CalculationResult {
  totalWeight: number;
  rawAmount: number;
  commission: number;
  netAmount: number;
  avgRate: number;
  rowCount: number;
}

function parseJson(s: string | null | undefined): any {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
const n0 = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
/** Reads a saved result safely (older records used other key names). */
function toResult(o: any): CalculationResult {
  return {
    totalWeight: n0(o?.totalWeight ?? o?.weight_kg),
    rawAmount: n0(o?.rawAmount ?? o?.gross_amount),
    commission: n0(o?.commission ?? o?.commission_amount),
    netAmount: n0(o?.netAmount ?? o?.net_amount),
    avgRate: n0(o?.avgRate ?? o?.rate_per_kg),
    rowCount: n0(o?.rowCount),
  };
}

function calculateResults(rows: RowData[], settings: AratSettings): CalculationResult | null {
  const validRows = rows.filter(r => parseFloat(r.rate) > 0 && parseFloat(r.weight) > 0);
  if (validRows.length === 0) return null;

  let totalWeight = 0;
  let rawAmount = 0;

  validRows.forEach(row => {
    const rate = parseFloat(row.rate) || 0;
    const weight = parseFloat(row.weight) || 0;
    totalWeight += weight;
    rawAmount += rate * weight;
  });

  const commission = (rawAmount * settings.commission_per_100) / 100;
  const netAmount = rawAmount - commission;
  const avgRate = totalWeight > 0 ? rawAmount / totalWeight : 0;

  return {
    totalWeight,
    rawAmount,
    commission,
    netAmount,
    avgRate,
    rowCount: validRows.length,
  };
}

function SettingsModal({ colors, settings, onSave, onClose }: {
  colors: any;
  settings: AratSettings;
  onSave: (s: AratSettings) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const [commission, setCommission] = useState(settings.commission_per_100.toString());

  const handleSave = () => {
    onSave({ commission_per_100: parseFloat(commission) || 5 });
    onClose();
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{tr("সেটিংস")}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.settingSection}>
          <Text style={[styles.settingSectionTitle, { color: colors.primary }]}>{tr("কমিশন")}</Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>{tr("প্রতি ১০০ টাকায় কমিশন")}</Text>
            <View style={[styles.settingInput, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.settingInputText, { color: colors.text }]}
                value={commission}
                onChangeText={setCommission}
                keyboardType="decimal-pad"
                placeholder="5"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={[styles.settingUnit, { color: colors.textSecondary }]}>{tr("৳")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.modalActions}>
          <Pressable
            style={[styles.modalButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Text style={styles.modalButtonText}>{tr("সংরক্ষণ করুন")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function FishDropdown({ value, onSelect, colors }: {
  value: string;
  onSelect: (name: string) => void;
  colors: any;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.dropdownContainer}>
      <Pressable
        style={[styles.dropdownTrigger, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.dropdownText, { color: value ? colors.text : colors.textTertiary }]}>
          {value || 'মাছ'}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.dropdownOverlay} onPress={() => setVisible(false)}>
          <View style={[styles.dropdownMenu, { backgroundColor: colors.card }]}>
            {FISH_NAMES.map((name) => (
              <Pressable
                key={name}
                style={[styles.dropdownItem, value === name && { backgroundColor: colors.primary + '20' }]}
                onPress={() => {
                  onSelect(name);
                  setVisible(false);
                }}
              >
                <Text style={[styles.dropdownItemText, { color: colors.text }]}>{name}</Text>
                {value === name ? <Feather name="check" size={16} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function AratCalculatorScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<any>(null);

  const [rows, setRows] = useState<RowData[]>([{ fishName: '', rate: '', weight: '' }]);
  // Rate and kg both filled -> cursor moves to the next row's rate by itself.
  const autoAdvance = useRowAutoAdvance(2);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  autoAdvance.setCanEnter((r) => { const next = rowsRef.current[r]; return !next || !next.rate; });
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settings, setSettings] = useState<AratSettings>(defaultSettings);
  const [savedRecords, setSavedRecords] = useState<CalcRecord[]>([]);
  const [calculationName, setCalculationName] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savingRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  // Opened from a saved record (Saved tab -> Edit): load that record instead of the draft.
  const route = useRoute<any>();
  const openRecordId: string | undefined = route.params?.recordId;
  const openNonce = route.params?.openedAt;
  const draftReady = useRef(false);
  // Settings that came with an opened record win over the general settings loading in parallel.
  const recordSettingsLoaded = useRef(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      const records = await getCalcRecords({ recordType: 'ARAT' });
      setSavedRecords(records);
    } catch {}
  }, []);

  useEffect(() => {
    if (!openRecordId) loadDraft(); else draftReady.current = true;
    loadSettings();
    loadRecords();
  }, []);

  const loadDraft = async () => {
    try {
      const draft = await getDraft('arat');
      if (draft?.rows && Array.isArray(draft.rows)) {
        setRows(draft.rows.length > 0 ? draft.rows : [{ fishName: '', rate: '', weight: '' }]);
      }
      if (typeof draft?.name === 'string') setCalculationName(draft.name);
      if (typeof draft?.editingRecordId === 'string') setEditingRecordId(draft.editingRecordId);
    } catch {}
    draftReady.current = true;
  };

  const loadSettings = async () => {
    try {
      const saved = await getSetting('arat_settings_v1');
      if (saved && !recordSettingsLoaded.current) setSettings(JSON.parse(saved));
    } catch {}
  };

  const saveSettingsHandler = async (newSettings: AratSettings) => {
    setSettings(newSettings);
    try {
      await setSetting('arat_settings_v1', JSON.stringify(newSettings));
    } catch {}
  };

  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    if (!draftReady.current) return;
    autoSaveRef.current = setTimeout(() => {
      saveDraft('arat', { rows, name: calculationName, editingRecordId }).catch(() => {});
    }, 300);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [rows, calculationName, editingRecordId]);

  const results = calculateResults(rows, settings);

  const updateRow = (index: number, field: keyof RowData, value: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    
    // Only add new row when BOTH rate AND weight have values in the last row
    if (index === rows.length - 1) {
      const lastRow = newRows[index];
      if (lastRow.rate && lastRow.weight) {
        newRows.push({ fishName: '', rate: '', weight: '' });
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd?.({ animated: true });
        }, 100);
      }
    }
    
    setRows(newRows);
    if (field !== 'fishName') autoAdvance.afterChange(index, [newRows[index].rate, newRows[index].weight]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      const row = rows[index];
      Alert.alert(
        'ডিলিট করুন?',
        `শাড়ি ${index + 1}: ${row.fishName || 'মাছ'}, ${row.rate || '0'} টাকা, ${row.weight || '0'} কেজি মুছে ফেলতে চান?`,
        [
          { text: 'বাতিল', style: 'cancel' },
          {
            text: 'ডিলিট',
            style: 'destructive',
            onPress: () => {
              const newRows = rows.filter((_, i) => i !== index);
              setRows(newRows);
            },
          },
        ]
      );
    }
  };

  /**
   * Saves this calculation in the phone's encrypted calculator database (works with no internet).
   * The first save makes a new record; later saves of the same calculation update that record,
   * so editing an old calculation never makes a copy.
   */
  const handleSaveCalculation = async (opts: { quiet?: boolean } = {}): Promise<boolean> => {
    if (!results) return true;
    if (savingRef.current) return false;
    savingRef.current = true;
    try {
      const id = await saveCalcRecord('ARAT', { rows, settings, name: calculationName }, results, {
        id: editingRecordId || undefined,
        language: lang,
        title: calculationName.trim(),
      });
      setEditingRecordId(id);
      await loadRecords();
      if (!opts.quiet) {
        setSavedFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setSavedFlash(false), 2500);
      }
      return true;
    } catch {
      const msg = tr('Could not save. Please try again.');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(tr('Error'), msg);
      return false;
    } finally {
      savingRef.current = false;
    }
  };

  const handleNewCalculation = async () => {
    // Keep the current calculation first; if that fails, nothing is cleared.
    const ok = await handleSaveCalculation({ quiet: true });
    if (!ok) return;
    autoAdvance.cancel();
    setRows([{ fishName: '', rate: '', weight: '' }]);
    setCalculationName('');
    setEditingRecordId(null);
    deleteDraft('arat').catch(() => {});
  };

  /** The saved icon at the top: opens the list of saved calculations (fresh from the phone). */
  const openSavedList = () => {
    loadRecords();
    setDrawerVisible(true);
  };

  // Set up header buttons
  useLayoutEffect(() => {
    const savedCount = savedRecords.length;
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          <HeaderButton onPress={handleDownloadPDF}>
            <Feather name="download" size={20} color={results ? colors.primary : colors.textTertiary} />
          </HeaderButton>
          <HeaderButton onPress={openSavedList} accessibilityLabel={tr("সংরক্ষিত হিসাব")}>
            <View style={styles.badgeContainer}>
              <Feather name="bookmark" size={20} color={colors.textSecondary} />
              {savedCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{savedCount > 9 ? '9+' : savedCount}</Text>
                </View>
              ) : null}
            </View>
          </HeaderButton>
          <HeaderButton onPress={handleNewCalculation} accessibilityLabel={tr("নতুন হিসাব")}>
            <Feather name="plus" size={22} color={colors.primary} />
          </HeaderButton>
          <HeaderButton onPress={() => setSettingsVisible(true)}>
            <Feather name="settings" size={20} color={colors.textSecondary} />
          </HeaderButton>
        </View>
      ),
    });
  }, [navigation, colors, results, rows, settings, calculationName, savedRecords, editingRecordId]);

  /** Opens a saved calculation exactly as it was saved; Save then updates that same record. */
  const loadRecord = (record: CalcRecord) => {
    const inputs = parseJson(record.inputs_json);
    if (!Array.isArray(inputs.rows)) {
      // Not made by this screen's table (very old record): show its details instead.
      setDrawerVisible(false);
      navigation.navigate('CalculateRecordDetail', { id: record.id });
      return;
    }
    autoAdvance.cancel();
    const loaded = inputs.rows.map((r: any) => ({ ...{ fishName: '', rate: '', weight: '' }, ...r }));
    const last = loaded[loaded.length - 1];
    if (!last || last.rate || last.weight) loaded.push({ fishName: '', rate: '', weight: '' });
    setRows(loaded);
    if (inputs.settings) { recordSettingsLoaded.current = true; setSettings({ ...defaultSettings, ...inputs.settings }); }
    setCalculationName(typeof inputs.name === 'string' ? inputs.name : (record.title || ''));
    setEditingRecordId(record.id);
    setDrawerVisible(false);
    draftReady.current = true;
  };

  useEffect(() => {
    if (!openRecordId) return;
    let alive = true;
    getCalcRecord(openRecordId)
      .then((rec) => { if (alive && rec) loadRecord(rec); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRecordId, openNonce]);

  const formatNum = (n: number, d = 2) => n.toFixed(d);
  const fmtTaka = (n: number) => `৳${formatNum(n, 0)}`;

  const handleDownloadPDF = async () => {
    if (!results) {
      Alert.alert('তথ্য নেই', 'পিডিএফ তৈরি করতে প্রথমে হিসাব করুন');
      return;
    }

    const validRows = rows.filter(r => parseFloat(r.rate) > 0 && parseFloat(r.weight) > 0);
    const date = new Date().toLocaleDateString('bn-BD');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #2E96EF; text-align: center; margin-bottom: 5px; }
          .date { text-align: center; color: #666; margin-bottom: 20px; }
          .title { text-align: center; font-size: 18px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background-color: #2E96EF; color: white; }
          .result-box { background: #F3FAFF; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .result-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .result-label { color: #666; }
          .result-value { font-weight: bold; color: #333; }
          .total { font-size: 24px; color: #2E96EF; text-align: center; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>{tr("আরত হিসাব")}</h1>
        <p class="date">${date}</p>
        ${calculationName ? `<p class="title">${calculationName}</p>` : ''}
        
        <table>
          <tr><th>{tr("ক্রম")}</th><th>{tr("মাছের নাম")}</th><th>{tr("দর (টাকা/কেজি)")}</th><th>{tr("ওজন (কেজি)")}</th><th>{tr("মোট")}</th></tr>
          ${validRows.map((r, i) => {
            const total = parseFloat(r.rate) * parseFloat(r.weight);
            return `<tr><td>${i + 1}</td><td>${r.fishName || '-'}</td><td>${r.rate}</td><td>${r.weight}</td><td>${fmtTaka(total)}</td></tr>`;
          }).join('')}
        </table>

        <div class="result-box">
          <div class="result-row"><span class="result-label">{tr("মোট ওজন:")}</span><span class="result-value">${formatNum(results.totalWeight)} কেজি</span></div>
          <div class="result-row"><span class="result-label">{tr("মোট টাকা:")}</span><span class="result-value">${fmtTaka(results.rawAmount)}</span></div>
          <div class="result-row"><span class="result-label">কমিশন (${settings.commission_per_100}%):</span><span class="result-value">${fmtTaka(results.commission)}</span></div>
          <div class="result-row"><span class="result-label">{tr("গড় দর:")}</span><span class="result-value">${fmtTaka(results.avgRate)}/কেজি</span></div>
        </div>

        <p class="total">নিট টাকা: ${fmtTaka(results.netAmount)}</p>

        <p class="footer">{tr("Farmers App - আরত ক্যালকুলেটর")}</p>
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
    const r = toResult(parseJson(item.outputs_json));
    const active = editingRecordId === item.id;
    return (
      <Pressable
        style={[styles.recordCard, { backgroundColor: active ? colors.primary + '20' : colors.card, borderColor: active ? colors.primary : colors.border }]}
        onPress={() => loadRecord(item)}
      >
        <View style={styles.recordHeader}>
          <Text style={[styles.recordDate, { color: colors.textSecondary }]} numberOfLines={1}>{item.title ? `${item.title} • ` : ''}{formatDate(item.created_at)}</Text>
          <Text style={[styles.recordAmount, { color: colors.primary }]}>{fmtTaka(r.netAmount)}</Text>
        </View>
        <View style={styles.recordStats}>
          <Text style={[styles.recordStat, { color: colors.text }]}>{formatNum(r.totalWeight)} কেজি</Text>
          <Text style={[styles.recordStat, { color: colors.textSecondary }]}>{r.rowCount} আইটেম</Text>
          <Text style={[styles.recordStat, { color: colors.textSecondary }]}>{fmtTaka(r.avgRate)}/কেজি</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: Spacing.sm, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Summary Card */}
        {results ? (
          <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.summaryBig}>{fmtTaka(results.netAmount)}</Text>
            <Text style={styles.summaryLabel}>{tr("পাকা টাকা")}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatNum(results.totalWeight)}</Text>
                <Text style={styles.summaryItemLabel}>{tr("মোট ওজন")}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{fmtTaka(results.rawAmount)}</Text>
                <Text style={styles.summaryItemLabel}>{tr("কাঁচা টাকা")}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{fmtTaka(results.avgRate)}</Text>
                <Text style={styles.summaryItemLabel}>{tr("গড় দর")}</Text>
              </View>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>কমিশন ({settings.commission_per_100}%)</Text>
              <Text style={styles.totalValue}>-{fmtTaka(results.commission)}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Feather name="edit-3" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{tr("মাছ, দর ও ওজন লিখুন")}</Text>
          </View>
        )}

        {/* Calculation Name Input */}
        <View style={[styles.nameInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="tag" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.nameInput, { color: colors.text }]}
            value={calculationName}
            onChangeText={setCalculationName}
            placeholder={tr("হিসাবের নাম (যেমন: আজকের বিক্রি)")}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Save on the phone (encrypted, offline). Editing a saved calculation updates it. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => { handleSaveCalculation(); }}
          disabled={!results}
          style={[styles.saveCalcBtn, { backgroundColor: savedFlash ? colors.primary + '20' : colors.primary, opacity: results ? 1 : 0.5 }]}
        >
          <Feather name={savedFlash ? 'check' : 'save'} size={18} color={savedFlash ? colors.primary : '#FFFFFF'} />
          <Text style={[styles.saveCalcText, { color: savedFlash ? colors.primary : '#FFFFFF' }]}>
            {savedFlash ? tr('সংরক্ষিত হয়েছে') : editingRecordId ? tr('আপডেট করুন') : tr('সংরক্ষণ করুন')}
          </Text>
        </Pressable>
        <Text style={[styles.saveCalcHint, { color: colors.textSecondary }]}>
          {editingRecordId ? tr('একই হিসাব আপডেট হবে, নতুন কপি হবে না।') : tr('ফোনে এনক্রিপ্ট করে রাখা হয়, ইন্টারনেট ছাড়াও কাজ করে।')}
        </Text>

        {/* Column Headers */}
        <View style={styles.columnHeaders}>
          <View style={styles.headerSpacer} />
          <Text style={[styles.columnHeader, styles.fishHeader, { color: colors.textSecondary }]}>{tr("মাছ")}</Text>
          <Text style={[styles.columnHeader, { color: colors.textSecondary }]}>{tr("দর")}</Text>
          <Text style={[styles.columnHeader, { color: colors.textSecondary }]}>{tr("কেজি")}</Text>
          <View style={styles.headerEndSpacer} />
        </View>

        {/* Input Rows */}
        <View style={styles.inputSection}>
          {rows.map((row, index) => {
            const hasData = row.fishName || row.rate || row.weight;
            return (
              <View key={index} style={[styles.inputRow, { backgroundColor: colors.card, borderColor: hasData ? colors.primary : colors.border }]}>
                <View style={[styles.rowNum, { backgroundColor: hasData ? colors.primary : colors.background }]}>
                  <Text style={[styles.rowNumText, { color: hasData ? '#fff' : colors.textTertiary }]}>{index + 1}</Text>
                </View>
                
                <FishDropdown
                  value={row.fishName}
                  onSelect={(name) => updateRow(index, 'fishName', name)}
                  colors={colors}
                />
                
                <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
                
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  value={row.rate}
                  onChangeText={(v) => updateRow(index, 'rate', v)}
                  keyboardType="decimal-pad"
                  ref={autoAdvance.register(index, 0)}
                  onFocus={autoAdvance.onFocus(index, 0)}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={autoAdvance.next(index, 0)}
                  placeholder={tr("০")}
                  placeholderTextColor={colors.textTertiary}
                />
                
                <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
                
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  value={row.weight}
                  onChangeText={(v) => updateRow(index, 'weight', v)}
                  keyboardType="decimal-pad"
                  ref={autoAdvance.register(index, 1)}
                  onFocus={autoAdvance.onFocus(index, 1)}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={autoAdvance.next(index, 1)}
                  placeholder={tr("০")}
                  placeholderTextColor={colors.textTertiary}
                />
                
                {rows.length > 1 && hasData ? (
                  <Pressable onPress={() => removeRow(index)} hitSlop={8} style={styles.removeBtn}>
                    <Feather name="x-circle" size={18} color={colors.error} />
                  </Pressable>
                ) : <View style={styles.removePlaceholder} />}
              </View>
            );
          })}
        </View>

        {/* Saved Records List */}
        {savedRecords.length > 0 ? (
          <View style={styles.savedSection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {tr("সংরক্ষিত হিসাব")} ({savedRecords.length})
            </Text>
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

      {/* Saved calculations: the same slide-up panel as the app's other bottom menus
          (ChatOptionsSheet / PostActionsSheet): backdrop, rounded top, handle, and padding that
          keeps the list clear of the phone's bottom navigation bar. */}
      <Modal visible={drawerVisible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={() => setDrawerVisible(false)}>
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerVisible(false)} accessibilityLabel={tr("বন্ধ")} testID="calc-saved-backdrop" />
          <View testID="calc-saved-sheet" style={[styles.drawerContent, { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={[styles.drawerHandle, { backgroundColor: colors.border }]} />
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: colors.text }]}>{tr("সংরক্ষিত হিসাব")}</Text>
              <Pressable onPress={() => setDrawerVisible(false)} hitSlop={12} accessibilityLabel={tr("বন্ধ")}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
              {savedRecords.length === 0 ? (
                <View style={styles.emptyDrawer}>
                  <Feather name="bookmark" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyDrawerText, { color: colors.textSecondary }]}>
                    {tr("কোন হিসাব সংরক্ষিত নেই")}
                  </Text>
                </View>
              ) : null}
              
              {savedRecords.map((record) => {
                const r = toResult(parseJson(record.outputs_json));
                const inputs = parseJson(record.inputs_json);
                return (
                  <Pressable
                    key={record.id}
                    style={[styles.drawerItem, { 
                      backgroundColor: editingRecordId === record.id ? colors.primary + '20' : colors.background,
                      borderColor: editingRecordId === record.id ? colors.primary : colors.border 
                    }]}
                    onPress={() => loadRecord(record)}
                  >
                    <View style={styles.drawerItemHeader}>
                      <Text style={[styles.drawerItemName, { color: colors.text }]} numberOfLines={1}>
                        {inputs.name || record.title || tr('হিসাব')}
                      </Text>
                      <Text style={[styles.drawerItemAmount, { color: colors.primary }]}>{fmtTaka(r.netAmount)}</Text>
                    </View>
                    <View style={styles.drawerItemStats}>
                      <Text style={[styles.drawerItemStat, { color: colors.textSecondary }]}>
                        {formatDate(record.created_at)} • {formatNum(r.totalWeight)} কেজি • {r.rowCount} আইটেম
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  saveCalcBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  saveCalcText: { fontSize: 15, fontWeight: '700' },
  saveCalcHint: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: Spacing.sm },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: Spacing.md },

  summaryCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryBig: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  summaryItem: { alignItems: 'center' },
  summaryValue: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  summaryItemLabel: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    marginTop: Spacing.sm,
  },
  totalLabel: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  totalValue: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: '#fff',
  },

  emptyCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
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
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  columnHeader: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  fishHeader: {
    flex: 1,
  },
  headerSpacer: {
    width: 28,
  },
  headerEndSpacer: {
    width: 26,
  },
  inputSection: { gap: Spacing.xs, marginBottom: Spacing.lg },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    height: 48,
  },
  rowNum: {
    width: 28,
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
  inputField: {
    flex: 1,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.xs,
  },
  inputDivider: {
    width: 1,
    height: 24,
  },
  removeBtn: { 
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePlaceholder: { width: 26 },

  dropdownContainer: { flex: 1 },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.xs,
  },
  dropdownText: { fontSize: Typography.sizes.xs },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: 200,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  dropdownItemText: { fontSize: Typography.sizes.md },

  savedSection: { marginTop: Spacing.lg },
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  recordCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  recordDate: { fontSize: Typography.sizes.sm },
  recordAmount: { fontSize: Typography.sizes.md, fontWeight: '600' },
  recordStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  recordStat: { fontSize: Typography.sizes.sm },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  settingSection: { marginBottom: Spacing.lg },
  settingSectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  settingLabel: { fontSize: Typography.sizes.md, flex: 1 },
  settingInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    width: 100,
  },
  settingInputText: {
    flex: 1,
    fontSize: Typography.sizes.md,
    paddingVertical: Spacing.xs,
    textAlign: 'center',
  },
  settingUnit: { fontSize: Typography.sizes.sm, marginLeft: 4 },
  modalActions: { marginTop: Spacing.md },
  modalButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawerContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    maxHeight: '80%',
  },
  drawerHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
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
  // No flex: 1 here: inside a sheet that only has a maxHeight it squeezed the list to zero
  // height, so tapping the saved icon opened an empty sheet. The list now grows with its rows.
  drawerList: {
    flexGrow: 0,
    flexShrink: 1,
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
