import type { ParityReport } from "../types/parity";
import type { ScanResult } from "../types/component";

const A11Y_KEYS = [
  "hasAriaProps",
  "hasFocusVisible",
  "semanticHTML",
  "hasKeyboardSupport",
] as const;

function calcA11yScore(results: ScanResult): number {
  if (!results.components.length) return 0;
  return Math.round(
    results.components.reduce((sum, c) => {
      const passed = A11Y_KEYS.filter((k) => c[k as keyof typeof c]).length;
      return sum + (passed / A11Y_KEYS.length) * 100;
    }, 0) / results.components.length,
  );
}

function calcTokenScore(results: ScanResult): number {
  if (!results.components.length) return 0;
  return Math.round(
    (results.components.filter((c) => c.hardcodedColors.length === 0).length /
      results.components.length) *
      100,
  );
}

function gradeLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

function gradeColor(score: number): string {
  if (score >= 90) return "#15803d";
  if (score >= 75) return "#1d4ed8";
  if (score >= 60) return "#b45309";
  if (score >= 40) return "#c2410c";
  return "#b91c1c";
}

function gradeBg(score: number): string {
  if (score >= 90) return "#f0fdf4";
  if (score >= 75) return "#eff6ff";
  if (score >= 60) return "#fffbeb";
  if (score >= 40) return "#fff7ed";
  return "#fef2f2";
}

function gradeBorderColor(score: number): string {
  if (score >= 90) return "#bbf7d0";
  if (score >= 75) return "#bfdbfe";
  if (score >= 60) return "#fde047";
  if (score >= 40) return "#fed7aa";
  return "#fecaca";
}

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

