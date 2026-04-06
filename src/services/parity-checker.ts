import type { ComponentMetadata } from "../types/component";
import type { FigmaComponent } from "../types/figma";
import type { DriftException } from "../types/figma";
import type {
  ParityReport,
  ComponentParityResult,
  CheckResult,
  ParityIssue,
  FigmaCandidate,
  PropDetail,
} from "../types/parity";
import { getGrade, averageScores } from "./score-calculator";
import { db } from "./db";
import {
  findBestMatch,
  findAllMatches,
  MATCH_AUTO,
  MATCH_SUGGEST,
} from "../utils/fuzzy-match";

/**
 * Three-layer matching resolution:
 * 1. Manual mapping in componentMappings table
 * 2. Fuzzy auto-match (score ≥ MATCH_AUTO)
 * 3. Fuzzy suggestion (score ≥ MATCH_SUGGEST) — flagged for review
 * 4. No match → missing-in-figma
 */
async function resolveMatch(
  codeName: string,
  figmaComponents: FigmaComponent[],
): Promise<{
  figma: FigmaComponent | null;
  matchType: "manual" | "exact" | "fuzzy-auto" | "fuzzy-suggest" | "none";
}> {
  // Layer 1: Manual mapping
  const mapping = await db.componentMappings
    .where("codeComponentName")
    .equalsIgnoreCase(codeName)
    .first();

  if (mapping) {
    const figma = figmaComponents.find(
      (f) =>
        f.name.toLowerCase() === mapping.figmaComponentName.toLowerCase() ||
        f.codeName.toLowerCase() === mapping.figmaComponentName.toLowerCase(),
    );
    if (figma) return { figma, matchType: "manual" };
  }

  // Layer 2: Exact name match
  const exact = figmaComponents.find(
    (f) => f.codeName.toLowerCase() === codeName.toLowerCase(),
  );
  if (exact) return { figma: exact, matchType: "exact" };

  // Layer 3: Fuzzy matching
  const fuzzy = findBestMatch(
    codeName,
    figmaComponents,
    (f) => f.codeName,
    MATCH_SUGGEST,
  );
  if (fuzzy) {
    const matchType =
      fuzzy.score >= MATCH_AUTO ? "fuzzy-auto" : "fuzzy-suggest";
    return { figma: fuzzy.item, matchType };
  }

  return { figma: null, matchType: "none" };
}

export async function runParityCheck(
  codeComponents: ComponentMetadata[],
  figmaComponents: FigmaComponent[],
): Promise<ParityReport> {
  const exceptions = await db.driftExceptions.toArray();
  const noMatchDecisions = await db.noMatchDecisions.toArray();
  const figmaOnlyDecisions = await db.figmaOnlyDecisions.toArray();
  const figmaOnlySet = new Set(
    figmaOnlyDecisions.map((d) => d.figmaCodeName.toLowerCase()),
  );
  const noMatchSet = new Map(
    noMatchDecisions.map((d) => [d.codeComponentName.toLowerCase(), d.reason]),
  );

  const components: ComponentParityResult[] = [];
  const matchedFigmaNames = new Set<string>();

  for (const code of codeComponents) {
    const noMatchReason = noMatchSet.get(code.name.toLowerCase());

    // User has explicitly decided this has no Figma match — skip fuzzy matching
    if (noMatchReason) {
      const candidates = getCandidates(code.name, figmaComponents);
      components.push(
        buildNoMatchResult(code, noMatchReason, candidates, exceptions),
      );
      continue;
    }

    const { figma, matchType } = await resolveMatch(code.name, figmaComponents);
    if (figma) matchedFigmaNames.add(figma.codeName.toLowerCase());

    // Collect near-miss candidates for unmatched or fuzzy-suggest components
    const candidates =
      matchType === "none" || matchType === "fuzzy-suggest"
        ? getCandidates(code.name, figmaComponents, figma?.codeName)
        : [];

    const result = checkComponent(
      code,
      figma ? [figma] : [],
      exceptions,
      matchType,
      candidates,
    );
    components.push(result);
  }

  // Components in Figma that weren't matched to any code component
  const codeNames = new Set(codeComponents.map((c) => c.name.toLowerCase()));
  const missingInCode = figmaComponents
    .filter(
      (f) =>
        !matchedFigmaNames.has(f.codeName.toLowerCase()) &&
        !figmaOnlySet.has(f.codeName.toLowerCase()),
    )
    .map((f) => ({
      codeName: f.codeName,
      figmaName: f.name,
      figmaNodeId: f.id,
    }));
  const missingInFigma = [...codeNames].filter(
    (_, i) =>
      components[i]?.status === "missing-in-figma" ||
      components[i]?.status === "needs-review",
  );

  // needs-review and missing-in-figma excluded from overall score
  const overallScore = averageScores(components.map((c) => c.score));

  // Coverage = % of code components that have any confirmed Figma match
  const matchedCount = components.filter(
    (c) => c.status !== "missing-in-figma" && c.status !== "needs-review",
  ).length;
  const coverageScore = Math.round((matchedCount / components.length) * 100);

  return {
    overallScore,
    overallGrade: getGrade(overallScore),
    coverageScore,
    timestamp: new Date().toISOString(),
    totalFigmaComponents: figmaComponents.length,
    totalCodeComponents: codeComponents.length,
    alignedCount: components.filter((c) => c.status === "aligned").length,
    issuesCount: components.filter(
      (c) => c.status === "issues" || c.status === "critical",
    ).length,
    missingInCode,
    missingInFigma,
    components,
  };
}

