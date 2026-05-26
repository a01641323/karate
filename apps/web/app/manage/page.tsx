"use client";

// Admin "Manage" view: per-area pace heatmap.
//
// Each area gets a card colored by its **worst** active subcategory's
// paceTier (the engine already buckets pace into ahead → ontime →
// warn → behind). The admin can spot a slow area at a glance.

import { useMemo } from "react";
import {
  areaLabel,
  buildAreaPlan,
  type Subcategory,
} from "@karate/core";
import { useStore } from "@/lib/store";

type Tier = "ahead" | "ontime" | "warn" | "behind" | "idle";

const TIER_ORDER: Record<Tier, number> = {
  // Worst first so reduce(max-of) picks the most concerning.
  behind: 4,
  warn: 3,
  idle: 2,
  ontime: 1,
  ahead: 0,
};

const TIER_COLOR: Record<Tier, string> = {
  ahead:  "#10b981", // green
  ontime: "#65a30d", // green-yellow
  idle:   "#9ca3af", // neutral grey
  warn:   "#f59e0b", // amber
  behind: "#ef4444", // red
};

const TIER_LABEL: Record<Tier, string> = {
  ahead:  "Adelantado",
  ontime: "En tiempo",
  idle:   "Sin actividad",
  warn:   "Atención",
  behind: "Atrasado",
};

function worstTier(a: Tier, b: Tier): Tier {
  return TIER_ORDER[a] >= TIER_ORDER[b] ? a : b;
}

function fmtDelta(s: number | null | undefined): string {
  if (s == null) return "—";
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  const sign = s >= 0 ? "+" : "−";
  return `${sign}${m}m ${String(sec).padStart(2, "0")}s`;
}

export default function ManagePage() {
  const { state } = useStore();

  const plan = useMemo(
    () =>
      buildAreaPlan(
        {
          categoryOrder: state.tournament.categoryOrder,
          categories: state.tournament.categories,
          areaCount: state.tournament.settings.areaCount,
        },
        state.tournament.areaAssignments,
      ),
    [state.tournament],
  );

  /**
   * For each area, walk its subcategoryIds, look up their pace tier
   * from the engine, and aggregate to the worst tier. Also collect a
   * representative paceDeltaSeconds (the worst signed delta) so the
   * card can surface "+4m 12s" beneath the colored band.
   */
  const rows = useMemo(() => {
    const eng = state.engine;
    const out: {
      index: number;
      tier: Tier;
      worstDelta: number | null;
      activeSubs: number;
      totalSubs: number;
      behindNames: string[];
    }[] = [];

    // Helper: find a Subcategory by id by walking every category.
    const findSub = (subId: string): Subcategory | null => {
      for (const catId of state.tournament.categoryOrder) {
        const cat = state.tournament.categories[catId];
        if (!cat) continue;
        for (const s of cat.subcategories) {
          if (s.id === subId) return s;
        }
      }
      return null;
    };

    for (let i = 0; i < state.tournament.settings.areaCount; i++) {
      const planArea = plan.areas[i];
      const subIds = planArea?.subcategoryIds ?? [];
      let tier: Tier = "idle";
      let worstDelta: number | null = null;
      let activeSubs = 0;
      const behindNames: string[] = [];
      for (const subId of subIds) {
        const runtime = eng?.subcategories?.[subId];
        const t = (runtime?.paceTier ?? null) as Tier | null;
        if (!t) continue;
        activeSubs += 1;
        tier = worstTier(tier, t);
        const d = runtime?.paceDeltaSeconds ?? null;
        if (d != null && (worstDelta == null || d > worstDelta)) worstDelta = d;
        if (t === "behind" || t === "warn") {
          const sub = findSub(subId);
          if (sub?.label) behindNames.push(sub.label);
        }
      }
      out.push({
        index: i,
        tier,
        worstDelta,
        activeSubs,
        totalSubs: subIds.length,
        behindNames,
      });
    }
    return out;
  }, [plan, state.tournament, state.engine]);

  return (
    <main className="manage">
      <header className="manage-head">
        <h1>Manage</h1>
        <p className="lead">
          Vista de ritmo por área. El color refleja la subcategoría más
          atrasada que se está peleando ahora — verde si todo va a tiempo,
          rojo si una está demorada.
        </p>
      </header>

      <ul className="manage-legend">
        {(["ahead", "ontime", "idle", "warn", "behind"] as Tier[]).map((t) => (
          <li key={t} className="manage-legend-item">
            <span className="manage-swatch" style={{ background: TIER_COLOR[t] }} />
            <span>{TIER_LABEL[t]}</span>
          </li>
        ))}
      </ul>

      <div className="manage-grid">
        {rows.map((r) => {
          const color = TIER_COLOR[r.tier];
          return (
            <div
              key={r.index}
              className="manage-card"
              style={{
                borderColor: color,
                background: `color-mix(in oklab, ${color} 14%, transparent)`,
              }}
            >
              <div className="manage-card-head">
                <div className="manage-card-num">{r.index + 1}</div>
                <div className="manage-card-title">{areaLabel(r.index)}</div>
                <span className="manage-card-tier" style={{ color }}>
                  {TIER_LABEL[r.tier]}
                </span>
              </div>

              <div className="manage-card-stats">
                <div>
                  <div className="manage-stat-k">Subcat. activas</div>
                  <div className="manage-stat-v">{r.activeSubs} / {r.totalSubs}</div>
                </div>
                <div>
                  <div className="manage-stat-k">Desviación</div>
                  <div className="manage-stat-v mono">{fmtDelta(r.worstDelta)}</div>
                </div>
              </div>

              {r.behindNames.length > 0 && (
                <div className="manage-card-behind">
                  <div className="manage-stat-k" style={{ marginBottom: 4 }}>
                    Necesitan atención
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {r.behindNames.slice(0, 4).map((n) => (
                      <li key={n} className="manage-card-behind-row">{n}</li>
                    ))}
                    {r.behindNames.length > 4 && (
                      <li className="manage-card-behind-row muted">
                        +{r.behindNames.length - 4} más
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
