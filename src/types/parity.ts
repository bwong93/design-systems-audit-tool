export type ParityGrade = "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
export type IssueSeverity = "critical" | "major" | "minor";
export type IssueOwner = "designer" | "engineer" | "both";

export interface RemediationStep {
  text: string;
  /** Local file path — rendered as a GitHub link via githubLink() */
  filePath?: string;
  /** Rendered as "OR: ..." in a muted style */
  isAlternative?: boolean;
}

export interface ParityIssue {
  severity: IssueSeverity;
  message: string;
  owner: IssueOwner;
  steps: RemediationStep[];
  /** A Nucleus file that already handles this correctly — shown as a reference link */
  referenceFile?: string;
  field?: string;
}

export interface CheckResult {
  passed: boolean;
  score: number;
  details: string;
  issues: ParityIssue[];
}

export type MatchType =
  | "manual"
  | "exact"
  | "fuzzy-auto"
  | "fuzzy-suggest"
  | "none";

/** A near-miss Figma component candidate shown in the "Review needed" section */
export interface FigmaCandidate {
  figmaName: string;
  figmaNodeId: string;
  /** Jaro-Winkler similarity score 0–1 */
  score: number;
}

export interface ComponentParityResult {
  componentName: string;
  figmaName: string;
  figmaNodeId?: string;
  score: number;
  grade: ParityGrade;
  status:
    | "aligned"
    | "issues"
    | "critical"
    | "missing-in-code"
    | "missing-in-figma"
    | "needs-review";
  matchType: MatchType;
  /** True when match was fuzzy 0.70–0.84 — needs user confirmation */
  isSuggestedMatch: boolean;
  /** Near-miss Figma candidates (shown when status is needs-review or missing-in-figma) */
  candidates: FigmaCandidate[];
  checks: {
    nameMatch: CheckResult;
    propsMatch: CheckResult;
    documentationMatch: CheckResult;
  };
  issues: ParityIssue[];
  approvedExceptionCount: number;
}

export interface ParityReport {
  overallScore: number;
  overallGrade: ParityGrade;
  /** % of code components that have at least one Figma counterpart */
  coverageScore: number;
  timestamp: string;
  totalFigmaComponents: number;
  totalCodeComponents: number;
  alignedCount: number;
  issuesCount: number;
  missingInCode: string[];
  missingInFigma: string[];
  components: ComponentParityResult[];
}
