# DB_15 DB Detector Framework (Duration and Session-Diff)

## How to read this doc
- **Implementing or extending detectors:** follow **Goal** through **Done criteria** for contracts, lifecycle, and tests; use **Status** only as a file index when you need exact symbols and paths.
- **Checking what shipped (phase 1):** jump to **Status (phase 1 — complete)** and **Related plans**.

## Goal
Provide a **single pipeline** for DB-related detectors that need durations, rolling windows, or cross-session baselines—so **DB_02** stays focused on normalization/noise and individual features do not duplicate state machines.

## Scope
- In scope: detector interface (inputs, outputs, stable ordering), shared window buffers and caps, registration from burst/N+1/future detectors; composition with viewer **ingest** and **trim/recalc** lifecycle.
- Out of scope: specific UI for each detector (those stay in DB_07/DB_08/etc.); implementing every detector inside one file.

## Integration (codebase anchors)

**Ingest flow** (per `addToData` call in `viewer-data-add.ts`):

1. **Repeat collapse** runs (where applicable).
2. **`parseSqlFingerprint`** runs once per line (Drift SQL normalization).
3. **`emitDbLineDetectors`** (`viewer-data-add-db-detectors.ts`) applies the primary **`session-rollup-patch`** (`db.ingest-rollup`).
4. **`runDbDetectors`** (`viewer-db-detector-framework-script.ts`) runs registered detectors: slow burst, N+1, **`annotate-line`**, and further rollup patches.
5. **`lineItem.dbInsight`** is set from **`peekDbInsightRollup`** inside that pipeline—not via a separate inline call in `addToData`.

**Shared modules:** normalization and thresholds are shared with the extension host via **DB_02** (`drift-sql-fingerprint-normalize.ts`) and repeat thresholds (`drift-db-repeat-thresholds.ts` → config). The TypeScript N+1 feed in `drift-n-plus-one-detector.ts` mirrors embed behavior for unit tests.

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
- `priority`: number — **ascending run order** (lower numeric value first). **Duplicate `stableKey`:** detector outputs are concatenated in **ascending `priority`** (low first, high last); `mergeDbDetectorResultsByStableKey` scans that list and **keeps the last occurrence per key**, so **higher `priority` wins** when detectors disagree. If two detectors share the same numeric `priority` and the same `stableKey`, **whichever appears later in the merged input list wins** (see `mergeDbDetectorResultsByStableKey` in `db-detector-framework.ts`).
- Payload by kind:
  - **synthetic-line**: `{ type: string; category?: string; performanceFields... }` aligned with existing `allLines` item shapes.
  - **annotate-line**: `{ targetSeq: number; patch: Record<string, unknown> }` — embed shallow-merges `patch` onto `allLines` item with matching `seq`; adjusts `totalHeight` if `height` changes.
  - **marker**: `{ category: string; label: string }` (maps to marker injection rules already used by the viewer).
  - **session-rollup-patch**: hook for `dbInsight`-style rollups (primary ingest uses `db.ingest-rollup` before `runDbDetectors`).

Consumers (embed adapter) apply results in **phases** after **`mergeDbDetectorResultsByStableKey`**: all **`session-rollup-patch`**, then **`annotate-line`**, then **`synthetic-line`**, then **`marker`** — **ascending `priority` within each phase** (preserves N+1-before-burst ordering).

## Lifecycle
1. **Ingest**: for each qualifying line event, invoke registered detectors in stable order; merge results into the same code path that today calls `detectNPlusOneInsight` / rollup updates.
2. **Trim / recalc**: when the viewer drops old lines, **incremental prune** runs: `trimData` calls **`pruneDbDetectorStateAfterTrim(oldestKeptTimestamp)`**, which drops N+1 sliding-window hits older than the oldest retained line (no full replay of the tail in phase 1). **Synthetic insight rows already in `allLines` are not removed by trim**—they can refer to log lines that are no longer present until the user clears/reloads the viewer; detectors should use **`stableKey`** so re-ingest after trim does not multiply duplicates.
3. **Complexity**: per event, target **O(1)** amortized with **explicit caps**—mirror the existing prune-idle pattern in the N+1 embed.

   **Shipped caps:**

   | Detector | Cap | Default | Eviction |
   |---|---|---|---|
   | N+1 | `maxFingerprintsTracked` | 64 | Prune entries idle > `pruneIdleMs` (30 s), then LRU evict until at cap |
   | N+1 | `cooldownMs` | 8 000 ms | Suppresses duplicate insight rows per fingerprint |
   | Slow burst | `burstMinCount` | 5 | Minimum slow queries in `burstWindowMs` (2 s) to emit a marker |
   | Slow burst | `cooldownMs` | 10 000 ms | Suppresses repeat markers for same session |
   | Session diff | `SESSION_DB_FP_COMPARE_MAX_ROWS` | 60 | Truncates diff table rows |
   | Baseline vol. | `MAX_RESULTS` | 40 | Caps batch compare markers |
   | Persistence | `MAX_PERSISTED_FINGERPRINTS` | 500 | Trims persisted fingerprint store |

   Worst-case: when a cap evicts state, the detector may miss an insight that would have fired if the evicted fingerprint reappears. This is acceptable—long-tail fingerprints are low-signal.

