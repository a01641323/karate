import Link from "next/link";
import { oauthConfigured } from "@/auth";
import { listPending } from "@/lib/requests";
import { listAllCodes } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  if (!oauthConfigured) return null;
  const [pending, codes] = await Promise.all([listPending(), listAllCodes()]);
  const now = Date.now();
  const active = codes.filter(
    (c) => c.status !== "revoked" && c.expiresAt > now,
  );
  const used = codes.filter((c) => c.status === "used" && c.expiresAt > now);
  const revoked = codes.filter((c) => c.status === "revoked");

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-num">01</div>
        <div className="section-titles">
          <h2 className="section-title">Panel</h2>
          <p className="section-sub">
            Solicitudes pendientes, códigos activos, revocaciones.
          </p>
        </div>
        <div className="section-meta">SUPERADMIN</div>
      </div>

      <div className="stat-grid">
        <Stat label="Solicitudes pendientes" value={pending.length} accent={pending.length > 0} />
        <Stat label="Códigos activos" value={active.length} />
        <Stat label="Activados (en uso)" value={used.length} />
        <Stat label="Revocados" value={revoked.length} />
      </div>

      <div className="admin-cta-row">
        <Link href="/admin/requests" className="btn primary">
          Revisar solicitudes →
        </Link>
        <Link href="/admin/codes" className="btn ghost">
          Ver códigos →
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`stat-card ${accent ? "accent" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
