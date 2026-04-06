import { useState } from "react";
import {
  Palette,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
} from "lucide-react";
import { useAuditStore } from "../../stores/audit-store";
import {
  getGrade,
  getGradeColor,
  getGradeDot,
} from "../../services/score-calculator";
import { githubLink, storybookLink } from "../../utils/links";
import type { ComponentMetadata } from "../../types/component";

export default function Tokens() {
  const { results } = useAuditStore();

  if (!results) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-96 text-center">
        <Palette size={40} className="text-earnest-50 mb-4" />
        <h2 className="text-lg font-semibold text-earnest-90 mb-2">
          No scan results yet
        </h2>
        <p className="text-sm text-earnest-80">
          Run an audit from the Dashboard first.
        </p>
      </div>
    );
  }

  const components = results.components;
  const passing = components.filter((c) => c.hardcodedColors.length === 0);
  const failing = components.filter((c) => c.hardcodedColors.length > 0);
  const score = Math.round((passing.length / components.length) * 100);
  const grade = getGrade(score);
  const totalViolations = failing.reduce(
    (sum, c) => sum + c.hardcodedColors.length,
    0,
  );

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-earnest-100">Token Usage</h1>
            <p className="text-earnest-80 mt-1 text-sm">
              Ensure components use design tokens for colors — not hardcoded
              values. Hardcoded colors break theming and make rebrands
              expensive.
            </p>
            <p className="text-earnest-60 mt-0.5 text-xs">
              {components.length} components scanned · {totalViolations}{" "}
              hardcoded color
              {totalViolations !== 1 ? "s" : ""} found
            </p>
          </div>
          <TokenScoreBadge score={score} grade={grade} />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-earnest-30 p-4 flex items-center gap-3">
            <div className="bg-green-50 p-2 rounded-lg shrink-0">
              <CheckCircle size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-earnest-100">
                {passing.length}
                <span className="text-sm font-normal text-earnest-60 ml-1">
                  / {components.length}
                </span>
              </p>
              <p className="text-xs text-earnest-80">Using tokens correctly</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-earnest-30 p-4 flex items-center gap-3">
            <div className="bg-red-50 p-2 rounded-lg shrink-0">
              <XCircle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-earnest-100">
                {failing.length}
                <span className="text-sm font-normal text-earnest-60 ml-1">
                  components
                </span>
              </p>
              <p className="text-xs text-earnest-80">
                {totalViolations} hardcoded color
                {totalViolations !== 1 ? "s" : ""} need replacing
              </p>
            </div>
          </div>
        </div>

        {/* Component list */}
        <div className="bg-white rounded-lg border border-earnest-30">
          <div className="px-6 py-4 border-b border-earnest-30">
            <h2 className="font-semibold text-earnest-100">Components</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {[...components]
              .sort(
                (a, b) => b.hardcodedColors.length - a.hardcodedColors.length,
              )
              .map((component) => (
                <TokenComponentRow key={component.name} component={component} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Score badge with legend ---

const TOKEN_LEGEND = [
  {
    range: "90–100",
    grade: "Excellent",
    meaning: "Nearly all components use design tokens. Safe for rebranding.",
  },
  {
    range: "75–89",
    grade: "Good",
    meaning:
      "Most components use tokens. A few isolated hardcoded values remain.",
  },
  {
    range: "60–74",
    grade: "Fair",
    meaning:
      "Noticeable hardcoded values. A rebrand would require manual fixes in multiple components.",
  },
  {
    range: "40–59",
    grade: "Poor",
    meaning:
      "Significant hardcoding. Theming changes will be inconsistent across the system.",
  },
  {
    range: "0–39",
    grade: "Critical",
    meaning:
      "Most components ignore the token system. Rebranding would require a full audit.",
  },
];

function TokenScoreBadge({
  score,
  grade,
}: {
  score: number;
  grade: ReturnType<typeof getGrade>;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div
      className={`relative border rounded-xl px-5 py-3 text-center ${getGradeColor(grade)}`}
    >
      <div className="flex items-center justify-center gap-1 mb-1">
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          Token Score
        </p>
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="opacity-50 hover:opacity-80 transition-opacity"
        >
          <Info size={11} />
        </button>
      </div>
      <p className="text-3xl font-bold">{score}</p>
      <p className="text-sm font-medium mt-0.5">{grade}</p>

      {showTooltip && (
        <div className="absolute top-full mt-2 right-0 z-10 w-72 bg-earnest-100 text-white text-xs rounded-lg p-4 shadow-lg text-left font-normal normal-case tracking-normal space-y-2.5">
          <p className="text-earnest-50">
            % of components with no hardcoded color values. A score of 100 means
            every component uses design tokens exclusively.
          </p>
          <div className="space-y-1.5 border-t border-gray-700 pt-2.5">
            {TOKEN_LEGEND.map((row) => (
              <div key={row.grade} className="flex gap-2">
                <span className="text-earnest-60 w-14 shrink-0">{row.range}</span>
                <span className="text-gray-200 font-medium w-16 shrink-0">
                  {row.grade}
                </span>
                <span className="text-earnest-60">{row.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Component row ---

function TokenComponentRow({ component }: { component: ComponentMetadata }) {
  const [expanded, setExpanded] = useState(false);
  const hasPassing = component.hardcodedColors.length === 0;
  const dotClass = getGradeDot(hasPassing ? "Excellent" : "Critical");

  return (
    <div className="hover:bg-earnest-10 transition-colors">
      <button
        onClick={() => !hasPassing && setExpanded(!expanded)}
        className={`w-full px-6 py-4 flex items-center justify-between text-left ${hasPassing ? "cursor-default" : ""}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
          <span className="text-sm font-medium text-earnest-100">
            {component.name}
          </span>
          {component.usesTokens && (
            <span className="text-xs text-earnest-60 bg-earnest-20 px-2 py-0.5 rounded-full">
              uses tokens
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={storybookLink(component.name)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-earnest-60 hover:text-orange-500 transition-colors"
          >
            <ExternalLink size={13} />
            Storybook
          </a>
          <a
            href={githubLink(component.filePath)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-earnest-60 hover:text-earnest-90 transition-colors"
          >
            <ExternalLink size={13} />
            GitHub
          </a>
          {hasPassing ? (
            <span className="text-xs text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full font-medium">
              ✓ All tokens
            </span>
          ) : (
            <>
              <span className="text-xs text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-medium">
                {component.hardcodedColors.length} hardcoded color
                {component.hardcodedColors.length > 1 ? "s" : ""}
              </span>
              {expanded ? (
                <ChevronUp size={14} className="text-earnest-60" />
              ) : (
                <ChevronDown size={14} className="text-earnest-60" />
              )}
            </>
          )}
        </div>
      </button>

      {expanded && !hasPassing && (
        <div className="px-6 pb-4 pl-11 space-y-3">
          {/* Violation list */}
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-red-800 mb-2">
              Hardcoded colors found
            </p>
            <div className="flex flex-wrap gap-2">
              {component.hardcodedColors.map((color) => (
                <div key={color} className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded border border-red-200 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <code className="text-xs text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                    {color}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* Remediation */}
          <div className="bg-earnest-10 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-blue-50 text-blue-700 border-blue-200">
                ⚙ Engineer
              </span>
            </div>
            <ol className="space-y-1 pl-1">
              <li className="text-xs flex items-start gap-1.5 text-earnest-80">
                <span className="shrink-0 w-4 text-earnest-60">1.</span>
                <span>
                  Open {component.name}.tsx —{" "}
                  <a
                    href={githubLink(component.filePath)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    view file ↗
                  </a>
                </span>
              </li>
              <li className="text-xs flex items-start gap-1.5 text-earnest-80">
                <span className="shrink-0 w-4 text-earnest-60">2.</span>
                <span>Find each hardcoded color value listed above</span>
              </li>
              <li className="text-xs flex items-start gap-1.5 text-earnest-80">
                <span className="shrink-0 w-4 text-earnest-60">3.</span>
                <span>
                  Replace with the matching token from{" "}
                  <code className="bg-gray-200 px-1 rounded">
                    theme.tokens.*
                  </code>{" "}
                  —{" "}
                  <a
                    href={githubLink(
                      "/Users/bentley/Dev/nucleus/src/theme/product2024-tokens.ts",
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    browse available tokens ↗
                  </a>
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
