# Plan 115 — Signal Report and Panel Visual Design Pass

## Status: Partially Complete (shipped W1, W3, W4; deferred D2, D4/W2, D6 to plan 115b)

## Goal

Raise the visual quality of signal reports and the signal panel to match the polish of production analytics tools (Rejourney, Sentry, FullStory). The data infrastructure already exists — cross-session fingerprinting, signal co-occurrence, health scores, stat cards, severity classification, session timing. The rendering underdelivers on what the data can show.

This is a pure design/rendering plan. No new data collection, no new signals, no backend changes.

---

## Problem

### Current state

The signal report has:
- A responsive two-column grid (primary + secondary)
- Stat cards (`.overview-stat`) with count + label, hover lift, `--surface-2` background
- Confidence badges (`conf-badge--high/medium/low`) with severity-keyed tints
- Collapsible sections with chevron toggles
- Evidence blocks with line-numbered code snippets
- A health score (0–100 integer)
- Design tokens throughout (`--text-h3`, `--surface-2`, `--accent-critical`, `--space-*`)

The signal panel has:
- Section headers with emoji prefixes
- Time-window filter chips
- Sort toggle (severity / time)
- Signal list entries with occurrence counts
- Pulse strip (hidden until data arrives)

### What's missing

Compared to Rejourney's dashboard screenshots:

1. **No visual hierarchy in numbers.** Stat cards show raw counts with equal weight. Rejourney's stat tiles use color-coded top borders (blue=neutral, green=good, red=bad), delta indicators (+50.0%, -9.9%), and contextual labels ("vs prior 15-day window"). Our stat cards are gray boxes with a number.

2. **No trend visualization.** Cross-session fingerprint data includes first-seen, last-seen, and per-session counts — enough for a sparkline. Currently rendered as plain text ("Seen in 4 of last 10 logs"). Rejourney shows inline sparklines in their stability table.

3. **No severity badges on signal list entries.** The signal panel shows signal text with occurrence count. No color-coded type badge (ERROR / CRASH / PERF / SQL) like Rejourney's stability list. The confidence badges exist in reports but are absent from the panel list.

4. **Health score is a bare number.** "Health: 73/100" is functional but visually dead. A gauge, ring, or color-graduated bar would make the score scannable at a glance.

5. **Stat cards don't use severity coloring.** Error count, warning count, signal count all use the same gray card. Rejourney color-codes the top border of each stat tile (red for fail rate, blue for calls, green for response time).

6. **Signal panel entries lack visual density.** Each signal is plain text + count. Rejourney's stability rows show: colored type badge, issue title, description, environment pill, first-seen, last-event, event count, user count — all in one scannable row.

---

## Design changes

### D1. Stat card severity borders

Add a colored top border to each stat card keyed to its semantic meaning:

- Error count → `--accent-critical` (red)
- Warning count → `--accent-warning` (amber)
- Signal count → `--link` (blue)
- Health → green/amber/red gradient based on score (≥80 green, 50–79 amber, <50 red)

Implementation: add a `data-severity` attribute to `.overview-stat`, CSS applies `border-top: 3px solid var(--stat-border-color)`.

### D2. Stat card delta indicators

When cross-session data is available, show a delta below the count:

```
   12          3          73/100
 Errors    Warnings     Health
 +200%      -25%        ▲ improving
```

Delta compares the current log's counts to the average of the previous N logs (N from the project index). Color: green for improvement (fewer errors, higher health), red for regression.

Data source: `signal-co-occurrence.ts` already tracks per-session signal counts. The delta is a simple ratio.

### D3. Health score gauge

Replace the "73/100" text with a small visual gauge. Options (pick one during implementation):

- **Arc gauge:** A 180° SVG arc, filled proportionally, color-graduated (red → amber → green). Compact, fits in the stat card area.
- **Ring gauge:** A circular SVG ring with the score in the center. More prominent, works well as a hero element.
- **Bar gauge:** A horizontal progress bar with color segments. Simplest, fits inline.

Recommendation: **arc gauge** — compact enough for the stat card grid, visually distinct from plain text, minimal SVG (no external library).

### D4. Sparklines for cross-session signal trends

