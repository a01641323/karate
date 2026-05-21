"use client";

import { useEffect, useRef, useState } from "react";
import type { CommandKey } from "@karate/core";
import { useStore } from "@/lib/store";

interface InputState {
  selected: "blue" | "red" | null;
  undoArmed: boolean;
  expiresAt: number;
}

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
        advanceActiveMatch();
        return;
      }
      const cur = inputRef.current;
      // Esc clears the sticky side selection.
      if (key === "Escape") {
        reset();
        return;
      }
      if (!cur.selected) return;

      if (key === k.undo) {
        cur.undoArmed = !cur.undoArmed;
        setTick((x) => x + 1);
        return;
      }
      const sign = cur.undoArmed ? -1 : 1;
      const sel = cur.selected;
      // Score / penalty / senshu actions keep the side selected after firing
      // so the operator can rapid-fire multiple inputs on the same fighter
      // without re-pressing R or A every time. Only the undo-armed flag
      // resets (single-use).
      if (lk === norm(k.add1)) {
        e.preventDefault(); addPoints(sel, 1 * sign); cur.undoArmed = false; setTick((x) => x + 1); return;
      }
      if (lk === norm(k.add2)) {
        e.preventDefault(); addPoints(sel, 2 * sign); cur.undoArmed = false; setTick((x) => x + 1); return;
      }
      if (lk === norm(k.add3)) {
        e.preventDefault(); addPoints(sel, 3 * sign); cur.undoArmed = false; setTick((x) => x + 1); return;
      }
      if (lk === norm(k.senshu)) {
        if (isKata) return;
        e.preventDefault();
        setAdvantage(sel, !cur.undoArmed);
        cur.undoArmed = false;
        setTick((x) => x + 1);
        return;
      }
      if (lk === norm(k.penalty)) {
        if (isKata) return;
        e.preventDefault();
        addPenalty(sel, sign);
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
