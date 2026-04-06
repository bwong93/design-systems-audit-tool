import { useState } from "react";
import {
  Eye,
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
  averageScores,
} from "../../services/score-calculator";
import { githubLink, storybookLink } from "../../utils/links";
import type { ComponentMetadata } from "../../types/component";

// --- Check definitions ---

interface A11yCheck {
  key: keyof Pick<
    ComponentMetadata,
    "hasFocusVisible" | "hasAriaProps" | "semanticHTML" | "hasKeyboardSupport"
  >;
  label: string;
  wcag: string;
  level: "A" | "AA";
  description: string;
  remediation: string[];
  referenceFile?: string;
}

const CHECKS: A11yCheck[] = [
  {
    key: "hasFocusVisible",
    label: "Focus visible",
    wcag: "2.4.11",
    level: "AA",
    description:
      "Interactive elements show a visible focus indicator when navigated via keyboard.",
    remediation: [
      "Find the interactive styled component",
      "Add: &:focus-visible { outline: 2px solid; outline-offset: 2px; }",
      "Ensure the outline contrasts with the surrounding background",
    ],
    referenceFile:
      "/Users/bentley/Dev/nucleus/src/components/Button/Button.tsx",
  },
  {
    key: "hasAriaProps",
    label: "ARIA attributes",
    wcag: "4.1.2",
    level: "AA",
    description:
      "Components expose name, role, and state information to assistive technologies.",
    remediation: [
      "Add aria-label or aria-labelledby to identify the component's purpose",
      "Add role attribute where the HTML element does not convey the correct semantic role",
      "Add state attributes (aria-expanded, aria-selected, aria-disabled) as appropriate",
    ],
  },
  {
    key: "semanticHTML",
    label: "Semantic HTML",
    wcag: "1.3.1",
    level: "A",
    description:
      "Structure and relationships are conveyed through semantic HTML elements, not just visual styling.",
    remediation: [
      "Use <button> instead of <div> or <span> for clickable elements",
      "Use <nav>, <main>, <header>, <footer> for landmark regions",
      "Associate <label> elements with form inputs using htmlFor",
    ],
  },
  {
    key: "hasKeyboardSupport",
    label: "Keyboard support",
    wcag: "2.1.1",
    level: "A",
    description:
      "All functionality is operable via keyboard without requiring a mouse or specific timing.",
    remediation: [
      "Add onKeyDown or onKeyUp handlers to interactive elements",
      "Handle Enter (keyCode 13) and Space (keyCode 32) for custom button-like components",
      "Ensure Tab order follows a logical reading sequence — avoid tabIndex > 0",
    ],
    referenceFile:
      "/Users/bentley/Dev/nucleus/src/components/Button/Button.tsx",
  },
];

function componentA11yScore(c: ComponentMetadata): number {
  const passed = CHECKS.filter((check) => c[check.key]).length;
  return Math.round((passed / CHECKS.length) * 100);
}

// --- Page ---

