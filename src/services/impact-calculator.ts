import type { ComponentStatus } from "../services/db";
import type { UsageImport, ComponentImpact } from "../types/usage";

function parityStatusToScore(status: string): number {
  switch (status) {
    case "aligned":
      return 100;
    case "issues":
      return 60;
    case "critical":
      return 20;
    case "missing-in-figma":
      return 40;
    case "needs-review":
      return 70;
    default:
      return 50;
  }
}

export function computeComponentImpacts(
  usage: UsageImport,
  componentStatuses: Record<string, ComponentStatus>,
): ComponentImpact[] {
  const results: ComponentImpact[] = [];

  for (const entry of usage.components) {
    const status = componentStatuses[entry.component];
    if (!status) continue;

    const reachScore = (entry.repoCount / usage.totalRepos) * 100;
    const parityScore = parityStatusToScore(status.parityStatus);
    const a11yScore = status.a11yScore;
    const tokenScore = status.usesTokens ? 100 : 0;

    const qualityScore = parityScore * 0.4 + a11yScore * 0.4 + tokenScore * 0.2;
    const impactScore = (reachScore * qualityScore) / 100;

    results.push({
      componentName: entry.component,
      reachScore: Math.round(reachScore),
      qualityScore: Math.round(qualityScore),
      impactScore: Math.round(impactScore),
      repoCount: entry.repoCount,
      totalInstances: entry.totalInstances,
      repoList: entry.repos,
      needsAttention: reachScore > 50 && qualityScore < 60,
    });
  }

  return results;
}

export function computeOverallImpactScore(impacts: ComponentImpact[]): number {
  if (impacts.length === 0) return 0;
  const sum = impacts.reduce((acc, i) => acc + i.impactScore, 0);
  return Math.round(sum / impacts.length);
}
