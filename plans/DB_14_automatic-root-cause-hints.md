# DB_14 Automatic root-cause hints (phase 2+)

**Phase 1 (template strip + shared `buildHypotheses`):** shipped — archived at **`plans/history/20260323/DB_14_automatic-root-cause-hints-phase1.md`**.

This document tracks **remaining** scope: optional AI handoff, localization, host-fed bundle fields, and richer chrome UX.

## Goal (unchanged)

Generate **short, reviewable explanations** that tie together signals (errors, perf, SQL bursts, N+1 hints) into a few bullet hypotheses—without claiming certainty.

## Remaining scope

| Item | Notes |
| --- | --- |
| **AI explain hypotheses** | User-triggered only: `explainError` / `saropaLogCapture.explainError`, same LM trust and caching as today; pass structured bundle text; never silent background calls. See `plans/history/20260313/023_plan-ai-explain-error.md`. |
| **Webview localization** | Hypotheses title, disclaimer, buttons, confidence labels — align with existing webview string pattern (`l10n` / injected map / nls). |
| **`driftAdvisorSummary` / `sessionDiffSummary` in live bundle** | Inject via host → webview bootstrap/postMessage; `buildHypotheses` already supports templates for drift + session-diff when fields are present. |
| **Collapse vs dismiss** | Plan called for collapsible strip + session collapse state; v1 is **dismiss-to-hide** until clear. Optional: chevron collapse without hiding, or settings key. |

## Out of scope (unchanged)

Silent auto-fixes; replacing human triage; guaranteed correctness; uploading session content outside existing AI/consent paths.

## Input bundle (contract — still authoritative)

Extend with optional fields only; **do not rename or remove core keys** without incrementing **`bundleVersion`**.

### Versioning

- **`bundleVersion`** on every bundle; `buildHypotheses` rejects unknown versions.
- **Consumers:** viewer strip, unit tests, future AI payload; reuse `src/modules/root-cause-hints/` — do not fork template strings.

### Session-level fields

| Field | Required | Notes |
| --- | --- | --- |
| `bundleVersion` | yes | Bump when key semantics break. |
| `sessionId` | yes | Correlates with trim/reload. |
| `errors` | no | Recent error excerpts / ids. |
| `sqlBursts` | no | From **DB_08** when wired into live bundle. |
| `nPlusOneHints` | no | From **DB_15** / N+1 synthetic rows (phase 1). |
| `fingerprintLeaders` | no | Session rollup (phase 1). |
| `driftAdvisorSummary` | no | **Phase 2:** host-injected Drift Advisor snapshot subset. |
| `sessionDiffSummary` | no | **Phase 2:** when **DB_10** active, regression fingerprints etc. |

### Per-hypothesis (`buildHypotheses` output)

- `templateId`, `text`, `evidenceLineIds`, optional `confidence`, `hypothesisKey` (dedup).

## Where the bundle is built

- **Today:** webview assembles phase-1 fields from `allLines` + rollup.
- **Phase 2:** merge host-only slices (`driftAdvisorSummary`, `sessionDiffSummary`) through existing postMessage/bootstrap patterns without duplicating thresholds on the host.

## Evidence links

Invalid line ids after trim → omit jump control (text only) — already implemented in phase 1.

## Implementation plan (remaining)

1. **Localization:** audit webviewer string pipeline; replace hardcoded Hypotheses copy.
2. **Host messages:** define minimal message type(s) to patch optional bundle fields; call `scheduleRootCauseHypothesesRefresh` after apply.
3. **AI v2:** command or context-menu entry “Explain hypotheses…”; build JSON/text payload from current `buildHypotheses` output + bundle.
4. **Collapse UX:** product decision — implement chevron + `sessionStorage` / viewer prefs, or defer.

## Test plan (additions)

- Unit: bundles with `driftAdvisorSummary` / `sessionDiffSummary` produce expected templates (fixtures already valid in TS).
- Integration / manual: host inject message updates strip without duplicating hypotheses.
- AI path: disabled LM → no crash; enabled → user gesture only.

## Risks

- LLM hallucination — keep template-first default; citations only to real lines.
- Stale anchors — already mitigated in phase 1.

## Relation to other work

- **DB_15:** prefer normalized `DbDetectorResult` when expanding bundle sources.
- **DB_08 / DB_10:** wire `sqlBursts` and `sessionDiffSummary` into the **live** collector when those plans land.

## Related plans

- `DB_08`, `DB_10`, `DB_13`, `DB_01`, **`DB_15`**, history **`DB_07`**.
- Phase 1 archive: **`plans/history/20260323/DB_14_automatic-root-cause-hints-phase1.md`**.
