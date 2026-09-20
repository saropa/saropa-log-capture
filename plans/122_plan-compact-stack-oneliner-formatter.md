# PLAN 122 — Compact plain-text stack trace one-liner for non-interactive contexts

**Status: Open**

Created: 2026-09-20
Type: Tooling
Related: `src/modules/ai/ai-context-builder.ts`, `src/modules/bug-report/bug-report-formatter.ts`, `src/ui/viewer/viewer-data-add-stack-ingest.ts`

---

## Summary

Add a small utility that renders a stack trace as a compact plain-text summary
(first N app-only frames, framework frames elided as a `[+N more]`-style note) for
contexts that can't render Saropa's interactive collapsible-group viewer UI — AI
prompts, bug-report text bodies, notification text, clipboard-copy summaries.

---

## Motivation

Saropa's interactive stack UI (collapsible groups, dimmed framework frames,
configurable preview count, dedup badges — `viewer-data-helpers-render-stack.ts`) is
richer than anything comparable in `flutter_inspector_kit`, which only has a static
text formatter. That said, inspector_kit's static formatter
(`buildLogOneLiner`, `log_formatters.dart:18-55` — filters to app-only frames,
excludes `package:flutter/`/`dart:`/async-suspension noise, takes the first 3) solves
a real, narrower problem Saropa's interactive UI doesn't address: **plain-text
contexts where there is no DOM to expand/collapse.**

Verify, before implementing, whether `src/modules/ai/ai-context-builder.ts`'s stack
extraction (`STACK_FRAME_PATTERNS`, lines 45-51) already truncates to a reasonable
size for AI prompts or dumps the full trace verbatim — if it already truncates
sensibly this plan narrows to just extracting that logic into a shared, reusable
utility; if it dumps full traces, this closes a real gap (long traces bloating prompt
token counts and burying the signal).

---

## Behavior

### User flow

No new user-facing command. This is an internal formatting utility consumed by:

1. `ai-context-builder.ts` when assembling the "Explain with AI" prompt.
2. `bug-report-formatter.ts` when a stack trace is embedded in a generated bug report.
3. Any future notification/toast that needs to show a stack summary in limited space.

### UI / UX

N/A — text formatting utility, not a new UI surface.

---

## Edge Cases

1. **Trace has fewer than N app frames** — return all of them, no truncation marker.
2. **Trace is 100% framework frames** (e.g. a crash entirely inside a plugin) — fall
   back to showing the first framework frame rather than an empty summary; don't
   silently produce a blank stack.
3. **Reuse `isFrameworkFrame()`** (`src/modules/analysis/stack-parser.ts:47-93`) —
   Saropa already has a multi-language app/framework frame classifier (Dart/Flutter,
   Node, Python, Go, Java/Kotlin, .NET, plus workspace-path override). Do not write a
   second classifier; this plan is purely a new *rendering* mode over existing
   classification data.

---

## Alternatives Considered

- Always send the full stack trace to AI prompts and let the model ignore noise —
  rejected: wastes context/tokens and buries the signal in framework noise the model
  has to filter itself; a pre-filtered one-liner is strictly better input.
- Duplicate inspector_kit's exact "first+summary+last" textual collapse from PLAN's
  stack-viewer discussion — rejected as unnecessary for the *interactive* viewer
  (which already does something better); this plan is scoped only to non-interactive
  text contexts.

---

## Decision

<!-- Fill in when the proposal is accepted or declined -->

---

## Implementation Notes

- New function, e.g. `buildStackOneLiner(frames, {maxFrames = 3})` in
  `src/modules/analysis/` (co-locate with `stack-parser.ts`), consuming
  `isFrameworkFrame()` classification.
- Wire into `ai-context-builder.ts` and `bug-report-formatter.ts` at their existing
  stack-trace-embedding call sites.

---

## Commits

<!-- Add commit hashes as implementation lands -->
