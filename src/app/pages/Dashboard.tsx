import {
  Play,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Package,
  Download,
  ArrowRight,
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
          <div className="flex items-center gap-2">
            {results && parityReport && (
              <button
                onClick={handlePublish}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <Download size={16} />
                Publish Report
              </button>
            )}
            <button
              onClick={startScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isScanning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : results ? (
                <RefreshCw size={16} />
              ) : (
                <Play size={16} />
              )}
              {isScanning ? "Scanning..." : results ? "Re-scan" : "Run Audit"}
            </button>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
              {parityReport ? (
                <>
                  <HealthScoreCard
                    label="Parity Score"
                    score={parityReport.overallScore}
                    detail={`${parityReport.alignedCount} aligned · ${parityReport.issuesCount} with issues`}
                    to="/parity"
                  />
                  <HealthScoreCard
                    label="Coverage"
                    score={parityReport.coverageScore}
                    detail={`${results.totalComponents - parityReport.missingInFigma.length} of ${results.totalComponents} matched to Figma`}
                    to="/parity"
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
                />
              ) : (
                <HealthScoreCardEmpty label="Token Score" reason="Run a scan" />
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

function HealthScoreCard({
  label,
  score,
  detail,
  to,
}: {
  label: string;
  score: number;
  detail: string;
  to: string;
}) {
  const grade = getGrade(score);
  const colorClass = getGradeColor(grade);

  return (
    <div className={`rounded-xl border p-6 ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-4">
        {label}
      </p>
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

function ScoreHistoryChart() {
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  useEffect(() => {
    db.scanHistory
      .orderBy("timestamp")
      .reverse()
      .limit(8)
      .toArray()
      .then((rows) => setHistory(rows.reverse()));
  }, []);

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
            Last {history.length} scans
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
