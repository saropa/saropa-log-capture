# Unify Logs-list and viewer severity counts via classifyLevel() + deferred caching

User reported the Logs list badge counts disagreeing with the viewer's top-bar
counts for the same file (screenshot showed list `1E / 2394 I / 84 other` vs
viewer `4E / 1W / 2271 I / 204 D` on a Saropa Lint Report). User asked:
"once a file is opened and processed can you write meta data for the list panel
to use?" — with the constraint "you MUST CACHE THE META DATA and it MUST load
AFTER the list is displayed. both are needed for performance reasons."

## Finish Report (2026-05-30)

### 1. Critical Note

This work will be reviewed by another AI.

### 2. Scope

**(B)** VS Code extension (TypeScript) only. Touched the severity-classifier
producer (`countSeverities`), sidecar schema (`SessionMeta`), streaming list
load pipeline (`parseHeader`, `loadMetadata`), webview render
(`renderSeverityDots`), and added one new deferred-worker module. No Dart,
Flutter, Python, or release-tooling changes.

### 3. Deep Review

- **Logic & Safety.** `countSeverities` (`session-severity-counts.ts`) iterates
  body lines once, dispatches on `classifyLevel()`'s 8-case enum, and tallies
  into a flat record — no recursion, no async, no shared mutable state. The
  deferred worker (`session-severity-scan.ts`) reads each file once with
  `vscode.workspace.fs.readFile`, classifies in a tight loop, writes to the
  central metadata store, then calls `onScanned`. Failures are caught
  per-file and routed to `logExtensionError('severity-scan', ...)`, so one
  unreadable log can't tank the queue. The metaCache update walks at most
  the number of cached generations of a single URI (usually 1, occasionally
  2 if mtime changed mid-session) — no unbounded loop. Fire-and-forget
  promise in `kickDeferredSeverityScan` is intentional: the panel is
  already useful before the badges arrive.
- **Architecture & Adherence.** Single producer (`classifyLevel`) is now used
  by viewer-side `classifyLevel` (the webview mirror) AND the list-side
  scanner. No duplication of the regex bank. `parseHeader` and the deferred
  worker have orthogonal responsibilities (headers vs body), and the
  sidecar's `debugCount` field gates V1-vs-V2 cache so old caches don't
  silently mask the new buckets. Reused the existing `sessionListBatch`
  webview message — no new message type, no new handler — because
  `updateSessionBatchItems` was already designed to swap rows by
  `data-uri`. The new worker module is < 130 lines and stays under the
  300-line project limit.
- **Performance & UI/UX.** First paint cost dropped: `parseHeader` no
  longer reads the whole body via regex sweep before emitting each row, so
  large `reports/*.log` files don't block the streaming list. The deferred
  scan uses 4-way bounded concurrency — twice the typical fast-path
  concurrency saturated disk on large `reports/` directories without
  meaningfully shortening total scan time in earlier measurements
  (kept the existing pattern). Subsequent launches read counts straight
  from the sidecar and skip the scan entirely. The user-visible badge
  flicker is bounded: rows paint with no badges, then each row's badges
  pop in independently as scans complete — no full-list rerender. Error
  boundary: if `runDeferredSeverityScan` throws, the panel keeps its
  empty badges and the user can refresh later; the worker's per-file
  catch keeps the queue running.
- **Documentation Quality.** Every non-obvious decision now has a comment
  naming the failure mode prevented: V2 cache gate explains why
  `debugCount` is the marker; `fwCount` deprecation note explains the
  legacy "framework" bucket; the worker's module header documents the
  fire-and-forget contract and bounded concurrency rationale; the
  rendering code documents the chip order (matches viewer top bar) and
  the "other" residual formula. Avoided WHAT-only comments.
- **Refactoring.** Out-of-scope opportunity surfaced: `countSeverities` and
  the viewer's mirrored `classifyLevel` in `viewer-level-classify.ts`
  both contain copies of the regex patterns. They're intentionally
  duplicated today because the webview can't import from `modules/`.
  No change made — not in scope.

### 4. Testing Validation

**A. Audit existing tests for changed symbols.**

