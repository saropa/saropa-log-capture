# Suite API: expose `getDailySummary` from activate() exports

> **Status: Implemented (v9.2.3, 2026-07-16).** `apiVersion: 1` + `getDailySummary`
> added to the existing `SaropaLogCaptureApi` (already returned by `activate()`), not a
> parallel `SaropaSuiteApi`. Types in `src/api-types.ts`; aggregation in
> `src/api-daily-summary.ts` + `src/api-daily-summary-build.ts`; wired in `src/api.ts`;
> data-out contract documented in `src/commands-suite.ts`. Presenter unit tests in
> `src/test/api/daily-summary-build.test.ts`.
>
> **Correction vs. this plan:** the on-disk layout is a single-level `reports/YYYYMMDD/`
> day folder (not `reports/YYYY.MM/YYYY.MM.DD/`), and there is no existing plain-text
> "executive summary for a day" to reuse — the headline is composed directly from the
> aggregated counts + top signal, matching how `flow-map-report.ts` builds its narrative.
> Counts read cached severity totals from `.session-metadata.json`, scanning the log body
> only when a day's cache was never populated. `openCommand` is
> `saropaLogCapture.logViewer.focus` (a real no-arg focus command; the plan's example
> `saropaLogCapture.open` opens only the active session).

Filed from Saropa Workspace (`d:\src\saropa_workspace`,
`plans/TODO_better integration with saropa suite.md`). Workspace is building a
consolidated Suite daily report and needs each Suite tool to expose one small
data-returning API. This plan specifies the Log Capture side; the Workspace
consumer already tolerates the API being absent (section omitted), so there is no
ordering constraint.

## What to build

Return an API object from `activate()` so siblings can call
`vscode.extensions.getExtension('saropa.saropa-log-capture')?.exports`:

```ts
interface SaropaSuiteApi {
  apiVersion: 1;
  getDailySummary(date: string /* YYYY-MM-DD */): Promise<DailySummary | undefined>;
}

interface DailySummary {
  tool: 'saropa-log-capture';
  date: string;                    // echo of the requested day
  headline: string;                // one plain-language sentence for the caller's
                                   // executive summary, reusing the existing
                                   // Executive Summary generation
  counts: Record<string, number>;  // e.g. { sessions, errors, warnings, signals }
  trouble: Array<{                 // failure-only items for the caller's Trouble
    label: string;                 // section (errored sessions, high-impact signals)
    detail?: string;
    command?: string;              // deep-link id, e.g. 'saropaLogCapture.openSignal'
    args?: unknown;
  }>;
  openCommand?: string;            // e.g. 'saropaLogCapture.open' — "Open in Log Capture"
}
```

## Why this shape

- **Thin wrapper, not new logic.** Sessions per day, error/warning/signal counts,
  and the executive summary already exist for the viewer UI and the dated
  `reports/YYYY.MM/YYYY.MM.DD/` store — the API aggregates what one day already
  holds and returns it.
- **The API is the contract.** Without it, a sibling would have to scrape the raw
  `reports/**` log files, coupling to internal formats that are free to change.
  `apiVersion` lets the shape evolve without breaking callers.
- **Same protocol family as `commands-suite.ts`.** The deep-link command ids there
  are the documented never-renamed entry points for jumping IN; this is the
  matching data-out channel. Treat the exported shape with the same
  breaking-change discipline.
- `undefined` for a day with no data — callers omit the section, never error.

## Constraints

- Local read only; nothing transmitted. No new dependencies.
- Must not slow activation: build the summary lazily on call, not eagerly at
  startup.

## Acceptance

- `getExtension('saropa.saropa-log-capture').exports.getDailySummary('2026-07-15')`
  resolves with real counts + headline for a day that has sessions, and
  `undefined` for a day without.
- The exported shape is documented alongside the deep-link protocol in
  `commands-suite.ts` (or its doc) as part of the cross-tool contract.

## Finish Report (2026-07-16)

Shipped in v9.2.3 (unreleased at time of writing). The suite daily-summary API is
implemented and gated green.

### What was built

- **Public API surface** (`src/api-types.ts`): `SaropaLogCaptureApi` — the object already
  returned by `activate()` — gained `apiVersion: 1` and
  `getDailySummary(date): Promise<SaropaDailySummary | undefined>`. Two new payload types,
  `SaropaDailySummary` (`tool`, `date`, `headline`, `counts`, `trouble`, `openCommand`) and
  `SaropaDailyTroubleItem` (`label`, `detail?`, `command?`, `args?`). The existing interface
  was extended rather than a parallel `SaropaSuiteApi` created, per the "extend the existing
  inventory" convention.
- **Aggregation** (`src/api-daily-summary.ts`): parses `YYYY-MM-DD` to a local-time
  half-open day window `[midnight, next-midnight)`; local (not UTC) to match
  `parseSessionDate`, which reads the filename stamp with the local `Date` constructor.
  Lists `.session-metadata.json` entries, filters by filename timestamp (works across day
  subfolders; unparseable names return 0 and drop out), excludes `trashed`, and returns
  `undefined` when the day holds no logs. Sessions are counted logically (files sharing a
  `groupId` collapse to one; ungrouped count once). Signals come from
  `buildSignalsFromMetas(...).allSignals`, which is pre-sorted highest-severity-first, so
  `signals[0]` is the headline's top issue.
- **Presenters** (`src/api-daily-summary-build.ts`): `sumSeverities` prefers each file's
  cached `errorCount`/`warningCount` (V2-cache gate `debugCount !== undefined`) and only
  scans a log body on demand when the cache was never populated; the on-demand scan honors
  the same 25 MiB ceiling as the deferred severity scan so an oversized report cannot blow
  extension-host memory. `buildHeadline` composes literal-English prose (matching
  `flow-map-report.ts`'s narrative style — the codebase's existing executive-summary
  generators are hardcoded English, and vscode.l10n has no plural support) and lists only
  non-zero severities. `buildTrouble` emits critical/high signals (cap 10), each deep-linking
  through `saropaLogCapture.openSignal` with a `${kind}:${fingerprint}` id.
- **Wiring** (`src/api.ts`): `apiVersion: 1` on the object; `getDailySummary` delegates to the
  aggregation module.
- **Contract doc** (`src/commands-suite.ts`): the exported data-out shape is documented beside
  the jump-in deep-link command ids, with the same never-rename discipline.
- **Tests** (`src/test/api/daily-summary-build.test.ts`): 10 cases over `buildHeadline`
  (clean day, singular/plural, zero-severity omission, top-signal) and `buildTrouble`
  (severity filter, deep-link id, detail fallback vs. preference, 10-item cap). All pass in
  the Extension Host.

### Corrections to the original plan

- On-disk layout is single-level `reports/YYYYMMDD/`, not `reports/YYYY.MM/YYYY.MM.DD/`.
- No reusable plain-text day-level executive summary exists (the `renderExecutiveSummary` /
  `formatExecutiveSummary` generators are single-error-scoped and HTML/Markdown); the headline
  is composed directly from the aggregated counts + top signal.
- `openCommand` is `saropaLogCapture.logViewer.focus` (a real no-arg focus command); the plan's
  `saropaLogCapture.open` opens only the active session and is unsuitable as a generic entry point.

### Verification

`npm run compile` passes all 12 gates; `check-types` and `lint` clean; targeted test 10/10.
Runtime end-to-end (a sibling calling `exports.getDailySummary` against a real reports folder)
was not driven — the disk-aggregation path is covered by inspection only, not an integration run.
