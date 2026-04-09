import {
  Play,
  Loader2,
  AlertTriangle,
  Package,
  Download,
  ArrowRight,
  Info,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAuditStore } from "../../stores/audit-store";
import { useOnboardingStore } from "../../stores/onboarding-store";
import { db, type ScanHistoryEntry } from "../../services/db";
import { generateReport, downloadReport } from "../../utils/generate-report";
import {
  getGrade,
  getGradeColor,
  averageScores,
} from "../../services/score-calculator";
import type { ParityReport } from "../../types/parity";
import { computeDelta, type ScanDelta } from "../../services/delta-calculator";

const A11Y_KEYS = [
  "hasAriaProps",
  "hasFocusVisible",
  "semanticHTML",
  "hasKeyboardSupport",
] as const;

type ImpactInsight = {
  headline: string;
  body: string;
  affects: string;
  teamImpact: string;
};

function getImpactInsight(scores: {
  a11y: number | null;
  token: number | null;
  parity: number | null;
  coverage: number | null;
}): ImpactInsight {
  const { a11y, token, parity, coverage } = scores;

  if (a11y !== null && a11y < 75) {
    return {
      headline: "Accessibility gaps are your highest-priority risk",
      body: "An estimated 1 in 4 adults lives with some form of disability. At your current score, a meaningful portion of users may encounter barriers with interactive components — creating both product quality and compliance risk. Improving this score is one of the highest-leverage investments your team can make.",
      affects: "Users with disabilities",
      teamImpact: "Compliance & legal risk",
    };
  }
  if (parity !== null && parity < 75) {
    return {
      headline: "Design-to-code drift is slowing delivery",
      body: "When Figma designs and code implementations diverge, engineers spend time reverse-engineering intent rather than building. Closing this gap accelerates delivery, reduces QA cycles, and ensures your product looks the way it was designed.",
      affects: "All users",
      teamImpact: "Delivery speed & revision cycles",
    };
  }
  if (coverage !== null && coverage < 75) {
    return {
      headline: "Parts of your codebase exist outside the design system",
      body: "Components without a Figma counterpart operate outside your design process. When coverage is low, designers and engineers work from different sources of truth — leading to inconsistent decisions and slower iteration.",
      affects: "All users",
      teamImpact: "Onboarding & handoff clarity",
    };
  }
  if (token !== null && token < 75) {
    return {
      headline: "Hardcoded colors are creating future rework",
      body: "Every component that bypasses design tokens adds to the manual effort required when the brand evolves. At your current adoption rate, a rebrand or theme change would require hands-on edits across a significant portion of your component library.",
      affects: "All users (theming)",
      teamImpact: "Rebrand & maintenance cost",
    };
  }
  return {
    headline: "Your design system is in strong health",
    body: "All tracked metrics are looking good. This means faster delivery, lower maintenance costs, and a product that's consistent and accessible for every user. Keep the momentum going.",
    affects: "",
    teamImpact: "",
  };
}

