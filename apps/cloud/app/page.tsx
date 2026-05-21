import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">Karate Tournament</h1>
        <p className="mt-3 text-lg text-zinc-400">
          A scoring system for karate tournaments. Runs as a local app on the
          operator&apos;s machine — no internet required during the event.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-white/10 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-zinc-300">
          <li>Request a tournament token here. You&apos;ll get a code once it&apos;s approved.</li>
          <li>Download the app for your operating system.</li>
          <li>Run the app, paste the code, and run your tournament for 24 hours.</li>
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/request"
          className="rounded bg-white px-5 py-2.5 font-medium text-black hover:bg-zinc-200"
        >
          Request a token
        </Link>
        <Link
          href="/download"
          className="rounded border border-white/15 px-5 py-2.5 font-medium text-white hover:bg-white/5"
        >
          Download the app
        </Link>
      </div>
    </main>
  );
}
