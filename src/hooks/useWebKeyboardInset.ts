import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Mobile web only: how much of the page's bottom edge the on-screen keyboard covers.
 *
 * iPhone Safari and current Chrome on Android shrink only the *visual* viewport when
 * the keyboard opens, so anything pinned to the bottom of the page (a bottom sheet,
 * a modal's Save button) stays behind the keyboard. The visualViewport API tells us
 * how much is hidden. When the browser does resize the page for the keyboard, the
 * two heights match and this stays 0, so nothing is lifted twice.
 *
 * Always 0 on Android and iOS apps: react-native-keyboard-controller handles those.
 */
export function useWebKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const vv = (window as any).visualViewport as
      | { height: number; offsetTop: number; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void }
      | undefined;
    if (!vv) return;
    const update = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      // Ignore small differences (browser toolbars sliding, rounding).
      setInset(hidden > 80 ? Math.round(hidden) : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

export default useWebKeyboardInset;
