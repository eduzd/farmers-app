import React, { Component, PropsWithChildren } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

type Props = PropsWithChildren<{ onBack?: () => void; screenName?: string }>;
type State = { error: Error | null };

/**
 * Wraps each stack screen so that a crash inside one screen shows a small
 * "go back / try again" panel instead of taking down the whole app.
 */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn(`[screen:${this.props.screenName}]`, error?.message);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Fallback
        message={this.state.error.message}
        onRetry={() => this.setState({ error: null })}
        onBack={this.props.onBack}
      />
    );
  }
}

function Fallback({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack?: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.icon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="alert-triangle" size={28} color={theme.warning || theme.text} />
      </View>
      <ThemedText type="h4" style={styles.title}>
        This screen couldn't load
      </ThemedText>
      <ThemedText style={[styles.msg, { color: theme.textSecondary }]} numberOfLines={3}>
        {message || "Something went wrong."}
      </ThemedText>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} style={[styles.btn, { borderColor: theme.border, borderWidth: 1 }]}>
            <ThemedText style={styles.btnText}>Go back</ThemedText>
          </Pressable>
        ) : null}
        <Pressable onPress={onRetry} style={[styles.btn, { backgroundColor: theme.primary }]}>
          <ThemedText style={[styles.btnText, { color: "#fff" }]}>Try again</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  msg: { textAlign: "center", marginBottom: Spacing.xl, maxWidth: 360 },
  row: { flexDirection: "row", gap: Spacing.md },
  btn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, minWidth: 120, alignItems: "center" },
  btnText: { fontWeight: "600" },
});
