import {
  Play,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Package,
  Info,
  Download,
} from "lucide-react";
import { useState, useEffect } from "react";
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
import type { ComponentMetadata } from "../../types/component";

export default function Dashboard() {
  const {
    results,
    figmaComponents,
    figmaError,
    isScanning,
    progressLabel,
    error,
    startScan,
  } = useAuditStore();
  const { nucleusPath } = useOnboardingStore();
  const { parityReport } = useAuditStore();

  const handlePublish = () => {
    if (!parityReport || !results) return;
    const date = new Date().toISOString().split("T")[0];
    const html = generateReport({
      parityReport,
      results,
      nucleusPath: nucleusPath ?? "",
    });
    downloadReport(html, date);
  };

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

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard
                icon={<Package size={20} className="text-primary-600" />}
                label="Code components"
                value={String(results.totalComponents)}
                bg="bg-primary-50"
                description="Total number of components found in the Nucleus src/components and src/patterns directories."
              />
              <SummaryCard
                icon={<CheckCircle size={20} className="text-green-600" />}
                label="Fully structured"
                value={String(
                  results.components.filter(hasFullStructure).length,
                )}
                bg="bg-green-50"
                description="Components that have all required files: Component.tsx, Component.spec.tsx, Component.stories.tsx, and index.ts."
              />
              <SummaryCard
                icon={<AlertTriangle size={20} className="text-amber-600" />}
                label="Missing files"
                value={String(
                  results.components.filter((c) => !hasFullStructure(c)).length,
                )}
                bg="bg-amber-50"
                description="Components missing one or more required files. Missing tests, stories, or an index file means the component isn't fully documented or properly exported."
              />
              <SummaryCard
                icon={
                  <Package
                    size={20}
                    className={
                      figmaComponents.length > 0
                        ? "text-purple-600"
                        : "text-gray-400"
                    }
                  />
                }
                label="Figma components"
                value={
                  figmaComponents.length > 0
                    ? String(figmaComponents.length)
                    : "—"
                }
                bg={figmaComponents.length > 0 ? "bg-purple-50" : "bg-gray-50"}
                description="Total components found in your Figma library. Used for parity scoring — comparing what designers have spec'd against what's implemented in code."
                tooltipAlign="right"
              />
            </div>

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

function hasFullStructure(c: ComponentMetadata) {
  return c.hasSpec && c.hasStories && c.hasIndex;
}

function SummaryCard({
  icon,
  label,
  value,
  bg,
  description,
  tooltipAlign = "left",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
  description: string;
  tooltipAlign?: "left" | "right";
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start gap-4">
        <div className={`${bg} p-2.5 rounded-lg shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-sm text-gray-500">{label}</p>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-gray-300 hover:text-gray-400 transition-colors"
                aria-label={`More info about ${label}`}
              >
                <Info size={13} />
              </button>
              {showTooltip && (
                <div
                  className={`absolute top-5 z-10 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg ${
                    tooltipAlign === "right" ? "right-0" : "left-0"
                  }`}
                >
                  {description}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
