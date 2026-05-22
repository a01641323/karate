"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface CodeRow {
  codeId: string;
  status: "unused" | "used" | "revoked";
  createdAt: number;
  expiresAt: number;
  activatedAt: number | null;
  ttlHours: number;
  machineFingerprint: string | null;
  email: string | null;
  org: string | null;
  tournamentDate: string | null;
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function pillForStatus(row: CodeRow, now: number) {
  if (row.status === "revoked") return { cls: "pill-revoked", label: "Revocado" };
  if (row.expiresAt <= now) return { cls: "pill-expired", label: "Vencido" };
  if (row.status === "used") return { cls: "pill-used", label: "Activo" };
  return { cls: "pill-unused", label: "Sin usar" };
}

export function CodesTable({ rows }: { rows: CodeRow[] }) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function revoke(codeId: string) {
    if (busy) return;
    if (!confirm("¿Revocar este código? Si está activado, la sesión se corta inmediatamente.")) return;
    setBusy(codeId);
    try {
      const r = await fetch(`/api/admin/codes/${encodeURIComponent(codeId)}/revoke`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(`No se pudo revocar: ${j.error ?? r.status}`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="admin-table codes-table">
        <thead>
          <tr>
            <th>Estado</th>
            <th>Email · Organización</th>
            <th>Tiempo restante</th>
            <th>Emitido</th>
            <th>Activado</th>
            <th>codeId</th>
            <th style={{ textAlign: "right" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pill = pillForStatus(row, now);
            const remaining = row.expiresAt - now;
            const canRevoke = row.status !== "revoked" && row.expiresAt > now;
            return (
              <tr key={row.codeId}>
                <td>
                  <span className={`status-pill ${pill.cls}`}>{pill.label}</span>
                </td>
                <td>
                  <div>{row.email ?? "—"}</div>
                  <div className="muted small">
                    {row.org ?? "sin organización"}
                    {row.tournamentDate ? ` · ${row.tournamentDate}` : ""}
                  </div>
                </td>
                <td className="mono">{fmtRemaining(remaining)}</td>
                <td className="muted small">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="muted small">
                  {row.activatedAt ? new Date(row.activatedAt).toLocaleString() : "—"}
                </td>
                <td className="mono small muted">{row.codeId}</td>
                <td style={{ textAlign: "right" }}>
                  {canRevoke ? (
                    <button
                      className="btn-row danger"
                      onClick={() => revoke(row.codeId)}
                      disabled={busy === row.codeId}
                    >
                      {busy === row.codeId ? "…" : "Revocar"}
                    </button>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
