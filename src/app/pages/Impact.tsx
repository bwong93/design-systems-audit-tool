import { useState } from "react";
import { BarChart2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuditStore } from "../../stores/audit-store";
import {
  getGrade,
  getGradeColor,
  getGradeDot,
} from "../../services/score-calculator";
import type { ComponentImpact } from "../../types/usage";

export default function Impact() {
  const { usageData, impactScore, impactComponents } = useAuditStore();
  const [filterAttention, setFilterAttention] = useState(false);

  if (!usageData) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-96 text-center">
        <BarChart2 size={40} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          No usage data yet
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Import a CSV with component usage data across your consuming repos to
          see impact scores.
        </p>
        <Link
          to="/settings"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Import usage data →
        </Link>
      </div>
    );
  }

  const attentionCount = impactComponents.filter(
    (c) => c.needsAttention,
  ).length;
  const filtered = filterAttention
    ? impactComponents.filter((c) => c.needsAttention)
    : impactComponents;
  const sorted = [...filtered].sort((a, b) => b.reachScore - a.reachScore);

  const grade = impactScore !== null ? getGrade(impactScore) : null;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Component Impact
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Components ranked by how widely they're adopted across consuming
              repos, weighted by quality scores. High-reach, low-quality
              components are your highest-leverage fix targets.
            </p>
            <p className="text-gray-400 mt-0.5 text-xs">
              {impactComponents.length} components · {usageData.totalRepos} repo
              {usageData.totalRepos !== 1 ? "s" : ""} tracked
            </p>
          </div>
          {impactScore !== null && grade && (
            <ImpactScoreBadge score={impactScore} grade={grade} />
          )}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setFilterAttention(false)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              !filterAttention
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            All components
          </button>
          <button
            onClick={() => setFilterAttention(true)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              filterAttention
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            Needs attention
            {attentionCount > 0 && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  filterAttention
                    ? "bg-white text-gray-900"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {attentionCount}
              </span>
            )}
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-3 border-b border-gray-100 grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Component
            </p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Reach
            </p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Quality
            </p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Impact
            </p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Status
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-gray-500">
                  No components matched. This happens when your usage CSV
                  components don't match any scanned Nucleus components. Check
                  the component names in your CSV.
                </p>
              </div>
            ) : (
              sorted.map((component) => (
                <ImpactComponentRow
                  key={component.componentName}
                  component={component}
                  totalRepos={usageData.totalRepos}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactScoreBadge({
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
          Impact Score
        </p>
        <button
          aria-label="How the impact score is calculated"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowTooltip(false);
          }}
          className="opacity-50 hover:opacity-80 transition-opacity"
        >
          <Info size={11} />
        </button>
      </div>
      <p className="text-3xl font-bold">{score}</p>
      <p className="text-sm font-medium mt-0.5">{grade}</p>

      {showTooltip && (
        <div className="absolute top-full mt-2 right-0 z-10 w-80 bg-gray-900 text-white text-xs rounded-lg p-4 shadow-lg text-left font-normal normal-case tracking-normal space-y-2.5">
          <p className="text-gray-300">
            Reach × quality across your component fleet
          </p>
          <p className="text-gray-200 leading-relaxed">
            High-impact components are both widely used and well-built. A low
            impact score means either low adoption or quality issues in
            commonly-used components — either of which limits the design
            system's value to your product teams.
          </p>
          <div className="border-t border-gray-700 pt-2.5">
            <p className="text-gray-400 mb-1">Formula</p>
            <code className="text-indigo-300 bg-gray-800 px-2 py-1 rounded text-[11px]">
              Impact = (Reach% × Quality%) / 100
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactComponentRow({
  component,
  totalRepos,
}: {
  component: ComponentImpact;
  totalRepos: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const qualityGrade = getGrade(component.qualityScore);
  const dotClass = getGradeDot(qualityGrade);

  return (
    <div className="hover:bg-gray-50 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${component.componentName}`}
        className="w-full px-6 py-4 grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 items-center text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {component.componentName}
          </span>
          {expanded ? (
            <ChevronUp size={13} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronDown size={13} className="text-gray-400 shrink-0" />
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-gray-500">
            {component.repoCount} / {totalRepos} repo
            {totalRepos !== 1 ? "s" : ""} · {component.totalInstances} instance
            {component.totalInstances !== 1 ? "s" : ""}
          </p>
          <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden w-full max-w-32">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${component.reachScore}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
          <span className="text-sm text-gray-700">
            {component.qualityScore}
          </span>
        </div>

        <span className="text-sm font-semibold text-gray-900">
          {component.impactScore}
        </span>

        <div>
          {component.needsAttention ? (
            <span className="text-xs rounded-full border px-2 py-0.5 font-medium bg-amber-50 text-amber-700 border-amber-200">
              Needs attention
            </span>
          ) : (
            <span className="text-xs text-gray-400">OK</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-4 pl-8">
          {component.repoList.length > 0 ? (
            <div className="bg-gray-50 border border-gray-100 rounded-lg divide-y divide-gray-100">
              {component.repoList.map((repo) => (
                <div
                  key={repo.name}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <span className="text-xs font-medium text-gray-700">
                    {repo.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {repo.instances} instance{repo.instances !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              No repo breakdown available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