type MatchType = "manual" | "exact" | "fuzzy-auto" | "fuzzy-suggest" | "none";

/** Returns top 3 near-miss Figma candidates, excluding the current match */
function getCandidates(
  codeName: string,
  figmaComponents: FigmaComponent[],
  excludeCodeName?: string,
): FigmaCandidate[] {
  return findAllMatches(codeName, figmaComponents, (f) => f.codeName, 0.4)
    .filter((m) => m.label.toLowerCase() !== excludeCodeName?.toLowerCase())
    .slice(0, 3)
    .map((m) => ({
      figmaName: m.item.name,
      figmaNodeId: m.item.id,
      score: m.score,
    }));
}

/** Builds a result for components the user has explicitly marked as having no Figma match */
function buildNoMatchResult(
  code: ComponentMetadata,
  reason: "gap" | "intentional",
  candidates: FigmaCandidate[],
  exceptions: DriftException[],
): ComponentParityResult {
  const componentExceptions = exceptions.filter(
    (e) => e.componentName.toLowerCase() === code.name.toLowerCase(),
  );

  const steps =
    reason === "gap"
      ? [
          {
            text: `🎨 Designer: Create a "${code.name}" component set in Figma`,
          },
          {
            text: `Add variants using the pattern ${code.name}/Default, ${code.name}/Variant`,
          },
          { text: "Publish the library to make it available to the team" },
        ]
      : [
          {
            text: "This component is intentionally not documented in Figma",
            isAlternative: true,
          },
        ];

  return {
    componentName: code.name,
    figmaName: "",
    score: reason === "intentional" ? 100 : 0,
    grade: reason === "intentional" ? "Excellent" : "Critical",
    status: reason === "intentional" ? "aligned" : "missing-in-figma",
    matchType: "none",
    isSuggestedMatch: false,
    candidates,
    checks: {
      nameMatch: skipCheck(
        reason === "intentional"
          ? "Marked as intentionally unmapped."
          : "Marked as a gap — needs Figma documentation.",
      ),
      propsMatch: skipCheck("No Figma component to compare."),
      documentationMatch: skipCheck("No Figma component to compare."),
    },
    issues:
      reason === "gap"
        ? [
            {
              severity: "critical" as const,
              message: `"${code.name}" has no Figma counterpart and has been marked as a gap.`,
              owner: "designer" as const,
              steps,
            },
          ]
        : [],
    approvedExceptionCount: componentExceptions.length,
    propDetails: [],
  };
}

