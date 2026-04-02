# Design Systems Audit Tool - Implementation Plan

## Context

We're building a **Design Systems audit tool** to solve a critical problem: keeping Figma design libraries in sync with code implementations. As Design and Engineering teams work independently, drift occurs—components get added, props change, variants evolve—and misalignment leads to inconsistent user experiences and wasted effort.

**Primary Goal:** Create a web-based audit tool that provides a **Figma-to-code parity score** and flags discrepancies with actionable remediation steps.

**Secondary Goals:** Audit accessibility compliance (WCAG 2.2 AA), design token usage, documentation coverage, and architectural patterns.

**Target:** Nucleus design system (React + styled-components + Storybook)

**Outcome:** A dashboard showing health scores, detailed component comparisons, visual diffs, and remediation guidance—helping Design and Engineering stay aligned.

---

## Project Structure

Create a standalone personal project at `/Users/bentley/Projects/design-systems-audit-tool/`:

```
design-systems-audit-tool/        # Standalone project (NOT in Nucleus repo)
├── src/
│   ├── app/                      # React app
│   │   ├── pages/                # Page components (Dashboard, etc.)
│   │   ├── components/           # Reusable UI components
│   │   └── layouts/              # Layout components
│   ├── analyzers/                # Code analysis engines
│   ├── figma/                    # Figma integration
│   ├── rules/                    # Audit rule definitions
│   ├── services/                 # Business logic
│   ├── stores/                   # State management (Zustand)
│   ├── types/                    # TypeScript types
│   ├── utils/                    # Utilities
│   ├── audit.config.ts           # Audit configuration
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles + Tailwind
├── public/
├── .env.example                  # Environment variables template
├── index.html                    # HTML entry
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
└── PLAN.md                       # This implementation plan
```

**Note:** This is a standalone project, separate from the Nucleus repository, allowing it to be used with any design system in the future.

---

## Technology Stack

**Core:**

- React 18.2.0 (NOT 19 - matches Nucleus constraint)
- TypeScript 4.9.3
- Vite 4.5.5
- Tailwind CSS 3.x

**Analysis:**

- `@typescript-eslint/typescript-estree` - AST parsing
- `typescript` - Type system analysis
- `glob` - File pattern matching

**Figma:**

- Figma REST API (fetch-based client)
- Personal Access Token for authentication

**UI:**

- React Router - Navigation
- Tanstack Query - Data fetching/caching
- Zustand - Lightweight state management
- Recharts - Data visualization
- Lucide React - Icons

**Storage:**

- IndexedDB (via `dexie`) - Local audit results and drift exceptions
- LocalStorage - User preferences and onboarding state
- Static HTML export - Shareable reports (no backend required)

**Deployment:**

- Local dev: `yarn dev` (default)
- Public repo: GitHub (open source)
- Shared team access: Vercel deployment (static export)
- Future shared history: Supabase (clean swap from IndexedDB when needed)

**Testing:**

- Jest + React Testing Library (consistency with Nucleus)

---

## Architecture Overview

### Data Flow

```
Nucleus Source Files → File Scanner → AST Parser → Component Metadata
                                                          ↓
Figma REST API → Figma Parser → Figma Component Data → Parity Checker
                                                          ↓
                                                     Rule Engine
                                                          ↓
                                                    Score Calculator
                                                          ↓
                                                     Results Store (IndexedDB)
                                                          ↓
                                                      React UI
```

### Core Components

**1. Component Analyzer**

- Scans `/src/components/` and `/src/patterns/`
- Extracts metadata: props, exports, imports, token usage
- Detects patterns: styled-components usage, ResponsiveCSSProps, accessibility features
- Outputs `ComponentMetadata[]`

**2. Figma Client**

- Fetches components from Figma file via REST API
- Parses component properties, variants, documentation
- Caches responses (1 hour TTL) to avoid rate limits
- Outputs `FigmaComponent[]`

