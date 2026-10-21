import { Dimensions, Platform } from "react-native";

/**
 * On web (tablet / desktop browsers) the app is laid out in a centred column
 * no wider than MAX_APP_WIDTH, so phone-designed screens never stretch, squash
 * or overflow. Many screens read Dimensions.get("window").width at import time
 * to size cards, so we clamp the reported width here, before any screen loads.
 */
export const MAX_APP_WIDTH = 640;
export const isWebFrame = Platform.OS === "web";

function clamp<T extends { width: number }>(d: T): T {
  if (!d || typeof d.width !== "number") return d;
  return d.width > MAX_APP_WIDTH ? { ...d, width: MAX_APP_WIDTH } : d;
}

if (isWebFrame) {
  const D: any = Dimensions;
  if (!D.__farmersClamped) {
    D.__farmersClamped = true;
    const origGet = D.get.bind(D);
    D.get = (dim: string) => {
      const v = origGet(dim);
      return dim === "window" || dim === "screen" ? clamp(v) : v;
    };
    const origAdd = D.addEventListener.bind(D);
    D.addEventListener = (type: string, handler: any) => {
      if (type !== "change") return origAdd(type, handler);
      const wrapped = (e: any) =>
        handler({ ...e, window: e?.window ? clamp(e.window) : e?.window, screen: e?.screen ? clamp(e.screen) : e?.screen });
      wrapped.__orig = handler;
      handler.__wrapped = wrapped;
      return origAdd(type, wrapped);
    };
    if (D.removeEventListener) {
      const origRemove = D.removeEventListener.bind(D);
      D.removeEventListener = (type: string, handler: any) =>
        origRemove(type, handler?.__wrapped || handler);
    }
  }
}

// Keep react-native-web Modals (position: fixed, full viewport) inside the same
// centred app column on wide screens, so sheets and dialogs line up with the app.
if (isWebFrame && typeof document !== "undefined" && !document.getElementById("farmers-web-frame")) {
  const style = document.createElement("style");
  style.id = "farmers-web-frame";
  const half = MAX_APP_WIDTH / 2;
  style.textContent = `
    [aria-modal="true"] {
      left: max(0px, calc(50% - ${half}px)) !important;
      right: max(0px, calc(50% - ${half}px)) !important;
    }
    html, body { overflow-x: hidden; }
    input, textarea { min-width: 0; }
  `;
  document.head.appendChild(style);
}
