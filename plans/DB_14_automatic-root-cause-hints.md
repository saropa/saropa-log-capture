# DB_14 Automatic root-cause hints

**Status:** **Phase 1 and phase 2 are shipped.** Phase 1 is archived at **`plans/history/20260323/DB_14_automatic-root-cause-hints-phase1.md`**.

This document keeps the **bundle contract**, a **phase 2 implementation map**, **optional follow-ups** (phase 3), and **what to build next** in the DB roadmap.

## Goal

Generate **short, reviewable explanations** that tie together signals (errors, SQL bursts, N+1 hints, fingerprint leaders, Drift Advisor issues, baseline regression) into a few bullet hypotheses—without claiming certainty.

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

**Tests:** `root-cause-hint-drift-meta.test.ts`; embed checks in `viewer-n-plus-one-embed.test.ts`; existing `build-hypotheses.test.ts` for TS bundle logic.

## What to build next (DB_14 optional — phase 3)

Small polish; **not required** to call DB_14 “complete” for product use.

| Item | Notes |
| --- | --- |
| **Command / context menu** | Plan originally mentioned a dedicated **“Explain hypotheses…”** entry; today only the **in-strip** button exists. Add `package.json` command + context contribution mirroring `explainWithAi` if discoverability matters. |
| **Session compare → host `sessionDiffSummary`** | When the user is in **log session comparison** with a computed DB fingerprint diff, post `setRootCauseHintHostFields` with `sessionDiffSummary` so the strip matches the compare panel (avoids relying only on webview baseline rollup). Ties to **`plans/history/20260323/DB_10_session-comparison-db-diff.md`**. |
| **i18n depth** | Strings flow through `t()` → webview map; optional: ensure `package.nls.json` covers new keys if you rely on community translation bundles for those IDs. |
| **Evidence chrome** | “line N” / “Scroll to evidence” titles are still mostly fixed English in the embed; localize if parity with the rest of the strip matters. |

**Do not** bump **`bundleVersion`** unless optional field semantics or required keys change.

## What to build next (other DB plans — higher leverage)

After DB_14, the open **DB** specs that add new surfaces (not strip polish) are:

| Plan | One-line direction |
| --- | --- |
| **DB_12** (`plans/DB_12_static-orm-code-analysis.md`) | Static / indexer path from SQL fingerprints to **likely source** in the repo. |
| **DB_13** (`plans/DB_13_db-performance-dashboard-and-timeline.md`) | **Analytics panel**: time-bucketed DB KPIs, top fingerprints, optional sync with scroll. |
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

## Where the bundle is built

- **Webview:** `viewer-root-cause-hints-embed-algorithm.ts` (eligibility + `buildHypothesesEmbedded`) + **`viewer-root-cause-hints-embed-collect.ts`** (`collectRootCauseHintBundleEmbedded`, host globals, bursts, diff).
- **Host:** Drift slice in **`root-cause-hint-drift-meta.ts`**; postMessage types handled in **`viewer-script-messages.ts`**.

## Evidence links

Invalid line ids after trim → omit jump control (text only) — phase 1.

## Risks

- LLM hallucination — template-first default; citations only to real lines.
- Stale anchors — mitigated by index checks on evidence buttons.

## Related plans

- **DB_08** (slow bursts), **DB_10** (session comparison / fingerprints), **DB_13**, **DB_01**, **DB_15**, history **DB_07**.
- Phase 1 archive: **`plans/history/20260323/DB_14_automatic-root-cause-hints-phase1.md`**.