**3. Parity Checker (PRIMARY FEATURE)**

- Compares code components with Figma components
- Checks: name matching, props alignment, variant coverage, documentation parity
- Generates per-component scores (0-100)
- Identifies: missing components, name mismatches, prop/variant discrepancies
- Provides remediation suggestions

**4. Rule Engine**

- Plugin-based system for extensible audit rules
- Categories: `figma-parity`, `accessibility`, `tokens`, `documentation`, `architecture`
- Each rule returns `AuditRuleResult[]` with pass/fail, severity, remediation

**5. Score Calculator**

- Aggregates rule results into category scores
- Weights: Parity 30%, A11y 25%, Tokens 20%, Docs 15%, Architecture 10%
- Outputs overall health score (0-100)

---

## Key TypeScript Interfaces

```typescript
// Component metadata from code analysis
interface ComponentMetadata {
  name: string;
  filePath: string;
  hasSpec: boolean;
  hasStories: boolean;
  hasIndex: boolean;
  exports: { default: boolean; named: string[]; types: string[] };
  props: PropDefinition[];
  usesTokens: boolean;
  tokenUsage: string[];
  extendsResponsiveCSSProps: boolean;
  hasAriaProps: boolean;
  hasFocusVisible: boolean;
  testCoverage?: number;
  storyCount?: number;
}

// Figma component data
interface FigmaComponent {
  id: string;
  name: string;
  description: string;
  key: string;
  variants?: FigmaVariant[];
  properties?: FigmaProperty[];
  documentation?: string;
  colorTokens: string[];
  spacingTokens: string[];
  lastModified: string;
}

// Parity analysis result
interface ComponentParityResult {
  name: string;
  score: number; // 0-100
  status: "perfect" | "good" | "issues" | "critical";
  checks: {
    nameMatch: CheckResult;
    propsMatch: CheckResult;
    variantsMatch: CheckResult;
    documentationMatch: CheckResult;
    tokensMatch: CheckResult;
  };
  recommendations: string[];
}

// Audit rule structure
interface AuditRule {
  id: string;
  category:
    | "figma-parity"
    | "accessibility"
    | "tokens"
    | "documentation"
    | "architecture";
  name: string;
  description: string;
  severity: "error" | "warning" | "info";
  execute: (context: AuditContext) => Promise<AuditRuleResult[]>;
}
```

---

## Component Matching Strategy

The tool uses a **three-layer matching system** — each layer takes priority over the one below it:

### Layer 1 — Figma Code Connect (highest priority, future)

Figma's official feature for linking Figma components to code. Once Code Connect is configured in the Nucleus Figma file, the tool reads those mappings via the Figma API and uses them as the authoritative source. No other matching needed.

**Status:** Code Connect is NOT currently configured in the Nucleus Figma file (`jU08BKiiI2iegYajq41e2W`). Setting it up is a recommended next step for the Design team.

### Layer 2 — Manual Component Mapping UI (explicit overrides)

A Settings page where users explicitly link code components to Figma components. Stored in IndexedDB `componentMappings` table. Takes priority over fuzzy matching.

```typescript
interface ComponentMapping {
  id?: number;
  codeComponentName: string; // e.g. "Button"
  figmaComponentName: string; // e.g. "Earnest/Button"
  figmaNodeId?: string;
  createdAt: string;
}
```

UI: Two columns — unmatched code components on the left, searchable Figma component dropdown on the right. One row per unmapped component.

### Layer 3 — Fuzzy Name Matching (automatic fallback)

When no explicit mapping exists, use Jaro-Winkler similarity to find the closest Figma component for each code component. Auto-match above 0.85 threshold. Flag near-matches (0.70–0.85) as "suggested — needs review."

**Matching resolution order:**

