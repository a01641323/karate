"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isElectron, apiGetDownloadInfo, apiPrepareDownload, getServerUrl, type DownloadInfo } from "@/lib/api-client";
import { NetworkStatusBadge } from "@/components/network-status-badge";
import { useArea } from "@/lib/area-context";

export function TopTabs() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { status, logout, isKiosk } = useAuth();
  const { role } = useArea();
  const [downloads, setDownloads] = useState<DownloadInfo | null>(null);
  const [downloading, setDownloading] = useState(false);

  const isAdminRole = role === "admin";

  useEffect(() => {
    if (isElectron() || status.kind !== "authed") return;
    apiGetDownloadInfo().then(setDownloads).catch(() => {});
  }, [status.kind]);

  async function handleDownloadApp() {
    if (!downloads?.mac || status.kind !== "authed") return;
    setDownloading(true);
    try {
      const { tokenId } = await apiPrepareDownload(status.session.token);
      const link = document.createElement("a");
      link.href = `${getServerUrl()}/api/download-app/${tokenId}`;
      link.download = "KarateTournament.dmg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Error preparing download. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  // The public scoreboard view is chromeless.
  if (pathname.startsWith("/public")) return null;
  // Login / lock screens render their own chrome.
  if (status.kind === "loading" || status.kind === "anonymous" || status.kind === "locked") {
    return null;
  }

  // Tabs depend on whether this device is in the per-area role (one
  // competition area: needs Private + Public scoreboard) or the
  // admin role (the orchestrator above all areas: gets Check-in and
  // the Manage heatmap, never Private/Public).
  const tabs: { href: string; label: string; external?: boolean }[] = isAdminRole
    ? [
        { href: "/admin",    label: "Admin" },
        { href: "/check-in", label: "Check-in" },
        { href: "/manage",   label: "Manage" },
      ]
    : [
        { href: "/admin",   label: "Admin" },
        { href: "/private", label: "Private" },
        { href: "/public",  label: "Public ↗", external: true },
      ];

  return (
    <nav id="tabs">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        if (t.external) {
          if (isElectron()) {
            return (
              <button
                key={t.href}
                type="button"
                className={`topbar-link${active ? " active" : ""}`}
                onClick={() => (window.__KARATE__ as { openPublicWindow?: () => void })?.openPublicWindow?.()}
              >
                {t.label}
              </button>
            );
          }
          return (
            <a
              key={t.href}
              href={t.href}
              target="_blank"
              rel="noopener"
              className={active ? "active" : ""}
            >
              {t.label}
            </a>
          );
        }
        return (
          <Link
            key={t.href}
            href={t.href}
            className={active ? "active" : ""}
          >
            {t.label}
          </Link>
        );
      })}
      <span className="brand">KARATE TOURNAMENT</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 12, alignItems: "center" }}>
        <NetworkStatusBadge variant="inline" />
        {!isKiosk ? (
          <button
            type="button"
            className="topbar-link"
            onClick={() => router.push("/area-select")}
            title="Choose a different competition area"
          >
            ← Change Area
          </button>
        ) : null}
        {!isElectron() && downloads?.mac && (
          <button
            type="button"
            className="topbar-link topbar-download"
            onClick={handleDownloadApp}
            disabled={downloading}
            title="Download the desktop app with your current session"
          >
            {downloading ? "Preparing…" : "↓ Download App"}
          </button>
        )}
        {!isKiosk && (
          <button type="button" className="topbar-link" onClick={logout}>
            Sign out
          </button>
        )}
      </span>
    </nav>
  );
}
