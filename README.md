# Loupe

Design · Code · Parity

A local web tool for auditing the Nucleus design system. Compares your Figma component library against the code implementation, surfaces parity gaps, and tracks accessibility compliance — so drift gets caught before it ships.

---

## What it does

- **Figma Parity** — matches Figma components to code, compares props, flags mismatches and missing components
- **Accessibility** — checks 4 WCAG 2.2 AA criteria across all components (focus-visible, ARIA, semantic HTML, keyboard support)
- **Score history** — tracks parity and accessibility scores over time so you can measure improvement sprint over sprint
- **Action items** — ranks issues by effort so you know what to fix first
- **Publish Report** — exports a self-contained HTML snapshot you can share with stakeholders

---

## Prerequisites

- Node.js 18+
- Yarn
- The [Nucleus repo](https://github.com/meetearnest/nucleus) cloned locally
- A Figma personal access token (see below)
- **Storybook running** — Loupe links to component stories. Start it in Nucleus before scanning:

```bash
cd /path/to/nucleus
yarn storybook
```

---

## Setup

**1. Clone this repo**

```bash
git clone https://github.com/bwong93/design-systems-audit-tool.git
cd design-systems-audit-tool
yarn install
```

**2. Start the dev server**

```bash
yarn dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

**3. Complete onboarding**

The tool will walk you through three steps on first launch:

- **Figma token** — a personal access token from Figma (see below)
- **Nucleus path** — the absolute path to your local Nucleus repo (e.g. `/Users/yourname/Dev/nucleus`)
- **First scan** — kicks off the initial audit

That's it. Your settings are saved locally and you won't need to re-enter them.

---

## Getting a Figma personal access token

1. Open Figma → click your avatar (top left) → **Settings**
2. Scroll to **Security** → **Personal access tokens**
3. Click **Generate new token**
4. Name it (e.g. `Loupe`) and set expiry as needed
5. Under scopes, enable:
   - `File content` — read
   - `Library assets` — read
6. Copy the token — you'll only see it once

The Figma file key is the string in the URL of the Nucleus Figma file:

```
figma.com/design/THIS_IS_THE_KEY/...
```

---

## Running a scan

Click **Run Audit** on the Dashboard. A full scan takes about 20–30 seconds and:

1. Scans all components in `src/components` and `src/patterns`
2. Fetches Figma component data (cached for 1 hour)
3. Runs parity and accessibility checks
4. Saves results to local browser storage

Re-scan any time with the **Re-scan** button. Score history is tracked automatically.

---

## Sharing results

**Publish Report** (Dashboard → top right) exports a self-contained `.html` file you can email, post to Slack, or open in any browser — no tool install required.

---

## How scores work

All scores are 0–100, graded on the same scale:

| Grade     | Score  | What it means                                                    |
| --------- | ------ | ---------------------------------------------------------------- |
| Excellent | 90–100 | Tightly aligned, minimal drift                                   |
| Good      | 75–89  | Minor gaps, normal for an active system                          |
| Fair      | 60–74  | Noticeable misalignment, worth a remediation sprint              |
| Poor      | 40–59  | Significant drift, teams working from different sources of truth |
| Critical  | 0–39   | Severe misalignment, Figma is not a reliable reference           |

**Parity score** — average alignment across matched components (name + prop consistency).  
**Coverage score** — % of code components that have a confirmed Figma counterpart.  
**A11y score** — average % of 4 WCAG checks passing across all components.

---

## Recommended cadence

- **Weekly** — run before the week starts to surface new drift from the previous sprint
- **Pre-release** — run before every deploy as a quality gate

---

## Data storage

All data is stored locally in your browser (IndexedDB). Nothing is sent to a server. Each person who runs the tool has their own independent scan history.

---

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · Dexie (IndexedDB) · Recharts · Figma REST API
