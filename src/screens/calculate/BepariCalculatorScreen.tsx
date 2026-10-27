import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, FlatList, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { TextInput, Text } from '@/components/MayaText';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { HeaderIconCircle } from '@/components/HeaderIconCircle';
import { Feather } from '@/components/icons/Feather';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import * as Print from 'expo-print';
import { saveHtmlAsPdf, escHtml } from '@/lib/htmlPdf';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { saveCalcRecord, getCalcRecords, getCalcRecord, deleteCalcRecord, CalcRecord } from '@/offline/db/records';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { saveDraft, getDraft, deleteDraft } from '@/offline/db/drafts';
import { getSetting, setSetting } from '@/offline/db/database';
import { Language } from '@/offline/i18n/translations';

import { useRowAutoAdvance } from '@/hooks/useRowAutoAdvance';
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

function parseJson(s: string | null | undefined): any {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
const n0 = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
/** Reads a saved result safely (older records used other key names). */
function toResult(o: any): CalculationResult {
  return {
    totalWeight: n0(o?.totalWeight ?? o?.total_weight),
    totalPieces: n0(o?.totalPieces ?? o?.total_pieces),
    avgWeight: n0(o?.avgWeight ?? o?.avg_weight),
    pricePerKg: n0(o?.pricePerKg ?? o?.final_price_per_kg),
    pakaWeight: n0(o?.pakaWeight),
    totalDeduction: n0(o?.totalDeduction),
    netAmount: n0(o?.netAmount ?? o?.net_amount),
    perPiece: n0(o?.perPiece ?? o?.per_piece_net),
    usingAltPrice: !!o?.usingAltPrice,
  };
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

export function BepariCalculatorScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rows, setRows] = useState<RowData[]>([{ weight: '', pieces: '' }]);
  // Both fields filled -> cursor moves to the next row's weight by itself.
  const autoAdvance = useRowAutoAdvance(2);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  autoAdvance.setCanEnter((r) => { const next = rowsRef.current[r]; return !next || !next.weight; });
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settings, setSettings] = useState<BepariSettings>(defaultSettings);
  const [savedRecords, setSavedRecords] = useState<CalcRecord[]>([]);
  const [calculationName, setCalculationName] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  // Delete from the saved list: the record waiting for the user's OK, and whether it is being deleted.
  const [pendingDelete, setPendingDelete] = useState<CalcRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  // A short note at the top: 'saved' after the + button (and where to find it), 'opened' after a
  // saved calculation is opened for editing.
  const [savedNotice, setSavedNotice] = useState<null | 'saved' | 'opened'>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
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
  const scrollViewRef = useRef<any>(null);

  const loadRecords = useCallback(async () => {
    try {
      const records = await getCalcRecords({ recordType: 'BEPARI' });
      setSavedRecords(records);
    } catch {}
  }, []);

  useEffect(() => {
    if (!openRecordId) loadDraft(); else draftReady.current = true;
    loadSettings();
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    if (!draftReady.current) return;
    autoSaveRef.current = setTimeout(() => {
      saveDraft('bepari', { rows, name: calculationName, editingRecordId }).catch(() => {});
    }, 300);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [rows, calculationName, editingRecordId]);

  
  const loadDraft = async () => {
    try {
      const draft = await getDraft('bepari');
      if (draft?.rows?.length > 0) setRows(draft.rows);
      if (typeof draft?.name === 'string') setCalculationName(draft.name);
      if (typeof draft?.editingRecordId === 'string') setEditingRecordId(draft.editingRecordId);
    } catch {}
    draftReady.current = true;
  };

  const loadSettings = async () => {
    try {
      const saved = await getSetting('bepari_settings_v3');
      if (saved && !recordSettingsLoaded.current) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
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
    newRows[index] = { ...newRows[index], [field]: value };
    
    // Only add new row when BOTH weight AND pieces have values in the last row
    if (index === rows.length - 1) {
      const lastRow = newRows[index];
      if (lastRow.weight && lastRow.pieces) {
        newRows.push({ weight: '', pieces: '' });
      }
    }
    setRows(newRows);
    autoAdvance.afterChange(index, [newRows[index].weight, newRows[index].pieces]);
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
      const id = await saveCalcRecord('BEPARI', { rows, settings, name: calculationName }, results, {
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

  /**
   * The + button: saves the calculation on screen (a new record, or the same record when a saved one
   * was opened), then starts an empty one. The saved one is in the list behind the bookmark icon.
   */
  const showNotice = (kind: 'saved' | 'opened') => {
    setSavedNotice(kind);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setSavedNotice(null), 5000);
    scrollViewRef.current?.scrollTo?.({ y: 0, animated: true });
  };

  const handleNewCalculation = async () => {
    const hadCalculation = !!results;
    // Keep the current calculation first; if that fails, nothing is cleared.
    const ok = await handleSaveCalculation({ quiet: true });
    if (!ok) return;
    if (hadCalculation) {
      showNotice('saved');
    }
    autoAdvance.cancel();
    setRows([{ weight: '', pieces: '' }]);
    setCalculationName('');
    setEditingRecordId(null);
    deleteDraft('bepari').catch(() => {});
  };

  /**
   * Deletes the saved calculation the user confirmed: gone from this device at once, and from
   * the server too (on the next sync when offline). If it was open on screen, the screen starts
   * a new empty calculation so Update can't bring it back.
   */
  const confirmDeleteRecord = async () => {
    const rec = pendingDelete;
    if (!rec || deleting) return;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteCalcRecord(rec.id);
      if (editingRecordId === rec.id) {
        autoAdvance.cancel();
        setRows([{ weight: '', pieces: '' }]);
        setCalculationName('');
        setEditingRecordId(null);
        setSavedNotice(null);
        deleteDraft('bepari').catch(() => {});
      }
      setSavedRecords((list) => list.filter((r) => r.id !== rec.id));
      setPendingDelete(null);
      loadRecords();
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(false);
    }
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
          <HeaderIconCircle size={40} onPress={handleDownloadPDF} accessibilityLabel={tr("পিডিএফ ডাউনলোড")}>
            <Feather name="download" size={20} color={results ? colors.text : colors.textTertiary} />
          </HeaderIconCircle>
          <HeaderIconCircle size={40} onPress={openSavedList} accessibilityLabel={tr("সংরক্ষিত হিসাব")}>
            <View style={styles.badgeContainer}>
              <Feather name="bookmark" size={20} color={colors.text} />
              {savedCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{savedCount > 9 ? '9+' : savedCount}</Text>
                </View>
              ) : null}
            </View>
          </HeaderIconCircle>
          <HeaderIconCircle size={40} onPress={handleNewCalculation} accessibilityLabel={tr("নতুন হিসাব")}>
            <Feather name="plus" size={20} color={colors.text} />
          </HeaderIconCircle>
          <HeaderIconCircle size={40} onPress={() => setSettingsVisible(true)}>
            <Feather name="settings" size={20} color={colors.text} />
          </HeaderIconCircle>
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
    const loaded = inputs.rows.map((r: any) => ({ ...{ weight: '', pieces: '' }, ...r }));
    const last = loaded[loaded.length - 1];
    if (!last || last.weight || last.pieces) loaded.push({ weight: '', pieces: '' });
    setRows(loaded);
    if (inputs.settings) { recordSettingsLoaded.current = true; setSettings({ ...defaultSettings, ...inputs.settings }); }
    setCalculationName(typeof inputs.name === 'string' ? inputs.name : (record.title || ''));
    setEditingRecordId(record.id);
    setDrawerVisible(false);
    draftReady.current = true;
    showNotice('opened');
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

    const validRows = rows.filter(r => r.weight && r.pieces);
    const date = new Date().toLocaleDateString('bn-BD');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #202936; text-align: center; margin-bottom: 5px; }
          .date { text-align: center; color: #666; margin-bottom: 20px; }
          .title { text-align: center; font-size: 18px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background-color: #202936; color: white; }
          .result-box { background: #F3FAFF; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .result-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .result-label { color: #666; }
          .result-value { font-weight: bold; color: #333; }
          .total { font-size: 24px; color: #202936; text-align: center; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${tr("ব্যাপারী হিসাব")}</h1>
        <p class="date">${date}</p>
        ${calculationName ? `<p class="title">${escHtml(calculationName)}</p>` : ''}
        
        <table>
          <tr><th>${tr("ক্রম")}</th><th>${tr("ওজন (কেজি)")}</th><th>${tr("পিস")}</th></tr>
          ${validRows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.weight}</td><td>${r.pieces}</td></tr>`).join('')}
        </table>

        <div class="result-box">
          <div class="result-row"><span class="result-label">${tr("মোট ওজন:")}</span><span class="result-value">${formatNum(results.totalWeight)} কেজি</span></div>
          <div class="result-row"><span class="result-label">${tr("মোট পিস:")}</span><span class="result-value">${results.totalPieces}</span></div>
          <div class="result-row"><span class="result-label">${tr("গড় ওজন:")}</span><span class="result-value">${formatNum(results.avgWeight * 1000, 0)} গ্রাম</span></div>
          <div class="result-row"><span class="result-label">${tr("দর (প্রতি কেজি):")}</span><span class="result-value">${fmtTaka(results.pricePerKg)}</span></div>
          <div class="result-row"><span class="result-label">${tr("পাকা ওজন:")}</span><span class="result-value">${formatNum(results.pakaWeight)} কেজি</span></div>
          <div class="result-row"><span class="result-label">${tr("কাটতি:")}</span><span class="result-value">${formatNum(results.totalDeduction)} কেজি</span></div>
        </div>

        <p class="total">মোট টাকা: ${fmtTaka(results.netAmount)}</p>
        <p style="text-align: center; color: #666;">প্রতি পিস: ${fmtTaka(results.perPiece)}</p>

        <p class="footer">${tr("Farmers App - ব্যাপারী ক্যালকুলেটর")}</p>
      </body>
      </html>
    `;

    try {
      await saveHtmlAsPdf(html, `Farmers-Bepari-${(calculationName || '').trim() || new Date().toISOString().slice(0, 10)}`);
    } catch (error: any) {
      Alert.alert(tr('ত্রুটি'), `${tr('পিডিএফ তৈরি করতে সমস্যা হয়েছে')}${error?.message ? `
${error.message}` : ''}`);
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.sm, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {savedNotice ? (
          <Pressable
            testID="calc-saved-notice"
            accessibilityRole="button"
            onPress={() => { setSavedNotice(null); if (savedNotice === 'saved') openSavedList(); }}
            style={[styles.savedNotice, { backgroundColor: colors.success + '1A', borderColor: colors.success }]}
          >
            <Feather name="check-circle" size={18} color={colors.success} />
            <Text style={[styles.savedNoticeText, { color: colors.text }]}>
              {savedNotice === 'opened'
                ? tr('সংরক্ষিত হিসাব খোলা হয়েছে। বদলান বা নতুন সারি যোগ করুন, তারপর "আপডেট করুন" চাপুন — একই হিসাবে সেভ হবে।')
                : tr('হিসাব সংরক্ষিত হয়েছে। দেখতে উপরের বুকমার্ক আইকনে চাপুন।')}
            </Text>
          </Pressable>
        ) : null}

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
          {editingRecordId ? tr('একই হিসাব আপডেট হবে, নতুন কপি হবে না।') : Platform.OS === 'web' ? tr('এই ব্রাউজারে রাখা হয়, ইন্টারনেট ছাড়াও খোলা যায়।') : tr('ফোনে এনক্রিপ্ট করে রাখা হয়, ইন্টারনেট ছাড়াও কাজ করে।')}
        </Text>

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
                    ref={autoAdvance.register(index, 0)}
                    onFocus={autoAdvance.onFocus(index, 0)}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={autoAdvance.next(index, 0)}
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
                    ref={autoAdvance.register(index, 1)}
                    onFocus={autoAdvance.onFocus(index, 1)}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={autoAdvance.next(index, 1)}
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
                  <View
                    key={record.id}
                    style={[styles.drawerItem, styles.drawerItemRow, {
                      backgroundColor: editingRecordId === record.id ? colors.primary + '20' : colors.background,
                      borderColor: editingRecordId === record.id ? colors.primary : colors.border
                    }]}
                  >
                  <Pressable
                    testID="calc-saved-item"
                    accessibilityRole="button"
                    style={styles.drawerItemMain}
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
                        {formatDate(record.created_at)} • {formatNum(r.avgWeight, 3)} {tr('কেজি')} • {r.totalPieces} {tr('পিস')}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    testID="calc-saved-delete"
                    accessibilityRole="button"
                    accessibilityLabel={tr('হিসাব মুছুন')}
                    hitSlop={8}
                    onPress={() => { setDeleteFailed(false); setPendingDelete(record); }}
                    style={({ pressed }) => [styles.drawerDeleteBtn, { backgroundColor: colors.error + (pressed ? '26' : '14') }]}
                  >
                    <Feather name="trash-2" size={18} color={colors.error} />
                  </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>

        {/* "Delete this calculation?" — the app's slide-up confirmation, red for delete. It sits
            inside the saved list's panel so it shows on top of it on every platform. */}
        <ConfirmSheet
          visible={!!pendingDelete}
          testID="calc-delete-sheet"
          tone="danger"
          icon="trash-2"
          title={tr('হিসাব মুছবেন?')}
          message={pendingDelete
            ? `${parseJson(pendingDelete.inputs_json).name || pendingDelete.title || tr('হিসাব')} • ${fmtTaka(toResult(parseJson(pendingDelete.outputs_json)).netAmount)}\n\n${deleteFailed ? tr('মুছে ফেলা যায়নি। আবার চেষ্টা করুন।') : tr('এই সংরক্ষিত হিসাবটি স্থায়ীভাবে মুছে যাবে, আর ফেরত আনা যাবে না।')}`
            : undefined}
          loading={deleting}
          onRequestClose={() => setPendingDelete(null)}
          buttons={[
            { text: tr('বাতিল'), style: 'cancel', onPress: () => setPendingDelete(null) },
            { text: tr('মুছুন'), style: 'destructive', onPress: () => { confirmDeleteRecord(); } },
          ]}
        />
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
  savedNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, marginBottom: Spacing.sm },
  savedNoticeText: { flex: 1, fontSize: 13, fontWeight: '600' },
  saveCalcBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  saveCalcText: { fontSize: 15, fontWeight: '700' },
  saveCalcHint: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: Spacing.sm },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: Spacing.md },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
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
  drawerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  drawerItemMain: {
    flex: 1,
    minWidth: 0,
  },
  drawerDeleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