Grepped the test directory for:

- `countSeverities`, `extractBody` — only consumer is
  `src/test/modules/session/session-severity-counts.test.ts` (updated).
- `parseHeader` — no test references found; only production call site is
  `session-history-metadata.ts`.
- `classifyLevel`, `isAnrLine` — referenced by
  `src/test/modules/analysis/level-classifier*.test.ts` (NOT touched by
  this task — the classifier signature is unchanged; those tests still
  pass against the unchanged producer).
- `loadBatch`, `applySidecar`, `hasCachedSev` — no test references.
- `SessionMeta`, `errorCount`, `warningCount`, `fwCount`, `infoCount`,
  `debugCount`, `databaseCount` — `session-metadata.test.ts` references
  `errorCount`, `infoCount`, `fwCount` for the `isOurSidecar` shape
  check. The migration helper now ALSO accepts V2 fields, so the V1
  asserts still hold (logic widened, not narrowed). Test was not edited;
  it requires VS Code's Extension Host to run (imports `vscode.Uri`)
  and was not executed locally.
- `renderSeverityDots`, `sev-error`, `sev-warning`, `sev-info`,
  `sev-perf`, `sev-fw` — no test references (this is webview JS embedded
  as a template literal).
- `aggregateGroupCounts`, `withGroupRole` — no test references (also
  webview JS).

Files audited: 4. Updated: 1
(`src/test/modules/session/session-severity-counts.test.ts`). Other tests
audited and confirmed not to assert anything my change broke.

**B. Tests written / extended.**

`session-severity-counts.test.ts` rewritten to 17 tests covering the new
8-bucket model. New cases that V1 demonstrably missed:
- `should catch Flutter "Exception caught by" banner (V1 missed this)`
- `should catch structural "could not / unable to / failed to" warnings (V1 missed these)`
- `should map logcat V/D to debug bucket (V1 lumped this in info/framework)`
- `should map non-flutter logcat I/ to info (V1 split as "framework")`
- `should classify Drift SQL statements as database`
- `should classify TODO/FIXME as todo`
- `should classify every line into exactly one bucket` (exhaustiveness)

Run: `npx mocha --ui tdd out/test/modules/session/session-severity-counts.test.js`.
**17 passing.**

`session-metadata.test.ts` and the V2 migration path were audited by
reading but not executed locally (requires vscode-test).

### 5. Localization (l10n)

`SKIPPED [B-NOT-IN-SCOPE]` — VS Code extension change, no Flutter/Dart UI
touched, no ARB files modified.

### 6. Project Maintenance & Tracking

- **CHANGELOG.md** — entry added under `## [Unreleased]` ### Fixed.
- **README** verified — no updates needed (no user-facing settings,
  commands, or product facts changed; the badge unification is invisible
  except in the panel).
