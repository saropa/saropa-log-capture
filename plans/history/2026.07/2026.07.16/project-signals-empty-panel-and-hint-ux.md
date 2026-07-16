# Project Signals — empty-panel fix, live-line fallback, and root-cause hint UX

The Project Signals panel rendered nothing for a captured log that plainly contained errors: the "This log" section was hidden unless the session carried performance-sampling data, and even when shown its rows were built only from fingerprints written at session-finalize — absent for loaded or unfinalized reports. Separately, the in-viewer root-cause hint strip let long hints sprawl and had no compact/expand affordance or row numbering.

## Finish Report (2026-07-16)

### Defect 1 — "This log" section hidden by a performance-data gate

The webview signal panel tracked a single `hasLog` flag, set from `performanceData.sessionData`, which the host fills only from `meta.integrations.performance`. `applyStateAB()` gated the "This log" section on `hasLog`, so any capture without the performance integration hid the section entirely — the dominant case. A new `logOpen` flag (set from `performanceData.currentLogLabel`, i.e. "a log file is being viewed") now gates that section, decoupled from perf sampling. The performance hero and session-details section remain on `hasLog` to avoid a "no errors" hero regression on logs whose metadata carries no counts.

Files: `src/ui/panels/viewer-signal-panel-script-part-a.ts` (`logOpen` decl + `applyStateAB` gate), `src/ui/panels/viewer-signal-panel-script-part-c.ts` (`logOpen` set in the `performanceData` handler).

### Defect 2 — signals sourced only from persisted fingerprints

`handleSignalDataRequest` builds `signalsInThisLog` from `buildAllRecurringSignals`, which reads `meta.fingerprints`. Those are written only on session finalize (`session-lifecycle-finalize.ts`). A loaded/unfinalized report (verified: `reports/.session-metadata.json` held zero fingerprints and no error counts for the affected file) therefore yielded an empty list while the viewer visibly classified errors. A client-side fallback now covers this: `buildLiveSignalsFromLines()` scans the webview's `allLines`, groups `error`/`warning` lines by NUL-joined `level + text` into synthesized entries (occurrence count + `lineIndices` for jump/evidence), errors before warnings. `resolveSignalsInThisLog()` prefers host metadata signals and falls back to the live scan only when the host sent none, caching the result in `liveSignalsInThisLog` so the per-row copy handler can re-find synthesized entries by fingerprint (`'live:'`-prefixed, no host collision).

The icon-bar badge total and the copy-all markdown were updated to count/emit the resolved list (`liveSignalsInThisLog` / `resolveSignalsInThisLog()`, gated on `logOpen`) so they reflect what the section shows rather than the empty host list.

Files: `viewer-signal-panel-script-part-c.ts` (builder, resolver, badge, markdown), `-part-b.ts` (render uses resolver), `-part-d.ts` (copy handler resolves fallback), `-part-a.ts` (`liveSignalsInThisLog` state).

### Change 3 — panel rename

`signal.panel.title` and `signal.panel.region` changed from "Signals" to "Project Signals" (`src/l10n/strings-viewer-b.ts`). README panel description updated to match and to document the "This log" section.

### Change 4 — root-cause hint strip: numbering + truncate/expand

Hints are numbered via a CSS counter on `.root-cause-hypotheses-list` (`li::before`), not `<ol>` bullets, because each row is a flex container with optional emoji/badge children. Hint text (`.rch-hyp-text`) truncates to one line with an ellipsis by default; clicking it toggles `.rch-expanded` on the row to wrap the full text. Report-open moved off the text button onto a dedicated hover-revealed `.rch-report-btn` icon so the text click can expand without removing the report path (the click handler still keys on `.rch-report-btn` → `openSignalReport`, unchanged).

Files: `src/ui/viewer-styles/viewer-styles-root-cause-hints.ts`, `src/ui/viewer/viewer-root-cause-hints-script.ts`.

### Tests

Updated three string-level regression suites to pin the new behavior: `signal-panel-row-click.test.ts` (fallback-aware copy resolution), `viewer-root-cause-hints-styles.test.ts` (counter numbering, `.rch-hyp-text` ellipsis + `.rch-expanded` wrap, hover icon), `viewer-root-cause-hints-embed.test.ts` (text-expand vs report-icon split). `node:test` suites pass (24/24 for the two node-runnable files). `signal-panel-row-click.test.ts` uses Mocha `suite()` and runs under the Extension Host runner; its assertions were verified against source by inspection (substring presence + ordering).

### Verification

`npm run check-types` clean; `npm run compile` passes all verify gates (nls, webview catalogs, l10n-keys, dist-size 5.16 MiB); edited files lint clean; part-c template-literal JS validated via `new Function`. Not exercised in the running Extension Development Host — visual/interaction confirmation is a manual step.

### Known residual

The Trouble Mode signals band reads `signalDataCache.signalsInThisLog` directly and does not consume the live fallback; its pre-existing host-only behavior is unchanged (not a regression from this work). The host-vs-live selection is expressed both in `resolveSignalsInThisLog()` and, redundantly but equivalently, in the part-d copy ternary; a shared accessor would remove the duplication.
