"use client";

import { subcategoryStatus } from "@karate/core";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { useArea } from "@/lib/area-context";
import { PaceBadge } from "@/components/pace-badge";

interface Props {
  onOpenTournamentSettings: () => void;
}

export function AdminSidebar({ onOpenTournamentSettings }: Props) {
  const { state, setActiveCategory, setActiveSubcategory } = useStore();
  const { hasRole } = useAuth();
  const { current: areaIdx, setArea } = useArea();
  const t = state.tournament;
  const isSuperadmin = hasRole("superadmin");
  // Area filter applies to anyone who has picked an area. Superadmin can
  // explicitly choose "all areas" (areaIdx === null) to see the union view.
  const filterByArea = typeof areaIdx === "number";

  return (
    <aside className="admin-sidebar">
      {isSuperadmin ? (
        <button className="tourn-settings-btn" onClick={onOpenTournamentSettings}>
          ⚙ Tournament Settings
        </button>
      ) : null}
      <div className="area-chip">
        <span className="muted-mono">VIEWING</span>
        <span className="area-chip-label">
          {filterByArea ? `Area ${areaIdx! + 1}` : "All areas"}
        </span>
        {isSuperadmin && filterByArea ? (
          <button type="button" className="area-chip-link" onClick={() => setArea(null)}>
            show all
          </button>
        ) : null}
      </div>
      <h3>Categories</h3>
      <div>
        {t.categoryOrder.map((cid) => {
          const cat = t.categories[cid];
          if (!cat) return null;

          // Filter subcategories by area for referees.
          const visibleSubs = filterByArea
            ? cat.subcategories.filter(
                (s) => t.areaAssignments[s.id] === areaIdx
              )
            : cat.subcategories;
          if (filterByArea && visibleSubs.length === 0) return null;

          const isActiveCat = cid === t.activeCategoryId;
          const isLocked = cat.started === false;
          return (
            <div key={cid} className={`cat-group ${isLocked ? "locked" : ""}`}>
              <button
                className={`cat-btn ${isActiveCat ? "active" : ""}`}
                onClick={() => setActiveCategory(cid)}
              >
                <span>{cat.name}</span>
                <span className="count">
                  {isLocked
                    ? `${cat.competitors.length} · locked`
                    : `${cat.competitors.length} · ${visibleSubs.length}`}
                </span>
              </button>
              {isActiveCat && isLocked ? (
                <div className="cat-locked-note">
                  <span className="lock-icon" aria-hidden>⛌</span>
                  <div>
                    <div className="lock-title">Awaiting check-in</div>
                    <div className="lock-sub">Confirm arrivals from the Check-in tab to unlock brackets.</div>
                  </div>
                </div>
              ) : null}
              {isActiveCat && !isLocked ? (
                <div className="subcat-list">
                  {visibleSubs.map((sub) => {
                    const status = subcategoryStatus(sub);
                    const isActiveSub = sub.id === cat.activeSubcategoryId;
                    return (
                      <button
                        key={sub.id}
                        className={`subcat-btn ${isActiveSub ? "active" : ""}`}
                        onClick={() => setActiveSubcategory(cid, sub.id)}
                      >
                        <span className={`status-dot ${status}`} />
                        <span>{sub.label}</span>
                        {sub.tag ? (
                          <span className={`subcat-tag ${sub.tag}`}>
                            {sub.tag}
                          </span>
                        ) : null}
                        <PaceBadge state={state} subcategoryId={sub.id} />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
