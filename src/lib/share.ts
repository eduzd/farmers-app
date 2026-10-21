import { Alert, Platform, Share } from "react-native";
import { tr } from "@/lib/tr";

/** Share text with the system share sheet; on web falls back to copying it. */
export async function shareText(title: string, message: string) {
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      const nav: any = navigator;
      const url = typeof window !== "undefined" ? window.location.origin : "";
      if (nav.share) {
        await nav.share({ title, text: message, url });
      } else if (nav.clipboard) {
        await nav.clipboard.writeText(`${message} ${url}`.trim());
        Alert.alert(tr("Copied"), tr("Copied to clipboard. Paste it anywhere to share."));
      }
    } else {
      await Share.share({ title, message });
    }
  } catch {
    // user closed the share sheet
  }
}
