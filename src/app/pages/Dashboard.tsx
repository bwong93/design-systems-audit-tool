import {
  Play,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Package,
  Info,
} from "lucide-react";
import { useState } from "react";
import { useAuditStore } from "../../stores/audit-store";
import { useOnboardingStore } from "../../stores/onboarding-store";
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
