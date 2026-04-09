import type { ComponentUsage } from "../types/usage";
import { findBestMatch, MATCH_SUGGEST } from "../utils/fuzzy-match";

export function parseUsageCSV(csvText: string): ComponentUsage[] {
  const lines = csvText.split("\n");
  const grouped = new Map<
    string,
    { casing: string; repos: Map<string, number> }
  >();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(",");
    const component = parts[0]?.trim() ?? "";
    const repo = parts[1]?.trim() ?? "";
    const rawInstances = parts[2]?.trim();

    if (!component || !repo) continue;

    const lower = component.toLowerCase();
    if (lower === "component") continue;

    const instances =
      rawInstances && /^\d+$/.test(rawInstances)
        ? parseInt(rawInstances, 10)
        : 1;

    if (!grouped.has(lower)) {
      grouped.set(lower, { casing: component, repos: new Map() });
    }

    const entry = grouped.get(lower)!;
    entry.repos.set(repo, (entry.repos.get(repo) ?? 0) + instances);
  }

  return Array.from(grouped.values()).map(({ casing, repos }) => {
    const repoList = Array.from(repos.entries()).map(([name, instances]) => ({
      name,
      instances,
    }));
    const totalInstances = repoList.reduce((sum, r) => sum + r.instances, 0);
    return {
      component: casing,
      repos: repoList,
      totalInstances,
      repoCount: repoList.length,
    };
  });
}

export function validateAgainstComponents(
  usage: ComponentUsage[],
  knownNames: string[],
): { valid: ComponentUsage[]; warnings: string[] } {
  const valid: ComponentUsage[] = [];
  const warnings: string[] = [];

  for (const entry of usage) {
    const exactMatch = knownNames.find(
      (name) => name.toLowerCase() === entry.component.toLowerCase(),
    );

    if (exactMatch) {
      valid.push(entry);
      continue;
    }

    const fuzzy = findBestMatch(
      entry.component,
      knownNames,
      (n) => n,
      MATCH_SUGGEST,
    );

    if (fuzzy) {
      valid.push(entry);
      warnings.push(
        `Could not exactly match '${entry.component}' — did you mean '${fuzzy.label}'?`,
      );
    } else {
      warnings.push(
        `No match found for component '${entry.component}' — it will be ignored.`,
      );
    }
  }

  return { valid, warnings };
}
