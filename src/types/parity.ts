export type ParityGrade = "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
export type IssueSeverity = "critical" | "major" | "minor";

export interface ParityIssue {
  severity: IssueSeverity;
  message: string;
  remediation: string;
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

export interface ComponentParityResult {
  componentName: string;
  figmaName: string;
  score: number;
  grade: ParityGrade;
  status:
    | "aligned"
    | "issues"
    | "critical"
    | "missing-in-code"
    | "missing-in-figma";
  matchType: MatchType;
  /** True when match was fuzzy 0.70–0.84 — needs user confirmation */
  isSuggestedMatch: boolean;
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
