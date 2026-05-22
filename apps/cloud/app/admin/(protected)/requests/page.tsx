import { oauthConfigured } from "@/auth";
import { listPending } from "@/lib/requests";
import { GrantButton, RejectButton } from "./actions-ui";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  if (!oauthConfigured) return null;
  const pending = await listPending();
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-num">02</div>
        <div className="section-titles">
          <h2 className="section-title">Solicitudes pendientes</h2>
          <p className="section-sub">
            Cada solicitud genera un código de 6 dígitos al aprobarse.
            El código aparece en la página de espera del solicitante.
          </p>
        </div>
        <div className="section-meta">{pending.length} EN COLA</div>
      </div>

      {pending.length === 0 ? (
        <div className="card empty-card">
          <span className="empty-icon" aria-hidden>✓</span>
          <div>
            <div className="empty-title">No hay solicitudes pendientes</div>
            <div className="empty-sub">Las nuevas solicitudes aparecerán aquí.</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Organización</th>
                <th>Torneo</th>
                <th>Notas</th>
                <th>Solicitado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td className="muted">{r.org ?? "—"}</td>
                  <td className="muted">{r.tournamentDate ?? "—"}</td>
                  <td className="muted truncate">{r.notes ?? "—"}</td>
                  <td className="muted">{new Date(r.createdAt).toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row-actions">
                      <GrantButton id={r.id} />
                      <RejectButton id={r.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
