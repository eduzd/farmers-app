/**
 * Calculator rows (Arat / Bepari): the cursor moves to the next row only after the user has
 * stopped typing for AUTO_ADVANCE_DELAY_MS (3 s), and every key press restarts the wait.
 * Run: npx tsx tests/check-calc-autoadvance.tsx
 */
import React from "react";
// @ts-ignore -- no type package for react-dom/server here
import { renderToString } from "react-dom/server";
import { useRowAutoAdvance, AUTO_ADVANCE_DELAY_MS } from "../src/hooks/useRowAutoAdvance";

let pass = 0, fail = 0;
const ok = (name: string, cond: any, extra?: any) => {
  if (cond) pass++; else { fail++; console.log("FAIL", name, extra === undefined ? "" : JSON.stringify(extra)); }
};

// ---- fake clock ----
let now = 0;
let seq = 0;
const timers = new Map<number, { at: number; fn: () => void }>();
(globalThis as any).setTimeout = (fn: () => void, ms = 0) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; };
(globalThis as any).clearTimeout = (id: number) => { timers.delete(id); };
const advance = (ms: number) => {
  const end = now + ms;
  for (;;) {
    let next: [number, { at: number; fn: () => void }] | null = null;
    for (const e of timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
    if (!next) break;
    timers.delete(next[0]);
    now = next[1].at;
    next[1].fn();
  }
  now = end;
};

function setup() {
  let api: ReturnType<typeof useRowAutoAdvance> | null = null;
  function Probe() { api = useRowAutoAdvance(2); return null; }
  renderToString(<Probe />);
  const a = api!;
  const focusLog: string[] = [];
  const field = (r: number, c: number) => ({ focus: () => { focusLog.push(`${r}:${c}`); a.onFocus(r, c)(); } }) as any;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) a.register(r, c)(field(r, c));
  return { a, focusLog };
}

ok("delay is 2-3 s", AUTO_ADVANCE_DELAY_MS >= 2000 && AUTO_ADVANCE_DELAY_MS <= 3000, AUTO_ADVANCE_DELAY_MS);

// Typing "125" in kg slowly (0.8 s between digits): no jump until 3 s after the "5".
{
  const { a, focusLog } = setup();
  a.onFocus(0, 1)();
  a.afterChange(0, ["80", "1"]); advance(800);
  ok("no jump after first digit", focusLog.length === 0, focusLog);
  a.afterChange(0, ["80", "12"]); advance(800);
  a.afterChange(0, ["80", "125"]); advance(2900);
  ok("no jump 2.9 s after last digit", focusLog.length === 0, focusLog);
  advance(200);
  ok("jumps to next row after the pause", focusLog.join() === "1:0", focusLog);
}

// The old 0.4 s pause would have jumped between digits; now a 2.5 s gap does not.
{
  const { a, focusLog } = setup();
  a.onFocus(0, 1)();
  a.afterChange(0, ["80", "1"]); advance(2500);
  a.afterChange(0, ["80", "12"]); advance(2500);
  ok("each key restarts the wait", focusLog.length === 0, focusLog);
  advance(600);
  ok("moves once after stopping", focusLog.join() === "1:0", focusLog);
  advance(5000);
  ok("no extra jump later (no stale timer)", focusLog.length === 1, focusLog);
}

// Unfinished values never jump; trailing dot counts as unfinished.
{
  const { a, focusLog } = setup();
  a.onFocus(0, 1)();
  a.afterChange(0, ["80", "1."]); advance(4000);
  a.afterChange(0, ["", "12"]); advance(4000);
  ok("unfinished rows stay", focusLog.length === 0, focusLog);
}

// User moves elsewhere by hand during the wait: no jump.
{
  const { a, focusLog } = setup();
  a.onFocus(0, 1)();
  a.afterChange(0, ["80", "5"]); advance(1000);
  a.onFocus(2, 0)();
  advance(3000);
  ok("manual move cancels jump", focusLog.length === 0, focusLog);
}

// Next key on the keyboard still moves right away.
{
  const { a, focusLog } = setup();
  a.onFocus(0, 0)();
  a.afterChange(0, ["80", "5"]);
  a.next(0, 1)();
  ok("Next key immediate", focusLog.join() === "1:0", focusLog);
  advance(5000);
  ok("Next key cancels pending auto jump", focusLog.length === 1, focusLog);
}

// Row that already has a value below is not entered.
{
  const { a, focusLog } = setup();
  a.setCanEnter(() => false);
  a.onFocus(0, 1)();
  a.afterChange(0, ["80", "5"]); advance(4000);
  ok("filled next row not entered", focusLog.length === 0, focusLog);
}

console.log(`check-calc-autoadvance: ${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
