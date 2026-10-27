import React from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/icons/AppIcon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, FontFamily } from "@/constants/theme";

export interface ProfileTab<K extends string> {
  key: K;
  label: string;
  icon: string;
  count?: number | string;
}

/**
 * Pill tabs under the profile buttons, as in the reference: the open tab is a filled pill with
 * its icon, the others are plain words. Navy pill in light mode, white pill in dark mode.
 */
export function ProfileTabs<K extends string>({ tabs, value, onChange }: { tabs: ProfileTab<K>[]; value: K; onChange: (k: K) => void }) {
  const { theme, isDark } = useTheme();
  // Dark mode: the selected tab is the app's blue with white text, not a bright white pill.
  const onBg = isDark ? theme.primary : theme.text;
  return (
    <View style={[styles.bar, { borderBottomColor: theme.divider }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tabs.map((t) => {
          const on = t.key === value;
          const fg = on ? (isDark ? theme.buttonText : theme.backgroundRoot) : theme.textSecondary;
          return (
            <Pressable
              key={t.key}
              testID={`profile-tab-${t.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                Haptics.selectionAsync().catch(() => {});
                onChange(t.key);
              }}
              style={({ pressed }) => [
                styles.pill,
                on ? { backgroundColor: onBg } : null,
                pressed && !on ? { backgroundColor: theme.backgroundSecondary } : null,
              ]}
            >
              {on ? <AppIcon name={t.icon as any} size={16} color={fg} /> : null}
              <ThemedText style={[styles.label, { color: fg }, on && styles.labelOn]}>{t.label}</ThemedText>
              {t.count !== undefined && t.count !== "" ? (
                <ThemedText style={[styles.count, { color: on ? fg : theme.textTertiary || theme.textSecondary }]}>{String(t.count)}</ThemedText>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth, marginTop: Spacing.xl },
  row: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.xs },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18 },
  label: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.medium },
  labelOn: { fontFamily: FontFamily.semibold },
  count: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium },
});

export default ProfileTabs;
