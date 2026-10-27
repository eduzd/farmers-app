import React, { useState } from "react";
import { Alert, Platform, StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { Spacing } from "@/constants/theme";
import { loadOrderDoc, runOrderDoc, DocAction } from "@/lib/orderDocument";

/**
 * "Print" and "Save PDF" for one order. The order is loaded fresh from where this buyer may read it
 * (their account, or the guest order's private key), so the paper matches the order's real status.
 */
export function OrderDocButtons({
  orderId,
  guestKey,
  style,
  testIDPrefix = "order-doc",
}: {
  orderId: string;
  guestKey?: string | null;
  style?: StyleProp<ViewStyle>;
  testIDPrefix?: string;
}) {
  const { theme } = useTheme();
  const bn = useI18n().language === "bn";
  const [busy, setBusy] = useState<DocAction | null>(null);
  const L = (en: string, b: string) => (bn ? b : en);

  const go = async (action: DocAction) => {
    if (busy) return;
    setBusy(action);
    try {
      const doc = await loadOrderDoc(orderId, guestKey);
      await runOrderDoc(action, doc, bn);
    } catch (e: any) {
      Alert.alert(L("Couldn't open this order", "অর্ডারটি খোলা যায়নি"), e?.message || L("Check your internet and try again.", "ইন্টারনেট দেখে আবার চেষ্টা করুন।"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={style}>
      <View style={styles.row}>
        <Button
          variant="secondary"
          size="sm"
          icon="printer"
          title={L("Print", "প্রিন্ট")}
          loading={busy === "print"}
          disabled={!!busy && busy !== "print"}
          onPress={() => void go("print")}
          style={styles.btn}
          testID={`${testIDPrefix}-print`}
          accessibilityLabel={L("Print this order", "এই অর্ডার প্রিন্ট করুন")}
        />
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          title={L("Save PDF", "PDF সেভ")}
          loading={busy === "pdf"}
          disabled={!!busy && busy !== "pdf"}
          onPress={() => void go("pdf")}
          style={styles.btn}
          testID={`${testIDPrefix}-pdf`}
          accessibilityLabel={L("Save this order as a PDF", "এই অর্ডার PDF হিসেবে সেভ করুন")}
        />
      </View>
      {Platform.OS === "web" ? (
        <ThemedText style={[styles.hint, { color: theme.textSecondary }]} testID={`${testIDPrefix}-hint`}>
          {L("For a PDF, choose “Save as PDF” in the print window.", "PDF-এর জন্য প্রিন্ট উইন্ডোতে “Save as PDF” বেছে নিন।")}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: Spacing.sm },
  btn: { flex: 1 },
  hint: { fontSize: 11.5, marginTop: 6, textAlign: "center" },
});

export default OrderDocButtons;
