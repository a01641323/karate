"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [tournamentDate, setTournamentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/request-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, org, tournamentDate, notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const { requestId, accessToken } = (await res.json()) as {
        requestId: string;
        accessToken: string;
      };
      router.push(`/pending/${requestId}?key=${encodeURIComponent(accessToken)}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Request a tournament token</h1>
        <p className="mt-3 text-zinc-400">
          Tell us who you are. The operator will review your request and your code
          will appear here once approved.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-white/10 bg-zinc-900 p-6">
        <Field label="Email *" required>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-white/10 bg-zinc-800 px-3 py-2 outline-none focus:border-blue-500"
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Organization / dojo">
          <input
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            className="w-full rounded border border-white/10 bg-zinc-800 px-3 py-2 outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="Tournament date">
          <input
            type="date"
            value={tournamentDate}
            onChange={(e) => setTournamentDate(e.target.value)}
            className="w-full rounded border border-white/10 bg-zinc-800 px-3 py-2 outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-24 w-full resize-y rounded border border-white/10 bg-zinc-800 px-3 py-2 outline-none focus:border-blue-500"
            placeholder="Anything we should know."
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-white px-5 py-2.5 font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Request token"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-300">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}
