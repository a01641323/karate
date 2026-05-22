import Link from "next/link";
import { auth, signOut, oauthConfigured } from "@/auth";
import { redirect } from "next/navigation";
import { TopBar, Footer } from "@/components/chrome";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!oauthConfigured) {
    return (
      <div>
        <TopBar />
        <section className="section">
          <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
            <div className="card-head">
              <span className="card-eyebrow">CONFIGURACIÓN</span>
              <span className="card-meta">Bloqueado</span>
            </div>
            <h1 className="section-title" style={{ fontSize: 22, marginBottom: 12 }}>
              Admin panel not configured
            </h1>
            <p style={{ color: "var(--color-fg-2)", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
              The deploy is missing one or more required environment variables:
            </p>
            <ul style={{ display: "grid", gap: 4, paddingLeft: 18, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-fg)" }}>
              <li>GITHUB_CLIENT_ID</li>
              <li>GITHUB_CLIENT_SECRET</li>
              <li>SUPERADMIN_GITHUB_ID</li>
              <li>AUTH_SECRET</li>
            </ul>
            <p style={{ marginTop: 16, fontSize: 13, color: "var(--color-fg-2)" }}>
              Set these in Vercel → Settings → Environment Variables, then redeploy.
            </p>
            <Link href="/" className="muted-link" style={{ display: "inline-block", marginTop: 12 }}>← Back</Link>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  const session = await auth();
  if (!session) redirect("/admin/login");

  return (
    <div>
      <TopBar />
      <div className="admin-shell">
        <nav className="admin-subnav">
          <div className="admin-subnav-inner">
            <div className="admin-subnav-links">
              <Link href="/admin" className="admin-subnav-link">Dashboard</Link>
              <Link href="/admin/requests" className="admin-subnav-link">Requests</Link>
              <Link href="/admin/codes" className="admin-subnav-link">Códigos</Link>
            </div>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <button className="admin-signout">Sign out</button>
            </form>
          </div>
        </nav>
        <main className="admin-main-wrap">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
