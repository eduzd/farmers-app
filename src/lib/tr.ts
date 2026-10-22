import { useMemo } from "react";
import { useI18n, Language } from "@/lib/i18n";
import { BN_OF_EN as BASE_BN_OF_EN } from "@/lib/trDict";
import { HEADER_BN_OF_EN } from "@/lib/trHeaders";

// screen titles first, the main dictionary wins where both have a word
const BN_OF_EN: Record<string, string> = { ...HEADER_BN_OF_EN, ...BASE_BN_OF_EN };

/**
 * Phrase translation for text that used to be hard-coded in screens.
 * tr("Total") -> "মোট" in Bangla; tr("মোট") -> "Total" in English.
 * Text missing from the dictionary is shown as written.
 * Components that use tr() call useTr() once so they re-render when the language changes.
 */
let EN_OF_BN: Record<string, string> | null = null;

function reverse() {
  if (!EN_OF_BN) {
    EN_OF_BN = {};
    for (const [en, bn] of Object.entries(BN_OF_EN)) if (!(bn in EN_OF_BN)) EN_OF_BN[bn] = en;
  }
  return EN_OF_BN;
}

const hasBangla = (s: string) => /[\u0980-\u09FF]/.test(s);

function trIn(lang: Language, s: string): string {
  if (!s) return s;
  if (lang === "bn") return hasBangla(s) ? s : BN_OF_EN[s] ?? s;
  return hasBangla(s) ? reverse()[s] ?? s : s;
}

export function tr(s: string): string {
  return trIn(useI18n.getState().language, s);
}

/**
 * Use inside components: `const tr = useTr();`. Returns a new function when the language changes,
 * so the React Compiler re-runs tr("...") calls and the screen re-renders in the new language.
 */
export function useTr() {
  const lang = useI18n((st) => st.language);
  return useMemo(() => (s: string) => trIn(lang, s), [lang]);
}