1. If Code Connect mapping exists for this component → use it
2. If manual mapping exists in `componentMappings` → use it
3. Fuzzy match above 0.85 → auto-match
4. Fuzzy match 0.70–0.85 → show as "Suggested match — confirm?"
5. No match → "Missing in Figma"

---

## Parity Checking Logic

**Algorithm:**

1. **Component Matching**
   - Apply matching strategy above (Code Connect → manual mapping → fuzzy)
   - Identify missing components (in Figma but not code, or vice versa)

2. **Props Comparison**
   - Extract React prop types from TypeScript AST
   - Map Figma properties to React props
   - Check coverage: % of Figma properties implemented
   - Flag extra props in code not in Figma
   - Compare required vs optional

3. **Variants Comparison**
   - Extract Figma variants (e.g., size: small/medium/large)
   - Map to code variant props
   - Check all Figma variants are implemented
   - Flag code variants not in Figma

4. **Documentation Parity**
   - Compare Figma descriptions with JSDoc comments
   - Check prop descriptions exist
   - Verify Storybook story examples align with Figma usage

5. **Token Usage**
   - Cross-reference Figma design tokens with code token usage
   - Flag hard-coded values that should use tokens
   - Verify token naming consistency

6. **Approved Drift Filter** _(applied before scoring)_
   - Before calculating scores, check every mismatch against the DriftException store
   - Matching exceptions are excluded from the mismatch list entirely
   - Score is calculated only from remaining unapproved mismatches

**Scoring:**

- Perfect name match: 100 points
- Props coverage: (matched props / total Figma props) × 100
- Variants coverage: (matched variants / total Figma variants) × 100
- Overall component score: average of all checks
- Approved drift items are excluded from all calculations (not counted as pass or fail)

---

## Approved Drift Exception System

Design and engineering naturally present the same component differently. A Figma "Button" with a "Type: Primary/Secondary" property is the same concept as `<Button variant="primary">` in code — just a different abstraction. The Approved Drift system lets users acknowledge these intentional differences so they don't pollute the parity score.

### Data Model

```typescript
type DriftReason =
  | "naming-convention" // e.g. Figma "Type" → code "variant"
  | "design-abstraction" // e.g. Figma shows states visually, code uses props
  | "pending-implementation" // Known gap, being addressed in a future sprint
  | "intentional-divergence"; // Design and code deliberately differ here

interface DriftException {
  id: string; // UUID
  componentName: string; // e.g. "Button"
  category: AuditCategory; // e.g. "figma-parity" | "accessibility" | etc.
  propertyName?: string; // e.g. "variant" — omit for category-level exceptions
  figmaValue?: string; // e.g. "Type: Primary/Secondary/Tertiary"
  codeValue?: string; // e.g. "variant: 'primary' | 'secondary' | 'tertiary'"
  reason: DriftReason; // Predefined category (required)
  createdAt: string; // ISO timestamp
}
```

### Granularity

