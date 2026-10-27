import { useCallback, useEffect, useRef } from "react";
import type { TextInput } from "react-native";

/**
 * Calculator rows: once both number fields of a row are filled, the cursor moves to the
 * first field of the next row by itself.
 *
 * It waits `delayMs` (3 s) after the LAST key before it moves. Every key press restarts the wait, so
 * a number like "125" can be typed at a comfortable pace without the cursor jumping down after the
 * "1" (0.4 s was too quick on a phone keyboard; the user asked for 3 s).
 * A value that ends in "." counts as unfinished.
 * It only jumps into a row whose first field is still empty, so fixing an old row never
 * throws the cursor somewhere else. The keyboard's Next key jumps straight away.
 */
/** Pause after the last key before the cursor moves to the next row (keep it at 3 s or less). */
export const AUTO_ADVANCE_DELAY_MS = 3000;

export function useRowAutoAdvance(fieldsPerRow: number, delayMs = AUTO_ADVANCE_DELAY_MS) {
  const refs = useRef<Record<string, TextInput | null>>({});
  const focused = useRef<{ row: number; col: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEnter = useRef<(row: number) => boolean>(() => true);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const focusField = useCallback((row: number, col: number) => {
    const el = refs.current[`${row}:${col}`];
    if (el) {
      el.focus();
      return true;
    }
    return false;
  }, []);

  /** Focus the next row, retrying briefly while a just-added row is still mounting. */
  const focusNextRow = useCallback(
    (row: number) => {
      let tries = 0;
      const attempt = () => {
        if (focusField(row + 1, 0) || tries++ > 5) return;
        setTimeout(attempt, 60);
      };
      attempt();
    },
    [focusField],
  );

  /** ref={register(row, col)} on each TextInput. */
  const register = useCallback(
    (row: number, col: number) => (el: TextInput | null) => {
      refs.current[`${row}:${col}`] = el;
    },
    [],
  );

  /** onFocus={onFocus(row, col)} on each TextInput. */
  const onFocus = useCallback(
    (row: number, col: number) => () => {
      focused.current = { row, col };
    },
    [],
  );

  /**
   * Call after every change with the row's values (in field order). When all are filled,
   * the cursor moves on after a short pause.
   */
  const afterChange = useCallback(
    (row: number, values: string[]) => {
      cancel();
      const complete = values.length >= fieldsPerRow && values.every((v) => {
        const s = String(v ?? "").trim();
        return s !== "" && !s.endsWith(".");
      });
      if (!complete) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const f = focused.current;
        if (!f || f.row !== row) return;
        if (!canEnter.current(row + 1)) return;
        focusNextRow(row);
      }, delayMs);
    },
    [cancel, delayMs, fieldsPerRow, focusNextRow],
  );

  /** onSubmitEditing={next(row, col)}: the keyboard's Next key. */
  const next = useCallback(
    (row: number, col: number) => () => {
      cancel();
      if (col < fieldsPerRow - 1) focusField(row, col + 1);
      else focusNextRow(row);
    },
    [cancel, fieldsPerRow, focusField, focusNextRow],
  );

  /** Tell the hook which rows it may jump into (by default: any). */
  const setCanEnter = useCallback((fn: (row: number) => boolean) => {
    canEnter.current = fn;
  }, []);

  return { register, onFocus, afterChange, next, setCanEnter, cancel };
}
