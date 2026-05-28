/**
 * Dojo-aware seeding.
 *
 * Goal: reduce the chance that two fighters from the SAME dojo (club)
 * meet in a category. Two levers, applied in order:
 *
 *   1. Cross-subcategory — spread a dojo's members across different
 *      subcategories so they simply aren't in the same bracket.
 *   2. Within-bracket distance — when a subcategory is forced to hold
 *      two members of one dojo (not enough subcategories), place them as
 *      far apart as possible so they meet only in a late round, if ever.
 *
 * This is a best-effort, never-blocking reorder: it always returns a
 * valid permutation of the input names. It changes nothing when there's
 * no dojo data, or no dojo has 2+ members.
 *
 * Key fact it relies on (see subcategories.ts): the ORDER of a
 * category's `competitors: string[]` fully determines placement —
 * `buildSubcategorySpecs` slices it into sequential chunks of G (one
 * per subcategory) and `buildStandardTree` pairs adjacent indices. So
 * reordering names here is enough; no bracket-builder changes needed.
 *
 * Deterministic: the input is already seed-shuffled, and every tie-break
 * falls back to input order, so the same seed + roster yields the same
 * arrangement.
 */

export interface DojoEntry {
  name: string;
  dojo?: string;
}

/** Normalize a dojo value; empty / whitespace counts as "no dojo". */
function normDojo(d: string | undefined): string {
  return (d ?? "").trim().toLowerCase();
}

/**
 * Bit-reversal permutation of [0..g). Reading positions in this order
 * visits maximally-distant bracket slots first (0, then the opposite
 * half, then opposite quarters, …), which is exactly where we want to
 * drop successive same-dojo fighters. Only meaningful for power-of-two
 * `g`; callers use natural order for other sizes.
 */
function bitReversalOrder(g: number): number[] {
  const bits = Math.round(Math.log2(g));
  const out: number[] = [];
  for (let i = 0; i < g; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) {
      if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    }
    out.push(r);
  }
  return out;
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Reorder a bin's members so same-dojo fighters land in the most
 * distant bracket slots. Returns names in final bracket-position order.
 */
function orderBinForDistance(members: DojoEntry[]): string[] {
  const g = members.length;
  if (g <= 1) return members.map((m) => m.name);

  // Group members by dojo, singletons (no dojo / unique) stay as their
  // own one-element groups. Order groups largest-first, ties by first
  // appearance, so the most-conflicting dojo is spread first.
  const groups = groupByDojo(members);

  // Round-robin the members across dojo groups: one from each group per
  // cycle. Same-dojo members end up >= (#groups) apart in this sequence.
  const sequence: DojoEntry[] = [];
  let remaining = g;
  while (remaining > 0) {
    for (const grp of groups) {
      const next = grp.shift();
      if (next) {
        sequence.push(next);
        remaining--;
      }
    }
  }

  // Place sequence[k] at the k-th most-distant slot. Only power-of-two
  // bins map cleanly onto a single-elim bracket; for series (2) /
  // round-robin (3) / mixed remainders everyone meets anyway, so the
  // order is cosmetic — keep the spread sequence as-is.
  if (isPowerOfTwo(g)) {
    const slots = bitReversalOrder(g);
    const placed: string[] = new Array(g);
    for (let k = 0; k < g; k++) {
      placed[slots[k]!] = sequence[k]!.name;
    }
    return placed;
  }
  return sequence.map((m) => m.name);
}

/**
 * Group entries by normalized dojo. Entries with no dojo become their
 * own singleton groups (they never conflict with anyone). Returns
 * groups sorted largest-first, ties broken by first-appearance order.
 * Each returned group is a fresh array (safe to mutate / shift).
 */
function groupByDojo(entries: DojoEntry[]): DojoEntry[][] {
  const byDojo = new Map<string, DojoEntry[]>();
  const singletons: DojoEntry[][] = [];
  const firstSeen = new Map<string, number>();

  entries.forEach((e, i) => {
    const d = normDojo(e.dojo);
    if (!d) {
      singletons.push([e]);
      return;
    }
    if (!byDojo.has(d)) {
      byDojo.set(d, []);
      firstSeen.set(d, i);
    }
    byDojo.get(d)!.push(e);
  });

  const named = [...byDojo.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return firstSeen.get(a[0])! - firstSeen.get(b[0])!;
  });

  // Named (multi-member) groups first so they drive the round-robin;
  // singletons fill the gaps.
  return [...named.map(([, arr]) => arr.slice()), ...singletons];
}

/**
 * Arrange competitor names so same-dojo fighters are kept apart.
 *
 * @param entries  seed-shuffled competitors with optional dojo.
 * @param size     the configured subcategory size G.
 * @returns        a permutation of `entries` names in final order.
 */
export function arrangeByDojo(entries: DojoEntry[], size: number): string[] {
  const N = entries.length;
  const G = Math.max(2, Math.floor(size) || 2);

  // Nothing to do: too small, or no dojo appears twice.
  if (N <= 2) return entries.map((e) => e.name);
  const counts = new Map<string, number>();
  for (const e of entries) {
    const d = normDojo(e.dojo);
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let anyConflict = false;
  for (const c of counts.values()) {
    if (c >= 2) { anyConflict = true; break; }
  }
  if (!anyConflict) return entries.map((e) => e.name);

  // --- Step 1: distribute into bins that mirror the subcategory chunks.
  // buildSubcategorySpecs slices `competitors` into sequential G-chunks;
  // bin b therefore becomes subcategory b. Capacities are G except the
  // last, which holds the remainder.
  const B = Math.ceil(N / G);
  const caps: number[] = [];
  for (let b = 0; b < B; b++) {
    caps.push(b < B - 1 ? G : N - (B - 1) * G);
  }
  const bins: DojoEntry[][] = Array.from({ length: B }, () => []);

  // Place dojo groups largest-first. For each member pick the bin with
  // capacity left that minimizes (same-dojo already there, then total),
  // tie → lowest index. Spreads each dojo across distinct bins first.
  const groups = groupByDojo(entries);
  for (const grp of groups) {
    const d = normDojo(grp[0]!.dojo);
    for (const member of grp) {
      let best = -1;
      let bestSame = Infinity;
      let bestTotal = Infinity;
      for (let b = 0; b < B; b++) {
        if (bins[b]!.length >= caps[b]!) continue;
        const same = d
          ? bins[b]!.filter((x) => normDojo(x.dojo) === d).length
          : 0;
        const total = bins[b]!.length;
        if (same < bestSame || (same === bestSame && total < bestTotal)) {
          best = b;
          bestSame = same;
          bestTotal = total;
        }
      }
      // Defensive: if every bin is somehow full, drop into the first
      // with room (shouldn't happen since sum(caps) === N).
      if (best < 0) best = bins.findIndex((bin, b) => bin.length < caps[b]!);
      bins[best]!.push(member);
    }
  }

  // --- Step 2: order each bin so any same-dojo pair sits far apart.
  // --- Step 3: flatten bins in order → final name list.
  const out: string[] = [];
  for (const bin of bins) {
    out.push(...orderBinForDistance(bin));
  }
  return out;
}
