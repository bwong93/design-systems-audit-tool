# Feedback Loop Design Spec

**Date:** 2026-04-06
**Status:** Approved for implementation

---

## Goal

After a re-scan, Loupe makes score improvements unmissable — for the engineer who ran the scan and for designers who check the tool or receive the published report.

---

## Context

Currently, re-scanning updates all scores silently. There is no before/after comparison, no celebration of resolved issues, and no way to know if things got better or worse. The fix: compare each new scan to the previous one and surface the delta across three surfaces.

---

## Three Surfaces

### 1. Post-scan toast

**Who it's for:** The engineer who clicked Re-scan.

**Behaviour:**

- Appears in the bottom-right corner immediately after scan completes
- Shows: overall score delta, count of resolved issues, count of new issues, named component pills (green for resolved, red for new)
- Dismissible via ✕ button
- Disappears on page reload (session-only — no persistence needed)
- Only shown when there is a previous scan to compare against. On first-ever scan, no toast.

**Content:**

```
✦ Scan complete — nice work
Parity ↑4 pts · 3 issues resolved · 1 new issue introduced
[✓ Button] [✓ Input] [✓ Tag] [⚠ Select]
```

If scores got worse:

```
⚠ Scan complete
Parity ↓2 pts · 0 issues resolved · 2 new issues introduced
[⚠ Select] [⚠ Accordion]
```

If no change:

```
Scan complete — no change since last scan
```

---

### 2. Dashboard delta section

**Who it's for:** Anyone who opens Loupe — engineer or designer.

**Behaviour:**

- Persistent section on the Dashboard, between the score cards and the score history chart
- Updates every re-scan
- Hidden on first-ever scan (no previous scan to compare)
- Shows date of previous scan

**Content:**

- Header: "Since last scan · [X days ago · date]" + overall delta badge (↑N pts / ↓N pts / no change)
- Four score delta indicators: Parity, Coverage, A11y, Token — each shows ↑N, ↓N, or —
- Two panels side by side:
  - Green panel: resolved issues list — component name + what was fixed
  - Red panel: new issues list — component name + what changed (hidden if no new issues)

---

### 3. Published report — "Since last scan" section

**Who it's for:** Designers and stakeholders receiving the exported HTML report.

**Behaviour:**

- Appears in the report between the score cards section and the "Components with issues" table
- Only included if a previous scan exists to compare against
- Same content as the Dashboard delta section, adapted for static HTML styling (inline styles, no Tailwind)

**Content:**

- Header row: "Since last scan · [date range]" + overall delta badge
- Score delta row: compact inline list — "↑4 Parity · — Coverage · ↑8 A11y · — Token"
- Pill row: one pill per changed component (green = resolved, red = new issue)

---

## Data Model

### Schema change — extend `ScanHistoryEntry`

The current `ScanHistoryEntry` (in `src/services/db.ts`) stores only summary scores. Named component deltas require a per-component status snapshot. Extend it with two new fields and add `tokenScore`:

```typescript
export interface ScanHistoryEntry {
  id?: number;
  timestamp: string;
  parityScore: number;
  parityGrade: string;
  coverageScore: number;
  a11yScore: number;
  tokenScore: number; // NEW — was missing
  totalComponents: number;
  alignedCount: number;
  issuesCount: number;
  componentStatuses: Record<string, ComponentStatus>; // NEW — per-component snapshot
}

interface ComponentStatus {
  parityStatus: string; // "aligned" | "issues" | "critical" | "missing-in-figma" etc.
  a11yScore: number; // 0–100 (% of 4 checks passing)
}
```

`componentStatuses` is a map of component name → lightweight status snapshot. It's written at scan time alongside the existing summary fields. This is the only source of truth for named component deltas — no re-running of parity checks needed.

The DB schema increments to **version 7**. Older entries without `componentStatuses` are treated as having no previous data — delta UI is hidden until two v7+ scans exist.

### Delta computation (pure function)

```typescript
interface ScanDelta {
  overallDelta: number;
  parityDelta: number;
  coverageDelta: number;
  a11yDelta: number;
  tokenDelta: number;
  resolvedComponents: string[]; // component names where parityStatus changed to "aligned"
  newIssueComponents: string[]; // component names where parityStatus changed away from "aligned"
  previousTimestamp: string;
}

function computeDelta(
  current: ScanHistoryEntry,
  previous: ScanHistoryEntry,
): ScanDelta;
```

**"Resolved" definition:** Component where `previous.parityStatus !== "aligned"` and `current.parityStatus === "aligned"`.

**"New issue" definition:** Component where `previous.parityStatus === "aligned"` (or absent) and `current.parityStatus !== "aligned"`.

**"What was fixed" label:** Not included — component name only. Deriving a human-readable label for what changed is too fragile at this stage. The component name pill is enough to communicate progress.

### Toast placement

`ScanToast` renders in `src/app/layouts/Layout.tsx` at a fixed bottom-right position (`fixed bottom-6 right-6 z-50`), outside the sidebar and main content flow. The `audit-store` exposes a `scanDelta: ScanDelta | null` field that `ScanToast` reads. It's set after scan completes and cleared on dismiss.

---

## Files to Change

| File                               | Change                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| `src/services/delta-calculator.ts` | New file — `computeDelta()` pure function                          |
| `src/app/pages/Dashboard.tsx`      | Add `DeltaSection` component between score cards and history chart |
| `src/app/components/ScanToast.tsx` | New file — toast component, shown post-scan                        |
| `src/stores/audit-store.ts`        | Trigger toast display after scan completes                         |
| `src/utils/generate-report.ts`     | Add "Since last scan" section to published report                  |

---

## Out of Scope

- Pushing delta to Slack (separate future feature)
- Per-check delta breakdown (e.g. which WCAG check flipped) — component-level is sufficient
- Trend charts (already handled by the score history chart)
- Delta for Token score component-level changes (token score is a percentage, not issue-based — show score delta only, no named components)
