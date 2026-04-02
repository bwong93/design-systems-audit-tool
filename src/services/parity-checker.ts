import type { ComponentMetadata } from "../types/component";
import type { FigmaComponent } from "../types/figma";
import type { DriftException } from "../types/figma";
import type {
  ParityReport,
  ComponentParityResult,
  CheckResult,
  ParityIssue,
} from "../types/parity";
import { getGrade, averageScores } from "./score-calculator";
import { db } from "./db";
import { findBestMatch, MATCH_AUTO, MATCH_SUGGEST } from "../utils/fuzzy-match";

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

  const components: ComponentParityResult[] = [];
  const matchedFigmaNames = new Set<string>();

  for (const code of codeComponents) {
    const { figma, matchType } = await resolveMatch(code.name, figmaComponents);
    if (figma) matchedFigmaNames.add(figma.codeName.toLowerCase());
    const result = checkComponent(
      code,
      figma ? [figma] : [],
      exceptions,
      matchType,
    );
    components.push(result);
  }

  // Components in Figma that weren't matched to any code component
  const figmaCodeNames = new Set(
    figmaComponents.map((f) => f.codeName.toLowerCase()),
  );
  const codeNames = new Set(codeComponents.map((c) => c.name.toLowerCase()));
  const missingInCode = [...figmaCodeNames].filter(
    (n) => !matchedFigmaNames.has(n),
  );
  const missingInFigma = [...codeNames].filter(
    (_, i) => components[i]?.status === "missing-in-figma",
  );

  // All components contribute to the score — missing ones score 0
  const overallScore = averageScores(components.map((c) => c.score));

  // Coverage = % of code components that have any Figma match
  const matchedCount = components.filter(
    (c) => c.status !== "missing-in-figma",
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

function checkComponent(
  code: ComponentMetadata,
  figmaMatches: FigmaComponent[],
  exceptions: DriftException[],
  matchType: MatchType = "none",
): ComponentParityResult {
  const componentExceptions = exceptions.filter(
    (e) => e.componentName.toLowerCase() === code.name.toLowerCase(),
  );

  if (figmaMatches.length === 0) {
    return {
      componentName: code.name,
      figmaName: "",
      score: 0,
      grade: "Critical",
      status: "missing-in-figma",
      matchType,
      isSuggestedMatch: false,
      checks: {
        nameMatch: failCheck("No matching Figma component found.", [
          {
            severity: "critical",
            message: `"${code.name}" exists in code but has no counterpart in Figma.`,
            remediation: `Add a "${code.name}" component to the Figma library using the naming convention "${code.name}/Variant", or create a manual mapping in Settings.`,
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
  const propsCheck = checkProps(code, figma, componentExceptions);
  const docsCheck = checkDocumentation(code, figma, componentExceptions);

  const scores = [nameCheck.score, propsCheck.score, docsCheck.score];
  const score = averageScores(scores);
  const grade = getGrade(score);

  const allIssues = [
    ...nameCheck.issues,
    ...propsCheck.issues,
    ...docsCheck.issues,
  ];

  const status = isSuggestedMatch
    ? "issues" // Suggested matches are always shown as needing review
    : score >= 90
      ? "aligned"
      : score >= 60
        ? "issues"
        : "critical";

  return {
    componentName: code.name,
    figmaName: figma.name,
    score,
    grade,
    status,
    matchType,
    isSuggestedMatch,
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
          remediation: `Go to Settings → Component Mappings to confirm this match or link to the correct Figma component.`,
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
        remediation: `Rename the Figma component's top level to "${codeName}", or add @code ${codeName} to its description.`,
        field: "name",
      },
    ],
  };
}

function checkProps(
  code: ComponentMetadata,
  figma: FigmaComponent,
  exceptions: DriftException[],
): CheckResult {
  if (figma.properties.length === 0) {
    return skipCheck("No properties defined in Figma for this component.");
  }

  const codeProps = new Set(code.props.map((p) => p.name.toLowerCase()));
  const issues: ParityIssue[] = [];
  let matched = 0;

  for (const figmaProp of figma.properties) {
    const propName = figmaProp.name.toLowerCase();
    const isExcepted = exceptions.some(
      (e) =>
        e.category === "figma-parity" &&
        e.propertyName?.toLowerCase() === propName,
    );

    if (isExcepted) {
      matched++;
      continue;
    }

    if (codeProps.has(propName)) {
      matched++;
    } else {
      issues.push({
        severity: "major",
        message: `Figma property "${figmaProp.name}" has no matching prop in code.`,
        remediation: `Add a "${figmaProp.name}" prop to the ${code.name} component, or approve as drift if the naming intentionally differs.`,
        field: figmaProp.name,
      });
    }
  }

  const score = Math.round((matched / figma.properties.length) * 100);

  return {
    passed: issues.length === 0,
    score,
    details: `${matched} of ${figma.properties.length} Figma properties matched.`,
    issues,
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
          remediation:
            "Add a component description in Figma and JSDoc comments to props in code.",
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
          remediation:
            "Add a description to the Figma component explaining its purpose and usage.",
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
          remediation:
            "Add JSDoc comments to props in the component interface.",
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