function ImpactCallout({
  a11yScore,
  tokenScore,
  parityScore,
  coverageScore,
}: {
  a11yScore: number | null;
  tokenScore: number | null;
  parityScore: number | null;
  coverageScore: number | null;
}) {
  const insight = getImpactInsight({
    a11y: a11yScore,
    token: tokenScore,
    parity: parityScore,
    coverage: coverageScore,
  });

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg px-4 py-3 mt-3 mb-1"
      style={{ borderLeftColor: "#6366f1", borderLeftWidth: 3 }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500 mb-1.5">
        Why this matters
      </p>
      <p className="text-sm font-semibold text-gray-900 mb-1">
        {insight.headline}
      </p>
      <p className="text-xs text-gray-500 leading-relaxed mb-2.5">
        {insight.body}
      </p>
      {(insight.affects || insight.teamImpact) && (
        <div className="flex gap-5">
          {insight.affects && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              Affects: {insight.affects}
            </div>
          )}
          {insight.teamImpact && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              Team impact: {insight.teamImpact}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const {
    results,
    figmaComponents,
    figmaError,
    isScanning,
    progressLabel,
    error,
    startScan,
    parityReport,
    impactScore,
    usageData,
  } = useAuditStore();
  const { nucleusPath } = useOnboardingStore();

  const handlePublish = async () => {
    if (!parityReport || !results) return;
    const date = new Date().toISOString().split("T")[0];

    const history = await db.scanHistory
      .orderBy("timestamp")
      .reverse()
      .limit(2)
      .toArray();
    const delta =
      history.length >= 2 ? computeDelta(history[0], history[1]) : null;

    const html = generateReport({
      parityReport,
      results,
      nucleusPath: nucleusPath ?? "",
      delta: delta ?? undefined,
    });
    downloadReport(html, date);
  };

  // A11y score derived from scan results
  const a11yScore =
    results && results.components.length > 0
      ? averageScores(
          results.components.map((c) => {
            const passed = A11Y_KEYS.filter(
              (k) => c[k as keyof typeof c],
            ).length;
            return Math.round((passed / A11Y_KEYS.length) * 100);
          }),
        )
      : null;

  const a11yFailCount =
    results?.components.filter((c) => {
      const passed = A11Y_KEYS.filter((k) => c[k as keyof typeof c]).length;
      return passed < A11Y_KEYS.length;
    }).length ?? 0;

  const tokenScore =
    results && results.components.length > 0
      ? Math.round(
          (results.components.filter((c) => c.hardcodedColors.length === 0)
            .length /
            results.components.length) *
            100,
        )
      : null;

  const tokenFailCount =
    results?.components.filter((c) => c.hardcodedColors.length > 0).length ?? 0;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1 text-sm font-mono">
              {nucleusPath}
            </p>
          </div>
          {results && parityReport && (
            <button
              onClick={handlePublish}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <Download size={16} />
              Publish Report
            </button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Scan failed</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Scanning state */}
        {isScanning && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <p className="text-gray-600 text-sm">
              {progressLabel || "Scanning..."}
            </p>
          </div>
        )}

        {/* Results */}
        {results && !isScanning && (
          <>
            {/* Figma warning */}
            {figmaError && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <AlertTriangle
                  size={18}
                  className="text-amber-500 mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Figma data unavailable
                  </p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    {figmaError} — code analysis results are still shown below.
                  </p>
                </div>
              </div>
            )}

            {/* Health scores */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-3">
              {parityReport ? (
                <>
                  <HealthScoreCard
                    label="Parity Score"
                    score={parityReport.overallScore}
                    detail={`${parityReport.alignedCount} aligned · ${parityReport.issuesCount} with issues`}
                    to="/parity"
                    tooltipContent={{
                      measures:
                        "Alignment between Figma designs and code implementations",
                      why: "When design and code drift apart, engineers spend time reverse-engineering intent rather than building. Consistent parity accelerates delivery, reduces QA cycles, and ensures your product looks the way it was designed.",
                      userImpact:
                        "A consistent product that looks and behaves as intended across every surface",
                      teamImpact:
                        "Faster delivery, fewer revision cycles, clearer design-to-dev handoffs",
                    }}
                  />
                  <HealthScoreCard
                    label="Coverage"
                    score={parityReport.coverageScore}
                    detail={`${results.totalComponents - parityReport.missingInFigma.length} of ${results.totalComponents} matched to Figma`}
                    to="/parity"
                    tooltipContent={{
                      measures:
                        "How much of your codebase has a confirmed Figma counterpart",
                      why: "Components without Figma documentation exist outside the design system. When coverage is low, designers and engineers are working from different sources of truth — leading to inconsistent decisions and slower iteration.",
                      userImpact:
                        "More consistent UI decisions across the product as design and code stay in sync",
                      teamImpact:
                        "A single source of truth reduces ambiguity and makes onboarding faster",
                    }}
                  />
                </>
              ) : (
                <>
                  <HealthScoreCardEmpty
                    label="Parity Score"
                    reason="Figma data required"
                  />
                  <HealthScoreCardEmpty
                    label="Coverage"
                    reason="Figma data required"
                  />
                </>
              )}
              {a11yScore !== null ? (
                <HealthScoreCard
                  label="A11y Score"
                  score={a11yScore}
                  detail={`${results.components.length - a11yFailCount} of ${results.components.length} passing all checks`}
                  to="/accessibility"
                  tooltipContent={{
                    measures:
                      "WCAG 2.2 AA compliance across your component library",
                    why: "An estimated 1 in 4 adults lives with some form of disability. Accessibility isn't just a compliance requirement — it's a measure of how well your product serves your entire audience. Issues caught here are far cheaper to fix than those found post-launch.",
                    userImpact:
                      "A product that works for keyboard users, screen reader users, and users with low vision",
                    teamImpact:
                      "Reduces legal and compliance risk; fixes made here apply across every product using the system",
                  }}
                />
              ) : (
                <HealthScoreCardEmpty label="A11y Score" reason="Run a scan" />
              )}
              {tokenScore !== null ? (
                <HealthScoreCard
                  label="Token Score"
                  score={tokenScore}
                  detail={`${results.components.length - tokenFailCount} of ${results.components.length} using tokens`}
                  to="/tokens"
                  tooltipContent={{
                    measures:
                      "How much of your component library uses design tokens instead of hardcoded color values",
                    why: "Hardcoded colors are design debt. Every component that bypasses tokens adds to the manual work required when the brand evolves — whether that's a refresh, a rebrand, or adding dark mode. Token adoption is what makes a design system scalable.",
                    userImpact:
                      "A visually consistent product that can adopt theming (e.g. dark mode) without gaps",
                    teamImpact:
                      "A rebrand becomes a configuration change, not a multi-week engineering project",
                  }}
                />
              ) : (
                <HealthScoreCardEmpty label="Token Score" reason="Run a scan" />
              )}
              {impactScore !== null ? (
                <HealthScoreCard
                  label="Impact Score"
                  score={impactScore}
                  detail={`${usageData?.components.length ?? 0} components tracked`}
                  to="/impact"
                  tooltipContent={{
                    measures: "Reach × quality across your component fleet",
                    why: "High-impact components are both widely used and well-built. A low impact score means either low adoption or quality issues in commonly-used components — limiting the design system's value to your product teams.",
                    userImpact:
                      "A design system that's both adopted and trustworthy across every consuming product",
                    teamImpact:
                      "Focuses improvement effort where it matters most — high-reach components with quality gaps",
                  }}
                />
              ) : (
                <HealthScoreCardEmpty
                  label="Impact Score"
                  reason="Import usage data"
                />
              )}
            </div>

            {/* Health narrative */}
            {parityReport && a11yScore !== null && (
              <HealthNarrative
                parityReport={parityReport}
                a11yFailCount={a11yFailCount}
                tokenFailCount={tokenFailCount}
                totalComponents={results.totalComponents}
                figmaCount={figmaComponents.length}
              />
            )}

            {(a11yScore !== null || tokenScore !== null) && (
              <ImpactCallout
                a11yScore={a11yScore}
                tokenScore={tokenScore}
                parityScore={parityReport?.overallScore ?? null}
                coverageScore={parityReport?.coverageScore ?? null}
              />
            )}

            <DeltaSection />

            {/* Score history */}
            <ScoreHistoryChart />
          </>
        )}

        {/* Empty state */}
        {!results && !isScanning && !error && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Package size={40} className="text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              No scan results yet
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Run an audit to scan Nucleus components and compare with Figma.
            </p>
            <button
              onClick={startScan}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <Play size={16} />
              Run First Audit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Health score card ---

type ScoreTooltip = {
  measures: string;
  why: string;
  userImpact: string;
  teamImpact: string;
};

function HealthScoreCard({
  label,
  score,
  detail,
  to,
  tooltipContent,
}: {
  label: string;
  score: number;
  detail: string;
  to: string;
  tooltipContent?: ScoreTooltip;
}) {
  const grade = getGrade(score);
  const colorClass = getGradeColor(grade);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`relative rounded-xl border p-6 ${colorClass}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
          {label}
        </p>
        {tooltipContent && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowTooltip(false);
              }}
              aria-label={`Why ${label} matters`}
              className="opacity-40 hover:opacity-70 transition-opacity"
            >
              <Info size={13} />
            </button>
            {showTooltip && (
              <div className="absolute top-full mt-2 right-0 z-10 w-72 bg-gray-900 text-white text-xs rounded-lg p-4 shadow-lg text-left font-normal normal-case tracking-normal space-y-3">
                <p className="text-gray-400">{tooltipContent.measures}</p>
                <p className="text-gray-200 leading-relaxed">
                  {tooltipContent.why}
                </p>
                <div className="border-t border-gray-700 pt-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-indigo-400 shrink-0 mt-0.5">↗</span>
                    <p>
                      <span className="text-white font-medium">
                        User impact:
                      </span>{" "}
                      <span className="text-gray-300">
                        {tooltipContent.userImpact}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-indigo-400 shrink-0 mt-0.5">↗</span>
                    <p>
                      <span className="text-white font-medium">
                        Team impact:
                      </span>{" "}
                      <span className="text-gray-300">
                        {tooltipContent.teamImpact}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-5xl font-bold leading-none">{score}</p>
      <p className="text-base font-semibold mt-2">{grade}</p>
      <p className="text-xs mt-3 opacity-60">{detail}</p>
      <Link
        to={to}
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
      >
        View details <ArrowRight size={11} />
      </Link>
    </div>
  );
}

function HealthScoreCardEmpty({
  label,
  reason,
}: {
  label: string;
  reason: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">
        {label}
      </p>
      <p className="text-5xl font-bold text-gray-200 leading-none">—</p>
      <p className="text-xs text-gray-400 mt-4">{reason}</p>
    </div>
  );
}

// --- Health narrative ---

function HealthNarrative({
  parityReport,
  a11yFailCount,
  tokenFailCount,
  totalComponents,
  figmaCount,
}: {
  parityReport: ParityReport;
  a11yFailCount: number;
  tokenFailCount: number;
  totalComponents: number;
  figmaCount: number;
}) {
  const parts: string[] = [];

  parts.push(
    `${totalComponents} code components · ${figmaCount > 0 ? figmaCount + " in Figma" : "no Figma data"}`,
  );
  if (parityReport.alignedCount > 0) {
    parts.push(`${parityReport.alignedCount} aligned`);
  }
  if (parityReport.issuesCount > 0) {
    parts.push(
      `${parityReport.issuesCount} with issue${parityReport.issuesCount > 1 ? "s" : ""}`,
    );
  }
  if (parityReport.missingInFigma.length > 0) {
    parts.push(`${parityReport.missingInFigma.length} missing in Figma`);
  }
  if (a11yFailCount > 0) {
    parts.push(`${a11yFailCount} with a11y gap${a11yFailCount > 1 ? "s" : ""}`);
  }
  if (tokenFailCount > 0) {
    parts.push(
      `${tokenFailCount} with hardcoded color${tokenFailCount > 1 ? "s" : ""}`,
    );
  }

  return (
    <p className="text-sm text-gray-400 mt-2 mb-2">
      {parts.join(" · ")} · Last scanned{" "}
      {new Date(parityReport.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </p>
  );
}

// --- Delta section ---

function DeltaSection() {
  const { parityReport } = useAuditStore();
  const [delta, setDelta] = useState<ScanDelta | null>(null);
  const [previousDate, setPreviousDate] = useState<string | null>(null);

  useEffect(() => {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    db.scanHistory
      .orderBy("timestamp")
      .reverse()
      .toArray()
      .then((rows) => {
        const current = rows[0];
        const previous = rows.find((e) => e.timestamp <= thirtyDaysAgo);
        if (!current || !previous) return;
        const computed = computeDelta(current, previous);
        if (!computed) return;
        setDelta(computed);
        setPreviousDate(
          new Date(previous.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        );
      });
  }, [parityReport]);

  if (!delta) return null;

  const DeltaBadge = ({ value, label }: { value: number; label: string }) => (
    <div className="text-center">
      <div
        className={`text-lg font-bold ${
          value > 0
            ? "text-green-700"
            : value < 0
              ? "text-red-600"
              : "text-gray-400"
        }`}
      >
        {value > 0 ? `↑${value}` : value < 0 ? `↓${Math.abs(value)}` : "—"}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );

  const overallLabel =
    delta.overallDelta > 0
      ? `Overall ↑${delta.overallDelta} pts`
      : delta.overallDelta < 0
        ? `Overall ↓${Math.abs(delta.overallDelta)} pts`
        : "No change";

  return (
    <div className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <span className="font-semibold text-sm text-gray-900">
            Past 30 days
          </span>
          <span className="text-xs text-gray-400 ml-2">
            since {previousDate}
          </span>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
            delta.overallDelta > 0
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : delta.overallDelta < 0
                ? "bg-red-50 text-red-600 border-red-200"
                : "bg-gray-50 text-gray-500 border-gray-200"
          }`}
        >
          {overallLabel}
        </span>
      </div>

      <div className="px-5 py-4 grid grid-cols-4 gap-4 border-b border-gray-100">
        <DeltaBadge value={delta.parityDelta} label="Parity" />
        <DeltaBadge value={delta.coverageDelta} label="Coverage" />
        <DeltaBadge value={delta.a11yDelta} label="A11y" />
        <DeltaBadge value={delta.tokenDelta} label="Token" />
      </div>

      {(delta.resolvedComponents.length > 0 ||
        delta.newIssueComponents.length > 0) && (
        <div className="px-5 py-3 grid grid-cols-2 gap-3">
          {delta.resolvedComponents.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-700 mb-2">
                ✓ {delta.resolvedComponents.length} issue
                {delta.resolvedComponents.length > 1 ? "s" : ""} resolved
              </p>
              <div className="space-y-1">
                {delta.resolvedComponents.map((name) => (
                  <p key={name} className="text-xs text-gray-600">
                    {name}
                  </p>
                ))}
              </div>
            </div>
          )}
          {delta.newIssueComponents.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-2">
                ⚠ {delta.newIssueComponents.length} new issue
                {delta.newIssueComponents.length > 1 ? "s" : ""} introduced
              </p>
              <div className="space-y-1">
                {delta.newIssueComponents.map((name) => (
                  <p key={name} className="text-xs text-gray-600">
                    {name}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Score history chart ---

const TIMEFRAMES = [
  { label: "8 days", days: 8 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
] as const;

type TimeframeDays = (typeof TIMEFRAMES)[number]["days"];

function ScoreHistoryChart() {
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [timeframe, setTimeframe] = useState<TimeframeDays>(8);

  useEffect(() => {
    db.scanHistory
      .orderBy("timestamp")
      .reverse()
      .limit(365)
      .toArray()
      .then((rows) => {
        const byDay = new Map<string, ScanHistoryEntry>();
        for (const row of rows) {
          const day = row.timestamp.slice(0, 10);
          if (!byDay.has(day)) byDay.set(day, row);
        }
        const daily = Array.from(byDay.values()).reverse();
        const sliced = timeframe === null ? daily : daily.slice(-timeframe);
        setHistory(sliced);
      });
  }, [timeframe]);

  if (history.length < 2) return null;

  const data = history.map((entry) => ({
    date: new Date(entry.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    Parity: entry.parityScore,
    Coverage: entry.coverageScore,
    A11y: entry.a11yScore,
  }));

  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const parityDelta = latest.parityScore - previous.parityScore;
  const a11yDelta = latest.a11yScore - previous.a11yScore;

  const Delta = ({ value }: { value: number }) => (
    <span
      className={`text-xs font-medium ${
        value > 0
          ? "text-green-600"
          : value < 0
            ? "text-red-500"
            : "text-gray-400"
      }`}
    >
      {value > 0 ? `↑${value}` : value < 0 ? `↓${Math.abs(value)}` : "—"}
    </span>
  );

  return (
    <div className="mt-4 bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Score history</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {history.length} days shown
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-xs text-gray-400">Parity</p>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-900">
                {latest.parityScore}
              </span>
              <Delta value={parityDelta} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">A11y</p>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-900">
                {latest.a11yScore}
              </span>
              <Delta value={a11yDelta} />
            </div>
          </div>
          <select
            value={timeframe ?? "null"}
            onChange={(e) => {
              const val = e.target.value;
              setTimeframe(
                val === "null" ? null : (Number(val) as TimeframeDays),
              );
            }}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {TIMEFRAMES.map((t) => (
              <option key={String(t.days)} value={t.days ?? "null"}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey="Parity"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3, fill: "#6366f1" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="Coverage"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#8b5cf6" }}
            activeDot={{ r: 5 }}
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="A11y"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: "#10b981" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
