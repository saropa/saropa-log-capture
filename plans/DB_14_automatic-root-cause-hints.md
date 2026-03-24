# DB_14 — Automatic root-cause hints

## Is it implemented?

**Yes.** Phases 1–3 are **in the product** (strip + hypotheses bundle, host fields / i18n / bursts / diff / strip AI explain, then command + context menu + compare-driven `sessionDiffSummary`). This file is the **only** DB_14 plan you should follow for behavior and the bundle contract.

**Optional later (not required for “done”):** localize evidence-button titles; extend `package.nls.json` for command strings if you use translation bundles.

**Historical note (not a second plan):** `plans/history/20260323/ARCHIVE_DB14_phase1_only_20260323.md` — old **phase-1-only** write-up from 2026-03-23. Ignore it unless you care what we called “phase 1” on that date.

## Goal

Generate **short, reviewable explanations** that tie together signals (errors, SQL bursts, N+1 hints, fingerprint leaders, Drift Advisor issues, baseline regression) into a few bullet hypotheses—without claiming certainty.

## Read this first

- **Users see** a collapsible **root-cause hypotheses** strip in the log viewer when eligibility rules fire; evidence buttons jump to log lines where indices are still valid; **Explain with AI** (and the command / context menu) reuse the same hypothesis payload and require an explicit gesture.
- **Change hypothesis wording, ordering, caps, or `buildHypotheses` rules** in `src/modules/root-cause-hints/` and the webview embed algorithm — do not fork template strings in the viewer.
- **Add or change bundle inputs** using the [Input bundle](#input-bundle-contract--authoritative) contract: new session-level fields are **optional**; bump **`bundleVersion`** only when semantics of existing keys break.

## Phase 1 (shipped) — summary

| Area | What landed |
| --- | --- |
| **Shared module** | `src/modules/root-cause-hints/` — `RootCauseHintBundle`, `buildHypotheses`, `isRootCauseHintsEligible`, `bundleVersion: 1`, caps (e.g. 5 bullets, 240 chars, 8 evidence ids), tier order, dedup. |
| **Webview strip** | `viewer-root-cause-hints-embed-algorithm.ts`, `viewer-root-cause-hints-script.ts`, `viewer-styles-root-cause-hints.ts`, `#root-cause-hypotheses` in `viewer-content-body.ts`, script injection in `viewer-content-scripts.ts`; refresh on `addLines` / `loadComplete`; `resetRootCauseHypothesesSession` on `clear` in `viewer-script-messages.ts`. |
| **N+1 wiring** | `insightMeta` on synthetic N+1 rows in `viewer-data-add-db-detectors.ts` for bundle assembly. |
| **Live bundle (v1)** | Errors (recent, error level), `nPlusOneHints`, `fingerprintLeaders` from `dbInsightSessionRollup` + sample line; template-only copy; **Hypothesis, not fact** disclaimer; confidence labels; dismiss hides strip until clear; no focus steal. |

Phases 2–3 extend this with host-fed fields, bursts, diff, l10n, AI explain, command/menu, and compare-driven `sessionDiffSummary` (tables below).

## Phase 2 (shipped) — summary

| Area | What landed |
| --- | --- |
| **Localization** | Host posts `setRootCauseHintL10n` with strings from `getRootCauseHintViewerStrings()` (`root-cause-hint-l10n-host.ts`); keys `viewer.rch*` in `strings-a.ts`. Sidebar: `log-viewer-provider-setup.ts`. Pop-out: `pop-out-panel-viewer-config-post.ts`. |
| **Host-fed bundle fields** | `setRootCauseHintHostFields`: `driftAdvisorSummary` from session metadata via `rootCauseDriftSummaryFromSessionIntegrations()` on normal log load (`log-viewer-provider-load-helpers.ts` / `log-viewer-provider-load.ts`); unified JSONL load clears host fields. Optional `sessionDiffSummary.regressionFingerprints` when the host posts it. |
| **Live `sqlBursts`** | Webview `viewer-root-cause-hints-embed-collect.ts` reads `slowBurstBySession` (DB_08) with synthetic fingerprint keys; thresholds aligned with `ROOT_CAUSE_SQL_BURST_MIN_COUNT`. |
| **Session diff (webview)** | Same collect chunk: `collectSessionDiffRegressionFpsEmbedded()` compares `dbInsightSessionRollup` vs `setDbBaselineFingerprintSummary` baseline when host diff is not supplied. |
| **Collapse UX** | Chevron + `sessionStorage` key `saropa-rch-collapsed::<epoch>\|<filename>`; dismiss still clears until next clear/session reset (`viewer-root-cause-hints-script.ts`). |
| **Explain hypotheses (AI)** | Strip button → `explainRootCauseHypotheses` → `viewer-message-handler-root-cause-ai.ts` (same LM path as line explain; user gesture only). |
| **Refresh hooks** | `scheduleRootCauseHypothesesRefresh` after baseline set, host-field patch, l10n, `addLines`, `loadComplete`; `resetRootCauseHypothesesSession` + host clear on viewer `clear` (`viewer-script-messages.ts`). |

## Phase 3 (shipped — polish)

| Item | What landed |
| --- | --- |
| **Command + webview** | `saropaLogCapture.explainRootCauseHypotheses` → `triggerExplainRootCauseHypotheses` → `runTriggerExplainRootCauseHypothesesFromHost` (same payload as strip **Explain with AI**; empty → `explainRootCauseHypothesesEmpty`). |
| **Context menu** | Log line menu: **Explain root-cause hypotheses** (`viewer-context-menu-html.ts` / `viewer-context-menu-actions.ts`). |
| **Session compare → host `sessionDiffSummary`** | Implemented separately: compare flow posts `setRootCauseHintHostFields` with regression fingerprints when applicable (see session comparison + `db-session-fingerprint-diff.ts`). |

**Still optional (not blocking):** deeper **i18n** for evidence button titles; **`package.nls.json`** coverage for any new command title keys you add for translation bundles.

**Do not** bump **`bundleVersion`** unless optional field semantics or required keys change.

### Tests (all phases)

- **Unit (Node):** `src/test/modules/root-cause-hints/build-hypotheses.test.ts` (bundle logic); `root-cause-hint-drift-meta.test.ts` (Drift metadata slice).
- **Viewer embed harness:** `src/test/ui/viewer-n-plus-one-embed.test.ts` (includes root-cause embed wiring).
- **Manual / fixture:** `examples/root-cause-hypotheses-sample.txt`.

There is no separate browser/UI automation suite dedicated to this feature; behavior is covered by the above plus manual QA.

## What to build next (other DB plans — higher leverage)

After DB_14, the open **DB** specs that add new surfaces (not strip polish) are:

| Plan | One-line direction |
| --- | --- |
| **DB_12** (`plans/DB_12_static-orm-code-analysis.md`) | **Partial:** indexer QuickPick from N+1 row; see plan **Progress**. Further: ORM mapping, symbols. |
| **DB_15** (`plans/DB_15_db-detector-framework.md`) | More detectors on the shared framework; keep bundle/embed thresholds in sync when adding signal types. |

## Out of scope (unchanged)

Silent auto-fixes; replacing human triage; guaranteed correctness; uploading session content outside existing AI/consent paths.

## Input bundle (contract — authoritative)

Extend with optional fields only; **do not rename or remove core keys** without incrementing **`bundleVersion`**.

### Versioning

- **`bundleVersion`** on every bundle; `buildHypotheses` rejects unknown versions (still **1**).
- **Consumers:** viewer strip, unit tests, AI explain payload; reuse `src/modules/root-cause-hints/` — do not fork template strings.

### Session-level fields

| Field | Required | Notes |
| --- | --- | --- |
| `bundleVersion` | yes | Bump when key semantics break. |
| `sessionId` | yes | Correlates with trim/reload / collapse key. |
| `errors` | no | Recent error excerpts / line indices (webview). |
| `sqlBursts` | no | **Shipped:** webview from `slowBurstBySession` (DB_08). |
| `nPlusOneHints` | no | N+1 synthetic rows / `insightMeta` (DB_15 / DB_07). |
| `fingerprintLeaders` | no | `dbInsightSessionRollup` + sample line. |
| `driftAdvisorSummary` | no | **Shipped:** host from `meta.integrations['saropa-drift-advisor']`. |
| `sessionDiffSummary` | no | **Shipped:** webview baseline heuristic **or** host post (compare panel optional). |

### Per-hypothesis (`buildHypotheses` output)

- `templateId`, `text`, `evidenceLineIds`, optional `confidence`, `hypothesisKey` (dedup).
- **Evidence UI:** if a line id is invalid after trim/reload, **omit the jump control** and show text only (phase 1); stale anchors are also mitigated by index checks on evidence buttons (see **Risks**).

## Where the bundle is built

- **Webview:** `viewer-root-cause-hints-embed-algorithm.ts` (eligibility + `buildHypothesesEmbedded`) + **`viewer-root-cause-hints-embed-collect.ts`** (`collectRootCauseHintBundleEmbedded`, host globals, bursts, diff).
- **Host:** Drift slice in **`root-cause-hint-drift-meta.ts`**; postMessage types handled in **`viewer-script-messages.ts`**.

## Risks

- LLM hallucination — template-first default; citations only to real lines.
- Stale anchors — mitigated by index checks on evidence buttons; invalid ids after trim → no jump (see **Per-hypothesis** above).

## Related plans

- **DB_08** (slow bursts), **DB_10** (session comparison / fingerprints), history **DB_13** (performance Database tab), **DB_01**, **DB_15**, history **DB_07**.
- Phase 1 historical snapshot: **`plans/history/20260323/ARCHIVE_DB14_phase1_only_20260323.md`**.