- **Property-level**: `componentName + category + propertyName` — approves drift for one specific prop mismatch (e.g. Button's "variant" naming)
- **Category-level**: `componentName + category` — approves all drift within a category for a component (e.g. skip all figma-parity checks for CreateAccountDialog)

### Storage

Stored in IndexedDB via Dexie — `drift-exceptions` table. Managed entirely through the UI. No config file needed.

### UI Behaviour

- Each mismatch row in the Parity view has an **"Approve Drift"** action button
- Clicking opens an inline dialog: select a predefined reason, optionally add Figma/code mapping context
- Approved items remain visible in the list but are visually distinguished (grayed out, reason badge shown) so the history is preserved
- Exceptions can be **revoked** at any time, which immediately restores that item to the score calculation
- The parity score badge updates in real-time as exceptions are added/removed

### Score Display

The parity score reflects only unapproved mismatches. A small indicator shows how many exceptions are active (e.g. "3 approved exceptions") so the score remains transparent rather than appearing artificially inflated.

---

## Parity Score Grading Scale

Scores are always shown with a grade label — `78 · Good` — never a raw number alone.

| Grade         | Score  | Definition                                                                                                                   |
| ------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Excellent** | 90–100 | Tightly aligned. Remaining gaps are minor or intentionally approved. Suitable for public component docs.                     |
| **Good**      | 75–89  | Minor drift. Design intent is mostly reflected in code. Normal for an actively evolving system.                              |
| **Fair**      | 60–74  | Noticeable misalignment. Designers are making decisions that can't be implemented as specified. Needs a remediation sprint.  |
| **Poor**      | 40–59  | Significant drift. Engineers and designers are working from different sources of truth. Design system value is being eroded. |
| **Critical**  | 0–39   | Severe misalignment. The Figma library is not a reliable reference for implementation. Team trust in the system is at risk.  |

**Grounding:**

- 75%+ mirrors software quality benchmarks for "acceptable" (test coverage, lint compliance)
- 90%+ mirrors the accessibility audit threshold for "substantially compliant"
- Below 60% is where NNGroup research shows teams start abandoning design systems due to lack of trust

---

## Figma Naming Convention

To enable accurate component matching, Figma components must follow a top-level naming convention that mirrors React component names.

**Rule:** Everything before the first `/` in a Figma component name must exactly match the React component name (case-insensitive).

```
Figma name          →   React component
─────────────────────────────────────────
Button/Primary      →   <Button>
Button/Secondary    →   <Button>
Tag/Success         →   <Tag>
Input/Default       →   <Input>
Input/Error         →   <Input>
```

**Escape hatch — `@code` tag in description:**
For components where naming can't match (legacy names, complex patterns), add `@code ComponentName` to the Figma component's description field. The audit tool checks this first before falling back to name matching.

```
Figma name: "Legacy Button"
Description: "@code Button"   ← tool uses this
```

This convention should be documented in the onboarding checklist and in the tool's Settings page.

---

## AST Parsing Risk Mitigation

Extracting props from TypeScript is non-trivial for complex components (generics, Radix UI primitives, re-exported types). The tool uses a fallback ladder:

1. **Regex scan first** — Pattern match `interface XProps` and `type XProps`. Handles ~80% of components with minimal complexity.
2. **AST parsing second** — Full TypeScript compiler API parse for components where regex is insufficient.
3. **Graceful degradation** — If both fail, mark component as `"props unanalyzable"`. File structure checks still run. Component appears in results with a warning badge: _"Props could not be extracted — manual review recommended."_ Score excludes this component from prop-level checks only.

Components marked as unanalyzable can be manually resolved via the Approved Drift system.

---

## Onboarding Experience

Shown on first launch only. Replaced by the dashboard after first audit completes. State stored in localStorage.

```
Welcome to DS Audit Tool
─────────────────────────────────────────────────

□  Step 1 — Connect Figma
   Enter your Personal Access Token + File Key
   [ Test Connection → ]

□  Step 2 — Confirm Nucleus Path  (unlocks after Step 1)
   /Users/you/Dev/nucleus
   ✓ Found 54 components
   [ Change Path ]

□  Step 3 — Run Your First Audit  (unlocks after Step 2)
   Takes ~20 seconds
   [ Start First Audit → ]

─────────────────────────────────────────────────
Need help finding your Figma file key? →
```

Each step unlocks the next on success. Step 3 runs the full audit and redirects to the dashboard on completion.

---

## Open Source & Sharing Strategy

**GitHub:**

- Public repository — open source for the design systems community
- MIT license
- README includes setup guide for adapting to other design systems

**Sharing audit results:**

- **"Publish Report"** button exports a self-contained static HTML snapshot
- Snapshot can be opened in any browser, emailed, or deployed to Vercel/Netlify
- No login or tool install required to view a published report

**Team deployment:**

- Deploy to Vercel for shared read access across the team
- Each team member still runs scans locally (no backend required)
- Shared reports are published from local → Vercel via the Publish Report flow

**Future — shared audit history:**

- Swap IndexedDB for Supabase (Postgres) to enable persistent multi-user history
- Designed as a clean architectural swap — no UI changes needed

---

## Critical Audit Rules

### Figma Parity Rules

1. **Name Match** - Components in Figma have corresponding code implementations
2. **Props Parity** - Figma properties match React props
3. **Variants Parity** - All Figma variants are implemented
4. **Documentation Parity** - Descriptions align between Figma and code

### Accessibility Rules

1. **Focus Visible** - Interactive components have `:focus-visible` styles
2. **Semantic HTML** - Proper element usage (button not div)
3. **ARIA Attributes** - Correct ARIA props where needed
4. **Keyboard Navigation** - Event handlers for keyboard interaction

### Token Usage Rules

1. **No Hard-coded Colors** - Flag hex/rgb values, suggest theme.tokens.\*
2. **No Hard-coded Spacing** - Flag px values, suggest theme.space.\*
3. **Theme Coverage** - Components work with all 3 themes (earnest, rebrand2023, product2024)

### Documentation Rules

1. **Stories Required** - Component.stories.tsx exists
2. **Story Completeness** - All variants have stories
3. **JSDoc Comments** - Props have descriptions
4. **Test Coverage** - Component.spec.tsx exists with NucleusProvider wrapper

### Architecture Rules

1. **File Structure** - 4-file pattern (Component.tsx, .spec.tsx, .stories.tsx, index.ts)
2. **Named Exports Only** - No default exports
3. **ResponsiveCSSProps** - Props extend ResponsiveCSSProps
4. **Styled Components** - Uses styled-components, not inline styles

---

## UI Pages & Navigation

```
/                           Dashboard (overview, category scores, top issues)
/parity                     Figma-to-code parity detailed view
/accessibility              Accessibility audit results
/tokens                     Token usage audit
/documentation              Documentation coverage
/architecture               Architecture/patterns audit
/components/:name           Individual component drill-down
/settings                   Configuration (Figma token, thresholds, rule toggles)
```

### Dashboard Components

- **OverallHealthScore** - Large circular progress indicator (0-100)
- **CategoryCard** - Score card for each audit category
- **ComponentIssuesTable** - Sortable table of components with issue counts
- **TrendChart** - Historical score trends (future enhancement)

### Parity View Components

- **ParityScoreBadge** - Visual score indicator with status color + active exception count
- **IssueCard** - High-level issue summary (missing components, mismatches)
- **ComponentParityList** - Detailed component-by-component breakdown
- **VisualDiff** - Side-by-side Figma vs Code comparison
- **MismatchRow** - Individual mismatch item with "Approve Drift" action
- **ApproveDriftDialog** - Inline dialog with predefined reason picker + optional mapping fields
- **DriftBadge** - Visual tag showing the reason on approved/grayed-out items

### Component Detail Page

- Component metadata (file path, exports, props)
- Parity analysis breakdown
- Visual comparison with Figma
- All audit results for this component
- Remediation checklist
- Links to VS Code and Figma

---

## Implementation Phases

### Phase 1: Foundation & Setup (MVP Priority)

**Goal:** Basic project scaffolding, file scanning, and onboarding experience

**Tasks:**

1. Create project directory structure ✅
2. Set up Vite + React + TypeScript + Tailwind ✅
3. Configure routing with React Router ✅
4. Create basic UI shell (header, sidebar, main content) ✅
5. Implement file system scanner for Nucleus components ✅
6. Extract basic component metadata using regex fallback → AST fallback ladder
7. Build 3-step onboarding checklist (Figma connect → path confirm → first scan)
8. Store onboarding completion state in localStorage
9. Implement graceful degradation for unanalyzable components (warning badge)

**Deliverable:** Can scan Nucleus, display component list, and guide new users through setup

---

### Phase 2: Figma Integration (MVP Priority)

**Goal:** Fetch and parse Figma component library

**Tasks:**

1. Create Figma REST API client (with PAT authentication)
2. Fetch Figma file metadata
3. Parse component nodes from Figma API response
4. Extract properties, variants, descriptions
5. Implement IndexedDB caching with TTL
6. Create Figma settings page (token input, file key)

**Deliverable:** Can fetch Figma data and cache it locally

---

### Phase 3: Parity Checker + Approved Drift (MVP Priority - PRIMARY FEATURE)

**Goal:** Compare Figma with code, generate graded parity scores, and allow users to approve intentional drift

**Tasks:**

1. Implement component name matching (top-level Figma name → React component, `@code` tag fallback)
2. Build props comparison logic using regex → AST fallback ladder
3. Build variants comparison logic
4. Create scoring system (0-100 per component, overall score)
5. Apply grading scale to scores: Excellent / Good / Fair / Poor / Critical
6. Display scores as `78 · Good` — never raw numbers alone
7. Identify missing components, name mismatches, prop discrepancies
8. Generate remediation suggestions with severity tiers (critical → major → minor)
9. Build parity report UI (dashboard + detail view)
10. Create `drift-exceptions` Dexie table and `DriftException` type
11. Build `ApproveDriftDialog` with predefined reason picker
12. Implement drift filter in score calculator (exclude approved items)
13. Add `DriftBadge` + revoke action to approved mismatch rows
14. Show active exception count on parity score badge

**Deliverable:** Graded parity scores with severity tiers, approved drift exceptions, and Figma naming convention support

---

### Phase 4: Additional Audit Rules (Post-MVP)

**Goal:** Implement accessibility, token, documentation, architecture checks

**Tasks:**

1. Create rule engine framework (plugin architecture)
2. Implement AST-based code analysis (TypeScript compiler API)
3. Build accessibility rules (focus-visible, ARIA, semantic HTML)
4. Build token usage rules (detect hard-coded colors/spacing)
5. Build documentation rules (stories/tests exist, JSDoc coverage)
6. Build architecture rules (file structure, exports, patterns)
7. Create category-specific UI pages

**Deliverable:** All 5 audit categories functional with detailed results

---

### Phase 5: UI Polish & Reporting (Post-MVP)

**Goal:** Production-ready UI, open source release, and team sharing

**Tasks:**

1. Add data visualizations (charts for scores, grade breakdown)
2. Implement filtering/sorting on component tables
3. Build component detail drill-down page
4. Create visual diff component (Figma thumbnail vs Storybook)
5. Build **"Publish Report"** — exports self-contained static HTML snapshot
6. Add JSON export for audit reports
7. Optimize performance (lazy loading, virtualization)
8. Write README with setup guide for adapting to other design systems
9. Publish repo to GitHub (MIT license, open source)
10. Configure Vercel deployment for team access

**Deliverable:** Open source release with shareable reports and Vercel deployment

---

## Configuration

### Environment Variables (.env)

```env
VITE_FIGMA_PERSONAL_ACCESS_TOKEN=figd_***
VITE_FIGMA_FILE_KEY=your_figma_file_key
VITE_NUCLEUS_ROOT_PATH=/Users/bentley/Dev/nucleus
```

### Audit Config (audit.config.ts)

```typescript
export const auditConfig = {
  nucleus: {
    rootPath: "/Users/bentley/Dev/nucleus",
    componentPaths: ["src/components", "src/patterns"],
    tokenPath: "src/theme",
    excludePaths: ["node_modules", "dist", "test/coverage"],
  },
  figma: {
    fileKey: process.env.VITE_FIGMA_FILE_KEY,
    cacheDuration: 60 * 60 * 1000, // 1 hour
  },
  scoring: {
    weights: {
      parity: 0.3,
      accessibility: 0.25,
      tokens: 0.2,
      documentation: 0.15,
      architecture: 0.1,
    },
  },
};
```

---

## Verification & Testing

### Manual Testing

1. **Run audit scan:** Click "Run Audit" button → verify progress indicator → see results
2. **Dashboard loads:** Overall score displays, category cards show correct scores
3. **Parity view:** Navigate to /parity → see missing components, mismatches, component list
4. **Component detail:** Click a component → see full analysis, Figma comparison, recommendations
5. **Figma integration:** Enter Figma token → fetch data → verify caching works (check IndexedDB)
6. **Export report:** Click export → download JSON file → verify structure

### Unit Testing

- Test parity checking algorithm with mock data
- Test score calculation logic
- Test AST parsing utilities
- Test Figma API client (with mocked responses)

### Integration Testing

- Full audit run with real Nucleus codebase
- Verify all rules execute successfully
- Check performance (scan time < 30 seconds for 54 components)

### Acceptance Criteria

- [ ] Can scan all Nucleus components (src/components + src/patterns)
- [ ] Fetches Figma data successfully (with valid PAT)
- [ ] Generates parity score for each component
- [ ] Identifies missing components in code or Figma
- [ ] Flags prop/variant mismatches with details
- [ ] Provides actionable remediation suggestions
- [ ] UI is responsive and accessible (WCAG 2.2 AA)
- [ ] Results load quickly (<2s for cached data)
- [ ] Can export audit results as JSON

---

## Critical Files to Reference

**Nucleus Component Examples:**

- `/Users/bentley/Dev/nucleus/src/components/Button/Button.tsx` - Complex component with variants
- `/Users/bentley/Dev/nucleus/src/components/Tag/Tag.tsx` - Simpler component with status variants
- `/Users/bentley/Dev/nucleus/src/components/Button/Button.stories.tsx` - Story structure
- `/Users/bentley/Dev/nucleus/src/components/Button/Button.spec.tsx` - Test patterns

**Theme System:**

- `/Users/bentley/Dev/nucleus/src/theme/theme.ts` - Theme interface
- `/Users/bentley/Dev/nucleus/src/theme/product2024-tokens.ts` - Token structure
- `/Users/bentley/Dev/nucleus/src/components/Provider/NucleusProvider.tsx` - Provider pattern

**Build Configuration:**

- `/Users/bentley/Dev/nucleus/vite.config.ts` - Vite setup (reference for audit-tool config)
- `/Users/bentley/Dev/nucleus/tsconfig.json` - TypeScript config (path aliases)
- `/Users/bentley/Dev/nucleus/package.json` - Dependencies

**Documentation:**

- `/Users/bentley/Dev/nucleus/CLAUDE.md` - Project standards and conventions

---

## Impact & Metrics

### The Problem This Solves

The current process for catching design-to-code drift is entirely reactive:

> A designer notices something looks wrong in production → Slack message → engineer investigates → back and forth. Or worse — another team or stakeholder calls it out publicly, eroding trust in the design system.

**Cost per incident (estimated):**

| Who       | Activity                                   | Time           |
| --------- | ------------------------------------------ | -------------- |
| Designer  | Notices, screenshots, writes Slack message | 30 min         |
| Engineer  | Investigates, traces root cause            | 45–60 min      |
| Both      | Clarification rounds (avg. 2–3)            | 60–90 min      |
| Engineer  | Fix + re-review                            | 30–60 min      |
| **Total** |                                            | **~3–4 hours** |

At 5 reactive incidents per sprint, that's **15–20 hours of waste per sprint** — before accounting for the reputational cost of public callouts and the downstream effect of teams losing confidence in Nucleus and going off-system.

The audit tool shifts this from reactive to proactive: issues are caught before they ship, in a private systematic process, with clear ownership.

---

### Recommended Audit Cadence

**Weekly scan — every Monday**

- Run before the week starts (~20 seconds)
- Surfaces new drift introduced from the previous week
- Key metric: drift velocity — new gaps opened vs. closed
- Builds habit before it becomes a compliance exercise

**Pre-release scan — before every deploy**

- Hard gate: Critical issues flagged before shipping
- Shared signal between design and engineering: _"these need attention before this goes out"_
- Creates joint accountability

Cadence should be revisited once sprint rhythm is better defined.

---

### Metrics by Stakeholder

**VP of Engineering** — engineering time, rework, reliability

- _"We prevented X hours of rework this sprint by catching drift before it shipped"_
- _"Drift velocity: down 40% over 6 weeks"_
- _"0 critical parity issues open going into this release"_

**Head of Design** — design intent, system fidelity, adoption

- _"83% of Nucleus components are perfectly aligned with Figma"_
- _"Design intent is being implemented accurately across X components"_
- _"Parity improved from Fair (68) to Good (81) since last quarter"_

**VP of Product** — speed, consistency, user experience

- _"Reduced design → engineering iteration cycles from avg. 3 rounds to 1.2"_
- _"UI consistency score: Good — up from Critical 6 months ago"_
- _"Teams are shipping faster because they trust the design system"_

---

### Success Definition at 6 Months

**Primary outcomes:**

- Measurable reduction in design QA time per sprint
- Measurable reduction in design → engineering iteration cycles (target: avg. 3 rounds → under 1.5)

**Leading indicators:**

- Parity score trending upward week over week
- Drift velocity trending toward zero (fewer new gaps per sprint)
- Zero Critical issues at time of release for 3+ consecutive sprints

**Lagging indicators:**

- Fewer public Slack callouts about design-code mismatches
- Engineering team referencing Nucleus Storybook confidently (anecdotal)
- Leadership continuing to invest in design system improvements

---

### Published Report Format

Reports are narrative-first — leadership gets the story in 30 seconds, engineers get the action items.

```
Nucleus Health Report — April 2026
────────────────────────────────────────────────

Overall Health: 81 · Good   ↑6 from March

"The design system is in good health. Parity improved
significantly this quarter. 3 issues need attention
before the next release."

────────────────────────────────────────────────
BY THE NUMBERS

47 / 54 components aligned      87%
7 components with open issues
3 critical issues (action required)
8 approved exceptions (intentional)

────────────────────────────────────────────────
TREND (last 4 scans)

Mar 3   68 · Fair    ████████████░░░░
Mar 17  72 · Fair    ██████████████░░
Mar 31  78 · Good    ███████████████░
Apr 14  81 · Good    ████████████████

────────────────────────────────────────────────
TOP ISSUES

⛔ Critical   Button — variant prop missing in code
⚠  Major     Input — 3 Figma variants not implemented
⚠  Major     Tag — color token hardcoded (#6B7280)

[View full report →]
────────────────────────────────────────────────
Generated by DS Audit Tool · audit.earnest.com
```

Reports are exported as self-contained static HTML — shareable by link, email, or Slack. No login required to view.

---

### Dashboard Metric Card Format

Scores are never shown as raw numbers alone. Every metric includes context:

```
Figma Parity              81 · Good  ↑6 from last scan
──────────────────────────────────────────────────────
47 aligned  ·  7 with issues  ·  8 approved exceptions

Since last scan (7 days ago)
✓ 2 issues resolved
⚠ 1 new mismatch introduced  (Button — variant prop)
○ 3 approved exceptions added
```

---

## Future Enhancements

1. **Historical Tracking** - Store audit results over time, show trend charts
2. **CI/CD Integration** - Run audits on every PR, fail if score drops
3. **Auto-fix** - Generate PR to fix simple issues (add missing files, update props)
4. **Chromatic Integration** - Pull visual regression test results
5. **Real-time Monitoring** - File watcher for continuous auditing
6. **Slack Notifications** - Post audit summaries to #eng-nucleus
7. **AI Suggestions** - Use Claude API for intelligent remediation advice
