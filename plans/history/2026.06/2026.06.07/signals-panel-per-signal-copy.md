# Signals panel — per-signal copy

**Trigger (user request, verbatim):** "in the signals panel I need a way to copy the full details of a signal - for pasting into analysis engine"

The Signals panel previously had only a panel-level "copy whole summary as markdown" button. There was no way to copy one signal on its own, and even the panel markdown carried only the normalized label (3-line, 90-char preview), not the actual untruncated log evidence. This task adds a per-row 📋 Copy action to both signal lists that emits a paste-ready detail block for an analysis engine.

## Finish Report (2026-06-07)

### Scope

(B) VS Code extension (TypeScript) only — two webview script-fragment files, one test file, plus CHANGELOG/README docs. No Flutter/Dart, no new dependency, no new webview message type.

### What changed

- **[viewer-signal-panel-script-part-b.ts](../../../../src/ui/panels/viewer-signal-panel-script-part-b.ts)** — added a `📋 Copy` button (`re-action signal-copy-btn`, keyed by `data-fingerprint` + `data-label`) to each row in `renderSignalTrends()` (cross-session "All signals") and `renderSignalsInThisLog()` ("Signals in this log"). The in-log rows, which previously carried no fingerprint, now also expose `data-fingerprint`/`data-label` so the copy handler can re-find the full signal object.
- **[viewer-signal-panel-script-part-d.ts](../../../../src/ui/panels/viewer-signal-panel-script-part-d.ts)** — added four helpers and wired both click handlers:
  - `findSignalByKey(arr, fp, label)` — re-finds a signal in a cache array by fingerprint (preferred) or label (fallback). Needed because the button carries only lightweight data attributes, but the detail block needs `lineIndices` that live on the cached object.
  - `collectSignalEvidenceLines(s)` — returns the full, untruncated text of the signal's supporting log lines from `allLines` (uses `rawText`, falls back to `stripTags(html)` for collapsed/repeat rows). Capped at 50 lines to bound the clipboard payload.
  - `buildSignalDetailText(s)` — builds the paste-ready markdown: metadata (kind, severity, occurrences, sessions, avg/max duration, category, trend, first/last seen, fingerprint) + raw example (fenced) + supporting log lines (fenced).
  - `copySignalFromButton(btn, arr)` — resolves the button to a signal and posts `copyToClipboard`.
  - Both the trend-row and in-log-row click handlers now intercept `.signal-copy-btn` **first** (with `e.stopPropagation()` + `return`) so the copy click never falls through to the row's open-session / jump-to-line action.
- **[signal-panel-row-click.test.ts](../../../../src/test/ui/signal-panel-row-click.test.ts)** — added a `Signal panel per-signal copy` suite (4 cases): copy button present in both renderers; part-D helpers defined; both handlers intercept and copy from the correct cache; and a `new Function(...)` syntax-validity check on the generated part B + part D fragments (guards the fragile backtick-escaping in the markdown code fences).

### Reuse / no-new-surface notes

- Routes through the existing `copyToClipboard` host message (handled in `viewer-message-handler-actions.ts`) — no new webview message type, so the incoming/outbound catalogs are unchanged (`verify:webview-catalog` / `verify:host-outbound-catalog` still pass).
- Reuses the existing `re-action` button styling — no new CSS.
- Mirrors the existing `buildEvidencePreviewHtml` / `buildSignalMarkdown` patterns.
- The new inline button labels ("📋 Copy", tooltip "Copy signal details for analysis") follow the existing hardcoded-in-template convention of the sibling row buttons (Close / Mute / Re-open / "📋 Rule" / "🔍 DA"), which are likewise not in the NLS pipeline.

### Quality gates

- `npm run check-types` — clean.
- `npm run compile` — passes (NLS, webview incoming/outbound catalogs, command list, dist-size all green; dist 4.42 MiB).
- `npm run lint` — only 8 pre-existing warnings, all in files this task did not touch; the two edited source files and the test file produce zero warnings.
- `npm run test:file -- out/test/ui/signal-panel-row-click.test.js` — **8 passing** (4 pre-existing unchanged + 4 new, including the JS-syntax-validity check).

### Checklist dispositions

- **Bug archival:** SKIPPED [NO-BUG-FIXED] — no `bugs/*.md` describes this work (ad-hoc user feature request).
- **l10n (Section 5):** SKIPPED [B-NOT-IN-SCOPE] — extension webview, not the Flutter app; new strings match the existing non-NLS inline-button convention.
- **LAUNCH_TEST.md:** does not exist in this repo (that file belongs to the Saropa Contacts app); the manual-test steps are recorded in the chat `## What to test` block and in this report.
- **package.json / version:** unchanged — change sits under `[Unreleased]`; releases live on feature branches.

### Outstanding

On-device (F5 Extension Development Host) verification of the actual clipboard write and the status-bar confirmation is the only step not executable in this environment.
