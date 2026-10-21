import React, { useState } from 'react';
import { Pressable, StyleSheet, View, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { saveCalcRecord, RecordType } from '@/offline/db/records';
import { useSyncContext } from '@/offline/providers/SyncProvider';
import { useTr } from '@/lib/tr';
import { useI18n } from '@/lib/i18n';

export type SummaryRow = { label: string; value: string };

type Props = {
  recordType: RecordType;
  title: string;
  inputs: Record<string, unknown>;
  summary: SummaryRow[];
  disabled?: boolean;
};

/**
 * Saves this calculation on the phone (encrypted, works with no internet).
 * It goes up to the user's account by itself the next time they are online and signed in.
 */
export function SaveCalcButton({ recordType, title, inputs, summary, disabled }: Props) {
  const { theme } = useTheme();
  const tr = useTr();
  const language = useI18n((st) => st.language);
  const sync = useSyncContext();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify([recordType, inputs, summary]);
  const saved = savedKey === key;

  const onSave = async () => {
    if (busy || saved || disabled) return;
    setBusy(true);
    try {
      await saveCalcRecord(recordType, inputs, { summary }, { title, language });
      setSavedKey(key);
      sync.triggerSync().catch(() => {});
    } catch {
      const msg = tr('Could not save. Please try again.');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(tr('Error'), msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('Save on phone')}
        onPress={onSave}
        disabled={busy || disabled}
        style={[
          styles.button,
          { backgroundColor: saved ? theme.primarySoft : theme.primary, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <Feather name={saved ? 'check' : 'save'} size={18} color={saved ? theme.primary : '#FFFFFF'} />
        <ThemedText style={[styles.text, { color: saved ? theme.primary : '#FFFFFF' }]}>
          {saved ? tr('Saved on phone') : tr('Save on phone')}
        </ThemedText>
      </Pressable>
      <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
        {tr('Works without internet. Syncs to your account when you are online.')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.lg, gap: Spacing.xs },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  text: { fontWeight: '600', fontSize: 15 },
  hint: { fontSize: 12, textAlign: 'center' },
});
