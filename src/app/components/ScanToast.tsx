import { X } from "lucide-react";
import { useAuditStore } from "../../stores/audit-store";

export default function ScanToast() {
  const { scanDelta, clearScanDelta } = useAuditStore();

  if (!scanDelta) return null;

  const improved = scanDelta.overallDelta > 0;
  const worsened = scanDelta.overallDelta < 0;
  const noChange =
    scanDelta.overallDelta === 0 &&
    scanDelta.resolvedComponents.length === 0 &&
    scanDelta.newIssueComponents.length === 0;

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

        {!noChange && (
          <p className="text-xs text-gray-500 mt-1 leading-snug">
            {scanDelta.overallDelta !== 0 && (
              <span
                className={
                  improved
                    ? "text-green-700 font-semibold"
                    : "text-red-600 font-semibold"
                }
              >
                Parity {improved ? "↑" : "↓"}
                {Math.abs(scanDelta.overallDelta)} pts
              </span>
            )}
            {scanDelta.resolvedComponents.length > 0 && (
              <span>
                {scanDelta.overallDelta !== 0 ? " · " : ""}
                {scanDelta.resolvedComponents.length} issue
                {scanDelta.resolvedComponents.length > 1 ? "s" : ""} resolved
              </span>
            )}
            {scanDelta.newIssueComponents.length > 0 && (
              <span>
                {" · "}
                {scanDelta.newIssueComponents.length} new issue
                {scanDelta.newIssueComponents.length > 1 ? "s" : ""} introduced
              </span>
            )}
          </p>
        )}

        {(scanDelta.resolvedComponents.length > 0 ||
          scanDelta.newIssueComponents.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {scanDelta.resolvedComponents.map((name) => (
              <span
                key={name}
                className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full"
              >
                ✓ {name}
              </span>
            ))}
            {scanDelta.newIssueComponents.map((name) => (
              <span
                key={name}
                className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full"
              >
                ⚠ {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={clearScanDelta}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