4. **`annotate-line` with trimmed `targetSeq`**: if `targetSeq` no longer exists in `allLines` (e.g. the line was trimmed), the patch is a **silent no-op**—no error, no warning, `totalHeight` unchanged. This is by design: synthetic insight rows survive trim and may reference trimmed log lines, so stale patches must not throw or corrupt state.

## Session-diff (DB_10 alignment)
Use a **batch comparison model**, not two interleaved live streams:
- **Ingest path** stays single-session.
- For **compare mode**, build or load **fingerprint summaries** for baseline vs target (as in DB_10: count, avg/max duration, slow count). Detectors that need diff consume `baselineFingerprintSummary` + current session summary on a **second pass** or dedicated **compare** entry point, emitting `DbDetectorResult` items the same as streaming mode.
- **Shipped:** the host can push a baseline fingerprint map into the viewer (**`setDbBaselineFingerprintSummary`**); **`emitDbLineDetectors`** maps it onto **`DbDetectorContext.baselineFingerprintSummary`** for streaming detectors. The **log comparison panel** diff table uses **`compareLogSessionsWithDbFingerprints`** / **`db-session-fingerprint-diff.ts`**, not the embed.
- Shared **diff math** (deltas, sorting) lives in one module; individual detectors only interpret their slice of the comparison output.
- **`runDbDetectorsCompare`** (optional per-detector **`compare()`** hooks) remains an **extension-host** API for batch work and tests; the embed does not invoke it.

## UX rules
- Detectors **never throw**; failures **log once** to the output channel (detector id + error) and **disable that detector for the remainder of the viewer session** (in-memory flag; reload clears). The log message should name the disabled detector so the user can diagnose the issue.
- **Settings**: global toggle **DB insights** via `package.json` configuration + `src/modules/config/config-types.ts` (and nls), persisted in user/workspace settings like other Saropa keys. **Per-detector keys** shipped in phase 1 are listed under **Shipped follow-ups** in **Status** (e.g. `viewerDbDetectorNPlusOneEnabled`, `viewerDbDetectorSlowBurstEnabled`, `viewerDbDetectorBaselineHintsEnabled`).
- Session-disable vs settings-off: if the user disables in settings, detectors do not run; if a detector self-disables after error, respect until webview reload.

## Test plan
Minimum expectations below; **phase 1** also added the VM and module tests listed in **Status** (`viewer-db-detector-annotate-line.test.ts`, fingerprint summary tests, etc.)—treat **Status** as the full inventory when auditing coverage.

- **Unit**: framework invokes two mock detectors in **stable priority order**; for the same `stableKey`, **higher `priority` wins** (lower priority cannot preempt higher).
- **Unit**: after **trim**, pruned window state matches spec; **no duplicate** synthetic lines for the same `stableKey`.
- **Regression**: zero detectors registered → behavior matches today (no extra allocations on hot path if implemented as no-op registration array).
- **Integration (lightweight)**: one real detector wired through the adapter (e.g. N+1 migrated or a stub) proves embed + TS contract stay aligned—extend `src/test/ui/viewer-n-plus-one-embed.test.ts` or add a sibling (see **Status** for what is already wired).

## Risks
- **Over-centralization**: keep each detector in its own small file; framework only orchestrates and types.
- **Embed drift**: any change to TS detector logic requires the same change in embedded script until codegen exists; call this out in PR checklist for DB modules.

## Done criteria
- A new duration- or diff-aware DB insight can be added as a **small detector module** plus registration, without copying window/prune logic and without repeatedly editing unrelated viewer loops.
- Contracts (`DbDetectorContext`, `DbDetectorResult`, `stableKey`, trim behavior) are documented in this plan and reflected in TypeScript types in `src/modules/db/`.

## Status (phase 1 — **complete**)
Phase 1 meets the **done criteria** above: contracts in `src/modules/db/`, embed mirror, ingest + trim hooks, N+1 and slow-burst markers through the registry, host **`runDbDetectorsCompare`**, and streaming **`baselineFingerprintSummary`** when the host sets a SQL baseline.

