# DB_15 DB Detector Framework (Duration and Session-Diff)

## Goal
Provide a **single pipeline** for DB-related detectors that need durations, rolling windows, or cross-session baselines—so **DB_02** stays focused on normalization/noise and individual features do not duplicate state machines.

## Scope
- In scope: detector interface (inputs, outputs, stable ordering), shared window buffers and caps, registration from burst/N+1/future detectors; composition with viewer **ingest** and **trim/recalc** lifecycle.
- Out of scope: specific UI for each detector (those stay in DB_07/DB_08/etc.); implementing every detector inside one file.

## Integration (codebase anchors)
Today, duration-aware DB heuristics run **inside the webview script** on each `addToData` call: repeat collapse, `updateDbInsightRollup`, and `detectNPlusOneInsight` in `src/ui/viewer/viewer-data-add.ts`, with detector state and `parseSqlFingerprint` embedded from `src/ui/viewer/viewer-data-n-plus-one-script.ts`. Normalization and thresholds are shared with the extension host via **DB_02** (`src/modules/db/drift-sql-fingerprint-normalize.ts`) and repeat thresholds (`src/modules/db/drift-db-repeat-thresholds.ts` → config). The TypeScript N+1 feed API in `src/modules/db/drift-n-plus-one-detector.ts` exists for unit tests and documentation of behavior.

**Target placement for this framework**
- **Types and pure logic**: `src/modules/db/` (new small modules + registration), same family as `drift-n-plus-one-detector.ts`.
- **Runtime hook**: the incremental path remains the webview ingest pipeline unless/until a deliberate move computes insights on the host and posts rows (out of scope unless specified). The framework must therefore define a contract that can be implemented **once in TypeScript** and **mirrored in embedded JS** (same pattern as DB_02 embed sync), or generated from a single source later.
- **Rendering**: “results” map to structures the viewer already understands—e.g. synthetic rows (`type: 'n-plus-one-insight'`, `repeat-notification`), `lineItem.dbInsight`, and markers—not a parallel DOM API.

## Data contracts (extension host; embed mirrors behavior)

### `DbDetectorContext` (per ingest event)
Minimal fields so detectors do not re-parse unrelated data:
- `timestampMs`: number (line or logical event time).
- `sessionId`: string | null (when multi-session or compare mode supplies it).
- `sourceTag`, `level`, `plainText` (or pre-trimmed plain): for gating `database` lines.
- `durationMs`: number | undefined (from per-line replay delay when present).
- `sql`: null | `{ fingerprint: string; argsKey: string; sqlSnippet?: string; verb?: string }` — only populated for Drift SQL lines; **fingerprint comes from DB_02 normalization**, not ad hoc parsing in each detector.

Optional compare-mode enrichment (see Session-diff):
- `baselineFingerprintSummary`: read-only map or slice (counts, avg/max duration) for **DB_10**-style diff, not a second live stream.

### `DbDetectorResult` (emitted artifact, not raw HTML)
Keep detectors free of markup; a thin adapter builds viewer rows:
- `kind`: `'synthetic-line' | 'annotate-line' | 'marker' | 'session-rollup-patch'`.
- `detectorId`: string (stable identifier for toggles and logging).
- `stableKey`: string — **idempotency**: same logical insight after trim/recalc must reuse the same key so the pipeline can dedupe (e.g. `` `${detectorId}::${fingerprint}::${windowId}` ``).
- `priority`: number — **ascending run order** (lower numeric value first). On duplicate **`stableKey`**, the **later** result wins, so **higher numeric `priority` wins conflicts** when detectors disagree.
- Payload by kind:
  - **synthetic-line**: `{ type: string; category?: string; performanceFields... }` aligned with existing `allLines` item shapes.
  - **annotate-line**: `{ targetSeq?: number; patch: Partial<LineItem> }` when attaching to an existing row is required.
  - **marker**: `{ category: string; label: string }` (maps to marker injection rules already used by the viewer).
  - **session-rollup-patch**: optional hook for `dbInsight`-style rollups without duplicating rollup maps.

Consumers (embed adapter) apply results in **priority order** and **dedupe by `stableKey`**.

## Lifecycle
1. **Ingest**: for each qualifying line event, invoke registered detectors in stable order; merge results into the same code path that today calls `detectNPlusOneInsight` / rollup updates.
2. **Trim / recalc**: when the viewer drops old lines, **incremental prune** runs: `trimData` calls **`pruneDbDetectorStateAfterTrim(oldestKeptTimestamp)`**, which drops N+1 sliding-window hits older than the oldest retained line (no full replay of the tail in phase 1). Synthetic insight rows already pushed are not removed by trim.
3. **Complexity**: per event, target **O(1)** amortized with **explicit caps** (e.g. max open fingerprints, max hits per window, max registered detectors)—mirror the existing `maxFingerprintsTracked` / prune idle pattern in the N+1 embed. Document worst-case when a cap evicts state.

