# Scan Toast Insights — Design Spec

## Overview

When a scan completes and one or more scores have dropped, the toast should surface which metrics declined, which specific components are responsible, and provide direct navigation to investigate. The data foundation already exists in `ScanDelta` — this feature closes the gap between what's tracked and what's shown.

---

## Toast Structure

The toast has three layers:

1. **Header** — icon + title + dismiss button (unchanged from current)
2. **Summary line** — a single line listing every metric that dropped, e.g. `Parity ↓5 · A11y ↓8 · Token ↓3`. Metrics that did not change are omitted. The improved state ("nice work") and no-change state are unchanged.
3. **Component groups** — one group per metric that has component-level data (Parity, A11y, Token). Each group shows up to 3 component deep-links. If more than 3 components are affected, a "+N more →" link appears below the last component, linking to the full metric page. Coverage shows delta on the summary line only — no component group.

The toast stays until the user explicitly dismisses it (× button) or clicks a component link, which navigates away and dismisses the toast.

The toast expands vertically to fit its content. Width stays at `w-80` (320px).

---

## Visual Layout (Worsened State)

```
┌─────────────────────────────────────┐
│ ⚠  Scan complete             [×]   │
│    Parity ↓5 · A11y ↓8 · Token ↓3  │
│                                     │
│    PARITY                           │
│    → ButtonPrimary                  │
│    → Modal                          │
│    → Tooltip                        │
│    +2 more →                        │
│                                     │
│    A11Y                             │
│    → InputField                     │
│    → Dropdown                       │
└─────────────────────────────────────┘
```

- Metric group labels are small uppercase, muted — structural only
- Each component is a full-width clickable row with a right arrow and subtle hover state
- "+N more →" is positioned below the last component in its group, linking to the full metric page without a highlight param
- Clicking a component link navigates to the page and dismisses the toast

---

## Data Model Changes

### `ComponentStatus` (db.ts)

Add one field:

```ts
export interface ComponentStatus {
  parityStatus: string;
  a11yScore: number;
  usesTokens: boolean; // new — true if component has zero hardcoded colors
}
```

This is a schema-only addition. Dexie stores `componentStatuses` as a JSON blob so no new DB version is needed.

### `ScanDelta` (delta-calculator.ts)

Add two fields:

```ts
export interface ScanDelta {
  // existing fields unchanged
  newA11yIssueComponents: string[]; // new — components whose a11y score dropped
  newTokenIssueComponents: string[]; // new — components that newly have hardcoded colors
}
```

### `computeDelta` (delta-calculator.ts)

Extend the component loop to populate the two new arrays:

- `newA11yIssueComponents`: component was in previous statuses with `a11yScore > 0` (or undefined) and now has a lower score, or was passing and now failing. Simplest signal: `current.a11yScore < previous.a11yScore`.
- `newTokenIssueComponents`: component had `usesTokens: true` (or undefined, treated as true) in previous scan and now has `usesTokens: false`.

### `audit-store.ts`

When building `componentStatuses` during a scan, write `usesTokens` alongside the existing fields:

```ts
componentStatuses[comp.componentName] = {
  parityStatus: comp.status,
  a11yScore: ...,
  usesTokens: codeComp ? codeComp.hardcodedColors.length === 0 : true,
};
```

---

## Navigation — Deep-Linking

Each component link navigates using a `highlight` query param:

| Metric    | Route                                                |
| --------- | ---------------------------------------------------- |
| Parity    | `/parity?highlight=ComponentName`                    |
| A11y      | `/accessibility?highlight=ComponentName`             |
| Token     | `/tokens?highlight=ComponentName`                    |
| "+N more" | `/parity`, `/accessibility`, or `/tokens` (no param) |

The target page reads `?highlight` on mount, scrolls to the matching component row, and applies a brief visual highlight (e.g. a ring or background flash). This requires adding highlight support to `ParityView`, `Accessibility`, and `Tokens` pages.

---

## Component Changes Summary

| File                               | Change                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/services/db.ts`               | Add `usesTokens: boolean` to `ComponentStatus`                                            |
| `src/services/delta-calculator.ts` | Add `newA11yIssueComponents`, `newTokenIssueComponents` to `ScanDelta` and `computeDelta` |
| `src/stores/audit-store.ts`        | Write `usesTokens` into `componentStatuses` during scan                                   |
| `src/app/components/ScanToast.tsx` | Render grouped component sections with deep-links                                         |
| `src/app/pages/ParityView.tsx`     | Read `?highlight` param, scroll + highlight component                                     |
| `src/app/pages/Accessibility.tsx`  | Read `?highlight` param, scroll + highlight component                                     |
| `src/app/pages/Tokens.tsx`         | Read `?highlight` param, scroll + highlight component                                     |
