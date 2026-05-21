// Placeholder download page. Wired to /api/downloads/[os] redirects
// once the GitHub Actions release pipeline ships binaries (next PR).

export default function DownloadPage() {
  const items = [
    { os: "darwin-arm64", label: "macOS (Apple Silicon)" },
    { os: "darwin-x64", label: "macOS (Intel)" },
    { os: "win-x64", label: "Windows" },
    { os: "linux-x64", label: "Linux" },
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Download the app</h1>
        <p className="mt-3 text-zinc-400">
          Pick your operating system. Each binary is self-contained — no installer required.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <a
            key={item.os}
            href={`/api/downloads/${item.os}`}
            className="rounded-lg border border-white/10 bg-zinc-900 p-5 hover:border-white/30"
          >
            <div className="text-lg font-medium">{item.label}</div>
            <div className="mt-1 text-xs text-zinc-500 font-mono">{item.os}</div>
          </a>
        ))}
      </div>

      <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
        <strong>First-launch:</strong> Unsigned binaries trigger a warning the first
        time. On macOS: right-click → Open → confirm. On Windows: SmartScreen → More
        info → Run anyway. We&apos;ll add code signing once distribution stabilises.
      </section>
    </main>
  );
}
