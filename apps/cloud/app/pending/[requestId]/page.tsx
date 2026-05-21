"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Status =
  | { status: "pending"; createdAt: number }
  | { status: "granted"; code: string | null; ttlHours: number | null; expiresAt: number | null }
  | { status: "rejected"; rejectionReason: string | null };

const POLL_MS = 5000;

export default function PendingPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const search = useSearchParams();
  const key = search.get("key");
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const url = `/api/requests/${encodeURIComponent(requestId)}/status${
          key ? `?key=${encodeURIComponent(key)}` : ""
        }`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          setError(res.status === 401 ? "This page is private. Open the original link." : `HTTP ${res.status}`);
          return;
        }
        const j = (await res.json()) as Status;
        if (stopped) return;
        setData(j);
        if (j.status === "pending") timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (!stopped) setError((err as Error).message);
      }
    }
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [requestId, key]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Your token request</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Bookmark this page — your code will appear here once approved.
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      )}

      {!error && !data && <p className="text-zinc-400">Loading…</p>}

      {data?.status === "pending" && (
        <div className="rounded-lg border border-white/10 bg-zinc-900 p-6 text-center">
          <p className="text-xl font-medium">Waiting for approval</p>
          <p className="mt-2 text-sm text-zinc-400">
            We check for updates every 5 seconds. Leave this tab open or come back to this URL.
          </p>
        </div>
      )}

      {data?.status === "granted" && data.code && (
        <div className="space-y-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-6">
          <p className="text-xl font-medium">Your activation code</p>
          <div className="rounded bg-zinc-950 p-4 text-center font-mono text-4xl tracking-widest">
            {data.code}
          </div>
          <p className="text-sm text-zinc-300">
            Valid for{" "}
            {data.ttlHours ? `${data.ttlHours} hours` : "one tournament day"} once activated.
            Single-use; locks to the first machine that redeems it.
          </p>
          <Link
            href="/download"
            className="inline-block rounded bg-white px-5 py-2.5 font-medium text-black hover:bg-zinc-200"
          >
            Download the app →
          </Link>
        </div>
      )}

      {data?.status === "granted" && !data.code && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6">
          <p className="font-medium">Code revoked or unavailable</p>
          <p className="mt-2 text-sm text-zinc-300">
            Contact the operator if you believe this is an error.
          </p>
        </div>
      )}

      {data?.status === "rejected" && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-6">
          <p className="font-medium">Request rejected</p>
          {data.rejectionReason && (
            <p className="mt-2 text-sm text-zinc-300">{data.rejectionReason}</p>
          )}
        </div>
      )}
    </main>
  );
}
