import type { MatchState } from "./types";

export type TieBreakReason = "ippon" | "wasari" | "yuko";

/**
 * Decide a combat winner. Optional `pointDifferenceThreshold` triggers an
 * automatic win once one side leads by that many points (Karate-1 style),
 * regardless of timer state.
 *
 * Tiebreak order when totals + advantage are equal:
 *   1. more ippon  (3-point scores)
 *   2. more wasari (2-point scores)
 *   3. more yuko   (1-point scores)
 *   4. fall through to null (jury)
 */
export function computeCombatWinner(
  m: MatchState,
  pointDifferenceThreshold?: number
): "blue" | "red" | null {
  return computeCombatWinnerDetailed(m, pointDifferenceThreshold).side;
}

export function computeCombatWinnerDetailed(
  m: MatchState,
  pointDifferenceThreshold?: number,
): { side: "blue" | "red" | null; tieBreak?: TieBreakReason } {
  const blueOut = m.blueEliminated || m.bluePenalties >= 5;
  const redOut  = m.redEliminated  || m.redPenalties >= 5;
  if (blueOut && !redOut) return { side: "red" };
  if (redOut  && !blueOut) return { side: "blue" };
  if (blueOut && redOut)  return { side: null };

  if (typeof pointDifferenceThreshold === "number" && pointDifferenceThreshold > 0) {
    const diff = m.bluePoints - m.redPoints;
    if (diff  >= pointDifferenceThreshold) return { side: "blue" };
    if (-diff >= pointDifferenceThreshold) return { side: "red"  };
  }

  if (m.bluePoints > m.redPoints) return { side: "blue" };
  if (m.redPoints  > m.bluePoints) return { side: "red"  };

  if (m.blueAdvantage && !m.redAdvantage) return { side: "blue" };
  if (m.redAdvantage  && !m.blueAdvantage) return { side: "red"  };

  // Points + advantage tied → fall through to the ippon/wasari/yuko ladder.
  const bI = m.blueIppon  ?? 0, rI = m.redIppon  ?? 0;
  if (bI > rI) return { side: "blue", tieBreak: "ippon" };
  if (rI > bI) return { side: "red",  tieBreak: "ippon" };
  const bW = m.blueWasari ?? 0, rW = m.redWasari ?? 0;
  if (bW > rW) return { side: "blue", tieBreak: "wasari" };
  if (rW > bW) return { side: "red",  tieBreak: "wasari" };
  const bY = m.blueYuko   ?? 0, rY = m.redYuko   ?? 0;
  if (bY > rY) return { side: "blue", tieBreak: "yuko" };
  if (rY > bY) return { side: "red",  tieBreak: "yuko" };

  return { side: null };
}

export function computeKataWinner(m: MatchState): "blue" | "red" | null {
  if (m.blueEliminated && !m.redEliminated) return "red";
  if (m.redEliminated && !m.blueEliminated) return "blue";
  if (m.bluePoints > m.redPoints) return "blue";
  if (m.redPoints > m.bluePoints) return "red";
  return null;
}

export function computeWinner(
  m: MatchState,
  pointDifferenceThreshold?: number
): "blue" | "red" | null {
  return m.discipline === "kata"
    ? computeKataWinner(m)
    : computeCombatWinner(m, pointDifferenceThreshold);
}
