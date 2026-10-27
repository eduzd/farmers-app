import React from "react";
import { Alert, Platform } from "react-native";
import { ConfirmSheetHost, enqueueSheet, inferTone, type ConfirmTone, type SheetButton } from "@/components/ConfirmSheet";

/**
 * react-native-web ships Alert.alert as a no-op, so on the web every
 * validation message, confirmation and "Saved!" popup silently did nothing.
 * On the web, Alert.alert is replaced with the Farmers bottom sheet
 * (slide up, spring landing, title, message and any number of buttons).
 *
 * The host is mounted on every platform so askConfirm() works on phones too.
 */
type AlertButton = { text?: string; onPress?: (value?: string) => void; style?: "default" | "cancel" | "destructive" };

const PROBLEM_WORDS = /(error|failed|couldn'?t|could not|invalid|wrong|ত্রুটি|ব্যর্থ|সমস্যা|ভুল)/i;

if (Platform.OS === "web") {
  (Alert as any).alert = (title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean }) => {
    const btns: AlertButton[] = buttons && buttons.length ? buttons : [{ text: "OK" }];
    const single = btns.length === 1;
    const main = [...btns].reverse().find((b) => b.style !== "cancel");
    let tone: ConfirmTone = "primary";
    let icon: any;
    if (single) {
      const problem = PROBLEM_WORDS.test(`${title ?? ""} ${message ?? ""}`);
      tone = problem ? "warning" : "primary";
      icon = problem ? "alert-circle" : "info";
    } else if (main?.style === "destructive") {
      tone = "danger";
    } else if (main?.text) {
      tone = inferTone(main.text);
      if (tone === "danger") tone = "warning";
    }
    const cancelIndex = Math.max(0, btns.findIndex((b) => b.style === "cancel"));
    enqueueSheet({
      title: title ?? "",
      message,
      tone,
      icon,
      // single-button notices can always be dismissed; dismissing runs that button like tapping OK did before
      cancelable: options?.cancelable ?? true,
      cancelIndex,
      buttons: btns.map((b) => ({ text: b.text, style: b.style, onPress: b.onPress ? () => b.onPress && b.onPress() : undefined })) as SheetButton[],
    });
  };
}

export function WebAlertHost() {
  return <ConfirmSheetHost />;
}