Add a small inline sparkline (50×16px SVG) to each signal entry in the "Across your logs" section, showing the signal's occurrence count over the last N logs.

Data source: the project index already stores per-session signal fingerprint counts. Query the last 10–20 entries for the fingerprint.

Implementation: reuse the existing `renderSparkline()` from `src/ui/panels/vitals-sparkline.ts` for the signal report (host-side HTML). For the signal panel (client-side JS), embed a minimal sparkline helper in the webview script. Use `--accent-critical` for upward trends (getting worse), `--link` for flat/declining.

**Deferred to a follow-up change** — the `timeline` data on `RecurringSignalEntry` needs to be verified as reaching the webview in the `signalData` message payload. If stripped for bandwidth, that pipeline change is out of scope for this pure-rendering plan.

### D5. Signal panel type badges

Add a colored type badge to each signal entry in the signal panel, matching the signal's category:

| Category | Badge text | Color |
|----------|-----------|-------|
| Error / crash | `ERROR` | `--accent-critical` |
| Warning | `WARN` | `--accent-warning` |
| Performance | `PERF` | `--accent-perf` (or `--link`) |
| SQL / query | `SQL` | purple tint (new token or `color-mix`) |
| Network | `NET` | amber tint |
| Escalation | `ESC` | orange tint |

Implementation: the signal scanner already tags each signal with a category. Render a small pill badge (`font-size: --text-caption`, `padding: 1px 6px`, `border-radius: --radius-sm`) before the signal text.

### D6. Signal panel entry density

Redesign signal panel rows from plain text + count to a structured row:

```
[ERROR]  NullPointerException            ▁▂▃▅▇  ×12
         Cannot read property 'length'          3 logs
```

Row contains:
- Type badge (D5)
- Signal title (bold, truncated)
- Sparkline (D4)
- Occurrence count
- Second line: signal subtitle (description/excerpt), log count (muted)

This matches the information density of Rejourney's stability rows without adding new data — all fields already exist.

### D7. Evidence block improvements

- **Line highlight:** The target line in evidence blocks uses `--vscode-editor-findMatchHighlightBackground`. Add a left-border accent (`3px solid --accent-critical`) to make it scannable without reading color backgrounds.
- **Context fade:** Lines far from the target (±5 lines away) get progressively lower opacity (0.7 → 0.5), drawing the eye to the center. CSS only — `nth-child` selectors on `.evidence-line`.

### D8. Report header hero

Replace the current `<h1>` signal title + `<div class="signal-summary">` with a hero block:

```
┌──────────────────────────────────────────────────────────┐
│  [ERROR]  NullPointerException                    [high] │
│  Cannot read properties of undefined ('lineItems')       │
│                                                          │
│  Line 847 · output.log · 2m 13s into session             │
│  ────────────────────────────────────────────────         │
│  [12 Errors] [3 Warnings] [5 Signals]  Health: ◠ 73     │
└──────────────────────────────────────────────────────────┘
```

Components: type badge, signal title (large), confidence badge, description line, metadata line (line number, file, timing), stat row with inline gauge. All data already available in the `RootCauseHintBundle`.

### ~~D9. Section accent borders~~ — ALREADY IMPLEMENTED

Section accent borders are already active in `signal-report-layout-styles.ts:94-101` with per-section `color-mix()` tints (info-blue for overview/recommendations, brand-orange for evidence/details, warning-yellow for related/other-signals, muted for history/ecosystem). No further work needed.

### D10. Overview row styling

The current overview rows are plain `<div>` key-value pairs. Upgrade to a definition-list layout with:

- Label in muted caption text, left-aligned
- Value in body text, right-aligned or below
- Subtle separator between rows
- Links styled with the `--link` color and hover underline (already partially done for log file links)

---

## Scope

### In scope

- CSS and HTML template changes only (stat cards, badges, sparklines, gauge, layout)
- SVG sparklines and gauge (inline, no library)
- Signal panel row redesign
- Signal report hero block
- All changes use existing design tokens

### Out of scope

