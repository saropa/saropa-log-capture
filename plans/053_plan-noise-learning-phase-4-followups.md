# Plan 053 — Noise Learning Phase 4 Follow-ups

## Status: Partial (A + B shipped, C + D pending)

- [x] **Workstream A** — Insights panel suggestions section (filter suggestions render in the panel with Accept/Reject)
- [x] **Workstream B** — `filter-out` emission from level/category toggles (emitter wired in `viewer-level-filter.ts`)
- [ ] **Workstream C** — Confidence feedback loop
- [ ] **Workstream D** — Optional cross-workspace global aggregates

## Goal

The noise-learning MVP ([Plan 025](history/2026.03/20260323/025_plan-noise-learning.md)) shipped 2026-03-23. The "Phase 4" follow-ups listed inline at the top of that plan never moved into their own active scope, so the historical plan has been sitting in `history/` with an inline "Follow-up:" sentence that makes it read like both *done* and *not done*.

Split those follow-ups out into this plan so 025 can sit cleanly as **implemented** and the remaining work can land on its own cadence.

This plan does **not** redesign anything. The existing data model, store, extractor, and runtime at [src/modules/learning/](../src/modules/learning/) stand as-is.

---

## Background — audit of the original Phase 4 list

The original Phase 4 section in [025](history/2026.03/20260323/025_plan-noise-learning.md#phases) listed three bullets; the inline status note at the top of that file listed three more. Cross-checking against the live code:

| Original Phase 4 item | Live status | This plan? |
|---|---|---|
| Insights panel section for suggestions | **Not shipped.** UI is QuickPick + deferred notification only ([src/modules/learning/learning-notifications.ts](../src/modules/learning/learning-notifications.ts)). The unified Insights panel exists but has no suggestions section. | **Yes** (Workstream A) |
| Richer filter-out tracking | **Type defined, source not wired.** `'filter-out'` is in the `InteractionType` union at [src/modules/learning/interaction-types.ts:7](../src/modules/learning/interaction-types.ts#L7) and accepted by the pattern extractor, but no emitter posts it. | **Yes** (Workstream B) |
| Scroll behavior tracking, opt-in, with dedupe/caps | **Shipped.** Burst-window reset (1200ms), 24-event cap per burst, ±12-line dedupe by index — see [src/ui/viewer/viewer-script.ts:163-205](../src/ui/viewer/viewer-script.ts#L163-L205). Gated by `saropaLogCapture.learning.trackScrollBehavior`. | No — done |
| Confidence adjustment from accept/reject feedback | **Not shipped.** `minConfidence` is a static setting; accept/reject feedback is persisted but not fed back into confidence scoring. | **Yes** (Workstream C) |
| Optional global aggregates (opt-in, cross-workspace) | **Not shipped.** Storage is workspace-only via VS Code `Memento` under `saropaLogCapture.learning.v1`. | **Yes** (Workstream D) |

Four real follow-ups remain. One Phase 4 bullet was already done — the audit catches it so this plan doesn't duplicate work.

---

## Scope

### In scope

- **A.** Suggestions section in the Insights panel (alongside existing QuickPick + notification entry points).
- **B.** Wire `filter-out` emission from level/category filter changes.
- **C.** Confidence feedback loop — boost or penalize pattern confidence based on accept/reject history.
- **D.** Optional global aggregates — opt-in promotion of high-confidence, framework-class patterns to cross-workspace storage.

### Out of scope

- Re-architecting the learning data model, store schema, or tracker.
- Cross-machine sync. VS Code Settings Sync already handles `saropaLogCapture.exclusions` updates when a user accepts a suggestion; that's the persistence path. No new sync layer.
- Importing learning data from other extensions or external sources.
- New interaction types beyond what already exists. The five enum values (`dismiss`, `filter-out`, `add-exclusion`, `skip-scroll`, `explicit-keep`) are the contract.

---

## Workstreams

### Workstream A — Suggestions section in the Insights panel

Today the entry points are a notification (frequency-gated by `saropaLogCapture.learning.suggestionFrequency`) and a manual QuickPick command. Both are pull-based: the user has to react to a prompt or remember the command. The Insights panel is the natural always-visible surface and already groups other learning-adjacent UI (Recurring errors, Hot files, Performance).

#### A1. New collapsible section
- Location: Insights panel, between "Recurring errors" and "Hot files" (the closest semantic neighbors — both are inferred from usage rather than read directly from the log).
- Title: "Filter suggestions" with a pending count badge.
- Empty state: hidden when zero pending suggestions (don't show empty headers).

#### A2. Row layout per suggestion
Borrow the row format from the existing QuickPick + the sketch at [025 §4](history/2026.03/20260323/025_plan-noise-learning.md#4-suggestion-ui):
- Pattern (monospace)
- One-line description from `SuggestionEngine.describePattern()`
- Impact: "Would hide ~N lines (X%)"
- Actions: Accept / Reject / Preview

#### A3. Wire-up
- Reuse `SuggestionEngine.refreshAndListPending()`.
- Accept → existing path: update `saropaLogCapture.exclusions`, broadcast via `ViewerBroadcaster.setExclusions`.
- Reject → existing path: persist `accepted: false` in the suggestion row.
- Preview → temporary apply-without-saving so the user sees the line count reduction before accepting. Reverted on close or "back".

#### A4. Don't remove existing entry points
- The notification stays (background, low friction).
- The QuickPick command stays (keyboard-driven workflow).
- The Insights section is **additive**, per the global rule about not downsizing existing features.

#### A5. Verification
- Insights panel shows the section with three test fixtures; accept on one removes the row and updates exclusions.
- Empty state hides the section entirely (no "0 suggestions" header).
- Closing the panel during Preview reverts the temporary exclusion.

---

### Workstream B — Filter-out interaction tracking

The `InteractionType` union has `'filter-out'`. No code emits it. Wire the missing emitter.

#### B1. Emission sites
When the user hides a level/category via the filter toolbar, capture the lines that *would have been visible but now aren't* and track them as `'filter-out'` interactions. Two reasonable sources:
- **Level filter toggle** at the level chip handler in `viewer-toolbar-filter-tabs-script.ts`.
- **Category filter toggle** (DAP category — stdout/stderr/console) at the matching handler.

#### B2. Dedupe and cap
The scroll-burst dedupe pattern at [viewer-script.ts:163-205](../src/ui/viewer/viewer-script.ts#L163-L205) is the model:
- One filter-toggle event can cover hundreds of lines. Cap emissions per toggle at N (suggest 50).
- Dedupe by line index per toggle.
- Truncate `lineText` to 100 chars (matches existing scroll truncation).

#### B3. Down-weighting
Filter-out is a weaker signal than `dismiss` (which is an explicit collapse) but stronger than `skip-scroll` (which infers from speed). Suggest weight = 0.7 in the extractor, between dismiss (1.0) and skip-scroll (0.3). Tune via fixture tests.

#### B4. Verification
- Toggle the "warnings" filter off in a fixture session with 80 warning lines → exactly 50 `filter-out` events flushed (cap honored).
- Re-toggle → no duplicate emissions for the same index/text in the same burst.
- Pattern extraction on a 200-event dataset including filter-outs produces at least one suggestion that wouldn't surface from dismiss-only data.

---

### Workstream C — Confidence feedback loop

Today `SuggestionEngine` returns confidence from `extractPatterns()` and that's it. Accept/reject is persisted but never read back. Result: a pattern the user rejects this week is just as likely to be re-suggested next week if the underlying interactions still support it.

#### C1. Feedback inputs
- **Accept** of a pattern P: boost confidence of P (and patterns syntactically similar to P) on future extraction passes.
- **Reject** of a pattern P: penalize P. Stronger than "skip" — the user actively said no.
- **Re-suggest suppression**: a rejected pattern should not re-surface for at least M sessions (suggest M=10) unless the supporting interaction count doubles.

#### C2. Where the math lives
- New file `src/modules/learning/confidence-feedback.ts`.
- Pure function: `applyFeedback(rawConfidence: number, feedback: SuggestionFeedback): number`.
- Inputs from `LearningStore.loadAll().feedback`.

#### C3. Confidence multiplier model
- Default: multiplier = 1.0.
- For each prior **accept** of an exact-match pattern: multiplier × 1.15 (cap at 1.5).
- For each prior **reject**: multiplier × 0.6 (floor at 0.1).
- For similar (substring overlap > 80%) patterns: half the effect.

These coefficients are a starting point; tune from real acceptance data.

#### C4. Verification
- Fixture: pattern accepted twice → final confidence > raw.
- Fixture: pattern rejected once → final confidence < raw.
- Fixture: rejected pattern doesn't appear in `refreshAndListPending()` for at least 10 sessions even if raw extraction produces it.

---

### Workstream D — Optional global aggregates (opt-in)

The cross-workspace use case is generic framework noise — `[flutter]`, `Recompiling because main.dart has changed`, Android `MediaCodec` warnings. Patterns that are noise everywhere, not just in the current repo. Promoting these across workspaces means a new dev gets reduced noise from day one without retraining the learner.

#### D1. Promotion rules — strict by default
Promotion to globalState requires **all** of:
- Pattern accepted in ≥2 workspaces, OR rejected nowhere and accepted in ≥1 workspace with high confidence (>0.95).
- Pattern does not contain workspace-identifying content (no absolute paths, no project names, no usernames). Implement a deny-list check.
- User has explicitly opted in via `saropaLogCapture.learning.globalAggregates: true` (default `false`).
- Pattern is one of the "framework-class" categories from `ExtractedPattern.category`: `'framework'`, `'verbose'`, `'repetitive'`. Never `'noise'` (too generic; high false-positive risk).

#### D2. Storage
- VS Code `globalState` under key `saropaLogCapture.learning.global.v1`.
- Schema: `{ patterns: Array<{ pattern, category, acceptedInWorkspaces: number, lastPromotedAt }> }`.
- Cap at 200 patterns (FIFO eviction by `lastPromotedAt`).

#### D3. Consumption
- On startup, if opt-in is on: load globalState patterns, merge into the workspace's pending suggestions with a "Suggested from your other workspaces" label.
- User accepts → pattern goes into workspace exclusions like any other suggestion.
- User rejects → pattern is suppressed for *this workspace only*; other workspaces continue to see it.

#### D4. Privacy guardrails
- The deny-list check is mandatory, not optional. Implement before D3.
- "Clear all global aggregates" command. Wipes globalState key.
- Settings copy explicitly states what is shared globally (just the pattern text + category).

#### D5. Verification
- Promote a pattern containing an absolute path → rejected by deny-list check; not stored.
- Opt-out user → no globalState reads or writes.
- Two simulated workspaces accept the same pattern → third workspace sees it as a suggestion on next startup.

---

## Sequencing

A → B → C → D in priority order, but A and B are independent (different files) and could ship in either order or in parallel.

- **A** has the highest user-visible value (always-on UI vs. notification).
- **B** unlocks a class of patterns the extractor can't currently see (filter-driven noise).
- **C** depends on having enough accept/reject data to be meaningful — let A + B run for a while first.
- **D** lands last. The global aggregate is most useful once the per-workspace feedback loop (C) is producing high-quality patterns to promote.

---

## Per-item complexity and risk

| Item | Complexity | Risk | Notes |
|---|---|---|---|
| A1–A5 Insights panel section | Medium | Low | Reuses existing engine + broadcaster; the work is panel layout and event wiring. |
| B1–B4 Filter-out tracking | Low | Medium | Dedupe/cap discipline matters — easy to flood the tracker buffer if filter toggles fire for thousands of lines. |
| C1–C4 Confidence feedback | Medium | Medium | Coefficient tuning is the hard part. Risk of suppressing useful patterns or boosting bad ones. Land behind a setting if the model is uncertain. |
| D1–D5 Global aggregates | Medium | High | Privacy-critical. Deny-list completeness is the load-bearing check. Audit by a second reviewer before shipping. |

---

## Verification checklist

A workstream is not done until every check below passes.

### A — Insights panel section
- [ ] Section renders only when pending suggestions exist.
- [ ] Accept updates `saropaLogCapture.exclusions` and broadcasts via `ViewerBroadcaster.setExclusions`.
- [ ] Reject persists `accepted: false` and removes the row.
- [ ] Preview applies temporary exclusion; closing the section reverts it.
- [ ] Notification and QuickPick entry points still work (regression).

### B — Filter-out tracking
- [ ] Level filter toggle emits `filter-out` events.
- [ ] Category filter toggle emits `filter-out` events.
- [ ] Per-toggle cap of 50 events honored.
- [ ] Dedupe by line index within a single toggle action.
- [ ] Extractor weight = 0.7 (verifiable via fixture test).

### C — Confidence feedback
- [ ] Pure function `applyFeedback` has fixture tests for accept boost, reject penalty, and similar-pattern half-effect.
- [ ] Rejected patterns suppressed for ≥10 sessions.
- [ ] Multiplier floor (0.1) and ceiling (1.5) enforced.

### D — Global aggregates
- [ ] Default setting is **off**.
- [ ] Deny-list rejects patterns with absolute paths, usernames, project-identifying content.
- [ ] Promotion only for `framework`/`verbose`/`repetitive` categories.
- [ ] "Clear global aggregates" command wipes the key.
- [ ] Settings copy lists exactly what is shared globally.

---

## Files touched (anticipated)

- **New**
  - `src/modules/learning/confidence-feedback.ts`
  - `src/modules/learning/global-aggregates.ts`
  - `src/modules/learning/global-aggregates-denylist.ts`
- **Modified**
  - `src/ui/panels/` — Insights panel layout (file TBD by panel structure)
  - `src/ui/viewer-toolbar/viewer-toolbar-filter-tabs-script.ts` — emit `filter-out`
  - `src/modules/learning/suggestion-engine.ts` — call `applyFeedback`, suppress rejected
  - `src/modules/learning/learning-store.ts` — globalState read/write paths
  - `package.json` — `saropaLogCapture.learning.globalAggregates` setting
  - `CHANGELOG.md` — per workstream landing

---

## Why these splits and not one big follow-up

A single "noise learning v2" plan would conflate UI work (A), tracker wiring (B), algorithm tuning (C), and a privacy-sensitive cross-workspace feature (D). Each has a different reviewer profile and a different failure mode. Keeping them as four workstreams in one plan lets each ship and be verified independently while keeping the audit trail (this file → 025 → the live module) coherent.
