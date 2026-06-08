# Minimap scroll-map painted a light-grey wash over its whole surface

**Trigger:** User reported (with screenshots comparing our minimap to VS Code's): "you are drawing a light grey background or semi-transparent foreground on the log viewer's mini map." VS Code's minimap was supplied as the reference — an opaque dark base with colored ticks, no grey overlay.

## Finish Report (2026-06-08)

### Scope

(B) VS Code extension (TypeScript). One webview-paint module + its test + CHANGELOG.

### Root cause

`paintMinimap()` fills the entire canvas as a base layer (`fillRect(0, 0, mmW, mmH)`)
before painting severity ticks and SQL density bands. That base used
`mmColors.track`, which `initMmColors()` defined as
`--vscode-scrollbarSlider-background` (default `rgba(100,100,100,0.26)`).

The scrollbar-slider color is a *translucent grey* designed to sit ON TOP of
content as a draggable thumb. Painting it across the whole minimap produced a
light-grey wash over every tick and band — exactly the symptom reported. VS
Code's own minimap uses the editor background as its base, not the slider color.

### Fix

[viewer-scrollbar-minimap-paint.ts](../../../../src/ui/viewer/viewer-scrollbar-minimap-paint.ts):

- `initMmColors()` — `track` now reads `--vscode-editor-background` (fallback
  `#1e1e1e`) instead of `--vscode-scrollbarSlider-background`. Added a comment
  explaining why the slider color is wrong as a full-canvas base.
- `paintMinimap()` — the fallback in the `fillStyle` assignment changed from
  `rgba(100,100,100,0.26)` to `#1e1e1e` to match.

The `.minimap-viewport` thumb in
[viewer-styles-ui.ts](../../../../src/ui/viewer-styles/viewer-styles-ui.ts)
still correctly uses the translucent slider grey — that element *is* the
draggable visible-range indicator and is meant to be a semi-transparent overlay.
Only the full-canvas base was wrong.

### Tests

- Audited the test tree for any assertion pinning the `track` color,
  `scrollbarSlider-background`, or `rgba(100,100,100,0.26)`: none found. The
  existing minimap test pins priority-bucket logic only, which was untouched.
- Added a regression test in
  [viewer-scrollbar-minimap-sql-heuristics.test.ts](../../../../src/test/ui/viewer-scrollbar-minimap-sql-heuristics.test.ts)
  asserting the track base reads `--vscode-editor-background` and does NOT use
  the scrollbar-slider grey.

### Test execution — NOT run in this environment

Two independent blockers, neither caused by this change:

1. A concurrent, unrelated workstream left `src/ui/session/session-history-*.ts`
   in an uncompilable state (`onFilesFound` not on `FetchCallbacks`, undefined
   `stat`). `npm run check-types` and `npm run compile-tests` both fail solely on
   those files. My two source files compile clean.
2. The minimap test file uses Mocha `suite()` globals, which require the
   vscode-test Extension-Host harness; `node --test` cannot run it. The harness
   recompiles the project and so hits blocker (1).

The added assertion is verified against the source by inspection (the regex
matches the literal written). It will execute once the unrelated session-history
workstream compiles again.

### Commit isolation

The working tree already held 10 files from the separate session-history /
Open-Signals workstream when this task began. Per the hard rule against
committing another workstream's unverified feature code, this commit includes
ONLY: the minimap paint module, its test, the CHANGELOG entry, and this report.

### Files in this commit

- `src/ui/viewer/viewer-scrollbar-minimap-paint.ts` (fix)
- `src/test/ui/viewer-scrollbar-minimap-sql-heuristics.test.ts` (regression test)
- `CHANGELOG.md` (Unreleased → Fixed entry)
- `plans/history/2026.06/2026.06.08/minimap-grey-wash-base.md` (this report)

### Outstanding

None for this task. On-device confirmation pending (see "What to test").
