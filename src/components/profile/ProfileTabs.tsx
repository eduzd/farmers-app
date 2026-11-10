import React, { useState } from "react";
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
 *
 * `fill`: the tabs share the whole bar (no sideways scrolling), each sized to its words plus an equal
 * share of the spare space. On a narrow phone the open tab drops its icon, the words get a little
 * smaller and only the open tab shows its count, so labels and counts never collide or get cut off.
 */
export function ProfileTabs<K extends string>({ tabs, value, onChange, fill }: { tabs: ProfileTab<K>[]; value: K; onChange: (k: K) => void; fill?: boolean }) {
  const { theme, isDark } = useTheme();
  const [barW, setBarW] = useState(0);
  // Fill mode: tabs share the whole bar, each as wide as its words need plus an equal share of the
  // space left, so a long label (Achievements) is never cut off. On a narrow phone the open tab drops
  // its icon, the words get a little smaller and only the open tab shows its count.
  const compact = fill && barW > 0 && barW < 420;
  const showIcon = !fill || barW === 0 || barW >= 480;
  // Dark mode: the selected tab is the app's blue with white text, not a bright white pill.
  const onBg = isDark ? theme.primary : theme.text;
  return (
    <View
      style={[styles.bar, { borderBottomColor: theme.divider }]}
      onLayout={fill ? (e) => setBarW(e.nativeEvent.layout.width) : undefined}
      testID="profile-tabs"
    >
      <Wrap fill={fill}>
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
                fill ? styles.pillFill : null,
                compact ? styles.pillCompact : null,
                on ? { backgroundColor: onBg } : null,
                pressed && !on ? { backgroundColor: theme.backgroundSecondary } : null,
              ]}
            >
              {on && showIcon ? <AppIcon name={t.icon as any} size={16} color={fg} /> : null}
              <ThemedText
                numberOfLines={1}
                style={[styles.label, fill && styles.labelFill, compact && styles.labelCompact, { color: fg }, on && styles.labelOn]}
              >
                {t.label}
              </ThemedText>
              {t.count !== undefined && t.count !== "" && (!compact || on) ? (
                <ThemedText numberOfLines={1} style={[styles.count, compact && styles.countCompact, { color: on ? fg : theme.textTertiary || theme.textSecondary }]}>
                  {String(t.count)}
                </ThemedText>
              ) : null}
            </Pressable>
          );
        })}
      </Wrap>
    </View>
  );
}

/** Equal-width row that fills the bar (fill), or the original sideways-scrolling row. */
function Wrap({ fill, children }: { fill?: boolean; children: React.ReactNode }) {
  if (fill) return <View style={styles.rowFill}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth, marginTop: Spacing.xl },
  row: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.xs },
  rowFill: { flexDirection: "row", paddingHorizontal: Spacing.sm, paddingBottom: Spacing.md, gap: Spacing.xs },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18 },
  pillFill: { flexGrow: 1, flexShrink: 1, flexBasis: "auto", minWidth: 0, justifyContent: "center", paddingHorizontal: 10 },
  pillCompact: { gap: 3, paddingHorizontal: 6 },
  label: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.medium },
  labelFill: { flexShrink: 1, minWidth: 0 },
  labelCompact: { fontSize: 13, lineHeight: 18 },
  labelOn: { fontFamily: FontFamily.semibold },
  count: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium, flexShrink: 0 },
  countCompact: { fontSize: 12, lineHeight: 16 },
});

export default ProfileTabs;
