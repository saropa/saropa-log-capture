# DB_14 Automatic Root-Cause Hints

## Goal
Generate **short, reviewable explanations** that tie together signals (errors, perf, SQL bursts, N+1 hints) into a few bullet hypotheses—without claiming certainty.

## Scope
- In scope: rule-based narrative snippets; optional LLM-assisted text **only** behind the same explicit user action and settings as today’s AI explain flow; user-visible **Hypotheses** block with confidence/disclaimers.
- Out of scope: silent auto-fixes; replacing human triage; guaranteed correctness; uploading session content without the user’s existing AI/consent path.

## Relation to other work
- **`DB_15` (detector framework):** Phase 1 is **shipped** (`db-detector-types.ts`, webview registry, **`db.n-plus-one`**). Prefer consuming **normalized `DbDetectorResult`** (or a small reducer over recent results) for N+1 and future burst/marker detectors so this plan does not duplicate detector state. v1 may still read **inline** signals where results are not yet exposed to the host; tighten the bundle builder as **`DB_08`** and others register detectors.
- **`DB_08` / history `DB_07`:** Event sources for burst markers and N+1-style hints in the bundle (after **`DB_08`** lands on **`DB_15`**).

## Input bundle (minimal contract)
Stable enough for templates, tests, and optional AI handoff. Extend with optional fields only; **do not rename or remove core keys** without incrementing **`bundleVersion`** (see below).

### Versioning and consumers
- Add **`bundleVersion`** (number) on every bundle. **`buildHypotheses`** and any AI handoff should branch or reject unknown versions explicitly.
- **Consumers today:** viewer webview (strip UI + jump-to-line), **unit tests** (fixtures), optional v2 **AI explain** payload. If the host later needs the same text, reuse the shared module—do not fork template strings.

### Bundle shape (conceptual)
Session-level fields sit on the bundle; each output row is a **`Hypothesis`** with its own evidence anchors.

- **`RootCauseHintBundle`:** `bundleVersion`, `sessionId`, plus optional **`errors`**, **`sqlBursts`**, **`nPlusOneHints`**, **`fingerprintLeaders`**, **`driftAdvisorSummary`**, **`sessionDiffSummary`** (same semantics as the table below).
- **`Hypothesis`** (output of `buildHypotheses`): `templateId` (for tests and telemetry), display text (or template + params), **`evidenceLineIds`**, optional **`confidence`**, optional stable **`hypothesisKey`** for dedup.

Pure function: **`buildHypotheses(bundle: RootCauseHintBundle): Hypothesis[]`** — empty when ineligible.

### v1 minimal inputs (ship before `DB_08` / `DB_10`)
For the first release, **`bundleVersion: 1`** may omit or leave empty: `sqlBursts`, `sessionDiffSummary`. **`sessionId`**, **`nPlusOneHints`** (from **`DB_15`** / inline N+1), **`errors`**, and **`fingerprintLeaders`** (when already in viewer data) are enough to prove the UX. Add fields as related plans land without bumping version if they were always optional; bump when semantics of existing keys change.

### Session-level fields

| Field | Required | Notes |
| --- | --- | --- |
| `bundleVersion` | yes | Monotonic; breaking changes to key semantics require a new version. |
| `sessionId` | yes | Correlates with trim/reload. |
| `errors` | no | Short recent error excerpts or structured error ids already used elsewhere. |
| `sqlBursts` | no | From `DB_08`: window, fingerprint id, count, optional duration span. |
| `nPlusOneHints` | no | From `DB_07` / **`DB_15`**: region or line anchor, repeat count, time span. |
| `fingerprintLeaders` | no | Top repeated fingerprints with counts (align with existing fingerprint UI). |
| `driftAdvisorSummary` | no | Optional subset of Drift Advisor snapshot / `snapshotToMetaPayload` issues summary if present in workspace. |
| `sessionDiffSummary` | no | When `DB_10` is active: structured diff highlights (regression-only hypotheses). |

### Per-hypothesis fields (on each `Hypothesis`)
| Field | Required | Notes |
| --- | --- | --- |
| `evidenceLineIds` | yes (may be empty only if no line anchor exists) | Viewer line ids for “jump to evidence”; see **Evidence links** below. |

## Where the bundle is built
- **`buildHypotheses`** and types live in a **shared TypeScript module** (e.g. under `src/modules/…`) so tests import the same implementation as the viewer pipeline.
- **Assemble `RootCauseHintBundle`** in the **viewer data path (webview-side)** where line ids and merged **`DbDetectorResult`** (or inline equivalents) already exist. Inject **host-only** slices (e.g. drift summary) through **existing viewer bootstrap / postMessage** patterns; do not duplicate threshold logic on the host unless the data only exists there.

## Evidence links
- If an id is **missing from the current session** after trim/reload, **omit the jump link** for that bullet (show text only) rather than navigating to a wrong line or throwing.

