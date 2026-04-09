import type { ScanHistoryEntry } from "./db";

export interface ScanDelta {
  overallDelta: number;
  parityDelta: number;
  coverageDelta: number;
  a11yDelta: number;
  tokenDelta: number;
  resolvedComponents: string[];
  newIssueComponents: string[];
  newA11yIssueComponents: string[];
  newTokenIssueComponents: string[];
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
  const newA11yIssueComponents: string[] = [];
  const newTokenIssueComponents: string[] = [];

  const allNames = new Set([
    ...Object.keys(current.componentStatuses),
    ...Object.keys(previous.componentStatuses),
  ]);

  for (const name of allNames) {
    const curr = current.componentStatuses[name];
    const prev = previous.componentStatuses[name];

    if (
      prev &&
      prev.parityStatus !== "aligned" &&
      curr?.parityStatus === "aligned"
    ) {
      resolvedComponents.push(name);
    }

    if (
      (prev?.parityStatus === "aligned" || prev === undefined) &&
      curr &&
      curr.parityStatus !== "aligned"
    ) {
      newIssueComponents.push(name);
    }

    if (curr && prev && curr.a11yScore < prev.a11yScore) {
      newA11yIssueComponents.push(name);
    }

    const prevUsesTokens = prev?.usesTokens ?? true;
    if (curr && !curr.usesTokens && prevUsesTokens) {
      newTokenIssueComponents.push(name);
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
    newA11yIssueComponents,
    newTokenIssueComponents,
    previousTimestamp: previous.timestamp,
  };
}
