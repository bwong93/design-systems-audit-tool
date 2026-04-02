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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                description="Components that have all 4 required files: Component.tsx (implementation), Component.spec.tsx (tests), Component.stories.tsx (Storybook), and index.ts (exports). This is the expected standard for every Nucleus component."
              />
              <SummaryCard
                icon={<AlertTriangle size={20} className="text-amber-600" />}
                label="Missing files"
                value={String(
                  results.components.filter((c) => !hasFullStructure(c)).length,
                )}
                bg="bg-amber-50"
                description="Components missing one or more required files. Missing tests, stories, or an index file means the component isn't fully documented, testable, or properly exported — these should be addressed."
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

            {/* Legend */}
            <div className="flex items-center gap-6 px-1 mb-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Status
              </p>
              <div className="flex items-center gap-4">
                <LegendItem color="bg-green-400" label="All checks pass" />
                <LegendItem color="bg-amber-400" label="1–2 issues" />
                <LegendItem color="bg-red-400" label="3+ issues" />
              </div>
            </div>

            {/* Checks explained */}
            <ChecksExplained />

            {/* Component table */}
            <div className="bg-white rounded-lg border border-gray-200 mt-4">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Components</h2>
                <span className="text-sm text-gray-400">
                  Last scanned{" "}
                  {new Date(results.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {results.components.map((component) => (
                  <ComponentRow key={component.name} component={component} />
                ))}
              </div>
            </div>

            {/* Scan errors */}
            {results.errors.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  {results.errors.length} component
                  {results.errors.length > 1 ? "s" : ""} could not be analyzed
                </p>
                <ul className="text-xs text-amber-700 space-y-1">
                  {results.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      · {e.componentName ?? e.filePath}: {e.error}
                    </li>
                  ))}
                  {results.errors.length > 5 && (
                    <li className="text-amber-500">
                      …and {results.errors.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
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

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function ChecksExplained() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 px-4 py-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full text-left"
      >
        <Info size={15} className="text-gray-400 shrink-0" />
        <span className="font-medium">What do these checks mean?</span>
        <span className="ml-auto text-gray-400 text-xs">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-600 border-t border-gray-200 pt-3">
          <CheckItem
            label="Missing .spec.tsx"
            good="Tests exist — component behaviour is verified"
            bad="No tests — bugs and regressions may go undetected"
          />
          <CheckItem
            label="Missing .stories.tsx"
            good="Stories exist — component is documented in Storybook"
            bad="No stories — designers and engineers have no visual reference"
          />
          <CheckItem
            label="Missing index.ts"
            good="Properly exported — can be imported by consuming apps"
            bad="No index — component may not be accessible from the package"
          />
          <CheckItem
            label="No theme tokens detected"
            good="Uses theme.tokens.* — colours and spacing adapt across themes"
            bad="Hard-coded values — won't respond to theme changes or rebrands"
          />
          <CheckItem
            label="No :focus-visible styles"
            good="Keyboard focus is visible — meets WCAG 2.2 AA"
            bad="Focus styles missing — keyboard and assistive technology users affected"
          />
        </div>
      )}
    </div>
  );
}

function CheckItem({
  label,
  good,
  bad,
}: {
  label: string;
  good: string;
  bad: string;
}) {
  return (
    <div className="py-1.5">
      <p className="font-medium text-gray-700 mb-0.5">{label}</p>
      <p className="text-green-700">✓ {good}</p>
      <p className="text-red-600">✗ {bad}</p>
    </div>
  );
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

function ComponentRow({ component }: { component: ComponentMetadata }) {
  const [expanded, setExpanded] = useState(false);

  const issues = [
    !component.hasSpec && "Missing .spec.tsx — no tests",
    !component.hasStories &&
      "Missing .stories.tsx — no Storybook documentation",
    !component.hasIndex && "Missing index.ts — may not be properly exported",
    !component.usesTokens && "No theme tokens — may use hard-coded values",
    !component.hasFocusVisible &&
      "No :focus-visible — keyboard accessibility at risk",
  ].filter(Boolean) as string[];

  return (
    <div className="hover:bg-gray-50 transition-colors">
      <button
        onClick={() => issues.length > 0 && setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              issues.length === 0
                ? "bg-green-400"
                : issues.length <= 2
                  ? "bg-amber-400"
                  : "bg-red-400"
            }`}
          />
          <span className="text-sm font-medium text-gray-900">
            {component.name}
          </span>
          {component.props.length > 0 && (
            <span className="text-xs text-gray-400">
              {component.props.length} props
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {issues.length === 0 ? (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              All checks pass
            </span>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {issues.length} issue{issues.length > 1 ? "s" : ""} — click to
              expand
            </span>
          )}
        </div>
      </button>
      {expanded && issues.length > 0 && (
        <div className="px-6 pb-4 pl-11">
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li
                key={i}
                className="text-xs text-amber-700 flex items-start gap-1.5"
              >
                <span className="mt-0.5 shrink-0">⚠</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
