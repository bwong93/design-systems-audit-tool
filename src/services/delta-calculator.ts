import type { ScanHistoryEntry } from "./db";

export interface ScanDelta {
  overallDelta: number; // same as parityDelta — parity is the primary metric
  parityDelta: number;
  coverageDelta: number;
  a11yDelta: number;
  tokenDelta: number;
  resolvedComponents: string[]; // parityStatus changed TO "aligned"
  newIssueComponents: string[]; // parityStatus changed AWAY FROM "aligned"
  previousTimestamp: string;
}

/**
 * Compare two ScanHistoryEntry objects and return the delta between them.
 * Returns null if either entry is missing componentStatuses (pre-v7 entries).
 */
export function computeDelta(
  current: ScanHistoryEntry,
  previous: ScanHistoryEntry,
): ScanDelta | null {
  if (!current.componentStatuses || !previous.componentStatuses) return null;

  const parityDelta = current.parityScore - previous.parityScore;
  const coverageDelta = current.coverageScore - previous.coverageScore;
  const a11yDelta = current.a11yScore - previous.a11yScore;
  const tokenDelta = (current.tokenScore ?? 0) - (previous.tokenScore ?? 0);

  const resolvedComponents: string[] = [];
  const newIssueComponents: string[] = [];

  // Check every component that appears in current or previous
  const allNames = new Set([
    ...Object.keys(current.componentStatuses),
    ...Object.keys(previous.componentStatuses),
  ]);

  for (const name of allNames) {
    const curr = current.componentStatuses[name]?.parityStatus;
    const prev = previous.componentStatuses[name]?.parityStatus;

    // Resolved: was not "aligned", now is "aligned"
    if (prev && prev !== "aligned" && curr === "aligned") {
      resolvedComponents.push(name);
    }

    // New issue: was "aligned" (or absent), now is not "aligned"
    if (
      (prev === "aligned" || prev === undefined) &&
      curr &&
      curr !== "aligned"
    ) {
      newIssueComponents.push(name);
    }
  }

  return {
    overallDelta: parityDelta,
    parityDelta,
    coverageDelta,
    a11yDelta,
    tokenDelta,
    resolvedComponents,
    newIssueComponents,
    previousTimestamp: previous.timestamp,
  };
}