## Weak-signal thresholds
- **Owner:** A small dedicated module (e.g. `root-cause-hint-eligibility.ts`) that reads **detector-defined or shared numeric thresholds** (repeat counts, time windows) and applies **template-specific minimums** (e.g. need at least one strong signal + optional secondary).
- **Rule:** If eligibility fails, emit **no** hypotheses block (or show a single neutral “insufficient correlated signals” line only if product wants explicit negative feedback—default is silence).

## Ordering, dedup, and conflicts
- **Priority (v1):** hypotheses tied to **recent errors** rank above pure DB repetition when both exist; then **N+1 / burst**-style DB signals; then **fingerprint leaders** without a tighter anchor.
- **Dedup:** merge bullets that share the same **`hypothesisKey`** (e.g. same fingerprint + same template family) into one line with merged **`evidenceLineIds`** (cap ids to a small max for UI).
- Apply priority and dedup **before** the **5-bullet / 240-character** cap.

## UI placement
- **Primary:** Collapsible **Hypotheses** strip **above** the log scroller in the main viewer (same webview), default **collapsed** after first dismiss in a session or user setting.
- **Non-goals for v1:** Replacing the log; modal dialogs; auto-expanding over the focused line.

## Implementation Plan
1. Define **`RootCauseHintBundle`**, **`Hypothesis`**, and **`bundleVersion`**; implement pure **`buildHypotheses(bundle) -> Hypothesis[]`** (empty array when ineligible).
2. Implement v1 as **deterministic templates** only (e.g. “N+1 pattern near line X; Y similar SELECTs in Z ms”) with **citations** only via per-hypothesis **`evidenceLineIds`**.
3. Wire the collapsible strip; **one-click dismiss** persists for the session (in-memory or session-scoped state already used for viewer prefs).
4. Optional v2: **“Explain hypotheses with AI”** (or per-hypothesis) calls the existing pipeline: `saropaLogCapture.explainError` / `explainError` in `src/modules/ai/ai-explain.ts` and `viewer-message-handler-actions.ts`, with **user-initiated** command only—reuse LM enablement, workspace trust, and caching behavior already defined for AI explain; pass structured bundle text as context, not silent background calls.
5. Store last-generated hypotheses in **session-scoped or ephemeral** viewer state only unless the user explicitly uses AI explain (then existing AI privacy rules apply).

## UX Rules
- Always show **“Hypothesis, not fact”** (or localized equivalent) and **link each bullet to evidence** when valid ids exist.
- Optional per-bullet **confidence** label for templates only (e.g. low/medium) when derived from signal strength—never implied certainty.
- Cap presentation: **at most 5 bullets**, each **≤ 240 characters** for v1 templates (excluding link chrome).
- One-click dismiss; do not block log interaction or keyboard focus.

## Localization
- v1: Add strings through the **same pattern as AI explain** (`l10n` / `package.nls.json` for command descriptions; webview copy via existing viewer localization if present). No English-only hardcoding in new UI without a follow-up nls task.
- **Checklist:** Confirm how the webview resolves strings today (shared JSON, injected `l10n` map, or hardcoded); align new Hypotheses copy with that mechanism before merge.

## Test Plan
- Unit: template selection, **priority, and dedup** given fixture bundles; eligibility returns `[]` when signals are weak.
- Unit: evidence links resolve to known line ids in fixtures; **unknown ids** yield **no link** in rendered output.
- Regression: extension and viewer behave with **AI path disabled** and with **empty bundle** (no strip or collapsed empty).

## Risks
- LLM hallucination if v2 is added; mitigate with template-first v1, **user-triggered** AI only, and **citation links** that point at real lines.
- **Stale or invalid evidence anchors** after trim/reload; mitigate with **Evidence links** behavior above.

## Done Criteria
- After a noisy DB + error fixture session, the user sees **≤ 5** template hypotheses with evidence links within **one viewer refresh** of data being available.
- Weak sessions produce **no** hypotheses (or only the explicit neutral copy if product enables it).
- Collapsible strip does not steal focus; dismiss works without reload.

## Implementation status (2026-03-23)

**Shipped (phase 1):** Shared module `src/modules/root-cause-hints/` (`buildHypotheses`, eligibility, types), webview strip (`viewer-root-cause-hints-*.ts`), `insightMeta` on N+1 synthetic rows, styles + `#root-cause-hypotheses` placement, refresh on `addLines` / `loadComplete`, reset on `clear`, unit tests `src/test/modules/root-cause-hints/build-hypotheses.test.ts`, QA notes `examples/root-cause-hypotheses-sample.txt`.

**Not shipped (still per plan / optional):** User-triggered **AI explain hypotheses** path, full webview **localization** for strip strings, host-injected **`driftAdvisorSummary`** / **`sessionDiffSummary`** in the live bundle, dedicated **collapse** UX beyond dismiss (v1 uses dismiss-to-hide for the session).

This document stays open until the optional items above are decided and implemented or explicitly deferred.

## Related Plans
- `DB_08`, `DB_10`, `DB_13`, `DB_01` (popover context), **`DB_15`** (detector outputs), history **`DB_07`**.
- AI explain design notes: `plans/history/20260313/023_plan-ai-explain-error.md`.
