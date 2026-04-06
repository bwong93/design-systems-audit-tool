# Health Report Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the published HTML report to show a 2×2 score grid (Parity, Coverage, A11y, Token) with per-score grade legends that connect each grade to a business consequence.

**Architecture:** All changes are isolated to `src/utils/generate-report.ts`. Add a `calcTokenScore` helper, a `gradeLegend` helper that renders a score-specific legend table, and replace the existing flat score card row with a 2×2 grid layout where each card is color-coded by its current grade.

**Tech Stack:** TypeScript, inline HTML string generation (no external deps)

---

### Task 1: Add token score calculation and grade legend helper

**Files:**

- Modify: `src/utils/generate-report.ts`

- [ ] **Step 1: Add `calcTokenScore` below `calcA11yScore`**

Open `src/utils/generate-report.ts`. After the closing brace of `calcA11yScore` (line 19), add:

```typescript
function calcTokenScore(results: ScanResult): number {
  if (!results.components.length) return 0;
  return Math.round(
    (results.components.filter((c) => c.hardcodedColors.length === 0).length /
      results.components.length) *
      100,
  );
}
```

- [ ] **Step 2: Add `gradeBorderColor` and `gradeBgColor` helpers that key off grade string**

After `gradeBg()` (line 43), add:

```typescript
function gradeBorderColor(score: number): string {
  if (score >= 90) return "#bbf7d0";
  if (score >= 75) return "#bfdbfe";
  if (score >= 60) return "#fde047";
  if (score >= 40) return "#fed7aa";
  return "#fecaca";
}
```

- [ ] **Step 3: Add `gradeLegend` helper that renders a score's legend table**

After `gradeBorderColor`, add:

```typescript
function gradeLegend(rows: [string, string][]): string {
  return rows
    .map(
      ([grade, meaning], i) => `
      <tr${i % 2 === 1 ? ' style="background:#f9fafb"' : ""}>
        <td style="padding:5px 12px;font-weight:600;color:${gradeColor(i === 0 ? 95 : i === 1 ? 80 : i === 2 ? 67 : i === 3 ? 50 : 20)};white-space:nowrap;width:90px">${grade}</td>
        <td style="padding:5px 12px;color:#6b7280;line-height:1.4;font-size:10px">${meaning}</td>
      </tr>`,
    )
    .join("");
}
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/generate-report.ts
git commit -m "feat(report): add token score + grade legend helpers"
```

> **Note:** After this commit the TypeScript build will have unused-variable errors for `calcTokenScore`, `gradeBorderColor`, and `gradeLegend`. This is expected — they are consumed in Task 3. The `tsc --noEmit` verification belongs to Task 3 Step 5, not here.

---

### Task 2: Add per-score legend copy constants

**Files:**

- Modify: `src/utils/generate-report.ts`

- [ ] **Step 1: Add legend row constants after the helpers**

After the `gradeLegend` helper, add:

```typescript
const PARITY_LEGEND: [string, string][] = [
  [
    "✦ Excellent",
    "Figma is a reliable handoff source. Engineers implement from specs with confidence.",
  ],
  [
    "● Good",
    "Minor drift. Design intent is mostly landing. Batch remaining gaps in next sprint.",
  ],
  [
    "◆ Fair",
    "Specs aren't consistently making it to code. Schedule a remediation sprint.",
  ],
  [
    "▲ Poor",
    "Figma no longer reliable for handoff. Engineers making calls that should be design decisions.",
  ],
  [
    "✖ Critical",
    "Teams working from different sources of truth. Immediate joint action required.",
  ],
];

const COVERAGE_LEGEND: [string, string][] = [
  [
    "✦ Excellent",
    "Every component has a Figma spec. A complete shared reference for both teams.",
  ],
  [
    "● Good",
    "Most components covered. Flag a few unspecced components for design to fill in.",
  ],
  [
    "◆ Fair",
    "Significant gaps. Engineers building or maintaining components without design guidance.",
  ],
  [
    "▲ Poor",
    "Large portions of the codebase have no Figma equivalent. Design system ROI reduced.",
  ],
  [
    "✖ Critical",
    "Figma doesn't represent the codebase. Both teams working independently.",
  ],
];

const A11Y_LEGEND: [string, string][] = [
  [
    "✦ Excellent",
    "Near-full WCAG AA compliance. Safe to claim accessibility in product documentation.",
  ],
  [
    "● Good",
    "Mostly accessible. Minor gaps unlikely to block most assistive tech users.",
  ],
  [
    "◆ Fair",
    "Noticeable barriers. Some keyboard and screen reader users will encounter friction.",
  ],
  [
    "▲ Poor",
    "Many interactive components are inaccessible. Real user impact. Legal exposure increases.",
  ],
  [
    "✖ Critical",
    "System cannot be considered accessible. Likely violates WCAG AA. Legal risk.",
  ],
];

const TOKEN_LEGEND: [string, string][] = [
  [
    "✦ Excellent",
    "Fully tokenized. A rebrand or theme change takes hours, not weeks.",
  ],
  [
    "● Good",
    "Mostly tokenized. A few isolated hardcoded values — easy to clean up in a session.",
  ],
  [
    "◆ Fair",
    "Scattered hardcoding. A theme change requires manual fixes across multiple components.",
  ],
  [
    "▲ Poor",
    "Theming is unreliable. Visual updates won't propagate consistently across the system.",
  ],
  [
    "✖ Critical",
    "Token system being bypassed. Any rebrand requires a full audit. Maintenance cost is high.",
  ],
];
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/generate-report.ts
git commit -m "feat(report): add per-score grade legend copy"
```

---

### Task 3: Add `scoreCard` helper and replace the scores section

**Files:**

- Modify: `src/utils/generate-report.ts`

- [ ] **Step 1: Add a `scoreCard` helper that renders one full card + legend unit**

After the legend constants, add:

```typescript
function scoreCard({
  label,
  score,
  description,
  legend,
}: {
  label: string;
  score: number;
  description: string;
  legend: [string, string][];
}): string {
  const grade = gradeLabel(score);
  const color = gradeColor(score);
  const bg = gradeBg(score);
  const border = gradeBorderColor(score);

  return `
    <div style="border:1px solid ${border};border-radius:10px;overflow:hidden">
      <div style="background:${bg};padding:14px 16px;display:flex;align-items:center;gap:16px">
        <div style="text-align:center;min-width:72px">
          <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:${color};margin-bottom:2px;opacity:.8">${label}</div>
          <div style="font-size:34px;font-weight:700;color:${color};line-height:1">${score}</div>
          <div style="font-size:11px;font-weight:500;color:${color}">${grade}</div>
        </div>
        <div style="font-size:11px;color:#6b7280;line-height:1.5;border-left:1px solid ${border};padding-left:16px">
          ${description}
        </div>
      </div>
      <div style="background:white;border-top:1px solid ${border}">
        <div style="padding:5px 12px;background:#f9fafb;font-size:9px;font-weight:600;color:#9ca3af;border-bottom:1px solid #f3f4f6;text-transform:uppercase;letter-spacing:.04em">Grade guide</div>
        <table style="width:100%;border-collapse:collapse">
          ${gradeLegend(legend)}
        </table>
      </div>
    </div>`;
}
```

- [ ] **Step 2: Compute token score inside `generateReport`**

Inside `generateReport`, after the line `const a11yGrade = gradeLabel(a11yScore);` (around line 61), add:

```typescript
const tokenScore = calcTokenScore(results);
```

- [ ] **Step 3: Replace the scores section in the HTML template**

Find this block in the HTML template (around line 173):

