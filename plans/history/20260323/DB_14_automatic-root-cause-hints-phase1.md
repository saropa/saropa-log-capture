# DB_14 Phase 1 — Automatic root-cause hints (shipped)

**Status:** Complete as of 2026-03-23. Remaining DB_14 work lives in **`plans/DB_14_automatic-root-cause-hints.md`** (phase 2+).

## What shipped

- **Shared module:** `src/modules/root-cause-hints/` — `RootCauseHintBundle` / `buildHypotheses` / `isRootCauseHintsEligible`, `bundleVersion: 1`, caps (5 bullets, 240 chars, 8 evidence ids), tier order and dedup.
- **Webview:** `viewer-root-cause-hints-embed-algorithm.ts`, `viewer-root-cause-hints-script.ts`, `viewer-styles-root-cause-hints.ts`, `#root-cause-hypotheses` in `viewer-content-body.ts`, script injection in `viewer-content-scripts.ts`, refresh on `addLines` / `loadComplete`, `resetRootCauseHypothesesSession` on `clear` in `viewer-script-messages.ts`.
- **N+1 wiring:** `insightMeta` on synthetic N+1 rows in `viewer-data-add-db-detectors.ts` for bundle assembly.
- **Live bundle (v1):** Errors (recent, level error), `nPlusOneHints` from synthetic rows, `fingerprintLeaders` from `dbInsightSessionRollup` + sample line index. Template-only text; **Hypothesis, not fact** disclaimer; confidence labels; evidence buttons only for valid line indices; dismiss hides strip until clear.
- **Tests:** `src/test/modules/root-cause-hints/build-hypotheses.test.ts`; embed wiring checks in `src/test/ui/viewer-n-plus-one-embed.test.ts`.
- **QA:** `examples/root-cause-hypotheses-sample.txt`.

## Done criteria (phase 1)

- Noisy DB + error session → ≤ 5 template hypotheses with evidence links within one viewer refresh cycle.
- Weak sessions → no strip (silence default).
- Strip does not steal focus; dismiss works without reload.

## Spec reference (frozen for phase 1)

- Bundle shape, versioning, eligibility rules, ordering/dedup, and evidence-link behavior matched the parent plan at split time; see git history of `DB_14_automatic-root-cause-hints.md` if needed.
