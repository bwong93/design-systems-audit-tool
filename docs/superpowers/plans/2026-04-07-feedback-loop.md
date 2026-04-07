# Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a re-scan, show score improvements unmissable — post-scan toast for the engineer who ran it, persistent delta section on the Dashboard, and a "Since last scan" section in the published report.

**Architecture:** Extend `ScanHistoryEntry` with `tokenScore` and a `componentStatuses` snapshot, increment the DB to v7. A pure `computeDelta()` function compares two entries. The audit store computes delta after each scan and exposes it via `scanDelta`. Three surfaces read from it: a dismissible `ScanToast` in Layout, a `DeltaSection` component on the Dashboard, and an optional section in the published HTML report.

**Tech Stack:** Dexie (IndexedDB v7), Zustand, React, TypeScript, Tailwind CSS

---

## File Map

| File                               | Action | Responsibility                                                                 |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `src/services/db.ts`               | Modify | Add `ComponentStatus`, extend `ScanHistoryEntry`, add DB v7                    |
| `src/services/delta-calculator.ts` | Create | `ScanDelta` interface + `computeDelta()` pure function                         |
| `src/stores/audit-store.ts`        | Modify | Save `tokenScore` + `componentStatuses` on scan; compute + store `scanDelta`   |
| `src/app/components/ScanToast.tsx` | Create | Post-scan toast component, reads `scanDelta` from store                        |
| `src/app/layouts/Layout.tsx`       | Modify | Render `ScanToast` at fixed bottom-right                                       |
| `src/app/pages/Dashboard.tsx`      | Modify | Add `DeltaSection` between score cards and history chart; pass delta to report |
| `src/utils/generate-report.ts`     | Modify | Accept optional `delta` param; render "Since last scan" section                |

---

## Task 1: Extend DB schema to v7

**Files:**

- Modify: `src/services/db.ts`

- [ ] **Step 1: Add `ComponentStatus` interface and extend `ScanHistoryEntry`**

Open `src/services/db.ts`. Add `ComponentStatus` just above `ScanHistoryEntry`, then add two new fields to `ScanHistoryEntry`:

```typescript
export interface ComponentStatus {
  parityStatus: string;
  a11yScore: number;
}

/** Lightweight score summary saved after each scan for trend tracking */
export interface ScanHistoryEntry {
  id?: number;
  timestamp: string;
  parityScore: number;
  parityGrade: string;
  coverageScore: number;
  a11yScore: number;
  tokenScore: number; // new
  totalComponents: number;
  alignedCount: number;
  issuesCount: number;
  componentStatuses?: Record<string, ComponentStatus>; // new — optional for backwards compat
}
```

Both new fields are additive. `componentStatuses` is optional so existing v6 entries (which lack it) don't break.

- [ ] **Step 2: Add version 7 to `AuditDatabase`**

Append this block at the end of the `constructor()` body in `AuditDatabase`, after the version 6 block:

```typescript
// Version 7 adds tokenScore and componentStatuses to scan history
this.version(7).stores({
  figmaCache: "++id, fileKey, fetchedAt",
  driftExceptions: "++id, componentName, category, propertyName, createdAt",
  scanResults: "++id, timestamp",
  componentMappings: "++id, codeComponentName, figmaComponentName",
  noMatchDecisions: "++id, codeComponentName, reason",
  visualFlags: "++id, componentName, createdAt",
  figmaOnlyDecisions: "++id, figmaCodeName",
  scanHistory: "++id, timestamp",
});
```

The schema string is unchanged — Dexie only needs a version bump when indexed columns change. The new fields (`tokenScore`, `componentStatuses`) are stored as plain object data, not indexed.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/db.ts
git commit -m "feat: extend ScanHistoryEntry with tokenScore and componentStatuses (db v7)"
```

---

## Task 2: Create delta-calculator.ts

**Files:**

- Create: `src/services/delta-calculator.ts`

- [ ] **Step 1: Create the file with `ScanDelta` interface and `computeDelta` function**

```typescript
import type { ScanHistoryEntry } from "./db";