export function generateReport({
  parityReport,
  results,
  nucleusPath,
}: {
  parityReport: ParityReport;
  results: ScanResult;
  nucleusPath: string;
}): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const a11yScore = calcA11yScore(results);
  const a11yGrade = gradeLabel(a11yScore);

  const componentRows = parityReport.components
    .filter((c) => c.status !== "aligned")
    .sort((a, b) => a.score - b.score)
    .map((c) => {
      const issueItems = c.issues
        .map(
          (issue) =>
            `<li style="margin:4px 0;color:${issue.severity === "critical" ? "#b91c1c" : issue.severity === "major" ? "#b45309" : "#6b7280"}">
              <strong>${issue.severity.toUpperCase()}</strong> — ${issue.message}
            </li>`,
        )
        .join("");

      return `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:12px 16px;font-weight:500;color:#111827">${c.componentName}</td>
          <td style="padding:12px 16px">
            <span style="font-weight:700;color:${gradeColor(c.score)};background:${gradeBg(c.score)};padding:2px 10px;border-radius:20px;font-size:12px">
              ${c.score} · ${c.grade}
            </span>
          </td>
          <td style="padding:12px 16px">
            <span style="font-size:12px;color:#6b7280;background:#f9fafb;padding:2px 8px;border-radius:4px">
              ${c.status.replace(/-/g, " ")}
            </span>
          </td>
          <td style="padding:12px 16px">
            ${
              c.issues.length > 0
                ? `<ul style="margin:0;padding-left:16px;font-size:12px">${issueItems}</ul>`
                : `<span style="font-size:12px;color:#9ca3af">—</span>`
            }
          </td>
        </tr>`;
    })
    .join("");

  const missingInFigmaList =
    parityReport.missingInFigma.length > 0
      ? parityReport.missingInFigma
          .map(
            (n) =>
              `<span style="display:inline-block;background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:20px;font-size:12px;margin:2px">${n}</span>`,
          )
          .join("")
      : `<p style="color:#9ca3af;font-size:13px">None</p>`;

  const a11yRows = results.components
    .filter((c) => {
      const passed = A11Y_KEYS.filter((k) => c[k as keyof typeof c]).length;
      return passed < A11Y_KEYS.length;
    })
    .sort((a, b) => {
      const scoreA = A11Y_KEYS.filter((k) => a[k as keyof typeof a]).length;
      const scoreB = A11Y_KEYS.filter((k) => b[k as keyof typeof b]).length;
      return scoreA - scoreB;
    })
    .map((c) => {
      const failing = A11Y_KEYS.filter((k) => !c[k as keyof typeof c]);
      const labels: Record<string, string> = {
        hasAriaProps: "ARIA attributes",
        hasFocusVisible: "Focus visible",
        semanticHTML: "Semantic HTML",
        hasKeyboardSupport: "Keyboard support",
      };
      return `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 16px;font-weight:500;color:#111827;font-size:13px">${c.name}</td>
          <td style="padding:10px 16px;font-size:12px;color:#b91c1c">${failing.map((k) => labels[k]).join(", ")}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nucleus Health Report — ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f9fafb; color: #111827; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
    h1 { font-size: 28px; font-weight: 700; }
    h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
    .meta { color: #6b7280; font-size: 13px; margin-top: 4px; font-family: monospace; }
    .scores { display: flex; gap: 16px; margin: 24px 0; }
    .score-card { flex: 1; border-radius: 12px; padding: 16px 20px; text-align: center; border: 1px solid; }
    .score-card .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; opacity: .7; margin-bottom: 6px; }
    .score-card .value { font-size: 36px; font-weight: 700; }
    .score-card .grade { font-size: 13px; font-weight: 500; margin-top: 2px; }
    .stats { display: flex; gap: 12px; margin-bottom: 32px; }
    .stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; flex: 1; }
    .stat .n { font-size: 22px; font-weight: 700; }
    .stat .lbl { font-size: 12px; color: #6b7280; margin-top: 2px; }
    section { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 24px; overflow: hidden; }
    section header { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; background: #f9fafb; border-bottom: 1px solid #f3f4f6; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 40px; }
    .tag-list { padding: 16px; }
  </style>
</head>
<body>
  <div class="container">

    <h1>Nucleus Health Report</h1>
    <p class="meta">Generated ${date} · ${nucleusPath}</p>

    <!-- Scores -->
    <div class="scores">
      <div class="score-card" style="color:${gradeColor(parityReport.overallScore)};background:${gradeBg(parityReport.overallScore)};border-color:${gradeColor(parityReport.overallScore)}33">
        <div class="label">Parity Score</div>
        <div class="value">${parityReport.overallScore}</div>
        <div class="grade">${parityReport.overallGrade}</div>
      </div>
      <div class="score-card" style="color:${gradeColor(parityReport.coverageScore)};background:${gradeBg(parityReport.coverageScore)};border-color:${gradeColor(parityReport.coverageScore)}33">
        <div class="label">Coverage</div>
        <div class="value">${parityReport.coverageScore}</div>
        <div class="grade">${gradeLabel(parityReport.coverageScore)}</div>
      </div>
      <div class="score-card" style="color:${gradeColor(a11yScore)};background:${gradeBg(a11yScore)};border-color:${gradeColor(a11yScore)}33">
        <div class="label">A11y Score</div>
        <div class="value">${a11yScore}</div>
        <div class="grade">${a11yGrade}</div>
      </div>
    </div>

    <!-- Summary stats -->
    <div class="stats">
      <div class="stat"><div class="n">${results.totalComponents}</div><div class="lbl">Code components</div></div>
      <div class="stat"><div class="n" style="color:#15803d">${parityReport.alignedCount}</div><div class="lbl">Aligned</div></div>
      <div class="stat"><div class="n" style="color:#b45309">${parityReport.issuesCount}</div><div class="lbl">Have issues</div></div>
      <div class="stat"><div class="n" style="color:#b91c1c">${parityReport.missingInFigma.length}</div><div class="lbl">Missing in Figma</div></div>
    </div>

    <!-- Components with issues -->
    <section>
      <header><h2>Components with issues</h2></header>
      ${
        componentRows
          ? `<table>
              <thead><tr>
                <th>Component</th><th>Score</th><th>Status</th><th>Issues</th>
              </tr></thead>
              <tbody>${componentRows}</tbody>
            </table>`
          : `<p style="padding:20px;color:#9ca3af;font-size:13px">All components are aligned.</p>`
      }
    </section>

    <!-- Missing in Figma -->
    <section>
      <header><h2>Missing in Figma (${parityReport.missingInFigma.length})</h2></header>
      <div class="tag-list">${missingInFigmaList}</div>
    </section>

    <!-- Accessibility -->
    <section>
      <header><h2>Accessibility issues</h2></header>
      ${
        a11yRows
          ? `<table>
              <thead><tr><th>Component</th><th>Failing checks</th></tr></thead>
              <tbody>${a11yRows}</tbody>
            </table>`
          : `<p style="padding:20px;color:#9ca3af;font-size:13px">All components pass accessibility checks.</p>`
      }
    </section>

    <p class="footer">Generated by DS Audit Tool · ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
}

export function downloadReport(html: string, date: string): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nucleus-audit-${date}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
