import { useState } from "react";
import {
  GitCompare,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  XCircle,
  Undo2,
  ExternalLink,
  HelpCircle,
  Link2Off,
  Wrench,
} from "lucide-react";
import { figmaLink, githubLink } from "../../utils/links";
import { useAuditStore } from "../../stores/audit-store";
import { useOnboardingStore } from "../../stores/onboarding-store";
import { getGradeColor, getGradeDot } from "../../services/score-calculator";
import { db } from "../../services/db";
import type {
  ComponentParityResult,
  ParityIssue,
  FigmaCandidate,
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

export default function ParityView() {
  const { parityReport, results } = useAuditStore();
  const { figmaFileKey } = useOnboardingStore();

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

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Figma Parity</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Comparing {parityReport.totalCodeComponents} code components
              against {parityReport.totalFigmaComponents} Figma components
            </p>
          </div>
          <div className="flex gap-3">
            <ScoreBadge
              score={overallScore}
              grade={overallGrade}
              label="Parity Score"
            />
            <ScoreBadge
              score={coverageScore}
              grade={coverageGrade}
              label="Coverage"
            />
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={<CheckCircle size={18} className="text-green-600" />}
            label="Aligned"
            value={parityReport.alignedCount}
            bg="bg-green-50"
          />
          <StatCard
            icon={<AlertTriangle size={18} className="text-amber-600" />}
            label="Have issues"
            value={parityReport.issuesCount}
            bg="bg-amber-50"
          />
          <StatCard
            icon={<XCircle size={18} className="text-red-600" />}
            label="Missing in Figma"
            value={missingInFigma.length}
            bg="bg-red-50"
          />
        </div>

        {/* Missing in code */}
        {missingInCode.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-red-800 mb-2">
              {missingInCode.length} component
              {missingInCode.length > 1 ? "s" : ""} in Figma but not in code
            </p>
            <div className="flex flex-wrap gap-2">
              {missingInCode.map((name) => (
                <span
                  key={name}
                  className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Review needed */}
        <ReviewNeededSection
          components={components}
          figmaFileKey={figmaFileKey}
          onResolved={() => useAuditStore.getState().startScan()}
        />

        {/* Component list */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Components</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {components
              .filter((c) => c.status !== "needs-review")
              .map((component) => (
                <ComponentParityRow
                  key={component.componentName}
                  component={component}
                  figmaFileKey={figmaFileKey}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewNeededSection({
  components,
  figmaFileKey,
  onResolved,
}: {
  components: ComponentParityResult[];
  figmaFileKey: string;
  onResolved: () => void;
}) {
  const reviewItems = components.filter((c) => c.status === "needs-review");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = reviewItems.filter((c) => !dismissed.has(c.componentName));

  if (visible.length === 0) return null;

  const handleConfirm = async (codeName: string, candidate: FigmaCandidate) => {
    await db.componentMappings
      .where("codeComponentName")
      .equalsIgnoreCase(codeName)
      .delete();
    await db.componentMappings.add({
      codeComponentName: codeName,
      figmaComponentName: candidate.figmaName,
      figmaNodeId: candidate.figmaNodeId,
      createdAt: new Date().toISOString(),
    });
    setDismissed((prev) => new Set(prev).add(codeName));
    onResolved();
  };

  const handleMarkGap = async (codeName: string) => {
    await db.noMatchDecisions
      .where("codeComponentName")
      .equalsIgnoreCase(codeName)
      .delete();
    await db.noMatchDecisions.add({
      codeComponentName: codeName,
      reason: "gap",
      createdAt: new Date().toISOString(),
    });
    setDismissed((prev) => new Set(prev).add(codeName));
    onResolved();
  };

  const handleMarkIntentional = async (codeName: string) => {
    await db.noMatchDecisions
      .where("codeComponentName")
      .equalsIgnoreCase(codeName)
      .delete();
    await db.noMatchDecisions.add({
      codeComponentName: codeName,
      reason: "intentional",
      createdAt: new Date().toISOString(),
    });
    setDismissed((prev) => new Set(prev).add(codeName));
    onResolved();
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle size={16} className="text-amber-500" />
        <h3 className="text-sm font-semibold text-amber-800">
          Review needed — {visible.length} component
          {visible.length > 1 ? "s" : ""} with potential Figma matches
        </h3>
      </div>

      <div className="space-y-3">
        {visible.map((component) => (
          <div
            key={component.componentName}
            className="bg-amber-50 border border-amber-200 rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {component.componentName}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {component.isSuggestedMatch
                    ? `Fuzzy matched to "${component.figmaName}" — is this correct?`
                    : "No exact match found — did any of these match?"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleMarkGap(component.componentName)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
                  title="Mark as a gap — needs Figma documentation"
                >
                  <Wrench size={13} />
                  Mark as gap
                </button>
                <button
                  onClick={() => handleMarkIntentional(component.componentName)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  title="This component intentionally has no Figma counterpart"
                >
                  <Link2Off size={13} />
                  Intentional
                </button>
              </div>
            </div>

            {/* Candidates */}
            <div className="space-y-1.5">
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
                    className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-amber-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-800 truncate">
                          {candidate.figmaName}
                        </span>
                        {figmaFileKey && candidate.figmaNodeId && (
                          <a
                            href={figmaLink(
                              figmaFileKey,
                              candidate.figmaNodeId,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-300 hover:text-violet-600 transition-colors shrink-0"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor} rounded-full`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {pct}% match
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleConfirm(component.componentName, candidate)
                      }
                      className="shrink-0 text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
                    >
                      Use this
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreBadge({
  score,
  grade,
  label,
}: {
  score: number;
  grade: string;
  label: string;
}) {
  const colorClass = getGradeColor(
    grade as Parameters<typeof getGradeColor>[0],
  );
  return (
    <div className={`border rounded-xl px-5 py-3 text-center ${colorClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">
        {label}
      </p>
      <p className="text-3xl font-bold">{score}</p>
      <p className="text-sm font-medium mt-0.5">{grade}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
      <div className={`${bg} p-2 rounded-lg`}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function ComponentParityRow({
  component,
  figmaFileKey,
}: {
  component: ComponentParityResult;
  figmaFileKey: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approvingIssue, setApprovingIssue] = useState<ParityIssue | null>(
    null,
  );
  const [, forceRender] = useState(0);

  const dotClass = getGradeDot(component.grade);
  const hasIssues = component.issues.length > 0;

  return (
    <div className="hover:bg-gray-50 transition-colors">
      <button
        onClick={() => hasIssues && setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
          <div>
            <span className="text-sm font-medium text-gray-900">
              {component.componentName}
            </span>
            {component.figmaName && (
              <span className="text-xs text-gray-400 ml-2">
                ← {component.figmaName}
              </span>
            )}
          </div>
          {component.approvedExceptionCount > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {component.approvedExceptionCount} approved
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {component.figmaNodeId && figmaFileKey && (
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
          {hasIssues &&
            (expanded ? (
              <ChevronUp size={14} className="text-gray-400" />
            ) : (
              <ChevronDown size={14} className="text-gray-400" />
            ))}
        </div>
      </button>

      {expanded && hasIssues && (
        <div className="px-6 pb-4 pl-11 space-y-2">
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
