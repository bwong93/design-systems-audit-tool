# Scan Toast Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When scores drop after a scan, surface which metrics declined and which specific components are responsible, with deep-links to investigate each issue.

**Architecture:** Extend the data model to track component-level a11y and token regressions, redesign the toast to show grouped component links, and add `?highlight` query param support to the three metric pages so each link lands the user directly on the relevant row.

**Tech Stack:** React, TypeScript, Tailwind CSS, react-router-dom v6, Dexie (IndexedDB), Zustand

---

## File Map

| File                               | Change                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/services/db.ts`               | Add `usesTokens: boolean` to `ComponentStatus` interface                                         |
| `src/stores/audit-store.ts`        | Write `usesTokens` into `componentStatuses` during scan                                          |
| `src/services/delta-calculator.ts` | Add `newA11yIssueComponents` and `newTokenIssueComponents` to `ScanDelta`; extend `computeDelta` |
| `src/app/components/ScanToast.tsx` | Redesign worsened state: summary line + grouped component deep-links                             |
| `src/app/pages/ParityView.tsx`     | Read `?highlight` param on mount, scroll to row, flash highlight                                 |
| `src/app/pages/Accessibility.tsx`  | Add row IDs, read `?highlight` param, scroll + flash highlight                                   |
| `src/app/pages/Tokens.tsx`         | Add row IDs, read `?highlight` param, scroll + flash highlight                                   |

---

## Task 1: Add `usesTokens` to `ComponentStatus` and `audit-store`

**Files:**

- Modify: `src/services/db.ts`
- Modify: `src/stores/audit-store.ts`

- [ ] **Step 1: Add `usesTokens` to `ComponentStatus` in db.ts**

Open `src/services/db.ts`. The `ComponentStatus` interface is at line 29. Replace it:

```ts
export interface ComponentStatus {
  parityStatus: string;
  a11yScore: number;
  usesTokens: boolean;
}
```

- [ ] **Step 2: Write `usesTokens` when building component statuses in audit-store.ts**

Open `src/stores/audit-store.ts`. Find the block that builds `componentStatuses` (around line 117). It has two assignment sites — update both.

First site (parity components loop, around line 126):

```ts
componentStatuses[comp.componentName] = {
  parityStatus: comp.status,
  a11yScore: Math.round((a11yPassed / A11Y_KEYS.length) * 100),
  usesTokens: codeComp ? codeComp.hardcodedColors.length === 0 : true,
};
```

Second site (missing-in-figma loop, around line 131):

```ts
componentStatuses[name] = {
  parityStatus: "missing-in-figma",
  a11yScore: 0,
  usesTokens: true,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/services/db.ts src/stores/audit-store.ts
git commit -m "feat: add usesTokens to ComponentStatus for token regression tracking"
```

---

## Task 2: Extend `ScanDelta` with component-level a11y and token tracking

**Files:**

- Modify: `src/services/delta-calculator.ts`

- [ ] **Step 1: Add new fields to the `ScanDelta` interface**

Open `src/services/delta-calculator.ts`. Replace the `ScanDelta` interface:

```ts
export interface ScanDelta {
  overallDelta: number;
  parityDelta: number;
  coverageDelta: number;
  a11yDelta: number;
  tokenDelta: number;
  resolvedComponents: string[];
  newIssueComponents: string[];
  newA11yIssueComponents: string[];
  newTokenIssueComponents: string[];
  previousTimestamp: string;
}
```

- [ ] **Step 2: Populate the new arrays in `computeDelta`**

In the same file, replace the full `computeDelta` function:

```ts
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
  const newA11yIssueComponents: string[] = [];
  const newTokenIssueComponents: string[] = [];

  const allNames = new Set([
    ...Object.keys(current.componentStatuses),
    ...Object.keys(previous.componentStatuses),
  ]);

  for (const name of allNames) {
    const curr = current.componentStatuses[name];
    const prev = previous.componentStatuses[name];

    // Parity: resolved
    if (
      prev &&
      prev.parityStatus !== "aligned" &&
      curr?.parityStatus === "aligned"
    ) {
      resolvedComponents.push(name);
    }
    // Parity: new issue
    if (
      (prev?.parityStatus === "aligned" || prev === undefined) &&
      curr &&
      curr.parityStatus !== "aligned"
    ) {
      newIssueComponents.push(name);
    }
    // A11y: score dropped
    if (curr && prev && curr.a11yScore < prev.a11yScore) {
      newA11yIssueComponents.push(name);
    }
    // Token: was using tokens (or new, assumed clean), now has hardcoded colors
    const prevUsesTokens = prev?.usesTokens ?? true;
    if (curr && !curr.usesTokens && prevUsesTokens) {
      newTokenIssueComponents.push(name);
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
    newA11yIssueComponents,
    newTokenIssueComponents,
    previousTimestamp: previous.timestamp,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/delta-calculator.ts
git commit -m "feat: track component-level a11y and token regressions in ScanDelta"
```

---

## Task 3: Redesign `ScanToast` for the worsened state

**Files:**

- Modify: `src/app/components/ScanToast.tsx`

- [ ] **Step 1: Replace the full file contents**

```tsx
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

  // All non-zero metric deltas for the summary line
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

  // Component groups — only shown when there are affected components
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

        {/* Summary line */}
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

        {/* Component groups */}
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

        {/* Resolved components (improved state) */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/ScanToast.tsx
git commit -m "feat: redesign scan toast with metric summary and component deep-links"
```

---

## Task 4: Add `?highlight` support to `ParityView`

**Files:**

- Modify: `src/app/pages/ParityView.tsx`

`ParityView` already has `id={`component-row-${component.componentName}`}` on rows and an `autoExpandComponent` state. We need to read the `?highlight` param on mount, expand that row, scroll to it, and flash a highlight ring.

- [ ] **Step 1: Add `useSearchParams` import**

`src/app/pages/ParityView.tsx` currently has no react-router-dom import. Add this new import near the top of the file alongside the other imports:

```ts
import { useSearchParams } from "react-router-dom";
```

- [ ] **Step 2: Add state and effect in `ParityView`**

Inside the `ParityView` component function, after the existing state declarations (around line 73), add:

```ts
const [searchParams] = useSearchParams();
const [highlightedComponent, setHighlightedComponent] = useState<string | null>(
  null,
);

useEffect(() => {
  const highlight = searchParams.get("highlight");
  if (!highlight) return;
  setAutoExpandComponent(highlight);
  setHighlightedComponent(highlight);
  setTimeout(() => {
    document
      .getElementById(`component-row-${highlight}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
  setTimeout(() => setHighlightedComponent(null), 1500);
}, [searchParams]);
```

- [ ] **Step 3: Pass `highlighted` prop to the component row**

Find the line where `ComponentParityRow` is rendered (around line 277):

```tsx
autoExpand={autoExpandComponent === component.componentName}
```

Add the `highlighted` prop on the same element:

```tsx
autoExpand={autoExpandComponent === component.componentName}
highlighted={highlightedComponent === component.componentName}
```

- [ ] **Step 4: Accept and apply `highlighted` in `ComponentParityRow`**

Find the `ComponentParityRow` component definition (search for `function ComponentParityRow` or the component that uses `id={`component-row-`}`). It's around line 820.

Add `highlighted` to its props. Find the props destructuring — it will look something like:

```ts
function ComponentParityRow({
  component,
  figmaFileKey,
  autoExpand,
}: {
  component: ComponentParityResult;
  figmaFileKey: string | null;
  autoExpand: boolean;
});
```

Replace with:

```ts
function ComponentParityRow({
  component,
  figmaFileKey,
  autoExpand,
  highlighted,
}: {
  component: ComponentParityResult;
  figmaFileKey: string | null;
  autoExpand: boolean;
  highlighted: boolean;
});
```

- [ ] **Step 5: Apply highlight ring to the row container**

Find the outer `<div>` of `ComponentParityRow` (around line 832):

```tsx
<div
  id={`component-row-${component.componentName}`}
  className="hover:bg-gray-50 transition-colors"
>
```

Replace with:

```tsx
<div
  id={`component-row-${component.componentName}`}
  className={`hover:bg-gray-50 transition-colors ${
    highlighted ? "ring-2 ring-inset ring-indigo-400 bg-indigo-50" : ""
  }`}
>
```

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/ParityView.tsx
git commit -m "feat: add highlight deep-link support to ParityView"
```

---

## Task 5: Add `?highlight` support to `Accessibility`

**Files:**

- Modify: `src/app/pages/Accessibility.tsx`

`A11yComponentRow` has no row ID today. We add one, add highlight support to the page, and pass it down as a prop.

- [ ] **Step 1: Add imports**

At the top of `src/app/pages/Accessibility.tsx`, add `useEffect` to the React import and add the react-router-dom import:

```ts
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
```

- [ ] **Step 2: Add `highlightedComponent` state and effect in `Accessibility`**

Inside the `Accessibility` component function, after `const { results } = useAuditStore();`, add:

```ts
const [searchParams] = useSearchParams();
const [highlightedComponent, setHighlightedComponent] = useState<string | null>(
  null,
);

useEffect(() => {
  const highlight = searchParams.get("highlight");
  if (!highlight) return;
  setHighlightedComponent(highlight);
  setTimeout(() => {
    document
      .getElementById(`component-row-${highlight}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
  setTimeout(() => setHighlightedComponent(null), 1500);
}, [searchParams]);
```

- [ ] **Step 3: Pass `highlighted` prop when rendering `A11yComponentRow`**

Find where `A11yComponentRow` is rendered (around line 198):

```tsx
<A11yComponentRow key={component.name} component={component} />
```

Replace with:

```tsx
<A11yComponentRow
  key={component.name}
  component={component}
  highlighted={highlightedComponent === component.name}
/>
```

- [ ] **Step 4: Accept `highlighted` in `A11yComponentRow` and add row ID + ring**

Find `function A11yComponentRow` (around line 345). Its props currently are:

```ts
function A11yComponentRow({ component }: { component: ComponentMetadata });
```

Replace with:

```ts
function A11yComponentRow({
  component,
  highlighted,
}: {
  component: ComponentMetadata;
  highlighted: boolean;
});
```

Then find the outer `<div>` (around line 352):

```tsx
<div className="hover:bg-gray-50 transition-colors">
```

Replace with:

```tsx
<div
  id={`component-row-${component.name}`}
  className={`hover:bg-gray-50 transition-colors ${
    highlighted ? "ring-2 ring-inset ring-indigo-400 bg-indigo-50" : ""
  }`}
>
```

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Accessibility.tsx
git commit -m "feat: add highlight deep-link support to Accessibility page"
```

---

## Task 6: Add `?highlight` support to `Tokens`

**Files:**

- Modify: `src/app/pages/Tokens.tsx`

Same pattern as Task 5.

- [ ] **Step 1: Add imports**

At the top of `src/app/pages/Tokens.tsx`, add `useEffect` to the React import and add the react-router-dom import:

```ts
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
```

- [ ] **Step 2: Add `highlightedComponent` state and effect in `Tokens`**

Inside the `Tokens` component function, after `const { results } = useAuditStore();`, add:

```ts
const [searchParams] = useSearchParams();
const [highlightedComponent, setHighlightedComponent] = useState<string | null>(
  null,
);

useEffect(() => {
  const highlight = searchParams.get("highlight");
  if (!highlight) return;
  setHighlightedComponent(highlight);
  setTimeout(() => {
    document
      .getElementById(`component-row-${highlight}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
  setTimeout(() => setHighlightedComponent(null), 1500);
}, [searchParams]);
```

- [ ] **Step 3: Pass `highlighted` prop when rendering `TokenComponentRow`**

Find where `TokenComponentRow` is rendered (around line 114):

```tsx
<TokenComponentRow key={component.name} component={component} />
```

Replace with:

```tsx
<TokenComponentRow
  key={component.name}
  component={component}
  highlighted={highlightedComponent === component.name}
/>
```

- [ ] **Step 4: Accept `highlighted` in `TokenComponentRow` and add row ID + ring**

Find `function TokenComponentRow` (around line 209). Its props currently are:

```ts
function TokenComponentRow({ component }: { component: ComponentMetadata });
```

Replace with:

```ts
function TokenComponentRow({
  component,
  highlighted,
}: {
  component: ComponentMetadata;
  highlighted: boolean;
});
```

Then find the outer `<div>` (around line 214):

```tsx
<div className="hover:bg-gray-50 transition-colors">
```

Replace with:

```tsx
<div
  id={`component-row-${component.name}`}
  className={`hover:bg-gray-50 transition-colors ${
    highlighted ? "ring-2 ring-inset ring-indigo-400 bg-indigo-50" : ""
  }`}
>
```

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Tokens.tsx
git commit -m "feat: add highlight deep-link support to Tokens page"
```
