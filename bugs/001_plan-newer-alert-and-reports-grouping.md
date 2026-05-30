# Plan 001 — Newer-log alert and Reports-vs-Project grouping

## Status: In Progress

## Problem

Two pain points in the Logs panel:

1. **Missed-newer-log**: when a fresh debug session ends and writes a new log
   while the user is reading an older one, the only signal is the `(latest)`
   italic suffix on an individual row. Easy to miss after scrolling. Users
   keep reading the wrong (stale) file.
2. **Project vs auxiliary noise**: per-day rows mix DAP-debug captures
   (e.g. `Contacts` `dart`) with auxiliary report captures
   (`Json Bundle Audit`, `Json Bundle Audit Matrix`, `Json Bundle Translate`,
   `Saropa Lint Report`). Auxiliary entries crowd out the debug sessions the
   user is actively investigating, even with the existing day-grouping.

## Goal

- Make "there is a newer log to look at" impossible to miss without being
  intrusive.
- Auto-separate debug-session captures from report-style captures inside each
  day, so the user can scan the project work at a glance without losing
  access to the reports.

## Design

### Part A — Persistent newer-log alert

Two complementary surfaces:

**A1. Sticky banner** at the top of the Logs panel (above the day list, below
the toolbar). Shown when `unreadSinceFocus > 0`. Format:

```
New log · Contacts dart · just now   [Open]  [Dismiss]
```

If more than one unread log: `New logs · Contacts dart · just now (+3 more)`.
Clicking the row body or `Open` opens the latest unread log; `Dismiss`
clears the unread set. The banner is sticky-positioned so panel-list scroll
does not hide it.

**A2. Per-row unread dot** in the row gutter (same column as the existing
severity bar). Small filled circle in the accent color; tooltip
"Unread — captured after panel last had focus". Clears when the row is
opened. Persists when the banner is dismissed, so the user always has a
visible cue.

**Trigger**: a log is unread when its mtime is greater than the
`lastFocusedAt` timestamp the panel stamps on focus / explicit "Mark all
read". Persisted in `workspaceState` so it survives reloads.

### Part B — Reports vs Project grouping

**B1. Classifier** — new pure function `classifySessionKind(meta, header)`:

| Signal                                                        | Result    |
|---------------------------------------------------------------|-----------|
| `meta.kind === 'report'` or `'project'` (explicit override)   | as-is     |
| `meta.debugAdapterType` is set                                | `project` |
| Header `Project:` matches workspace folder name               | `project` |
| `displayName` matches configured report-name patterns         | `report`  |
| Otherwise                                                     | `project` |

`project` is the fail-open default — anything we can't classify stays
visible inline (never silently bucketed).

Report-name patterns default to a small list that covers the user's
observed cases (`Saropa Lint Report`, `Json Bundle Audit`,
`Json Bundle Audit Matrix`, `Json Bundle Translate`). Configurable via
`saropaLogCapture.reportsKindPatterns` (array of regex strings).

**B2. Render** — under each day heading, render two children:

1. Debug sessions inline (current behaviour).
2. A single collapsed bucket row `Reports (N) · 6:52 AM–9:38 AM` that
   expands to reveal the report rows.

The bucket is rendered when N ≥ 2 OR `alwaysShowReportsBucket` is true.
A single report entry renders inline (no bucket-of-one).

**B3. Toggle** — a new `Reports` chip in the toolbar (next to `Tidy` /
`Days`). Three states: `Show` (default, collapsed-but-visible),
`Hide`, `Expand` (auto-expanded so every report row is inline).

### Part C — Settings

| Setting                                              | Type      | Default      |
|------------------------------------------------------|-----------|--------------|
| `saropaLogCapture.reportsKindPatterns`               | string[]  | see above    |
| `saropaLogCapture.reportsBucketDefault`              | enum      | `collapsed`  |
| `saropaLogCapture.newerLogBanner`                    | boolean   | `true`       |
| `saropaLogCapture.newerLogDot`                       | boolean   | `true`       |

`reportsBucketDefault`: `collapsed` | `expanded` | `hidden`.

### Part D — Metadata extension

Add `kind?: 'project' | 'report'` to `SessionMeta`. Optional — absence
means "let the classifier decide". A future per-session "Treat as project /
Treat as report" context-menu action writes this field.

## Non-goals

- Auto-grouping reports across days. Bucket is per-day.
- Per-provider override UI ("treat the `quality-lint-reader` provider as
  project"). Possible follow-up.
- Re-anchoring banner / unread state across multiple VS Code windows.
- Touching the existing `groupId` machinery — reports bucket and
  session-group are independent dimensions and can coexist (a report can
  still be part of a session-group; it just renders inside that group's
  expanded view).

## Phases / commits

1. **Plan** — this file (this commit).
2. **Classifier + metadata** — `SessionMeta.kind`, `classifySessionKind`,
   pure-function tests.
3. **Reports bucket rendering** — extend `groupSessionGroups` / panel-html
   to emit `report-bucket` tree item; CSS for the collapsible row.
4. **Unread tracking** — `workspaceState`-backed `lastFocusedAt` +
   `markAllRead` + `unreadUris` set; webview broadcast.
5. **Banner + dot** — webview UI consuming the unread state.
6. **Reports toggle chip + settings** — package.json contributions,
   l10n keys, viewer-target wiring.
7. **Tests** — classifier coverage, bucket rendering, unread-state
   transitions.
8. **Quality gates + CHANGELOG**.

## Verification

- Synthetic test data: a day with 1 debug + 3 report captures renders 1
  debug row + `Reports (3)` collapsed.
- Debug-only day: no bucket; rows render exactly as today.
- Report-only day: bucket present unless `Hide`.
- Capture a log while panel is open and unfocused → banner appears at top;
  dot appears on the new row. Focus panel → banner stays until dismissed;
  dot stays until that file is opened.
