# DB_07 N+1 Detector

## Goal
Identify likely N+1 query patterns from repeated SQL fingerprints with varying args in short windows.

## Scope
- In scope: heuristic detection, synthetic insight rows, confidence labeling.
- Out of scope: static code-level ORM analysis.

## Implementation Plan
1. Build sliding window index keyed by SQL fingerprint and timestamp.
2. Detect candidate pattern: high repeat count + varying args + short interval.
3. Emit synthetic insight line with summary and confidence score.
4. Add action to focus related lines/fingerprint chip.

## Detection Heuristic (v1)
- Window: 0.5s to 2s.
- Min repeats: 8+.
- Arg variability: distinct arg count above threshold.

## Test Plan
- Unit: bursty repeated SELECT with changing IDs triggers detection.
- Unit: repeated same args (cache retry) does not trigger high confidence.
- Regression: detector does not block line ingest path.

## Risks
- False positives in legitimate batched reads; expose confidence and easy dismiss.

## Done Criteria
- Viewer surfaces actionable N+1 hints with manageable false-positive rate.

---

## Implementation summary (2026-03-23)

**Shipped in the VS Code log viewer (webview):**

- Canonical thresholds and testable logic: `src/modules/db/drift-n-plus-one-detector.ts` (`NPlusOneDetector`, `parseDriftSqlFingerprint`, `N_PLUS_ONE_EMBED_CONFIG`).
- Embedded runtime: `src/ui/viewer/viewer-data-n-plus-one-script.ts` (must stay aligned with the module).
- Ingest: `viewer-data-add.ts` appends `n-plus-one-insight` rows; wrapped in **try/catch** so malformed lines never break streaming.
- UI: `viewer-script.ts` — **Focus DB** (solo `database` source tag), **Find fingerprint** (populate in-log search).
- Styles: `viewer-styles-n-plus-one-insight.ts`.
- Tests: `src/test/modules/db/drift-n-plus-one-detector.test.ts`, `src/test/ui/viewer-n-plus-one-embed.test.ts`.
- Manual samples: `examples/drift-n-plus-one-sample-lines.txt`.

**Heuristic details:** 2s sliding window, ≥8 repeats, ≥4 distinct `with args` payloads, distinct/repeat ratio ≥0.5, 8s cooldown per fingerprint, map pruning for long sessions (`maxFingerprintsTracked` / `pruneIdleMs`).

**Cooldown implementation:** `lastInsightTs === 0` means “no prior insight”; cooldown applies only when `lastInsightTs > 0`, otherwise the first burst would never fire (`now - 0 < cooldownMs`).