## Session-diff (DB_10 alignment)
Use a **batch comparison model**, not two interleaved live streams:
- **Ingest path** stays single-session.
- For **compare mode**, build or load **fingerprint summaries** for baseline vs target (as in DB_10: count, avg/max duration, slow count). Detectors that need diff consume `baselineFingerprintSummary` + current session summary on a **second pass** or dedicated **compare** entry point, emitting `DbDetectorResult` items the same as streaming mode.
- Shared **diff math** (deltas, sorting) lives in one module; individual detectors only interpret their slice of the comparison output.

## UX rules
- Detectors **never throw**; failures **log once** (detector id + error) and **disable that detector for the remainder of the viewer session** (in-memory flag; reload clears).
- **Settings**: master toggle **DB insights** via `package.json` configuration + `src/modules/config/config-types.ts` (and nls), persisted in user/workspace settings like other Saropa keys. Per-detector toggles are optional follow-ups using the same pattern.
- Session-disable vs settings-off: if the user disables in settings, detectors do not run; if a detector self-disables after error, respect until webview reload.

## Test plan
- **Unit**: framework invokes two mock detectors in **stable priority order**; lower priority cannot preempt higher for the same `stableKey` (define rule explicitly).
- **Unit**: after **trim**, pruned window state matches spec; **no duplicate** synthetic lines for the same `stableKey`.
- **Regression**: zero detectors registered → behavior matches today (no extra allocations on hot path if implemented as no-op registration array).
- **Integration (lightweight)**: one real detector wired through the adapter (e.g. N+1 migrated or a stub) proves embed + TS contract stay aligned—can extend `src/test/ui/viewer-n-plus-one-embed.test.ts` or add a sibling.

## Risks
- **Over-centralization**: keep each detector in its own small file; framework only orchestrates and types.
- **Embed drift**: any change to TS detector logic requires the same change in embedded script until codegen exists; call this out in PR checklist for DB modules.

## Done criteria
- A new duration- or diff-aware DB insight can be added as a **small detector module** plus registration, without copying window/prune logic and without repeatedly editing unrelated viewer loops.
- Contracts (`DbDetectorContext`, `DbDetectorResult`, `stableKey`, trim behavior) are documented in this plan and reflected in TypeScript types in `src/modules/db/`.

## Status (phase 1 + host compare API)
- **Types / host tests:** `src/modules/db/db-detector-types.ts`, `src/modules/db/db-detector-framework.ts`, `src/modules/db/db-fingerprint-summary.ts`, `src/test/modules/db/db-detector-framework.test.ts`, `src/test/modules/db/db-fingerprint-summary.test.ts`.
- **Batch compare (extension host):** `buildDbFingerprintSummaryFromDetectorContexts`, `mergeDbFingerprintSummaryMaps`, `buildDbFingerprintSummaryDiff`, and **`runDbDetectorsCompare(registry, { baseline, target }, state)`** — detectors may implement optional **`compare(DbDetectorCompareInput)`**; shared **`diff`** is computed once per call. Webview does not invoke compare yet (**DB_10** wires UI + optional `baselineFingerprintSummary` on ingest).
- **Webview:** `src/ui/viewer/viewer-db-detector-framework-script.ts` (registry, `runDbDetectors`, merge, trim prune, clear reset), `viewer-data-add-db-detectors.ts` + `viewer-data-add.ts` (`emitDbLineDetectors`), `viewer-data.ts` (`trimData` → `pruneDbDetectorStateAfterTrim`).
- **Built-in detector:** `db.n-plus-one` (synthetic `n-plus-one-insight` rows). Session rollup (`updateDbInsightRollup` / `dbInsight` on lines) remains **inline** in `addToData`, gated by **`saropaLogCapture.viewerDbInsightsEnabled`**.
- **Follow-ups:** DB_10 viewer compare UI + `baselineFingerprintSummary` on streaming ctx; additional detectors (**DB_08**, etc.); optional `session-rollup-patch` migration for rollup.

## Related plans
- **DB_02**: SQL fingerprint normalization; embed must stay in sync with `drift-sql-fingerprint-normalize.ts`.
- **DB_07 / DB_08**: UI for specific insights (chips, burst markers)—consume framework output, do not own detector state.
- **DB_10**: session comparison and fingerprint summaries—feeds baseline for diff-aware detectors and shared diff engine.
