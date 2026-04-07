import type { ScanHistoryEntry } from "./db";

export interface ScanDelta {
  overallDelta: number;
  parityDelta: number;
  coverageDelta: number;
  a11yDelta: number;
  tokenDelta: number;
  resolvedComponents: string[];
  newIssueComponents: string[];
  previousTimestamp: string;
}

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

  const allNames = new Set([
    ...Object.keys(current.componentStatuses),
    ...Object.keys(previous.componentStatuses),
  ]);

  for (const name of allNames) {
    const curr = current.componentStatuses[name]?.parityStatus;
    const prev = previous.componentStatuses[name]?.parityStatus;

    if (prev && prev !== "aligned" && curr === "aligned") {
      resolvedComponents.push(name);
    }

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