- New data collection or signal detection
- Interactive charts or dashboards (beyond sparklines)
- Screenshot display (Plan 114)
- Signal panel structural changes (sections, filter chips, sort toggle stay as-is)
- New settings (all changes are visual-only, no user configuration)
- Webview message protocol changes
- Animation beyond existing hover transitions

---

## Workstreams

### W1. Stat cards (D1, D2, D3) — signal report

1. Severity-keyed top borders on stat cards
2. Delta indicators (current vs. previous N logs)
3. Health score arc gauge (inline SVG)

### W2. Sparklines (D4) — signal panel + report

1. SVG sparkline generator function (input: number array, output: SVG string)
2. Integrate into signal panel "Across your logs" entries
3. Integrate into signal report cross-session history section

### W3. Signal panel density (D5, D6) — signal panel

1. Type badges on signal entries
2. Row layout redesign (title + subtitle + badge + sparkline + count)

### W4. Signal report polish (D7, D8, D10) — signal report

1. Evidence block target-line accent + context fade
2. Report header hero block
3. Overview row styling

(D9 section accent borders already implemented — no work needed.)

### Ship order

W1 and W3 can ship independently (panel vs. report). W2 is shared infrastructure used by both W1 and W3. W4 depends on W1 (stat cards feed the hero block).

Recommended: **W1 → W3 → W4**. W2 (sparklines) deferred — requires verifying timeline data reaches the webview.

### File size risk

Several target files are near the 300-line limit. `signal-report-overview.ts` (330 LOC) will grow with the health gauge SVG — extract gauge rendering into `signal-report-gauge.ts`. If `viewer-signal-panel-script-part-b.ts` grows past the limit with type badges, extract badge rendering into a new part file.

---

## Design token additions

These are the only new tokens needed (all derivable from existing palette):

| Token | Value | Usage |
|-------|-------|-------|
| `--stat-border-error` | `var(--accent-critical)` | Error stat card top border |
| `--stat-border-warning` | `var(--accent-warning)` | Warning stat card top border |
| `--stat-border-info` | `var(--link)` | Neutral stat card top border |
| `--stat-border-health-good` | `var(--status-good)` | Health ≥80 — uses existing `--vscode-testing-iconPassed` token |
| `--stat-border-health-mid` | `var(--accent-warning)` | Health 50–79 |
| `--stat-border-health-bad` | `var(--accent-critical)` | Health <50 |
| `--accent-sql` | `color-mix(in srgb, var(--sev-performance) 80%, var(--surface-1))` | SQL signal badge — derives from the fixed purple severity pill |
| `--sparkline-up` | `var(--accent-critical)` | Upward trend (worsening) |
| `--sparkline-down` | `var(--status-good)` | Downward trend (improving) — uses existing `--vscode-testing-iconPassed` token |
| `--sparkline-flat` | `var(--link)` | Flat trend |

All derived from existing tokens. Green uses `--status-good` (already defined as `--vscode-testing-iconPassed`). Purple derives from the existing `--sev-performance` fixed pill color. No raw hex values introduced.

---

## Verification

- [ ] Stat cards show severity-colored top borders (error=red, warning=amber, signals=blue).
- [ ] Delta indicators show correct direction (green=improvement, red=regression) against previous N logs.
- [ ] Health gauge renders as an arc/ring with color graduation.
- [ ] Sparklines render inline in the signal panel and report, correct data, correct trend coloring.
- [ ] Type badges appear on signal panel entries with correct category colors.
- [ ] Signal panel rows show title, subtitle, badge, sparkline, and count without truncation issues.
- [ ] Evidence block target line has left-border accent and context lines fade.
- [ ] Report hero block renders type badge, title, confidence, metadata, and stat row.
- [x] Section borders activate on open with category-appropriate colors. (Already implemented.)
- [ ] All new tokens resolve correctly in both VS Code light and dark themes.
- [ ] No horizontal overflow on narrow panel widths (≤300px signal panel, ≤600px report).
- [ ] Sparkline SVG renders at correct size with no layout shift.
- [ ] `npm run compile` passes (no new lint warnings, no type errors).
- [ ] Manual F5 test: signal panel and report render correctly with real log data.

---

## Finish Report (2026-07-28)

### Shipped items (W1, W3, W4)