```html
<!-- Scores -->
<div class="scores">
  <div
    class="score-card"
    style="color:${gradeColor(parityReport.overallScore)};background:${gradeBg(parityReport.overallScore)};border-color:${gradeColor(parityReport.overallScore)}33"
  >
    <div class="label">Parity Score</div>
    <div class="value">${parityReport.overallScore}</div>
    <div class="grade">${parityReport.overallGrade}</div>
  </div>
  <div
    class="score-card"
    style="color:${gradeColor(parityReport.coverageScore)};background:${gradeBg(parityReport.coverageScore)};border-color:${gradeColor(parityReport.coverageScore)}33"
  >
    <div class="label">Coverage</div>
    <div class="value">${parityReport.coverageScore}</div>
    <div class="grade">${gradeLabel(parityReport.coverageScore)}</div>
  </div>
  <div
    class="score-card"
    style="color:${gradeColor(a11yScore)};background:${gradeBg(a11yScore)};border-color:${gradeColor(a11yScore)}33"
  >
    <div class="label">A11y Score</div>
    <div class="value">${a11yScore}</div>
    <div class="grade">${a11yGrade}</div>
  </div>
</div>
```

Replace it with (this is TypeScript template literal — keep it on one logical line per `scoreCard` call):

```typescript
    <!-- Scores 2x2 grid -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:24px 0">
      ${scoreCard({ label: "Parity Score", score: parityReport.overallScore, description: "How closely code reflects the Figma spec. Low scores mean designers and engineers are working from different sources of truth.", legend: PARITY_LEGEND })}
      ${scoreCard({ label: "Coverage", score: parityReport.coverageScore, description: "% of code components that have a Figma spec. Low scores mean engineers are building without design guidance.", legend: COVERAGE_LEGEND })}
      ${scoreCard({ label: "A11y Score", score: a11yScore, description: "% of WCAG 2.2 AA checks passing across all components. Low scores mean real barriers for keyboard and assistive technology users.", legend: A11Y_LEGEND })}
      ${scoreCard({ label: "Token Score", score: tokenScore, description: "% of components using design tokens instead of hardcoded values. Low scores make rebranding and theming expensive.", legend: TOKEN_LEGEND })}
    </div>
```

- [ ] **Step 4: Remove the now-unused `.scores` and `.score-card` CSS rules from the `<style>` block**

Find and remove:

```css
.scores {
  display: flex;
  gap: 16px;
  margin: 24px 0;
}
.score-card {
  flex: 1;
  border-radius: 12px;
  padding: 16px 20px;
  text-align: center;
  border: 1px solid;
}
.score-card .label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
  margin-bottom: 6px;
}
.score-card .value {
  font-size: 36px;
  font-weight: 700;
}
.score-card .grade {
  font-size: 13px;
  font-weight: 500;
  margin-top: 2px;
}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd /Users/bentley/projects/design-systems-audit-tool && yarn tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/generate-report.ts
git commit -m "feat(report): redesign scores as 2x2 grid with per-score grade legends and token score"
```

---

### Task 4: Smoke test the output

**Files:**

- No file changes — manual verification only

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/bentley/projects/design-systems-audit-tool && yarn dev
```

- [ ] **Step 2: Run an audit and download the report**

1. Open http://localhost:5173
2. Click **Re-scan** on the Dashboard (or run a fresh audit)
3. Click **Publish Report** — this downloads an HTML file

- [ ] **Step 3: Open the downloaded HTML and verify**

Open the downloaded file in a browser and confirm:

- Four score cards visible in a 2×2 grid
- Each card shows the score number, grade label, and description
- Each card has a "Grade guide" table beneath it with 5 rows
- Token Score card is present with a score (not 0 or NaN)
- Card border/background color matches the current grade (e.g. a "Good" score has blue styling)
- No raw `[object Object]` or `undefined` visible anywhere

- [ ] **Step 4: Commit if any minor fixes were needed, otherwise done**

```bash
git add src/utils/generate-report.ts
git commit -m "fix(report): correct any issues found during smoke test"
```
