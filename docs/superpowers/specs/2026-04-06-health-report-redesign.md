# Nucleus Health Report — Redesign Spec

**Date:** 2026-04-06
**Status:** Approved for implementation

---

## Goal

Upgrade the published HTML report so it educates mixed design + engineering audiences about what each score means, connects scores to business and product development impact, and adds the missing Token Score.

The report is shared in team Slack / weekly syncs — conversational tone, not executive-formal.

---

## What Changes

### 1. Token Score added

`generateReport()` already receives `results: ScanResult`. Token score is calculated the same way as the Token page:

```ts
const tokenScore = Math.round(
  (results.components.filter((c) => c.hardcodedColors.length === 0).length /
    results.components.length) *
    100,
);
```

Token score card and legend are added alongside the existing three.

### 2. Score card header redesign

Each card changes from a centered stack to a horizontal layout:

- **Left:** Score number + grade label (centered, fixed width ~72px)
- **Right:** Score name + one-sentence description of what it measures and what a low score means for the team. Separated from the number by a left border.

### 3. Per-score grade legend

Each score card gets a "Grade guide" table directly beneath it. The four cards are arranged in a **2×2 grid** (Parity + Coverage top row, A11y + Token bottom row).

Each legend row: `Grade label | Business consequence`

Grade labels and ranges are consistent across all scores:

| Symbol | Grade     | Range  |
| ------ | --------- | ------ |
| ✦      | Excellent | 90–100 |
| ●      | Good      | 75–89  |
| ◆      | Fair      | 60–74  |
| ▲      | Poor      | 40–59  |
| ✖      | Critical  | 0–39   |

### 4. Score-specific legend copy

**Parity Score** — _How closely code reflects the Figma spec_

| Grade     | Meaning                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| Excellent | Figma is a reliable handoff source. Engineers implement from specs with confidence.           |
| Good      | Minor drift. Design intent is mostly landing. Batch remaining gaps in next sprint.            |
| Fair      | Specs aren't consistently making it to code. Schedule a remediation sprint.                   |
| Poor      | Figma no longer reliable for handoff. Engineers making calls that should be design decisions. |
| Critical  | Teams working from different sources of truth. Immediate joint action required.               |

**Coverage** — _% of code components that have a Figma spec_

| Grade     | Meaning                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| Excellent | Every component has a Figma spec. A complete shared reference for both teams.           |
| Good      | Most components covered. Flag a few unspecced components for design to fill in.         |
| Fair      | Significant gaps. Engineers building or maintaining components without design guidance. |
| Poor      | Large portions of the codebase have no Figma equivalent. Design system ROI reduced.     |
| Critical  | Figma doesn't represent the codebase. Both teams working independently.                 |

**A11y Score** — _% of WCAG 2.2 AA checks passing across all components_

| Grade     | Meaning                                                                                   |
| --------- | ----------------------------------------------------------------------------------------- |
| Excellent | Near-full WCAG AA compliance. Safe to claim accessibility in product documentation.       |
| Good      | Mostly accessible. Minor gaps unlikely to block most assistive tech users.                |
| Fair      | Noticeable barriers. Some keyboard and screen reader users will encounter friction.       |
| Poor      | Many interactive components are inaccessible. Real user impact. Legal exposure increases. |
| Critical  | System cannot be considered accessible. Likely violates WCAG AA. Legal risk.              |

**Token Score** — _% of components using design tokens instead of hardcoded values_

| Grade     | Meaning                                                                                   |
| --------- | ----------------------------------------------------------------------------------------- |
| Excellent | Fully tokenized. A rebrand or theme change takes hours, not weeks.                        |
| Good      | Mostly tokenized. A few isolated hardcoded values — easy to clean up in a session.        |
| Fair      | Scattered hardcoding. A theme change requires manual fixes across multiple components.    |
| Poor      | Theming is unreliable. Visual updates won't propagate consistently across the system.     |
| Critical  | Token system being bypassed. Any rebrand requires a full audit. Maintenance cost is high. |

### 5. Card border color

Cards are color-coded by score grade (not fixed by score type):

- Excellent: green (`#bbf7d0` border, `#f0fdf4` bg)
- Good: blue (`#bfdbfe` border, `#eff6ff` bg)
- Fair: yellow (`#fde047` border, `#fef9c3` bg)
- Poor: orange (`#fed7aa` border, `#fff7ed` bg)
- Critical: red (`#fecaca` border, `#fef2f2` bg)

---

## Files to Change

**`src/utils/generate-report.ts`** — only file changed:

1. Add `calcTokenScore(results)` helper alongside existing `calcA11yScore`
2. Replace the existing `<div class="scores">` section with the new 2×2 grid layout
3. Add `gradeLegendTable(rows)` helper that renders the legend `<table>` HTML — called once per score
4. Remove the old `gradeBg()` / `gradeColor()` usage from score cards (now driven by grade, not raw score)
5. Pass `tokenScore` and its grade into the HTML template

No other files change.

---

## Out of Scope

- Changes to the live app UI (Dashboard, Parity page, etc.)
- Changing the summary stats section or the component issues tables below the scores
- Adding new data to the report beyond what's already computed
