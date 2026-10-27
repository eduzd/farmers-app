import { Platform } from "react-native";

/**
 * Turn an HTML document into a PDF the user can keep.
 *
 * Phone (Android / iOS): expo-print writes a real PDF file, then the share sheet opens
 * (save to Files / Drive, send on WhatsApp, print ...).
 *
 * Web: expo-print can't make a file in a browser. Its printToFileAsync only calls
 * window.print() on the whole app page and returns nothing, so `const { uri } = await
 * Print.printToFileAsync(...)` throws and the calculators showed "PDF তৈরি করতে সমস্যা হয়েছে".
 * Here the document itself is printed from a hidden frame, and the browser's print window
 * offers "Save as PDF". The saved file is named after `title`.
 */

export const escHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export const pdfFileName = (base: string) =>
  String(base || "Farmers")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Farmers";

/** Web only: print `html` (not the app page) from a hidden iframe. Resolves once the print window was opened. */
export function webPrintHtml(html: string, title: string, testId = "pdf-print-frame"): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc: any = (globalThis as any).document;
      if (!doc?.body) throw new Error("No page to print from");
      const frame = doc.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.setAttribute("data-testid", testId);
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
      const oldTitle = doc.title;
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        doc.title = oldTitle;
        setTimeout(() => frame.remove(), 1000);
      };
      frame.onload = async () => {
        try {
          const w = frame.contentWindow;
          const fonts = w?.document?.fonts;
          // wait for web fonts, never more than 2.5 s (offline still prints with system fonts)
          if (fonts?.ready) await Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
          // browsers name the saved PDF after the page title
          doc.title = title;
          w.addEventListener?.("afterprint", cleanup);
          w.focus();
          w.print(); // Chrome / Edge wait here until the print window closes
          resolve();
          setTimeout(() => (doc.title = oldTitle), 1500);
          setTimeout(cleanup, 60000);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };
      frame.srcdoc = html;
      doc.body.appendChild(frame);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Make a PDF from `html` and hand it to the user (share sheet on phones, print window with
 * "Save as PDF" on the web). Returns false when the user closed the window / share sheet.
 * Throws on a real failure, so the caller can show its own message.
 */
export async function saveHtmlAsPdf(html: string, title: string): Promise<boolean> {
  const name = pdfFileName(title);
  try {
    if (Platform.OS === "web") {
      await webPrintHtml(html, name);
      return true;
    }
    const Print = await import("expo-print");
    const Sharing = await import("expo-sharing");
    const res = await Print.printToFileAsync({ html });
    if (!res?.uri) throw new Error("No PDF file was made");
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(res.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: name });
    } else {
      await Print.printAsync({ uri: res.uri });
    }
    return true;
  } catch (e: any) {
    // closing the print / share window isn't an error
    if (/cancel|dismiss|did not complete/i.test(String(e?.message || ""))) return false;
    throw e;
  }
}
