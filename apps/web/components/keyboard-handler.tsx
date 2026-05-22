"use client";

import { useEffect, useRef, useState } from "react";
import type { CommandKey } from "@karate/core";
import { useStore } from "@/lib/store";

interface InputState {
  selected: "blue" | "red" | null;
  undoArmed: boolean;
  expiresAt: number;
}

interface LastAction {
  kind: "score" | "penalty" | "advantage";
  side: "blue" | "red";
  /** Magnitude of the delta that landed (+1/+2/+3 for score, +1 for penalty). */
  delta: number;
  ts: number;
}

const UNDO_WINDOW_MS = 10_000;

interface Props {
  /** When true, all keyboard input is suppressed (e.g. modal open). */
  suppress: boolean;
}

export function KeyboardHandler({ suppress }: Props) {
  const {
    state,
    addPoints,
    setAdvantage,
    addPenalty,
    adjustTimer,
    togglePause,
    advanceActiveMatch,
    actionable,
  } = useStore();
  const [tick, setTick] = useState(0);
  const inputRef = useRef<InputState>({
    selected: null,
    undoArmed: false,
    expiresAt: 0,
  });
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  // The most recent score/penalty/advantage we sent. Backspace/Del with
  // no side selected reverses this if it landed within UNDO_WINDOW_MS.
  const lastActionRef = useRef<LastAction | null>(null);

  function recordAction(kind: LastAction["kind"], side: "blue" | "red", delta: number) {
    lastActionRef.current = { kind, side, delta, ts: Date.now() };
  }

  const reset = () => {
    inputRef.current = { selected: null, undoArmed: false, expiresAt: 0 };
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTick((x) => x + 1);
  };

  const select = (side: "blue" | "red") => {
    // Sticky selection — no auto-expiry. Selection persists until the user
    // picks the other side, presses Esc, or a new match is loaded. The
    // previous 5-second timeout was confusing in practice: you'd click a
    // match in the bracket, miss the window, and then 1/2/3 stopped
    // responding until you re-pressed R or A.
    inputRef.current = { selected: side, undoArmed: false, expiresAt: 0 };
    if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    setTick((x) => x + 1);
  };

  useEffect(() => {
    if (suppress) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (state.jury) return;
      if (!actionable) return;

      const k = state.settings.keys;
      const key = e.key;
      const lk = key.length === 1 ? key.toLowerCase() : key;
      const norm = (s: string) =>
        typeof s === "string" && s.length === 1 ? s.toLowerCase() : s;
      const isKata = state.match.discipline === "kata";

      // Prevent browser navigation/scroll for any key our app owns,
      // regardless of game state (before isKata / selected guards).
      const ownedKeys = new Set([
        k.pauseTimer, k.addSecond, k.subSecond, k.undo, "Enter",
        k.add1, k.add2, k.add3,
        norm(k.selectRed), norm(k.selectBlue),
        norm(k.senshu), norm(k.penalty),
        // Aliases for the digit + undo keys.
        "y", "w", "i", "Backspace", "Escape",
      ]);
      if (ownedKeys.has(lk) || ownedKeys.has(key)) e.preventDefault();

      if (key === k.pauseTimer || (k.pauseTimer === " " && key === " ")) {
        if (isKata) return;
        togglePause();
        return;
      }
      if (key === k.addSecond) {
        if (isKata) return;
        adjustTimer(1);
        return;
      }
      if (key === k.subSecond) {
        if (isKata) return;
        adjustTimer(-1);
        return;
      }
      if (lk === norm(k.selectRed)) {
        select("red");
        return;
      }
      if (lk === norm(k.selectBlue)) {
        select("blue");
        return;
      }
      if (key === "Enter") {
        // Only advance when the match is genuinely over: winner declared,
        // timer hit zero, or someone reached 5 penalties (which also
        // sets timer.finished via the reducer). This stops accidental
        // mid-match advances.
        const m = state.match;
        const matchOver =
          !!m.activeMatchRef &&
          (state.timer.finished ||
            state.timer.remaining === 0 ||
            m.bluePenalties >= 5 ||
            m.redPenalties >= 5 ||
            m.blueEliminated ||
            m.redEliminated);
        if (matchOver) advanceActiveMatch();
        return;
      }
      const cur = inputRef.current;
      // Esc clears the sticky side selection.
      if (key === "Escape") {
        reset();
        return;
      }

      // Delete / Backspace pressed WITHOUT a side selected → 10-second
      // global undo. Reverses the most recent score/penalty/advantage
      // if it landed inside the window; silent no-op otherwise.
      const isUndoKey = key === k.undo || key === "Delete" || key === "Backspace";
      if (isUndoKey && !cur.selected) {
        const la = lastActionRef.current;
        if (la && Date.now() - la.ts <= UNDO_WINDOW_MS) {
          e.preventDefault();
          if (la.kind === "score") addPoints(la.side, -la.delta);
          else if (la.kind === "penalty") addPenalty(la.side, -la.delta);
          else if (la.kind === "advantage") setAdvantage(la.side, false);
          lastActionRef.current = null;
        }
        return;
      }

      if (!cur.selected) return;

      if (isUndoKey) {
        // Side IS selected → flip the per-side undo-armed flag (legacy chord).
        cur.undoArmed = !cur.undoArmed;
        setTick((x) => x + 1);
        return;
      }
      const sign = cur.undoArmed ? -1 : 1;
      const sel = cur.selected;
      // Hardcoded key aliases for ergonomics:
      //   Y also = 1   W also = 2   I also = 3
      // Backspace handled above (alias for Delete/undo).
      const isAdd1 = lk === norm(k.add1) || lk === "y";
      const isAdd2 = lk === norm(k.add2) || lk === "w";
      const isAdd3 = lk === norm(k.add3) || lk === "i";

      // Score / penalty / senshu actions keep the side selected after firing
      // so the operator can rapid-fire multiple inputs on the same fighter
      // without re-pressing R or A every time. Only the undo-armed flag
      // resets (single-use).
      if (isAdd1) {
        e.preventDefault(); addPoints(sel, 1 * sign); recordAction("score", sel, 1 * sign);
        cur.undoArmed = false; setTick((x) => x + 1); return;
      }
      if (isAdd2) {
        e.preventDefault(); addPoints(sel, 2 * sign); recordAction("score", sel, 2 * sign);
        cur.undoArmed = false; setTick((x) => x + 1); return;
      }
      if (isAdd3) {
        e.preventDefault(); addPoints(sel, 3 * sign); recordAction("score", sel, 3 * sign);
        cur.undoArmed = false; setTick((x) => x + 1); return;
      }
      if (lk === norm(k.senshu)) {
        if (isKata) return;
        e.preventDefault();
        setAdvantage(sel, !cur.undoArmed);
        if (!cur.undoArmed) recordAction("advantage", sel, 1);
        cur.undoArmed = false;
        setTick((x) => x + 1);
        return;
      }
      if (lk === norm(k.penalty)) {
        if (isKata) return;
        e.preventDefault();
        addPenalty(sel, sign);
        recordAction("penalty", sel, sign);
        cur.undoArmed = false;
        setTick((x) => x + 1);
        return;
      }
    };
    // Capture phase so a focused bracket-button (Space → re-fires its
    // click) doesn't steal Space/Enter from us.
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [state, addPoints, setAdvantage, addPenalty, adjustTimer, togglePause, advanceActiveMatch, suppress, actionable]);

  // input-state hint banner
  const cur = inputRef.current;
  void tick;
  let content: React.ReactNode = (
    <span className="muted">Press <kbd className="kbd">A</kbd> or <kbd className="kbd">R</kbd> to select a side</span>
  );
  if (cur.selected) {
    content = (
      <>
        <span className={cur.selected === "red" ? "red-tag" : "blue-tag"}>
          {cur.selected === "red" ? "Red selected" : "Blue selected"}
        </span>{" "}
        {cur.undoArmed ? <span className="undo-tag">UNDO armed</span> : null}{" "}
        <span className="muted countdown">Esc to clear</span>
      </>
    );
  }

  return (
    <div className="input-state">
      <span className="label">INPUT:</span>
      {content}
    </div>
  );
}
