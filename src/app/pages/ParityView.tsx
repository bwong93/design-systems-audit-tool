import { useState, useEffect } from "react";
import {
  GitCompare,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  XCircle,
  Undo2,
  ExternalLink,
  Info,
  ListTodo,
} from "lucide-react";
import { figmaLink, githubLink, storybookLink } from "../../utils/links";
import { useAuditStore } from "../../stores/audit-store";
import { useOnboardingStore } from "../../stores/onboarding-store";
import { getGradeColor, getGradeDot } from "../../services/score-calculator";
import { runParityCheck } from "../../services/parity-checker";
import {
  calculatePriorities,
  type ActionItem,
} from "../../services/priority-calculator";
import { db, type FigmaOnlyDecision } from "../../services/db";
import type {
  ComponentParityResult,
  ParityIssue,
  FigmaCandidate,
  PropDetail,
  FigmaMissingItem,
} from "../../types/parity";
import type { DriftReason } from "../../types/figma";

const DRIFT_REASONS: {
  value: DriftReason;
  label: string;
  description: string;
}[] = [
  {
    value: "naming-convention",
    label: "Naming Convention",
    description: 'e.g. Figma uses "Type", code uses "variant"',
  },
  {
    value: "design-abstraction",
    label: "Design Abstraction",
    description: "Figma shows visually what code expresses as props",
  },
  {
    value: "pending-implementation",
    label: "Pending Implementation",
    description: "Known gap — being addressed in an upcoming sprint",
  },
  {
    value: "intentional-divergence",
    label: "Intentional Divergence",
    description: "Design and code deliberately differ here",
  },
];

async function rerunParity() {
  const { results, figmaComponents } = useAuditStore.getState();
  if (!results || !figmaComponents.length) return;
  const report = await runParityCheck(results.components, figmaComponents);
  useAuditStore.setState({ parityReport: report });
}