**D1 — Stat card severity borders:** `StatSeverity` type and `data-severity` attribute added to stat cards in `signal-report-overview.ts`. CSS rules in `signal-report-overview-styles.ts` apply `border-top: 3px solid` keyed to error/warning/info/health tiers via `--stat-border-*` tokens.

**D3 — Health score arc gauge:** New `signal-report-gauge.ts` renders a 180-degree SVG arc, color-graduated by score tier (>=80 green, 50-79 amber, <50 red). Uses `--stat-border-health-good/mid/bad` tokens. NaN-safe (guards non-finite input to 0). Integrated into the overview section via `healthGaugeRow()`.

**D5 — Signal panel type badges:** `kindBadgeText` map and `kindBadge(kind)` function added to `viewer-signal-panel-script-part-b.ts`. Badges inserted into both `renderSignalTrends` and `renderSignalsInThisLog` row HTML. Ten CSS color variants in `viewer-styles-signal-list.ts` use `color-mix` tints at 15-20% opacity per kind severity.

**D7 — Evidence block improvements:** `.evidence-line` opacity fade (0.55 base, 1.0 target, 0.8 adjacent) and `.evidence-line--target` left-border accent (3px `--accent-critical`) added to `signal-report-styles.ts`. Uses CSS `:has()` selector (Chromium-only, safe in VS Code webview).

**D8 — Report header hero:** `heroTypeBadge()` function maps `templateId` to a short label + color class. Header restructured from `<h1>` + `.signal-summary` to `.report-hero` with `.hero-title-row` containing type badge + h1 + confidence pill. CSS in `signal-report-layout-styles.ts`.

**D10 — Overview row styling:** Overview and stat card CSS extracted from `signal-report-styles.ts` into new `signal-report-overview-styles.ts`. Added `.overview-row` border-bottom separators, bold labels, consistent vertical rhythm.

**D9 — Section accent borders:** Already implemented before this plan. Confirmed in `signal-report-layout-styles.ts:94-101`.

### Design tokens added

Seven new tokens in `viewer-styles-tokens.ts:104-111`: `--stat-border-error`, `--stat-border-warning`, `--stat-border-info`, `--stat-border-health-good`, `--stat-border-health-mid`, `--stat-border-health-bad`, `--accent-sql`. All resolve through existing theme-bound tokens — no raw hex introduced.

### File splits

- `signal-report-styles.ts` exceeded 300 code lines → extracted overview/stat card CSS into `signal-report-overview-styles.ts`
- `viewer-signal-panel-script-part-b.ts` exceeded 300 code lines → extracted `sessionLatestTs`, `signalRepTs`, `buildEvidencePreviewHtml`, `renderSignalsInThisLog` into new `viewer-signal-panel-script-part-b2.ts`, wired in `viewer-signal-panel-script.ts`

### Lint fix: `addStat` max-params

Adding a `severity` parameter to `addStat` pushed it past the eslint `max-params: 4` limit. Fixed by combining `count` and `severity` into a tuple: `countAndSev: readonly [number | undefined, StatSeverity]`.

### Test fixes

- `signal-report-render.test.ts`: 2 assertions updated — hero `<h1>` now contains hypothesis text (not static "Saropa Signal Report"), `.signal-summary` class replaced by `.hero-title-row`.
- `signal-panel-row-click.test.ts`: 3 assertions updated to import and assert against `getSignalScriptPartB2()` where code moved from part-b. JS validity test extended to also parse part-b2.

### Deferred to plan 115b

D2 (stat card delta indicators), D4/W2 (sparklines), D6 (signal panel entry density redesign). D4 requires verifying timeline data availability in the webview message payload. D6 depends on D4 for the full row layout.

### Known issues

- Pre-existing type error in `integration-adapter-constants.test.ts` (screenshots feature added 4th param without test update) blocks `npm run compile` at step 3. Unrelated to this plan.
- Three parallel kind-to-label maps (`kindLabels`, `kindBadgeText` in webview JS, `heroTypeBadge` in host TS) share the same signal-kind taxonomy but have no shared source of truth. A new `SignalKind` value added to one map but not the others would silently render a generic/empty badge.
