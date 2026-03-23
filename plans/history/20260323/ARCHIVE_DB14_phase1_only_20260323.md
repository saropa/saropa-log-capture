# ARCHIVE — DB_14 phase 1 only (historical)

**Not the DB_14 plan.** This file is a **frozen note** from 2026-03-23 describing **only** what shipped in phase 1.

**The real DB_14 document (implemented work + contract):** `plans/DB_14_automatic-root-cause-hints.md`

**Status (frozen):** Phase 1 was complete on that date. Phases 2–3 are also **implemented**; see the file above.

## What shipped (phase 1 only)

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
