import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '@/components/MayaText';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderIconCircle } from '@/components/HeaderIconCircle';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Feather } from '@/components/icons/Feather';
import { saveHtmlAsPdf, escHtml } from '@/lib/htmlPdf';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '@/constants/theme';
import { saveCalcRecord, getCalcRecords, getCalcRecord, deleteCalcRecord, CalcRecord } from '@/offline/db/records';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { saveDraft, getDraft, deleteDraft } from '@/offline/db/drafts';
import { getSetting, setSetting } from '@/offline/db/database';
import { useRowAutoAdvance } from '@/hooks/useRowAutoAdvance';
import { useI18n } from '@/lib/i18n';
import { FEED_INGREDIENTS, FEED_TYPES, referenceProtein } from './feedIngredients';
import {
  calculateFeedMix,
  DEFAULT_FEED_MIX_SETTINGS,
  EMPTY_FEED_MIX_ROW,
  FeedMixResult,
  FeedMixRow,
  FeedMixSettings,
  fmtNum,
  fmtTaka,
  isFilledRow,
  parseNum,
} from './feedMixCalc';
import { aiFeedMixCheck, feedMixSignature, FeedMixAiResult } from '@/lib/feedMixAi';

/**
 * Feed Making Calculator (fish feed). Same layout and behaviour as the Arat / Bepari calculators:
 * ingredient rows (name from a list or typed, kg, price per kg, protein %), totals, milling charge,
 * loss, 25 kg bags, an estimated mix protein %, an AI protein check, encrypted offline save that
 * reopens and updates the same record, delete, and a PDF of the whole calculation.
 */

type Language = 'bn' | 'en';
const DRAFT_KEY = 'feed_mix';
const SETTINGS_KEY = 'feed_mix_settings_v1';
const CUSTOM_KEY = 'feed_mix_custom_ingredients';
const RECORD_TYPE = 'FEED_MIX' as const;

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
    success: theme.success,
    warning: '#B25E09',
  };
}