function checkComponent(
  code: ComponentMetadata,
  figmaMatches: FigmaComponent[],
  exceptions: DriftException[],
  matchType: MatchType = "none",
  candidates: FigmaCandidate[] = [],
): ComponentParityResult {
  const componentExceptions = exceptions.filter(
    (e) => e.componentName.toLowerCase() === code.name.toLowerCase(),
  );

  if (figmaMatches.length === 0) {
    const hasCandidates = candidates.length > 0;
    return {
      componentName: code.name,
      figmaName: "",
      score: 0,
      grade: "Critical",
      status: hasCandidates ? "needs-review" : "missing-in-figma",
      matchType,
      isSuggestedMatch: false,
      candidates,
      propDetails: [],
      checks: {
        nameMatch: failCheck("No matching Figma component found.", [
          {
            severity: "critical",
            message: hasCandidates
              ? `"${code.name}" has potential Figma matches — review candidates below.`
              : `"${code.name}" exists in code but has no counterpart in Figma.`,
            owner: "designer",
            steps: hasCandidates
              ? [
                  { text: "Review the candidate matches below" },
                  {
                    text: "Confirm the correct match or mark as gap / intentional",
                  },
                ]
              : [
                  {
                    text: `Create a new component set named "${code.name}" in Figma`,
                  },
                  {
                    text: `Add variants using the pattern ${code.name}/Default, ${code.name}/Variant`,
                  },
                  {
                    text: "Publish the library to make it available to the team",
                  },
                  {
                    text: "OR: Mark as intentional if this component has no Figma spec by design",
                    isAlternative: true,
                  },
                ],
          },
        ]),
        propsMatch: skipCheck("Skipped — no Figma component to compare."),
        documentationMatch: skipCheck(
          "Skipped — no Figma component to compare.",
        ),
      },
      issues: [],
      approvedExceptionCount: componentExceptions.length,
    };
  }

  const figma = figmaMatches[0];
  const isSuggestedMatch = matchType === "fuzzy-suggest";

  const nameCheck = checkName(
    code.name,
    figma.codeName,
    componentExceptions,
    matchType,
  );
  const { result: propsCheck, propDetails } = checkProps(
    code,
    figma,
    componentExceptions,
  );
  const docsCheck = checkDocumentation(code, figma, componentExceptions);

  // Docs check surfaces issues but doesn't affect the parity score —
  // documentation completeness is a separate concern from component alignment.
  // Props check is excluded from scoring when Figma has no properties defined —
  // including a skipped check at 100 would inflate scores for unspecified components.
  const scores =
    propDetails.length > 0
      ? [nameCheck.score, propsCheck.score]
      : [nameCheck.score];
  const score = averageScores(scores);
  const grade = getGrade(score);

  const allIssues = [
    ...nameCheck.issues,
    ...propsCheck.issues,
    ...docsCheck.issues,
  ];

  const status = isSuggestedMatch
    ? "needs-review"
    : score >= 90
      ? "aligned"
      : score >= 60
        ? "issues"
        : "critical";

  return {
    componentName: code.name,
    figmaName: figma.name,
    figmaNodeId: figma.id,
    score,
    grade,
    status,
    matchType,
    isSuggestedMatch,
    candidates,
    propDetails,
    checks: {
      nameMatch: nameCheck,
      propsMatch: propsCheck,
      documentationMatch: docsCheck,
    },
    issues: allIssues,
    approvedExceptionCount: componentExceptions.length,
  };
}

function checkName(
  codeName: string,
  figmaCodeName: string,
  exceptions: DriftException[],
  matchType: MatchType = "exact",
): CheckResult {
  const isExcepted = exceptions.some(
    (e) => e.category === "figma-parity" && !e.propertyName,
  );
  if (isExcepted) return passCheck("Name mismatch approved as drift.", []);

  // Manual mappings and fuzzy matches inherently have different names — don't penalise
  if (matchType === "manual") {
    return passCheck(`Matched via manual mapping to "${figmaCodeName}".`, []);
  }
  if (matchType === "fuzzy-auto") {
    return {
      passed: true,
      score: 85,
      details: `Fuzzy match: "${codeName}" → "${figmaCodeName}". Confirm this is correct.`,
      issues: [],
    };
  }
  if (matchType === "fuzzy-suggest") {
    return {
      passed: false,
      score: 60,
      details: `Suggested match: "${codeName}" → "${figmaCodeName}". Please confirm or create a manual mapping.`,
      issues: [
        {
          severity: "minor",
          message: `Unconfirmed fuzzy match between "${codeName}" (code) and "${figmaCodeName}" (Figma).`,
          owner: "both",
          steps: [
            { text: "Go to Settings → Component Mappings" },
            {
              text: `Confirm "${figmaCodeName}" is the correct Figma counterpart for "${codeName}", or select the correct one from the dropdown`,
            },
          ],
          field: "name",
        },
      ],
    };
  }

  const exact = codeName.toLowerCase() === figmaCodeName.toLowerCase();
  if (exact) {
    return {
      passed: true,
      score: 100,
      details: `"${codeName}" matches exactly.`,
      issues: [],
    };
  }

  return {
    passed: false,
    score: 50,
    details: `"${codeName}" in code vs "${figmaCodeName}" in Figma.`,
    issues: [
      {
        severity: "minor",
        message: `Name convention differs: code uses "${codeName}", Figma top-level is "${figmaCodeName}".`,
        owner: "both",
        steps: [
          {
            text: `🎨 Designer: Rename the Figma component's top level to "${codeName}"`,
          },
          {
            text: `OR: Add @code ${codeName} to the Figma component's description field`,
            isAlternative: true,
          },
          { text: "⚙ Engineer: No code change needed" },
          {
            text: `OR: Approve as "Naming Convention" drift if this difference is intentional`,
            isAlternative: true,
          },
        ],
        field: "name",
      },
    ],
  };
}

/** Strips non-alphanumeric chars and lowercases for fuzzy prop name matching.
 *  e.g. "fullWidth" → "fullwidth", "is-disabled" → "isdisabled"
 */
