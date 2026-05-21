"use client";

import type { AppState } from "@karate/core";

interface Props {
  state: AppState;
  subcategoryId: string;
}

/**
 * Small pace-status chip rendered next to each running subcategory in the
 * admin sidebar. Reads engine state computed by runEngineTick:
 *   - paceTier: ahead / ontime / warn / behind
 *   - paceDeltaSeconds: signed integer (negative = ahead)
 *
 * Returns null when the subcategory has no live pace data yet (no matches
 * started) — keeps the sidebar quiet for pending subs.
 */
export function PaceBadge({ state, subcategoryId }: Props) {
  const runtime = state.engine?.subcategories?.[subcategoryId];
  if (!runtime || !runtime.paceTier || runtime.paceDeltaSeconds == null) return null;

  const delta = runtime.paceDeltaSeconds;
  const abs = Math.abs(delta);
  const sign = delta < 0 ? "−" : "+";
  const mm = Math.floor(abs / 60).toString().padStart(2, "0");
  const ss = (abs % 60).toString().padStart(2, "0");

  return (
    <span className={`pace-badge tier-${runtime.paceTier}`} title={tierTooltip(runtime.paceTier)}>
      {sign}{mm}:{ss}
    </span>
  );
}

function tierTooltip(tier: NonNullable<NonNullable<AppState["engine"]>["subcategories"][string]["paceTier"]>): string {
  switch (tier) {
    case "ahead":  return "Ahead of expected pace";
    case "ontime": return "On expected pace";
    case "warn":   return "Slowing down — pace is slipping";
    case "behind": return "Behind expected pace — next match may be redirected";
  }
}
