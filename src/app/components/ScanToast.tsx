import { X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuditStore } from "../../stores/audit-store";

export default function ScanToast() {
  const { scanDelta, clearScanDelta } = useAuditStore();
  const navigate = useNavigate();

  if (!scanDelta) return null;

  const improved = scanDelta.overallDelta > 0;
  const worsened = scanDelta.overallDelta < 0;
  const noChange =
    scanDelta.overallDelta === 0 &&
    scanDelta.coverageDelta === 0 &&
    scanDelta.a11yDelta === 0 &&
    scanDelta.tokenDelta === 0 &&
    scanDelta.resolvedComponents.length === 0 &&
    scanDelta.newIssueComponents.length === 0 &&
    scanDelta.newA11yIssueComponents.length === 0 &&
    scanDelta.newTokenIssueComponents.length === 0;

  const title = noChange
    ? "Scan complete — no change since last scan"
    : improved
      ? "Scan complete — nice work"
      : "Scan complete";

  const iconBg = improved
    ? "bg-green-50"
    : worsened
      ? "bg-red-50"
      : "bg-gray-50";
  const icon = improved ? "✦" : worsened ? "⚠" : "✓";

  const deltas = [
    scanDelta.parityDelta !== 0 && {
      label: "Parity",
      value: scanDelta.parityDelta,
    },
    scanDelta.coverageDelta !== 0 && {
      label: "Coverage",
      value: scanDelta.coverageDelta,
    },
    scanDelta.a11yDelta !== 0 && { label: "A11y", value: scanDelta.a11yDelta },
    scanDelta.tokenDelta !== 0 && {
      label: "Token",
      value: scanDelta.tokenDelta,
    },
  ].filter((d): d is { label: string; value: number } => Boolean(d));

  const groups = [
    {
      label: "PARITY",
      components: scanDelta.newIssueComponents,
      route: "/parity",
    },
    {
      label: "A11Y",
      components: scanDelta.newA11yIssueComponents,
      route: "/accessibility",
    },
    {
      label: "TOKEN",
      components: scanDelta.newTokenIssueComponents,
      route: "/tokens",
    },
  ].filter((g) => g.components.length > 0);

  const handleNavigate = (path: string) => {
    clearScanDelta();
    navigate(path);
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 flex gap-3 items-start"
      role="status"
      aria-live="polite"
    >
      <div
        className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center shrink-0 text-base`}
      >
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>

        {!noChange && deltas.length > 0 && (
          <p className="text-xs text-gray-500 mt-1 leading-snug">
            {deltas.map((d, i) => (
              <span key={d.label}>
                {i > 0 && " · "}
                <span
                  className={
                    d.value > 0
                      ? "text-green-700 font-semibold"
                      : "text-red-600 font-semibold"
                  }
                >
                  {d.label} {d.value > 0 ? "↑" : "↓"}
                  {Math.abs(d.value)}
                </span>
              </span>
            ))}
          </p>
        )}

        {groups.map((group) => {
          const shown = group.components.slice(0, 3);
          const overflow = group.components.length - 3;
          return (
            <div key={group.label} className="mt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                {group.label}
              </p>
              {shown.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() =>
                    handleNavigate(
                      `${group.route}?highlight=${encodeURIComponent(name)}`,
                    )
                  }
                  className="w-full flex items-center justify-between text-xs text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                >
                  <span className="truncate">{name}</span>
                  <ArrowRight size={12} className="shrink-0 ml-2" />
                </button>
              ))}
              {overflow > 0 && (
                <button
                  type="button"
                  onClick={() => handleNavigate(group.route)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 transition-colors"
                >
                  +{overflow} more →
                </button>
              )}
            </div>
          );
        })}

        {scanDelta.resolvedComponents.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {scanDelta.resolvedComponents.map((name) => (
              <span
                key={name}
                className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full"
              >
                ✓ {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={clearScanDelta}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
