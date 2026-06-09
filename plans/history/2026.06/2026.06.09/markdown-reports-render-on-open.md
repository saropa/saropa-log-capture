# Markdown reports render on open + fenced code blocks

**Trigger:** The user opened a generated Saropa Log Capture session report (`d:\src\contacts\reports\20260609\20260609_104551_contacts-flow-map.md`) in the Log Viewer and reported, with a screenshot: "currently markdown this looks bad or is not detected." The screenshot showed the entire report as raw source — `**bold**`, `## headings`, `| tables |`, and a ```` ```mermaid ```` fence all unrendered.

## Finish Report (2026-06-09)

This work will be reviewed by another AI.

### Scope

**(B)** VS Code extension (TypeScript) — webview viewer rendering + CSS. No Flutter/Dart, no docs-only.

### Root cause

Two independent defects, both in the webview viewer:

1. **Not rendered on open.** `.md`/`.json`/`.csv` files were correctly detected (`detectFileMode()` posts `setFileMode`, the format-toggle button shows, all markdown CSS exists), but `formatEnabled` started `false` and was reset to `false` on every `setFileMode`. So a report displayed as raw text until the user manually clicked the format-toggle button — reading as "not detected." (Plan 051 deliberately defaulted formatting off; that default is wrong for generated reports.)
2. **Fenced code blocks mangled.** The markdown renderer (`formatMarkdownLine`) is line-by-line with no fence state. A ```` ```mermaid ```` block had each line run through the bold/italic/inline-code/link rules, and the triple-backtick delimiters rendered literally.

### Changes (commit `d05eacfd`)

- **[viewer-script-messages.ts](../../../../src/ui/viewer/viewer-script-messages.ts)** — `setFileMode` now sets `formatEnabled = (fileMode !== 'log')` so structured docs auto-enable formatting. The layout build is deferred to the `loadComplete` handler (which now calls `window.buildFormatModeLayout()` + `recalcHeights()` + `buildPrefixSums()` + `renderViewport(true)` when formatting is on) because `setFileMode` is posted before any content lines arrive, so `allLines` is empty at that point.
- **[viewer-toolbar-script.ts](../../../../src/ui/viewer-toolbar/viewer-toolbar-script.ts)** — extracted `window.buildFormatModeLayout()` (mutually-exclusive `buildMdSections`/`buildJsonBracePairs`/`buildCsvLayout` dispatch) so the manual toggle and the auto-enable-on-load path share one build step. `toggleFormat()` now calls it.
- **[viewer-format-markdown.ts](../../../../src/ui/viewer/viewer-format-markdown.ts)** — added `mdFences` map + `buildMdFences()` (scans `allLines` for ```` ``` ````/`~~~` 3+ delimiters, marks each line `open`/`body`/`close`, opener carries the language). `buildMdSections()` calls it first and the heading scan now skips fenced lines (a `#` inside code is not a heading). `formatMarkdownLine()` checks the fence map first: body lines render verbatim via `escapeHtml(stripTags(html))` (no inline mangling, no double-escape — `stripTags` decodes entities, `escapeHtml` re-encodes), delimiters render as thin rules with a language label.
- **[viewer-styles-format.ts](../../../../src/ui/viewer-styles/viewer-styles-format.ts)** — `.md-fence-body` (tinted monospace block), `.md-fence-open`/`.md-fence-close` (thin rules), `.md-fence-lang` (grey language label).
- **[CHANGELOG.md](../../../../CHANGELOG.md)** — `### Fixed` entry under `[Unreleased]`.

### Deep review notes

- **Logic & safety:** no recursion/races. `buildMdFences` is a single linear pass with a boolean `inFence` toggle. All webview calls remain `typeof fn === 'function'` guarded.
- **Architecture:** reused the existing `mdSections` pattern for `mdFences`; shared the layout build instead of duplicating the three-way dispatch (single source of truth). No new dependencies.
- **Performance:** fence scan is O(lines), runs once at `loadComplete` alongside the existing section build.
- **File length:** `viewer-format-markdown.ts` is 157 code lines (limit 300).

### Testing

- **Audit (mandatory):** grepped `src/test` for every changed symbol (`formatEnabled`, `buildFormatModeLayout`, `toggleFormat`, `setFileMode`, `loadComplete`, `buildMdSections`, `buildMdFences`, `formatMarkdownLine`, `md-fence`, `fmt-markdown`). One match: [viewer-script-null-guards.test.ts:57-66](../../../../src/test/ui/viewer-script-null-guards.test.ts#L57-L66), which asserts `if (jumpBtn) jumpBtn.style` falls within the first 400 chars after `case 'loadComplete':`. My insertion is *after* `updateFooterText();` (below the jumpBtn line), so the guarded line's position is unchanged. Replicated the exact assertion standalone against the compiled `out/` getter — **passes (true)**. `file-mode-detection.test.ts` covers `detectFileMode`, untouched.
- **Parse validation:** `new Function()` over the three edited webview-string getters (`getViewerFormatMarkdownScript`, `getViewerScriptMessageHandler`, `getToolbarScript`) — all parse (esbuild treats these strings opaquely, so this is the real syntax gate for the inner JS).
- **Functional validation:** ran `buildMdSections` + `formatMarkdownLine` against the actual report. Fence detected (L14 `open(mermaid)`, L15–24 `body`, L25 `close`); headings only at the real `#` lines (no false heading inside the fence); body lines render verbatim with `<br/>` correctly escaped.
- **Gates:** `npm run check-types` clean; `npm run compile` clean (NLS, webview catalogs, command list, dist-size all pass).
- New dedicated unit tests for `buildMdFences`/fence rendering were not added — the existing markdown formatter has no unit-test harness in `src/test` (it is webview-script-string code, validated by the syntax/null-guard suites). Verified by the standalone functional harness above instead.

### Project maintenance

- CHANGELOG updated. README verified — no updates needed (no new command/setting). `package.json` unchanged (no release/dep change). guides reviewed — no user-facing doc delta beyond CHANGELOG. Roadmap: SKIPPED [B-NOT-IN-SCOPE for Flutter roadmap]; this fix has no ROADMAP.md entry. No bug archive — task did not close a `bugs/*.md` file.

### Outstanding / not in this change

- **Mermaid diagram rendering** (drawing the ```` ```mermaid ```` source as an actual flowchart) is NOT done — it requires bundling the `mermaid` library (~2.8 MB), a blast-radius dependency add. Surfaced to the user as a permission-gated suggestion; awaiting an explicit yes/no. Out of scope for this commit.
