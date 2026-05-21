"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { areaLabel, buildAreaPlan } from "@karate/core";
import { useStore } from "@/lib/store";
import { useArea } from "@/lib/area-context";
import { useAuth } from "@/lib/auth-context";

export default function AreaSelectPage() {
  const router = useRouter();
  const { state } = useStore();
  const { setArea } = useArea();
  const { hasRole } = useAuth();
  const isSuperadmin = hasRole("superadmin");

  const plan = useMemo(
    () =>
      buildAreaPlan(
        {
          categoryOrder: state.tournament.categoryOrder,
          categories: state.tournament.categories,
          areaCount: state.tournament.settings.areaCount,
        },
        state.tournament.areaAssignments
      ),
    [state.tournament]
  );

  // Render every configured area, even if nothing is assigned yet —
  // a referee may still need to pick their area before participants
  // are uploaded.
  const areas = useMemo(() => {
    const out: { index: number; subCount: number; loadMatches: number }[] = [];
    for (let i = 0; i < state.tournament.settings.areaCount; i++) {
      const planArea = plan.areas[i];
      out.push({
        index: i,
        subCount: planArea?.subcategoryIds.length ?? 0,
        loadMatches: planArea?.load ?? 0,
      });
    }
    return out;
  }, [plan, state.tournament.settings.areaCount]);

  const totalSubs = areas.reduce((a, b) => a + b.subCount, 0);

  function pick(idx: number | null) {
    setArea(idx);
    router.push("/admin");
  }

  return (
    <main className="area-select">
      <h1>Choose your competition area</h1>
      <p className="lead">
        Select the area you'll referee. You can change it any time from the top
        bar.
      </p>

      {totalSubs === 0 && (
        <div className="area-notice">
          No subcategories assigned yet. You can still pick an area — once the
          administrator generates brackets, you&apos;ll see them here.
        </div>
      )}

      <div className="area-grid">
        {isSuperadmin && (
          <button
            className="area-card area-card-all"
            type="button"
            onClick={() => pick(null)}
            title="Superadmin view: see every area's subcategories together"
          >
            <div className="area-num">✦</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>All areas</div>
            <div className="area-meta">superadmin view</div>
          </button>
        )}
        {areas.map((a) => (
          <button
            key={a.index}
            className="area-card"
            type="button"
            onClick={() => pick(a.index)}
          >
            <div className="area-num">{a.index + 1}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{areaLabel(a.index)}</div>
            <div className="area-meta">
              {a.subCount} subcategor{a.subCount === 1 ? "y" : "ies"}
              {a.loadMatches > 0 && ` · ~${a.loadMatches} matches`}
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
