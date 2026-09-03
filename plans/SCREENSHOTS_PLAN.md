# README Screenshots Plan

Started 2026-04-23. **Rewritten 2026-09-03** against v9.3.12 — the previous
revision used pre-v7 terminology and predated everything shipped in 9.3.x.
Working document — tick items as shots are captured and added to the README.

**Progress: 2 of 24 captured.**

## Goal

A `## Screenshots` gallery near the top of `README.md` that sells the extension
at a glance, plus selective inline shots next to the features they demonstrate.
Each shot must either show something unique to this extension or make a feature
visible that a text bullet cannot convey.

## File conventions

- **Location:** `images/screenshots/`
- **Filename:** `YYYYMMDD_short_description.png` (lowercase, underscores,
  capture date — matches the two existing files)
- **Format:** PNG, lossless, screen-native DPI
- **Target width:** 1600–2200 px after cropping to the relevant panel(s)
- **Theme:** **Default Dark Modern** across the whole gallery
- **Font:** default VS Code editor font at default size (Ctrl+0 to reset zoom)
- **Redactions:** no real emails, API tokens, machine names, repo paths, or
  customer-identifying strings — prefer `examples/` sample logs

## README integration

**Top gallery** — the `## Screenshots` section above `## Overview`. Tier 1 only,
max 4–5. Must work as a visual TL;DR for someone who reads the top screen and
leaves.

**Inline in feature sections** — Tier 2 and 3 embedded below the matching bullet
inside the `<details>` block.

## Tier 1 — top gallery

### Done

- [x] **Project log view** — `20260414_project_log_view.png`
      Alt: *Debug output in the log viewer with colored severity markers,
      framework classification, and run navigation*
- [x] **SQL diagnostics** — `20260401_log_viewer_sql.png`
      Alt: *Log viewer showing Drift SQL queries with syntax highlighting and
      diagnostic badges*

### Remaining

- [ ] **Filter drawer open** — `YYYYMMDD_filter_drawer.png`
      Setup: a log with mixed severities and multiple logcat tags. Open the
      filter drawer. Show severity toggles, source tag chips, Log Sources tier
      radios (Flutter DAP / Device / External), and keyword watch chips.
      Alt: *Filter drawer with severity toggles, source tag chips, and Log
      Sources tier radios*
      Why Tier 1: the whole control surface in one frame.

- [ ] **Compare Logs** — `YYYYMMDD_compare_logs.png`
      Setup: run **Compare Logs** on two similar logs where one has extra errors
      or slower SQL. Show the side-by-side view with slow A / B / Δ indicators
      if they fire.
      Alt: *Side-by-side comparison of two logs with slow-query deltas
      highlighted*
      Why Tier 1: readers do not expect a log extension to diff runs.
      **Command title is "Compare Logs"** — the old "Compare Two Sessions"
      wording in this plan was wrong, and "Session" is a banned term in titles.

- [ ] **Debug screenshot capture** — `YYYYMMDD_screenshot_capture.png` — **NEW**
      Setup: a Flutter session where an exception triggered a capture. Show the
      viewer badge, the popover with the captured frame, and the footer counter.
      Alt: *A captured device screenshot shown inline beside the error that
      triggered it*
      Why Tier 1: **this is the strongest differentiator in the product** — no
      other log extension shows you the screen at the moment of the crash. It
      shipped across 9.3.2–9.3.6 and appears nowhere in the README.

## Tier 2 — inline in feature sections

- [ ] **Signals panel** — `YYYYMMDD_signals_panel.png`
      Setup: a log with errors and repeated Drift queries
      (`examples/drift-n-plus-one-sample-lines.txt`). Expand Active Cases, All
      Signals, and Performance so all three are visible.
      **Demoted from Tier 1.** Signals are hidden by default by deliberate
      product decision — the feature stays passive until it proves its value.
      Leading the gallery with a panel most users never enable oversells it.
      Note in the caption that it is opt-in.

- [ ] **Flow map with replay** — `YYYYMMDD_flow_map_replay.png` — **NEW**
      Setup: a session with navigation breadcrumbs. Show the flow map with the
      replay control, and custom breadcrumbs / custom issues if configured.
      Placement: under the flow map bullet.

