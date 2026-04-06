import type { ParityReport } from "../types/parity";
import type { IssueOwner } from "../types/parity";

export type ActionTier = "quick-win" | "critical" | "issue";

export interface ActionItem {
  tier: ActionTier;
  componentName: string;
  label: string;
  sublabel: string;
  owner: IssueOwner;
  potentialGain: number;
  issueCount: number;
  isNeedsReviewGroup?: boolean;
  needsReviewCount?: number;
}

export function calculatePriorities(report: ParityReport): ActionItem[] {
  const items: ActionItem[] = [];
  const total = report.totalCodeComponents || 1;

  // --- Tier 1: Quick wins ---

  // Group all "needs review" components into one action item
  const needsReview = report.components.filter(
    (c) => c.status === "needs-review",
  );
  if (needsReview.length > 0) {
    const gain = needsReview.reduce(
      (sum, c) => sum + (100 - c.score) / total,
      0,
    );
    items.push({
      tier: "quick-win",
      componentName: needsReview[0].componentName,
      label: `${needsReview.length} component match${needsReview.length > 1 ? "es" : ""} need review`,
      sublabel: "Confirm or dismiss fuzzy matches — one click each",
      owner: "both",
      potentialGain: parseFloat(gain.toFixed(1)),
      issueCount: needsReview.length,
      isNeedsReviewGroup: true,
      needsReviewCount: needsReview.length,
    });
  }

  // Components with a single minor issue and score ≥ 75 — easy wins
  const singleMinor = report.components.filter(
    (c) =>
      c.status !== "needs-review" &&
      c.status !== "aligned" &&
      c.score >= 75 &&
      c.issues.length === 1 &&
      c.issues[0].severity === "minor",
  );
  for (const c of singleMinor) {
    const issue = c.issues[0];
    items.push({
      tier: "quick-win",
      componentName: c.componentName,
      label: `${c.componentName} — ${issue.message.length > 60 ? issue.message.slice(0, 57) + "…" : issue.message}`,
      sublabel: `Score ${c.score} · 1 minor issue`,
      owner: issue.owner,
      potentialGain: parseFloat(((100 - c.score) / total).toFixed(1)),
      issueCount: 1,
    });
  }

  // --- Tier 2: Critical ---
  const critical = report.components
    .filter(
      (c) =>
        c.status === "critical" ||
        (c.status === "issues" &&
          c.issues.some((i) => i.severity === "critical")),
    )
    .sort((a, b) => a.score - b.score); // lowest score first

  for (const c of critical) {
    const majorCount = c.issues.filter((i) => i.severity === "major").length;
    const critCount = c.issues.filter((i) => i.severity === "critical").length;
    const sublabel = [
      `Score ${c.score}`,
      critCount > 0 ? `${critCount} critical` : null,
      majorCount > 0 ? `${majorCount} major` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const dominantOwner = deriveOwner(c.issues);

    items.push({
      tier: "critical",
      componentName: c.componentName,
      label: `${c.componentName} — ${buildIssueLabel(c.issues)}`,
      sublabel,
      owner: dominantOwner,
      potentialGain: parseFloat(((100 - c.score) / total).toFixed(1)),
      issueCount: c.issues.length,
    });
  }

  // --- Tier 3: Issues ---
  const issues = report.components
    .filter(
      (c) =>
        c.status === "issues" &&
        !c.issues.some((i) => i.severity === "critical") &&
        !(
          c.score >= 75 &&
          c.issues.length === 1 &&
          c.issues[0].severity === "minor"
        ),
    )
    .sort((a, b) => b.issues.length - a.issues.length); // most issues first

  for (const c of issues) {
    const dominantOwner = deriveOwner(c.issues);
    items.push({
      tier: "issue",
      componentName: c.componentName,
      label: `${c.componentName} — ${buildIssueLabel(c.issues)}`,
      sublabel: `Score ${c.score} · ${c.issues.length} issue${c.issues.length > 1 ? "s" : ""}`,
      owner: dominantOwner,
      potentialGain: parseFloat(((100 - c.score) / total).toFixed(1)),
      issueCount: c.issues.length,
    });
  }

  return items;
}

/** Determine the dominant owner from a list of issues */
function deriveOwner(issues: { owner: IssueOwner }[]): IssueOwner {
  if (issues.length === 0) return "both";
  const owners = new Set(issues.map((i) => i.owner));
  if (owners.size > 1 || owners.has("both")) return "both";
  return [...owners][0] as IssueOwner;
}

/** Build a short human-readable label from the most severe issue */
function buildIssueLabel(
  issues: { severity: string; message: string }[],
): string {
  const top =
    issues.find((i) => i.severity === "critical") ??
    issues.find((i) => i.severity === "major") ??
    issues[0];
  if (!top) return "issues found";
  const msg =
    top.message.length > 55 ? top.message.slice(0, 52) + "…" : top.message;
  return msg;
}