function parseJson(s: string | null | undefined): any {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
const n0 = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const newRow = (): FeedMixRow => ({ ...EMPTY_FEED_MIX_ROW });
/** kg with thousands commas: 12500.5 -> 12,500.5 */
function fmtKg(n: number, d = 2): string {
  const [i, f] = fmtNum(Math.abs(n), d).split('.');
  return `${n < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${f ? `.${f}` : ''}`;
}

/** Ingredient picker: a slide-up list with search; any typed name can be used too. */
function IngredientPicker({ value, lang, colors, customNames, onSelect, testID }: {
  value: string;
  lang: Language;
  colors: ReturnType<typeof useColors>;
  customNames: string[];
  onSelect: (name: string, protein: number | undefined, custom: boolean) => void;
  testID?: string;
}) {
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState('');
  const options = useMemo(() => {
    const list = FEED_INGREDIENTS.map((o) => ({ label: lang === 'bn' ? o.bn : o.en, other: lang === 'bn' ? o.en : o.bn, protein: o.protein, custom: false }));
    const known = new Set(FEED_INGREDIENTS.flatMap((o) => [o.en.toLowerCase(), o.bn.toLowerCase()]));
    const mine = customNames.filter((n) => !known.has(n.toLowerCase())).map((n) => ({ label: n, other: '', protein: undefined as number | undefined, custom: true }));
    return [...mine, ...list];
  }, [lang, customNames]);
  const query = q.trim().toLowerCase();
  const shown = query ? options.filter((o) => o.label.toLowerCase().includes(query) || o.other.toLowerCase().includes(query)) : options;
  const exact = options.some((o) => o.label.toLowerCase() === query || o.other.toLowerCase() === query);

  const close = () => { setVisible(false); setQ(''); };
  const pick = (label: string, protein: number | undefined, custom: boolean) => { onSelect(label, protein, custom); close(); };

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={L('উপকরণ বাছুন', 'Choose ingredient')}
        style={[styles.dropdownTrigger, fx.pickerTrigger, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.dropdownText, { color: value ? colors.text : colors.textTertiary, flex: 1 }]} numberOfLines={1}>
          {value || L('উপকরণ বাছুন বা লিখুন', 'Choose or type ingredient')}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
        <Pressable style={styles.drawerOverlay} onPress={close} accessibilityLabel={L('বন্ধ', 'Close')} />
        <View testID="feedmix-ingredient-sheet" style={[styles.drawerContent, { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={[styles.drawerHandle, { backgroundColor: colors.border }]} />
          <View style={styles.drawerHeader}>
            <Text style={[styles.drawerTitle, { color: colors.text }]}>{L('উপকরণ', 'Ingredient')}</Text>
            <Pressable onPress={close} hitSlop={12} accessibilityLabel={L('বন্ধ', 'Close')}>
              <Feather name="x" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={[styles.nameInputContainer, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: Spacing.sm }]}>
            <Feather name="search" size={16} color={colors.textTertiary} />
            <TextInput
              testID="feedmix-ingredient-search"
              style={[styles.nameInput, { color: colors.text }]}
              value={q}
              onChangeText={setQ}
              placeholder={L('খুঁজুন বা নতুন নাম লিখুন', 'Search or type a new name')}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={() => { if (q.trim()) pick(q.trim().slice(0, 60), referenceProtein(q), !exact); }}
            />
          </View>
          <ScrollView style={styles.drawerList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {query && !exact ? (
              <Pressable
                testID="feedmix-ingredient-custom"
                style={[styles.dropdownItem, fx.optionRow, { backgroundColor: colors.primary + '14' }]}
                onPress={() => pick(q.trim().slice(0, 60), undefined, true)}
              >
                <Feather name="plus-circle" size={16} color={colors.primary} />
                <Text style={[styles.dropdownItemText, { color: colors.primary, flex: 1 }]} numberOfLines={2}>
                  {L(`"${q.trim()}" ব্যবহার করুন`, `Use "${q.trim()}"`)}
                </Text>
              </Pressable>
            ) : null}
            {shown.map((o) => (
              <Pressable
                key={(o.custom ? 'c:' : 'l:') + o.label}
                testID="feedmix-ingredient-option"
                style={[styles.dropdownItem, fx.optionRow, value === o.label && { backgroundColor: colors.primary + '20' }]}
                onPress={() => pick(o.label, o.protein, o.custom)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownItemText, { color: colors.text }]} numberOfLines={1}>{o.label}</Text>
                  {o.other ? <Text style={[fx.optionSub, { color: colors.textSecondary }]} numberOfLines={1}>{o.other}</Text> : null}
                </View>
                {o.protein !== undefined ? (
                  <Text style={[fx.optionSub, { color: colors.textSecondary }]}>{L('প্রোটিন', 'Protein')} ~{o.protein}%</Text>
                ) : o.custom ? (
                  <Text style={[fx.optionSub, { color: colors.textTertiary }]}>{L('আপনার', 'Yours')}</Text>
                ) : null}
                {value === o.label ? <Feather name="check" size={16} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/** A labelled number box used in the milling / loss / bag card. */
function SettingBox({ label, unit, value, onChange, placeholder, colors, testID }: {
  label: string; unit: string; value: string; onChange: (v: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>; testID?: string;
}) {
  return (
    <View style={fx.settingBox}>
      <Text style={[fx.settingBoxLabel, { color: colors.textSecondary }]} numberOfLines={2}>{label}</Text>
      <View style={[styles.settingInput, fx.settingBoxInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          testID={testID}
          style={[styles.settingInputText, { color: colors.text, flex: 1 }]}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={[styles.settingUnit, { color: colors.textSecondary }]}>{unit}</Text>
      </View>
    </View>
  );
}

type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: FeedMixAiResult; signature: string };

export function FeedMixCalculatorScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;
  const L = useCallback((bn: string, en: string) => (lang === 'bn' ? bn : en), [lang]);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<any>(null);

  const [rows, setRows] = useState<FeedMixRow[]>([newRow()]);
  // kg and price both filled -> after the typing pause the cursor moves to the next row's kg.
  const autoAdvance = useRowAutoAdvance(2);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  autoAdvance.setCanEnter((r) => { const next = rowsRef.current[r]; return !next || !next.kg; });
  const [settings, setSettings] = useState<FeedMixSettings>(DEFAULT_FEED_MIX_SETTINGS);
  const [feedType, setFeedType] = useState('');
  const [ai, setAi] = useState<AiState>({ status: 'idle' });
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [savedRecords, setSavedRecords] = useState<CalcRecord[]>([]);
  const [calculationName, setCalculationName] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalcRecord | null>(null);
  const [pendingRowDelete, setPendingRowDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [savedNotice, setSavedNotice] = useState<null | 'saved' | 'opened'>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);
  const savingRef = useRef(false);
  const route = useRoute<any>();
  const openRecordId: string | undefined = route.params?.recordId;
  const openNonce = route.params?.openedAt;
  const draftReady = useRef(false);
  const settingsReady = useRef(false);
  const recordSettingsLoaded = useRef(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const loadRecords = useCallback(async () => {
    try { setSavedRecords(await getCalcRecords({ recordType: RECORD_TYPE })); } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      if (!openRecordId) {
        try {
          const draft = await getDraft(DRAFT_KEY);
          if (draft?.rows && Array.isArray(draft.rows)) {
            const loaded = draft.rows.map((r: any) => ({ ...newRow(), ...r }));
            setRows(loaded.length > 0 ? loaded : [newRow()]);
          }
          if (draft?.settings && !recordSettingsLoaded.current) setSettings({ ...DEFAULT_FEED_MIX_SETTINGS, ...draft.settings });
          if (typeof draft?.name === 'string') setCalculationName(draft.name);
          if (typeof draft?.feedType === 'string') setFeedType(draft.feedType);
          if (typeof draft?.editingRecordId === 'string') setEditingRecordId(draft.editingRecordId);
          if (draft?.ai?.result && typeof draft.ai.signature === 'string') setAi({ status: 'done', result: draft.ai.result, signature: draft.ai.signature });
          if (!draft?.settings) {
            const saved = await getSetting(SETTINGS_KEY);
            if (saved && !recordSettingsLoaded.current) setSettings({ ...DEFAULT_FEED_MIX_SETTINGS, ...JSON.parse(saved) });
          }
        } catch {}
      }
      draftReady.current = true;
      settingsReady.current = true;
    })();
    getSetting(CUSTOM_KEY).then((v) => { const a = parseJson(v); if (Array.isArray(a)) setCustomNames(a.filter((x) => typeof x === 'string')); }).catch(() => {});
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The last milling / loss / bag values become the starting values of the next calculation.
  useEffect(() => {
    if (!settingsReady.current) return;
    if (settingsSaveRef.current) clearTimeout(settingsSaveRef.current);
    settingsSaveRef.current = setTimeout(() => { setSetting(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {}); }, 600);
    return () => { if (settingsSaveRef.current) clearTimeout(settingsSaveRef.current); };
  }, [settings]);

  const aiForSave = ai.status === 'done' ? { result: ai.result, signature: ai.signature } : null;

  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    if (!draftReady.current) return;
    autoSaveRef.current = setTimeout(() => {
      saveDraft(DRAFT_KEY, { rows, settings, name: calculationName, feedType, editingRecordId, ai: aiForSave }).catch(() => {});
    }, 300);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, settings, calculationName, feedType, editingRecordId, ai]);

  const results: FeedMixResult | null = calculateFeedMix(rows, settings);

  // What the AI check would be sent now; when it differs from the last check, that check is out of date.
  const aiIngredients = rows.filter(isFilledRow).map((r) => {
    const p = parseNum(r.protein);
    return { name: r.name.trim() || L('নাম নেই', 'Unnamed'), kg: parseNum(r.kg), protein: Number.isFinite(p) && p >= 0 && p <= 100 ? p : null };
  });
  const currentSignature = feedMixSignature(feedType, aiIngredients);
  const aiStale = ai.status === 'done' && ai.signature !== currentSignature;

  const updateRow = (index: number, patch: Partial<FeedMixRow>, typedField?: 'kg' | 'price') => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], ...patch };
    // A new empty row appears once the last row has both kg and price.
    if (index === rows.length - 1) {
      const last = newRows[index];
      if (last.kg && last.price) newRows.push(newRow());
    }
    setRows(newRows);
    if (typedField) autoAdvance.afterChange(index, [newRows[index].kg, newRows[index].price]);
  };

  const selectIngredient = (index: number, name: string, protein: number | undefined, custom: boolean) => {
    const patch: Partial<FeedMixRow> = { name };
    if (protein !== undefined) patch.protein = String(protein);
    else if (custom) {
      // A typed name has no reference value: clear a value left from the previous list item.
      const prev = rows[index];
      const prevRef = referenceProtein(prev.name);
      if (prevRef !== undefined && prev.protein === String(prevRef)) patch.protein = '';
    }
    updateRow(index, patch);
    if (custom && name && !customNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      const next = [name, ...customNames].slice(0, 40);
      setCustomNames(next);
      setSetting(CUSTOM_KEY, JSON.stringify(next)).catch(() => {});
    }
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows.length ? newRows : [newRow()]);
    setPendingRowDelete(null);
  };

  /** Readable lines for History / Record details / PDF. */
  const buildSummary = (r: FeedMixResult) => [
    { label: L('মোট ওজন', 'Total weight'), value: `${fmtKg(r.totalKg)} ${L('কেজি', 'kg')}` },
    { label: L('উপকরণের খরচ', 'Ingredient cost'), value: fmtTaka(r.ingredientCost) },
    { label: L('মিলিং খরচ', 'Milling cost'), value: fmtTaka(r.millingCost) },
    { label: L('মোট খরচ', 'Total cost'), value: fmtTaka(r.totalCost) },
    { label: `${L('ঘাটতি', 'Loss')} (${fmtNum(r.lossPercent)}%)`, value: `${fmtKg(r.lossKg)} ${L('কেজি', 'kg')}` },
    { label: L('ব্যবহারযোগ্য ওজন', 'Usable weight'), value: `${fmtKg(r.usableKg)} ${L('কেজি', 'kg')}` },
    { label: `${L('বস্তা', 'Bags')} (${fmtNum(r.bagKg)} ${L('কেজি', 'kg')})`, value: fmtNum(r.bags) },
    { label: L('প্রতি বস্তার খরচ', 'Cost per bag'), value: fmtTaka(r.costPerBag) },
    { label: L('প্রতি কেজির খরচ', 'Cost per usable kg'), value: fmtTaka(r.costPerUsableKg) },
    { label: L('আনুমানিক প্রোটিন', 'Estimated protein'), value: `${fmtNum(r.proteinPercent, 1)}%` },
  ];

  /**
   * Saves on the phone's encrypted calculator database (works offline). The first save makes a
   * record; later saves of the same calculation update it, so editing never makes a copy.
   */
  const handleSaveCalculation = async (opts: { quiet?: boolean } = {}): Promise<boolean> => {
    if (!results) return true;
    if (savingRef.current) return false;
    savingRef.current = true;
    try {
      const outputs = {
        ...results,
        rowCount: results.lines.length,
        total_cost: results.totalCost,
        summary: buildSummary(results),
      };
      const id = await saveCalcRecord(RECORD_TYPE, { rows, settings, name: calculationName, feedType, ai: aiForSave }, outputs, {
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
      const msg = L('সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।', 'Could not save. Please try again.');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(L('ত্রুটি', 'Error'), msg);
      return false;
    } finally {
      savingRef.current = false;
    }
  };

  const showNotice = (kind: 'saved' | 'opened') => {
    setSavedNotice(kind);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setSavedNotice(null), 5000);
    scrollViewRef.current?.scrollTo?.({ y: 0, animated: true });
  };

  const resetScreen = () => {
    autoAdvance.cancel();
    setRows([newRow()]);
    setCalculationName('');
    setEditingRecordId(null);
    setAi({ status: 'idle' });
    deleteDraft(DRAFT_KEY).catch(() => {});
  };

  /** The + button: saves what's on screen first (nothing is cleared if that fails), then starts a new one. */
  const handleNewCalculation = async () => {
    const hadCalculation = !!results;
    const ok = await handleSaveCalculation({ quiet: true });
    if (!ok) return;
    if (hadCalculation) showNotice('saved');
    resetScreen();
  };

  const confirmDeleteRecord = async () => {
    const rec = pendingDelete;
    if (!rec || deleting) return;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteCalcRecord(rec.id);
      if (editingRecordId === rec.id) { resetScreen(); setSavedNotice(null); }
      setSavedRecords((list) => list.filter((r) => r.id !== rec.id));
      setPendingDelete(null);
      loadRecords();
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(false);
    }
  };

  const openSavedList = () => { loadRecords(); setDrawerVisible(true); };

  /** Opens a saved calculation exactly as saved; Save then updates the same record. */
  const loadRecord = (record: CalcRecord) => {
    const inputs = parseJson(record.inputs_json);
    if (!Array.isArray(inputs.rows)) {
      setDrawerVisible(false);
      navigation.navigate('CalculateRecordDetail', { id: record.id });
      return;
    }
    autoAdvance.cancel();
    const loaded: FeedMixRow[] = inputs.rows.map((r: any) => ({ ...newRow(), ...r }));
    const last = loaded[loaded.length - 1];
    if (!last || last.kg || last.price) loaded.push(newRow());
    setRows(loaded);
    if (inputs.settings) { recordSettingsLoaded.current = true; setSettings({ ...DEFAULT_FEED_MIX_SETTINGS, ...inputs.settings }); }
    setFeedType(typeof inputs.feedType === 'string' ? inputs.feedType : '');
    setAi(inputs.ai?.result && typeof inputs.ai.signature === 'string' ? { status: 'done', result: inputs.ai.result, signature: inputs.ai.signature } : { status: 'idle' });
    setCalculationName(typeof inputs.name === 'string' ? inputs.name : (record.title || ''));
    setEditingRecordId(record.id);
    setDrawerVisible(false);
    draftReady.current = true;
    showNotice('opened');
  };

  useEffect(() => {
    if (!openRecordId) return;
    let alive = true;
    getCalcRecord(openRecordId).then((rec) => { if (alive && rec) loadRecord(rec); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRecordId, openNonce]);

  /** AI protein check with the admin's AI settings. Labelled as an estimate everywhere. */
  const runAiCheck = async () => {
    if (!results || ai.status === 'loading') return;
    if (!feedType.trim()) {
      setAi({ status: 'error', message: L('প্রথমে খাদ্যের ধরন বাছুন বা লিখুন (যেমন তেলাপিয়া গ্রোয়ার)।', 'First choose or type the feed type (for example Tilapia grower).') });
      return;
    }
    const signature = currentSignature;
    setAi({ status: 'loading' });
    try {
      const result = await aiFeedMixCheck({ lang, feedType: feedType.trim(), ingredients: aiIngredients, lossPercent: results.lossPercent });
      if (!result || typeof result.mixProtein !== 'number') throw Object.assign(new Error('bad'), { code: 'failed' });
      setAi({ status: 'done', result, signature });
    } catch (e: any) {
      const code = e?.code;
      const msg = String(e?.message || '');
      let message: string;
      if (code === 'not_configured' || code === 'disabled' || /^Error 404/.test(msg)) {
        message = L('এআই চেক এখনো চালু হয়নি। অ্যাডমিন AI সেটিংসে একটি AI কী যোগ করে মডেল বাছলে এটি কাজ করবে। আপনার হিসাব ঠিকই আছে।', "The AI check isn't set up yet. It will work once the admin adds an AI key and picks a model in AI settings. Your calculation is fine.");
      } else if (code === 'offline') {
        message = L('ইন্টারনেট নেই। এআই চেকের জন্য ইন্টারনেট লাগে; হিসাব ও সংরক্ষণ ইন্টারনেট ছাড়াই চলে।', 'No internet. The AI check needs internet; the calculation and saving work without it.');
      } else if (code === 'rate_limited' || code === 'daily_limit') {
        message = msg || L('এখন অনেক অনুরোধ। একটু পরে আবার চেষ্টা করুন।', 'Too many requests right now. Please try again a little later.');
      } else {
        message = L('এআই এখন উত্তর দিতে পারেনি। একটু পরে আবার চেষ্টা করুন।', "The AI couldn't answer right now. Please try again a little later.");
      }
      setAi({ status: 'error', message });
    }
  };

  useLayoutEffect(() => {
    const savedCount = savedRecords.length;
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          <HeaderIconCircle size={40} onPress={handleDownloadPDF} accessibilityLabel={L('পিডিএফ ডাউনলোড', 'Download PDF')}>
            <Feather name="download" size={20} color={results ? colors.text : colors.textTertiary} />
          </HeaderIconCircle>
          <HeaderIconCircle size={40} onPress={openSavedList} accessibilityLabel={L('সংরক্ষিত হিসাব', 'Saved calculations')}>
            <View style={styles.badgeContainer}>
              <Feather name="bookmark" size={20} color={colors.text} />
              {savedCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{savedCount > 9 ? '9+' : savedCount}</Text>
                </View>
              ) : null}
            </View>
          </HeaderIconCircle>
          <HeaderIconCircle size={40} onPress={handleNewCalculation} accessibilityLabel={L('নতুন হিসাব', 'New calculation')}>
            <Feather name="plus" size={20} color={colors.text} />
          </HeaderIconCircle>
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, colors, results, rows, settings, calculationName, feedType, ai, savedRecords, editingRecordId, lang]);

  const handleDownloadPDF = async () => {
    if (!results) {
      const t = L('তথ্য নেই', 'Nothing to save');
      const m = L('পিডিএফ তৈরি করতে প্রথমে উপকরণ ও কেজি লিখুন', 'Enter ingredients and kg first to make a PDF');
      if (Platform.OS === 'web') window.alert(m); else Alert.alert(t, m);
      return;
    }
    const r = results;
    const date = new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB');
    const aiDone = ai.status === 'done' && !aiStale ? ai.result : null;
    const verdictText = (v: string) => v === 'low' ? L('কম', 'Low') : v === 'high' ? L('বেশি', 'High') : v === 'optimal' ? L('ঠিক আছে', 'Looks right') : L('বলা যাচ্ছে না', 'Unclear');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial, 'Noto Sans Bengali', sans-serif; padding: 24px; color: #1B2533; }
      h1 { color: #2E96EF; text-align: center; margin: 0 0 4px; font-size: 22px; }
      .date { text-align: center; color: #666; margin-bottom: 14px; }
      .title { text-align: center; font-size: 16px; margin-bottom: 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
      td.name { text-align: left; }
      th { background-color: #2E96EF; color: white; }
      tfoot td { font-weight: bold; background: #F3FAFF; }
      .box { background: #F3FAFF; padding: 12px 16px; border-radius: 8px; margin-top: 12px; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e6eef6; }
      .row:last-child { border-bottom: none; }
      .label { color: #555; } .value { font-weight: bold; }
      .big { font-size: 22px; color: #2E96EF; text-align: center; margin: 16px 0 6px; font-weight: bold; }
      .note { color: #777; font-size: 11px; margin-top: 6px; }
      h2 { font-size: 15px; margin: 18px 0 6px; }
      .footer { text-align: center; margin-top: 26px; color: #999; font-size: 11px; }
    </style></head><body>
      <h1>${L('খাদ্য তৈরির হিসাব', 'Feed making calculation')}</h1>
      <p class="date">${date}</p>
      ${calculationName ? `<p class="title">${escHtml(calculationName)}</p>` : ''}
      ${feedType.trim() ? `<p class="title">${L('খাদ্যের ধরন', 'Feed type')}: ${escHtml(feedType.trim())}</p>` : ''}
      <table>
        <thead><tr><th>#</th><th>${L('উপকরণ', 'Ingredient')}</th><th>${L('কেজি', 'kg')}</th><th>${L('দর (৳/কেজি)', 'Price (৳/kg)')}</th><th>${L('প্রোটিন %', 'Protein %')}</th><th>${L('মোট', 'Total')}</th></tr></thead>
        <tbody>${r.lines.map((l, i) => `<tr><td>${i + 1}</td><td class="name">${escHtml(l.name || '-')}</td><td>${fmtKg(l.kg, 3)}</td><td>${fmtTaka(l.price)}</td><td>${l.protein === null ? '-' : fmtNum(l.protein, 1)}</td><td>${fmtTaka(l.cost)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td></td><td class="name">${L('মোট', 'Total')}</td><td>${fmtKg(r.totalKg, 3)}</td><td></td><td>${fmtNum(r.proteinPercent, 1)}</td><td>${fmtTaka(r.ingredientCost)}</td></tr></tfoot>
      </table>
      <div class="box">
        <div class="row"><span class="label">${L('উপকরণের খরচ', 'Ingredient cost')}</span><span class="value">${fmtTaka(r.ingredientCost)}</span></div>
        <div class="row"><span class="label">${L('মিলিং খরচ', 'Milling cost')} (${fmtTaka(r.millingCharge)} / ${fmtKg(r.millingBasisKg)} ${L('কেজি', 'kg')})</span><span class="value">${fmtTaka(r.millingCost)}</span></div>
        <div class="row"><span class="label">${L('মোট খরচ', 'Total cost')}</span><span class="value">${fmtTaka(r.totalCost)}</span></div>
        <div class="row"><span class="label">${L('মোট ওজন', 'Total weight')}</span><span class="value">${fmtKg(r.totalKg)} ${L('কেজি', 'kg')}</span></div>
        <div class="row"><span class="label">${L('ঘাটতি', 'Loss')} (${fmtNum(r.lossPercent)}%)</span><span class="value">${fmtKg(r.lossKg)} ${L('কেজি', 'kg')}</span></div>
        <div class="row"><span class="label">${L('ব্যবহারযোগ্য ওজন', 'Usable weight')}</span><span class="value">${fmtKg(r.usableKg)} ${L('কেজি', 'kg')}</span></div>
        <div class="row"><span class="label">${L('বস্তা', 'Bags')} (${fmtNum(r.bagKg)} ${L('কেজি', 'kg')})</span><span class="value">${fmtNum(r.bags)} (${r.fullBags} ${L('পূর্ণ বস্তা', 'full')}${r.leftoverKg > 0.0001 ? ` + ${fmtKg(r.leftoverKg)} ${L('কেজি', 'kg')}` : ''})</span></div>
        <div class="row"><span class="label">${L('প্রতি কেজির খরচ', 'Cost per usable kg')}</span><span class="value">${fmtTaka(r.costPerUsableKg)}</span></div>
        <div class="row"><span class="label">${L('আনুমানিক প্রোটিন (মিশ্রণ)', 'Estimated protein (mix)')}</span><span class="value">${fmtNum(r.proteinPercent, 1)}%</span></div>
      </div>
      <p class="big">${L('প্রতি বস্তার খরচ', 'Cost per bag')}: ${fmtTaka(r.costPerBag)}</p>
      <p class="note">${L('প্রোটিন একটি আনুমানিক হিসাব (উপকরণের সাধারণ মান থেকে), ল্যাব পরীক্ষা নয়।', 'Protein is an estimate from typical ingredient values, not a lab test.')}</p>
      ${aiDone ? `<h2>${L('এআই প্রোটিন চেক (আনুমানিক)', 'AI protein check (estimate)')}</h2><div class="box">
        <div class="row"><span class="label">${L('ফলাফল', 'Result')}</span><span class="value">${verdictText(aiDone.verdict)}</span></div>
        <div class="row"><span class="label">${L('মিশ্রণের প্রোটিন', 'Mix protein')}</span><span class="value">${fmtNum(aiDone.mixProtein, 1)}%</span></div>
        ${aiDone.standard ? `<div class="row"><span class="label">${L('সাধারণ মান', 'Typical range')}</span><span class="value">${fmtNum(aiDone.standard.minProtein, 1)}–${fmtNum(aiDone.standard.maxProtein, 1)}%</span></div>` : ''}
        ${(aiDone.advice || []).map((a) => `<div class="row"><span class="label">• ${escHtml(a)}</span></div>`).join('')}
      </div>${aiDone.caution ? `<p class="note">${escHtml(aiDone.caution)}</p>` : ''}` : ''}
      <p class="footer">Farmers App - ${L('খাদ্য তৈরির ক্যালকুলেটর', 'Feed making calculator')}</p>
    </body></html>`;
    try {
      await saveHtmlAsPdf(html, `Farmers-Feed-${(calculationName || '').trim() || new Date().toISOString().slice(0, 10)}`);
    } catch (error: any) {
      const m = `${L('পিডিএফ তৈরি করতে সমস্যা হয়েছে', 'Could not make the PDF')}${error?.message ? `\n${error.message}` : ''}`;
      if (Platform.OS === 'web') window.alert(m); else Alert.alert(L('ত্রুটি', 'Error'), m);
    }
  };

  const formatDate = (timestamp: number) => { const d = new Date(timestamp); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const setS = (k: keyof FeedMixSettings) => (v: string) => setSettings((s) => ({ ...s, [k]: v }));
  const problemText: Record<string, string> = {
    basis: L('মিলিং চার্জ কত কেজির জন্য, সেই ওজন লিখুন (০ হতে পারে না)। মিলিং খরচ এখন ০ ধরা হয়েছে।', 'Enter the weight the milling charge is for (it cannot be 0). Milling cost is counted as 0 for now.'),
    loss: L('ঘাটতি ০ থেকে ১০০%-এর কম হতে হবে। এখন ০ ধরা হয়েছে।', 'Loss must be from 0 to under 100%. It is counted as 0 for now.'),
    bag: L('বস্তার ওজন ০-এর বেশি হতে হবে। এখন ২৫ কেজি ধরা হয়েছে।', 'Bag weight must be above 0. 25 kg is used for now.'),
    protein: L('প্রোটিন % ১০০-এর বেশি হতে পারে না। সেই সারি প্রোটিন ছাড়া ধরা হয়েছে।', 'Protein % cannot be above 100. That row is counted without protein.'),
  };
  const aiResult = ai.status === 'done' ? ai.result : null;
  const verdictColor = aiResult?.verdict === 'optimal' ? colors.success : aiResult?.verdict === 'unknown' ? colors.textSecondary : colors.warning;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: Spacing.sm, paddingBottom: insets.bottom + 40 }]}
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
                ? L('সংরক্ষিত হিসাব খোলা হয়েছে। বদলান বা নতুন সারি যোগ করুন, তারপর "আপডেট করুন" চাপুন — একই হিসাবে সেভ হবে।', 'Saved calculation opened. Change it or add rows, then tap "Update" — it saves to the same calculation.')
                : L('হিসাব সংরক্ষিত হয়েছে। দেখতে উপরের বুকমার্ক আইকনে চাপুন।', 'Calculation saved. Tap the bookmark icon at the top to see it.')}
            </Text>
          </Pressable>
        ) : null}

        {/* Summary card */}
        {results ? (
          <View testID="feedmix-summary" style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.summaryBig} adjustsFontSizeToFit numberOfLines={1}>{fmtTaka(results.costPerBag)}</Text>
            <Text style={styles.summaryLabel}>{L(`প্রতি বস্তার খরচ (${fmtNum(results.bagKg)} কেজি)`, `Cost per bag (${fmtNum(results.bagKg)} kg)`)}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{fmtKg(results.totalKg)}</Text>
                <Text style={styles.summaryItemLabel}>{L('মোট কেজি', 'Total kg')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{fmtTaka(results.totalCost, 0)}</Text>
                <Text style={styles.summaryItemLabel}>{L('মোট খরচ', 'Total cost')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{fmtNum(results.bags)}</Text>
                <Text style={styles.summaryItemLabel}>{L('বস্তা', 'Bags')}</Text>
              </View>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{L('প্রতি কেজির খরচ', 'Cost per usable kg')}</Text>
              <Text style={styles.totalValue}>{fmtTaka(results.costPerUsableKg)}</Text>
            </View>
            <View style={[styles.totalRow, fx.noTopBorder]}>
              <Text style={styles.totalLabel}>{L('আনুমানিক প্রোটিন', 'Estimated protein')}</Text>
              <Text testID="feedmix-protein" style={styles.totalValue}>{fmtNum(results.proteinPercent, 1)}%</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Feather name="edit-3" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center' }]}>{L('উপকরণ, কেজি ও দর লিখুন', 'Enter ingredient, kg and price')}</Text>
          </View>
        )}

        {/* Name */}
        <View style={[styles.nameInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="tag" size={16} color={colors.textTertiary} />
          <TextInput
            testID="feedmix-name"
            style={[styles.nameInput, { color: colors.text }]}
            value={calculationName}
            onChangeText={setCalculationName}
            placeholder={L('হিসাবের নাম (যেমন: তেলাপিয়া খাদ্য, ১ম ব্যাচ)', 'Calculation name (e.g. Tilapia feed, batch 1)')}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Save */}
        <Pressable
          testID="feedmix-save"
          accessibilityRole="button"
          onPress={() => { handleSaveCalculation(); }}
          disabled={!results}
          style={[styles.saveCalcBtn, { backgroundColor: savedFlash ? colors.primary + '20' : colors.primary, opacity: results ? 1 : 0.5 }]}
        >
          <Feather name={savedFlash ? 'check' : 'save'} size={18} color={savedFlash ? colors.primary : '#FFFFFF'} />
          <Text style={[styles.saveCalcText, { color: savedFlash ? colors.primary : '#FFFFFF' }]}>
            {savedFlash ? L('সংরক্ষিত হয়েছে', 'Saved') : editingRecordId ? L('আপডেট করুন', 'Update') : L('সংরক্ষণ করুন', 'Save')}
          </Text>
        </Pressable>
        <Text style={[styles.saveCalcHint, { color: colors.textSecondary }]}>
          {editingRecordId
            ? L('একই হিসাব আপডেট হবে, নতুন কপি হবে না।', 'The same calculation is updated, no copy is made.')
            : Platform.OS === 'web'
              ? L('এই ব্রাউজারে রাখা হয়, ইন্টারনেট ছাড়াও খোলা যায়।', 'Kept in this browser, opens without internet too.')
              : L('ফোনে এনক্রিপ্ট করে রাখা হয়, ইন্টারনেট ছাড়াও কাজ করে।', 'Kept encrypted on your phone, works without internet.')}
        </Text>

        {/* Ingredient rows */}
        <Text style={[fx.sectionTitle, { color: colors.text }]}>{L('উপকরণ', 'Ingredients')}</Text>
        <View style={styles.inputSection}>
          {rows.map((row, index) => {
            const hasData = !!(row.name || row.kg || row.price);
            const kg = parseNum(row.kg);
            const price = parseNum(row.price);
            const lineTotal = (Number.isFinite(kg) && kg > 0 ? kg : 0) * (Number.isFinite(price) && price > 0 ? price : 0);
            return (
              <View key={index} testID="feedmix-row" style={[fx.rowCard, { backgroundColor: colors.card, borderColor: hasData ? colors.primary : colors.border }]}>
                <View style={fx.rowTop}>
                  <View style={[styles.rowNum, { backgroundColor: hasData ? colors.primary : colors.background }]}>
                    <Text style={[styles.rowNumText, { color: hasData ? '#fff' : colors.textTertiary }]}>{index + 1}</Text>
                  </View>
                  <IngredientPicker
                    testID="feedmix-ingredient-trigger"
                    value={row.name}
                    lang={lang}
                    colors={colors}
                    customNames={customNames}
                    onSelect={(name, protein, custom) => selectIngredient(index, name, protein, custom)}
                  />
                  {rows.length > 1 && hasData ? (
                    <Pressable testID="feedmix-row-remove" accessibilityLabel={L('সারি মুছুন', 'Remove row')} onPress={() => setPendingRowDelete(index)} hitSlop={8} style={styles.removeBtn}>
                      <Feather name="x-circle" size={18} color={colors.error} />
                    </Pressable>
                  ) : <View style={styles.removePlaceholder} />}
                </View>
                <View style={fx.rowFields}>
                  <View style={fx.field}>
                    <Text style={[fx.fieldLabel, { color: colors.textSecondary }]}>{L('কেজি', 'kg')}</Text>
                    <TextInput
                      testID="feedmix-kg"
                      style={[fx.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      value={row.kg}
                      onChangeText={(v) => updateRow(index, { kg: v }, 'kg')}
                      keyboardType="decimal-pad"
                      ref={autoAdvance.register(index, 0)}
                      onFocus={autoAdvance.onFocus(index, 0)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={autoAdvance.next(index, 0)}
                      placeholder={L('০', '0')}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={fx.field}>
                    <Text style={[fx.fieldLabel, { color: colors.textSecondary }]}>{L('দর ৳/কেজি', 'Price ৳/kg')}</Text>
                    <TextInput
                      testID="feedmix-price"
                      style={[fx.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      value={row.price}
                      onChangeText={(v) => updateRow(index, { price: v }, 'price')}
                      keyboardType="decimal-pad"
                      ref={autoAdvance.register(index, 1)}
                      onFocus={autoAdvance.onFocus(index, 1)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={autoAdvance.next(index, 1)}
                      placeholder={L('০', '0')}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={[fx.field, fx.fieldSmall]}>
                    <Text style={[fx.fieldLabel, { color: colors.textSecondary }]}>{L('প্রোটিন %', 'Protein %')}</Text>
                    <TextInput
                      testID="feedmix-protein-input"
                      style={[fx.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      value={row.protein}
                      onChangeText={(v) => updateRow(index, { protein: v })}
                      keyboardType="decimal-pad"
                      placeholder="-"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={[fx.field, fx.totalField]}>
                    <Text style={[fx.fieldLabel, { color: colors.textSecondary }]}>{L('মোট', 'Total')}</Text>
                    <Text testID="feedmix-row-total" style={[fx.rowTotal, { color: lineTotal > 0 ? colors.text : colors.textTertiary }]} adjustsFontSizeToFit numberOfLines={1}>
                      {fmtTaka(lineTotal, 0)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Milling, loss, bags */}
        <View style={[fx.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[fx.cardTitle, { color: colors.primary }]}>{L('মিলিং চার্জ, ঘাটতি ও বস্তা', 'Milling charge, loss and bags')}</Text>
          <View style={fx.settingGrid}>
            <SettingBox testID="feedmix-milling-charge" label={L('মিলিং চার্জ', 'Milling charge')} unit="৳" value={settings.millingCharge} onChange={setS('millingCharge')} placeholder={L('০', '0')} colors={colors} />
            <SettingBox testID="feedmix-milling-basis" label={L('কত কেজির জন্য', 'For every')} unit={L('কেজি', 'kg')} value={settings.millingBasisKg} onChange={setS('millingBasisKg')} placeholder="100" colors={colors} />
          </View>
          <View style={fx.chipRow}>
            {['100', '1000'].map((b) => (
              <Pressable key={b} onPress={() => setS('millingBasisKg')(b)} style={[fx.chip, { borderColor: settings.millingBasisKg === b ? colors.primary : colors.border, backgroundColor: settings.millingBasisKg === b ? colors.primary + '1A' : 'transparent' }]}>
                <Text style={[fx.chipText, { color: settings.millingBasisKg === b ? colors.primary : colors.textSecondary }]}>{L(`প্রতি ${b === '100' ? '১০০' : '১,০০০'} কেজি`, `Per ${b === '100' ? '100' : '1,000'} kg`)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={fx.settingGrid}>
            <SettingBox testID="feedmix-loss" label={L('ঘাটতি', 'Loss')} unit="%" value={settings.lossPercent} onChange={setS('lossPercent')} placeholder={L('০', '0')} colors={colors} />
            <SettingBox testID="feedmix-bag" label={L('প্রতি বস্তা', 'Bag size')} unit={L('কেজি', 'kg')} value={settings.bagKg} onChange={setS('bagKg')} placeholder="25" colors={colors} />
          </View>
          {results && results.problems.length > 0 ? (
            <View style={fx.problemBox}>
              {results.problems.map((p) => (
                <View key={p} style={fx.problemRow}>
                  <Feather name="alert-triangle" size={14} color={colors.warning} />
                  <Text style={[fx.problemText, { color: colors.warning }]}>{problemText[p]}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Full breakdown */}
        {results ? (
          <View testID="feedmix-breakdown" style={[fx.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[fx.cardTitle, { color: colors.primary }]}>{L('হিসাব', 'Breakdown')}</Text>
            {[
              [L('মোট ওজন', 'Total weight'), `${fmtKg(results.totalKg)} ${L('কেজি', 'kg')}`, 'total-kg'],
              [L('উপকরণের খরচ', 'Ingredient cost'), fmtTaka(results.ingredientCost), 'ingredient-cost'],
              [L(`মিলিং খরচ (${fmtTaka(results.millingCharge)} / ${fmtKg(results.millingBasisKg)} কেজি)`, `Milling cost (${fmtTaka(results.millingCharge)} per ${fmtKg(results.millingBasisKg)} kg)`), fmtTaka(results.millingCost), 'milling-cost'],
              [L('মোট খরচ', 'Total cost'), fmtTaka(results.totalCost), 'total-cost'],
              [L(`ঘাটতি (${fmtNum(results.lossPercent)}%)`, `Loss (${fmtNum(results.lossPercent)}%)`), `-${fmtKg(results.lossKg)} ${L('কেজি', 'kg')}`, 'loss-kg'],
              [L('ব্যবহারযোগ্য ওজন', 'Usable weight'), `${fmtKg(results.usableKg)} ${L('কেজি', 'kg')}`, 'usable-kg'],
              [L(`বস্তা (${fmtNum(results.bagKg)} কেজি)`, `Bags (${fmtNum(results.bagKg)} kg)`), `${fmtNum(results.bags)}  (${results.fullBags} ${L('পূর্ণ', 'full')}${results.leftoverKg > 0.0001 ? ` + ${fmtKg(results.leftoverKg)} ${L('কেজি', 'kg')}` : ''})`, 'bags'],
              [L('প্রতি বস্তার খরচ', 'Cost per bag'), fmtTaka(results.costPerBag), 'cost-bag'],
              [L('প্রতি কেজির খরচ (ব্যবহারযোগ্য)', 'Cost per usable kg'), fmtTaka(results.costPerUsableKg), 'cost-kg'],
              [L('আনুমানিক প্রোটিন (মিশ্রণ)', 'Estimated protein (mix)'), `${fmtNum(results.proteinPercent, 1)}%`, 'protein'],
            ].map(([label, value, id]) => (
              <View key={id} style={[fx.lineRow, { borderBottomColor: colors.border }]}>
                <Text style={[fx.lineLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Text testID={`feedmix-out-${id}`} style={[fx.lineValue, { color: colors.text }]}>{value}</Text>
              </View>
            ))}
            <Text style={[fx.estimateNote, { color: colors.textSecondary }]}>
              {L('প্রোটিন একটি আনুমানিক হিসাব: প্রতিটি উপকরণের প্রোটিন % ওজন অনুযায়ী গড় করা হয়েছে। তালিকার মানগুলো সাধারণ মান, আপনি বদলাতে পারেন। এটি ল্যাব পরীক্ষা নয়।', 'Protein is an estimate: each ingredient\'s protein % averaged by weight. The list values are typical values you can change. It is not a lab test.')}
              {results.proteinMissing.length > 0 ? ' ' + L(`সারি ${results.proteinMissing.join(', ')}-এ প্রোটিন % নেই, তাই ০ ধরা হয়েছে।`, `Row ${results.proteinMissing.join(', ')} has no protein %, so it counts as 0.`) : ''}
            </Text>
          </View>
        ) : null}

        {/* AI protein check */}
        <View testID="feedmix-ai-card" style={[fx.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={fx.aiHeader}>
            <Feather name="cpu" size={18} color={colors.primary} />
            <Text style={[fx.cardTitle, { color: colors.primary, marginBottom: 0 }]}>{L('এআই প্রোটিন চেক', 'AI protein check')}</Text>
          </View>
          <Text style={[fx.aiHint, { color: colors.textSecondary }]}>{L('খাদ্যের ধরন বাছুন। এআই দেখবে প্রোটিন এই খাদ্যের সাধারণ মানের সাথে মেলে কি না।', 'Choose the feed type. The AI checks whether the protein fits the usual level for that feed.')}</Text>
          <View style={fx.chipRow}>
            {FEED_TYPES.map((t) => {
              const label = lang === 'bn' ? t.bn : t.en;
              const on = feedType === label || feedType === t.en || feedType === t.bn;
              return (
                <Pressable key={t.en} testID="feedmix-feedtype-chip" onPress={() => setFeedType(label)} style={[fx.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '1A' : 'transparent' }]}>
                  <Text style={[fx.chipText, { color: on ? colors.primary : colors.textSecondary }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.nameInputContainer, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: Spacing.sm }]}>
            <Feather name="edit-2" size={14} color={colors.textTertiary} />
            <TextInput
              testID="feedmix-feedtype"
              style={[styles.nameInput, { color: colors.text }]}
              value={feedType}
              onChangeText={(v) => setFeedType(v.slice(0, 80))}
              placeholder={L('বা অন্য ধরন লিখুন', 'Or type another feed type')}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <Pressable
            testID="feedmix-ai-check"
            accessibilityRole="button"
            disabled={!results || ai.status === 'loading'}
            onPress={runAiCheck}
            style={[styles.saveCalcBtn, { backgroundColor: colors.primary, opacity: results ? 1 : 0.5, marginTop: 0 }]}
          >
            {ai.status === 'loading' ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="zap" size={18} color="#FFFFFF" />}
            <Text style={[styles.saveCalcText, { color: '#FFFFFF' }]}>
              {ai.status === 'loading' ? L('এআই দেখছে…', 'AI is checking…') : aiResult ? L('আবার চেক করুন', 'Check again') : L('এআই দিয়ে প্রোটিন চেক করুন', 'Check protein with AI')}
            </Text>
          </Pressable>
          {!results ? <Text style={[fx.aiHint, { color: colors.textTertiary, textAlign: 'center', marginTop: 6 }]}>{L('আগে উপকরণ ও কেজি লিখুন।', 'Enter ingredients and kg first.')}</Text> : null}
          {ai.status === 'error' ? (
            <View testID="feedmix-ai-error" style={[fx.aiMessage, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '55' }]}>
              <Feather name="info" size={16} color={colors.warning} />
              <Text style={[fx.aiMessageText, { color: colors.text }]}>{ai.message}</Text>
            </View>
          ) : null}
          {aiResult ? (
            <View testID="feedmix-ai-result" style={[fx.aiResult, { borderColor: verdictColor }]}>
              {aiStale ? (
                <Text style={[fx.aiStale, { color: colors.warning }]}>{L('হিসাব বদলেছে — নতুন ফলাফলের জন্য আবার চেক করুন।', 'The mix changed — check again for a new result.')}</Text>
              ) : null}
              <Text style={[fx.aiVerdict, { color: verdictColor }]}>
                {aiResult.verdict === 'optimal' ? L('প্রোটিন ঠিক আছে মনে হচ্ছে', 'Protein looks right')
                  : aiResult.verdict === 'low' ? L('প্রোটিন কম মনে হচ্ছে', 'Protein looks low')
                  : aiResult.verdict === 'high' ? L('প্রোটিন বেশি মনে হচ্ছে', 'Protein looks high')
                  : L('নিশ্চিত বলা যাচ্ছে না', "Can't tell for sure")}
              </Text>
              <Text style={[fx.aiLine, { color: colors.text }]}>
                {L('মিশ্রণের প্রোটিন', 'Mix protein')}: <Text style={fx.bold}>{fmtNum(aiResult.mixProtein, 1)}%</Text>
                {aiResult.standard ? `   •   ${L('সাধারণ মান', 'Usual range')}: ${fmtNum(aiResult.standard.minProtein, 1)}–${fmtNum(aiResult.standard.maxProtein, 1)}%` : ''}
              </Text>
              {aiResult.feedTypeUnderstood ? <Text style={[fx.aiSub, { color: colors.textSecondary }]}>{L('খাদ্যের ধরন', 'Feed type')}: {aiResult.feedTypeUnderstood}</Text> : null}
              {(aiResult.ingredients || []).filter((x) => x.source === 'ai').length > 0 ? (
                <Text style={[fx.aiSub, { color: colors.textSecondary }]}>
                  {L('এআই-এর অনুমান করা প্রোটিন', 'Protein guessed by AI')}: {(aiResult.ingredients || []).filter((x) => x.source === 'ai').map((x) => `${x.name} ~${fmtNum(x.proteinPercent ?? 0, 1)}%`).join(', ')}
                </Text>
              ) : null}
              {(aiResult.advice || []).map((a, i) => (
                <View key={i} style={fx.adviceRow}>
                  <Text style={[fx.aiLine, { color: colors.text }]}>•</Text>
                  <Text style={[fx.aiLine, { color: colors.text, flex: 1 }]}>{a}</Text>
                </View>
              ))}
              <Text style={[fx.estimateNote, { color: colors.textSecondary }]}>
                {aiResult.caution || L('এটি এআই-এর আনুমানিক মত, ল্যাব পরীক্ষা নয়।', "This is the AI's estimate, not a lab test.")}
              </Text>
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>

      {/* Saved calculations: the same slide-up panel as the other calculators. */}
      <Modal visible={drawerVisible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={() => setDrawerVisible(false)}>
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerVisible(false)} accessibilityLabel={L('বন্ধ', 'Close')} testID="calc-saved-backdrop" />
        <View testID="calc-saved-sheet" style={[styles.drawerContent, { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={[styles.drawerHandle, { backgroundColor: colors.border }]} />
          <View style={styles.drawerHeader}>
            <Text style={[styles.drawerTitle, { color: colors.text }]}>{L('সংরক্ষিত হিসাব', 'Saved calculations')}</Text>
            <Pressable onPress={() => setDrawerVisible(false)} hitSlop={12} accessibilityLabel={L('বন্ধ', 'Close')}>
              <Feather name="x" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
            {savedRecords.length === 0 ? (
              <View style={styles.emptyDrawer}>
                <Feather name="bookmark" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyDrawerText, { color: colors.textSecondary }]}>{L('কোন হিসাব সংরক্ষিত নেই', 'No saved calculations')}</Text>
              </View>
            ) : null}
            {savedRecords.map((record) => {
              const out = parseJson(record.outputs_json);
              const inputs = parseJson(record.inputs_json);
              return (
                <View key={record.id} style={[styles.drawerItem, styles.drawerItemRow, {
                  backgroundColor: editingRecordId === record.id ? colors.primary + '20' : colors.background,
                  borderColor: editingRecordId === record.id ? colors.primary : colors.border,
                }]}>
                  <Pressable testID="calc-saved-item" accessibilityRole="button" style={styles.drawerItemMain} onPress={() => loadRecord(record)}>
                    <View style={styles.drawerItemHeader}>
                      <Text style={[styles.drawerItemName, { color: colors.text }]} numberOfLines={1}>{inputs.name || record.title || L('হিসাব', 'Calculation')}</Text>
                      <Text style={[styles.drawerItemAmount, { color: colors.primary }]}>{fmtTaka(n0(out.totalCost), 0)}</Text>
                    </View>
                    <View style={styles.drawerItemStats}>
                      <Text style={[styles.drawerItemStat, { color: colors.textSecondary }]}>
                        {formatDate(record.created_at)} • {fmtKg(n0(out.totalKg))} {L('কেজি', 'kg')} • {fmtNum(n0(out.bags))} {L('বস্তা', 'bags')} • {fmtTaka(n0(out.costPerBag), 0)}/{L('বস্তা', 'bag')}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    testID="calc-saved-delete"
                    accessibilityRole="button"
                    accessibilityLabel={L('হিসাব মুছুন', 'Delete calculation')}
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
        <ConfirmSheet
          visible={!!pendingDelete}
          testID="calc-delete-sheet"
          tone="danger"
          icon="trash-2"
          title={L('হিসাব মুছবেন?', 'Delete this calculation?')}
          message={pendingDelete
            ? `${parseJson(pendingDelete.inputs_json).name || pendingDelete.title || L('হিসাব', 'Calculation')} • ${fmtTaka(n0(parseJson(pendingDelete.outputs_json).totalCost), 0)}\n\n${deleteFailed ? L('মুছে ফেলা যায়নি। আবার চেষ্টা করুন।', "Couldn't delete. Please try again.") : L('এই সংরক্ষিত হিসাবটি স্থায়ীভাবে মুছে যাবে, আর ফেরত আনা যাবে না।', 'This saved calculation will be deleted for good and cannot be brought back.')}`
            : undefined}
          loading={deleting}
          onRequestClose={() => setPendingDelete(null)}
          buttons={[
            { text: L('বাতিল', 'Cancel'), style: 'cancel', onPress: () => setPendingDelete(null) },
            { text: L('মুছুন', 'Delete'), style: 'destructive', onPress: () => { confirmDeleteRecord(); } },
          ]}
        />
      </Modal>

      <ConfirmSheet
        visible={pendingRowDelete !== null}
        testID="feedmix-row-delete-sheet"
        tone="danger"
        icon="trash-2"
        title={L('সারি মুছবেন?', 'Remove this row?')}
        message={pendingRowDelete !== null && rows[pendingRowDelete]
          ? L(`সারি ${pendingRowDelete + 1}: ${rows[pendingRowDelete].name || 'উপকরণ'}, ${rows[pendingRowDelete].kg || '0'} কেজি, ${rows[pendingRowDelete].price || '0'} টাকা`, `Row ${pendingRowDelete + 1}: ${rows[pendingRowDelete].name || 'ingredient'}, ${rows[pendingRowDelete].kg || '0'} kg, ৳${rows[pendingRowDelete].price || '0'}`)
          : undefined}
        onRequestClose={() => setPendingRowDelete(null)}
        buttons={[
          { text: L('বাতিল', 'Cancel'), style: 'cancel', onPress: () => setPendingRowDelete(null) },
          { text: L('মুছুন', 'Remove'), style: 'destructive', onPress: () => { if (pendingRowDelete !== null) removeRow(pendingRowDelete); } },
        ]}
      />
    </View>
  );
}

// Shared with the Arat calculator's styles below.
const FISH_MENU_W = 180;
const FISH_ITEM_H = 46;

const fx = StyleSheet.create({
  sectionTitle: { fontSize: Typography.sizes.md, fontWeight: '700', marginBottom: Spacing.xs, marginTop: Spacing.xs },
  pickerTrigger: { flex: 1, marginHorizontal: Spacing.xs },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionSub: { fontSize: 12 },
  rowCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.sm, gap: Spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rowFields: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  field: { flex: 1, minWidth: 0 },
  fieldSmall: { flex: 0.8 },
  totalField: { flex: 1.1 },
  fieldLabel: { fontSize: 11, marginBottom: 2 },
  fieldInput: { borderWidth: 1, borderRadius: BorderRadius.sm, height: 40, paddingHorizontal: 6, fontSize: 15, textAlign: 'center' },
  rowTotal: { height: 40, lineHeight: 40, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  card: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
  cardTitle: { fontSize: Typography.sizes.sm, fontWeight: '700', marginBottom: Spacing.sm },
  settingGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  settingBox: { flex: 1, minWidth: 0 },
  settingBoxLabel: { fontSize: 12, marginBottom: 4 },
  settingBoxInput: { width: '100%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600' },
  problemBox: { gap: 4 },
  problemRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  problemText: { fontSize: 12, flex: 1 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  lineLabel: { fontSize: 13, flex: 1 },
  lineValue: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  estimateNote: { fontSize: 11, marginTop: Spacing.sm, lineHeight: 16 },
  noTopBorder: { borderTopWidth: 0, marginTop: 0 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  aiHint: { fontSize: 12, marginBottom: Spacing.sm, lineHeight: 17 },
  aiMessage: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginTop: Spacing.sm, alignItems: 'flex-start' },
  aiMessageText: { fontSize: 13, flex: 1, lineHeight: 19 },
  aiResult: { borderLeftWidth: 3, paddingLeft: Spacing.sm, marginTop: Spacing.md, gap: 4 },
  aiStale: { fontSize: 12, fontWeight: '600' },
  aiVerdict: { fontSize: 16, fontWeight: '700' },
  aiLine: { fontSize: 13, lineHeight: 19 },
  aiSub: { fontSize: 12, lineHeight: 17 },
  adviceRow: { flexDirection: 'row', gap: 6 },
  bold: { fontWeight: '700' },
});

const styles = StyleSheet.create({
  savedNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, marginBottom: Spacing.sm },
  savedNoticeText: { flex: 1, fontSize: 13, fontWeight: '600' },
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  dropdownMenu: {
    position: 'absolute',
    width: FISH_MENU_W,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: FISH_ITEM_H,
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
    gap: 6,
    marginRight: 8,
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