export default function Accessibility() {
  const { results } = useAuditStore();

  if (!results) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-96 text-center">
        <Eye size={40} className="text-earnest-50 mb-4" />
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
  const scores = components.map(componentA11yScore);
  const overallScore = averageScores(scores);
  const overallGrade = getGrade(overallScore);

  const passingAll = components.filter(
    (c) => componentA11yScore(c) === 100,
  ).length;
  const failing = components.filter((c) => componentA11yScore(c) < 100).length;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-earnest-100">Accessibility</h1>
            <p className="text-earnest-80 mt-1 text-sm">
              Audit Nucleus components against WCAG 2.2 AA requirements.
              Surfaces missing focus styles, ARIA attributes, semantic markup,
              and keyboard support so engineers can fix accessibility gaps
              before they ship.
            </p>
            <p className="text-earnest-60 mt-0.5 text-xs">
              4 checks per component · {components.length} components scanned
            </p>
          </div>
          <A11yScoreBadge score={overallScore} grade={overallGrade} />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            icon={<CheckCircle size={18} className="text-green-600" />}
            label="All checks pass"
            value={passingAll}
            bg="bg-green-50"
            tooltip="Components that pass all 4 WCAG checks."
          />
          <SummaryCard
            icon={<XCircle size={18} className="text-red-600" />}
            label="Have issues"
            value={failing}
            bg="bg-red-50"
            tooltip="Components failing one or more accessibility checks."
          />
          {CHECKS.map((check) => {
            const passing = components.filter((c) => c[check.key]).length;
            return (
              <SummaryCard
                key={check.key}
                icon={
                  passing === components.length ? (
                    <CheckCircle size={18} className="text-green-600" />
                  ) : (
                    <XCircle size={18} className="text-amber-600" />
                  )
                }
                label={check.label}
                value={passing}
                total={components.length}
                bg={
                  passing === components.length ? "bg-green-50" : "bg-amber-50"
                }
                tooltip={`WCAG ${check.wcag} (${check.level}) — ${check.description}`}
              />
            );
          })}
        </div>

        {/* Component list */}
        <div className="bg-white rounded-lg border border-earnest-30">
          <div className="px-6 py-4 border-b border-earnest-30">
            <h2 className="font-semibold text-earnest-100">Components</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {[...components]
              .sort((a, b) => componentA11yScore(a) - componentA11yScore(b))
              .map((component) => (
                <A11yComponentRow key={component.name} component={component} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Summary card ---

function A11yScoreBadge({
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
          A11y Score
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
          <p className="font-semibold text-white mb-1">
            What does this score mean?
          </p>
          <p className="text-earnest-50">
            Average percentage of the 4 WCAG checks passing across all
            components. A score of 75 means 75% of checks pass on average.
          </p>
          <div className="space-y-1.5 border-t border-gray-700 pt-2.5">
            {[
              {
                range: "90–100",
                grade: "Excellent",
                meaning:
                  "Nearly all components meet WCAG requirements. Suitable for teams claiming AA compliance.",
              },
              {
                range: "75–89",
                grade: "Good",
                meaning:
                  "Most components are accessible. Remaining gaps are minor and unlikely to block most users.",
              },
              {
                range: "60–74",
                grade: "Fair",
                meaning:
                  "Noticeable gaps. Some keyboard and screen reader users will encounter barriers.",
              },
              {
                range: "40–59",
                grade: "Poor",
                meaning:
                  "Significant issues. Many interactive components are inaccessible to assistive technology users.",
              },
              {
                range: "0–39",
                grade: "Critical",
                meaning:
                  "Severe failures. The system cannot be considered accessible and likely violates WCAG AA.",
              },
            ].map((row) => (
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

function SummaryCard({
  icon,
  label,
  value,
  total,
  bg,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  bg: string;
  tooltip: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="bg-white rounded-lg border border-earnest-30 p-4 flex items-center gap-3">
      <div className={`${bg} p-2 rounded-lg shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-bold text-earnest-100">
          {value}
          {total !== undefined && (
            <span className="text-sm font-normal text-earnest-60 ml-1">
              / {total}
            </span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <p className="text-xs text-earnest-80">{label}</p>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-earnest-50 hover:text-earnest-60 transition-colors"
            >
              <Info size={11} />
            </button>
            {showTooltip && (
              <div className="absolute top-5 left-0 z-10 w-64 bg-earnest-100 text-white text-xs rounded-lg p-3 shadow-lg">
                {tooltip}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Component row ---

function A11yComponentRow({ component }: { component: ComponentMetadata }) {
  const [expanded, setExpanded] = useState(false);
  const score = componentA11yScore(component);
  const grade = getGrade(score);
  const failingChecks = CHECKS.filter((c) => !component[c.key]);
  const passingChecks = CHECKS.filter((c) => component[c.key]);

  return (
    <div className="hover:bg-earnest-10 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${getGradeDot(grade)}`}
          />
          <span className="text-sm font-medium text-earnest-100">
            {component.name}
          </span>
          {/* Check pills */}
          <div className="hidden md:flex items-center gap-1.5">
            {CHECKS.map((check) => (
              <span
                key={check.key}
                title={`WCAG ${check.wcag} — ${check.label}`}
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  component[check.key]
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {component[check.key] ? "✓" : "✗"} {check.label}
              </span>
            ))}
          </div>
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
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getGradeColor(grade)}`}
          >
            {score} · {grade}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-earnest-60" />
          ) : (
            <ChevronDown size={14} className="text-earnest-60" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-4 pl-11 space-y-2">
          {/* Failing checks with remediation */}
          {failingChecks.map((check) => (
            <div
              key={check.key}
              className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <XCircle size={13} className="text-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-800">
                  {check.label}
                </span>
                <span className="text-xs text-red-400 ml-auto">
                  WCAG {check.wcag} · Level {check.level}
                </span>
              </div>
              <p className="text-xs text-red-700">{check.description}</p>
              <ol className="space-y-1 pl-1">
                {check.remediation.map((step, i) => (
                  <li
                    key={i}
                    className="text-xs text-earnest-80 flex items-start gap-1.5"
                  >
                    <span className="shrink-0 w-4 text-earnest-60">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {check.referenceFile && (
                <p className="text-xs text-earnest-60">
                  Reference:{" "}
                  <a
                    href={githubLink(check.referenceFile)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    {check.referenceFile.split("/").slice(-2).join("/")} ↗
                  </a>
                </p>
              )}
            </div>
          ))}

          {/* Passing checks summary */}
          {passingChecks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {passingChecks.map((check) => (
                <span
                  key={check.key}
                  className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full"
                >
                  <CheckCircle size={11} />
                  {check.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