export interface ScanDelta {
  overallDelta: number; // same as parityDelta — parity is the primary metric
  parityDelta: number;
  coverageDelta: number;
  a11yDelta: number;
  tokenDelta: number;
  resolvedComponents: string[]; // parityStatus changed TO "aligned"
  newIssueComponents: string[]; // parityStatus changed AWAY FROM "aligned"
  previousTimestamp: string;
}

/**
 * Compare two ScanHistoryEntry objects and return the delta between them.
 * Returns null if either entry is missing componentStatuses (pre-v7 entries).
 */
export function computeDelta(
  current: ScanHistoryEntry,
  previous: ScanHistoryEntry,
): ScanDelta | null {
  if (!current.componentStatuses || !previous.componentStatuses) return null;

  const parityDelta = current.parityScore - previous.parityScore;
  const coverageDelta = current.coverageScore - previous.coverageScore;
  const a11yDelta = current.a11yScore - previous.a11yScore;
  const tokenDelta = (current.tokenScore ?? 0) - (previous.tokenScore ?? 0);

  const resolvedComponents: string[] = [];
  const newIssueComponents: string[] = [];

  // Check every component that appears in current or previous
  const allNames = new Set([
    ...Object.keys(current.componentStatuses),
    ...Object.keys(previous.componentStatuses),
  ]);

  for (const name of allNames) {
    const curr = current.componentStatuses[name]?.parityStatus;
    const prev = previous.componentStatuses[name]?.parityStatus;

    // Resolved: was not "aligned", now is "aligned"
    if (prev && prev !== "aligned" && curr === "aligned") {
      resolvedComponents.push(name);
    }

    // New issue: was "aligned" (or absent), now is not "aligned"
    if (
      (prev === "aligned" || prev === undefined) &&
      curr &&
      curr !== "aligned"
    ) {
      newIssueComponents.push(name);
    }
  }

  return {
    overallDelta: parityDelta,
    parityDelta,
    coverageDelta,
    a11yDelta,
    tokenDelta,
    resolvedComponents,
    newIssueComponents,
    previousTimestamp: previous.timestamp,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/delta-calculator.ts
git commit -m "feat: add computeDelta pure function for scan-to-scan comparison"
```

---

## Task 3: Update audit-store to save componentStatuses + compute delta

**Files:**

- Modify: `src/stores/audit-store.ts`

- [ ] **Step 1: Add imports and extend the store interface**

At the top of `src/stores/audit-store.ts`, add the new imports alongside existing ones:

```typescript
import { computeDelta, type ScanDelta } from "../services/delta-calculator";
import type { ComponentStatus } from "../services/db";
```

Extend `AuditStore` interface — add two new fields and a new action:

```typescript
interface AuditStore {
  isScanning: boolean;
  progress: number;
  progressLabel: string;
  results: ScanResult | null;
  figmaComponents: FigmaComponent[];
  parityReport: ParityReport | null;
  figmaError: string | null;
  error: string | null;
  scanDelta: ScanDelta | null; // new
  startScan: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearResults: () => void;
  clearScanDelta: () => void; // new
}
```

- [ ] **Step 2: Add `scanDelta: null` and `clearScanDelta` to the initial store state and actions**

In `useAuditStore = create<AuditStore>((set) => ({`, add:

```typescript
  scanDelta: null,
```

After `clearResults`, add:

```typescript
  clearScanDelta: () => set({ scanDelta: null }),
```

- [ ] **Step 3: Build `componentStatuses` and save with `tokenScore` in `startScan`**

The `A11Y_KEYS` constant is already defined inside `startScan`. You'll need it for per-component a11y scores. Replace the existing `db.scanHistory.add(...)` call with this expanded version:

```typescript
// Build per-component status snapshot for delta tracking
const componentStatuses: Record<string, ComponentStatus> = {};
for (const comp of parityReport.components) {
  const codeComp = results.components.find(
    (c) => c.name === comp.componentName,
  );
  const a11yPassed = codeComp
    ? A11Y_KEYS.filter((k) => codeComp[k as keyof typeof codeComp]).length
    : 0;
  componentStatuses[comp.componentName] = {
    parityStatus: comp.status,
    a11yScore: Math.round((a11yPassed / A11Y_KEYS.length) * 100),
  };
}
for (const name of parityReport.missingInFigma) {
  componentStatuses[name] = { parityStatus: "missing-in-figma", a11yScore: 0 };
}

// Token score (same formula as Dashboard + generate-report)
const tokenScore =
  results.components.length > 0
    ? Math.round(
        (results.components.filter((c) => c.hardcodedColors.length === 0)
          .length /
          results.components.length) *
          100,
      )
    : 0;

const currentEntry = {
  timestamp: new Date().toISOString(),
  parityScore: parityReport.overallScore,
  parityGrade: parityReport.overallGrade,
  coverageScore: parityReport.coverageScore,
  a11yScore,
  tokenScore,
  totalComponents: results.totalComponents,
  alignedCount: parityReport.alignedCount,
  issuesCount: parityReport.issuesCount,
  componentStatuses,
};

await db.scanResults.add({ ...results, id: undefined });
await db.scanHistory.add(currentEntry);

// Compute delta against the previous scan entry
const allHistory = await db.scanHistory
  .orderBy("timestamp")
  .reverse()
  .limit(2)
  .toArray();
const previousEntry = allHistory.length >= 2 ? allHistory[1] : null;
const delta = previousEntry ? computeDelta(currentEntry, previousEntry) : null;
set({ scanDelta: delta });
```

This replaces the two existing `await db.scanResults.add(...)` and `await db.scanHistory.add(...)` lines.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/audit-store.ts
git commit -m "feat: save tokenScore and componentStatuses on scan; compute scanDelta"
```

---

## Task 4: Create ScanToast component

**Files:**

- Create: `src/app/components/ScanToast.tsx`

- [ ] **Step 1: Create the component**

```typescript
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

  const iconBg = improved ? "bg-green-50" : worsened ? "bg-red-50" : "bg-gray-50";
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
                  improved ? "text-green-700 font-semibold" : "text-red-600 font-semibold"
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/ScanToast.tsx
git commit -m "feat: add ScanToast component for post-scan delta feedback"
```

---

## Task 5: Add ScanToast to Layout

**Files:**

- Modify: `src/app/layouts/Layout.tsx`

- [ ] **Step 1: Import and render ScanToast**

Add the import at the top of `src/app/layouts/Layout.tsx`:

```typescript
import ScanToast from "../components/ScanToast";
```

In the `Layout` component's return, add `<ScanToast />` just before the closing `</div>`:

```typescript
export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        {/* ... existing sidebar content ... */}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <ScanToast />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test**

Start the dev server (`yarn dev`), run a second scan after the first exists. Confirm the toast appears bottom-right and dismisses on ✕.

- [ ] **Step 4: Commit**

```bash
git add src/app/layouts/Layout.tsx
git commit -m "feat: render ScanToast in Layout"
```

---

## Task 6: Add DeltaSection to Dashboard

**Files:**

- Modify: `src/app/pages/Dashboard.tsx`

- [ ] **Step 1: Add imports**

Add these imports to the top of `src/app/pages/Dashboard.tsx` alongside the existing ones:

```typescript
import { computeDelta, type ScanDelta } from "../../services/delta-calculator";
```

- [ ] **Step 2: Create the `DeltaSection` component**

Add this component at the bottom of `Dashboard.tsx`, after all the existing sub-components:

```typescript
function DeltaSection() {
  const [delta, setDelta] = useState<ScanDelta | null>(null);
  const [previousDate, setPreviousDate] = useState<string | null>(null);
  const [daysAgo, setDaysAgo] = useState<number | null>(null);

  useEffect(() => {
    db.scanHistory
      .orderBy("timestamp")
      .reverse()
      .limit(2)
      .toArray()
      .then((rows) => {
        if (rows.length < 2) return;
        const [current, previous] = rows;
        const computed = computeDelta(current, previous);
        if (!computed) return;
        setDelta(computed);
        setPreviousDate(
          new Date(previous.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        );
        const diffMs = Date.now() - new Date(previous.timestamp).getTime();
        setDaysAgo(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      });
  }, []);

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
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <span className="font-semibold text-sm text-gray-900">
            Since last scan
          </span>
          <span className="text-xs text-gray-400 ml-2">
            {daysAgo === 0
              ? "today"
              : daysAgo === 1
                ? "1 day ago"
                : `${daysAgo} days ago`}{" "}
            · {previousDate}
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

      {/* Score deltas */}
      <div className="px-5 py-4 grid grid-cols-4 gap-4 border-b border-gray-100">
        <DeltaBadge value={delta.parityDelta} label="Parity" />
        <DeltaBadge value={delta.coverageDelta} label="Coverage" />
        <DeltaBadge value={delta.a11yDelta} label="A11y" />
        <DeltaBadge value={delta.tokenDelta} label="Token" />
      </div>

      {/* Component pills */}
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
```

- [ ] **Step 3: Render `DeltaSection` between score cards and `ScoreHistoryChart`**

In `Dashboard`'s JSX, find the existing section structure. Currently it renders `<HealthNarrative ... />` and then `<ScoreHistoryChart />`. Insert `<DeltaSection />` between them:

```tsx
{
  /* Health narrative */
}
{
  parityReport && a11yScore !== null && (
    <HealthNarrative
      parityReport={parityReport}
      a11yFailCount={a11yFailCount}
      tokenFailCount={tokenFailCount}
      totalComponents={results.totalComponents}
      figmaCount={figmaComponents.length}
    />
  );
}

{
  /* Delta since last scan */
}
<DeltaSection />;

{
  /* Score history */
}
<ScoreHistoryChart />;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Dashboard.tsx
git commit -m "feat: add DeltaSection to Dashboard showing changes since last scan"
```

---

## Task 7: Add "Since last scan" section to published report

**Files:**

- Modify: `src/utils/generate-report.ts`
- Modify: `src/app/pages/Dashboard.tsx`

- [ ] **Step 1: Update `generateReport` signature to accept optional delta**

At the top of `src/utils/generate-report.ts`, add the import:

```typescript
import type { ScanDelta } from "../services/delta-calculator";
```

Update the `generateReport` function signature:

```typescript
export function generateReport({
  parityReport,
  results,
  nucleusPath,
  delta,
}: {
  parityReport: ParityReport;
  results: ScanResult;
  nucleusPath: string;
  delta?: ScanDelta;
}): string {
```

- [ ] **Step 2: Build the "Since last scan" HTML block**

Add this helper function just above `generateReport`:

```typescript
function sinceLastScanSection(delta: ScanDelta): string {
  const previousDate = new Date(delta.previousTimestamp).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );

  const overallLabel =
    delta.overallDelta > 0
      ? `Overall ↑${delta.overallDelta} pts`
      : delta.overallDelta < 0
        ? `Overall ↓${Math.abs(delta.overallDelta)} pts`
        : "No change";

  const overallBadgeColor =
    delta.overallDelta > 0
      ? "background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe"
      : delta.overallDelta < 0
        ? "background:#fef2f2;color:#b91c1c;border:1px solid #fecaca"
        : "background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb";

  const scoreDeltaItem = (value: number, label: string) => {
    const color = value > 0 ? "#15803d" : value < 0 ? "#b91c1c" : "#6b7280";
    const display =
      value > 0 ? `↑${value}` : value < 0 ? `↓${Math.abs(value)}` : "—";
    return `<div style="display:inline-flex;align-items:center;gap:4px;margin-right:20px">
      <span style="font-weight:700;color:${color}">${display}</span>
      <span style="color:#6b7280">${label}</span>
    </div>`;
  };

  const resolvedPills = delta.resolvedComponents
    .map(
      (name) =>
        `<span style="display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;padding:3px 10px;border-radius:20px;font-size:11px;margin:2px">✓ ${name}</span>`,
    )
    .join("");

  const newIssuePills = delta.newIssueComponents
    .map(
      (name) =>
        `<span style="display:inline-block;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;padding:3px 10px;border-radius:20px;font-size:11px;margin:2px">⚠ ${name}</span>`,
    )
    .join("");

  const hasPills = resolvedPills || newIssuePills;

  return `
    <section>
      <header style="display:flex;align-items:center;justify-content:space-between">
        <h2 style="margin:0">Since last scan
          <span style="font-weight:400;color:#9ca3af;font-size:12px;margin-left:8px">· ${previousDate}</span>
        </h2>
        <span style="font-size:11px;padding:2px 10px;border-radius:20px;${overallBadgeColor}">${overallLabel}</span>
      </header>
      <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
        ${scoreDeltaItem(delta.parityDelta, "Parity")}
        ${scoreDeltaItem(delta.coverageDelta, "Coverage")}
        ${scoreDeltaItem(delta.a11yDelta, "A11y")}
        ${scoreDeltaItem(delta.tokenDelta, "Token")}
      </div>
      ${
        hasPills
          ? `<div style="padding:12px 16px">${resolvedPills}${newIssuePills}</div>`
          : ""
      }
    </section>`;
}
```

- [ ] **Step 3: Insert the section into the report HTML**

Inside the `generateReport` function, in the returned template literal, add the delta section between the summary stats block and the "Components with issues" section. Find the comment `<!-- Components with issues -->` and insert just before it:

```typescript
    ${delta ? sinceLastScanSection(delta) : ""}

    <!-- Components with issues -->
```

- [ ] **Step 4: Update `handlePublish` in Dashboard to load and pass delta**

In `src/app/pages/Dashboard.tsx`, replace the existing `handlePublish` function:

```typescript
const handlePublish = async () => {
  if (!parityReport || !results) return;
  const date = new Date().toISOString().split("T")[0];

  // Load the two most recent v7 history entries to compute delta for the report
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
```

Add the missing imports to `Dashboard.tsx`:

```typescript
import { computeDelta } from "../../services/delta-calculator";
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Smoke test the report**

Start dev server (`yarn dev`), run two scans, then click "Publish Report". Open the exported HTML file in a browser. Confirm the "Since last scan" section appears between the summary stats and "Components with issues".

- [ ] **Step 7: Commit**

```bash
git add src/utils/generate-report.ts src/app/pages/Dashboard.tsx
git commit -m "feat: add 'Since last scan' section to published HTML report"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement                                                    | Task                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Post-scan toast — bottom-right, dismissible, session-only           | Task 4 + Task 5                                                    |
| Toast only shown when previous scan exists                          | Task 3 (delta is null on first scan → toast doesn't render)        |
| Toast: overall delta, resolved count, new issue count, named pills  | Task 4                                                             |
| Toast: three states (improved / worsened / no change)               | Task 4                                                             |
| Dashboard delta section — persistent, between score cards and chart | Task 6                                                             |
| Dashboard delta: hidden on first scan                               | Task 6 (`DeltaSection` returns null when no delta)                 |
| Dashboard delta: date of previous scan                              | Task 6                                                             |
| Dashboard delta: 4 score deltas + resolved/new panels               | Task 6                                                             |
| Published report "Since last scan" section                          | Task 7                                                             |
| Report section only included if previous scan exists                | Task 7 (delta is optional)                                         |
| DB v7 with `tokenScore` and `componentStatuses`                     | Task 1                                                             |
| Older v6 entries degrade gracefully (delta hidden)                  | Task 2 (`computeDelta` returns null if `componentStatuses` absent) |

**Type consistency check:**

- `ScanDelta` defined in Task 2, used identically in Tasks 3, 4, 6, 7 ✓
- `ComponentStatus` defined in Task 1, used in Task 3 ✓
- `computeDelta(current, previous: ScanHistoryEntry): ScanDelta | null` — signature consistent across all callsites ✓
- `generateReport` delta param is `delta?: ScanDelta` — matches `null | undefined` handling in Task 7 ✓
