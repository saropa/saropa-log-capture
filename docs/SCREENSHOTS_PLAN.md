# README Screenshots Plan

Plan started 2026-04-23. Working document — tick items as shots are captured and added to the README.

## Goal

A `## Screenshots` gallery near the top of `README.md` that sells the extension at a glance, plus selective inline shots embedded next to the features they demonstrate. Each shot must either show something unique to this extension or make a feature visible that a text bullet cannot convey.

## File conventions

- **Location:** `images/screenshots/`
- **Filename:** `YYYYMMDD_short_description.png` (lowercase, underscores, today's date when captured — matches the two existing files)
- **Format:** PNG, lossless, screen-native DPI
- **Target width:** 1600–2200 px after cropping to the relevant panel(s)
- **Theme:** **Default Dark Modern** across the whole gallery for visual consistency
- **Font:** default VS Code editor font at default size (Ctrl+0 to reset zoom)
- **Redactions:** no real emails, API tokens, machine names, repo paths, or customer-identifying strings — prefer sample logs from `examples/` where applicable

## README integration

Two placements:

**Top gallery** — the `## Screenshots` section already in place above `## Overview`. Tier 1 shots only, max 4–5. Must work as a visual TL;DR for someone who scrolls the top one and a half screens and leaves.

**Inline in feature sections** — Tier 2 and Tier 3 shots embedded directly below the matching feature bullet inside the `<details>` block. A reader deep-reading the features benefits from seeing the feature rather than parsing another sentence about it.

## Shots to capture

### Tier 1 — top gallery

Done:

- [x] **Project log view** — `20260414_project_log_view.png`
  Alt: *Debug output in the log viewer with colored severity markers, framework classification, and run navigation*

- [x] **SQL diagnostics** — `20260401_log_viewer_sql.png`
  Alt: *Log viewer showing Drift SQL queries with syntax highlighting and diagnostic badges*

Remaining:

- [ ] **Signals panel**
  Filename: `YYYYMMDD_signals_panel.png`
  Setup: open a log with errors and SQL fingerprints (use `examples/drift-n-plus-one-sample-lines.txt` or a real session with repeated Drift queries). Click the lightbulb icon on the icon bar. Expand **Active Cases**, **All Signals**, and **Performance** accordions so all three are visible at once.
  Alt: *Signals panel showing Active Cases, All Signals, and Performance accordions for a log with detected N+1 queries*
  Why Tier 1: cross-session signal correlation is a differentiator — nothing else in the VS Code marketplace does this.

- [ ] **Filter drawer open**
  Filename: `YYYYMMDD_filter_drawer.png`
  Setup: open a log with mixed severities and multiple logcat tags. Click the filter icon. Show severity toggles (all seven levels), source tag chips with a few logcat tags visible, Log Sources tier radios (Flutter DAP / Device / External), and keyword watch chips in the toolbar above.
  Alt: *Filter drawer with severity toggles, source tag chips, and Log Sources tier radios*
  Why Tier 1: shows the whole control surface in one frame — communicates "you can slice the log many ways" without a sentence.

- [ ] **Session comparison (diff two sessions)**
  Filename: `YYYYMMDD_session_compare.png`
  Setup: run **Compare Two Sessions** with two similar logs where one has extra errors or slower SQL. Show the side-by-side view; if the Slow A / B / Δ slow indicators fire, include them.
  Alt: *Side-by-side comparison of two debug sessions with slow-query deltas highlighted*
  Why Tier 1: most readers don't expect a log extension to diff runs — surprise is the sale.

### Tier 2 — inline in feature sections

- [ ] **Pop-out on second monitor**
  Filename: `YYYYMMDD_popout_second_monitor.png`
  Setup: pop out the viewer, drag to a second monitor (or resize to half-screen and capture as a floating window). Include the detached-window chrome so it's obviously not a sidebar.
  Placement: under the **Pop-out viewer** bullet in Viewer section.
  Alt: *Log viewer popped out as a floating window for use on a second monitor*

- [ ] **Run navigation (Flutter)**
  Filename: `YYYYMMDD_run_navigation.png`
  Setup: Flutter session with three or more hot restarts/reloads. Capture the session bar showing **Run 2 of 4** with chevron nav, and one or two run separators visible in the log below (bar with run number, time range, duration, issue counts).
  Placement: under the **Run navigation** bullet in Viewer section.
  Alt: *Run navigation chip showing Run 2 of 4 with separators marking hot restart boundaries*

- [ ] **Stack trace states**
  Filename: `YYYYMMDD_stack_trace_states.png`
  Setup: one log with three exceptions. Cycle the first to **preview** (first three app frames visible), leave the second **collapsed** (single summary row), expand the third **fully**. Capture all three in one screenshot.
  Placement: under the **Collapsible stack traces** bullet.
  Alt: *Three stack traces rendered in collapsed, preview, and expanded states*

- [ ] **Search flyout with match options**
  Filename: `YYYYMMDD_search_flyout.png`
  Setup: Ctrl+F, type a regex, enable **case** and **regex** toggles, show match navigation (N of M), highlight at least one matched line.
  Placement: under the **In-log search** bullet.
  Alt: *In-log search flyout with case, whole word, and regex toggles and match navigation*

- [ ] **Error classification badges**
  Filename: `YYYYMMDD_error_classification.png`
  Setup: log containing a NullPointerException (CRITICAL), a TimeoutException (TRANSIENT), and a TypeError (BUG). Capture all three with their inline severity badges visible together.
  Placement: under the **Smart error classification** bullet.
  Alt: *Three errors with CRITICAL, TRANSIENT, and BUG severity badges inline*

- [ ] **Options → Integrations screen**
  Filename: `YYYYMMDD_integrations_screen.png`
  Setup: open **Options → Integrations…**. Capture the full screen with adapter categories, descriptions, and on/off state (e.g. Git, Build/CI, Test results enabled; others off).
  Placement: under the **Integration adapters** bullet in Capture & Storage.
  Alt: *Integrations settings screen listing opt-in adapters with descriptions and performance notes*

### Tier 3 — optional, feature-specific

Capture only when time or a nearby edit justifies it. Listed here so nothing gets forgotten.

- [ ] **Slow query burst marker (DB_08)** — green marker inserted after 5+ slow queries in a 2s window. Near **Slow query burst marker** bullet. Sample: `examples/drift-slow-burst-sample-lines.txt`.
- [ ] **N+1 synthetic signal row** — confidence label plus **Focus DB / Find fingerprint / Static sources** buttons. Near **Drift SQL N+1 hint**. Sample: `examples/drift-n-plus-one-sample-lines.txt`.
- [ ] **Top SQL Patterns chips** — fingerprint chips above the log with counts, including **Other SQL**. Near **Top SQL Patterns (filters)**. Sample: `examples/sql-fingerprint-guardrails-sample.txt`.
- [ ] **Drift SQL repeat collapse** — expanded summary row showing arg samples and timestamps. Near **Drift SQL repeat collapse**. Sample: `examples/drift-repeat-collapse-thresholds.txt`.
- [ ] **Inline peek** — double-click expansion showing surrounding context. Near **Inline peek**.
- [ ] **Pin lines and annotations** — pinned bar above log plus annotation popover. Near **Pin lines** / **Line annotations**.
- [ ] **Keyword watch chips** — chips with live counters in the toolbar, one chip clicked to show the pre-filled search. Near **Keyword watch**.
- [ ] **Lint diagnostic badges** — inline badges on lines referencing source files with active VS Code diagnostics. Near **Lint diagnostic badges**.
- [ ] **Line decorations** — timestamps with milliseconds, session elapsed, sequential counters, severity dots. Near **Line decorations**.
- [ ] **Export dialog** — export modal with preset templates and level selection, or the generated interactive HTML output. Near **HTML export** bullet.
- [ ] **AI Activity stream** — Claude Code tool calls interleaved with debug output with distinct colored borders and `[AI ...]` prefixes. Near **AI Activity (opt-in)**.
- [ ] **Explain with AI** — right-click menu plus response panel. Near **Explain with AI**.
- [ ] **Insight panel (Cases / Recurring / Hot files / Performance)** — full-height panel with the four accordions. Near **Insight: Cases, Recurring, Hot files, Performance**. Skip if too similar to the Tier 1 Signals shot — pick whichever composes better.
- [ ] **Share Investigation** — share dialog with Gist / .slc / deep link / LAN options. Near **Share Investigation** / **Deep links**.

## Capture checklist

Before each shot:

- [ ] VS Code at default zoom (Ctrl+0)
- [ ] Theme: **Default Dark Modern**
- [ ] Default editor font, default size
- [ ] Activity bar and sidebar visible unless the shot is deliberately viewer-only
- [ ] Sample data sourced from `examples/` where applicable — no real project paths, no tokens, no PII
- [ ] No stray red counts or unsaved-file dots unrelated to what the shot demonstrates
- [ ] Crop to the relevant panel(s); no large blank space

After each shot:

- [ ] Filename `YYYYMMDD_description.png` (capture date, underscores, lowercase)
- [ ] File placed in `images/screenshots/`
- [ ] README updated: `raw.githubusercontent.com/saropa/saropa-log-capture/main/images/screenshots/<filename>` URL, descriptive alt text
- [ ] Alt text describes what a screen-reader user would otherwise miss — the content, not a decorative label
- [ ] CHANGELOG.md entry under the active unreleased section: *"docs(readme): add screenshot of \<feature\>"*
- [ ] Tick the corresponding box in this file

## Open questions

- **Light-theme variants?** Not planned. Dark-on-dark reads cleanly on both GitHub light and dark README backgrounds and keeps the gallery consistent. Revisit only if a user reports a specific problem.
- **Split Tier 3 into `docs/GALLERY.md`?** Not planned. The README is already long, but a second document creates two sources of truth and makes it easier for Tier 3 shots to rot. Keep them inline next to the feature.
- **Animated captures (GIF/WebM)?** Out of scope for this plan. Static PNGs cover the features listed here; if we later want to show interaction (expand-on-click, scroll-to-signal), open a separate plan.