- **Types / host tests:** `db-detector-types.ts`, `db-detector-framework.ts`, `db-fingerprint-summary.ts`, `db-detector-framework.test.ts`, `db-fingerprint-summary.test.ts`.
- **Batch compare (extension host only):** `buildDbFingerprintSummaryFromDetectorContexts`, `mergeDbFingerprintSummaryMaps`, `buildDbFingerprintSummaryDiff`, **`runDbDetectorsCompare(registry, { baseline, target }, state)`** — optional per-detector **`compare(DbDetectorCompareInput)`**; shared **`diff`** once per call. Used from tests / host; **not** called from the comparison webview (that path uses **`diff-engine.ts`** + **`db-session-fingerprint-diff.ts`**).
- **Webview:** `viewer-db-detector-framework-script.ts` (registry, `runDbDetectors`, merge, trim prune, clear), `viewer-data-add-db-detectors.ts` + `viewer-data-add.ts` (`emitDbLineDetectors`), `viewer-data.ts` (`trimData` → `pruneDbDetectorStateAfterTrim`).
- **Built-in detectors:** **`db.n-plus-one`** (synthetic insight rows); **slow query burst** (**DB_08**) via **`marker`** results and **`applyDbMarkerResults`** in `viewer-data-add-db-detectors.ts`.
- **Primary rollup (ingest):** `emitDbLineDetectors` applies a synthetic **`session-rollup-patch`** (`db.ingest-rollup`) before **`runDbDetectors`**, then sets **`lineItem.dbInsight`** from **`peekDbInsightRollup`** when applicable — `addToData` no longer calls **`updateDbInsightRollup`** directly. Additional patches from detectors apply in **priority order** with **`annotate-line`**, synthetic rows, and markers.
- **Shipped follow-ups:** per-detector settings **`viewerDbDetectorNPlusOneEnabled`**, **`viewerDbDetectorSlowBurstEnabled`**, **`viewerDbDetectorBaselineHintsEnabled`**; streaming baseline volume marker **`db.baseline-volume-hint`**; host **`createBaselineVolumeCompareDetector`** (`compare()` markers for batch use); **`slowQueryCount`** on fingerprint summaries (scan uses **`viewerSlowBurstSlowQueryMs`**); log comparison table shows slow columns when stats exist; embed applies **`annotate-line`** (shallow patch by **`targetSeq`**).
- **Host helpers:** **`applyDbAnnotateLineResultToLineItems`** / **`applyDbAnnotateLineResultsToLineItems`** in **`db-detector-framework.ts`** apply **`annotate-line`** to mutable line arrays when passed as **`annotateTargetLines`** on **`runDbDetectorsCompare`** / **`runDefaultSessionDbCompareDetectors`**. **`compareLogSessionsWithDbFingerprints`** runs **`runDefaultSessionDbCompareDetectors`** and passes results to the session comparison webview (**Detector highlights** list for batch markers).
- **VM tests:** **`src/test/ui/viewer-db-detector-annotate-line.test.ts`** exercises detector-driven **`annotate-line`**, unknown-seq no-op, and height **`totalHeight`** adjustment.
- **Snippet helper:** **`driftSqlSnippetFromPlain`** in **`viewer-data-n-plus-one-script.ts`** centralizes Drift fallback snippet text for **`dbInsight`**.
- **Embed merge codegen:** `mergeDbDetectorResultsByStableKey` lives in **`db-detector-merge-stable-key.ts`**; **`npm run generate:db-detector-embed-merge`** (esbuild) writes **`src/ui/viewer/generated/db-detector-embed-merge.generated.ts`**, which **`viewer-db-detector-framework-script.ts`** splices into the embed. **`npm run compile`** runs codegen first. VM parity test in **`db-detector-framework.test.ts`** still validates embed vs host.

## Related plans
- **DB_02** (`plans/history/20260323/DB_02_db-noise-guardrails.md`): SQL fingerprint normalization; embed must stay in sync with `drift-sql-fingerprint-normalize.ts`.
- **DB_07** (`plans/history/20260323/DB_07_n-plus-one-detector.md`) / **DB_08** (`plans/history/20260323/DB_08_slow-query-burst-markers.md`): UI for specific insights (chips, burst markers)—consume framework output, do not own detector state.
- **DB_10** (`plans/history/20260323/DB_10_session-comparison-db-diff.md`): session comparison and fingerprint summaries—feeds baseline for diff-aware detectors and shared diff engine.
