# DB_08 Slow Query Burst Markers — **implemented** (2026-03-23)

## Shipped summary
- **Detector id** `db.slow-query-burst` runs in the webview DB pipeline (`runDbDetectors`) before N+1; gated by **`viewerDbInsightsEnabled`**.
- **TS source of truth:** `src/modules/db/drift-db-slow-burst-detector.ts` + thresholds in `drift-db-slow-burst-thresholds.ts`; embed mirrors in `viewer-db-detector-framework-script.ts`.
- **Markers:** `applyDbMarkerResults` in `viewer-data-add-db-detectors.ts`; click → `scrollToAnchorSeq` in `viewer-data.ts` / `viewer-script.ts`.
- **Settings:** `saropaLogCapture.viewerSlowBurstSlowQueryMs`, `viewerSlowBurstMinCount`, `viewerSlowBurstWindowMs`, `viewerSlowBurstCooldownMs` (+ NLS).
- **QA sample:** `examples/drift-slow-burst-sample-lines.txt` · **Tests:** `drift-db-slow-burst-detector.test.ts`, embed assertions in `viewer-n-plus-one-embed.test.ts`.

---

# DB_08 Slow Query Burst Markers

## Goal
Add marker rows when a time window contains a burst of slow queries, so users can jump to likely bottleneck moments.

## Scope
- In scope: marker generation, thresholding, integration with existing marker rendering.
- Out of scope: complete performance dashboard; text-only “slow query” heuristics without structured duration (**v1** is duration-gated only).

## Inputs and gating (v1)
- **Slow-query samples** use **`durationMs`** on **`DbDetectorContext`** only (same ingest path as **DB_15**). Lines without `durationMs` are ignored for this detector; **no errors**, **no markers** from those lines.
- **Optional later** (separate follow-up): treat certain plain-text patterns as pseudo-duration or count toward bursts; out of scope for initial ship.
- **Time axis**: use **`timestampMs`** from the same ingest event as the rest of DB detectors (aligned with N+1 / trim lifecycle). Do not mix wall-clock sources that could desync from replay or multi-session ordering.

## Implementation Plan
1. In **`registerDbDetector`** (or dedicated module it calls), maintain a **per-`sessionId`** rolling structure: deque or index of recent **slow** events `(timestampMs, seq or line ref)` where “slow” means `durationMs >= slowQueryMs`.
2. On each qualifying DB ingest line with `durationMs` defined, update the window, then if **count ≥ burstMinCount** within **burstWindowMs**, consider firing.
3. Emit **`DbDetectorResult`** with **`kind: 'marker'`**, **`detectorId`** stable (e.g. `db.slow-query-burst`), merge via **`runDbDetectors`**; respect **`viewerDbInsightsEnabled`**.
4. **Anchor line**: attach the marker to the **line that completes the burst** (the ingest event on which the count first reaches the threshold). That is the default scroll/focus target.
5. **Related lines (v1)**: selecting the marker **scrolls/focuses the anchor line** only. If **DB_15** later extends the marker payload (e.g. optional seq range), expand to highlight the full slow window without changing detector math.

## Thresholds and cooldown
- **Defaults (v1)** — slow cutoff **50ms**, burst **5+** slow queries within **2s** (`burstWindowMs`).
- **Config**: expose the same knobs via viewer/db config using the same patterns as repeat thresholds (**DB_04** / `drift-db-repeat-thresholds`-style), so environments can raise cutoff without code changes.
- **Cooldown**: **per `sessionId`**, after emitting a marker, suppress further emits until **`timestampMs` advances by `cooldownMs`** (suggest **10s** log time default). Prevents sustained bursts from flooding markers; each new cooldown window can produce at most one marker until time moves on.
- **`stableKey`**: idempotent per logical burst, e.g. `` `${detectorId}::${sessionId ?? 'default'}::${windowStartMs}` `` where **`windowStartMs`** is **`timestampMs` of the oldest slow query still inside the window** at fire time (so trim/replay that preserves the same tail collapses to one key). If that collides after trim prunes state, prefer a new burst over silent dedupe failure (document in implementation).

## Interaction with N+1 (**DB_07**)
- **No suppression in v1**: a burst of slow queries may coincide with an N+1 synthetic row. Use a **distinct marker label** (e.g. “Slow query burst”) so the two signals are distinguishable; revisit suppression only if user feedback says it is noisy.

## Test Plan
- Unit: first time the window crosses the burst threshold → **exactly one** marker (correct `stableKey`, cooldown starts).
- Unit: many slow lines in one long burst → **at most one marker per cooldown interval** (no flood).
- Unit: lines with **no** `durationMs` → detector does not throw and emits nothing for those lines.
- Regression: marker rows remain excluded from source/class/sql filters (same rules as other DB markers).

## Risks
- Many captures lack duration metadata; the feature will **often be inactive** — acceptable for v1; document in release notes.
- **`timestampMs` gaps or non-monotonic** streams could skew windows; rely on the same guarantees as other rolling-window DB detectors; add a test if the pipeline allows regressions here.

## Done Criteria
- Sessions whose DB lines include **duration** and a **slow cluster** show a clear burst marker and focus the completing line on selection.

## Related plans
- **DB_13** (dashboard), **DB_14** (hypotheses bundle), **DB_15** (detector registration + marker results), **DB_02**, **DB_04**, **DB_07**.
