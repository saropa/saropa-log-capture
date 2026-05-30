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

---

## Finish Report (2026-05-30)

**Status**: Partial — stable pieces parked on `feat/reports-bucket-and-newer-alert` (commit `2758b480`). Three-file integration glue pending re-application in a fresh session.

### What landed on this branch

5 files, +605 lines, all type-clean, 14 tests passing:

- `bugs/001_plan-newer-alert-and-reports-grouping.md` — this plan.
- `src/modules/session/session-kind-classifier.ts` — pure classifier mapping `(kind | debugAdapterType | header Project | displayName)` → `project | report`. Fail-open: unknowns stay inline as project rows. Compiled regex patterns are cached per payload (callers compile once, builder reuses).
- `src/test/modules/session/session-kind-classifier.test.ts` — 14 tests across rule precedence, invalid-pattern resilience, case-insensitive workspace match, and the fail-open default. All passing via `npm run test:file`.
- `src/ui/viewer-panels/viewer-session-panel-reports-bucket.ts` — webview IIFE-scoped script exporting `getReportsBucketAndBannerScript()`. Provides `renderDayGroup` (partitions project vs report rows), `renderReportsBucket` (per-day collapsible `Reports (N)` row), `renderNewerLogBanner` (sticky top banner). Currently dormant — not yet imported by the panel renderer.
- `src/ui/viewer-styles/viewer-styles-session-newer.ts` — CSS for the bucket heading, sticky banner, and per-row unread dot. Theme-token-driven with sensible fallbacks. Currently dormant — not yet composed into `getSessionPanelStyles()`.

### Why this is partial, not finished

A parallel Claude session was active in this repo while this work was in progress. Evidence: three commits landed mid-session that I did not author (`0cb01fb8 feat(logs-panel): consolidate display options behind kebab menu and add JSON export`, `dd58cda4 feat(bookmarks): smart-bookmark prompt → modal with five actions`, `4ce26f9d fix(viewer): unify list and viewer severity counts via classifyLevel + deferred caching`). The first overlaps heavily with my work area (`viewer-session-panel-*.ts`, `viewer-styles-session*.ts`). My uncommitted edits to three files were repeatedly clobbered by the other session writing stale copies back over them. Three re-applies in this session were each undone within a turn or two.

### What still needs re-applying (three files, ~50 lines total)

Each block is small and self-contained. The plan above (`## Design` section) is the spec; the parked modules in this commit are the executable form. Re-applying:

1. **`src/ui/provider/viewer-provider-actions.ts`** — add the classifier import + `buildClassifierInputs` helper + `classifyMeta` helper + `BuildRecordOptions` bundle type + `unreadSinceFocus` + `kind` fields in the returned record + `getDismissedAt` plumbing on `SessionListPayloadOptions`. Bundle `extras` and `classifier` into one options arg so the function stays under the 4-param lint cap. Also export `LOGS_PANEL_DISMISSED_AT_KEY`.

2. **`src/ui/viewer-panels/viewer-session-panel-rendering.ts`** — `import { getReportsBucketAndBannerScript }` and append it to the returned script string. Inside `renderSessionList`, call `renderNewerLogBanner(sorted)` after the list HTML is set. Inside `renderItem`, add the per-row unread dot inside the icon wrapper next to the existing update dot (gated on `s.unreadSinceFocus && !s.isActive && !s.updatedInLastMinute && !s.updatedSinceViewed` and the `sessionDisplayOptions.newerLogDotEnabled !== false` setting).

3. **`src/ui/viewer-styles/viewer-styles-session.ts`** — `import { getSessionNewerStyles }` and compose it into `getSessionPanelStyles()`.

### Additional edits that did NOT make this commit (deferred along with the glue)

These survived in the working tree as `M` (modified) but were intentionally NOT staged because they reference symbols the glue is supposed to add — landing them without the glue would break the type-check on `main`. They are all small and described in the plan:

- `src/modules/session/session-metadata.ts` — `kind?: 'project' | 'report'` field on `SessionMeta`.
- `src/ui/session/session-history-grouping.ts` — same field on `SessionMetadata`.
- `src/ui/session/session-history-metadata.ts` — `applySidecar` propagates `kind`.
- `src/ui/session/session-display.ts` — `ReportsBucketState`, `reportsBucketState`, `expandedReportBuckets`, `newerLogBannerEnabled`, `newerLogDotEnabled` fields.
- `src/modules/config/config-types.ts` + `src/modules/config/config.ts` — `ReportsClassifierConfig`, `NewerLogAlertConfig` types + reader.
- `package.json` — 4 new settings (`reportsKindPatterns`, `reportsBucketDefault`, `newerLogBanner`, `newerLogDot`).
- `src/extension-activation.ts` — display options seeded from `reportsClassifier.bucketDefault` + `newerLogAlert.{bannerEnabled,dotEnabled}`.
- `src/ui/viewer-panels/viewer-session-panel.ts` — `expandedReportBuckets` IIFE state.
- `src/ui/viewer-panels/viewer-session-panel-events.ts` — bucket-toggle handler + banner-button handler (Open / Dismiss).
- `src/ui/viewer-panels/viewer-session-panel-html.ts` — `<div id="session-newer-banner">` element.
- `src/ui/viewer-styles/viewer-styles-session-list.ts` — extraction pointer comment.
- `src/ui/provider/viewer-handler-wiring.ts` — `getDismissedAt` in `makePayloadOptions`, seeded to activation-time on first install.
- `src/ui/provider/viewer-message-handler-session-ui.ts` — `acknowledgeUnreadLogs` case.
- `src/ui/provider/viewer-provider-helpers.ts` — re-export `LOGS_PANEL_DISMISSED_AT_KEY`.
- `src/l10n/strings-webview.ts` — bucket-label and banner-text keys.

### Quality gates run on the branch HEAD

- `npm run check-types` — clean (zero errors).
- `npm run test:file -- out/test/modules/session/session-kind-classifier.test.js` — 14/14 passing.
- `npm run compile` (run earlier with all glue in place) — all verify steps green (NLS, webview catalog, host outbound catalog, commands list, dist size).

### Resumption notes for the next session

- Pull latest `main` before re-applying. Several `viewer-session-panel-*.ts` files were rewritten by `0cb01fb8` — context-line patches from this session will not apply; re-derive the edits from the plan and the dormant modules in this commit.
- Do NOT amend commit `2758b480`. The integration glue belongs in its own commit so `git log` carries a clean "this is what shipped" record once the feature is fully wired.
- After re-applying, run the standard quality gate: `npm run compile` → `npm run lint` → `npm run test:smoke`. Then add a CHANGELOG entry under the unreleased heading.
- Manual verification per the `## Verification` section above: a day with 1 debug + 3 report captures should render 1 debug row + `Reports (3)` collapsed; a captured log while the panel is unfocused should produce both the banner and the per-row dot.