function normalizePropName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function checkProps(
  code: ComponentMetadata,
  figma: FigmaComponent,
  exceptions: DriftException[],
): { result: CheckResult; propDetails: PropDetail[] } {
  if (figma.properties.length === 0) {
    return {
      result: skipCheck("No properties defined in Figma for this component."),
      propDetails: [],
    };
  }

  // Build a normalized map: normalizedName → original code prop name
  const codePropsNormalized = new Map(
    code.props.map((p) => [normalizePropName(p.name), p.name]),
  );

  const issues: ParityIssue[] = [];
  const propDetails: PropDetail[] = [];
  let matched = 0;

  for (const figmaProp of figma.properties) {
    const normalizedFigmaName = normalizePropName(figmaProp.name);
    const isExcepted = exceptions.some(
      (e) =>
        e.category === "figma-parity" &&
        normalizePropName(e.propertyName ?? "") === normalizedFigmaName,
    );

    if (isExcepted) {
      matched++;
      propDetails.push({
        figmaName: figmaProp.name,
        figmaValues: figmaProp.values,
        matched: true,
        approved: true,
      });
      continue;
    }

    const codePropName = codePropsNormalized.get(normalizedFigmaName);
    if (codePropName) {
      matched++;
      propDetails.push({
        figmaName: figmaProp.name,
        figmaValues: figmaProp.values,
        matched: true,
        codePropName,
      });
    } else {
      propDetails.push({
        figmaName: figmaProp.name,
        figmaValues: figmaProp.values,
        matched: false,
      });
      issues.push({
        severity: "major",
        message: `Figma property "${figmaProp.name}" has no matching prop in code.`,
        owner: "engineer",
        steps: [
          { text: `Open ${code.name}.tsx`, filePath: code.filePath },
          { text: `Add \`${figmaProp.name}?\` to ${code.name}Props` },
          { text: "Implement the visual behavior in the styled component" },
          {
            text: `OR: Approve as "Naming Convention" drift if this prop is named differently in code`,
            isAlternative: true,
          },
        ],
        referenceFile: `/Users/bentley/Dev/nucleus/src/components/Tag/Tag.tsx`,
        field: figmaProp.name,
      });
    }
  }

  const score = Math.round((matched / figma.properties.length) * 100);

  return {
    result: {
      passed: issues.length === 0,
      score,
      details: `${matched} of ${figma.properties.length} Figma properties matched.`,
      issues,
    },
    propDetails,
  };
}

function checkDocumentation(
  code: ComponentMetadata,
  figma: FigmaComponent,
  _exceptions: DriftException[],
): CheckResult {
  const hasCodeDocs = code.props.some((p) => !!p.description);
  const hasFigmaDocs = !!figma.description?.trim();

  if (!hasFigmaDocs && !hasCodeDocs) {
    return {
      passed: false,
      score: 20,
      details: "Neither Figma nor code has documentation.",
      issues: [
        {
          severity: "minor",
          message: "No description in Figma and no JSDoc comments in code.",
          owner: "both",
          steps: [
            {
              text: "🎨 Designer: Add a description to the Figma component explaining its purpose and usage",
            },
            {
              text: `⚙ Engineer: Add JSDoc comments to props in ${code.name}Props`,
              filePath: code.filePath,
            },
          ],
        },
      ],
    };
  }

  if (!hasFigmaDocs) {
    return {
      passed: false,
      score: 60,
      details: "Code has prop documentation but Figma description is empty.",
      issues: [
        {
          severity: "minor",
          message: "Figma component has no description.",
          owner: "designer",
          steps: [
            { text: "Open the component in Figma" },
            {
              text: "Add a description explaining the component's purpose, usage, and any key behaviors",
            },
          ],
        },
      ],
    };
  }

  if (!hasCodeDocs) {
    return {
      passed: false,
      score: 60,
      details: "Figma has a description but code props lack JSDoc comments.",
      issues: [
        {
          severity: "minor",
          message: "Code props have no JSDoc descriptions.",
          owner: "engineer",
          steps: [
            {
              text: `Open ${code.name}Props in ${code.name}.tsx`,
              filePath: code.filePath,
            },
            { text: "Add JSDoc comments above each prop (/** description */)" },
          ],
          referenceFile: `/Users/bentley/Dev/nucleus/src/components/Tag/Tag.tsx`,
        },
      ],
    };
  }

  return passCheck("Both Figma and code are documented.", []);
}

// --- Helpers ---

function passCheck(details: string, issues: ParityIssue[]): CheckResult {
  return { passed: true, score: 100, details, issues };
}

function failCheck(details: string, issues: ParityIssue[]): CheckResult {
  return { passed: false, score: 0, details, issues };
}

function skipCheck(details: string): CheckResult {
  return { passed: true, score: 100, details, issues: [] };
}
