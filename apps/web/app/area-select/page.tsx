"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { areaLabel, buildAreaPlan } from "@karate/core";
import { useStore } from "@/lib/store";
import { useArea, type AreaRole } from "@/lib/area-context";

export default function AreaSelectPage() {
  const router = useRouter();
  const { state } = useStore();
  const { setArea } = useArea();

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

  function pick(idx: number | null, role: AreaRole) {
    setArea(idx, role);
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

      {/* Admin role lives in its own horizontal rectangle above the
          area grid — it spans the full row to set it apart from a
          competition area. */}
      <button
        className="area-card area-card-admin"
        type="button"
        onClick={() => pick(null, "admin")}
        title="Vista del administrador del torneo (check-in + manage)"
      >
        <div className="area-num">✦</div>
        <div className="area-card-admin-titles">
          <div style={{ fontSize: 18, fontWeight: 700 }}>Administrador</div>
          <div className="area-meta">
            Check-in y panel de control de todas las áreas
          </div>
        </div>
        <div className="area-card-admin-tags">
          <span className="tag-chip">Admin</span>
          <span className="tag-chip">Check-in</span>
          <span className="tag-chip">Manage</span>
        </div>
      </button>

      <div className="area-grid">
        {areas.map((a) => (
          <button
            key={a.index}
            className="area-card"
            type="button"
            onClick={() => pick(a.index, "area")}
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