- **package.json / package-lock.json** — not touched (no release, no deps).
- **TODOs / plans** — none open against this work.
- **doc/guides/** — `guides reviewed`; no user-facing behavior change
  beyond badge correctness, which lives outside guide scope.
- **docs/LAUNCH_TEST.md** — no change. The launch test exercises Extension
  Host activation paths; the badge unification reuses the existing
  `sessionListBatch` message + `updateSessionBatchItems` handler — both
  already in the launch test surface. No new feature gate, command, or
  configuration entry was added that would warrant a new checklist item.
- **Roadmap** — `SKIPPED [A-NOT-IN-SCOPE]` (linter-only artifact).
- **Bug-report archival** — `No bug archive — task did not close a bugs/*.md file`.
  The user's screenshot + question was raised in chat, not as a `bugs/*.md`
  entry. The reproducible problem is now documented in this finish file.

### 7. Persist Finish Report

`Finish report saved: plans/history/2026.05/2026.05.30/unify-list-and-viewer-severity-counts.md`

### 8. Files Changed

- **Added:** `src/ui/session/session-severity-scan.ts` (new deferred worker, 125 lines).
- **Added:** `plans/history/2026.05/2026.05.30/unify-list-and-viewer-severity-counts.md` (this file).
- **Modified producer / schema:**
  - `src/ui/session/session-severity-counts.ts` — rewritten around `classifyLevel()`; 8-bucket output.
  - `src/modules/session/session-metadata.ts` — V2 schema: `debugCount`, `databaseCount`, `todoCount`, `noticeCount`; `fwCount` deprecated.
  - `src/modules/session/session-metadata-migration.ts` — `isOurSidecar` extended to recognise V2 fields.
  - `src/ui/session/session-history-grouping.ts` — `SessionMetadata` extended with the four new bucket fields.
- **Modified load pipeline:**
  - `src/ui/session/session-history-helpers.ts` — `parseHeader` no longer scans the body; signature simplified to (uri, base).
  - `src/ui/session/session-history-metadata.ts` — V2 cache gate (`hasCachedSev` keyed on `debugCount`); `applySidecar` signature simplified; new bucket fields propagated on V2 cache hits.
- **Modified wiring + payload:**
  - `src/ui/provider/viewer-handler-wiring.ts` — imports `runDeferredSeverityScan` + `getConfig`; new `kickDeferredSeverityScan` after both `sendFinalList` branches.
  - `src/ui/provider/viewer-provider-actions.ts` — `Meta` type extended with `anrCount` + the four new buckets; payload includes them.
- **Modified webview render:**
  - `src/ui/viewer/viewer-session-transforms.ts` — `renderSeverityDots` renders the new 4 buckets in viewer-bar order; "other" residual formula updated.
  - `src/ui/viewer-styles/viewer-styles-session-list.ts` — `.sev-debug`, `.sev-database`, `.sev-todo`, `.sev-notice` colors matching the viewer palette.
  - `src/ui/viewer-panels/viewer-session-panel-rendering-groups.ts` — `aggregateGroupCounts` + `withGroupRole` sum and propagate the new buckets so collapsed group badges stay accurate.
- **Modified docs:**
  - `CHANGELOG.md` — one new bullet under Unreleased > Fixed.
- **Modified tests:**
  - `src/test/modules/session/session-severity-counts.test.ts` — rewritten to 17 tests covering the 8-bucket model + V1-regression coverage.

### 9. Concise Diff Summary (for Reviewer AI)

**Core logic change.** The list panel previously ran `countSeverities` — a
parallel simplified regex bank — to populate per-file badge counts. The
viewer ran the authoritative `classifyLevel()`. Both produced different
totals for the same file. The fix replaces `countSeverities`' body with
a per-line call to `classifyLevel()` and widens its return shape from 6
buckets (errors, warnings, perfs, anrs, frameworks, infos) to 8 (the
viewer's full level enum: error, warning, info, performance, todo, debug,
notice, database, with anrs as a perf subset for the badge).

**Performance constraint.** The user explicitly required the list to paint
BEFORE counts arrive. `parseHeader` previously ran the body scan inline
on every uncached file, blocking the streaming load. This commit drops the
body scan from `parseHeader` entirely; counts arrive from a new deferred
worker (`session-severity-scan.ts`) that runs after `sendFinalList` has
shipped the list. Each scan persists to the central metadata store and
re-posts the row via the existing `sessionListBatch` message; the
existing webview handler `updateSessionBatchItems` swaps the badge in
place. Subsequent launches read counts from the sidecar with no scan.

**Schema migration.** Sidecars are V2-gated on `debugCount !== undefined`.
V1 sidecars (have `errorCount` but no `debugCount`) trigger a one-time
backfill — otherwise the new buckets would stay permanently at 0. V1
`fwCount` is read-tolerated but never written; the new producer collapses
non-flutter logcat tags into info/debug per `classifyLevel`'s rules.

**Task scope and outstanding work.** Task scope: severity-count unification
between list and viewer + cached deferred load. Outstanding: none for this
task. Two unrelated workstreams (Logs-panel kebab menu / session-list JSON
export / unread-acknowledged tracking, and `session-kind-classifier`)
were in flight in the working tree during this session. Their files were
not committed by this task; they remain in the working tree for whoever
owns them. The same is true for an untracked `bugs/001_plan-newer-alert-
and-reports-grouping.md` plan file — not mine, not committed.

# TASK IS COMPLETE