- [ ] **Status bar menu** — `YYYYMMDD_status_bar_menu.png` — **NEW**
      Setup: click the status bar item to open the menu.
      Placement: near the top, under capture controls. Shipped in 9.3.x, absent
      from the README.

- [ ] **Trouble mode** — `YYYYMMDD_trouble_mode.png` — **NEW**
      Setup: a log opened with `troubleMode.openOnLoad` active, showing the
      configured `troubleMode.levels` filtering to problems only.

- [ ] **Collapsed day groups** — `YYYYMMDD_day_groups.png` — **NEW**
      Setup: the Logs panel with several days of sessions, older days collapsed.

- [ ] **Pop-out on second monitor** — `YYYYMMDD_popout_second_monitor.png`
      Include the detached-window chrome so it is obviously not a panel.

- [ ] **Run navigation (Flutter)** — `YYYYMMDD_run_navigation.png`
      Session bar showing **Run 2 of 4** with run separators below.

- [ ] **Stack trace states** — `YYYYMMDD_stack_trace_states.png`
      Three exceptions in one shot: preview, collapsed, fully expanded.

- [ ] **Search flyout** — `YYYYMMDD_search_flyout.png`
      Ctrl+F with case and regex toggles on, match navigation (N of M).

- [ ] **Error classification badges** — `YYYYMMDD_error_classification.png`
      NullPointerException (CRITICAL), TimeoutException (TRANSIENT), TypeError
      (BUG) with badges visible together.

- [ ] **Options → Integrations** — `YYYYMMDD_integrations_screen.png`
      Adapter categories with descriptions and on/off state.

## Tier 3 — optional, feature-specific

Capture only when time or a nearby edit justifies it.

- [ ] **Spam patterns** — `spamPatterns` suppressing a noisy repeated line — **NEW**
- [ ] **Slow query burst marker** — `examples/drift-slow-burst-sample-lines.txt`
- [ ] **N+1 synthetic signal row** — confidence label plus action buttons
- [ ] **Top SQL Patterns chips** — `examples/sql-fingerprint-guardrails-sample.txt`
- [ ] **Drift SQL repeat collapse** — `examples/drift-repeat-collapse-thresholds.txt`
- [ ] **Inline peek** — double-click expansion showing context
- [ ] **Pin lines and annotations** — pinned bar plus annotation popover
- [ ] **Keyword watch chips** — chips with live counters, one clicked
- [ ] **Lint diagnostic badges** — inline badges on lines with active diagnostics
- [ ] **Line decorations** — timestamps, elapsed, counters, severity dots
- [ ] **Export dialog** — preset templates, or the interactive HTML output
- [ ] **AI Activity stream** — assistant tool calls interleaved with debug
      output. **Do not name the AI tool's brand** in the filename, alt text, or
      caption — write "AI coding assistant".
- [ ] **Explain with AI** — right-click menu plus response panel
- [ ] **Share Investigation** — Gist / `.slc` / deep link / LAN options

## Capture checklist

Before each shot:

- [ ] VS Code at default zoom (Ctrl+0)
- [ ] Theme: **Default Dark Modern**, default editor font and size
- [ ] The viewer lives in the **bottom panel**, not the activity bar — frame it
      accordingly (the old checklist said "activity bar and sidebar visible",
      which was wrong)
- [ ] Sample data from `examples/` — no real paths, tokens, or PII
- [ ] No stray error counts or unsaved-file dots unrelated to the shot
- [ ] Cropped to the relevant panel(s); no large blank space

After each shot:

- [ ] Filename `YYYYMMDD_description.png`, placed in `images/screenshots/`
- [ ] README updated with the
      `raw.githubusercontent.com/saropa/saropa-log-capture/main/images/screenshots/<filename>`
      URL and descriptive alt text
- [ ] Alt text describes what a screen-reader user would otherwise miss — the
      content, not a decorative label
- [ ] CHANGELOG.md entry under the unreleased section
- [ ] Box ticked here

## Open questions

- **Light-theme variants?** Not planned. Dark reads cleanly on both GitHub
  backgrounds and keeps the gallery consistent. Revisit only on a real report.
- **Split Tier 3 into `docs/GALLERY.md`?** Not planned — a second document
  creates two sources of truth and lets Tier 3 shots rot.
- **Animated captures?** Out of scope. A prior GIF plan was already superseded
  by the static-screenshot decision and archived; do not re-propose without a
  new plan.