export default function ParityView() {
  const { parityReport, results, figmaComponents } = useAuditStore();
  const { figmaFileKey } = useOnboardingStore();
  const [autoExpandComponent, setAutoExpandComponent] = useState<string | null>(
    null,
  );

  const handleActionNavigate = (componentName: string) => {
    setAutoExpandComponent(componentName);
    setTimeout(() => {
      document
        .getElementById(`component-row-${componentName}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  if (!results) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-96 text-center">
        <GitCompare size={40} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          No scan results yet
        </h2>
        <p className="text-sm text-gray-500">
          Run an audit from the Dashboard first.
        </p>
      </div>
    );
  }

  if (!parityReport) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-96 text-center">
        <GitCompare size={40} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          No Figma data available
        </h2>
        <p className="text-sm text-gray-500">
          Check your Figma connection in Settings and re-run the audit.
        </p>
      </div>
    );
  }

  const {
    overallScore,
    overallGrade,
    coverageScore,
    components,
    missingInCode,
    missingInFigma,
  } = parityReport;

  const coverageGrade =
    coverageScore >= 90
      ? "Excellent"
      : coverageScore >= 75
        ? "Good"
        : coverageScore >= 60
          ? "Fair"
          : coverageScore >= 40
            ? "Poor"
            : "Critical";

  const needsReviewCount = components.filter(
    (c) => c.status === "needs-review",
  ).length;

  const figmaAllComponents = figmaComponents.map((f) => ({
    name: f.name,
    id: f.id,
  }));

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">DS Parity</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Compare Figma components against code implementations, surface
              mismatches, and track intentional differences.
            </p>
            <p className="text-gray-400 mt-0.5 text-xs">
              {parityReport.totalCodeComponents} code components ·{" "}
              {parityReport.totalFigmaComponents} Figma components
            </p>
          </div>
          <div className="flex gap-3">
            <ScoreBadge
              score={overallScore}
              grade={overallGrade}
              label="Parity Score"
              tooltip="The average alignment score across all matched components. Based on name and prop consistency — excludes components with no Figma match."
              legendType="parity"
            />
            <ScoreBadge
              score={coverageScore}
              grade={coverageGrade}
              label="Coverage"
              tooltip="The percentage of code components that have a confirmed Figma counterpart. Components marked as 'needs review' or 'missing in Figma' are not counted."
              legendType="coverage"
            />
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<CheckCircle size={18} className="text-green-600" />}
            label="Aligned"
            value={parityReport.alignedCount}
            bg="bg-green-50"
            tooltip="Components with a confirmed Figma match and a parity score of 90 or above. Name and props are consistent between Figma and code."
          />
          <StatCard
            icon={<AlertTriangle size={18} className="text-amber-600" />}
            label="Have issues"
            value={parityReport.issuesCount}
            bg="bg-amber-50"
            tooltip="Components matched to Figma but with a parity score below 90. Common causes: missing props in code, naming differences, or undocumented Figma properties."
          />
          <StatCard
            icon={<XCircle size={18} className="text-red-600" />}
            label="Missing in Figma"
            value={missingInFigma.length}
            bg="bg-red-50"
            tooltip="Code components with no confirmed Figma counterpart. These reduce the coverage score. Use the component row to link a Figma match, or mark as intentional."
          />
          {needsReviewCount > 0 && (
            <StatCard
              icon={<AlertTriangle size={18} className="text-violet-600" />}
              label="Need review"
              value={needsReviewCount}
              bg="bg-violet-50"
              tooltip="Components where the fuzzy matcher found a possible Figma match but isn't confident enough to auto-confirm it. Expand the row to confirm or dismiss the suggestion."
            />
          )}
        </div>

        {/* Action items */}
        <ActionItemsPanel
          report={parityReport}
          onNavigate={handleActionNavigate}
        />

        {/* Component list */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Components</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {components.map((component) => (
              <ComponentParityRow
                key={component.componentName}
                component={component}
                figmaFileKey={figmaFileKey}
                figmaAllComponents={figmaAllComponents}
                onMatchChanged={rerunParity}
                autoExpand={autoExpandComponent === component.componentName}
                onAutoExpandDone={() => setAutoExpandComponent(null)}
              />
            ))}
          </div>
        </div>

        {/* Figma components without a code match */}
        {missingInCode.length > 0 && (
          <MissingInCodeSection
            items={missingInCode}
            figmaFileKey={figmaFileKey}
            codeComponentNames={
              results?.components.map((c) => c.name).sort() ?? []
            }
            onResolved={rerunParity}
          />
        )}
      </div>
    </div>
  );
}

const OWNER_LABEL: Record<string, string> = {
  engineer: "⚙ Eng",
  designer: "🎨 Design",
  both: "Both",
};

const TIER_CONFIG = {
  "quick-win": {
    label: "Quick wins",
    dot: "bg-green-400",
    text: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  critical: {
    label: "Critical",
    dot: "bg-red-400",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-100",
  },
  issue: {
    label: "Has issues",
    dot: "bg-amber-400",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
};

function ActionItemsPanel({
  report,
  onNavigate,
}: {
  report: import("../../types/parity").ParityReport;
  onNavigate: (componentName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = calculatePriorities(report);

  if (items.length === 0) return null;

  const quickWins = items.filter((i) => i.tier === "quick-win");
  const critical = items.filter((i) => i.tier === "critical");
  const issues = items.filter((i) => i.tier === "issue");

  const summary = [
    quickWins.length > 0
      ? `${quickWins.length} quick win${quickWins.length > 1 ? "s" : ""}`
      : null,
    critical.length > 0 ? `${critical.length} critical` : null,
    issues.length > 0
      ? `${issues.length} issue${issues.length > 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <ListTodo size={16} className="text-gray-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-900">
          Action items
        </span>
        <span className="text-xs text-gray-400">{summary}</span>
        <span className="ml-auto">
          {open ? (
            <ChevronUp size={14} className="text-gray-400" />
          ) : (
            <ChevronDown size={14} className="text-gray-400" />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-6 py-4 space-y-5">
          {(
            [
              ["quick-win", quickWins],
              ["critical", critical],
              ["issue", issues],
            ] as [string, ActionItem[]][]
          )
            .filter(([, tier]) => tier.length > 0)
            .map(([tierKey, tierItems]) => {
              const cfg = TIER_CONFIG[tierKey as keyof typeof TIER_CONFIG];
              return (
                <div key={tierKey}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}
                    />
                    <span className={`text-xs font-semibold ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {tierItems.map((item) => (
                      <button
                        key={item.componentName + item.label}
                        onClick={() => onNavigate(item.componentName)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left hover:brightness-95 transition-all ${cfg.bg} ${cfg.border}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.sublabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                            {OWNER_LABEL[item.owner]}
                          </span>
                          {item.potentialGain > 0 && (
                            <span className="text-xs text-gray-400">
                              +{item.potentialGain} pts
                            </span>
                          )}
                          <ExternalLink size={11} className="text-gray-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function MissingInCodeSection({
  items,
  figmaFileKey,
  codeComponentNames,
  onResolved,
}: {
  items: FigmaMissingItem[];
  figmaFileKey: string;
  codeComponentNames: string[];
  onResolved: () => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, FigmaOnlyDecision>>(
    {},
  );
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    db.figmaOnlyDecisions.toArray().then((rows) => {
      const map: Record<string, FigmaOnlyDecision> = {};
      rows.forEach((r) => (map[r.figmaCodeName.toLowerCase()] = r));
      setDecisions(map);
    });
  }, []);

  const handleLink = async (item: FigmaMissingItem) => {
    const codeName = pending[item.codeName];
    if (!codeName) return;
    setSaving(item.codeName);
    await db.componentMappings
      .where("codeComponentName")
      .equalsIgnoreCase(codeName)
      .delete();
    await db.componentMappings.add({
      codeComponentName: codeName,
      figmaComponentName: item.figmaName,
      figmaNodeId: item.figmaNodeId,
      createdAt: new Date().toISOString(),
    });
    setSaving(null);
    onResolved();
  };

  const handleIntentional = async (item: FigmaMissingItem) => {
    await db.figmaOnlyDecisions
      .where("figmaCodeName")
      .equalsIgnoreCase(item.codeName)
      .delete();
    const id = await db.figmaOnlyDecisions.add({
      figmaCodeName: item.codeName,
      createdAt: new Date().toISOString(),
    });
    const saved = await db.figmaOnlyDecisions.get(id);
    if (saved) {
      setDecisions((prev) => ({
        ...prev,
        [item.codeName.toLowerCase()]: saved,
      }));
    }
    onResolved();
  };

  const handleRemoveDecision = async (item: FigmaMissingItem) => {
    await db.figmaOnlyDecisions
      .where("figmaCodeName")
      .equalsIgnoreCase(item.codeName)
      .delete();
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[item.codeName.toLowerCase()];
      return next;
    });
    onResolved();
  };

  const unresolved = items.filter((i) => !decisions[i.codeName.toLowerCase()]);
  const resolved = items.filter((i) => decisions[i.codeName.toLowerCase()]);

  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">In Figma, not in code</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          These Figma components have no matching code implementation. Link them
          to an existing component or mark as intentional.
        </p>
      </div>

      {unresolved.length === 0 && (
        <div className="px-6 py-8 text-center text-sm text-green-600">
          All Figma components are accounted for.
        </div>
      )}

      {unresolved.length > 0 && (
        <div className="divide-y divide-gray-100">
          {unresolved.map((item) => (
            <div
              key={item.codeName}
              className="px-6 py-3 flex items-center gap-4"
            >
              <div className="w-44 shrink-0">
                <p className="text-sm font-medium text-gray-900">
                  {item.figmaName}
                </p>
                {figmaFileKey && item.figmaNodeId && (
                  <a
                    href={figmaLink(figmaFileKey, item.figmaNodeId)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 transition-colors mt-0.5"
                  >
                    <ExternalLink size={11} />
                    Figma
                  </a>
                )}
              </div>

              <div className="flex-1 min-w-0 flex items-center gap-2">
                <select
                  value={pending[item.codeName] ?? ""}
                  onChange={(e) =>
                    setPending((p) => ({
                      ...p,
                      [item.codeName]: e.target.value,
                    }))
                  }
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option value="">— Link to code component —</option>
                  {codeComponentNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleLink(item)}
                  disabled={!pending[item.codeName] || saving === item.codeName}
                  className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 font-medium transition-colors shrink-0"
                >
                  {saving === item.codeName ? "Saving…" : "Link"}
                </button>
              </div>

              <button
                onClick={() => handleIntentional(item)}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors shrink-0 whitespace-nowrap"
              >
                Intentional
              </button>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="border-t border-gray-100">
          <div className="px-6 py-2 bg-gray-50">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Resolved ({resolved.length})
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {resolved.map((item) => (
              <div
                key={item.codeName}
                className="px-6 py-3 flex items-center gap-3"
              >
                <span className="text-xs text-gray-300 w-44 shrink-0 font-medium">
                  {item.figmaName}
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  Intentional — no code needed
                </span>
                <button
                  onClick={() => handleRemoveDecision(item)}
                  className="ml-auto text-xs text-gray-300 hover:text-gray-500 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SCORE_LEGENDS: Record<
  "parity" | "coverage",
  { range: string; grade: string; meaning: string }[]
> = {
  parity: [
    {
      range: "90–100",
      grade: "Excellent",
      meaning:
        "Tightly aligned. Components match Figma in name and props with minimal drift.",
    },
    {
      range: "75–89",
      grade: "Good",
      meaning:
        "Minor drift. Design intent is mostly reflected in code. Normal for an active system.",
    },
    {
      range: "60–74",
      grade: "Fair",
      meaning:
        "Noticeable misalignment. Some props or names diverge from Figma spec.",
    },
    {
      range: "40–59",
      grade: "Poor",
      meaning:
        "Significant drift. Design and engineering are working from different sources of truth.",
    },
    {
      range: "0–39",
      grade: "Critical",
      meaning:
        "Severe misalignment. Figma is not a reliable reference for implementation.",
    },
  ],
  coverage: [
    {
      range: "90–100",
      grade: "Excellent",
      meaning: "Nearly all code components have a confirmed Figma counterpart.",
    },
    {
      range: "75–89",
      grade: "Good",
      meaning: "Most components are documented in Figma. A few gaps remain.",
    },
    {
      range: "60–74",
      grade: "Fair",
      meaning: "Several components lack a Figma counterpart.",
    },
    {
      range: "40–59",
      grade: "Poor",
      meaning:
        "A significant portion of the codebase is undocumented in Figma.",
    },
    {
      range: "0–39",
      grade: "Critical",
      meaning: "Most components have no Figma spec. Coverage is unreliable.",
    },
  ],
};

function ScoreBadge({
  score,
  grade,
  label,
  tooltip,
  legendType,
}: {
  score: number;
  grade: string;
  label: string;
  tooltip?: string;
  legendType?: "parity" | "coverage";
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const colorClass = getGradeColor(
    grade as Parameters<typeof getGradeColor>[0],
  );
  const legend = legendType ? SCORE_LEGENDS[legendType] : null;

  return (
    <div
      className={`relative border rounded-xl px-5 py-3 text-center ${colorClass}`}
    >
      <div className="flex items-center justify-center gap-1 mb-1">
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          {label}
        </p>
        {(tooltip || legend) && (
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="opacity-50 hover:opacity-80 transition-opacity"
          >
            <Info size={11} />
          </button>
        )}
      </div>
      <p className="text-3xl font-bold">{score}</p>
      <p className="text-sm font-medium mt-0.5">{grade}</p>
      {showTooltip && (tooltip || legend) && (
        <div className="absolute top-full mt-2 right-0 z-10 w-72 bg-gray-900 text-white text-xs rounded-lg p-4 shadow-lg text-left font-normal normal-case tracking-normal space-y-2.5">
          {tooltip && <p className="text-gray-300">{tooltip}</p>}
          {legend && (
            <div className="space-y-1.5 border-t border-gray-700 pt-2.5">
              {legend.map((row) => (
                <div key={row.grade} className="flex gap-2">
                  <span className="text-gray-400 w-14 shrink-0">
                    {row.range}
                  </span>
                  <span className="text-gray-200 font-medium w-16 shrink-0">
                    {row.grade}
                  </span>
                  <span className="text-gray-400">{row.meaning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
      <div className={`${bg} p-2 rounded-lg shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <div className="flex items-center gap-1">
          <p className="text-xs text-gray-500">{label}</p>
          {tooltip && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-gray-300 hover:text-gray-400 transition-colors"
              >
                <Info size={11} />
              </button>
              {showTooltip && (
                <div className="absolute top-5 left-0 z-10 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComponentParityRow({
  component,
  figmaFileKey,
  figmaAllComponents,
  onMatchChanged,
  autoExpand,
  onAutoExpandDone,
}: {
  component: ComponentParityResult;
  figmaFileKey: string;
  figmaAllComponents: { name: string; id: string }[];
  onMatchChanged: () => void;
  autoExpand?: boolean;
  onAutoExpandDone?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
      onAutoExpandDone?.();
    }
  }, [autoExpand, onAutoExpandDone]);
  const [approvingIssue, setApprovingIssue] = useState<ParityIssue | null>(
    null,
  );
  const [, forceRender] = useState(0);

  const dotClass = getGradeDot(component.grade);
  const hasIssues = component.issues.length > 0;
  const isNeedsReview = component.status === "needs-review";

  return (
    <div
      id={`component-row-${component.componentName}`}
      className="hover:bg-gray-50 transition-colors"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
          <div>
            <span className="text-sm font-medium text-gray-900">
              {component.componentName}
            </span>
            {component.figmaName && !isNeedsReview && (
              <span className="text-xs text-gray-400 ml-2">
                ← {component.figmaName}
              </span>
            )}
            {component.figmaName && isNeedsReview && (
              <span className="text-xs text-amber-500 ml-2">
                ← {component.figmaName}?
              </span>
            )}
          </div>
          {component.approvedExceptionCount > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {component.approvedExceptionCount} approved
            </span>
          )}
          {isNeedsReview && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Review needed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={storybookLink(component.componentName)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
            title="Open in Storybook"
          >
            <ExternalLink size={13} />
            Storybook
          </a>
          {component.figmaNodeId && figmaFileKey && !isNeedsReview && (
            <a
              href={figmaLink(figmaFileKey, component.figmaNodeId)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 transition-colors"
              title="Open in Figma"
            >
              <ExternalLink size={13} />
              Figma
            </a>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getGradeColor(component.grade)}`}
          >
            {component.score} · {component.grade}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-gray-400" />
          ) : (
            <ChevronDown size={14} className="text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-4 pl-11 space-y-3">
          {/* Inline Figma match control */}
          <FigmaMatchControl
            component={component}
            figmaFileKey={figmaFileKey}
            figmaAllComponents={figmaAllComponents}
            onChanged={onMatchChanged}
          />

          {/* Props comparison */}
          {component.propDetails.length > 0 && (
            <PropsComparison propDetails={component.propDetails} />
          )}

          {/* Issues */}
          {hasIssues && (
            <div className="space-y-2 pt-1">
              {component.issues.map((issue, i) => (
                <IssueRow
                  key={i}
                  issue={issue}
                  componentName={component.componentName}
                  onApprove={() => setApprovingIssue(issue)}
                  onRevoke={async () => {
                    await db.driftExceptions
                      .where("componentName")
                      .equals(component.componentName)
                      .delete();
                    forceRender((n) => n + 1);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {approvingIssue && (
        <ApproveDriftDialog
          componentName={component.componentName}
          issue={approvingIssue}
          onClose={() => setApprovingIssue(null)}
          onSaved={() => {
            setApprovingIssue(null);
            forceRender((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function FigmaMatchControl({
  component,
  figmaFileKey,
  figmaAllComponents,
  onChanged,
}: {
  component: ComponentParityResult;
  figmaFileKey: string;
  figmaAllComponents: { name: string; id: string }[];
  onChanged: () => void;
}) {
  const [showSelect, setShowSelect] = useState(false);
  const [selectedFigmaName, setSelectedFigmaName] = useState("");
  const [saving, setSaving] = useState(false);
  const [noMatchDecision, setNoMatchDecision] = useState<{
    reason: "gap" | "intentional";
  } | null>(null);

  useEffect(() => {
    db.noMatchDecisions
      .where("codeComponentName")
      .equalsIgnoreCase(component.componentName)
      .first()
      .then((d) => setNoMatchDecision(d ? { reason: d.reason } : null));
  }, [component.componentName]);

  const figmaNames = figmaAllComponents.map((f) => f.name).sort();

  const saveMapping = async (figmaName: string, figmaNodeId?: string) => {
    setSaving(true);
    await db.componentMappings
      .where("codeComponentName")
      .equalsIgnoreCase(component.componentName)
      .delete();
    await db.componentMappings.add({
      codeComponentName: component.componentName,
      figmaComponentName: figmaName,
      figmaNodeId,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    setShowSelect(false);
    setSelectedFigmaName("");
    onChanged();
  };

  const handleConfirmCandidate = (candidate: FigmaCandidate) =>
    saveMapping(candidate.figmaName, candidate.figmaNodeId);

  const handleSaveManual = async () => {
    if (!selectedFigmaName) return;
    const figmaComp = figmaAllComponents.find(
      (f) => f.name === selectedFigmaName,
    );
    await saveMapping(selectedFigmaName, figmaComp?.id);
  };

  const handleRemoveMapping = async () => {
    await db.componentMappings
      .where("codeComponentName")
      .equalsIgnoreCase(component.componentName)
      .delete();
    onChanged();
  };

  const handleNoMatch = async (reason: "gap" | "intentional") => {
    await db.noMatchDecisions
      .where("codeComponentName")
      .equalsIgnoreCase(component.componentName)
      .delete();
    await db.noMatchDecisions.add({
      codeComponentName: component.componentName,
      reason,
      createdAt: new Date().toISOString(),
    });
    setNoMatchDecision({ reason });
    onChanged();
  };

  const handleRemoveDecision = async () => {
    await db.noMatchDecisions
      .where("codeComponentName")
      .equalsIgnoreCase(component.componentName)
      .delete();
    setNoMatchDecision(null);
    onChanged();
  };

  const hasConfirmedMatch =
    component.figmaName &&
    component.status !== "missing-in-figma" &&
    component.status !== "needs-review";

  // Explicitly marked: gap or intentional
  if (noMatchDecision) {
    return (
      <div className="flex items-center gap-2 py-1 border-b border-gray-100 pb-3">
        <span className="text-xs text-gray-400 w-24 shrink-0">Figma match</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
            noMatchDecision.reason === "gap"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-gray-100 text-gray-600 border-gray-200"
          }`}
        >
          {noMatchDecision.reason === "gap"
            ? "Gap — needs Figma documentation"
            : "Intentional — no Figma spec needed"}
        </span>
        <button
          onClick={handleRemoveDecision}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Remove
        </button>
      </div>
    );
  }

  // Confirmed match (aligned / issues / critical)
  if (hasConfirmedMatch) {
    return (
      <div className="border-b border-gray-100 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-24 shrink-0">
            Figma match
          </span>
          <span className="text-xs font-medium text-gray-700">
            {component.figmaName}
          </span>
          {figmaFileKey && component.figmaNodeId && (
            <a
              href={figmaLink(figmaFileKey, component.figmaNodeId)}
              target="_blank"
              rel="noreferrer"
              className="text-gray-300 hover:text-violet-600 transition-colors"
            >
              <ExternalLink size={11} />
            </a>
          )}
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setShowSelect(!showSelect)}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              Change
            </button>
            <button
              onClick={handleRemoveMapping}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
        {showSelect && (
          <ManualSelect
            figmaNames={figmaNames}
            selectedFigmaName={selectedFigmaName}
            onSelect={setSelectedFigmaName}
            onSave={handleSaveManual}
            onCancel={() => setShowSelect(false)}
            saving={saving}
          />
        )}
      </div>
    );
  }

  // Needs review — fuzzy suggest with candidates
  if (component.status === "needs-review" && component.candidates.length > 0) {
    return (
      <div className="border-b border-gray-100 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-24 shrink-0">
            Figma match
          </span>
          <span className="text-xs text-amber-600 font-medium">
            {component.isSuggestedMatch
              ? `"${component.figmaName}" — is this the right match?`
              : "Possible matches found — pick one to confirm"}
          </span>
        </div>

        <div className="space-y-1.5 pl-24">
          {component.candidates.map((candidate) => {
            const pct = Math.round(candidate.score * 100);
            const barColor =
              pct >= 85
                ? "bg-green-400"
                : pct >= 70
                  ? "bg-amber-400"
                  : "bg-gray-300";
            return (
              <div
                key={candidate.figmaName}
                className="flex items-center gap-3 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-800 truncate">
                      {candidate.figmaName}
                    </span>
                    {figmaFileKey && candidate.figmaNodeId && (
                      <a
                        href={figmaLink(figmaFileKey, candidate.figmaNodeId)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-300 hover:text-violet-600 transition-colors shrink-0"
                      >
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                </div>
                <button
                  onClick={() => handleConfirmCandidate(candidate)}
                  disabled={saving}
                  className="shrink-0 text-xs px-2.5 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50"
                >
                  Use this
                </button>
              </div>
            );
          })}

          {showSelect ? (
            <ManualSelect
              figmaNames={figmaNames}
              selectedFigmaName={selectedFigmaName}
              onSelect={setSelectedFigmaName}
              onSave={handleSaveManual}
              onCancel={() => setShowSelect(false)}
              saving={saving}
            />
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setShowSelect(true)}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Pick a different match
              </button>
              <span className="text-gray-300">·</span>
              <button
                onClick={() => handleNoMatch("gap")}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors"
              >
                Mark as gap
              </button>
              <span className="text-gray-300">·</span>
              <button
                onClick={() => handleNoMatch("intentional")}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Intentional
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Missing in Figma — no match, no candidates
  return (
    <div className="border-b border-gray-100 pb-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-24 shrink-0">Figma match</span>
        <span className="text-xs text-gray-400">No Figma component found</span>
      </div>
      <div className="pl-24">
        {showSelect ? (
          <ManualSelect
            figmaNames={figmaNames}
            selectedFigmaName={selectedFigmaName}
            onSelect={setSelectedFigmaName}
            onSave={handleSaveManual}
            onCancel={() => setShowSelect(false)}
            saving={saving}
          />
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSelect(true)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              Link Figma component
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => handleNoMatch("gap")}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              Mark as gap
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => handleNoMatch("intentional")}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              Intentional
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ManualSelect({
  figmaNames,
  selectedFigmaName,
  onSelect,
  onSave,
  onCancel,
  saving,
}: {
  figmaNames: string[];
  selectedFigmaName: string;
  onSelect: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedFigmaName}
        onChange={(e) => onSelect(e.target.value)}
        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
      >
        <option value="">— Select Figma component —</option>
        {figmaNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button
        onClick={onSave}
        disabled={!selectedFigmaName || saving}
        className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium transition-colors"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

function PropsComparison({ propDetails }: { propDetails: PropDetail[] }) {
  const matched = propDetails.filter((p) => p.matched).length;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Props</span>
        <span className="text-xs text-gray-400">
          {matched} of {propDetails.length} matched
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {propDetails.map((prop) => (
          <div
            key={prop.figmaName}
            className="flex items-start gap-3 px-3 py-2"
          >
            <span
              className={`mt-0.5 shrink-0 text-xs font-bold ${
                prop.approved
                  ? "text-gray-300"
                  : prop.matched
                    ? "text-green-500"
                    : "text-red-400"
              }`}
            >
              {prop.approved ? "–" : prop.matched ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-gray-700">
                  {prop.figmaName}
                </code>
                {prop.codePropName &&
                  prop.codePropName.toLowerCase() !==
                    prop.figmaName.toLowerCase() && (
                    <span className="text-xs text-gray-400">
                      → <code className="font-mono">{prop.codePropName}</code>
                    </span>
                  )}
                {prop.approved && (
                  <span className="text-xs text-gray-400 italic">
                    approved drift
                  </span>
                )}
                {!prop.matched && !prop.approved && (
                  <span className="text-xs text-red-400">missing in code</span>
                )}
              </div>
              {prop.figmaValues.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {prop.figmaValues.join(" | ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const OWNER_BADGE: Record<string, { label: string; className: string }> = {
  designer: {
    label: "🎨 Designer",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  engineer: {
    label: "⚙ Engineer",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  both: {
    label: "Both",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

function IssueRow({
  issue,
  componentName: _componentName,
  onApprove,
  onRevoke,
}: {
  issue: ParityIssue;
  componentName: string;
  onApprove: () => void;
  onRevoke: () => void;
}) {
  const severityColor =
    issue.severity === "critical"
      ? "text-red-600"
      : issue.severity === "major"
        ? "text-amber-600"
        : "text-gray-500";

  const ownerBadge = OWNER_BADGE[issue.owner] ?? OWNER_BADGE.both;

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-semibold uppercase tracking-wide ${severityColor}`}
          >
            {issue.severity}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ownerBadge.className}`}
          >
            {ownerBadge.label}
          </span>
          {issue.field && (
            <code className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
              {issue.field}
            </code>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onApprove}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
          >
            Approve drift
          </button>
          <button
            onClick={onRevoke}
            className="text-gray-400 hover:text-gray-600"
            title="Revoke exception"
          >
            <Undo2 size={13} />
          </button>
        </div>
      </div>

      {/* Message */}
      <p className="text-xs text-gray-700">{issue.message}</p>

      {/* Steps */}
      {issue.steps.length > 0 && (
        <ol className="space-y-1 pl-1">
          {issue.steps.map((step, i) => (
            <li
              key={i}
              className={`text-xs flex items-start gap-1.5 ${step.isAlternative ? "text-gray-400 italic" : "text-gray-600"}`}
            >
              {!step.isAlternative && (
                <span className="shrink-0 w-4 text-gray-400">{i + 1}.</span>
              )}
              {step.isAlternative && (
                <span className="shrink-0 text-gray-300 ml-4">↳</span>
              )}
              <span>
                {step.text}
                {step.filePath && (
                  <>
                    {" — "}
                    <a
                      href={githubLink(step.filePath)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      view file ↗
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Reference file */}
      {issue.referenceFile && (
        <p className="text-xs text-gray-400">
          Reference:{" "}
          <a
            href={githubLink(issue.referenceFile)}
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 hover:underline"
          >
            {issue.referenceFile.split("/").slice(-2).join("/")} ↗
          </a>
        </p>
      )}
    </div>
  );
}

function ApproveDriftDialog({
  componentName,
  issue,
  onClose,
  onSaved,
}: {
  componentName: string;
  issue: ParityIssue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState<DriftReason | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedReason) return;
    setSaving(true);
    await db.driftExceptions.add({
      componentName,
      category: "figma-parity",
      propertyName: issue.field,
      reason: selectedReason,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Approve Drift</h3>
        <p className="text-sm text-gray-500 mb-4">
          <span className="font-medium text-gray-700">{componentName}</span>
          {issue.field && (
            <>
              {" · "}
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                {issue.field}
              </code>
            </>
          )}
        </p>

        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
          Reason for approving
        </p>
        <div className="space-y-2 mb-6">
          {DRIFT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelectedReason(r.value)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                selectedReason === r.value
                  ? "border-primary-500 bg-primary-50 text-primary-800"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <p className="font-medium">{r.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedReason || saving}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
