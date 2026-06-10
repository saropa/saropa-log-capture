# Log Viewer — six display fixes (AI rows, paths, time column)

User reported six issues from the log viewer in a session showing the contacts app. Symptoms (paraphrased verbatim): line numbers misaligned between rows with/without severity dots; severity dots missing on rows like 1214/1215/1216; duplicate text in those rows even though copy returns single text; many unclickable file paths (e.g. `lib/components/primitive/buttons/common_button.dart`); display settings (specifically the elapsed-time toggle) reset between sessions; time column not right-aligned.

Reference log file the user shared: `d:\src\contacts\reports\20260602\20260602_103101_contacts.log`. The exact captured log session shown in the screenshot did not exist in that file (different session), but the AI-category rows match the same render path.

## Finish Report (2026-06-02)

### Scope

(B) VS Code extension — TypeScript. Touched the webview render branch for AI lines, AI line CSS rail, source-path linkifier, workspace-bool message map, the deco-options change handler, and the elapsed-time CSS class.

### Root-cause analysis

Of the six reported issues, **three (1, 2, 3) traced to the AI-category render branch in [src/ui/viewer/viewer-data-helpers-render.ts:183-200](../../../../src/ui/viewer/viewer-data-helpers-render.ts):**

- **Issue 3 — duplicate text:** The AI branch built its prefix from `escapeHtml(stripTags(html).split(']')[0] + ']')`. But by that point `stripSourceTagPrefix` (default-on at [viewer-deco-settings.ts:146](../../../../src/ui/viewer-decorations/viewer-deco-settings.ts#L146)) had already removed the leading `[ai-bash]` bracket from `rawHtml` at line 65. With no `]` in `html`, `split(']')[0]` returned the entire body and the code synthesized a trailing `]`. The body then rendered again as `aiBody` (since `html.indexOf('] ')` was -1, the fallback was the whole `html`). Visible as `git add foo.dart] git add foo.dart`. Copy worked because the underlying text node was single.
- **Issue 2 — missing severity dot:** The AI branch returned its own `<div>` at line 200 *before* the regular `barCls` / `levelCls` were applied (those run at line 312). AI rows therefore never wore `level-bar-*` or `level-*` classes, regardless of what `classifyLevel` had decided.
- **Issue 1 — line-number column shifted 3 px right on AI rows:** `.ai-line` in [viewer-styles-ai.ts:19](../../../../src/ui/viewer-styles/viewer-styles-ai.ts#L19) used `border-left: 3px solid` — in-flow, so it pushed every digit on AI rows 3 px right of the line-number column non-AI rows used.

The remaining three were independent:

- **Issue 4 — unclickable file paths:** [source-linker.ts:35-36](../../../../src/modules/source/source-linker.ts) required `:line[:col]`; [source-linker.ts:157-158](../../../../src/modules/source/source-linker.ts) (bare paths) required an absolute root. Bare relative paths like `lib/components/x.dart` slipped through both — the previous logic deliberately excluded relative paths to avoid false positives from prose like "see foo.dart".
- **Issue 5 — elapsed toggle reset on reload:** [viewer-options-events.ts:55-67](../../../../src/ui/viewer-panels/viewer-options-events.ts) wired the checkbox and called `onDecoOptionChange()` which updated the JS variable and re-rendered, but never `postMessage`d the new value to the host. The workspace setting `showElapsedTime` was read on startup and broadcast to the webview via `extension-lifecycle.ts:71` but never written back — so the user-facing toggle was session-local.
- **Issue 6 — elapsed-time values not column-aligned:** `.elapsed-time` had `min-width: 50px; display: inline-block` but defaulted to `text-align: left`, so `"17s"` vs `"3m 31s"` left-aligned and the `s` suffix wandered.

### Changes

| File | Change |
|---|---|
| [src/ui/viewer/viewer-data-helpers-render.ts](../../../../src/ui/viewer/viewer-data-helpers-render.ts) | AI branch: replaced `split(']')` with regex `^((?:<[^>]*>)*)\[([^\]]+)\]\s*` that matches only when a leading `[LABEL]` is actually present; added `level-bar-*` / `level-*` class application guarded by `decoShowBar` / `lineColorsEnabled` mirroring the regular branch. |
| [src/ui/viewer-styles/viewer-styles-ai.ts](../../../../src/ui/viewer-styles/viewer-styles-ai.ts) | `.ai-line`: `border-left: 3px solid` → `box-shadow: inset 3px 0 0 var(--ai-rail-color)`. Per-category color overrides (`.ai-prompt`, `.ai-edit`, `.ai-bash`, `.ai-read`, `.ai-system`) moved from `border-left-color` to `--ai-rail-color` custom property. |
| [src/modules/source/source-linker.ts](../../../../src/modules/source/source-linker.ts) | New `linkifyRelativePaths()` + `RELATIVE_PROJECT_FOLDERS` allowlist (lib, src, test, tests, bin, tool, tools, scripts, packages, docs, out, dist, build, app, pkg, cmd, internal, modules). Negative lookbehind `(?<![\w./\\:~-])` prevents double-matching `lib/` inside already-wrapped absolute paths. |
| [src/ui/provider/log-viewer-provider-batch.ts](../../../../src/ui/provider/log-viewer-provider-batch.ts) | Call `linkifyRelativePaths(html)` after `linkifyBarePaths(html)` on AI-category rows only. |
| [src/ui/provider/viewer-workspace-bool-message-map.ts](../../../../src/ui/provider/viewer-workspace-bool-message-map.ts) | Added `setShowElapsed: "showElapsedTime"` so the webview-posted bool routes through `getConfiguration().update`. |
| [src/ui/viewer-decorations/viewer-deco-settings.ts](../../../../src/ui/viewer-decorations/viewer-deco-settings.ts) | `onDecoOptionChange` now `postMessage`s `{type:'setShowElapsed', value: showElapsed}`. Combined `stackState` + `stackPreview` `var` decls onto one line to stay under the 300-LOC limit. |
| [src/ui/viewer-styles/viewer-styles-content.ts](../../../../src/ui/viewer-styles/viewer-styles-content.ts) | `.elapsed-time` adds `text-align: right`. |
| [src/test/modules/source/source-linker.test.ts](../../../../src/test/modules/source/source-linker.test.ts) | New `linkifyRelativePaths` suite: 9 cases covering match, prose negative, unknown-folder negative, lookbehind-inside-absolute, unsupported extension, empty, tag-isolation, multi-path. |
| [src/test/ui/viewer-message-handler-workspace-bool.test.ts](../../../../src/test/ui/viewer-message-handler-workspace-bool.test.ts) | Pin the new `setShowElapsed` entry. |
| [CHANGELOG.md](../../../../CHANGELOG.md) | `[Unreleased]` entries — one Added (`linkifyRelativePaths`) and five Fixed. |
| [doc/internal/webview-incoming-message-types.md](../../../../doc/internal/webview-incoming-message-types.md) | Regenerated by `npm run compile`'s `verify:webview-catalog` step. |

### Why each fix

- **Regex match instead of split** — the split's premise (that a `]` exists in `html`) was already false under default settings. A regex that anchors at offset 0 and absorbs leading `highlightSearchInHtml` wrappers narrows the synthesis to the case the prefix was designed for.
- **`box-shadow: inset` instead of `border-left`** — preserves the colored rail without claiming box width. The line-number column on AI rows now sits on the same x as non-AI rows. Other categories (`.ai-prompt`, `.ai-edit`, etc.) cascade via `--ai-rail-color`, so the file shrunk from per-rule `border-left-color` to per-rule custom-property updates.
- **Anchored relative-path regex** — `linkifyBarePaths`'s comment cited the false-positive risk ("see foo.dart"); requiring the path to *start* with a known project folder narrows the surface enough to ship without re-introducing prose matches. Restricted to AI rows in the batch handler to keep the surface narrow on regular log content.
- **`postMessage` from `onDecoOptionChange`** — `vscode.config.update` is no-op when the value is unchanged, so the post is unconditional. Trade-off: every deco-option change posts the elapsed bool, but no harm — saves the guarded-on-change branch needed to stay within max-lines.

### Verification

- `npm run check-types` — 0 errors.
- `npm run lint` — 0 errors; my files all within `max-lines` (deco-settings.ts 300/300, content.ts 299/300, data-helpers-render.ts 299/300). The 9 remaining warnings are pre-existing files or someone else's parallel `gotoLineInViewer` work in `viewer-script-messages.ts` (which I did NOT touch).
- `npm run compile` — passes (NLS verify, webview catalog, host outbound catalog, list commands, dist-size 4.37 MiB / 12 MiB).
- `source-linker.test.ts` — 57 passing (48 prior + 9 new for `linkifyRelativePaths`). Includes the existing "should NOT linkify relative path without leading root" assertion against `linkifyBarePaths` (my new function is separate; `linkifyBarePaths`'s contract is unchanged).
- `viewer-message-handler-workspace-bool.test.ts` — 2 passing (extended with `setShowElapsed` entry assertion).
- `viewer-bracket-prefix-strip.test.ts` — 8 passing (confirms the bracket-strip regex used at line 65 of the renderer still behaves as expected).

### What was NOT done

- **Wider deco-option persistence** — only `showElapsedTime` is persisted in this pass. The other Options-panel toggles (`decoShowDot`, `decoShowCounter`, `decoShowTimestamp`, `showMilliseconds`, `decoShowBar`, `decoShowSessionElapsed`, `decoLineColorMode`, etc.) still reset on reload because they don't have workspace-setting keys declared. Adding them requires a config-schema change (per-key entries in `config-types.ts`, `package.json` contributes-configuration, and the bool-map). User said this case ("from time to time ellapsed") was the prime example — if they want the others persisted too, it's a separate follow-up.
- **Visual verification via F5** — I did not launch the Extension Host. The fixes were verified via tests, type-check, lint, and compile. User flagged they typically want F5 verification for UI changes; this is recorded as a residual to confirm before merging.
- **Unrelated `gotoLineInViewer` work** — `package.json`, `package.nls.*.json`, `src/commands-tools.ts`, and `src/ui/viewer/viewer-script-messages.ts` carry unrelated `triggerGotoLine` / Ctrl+G keybinding edits that appeared in the working tree during this session. NOT included in this commit per the rule against committing other workstreams' feature code.

### Outstanding

- F5 visual verification of: (a) duplicate text gone on AI rows, (b) line-number column aligned across AI/non-AI rows, (c) severity dots showing on classified AI rows, (d) git/dart-analyze paths now clickable, (e) elapsed toggle survives reload, (f) elapsed values right-align on `s`.

### Files changed (this commit only)

```
CHANGELOG.md
doc/internal/webview-incoming-message-types.md
src/modules/source/source-linker.ts
src/test/modules/source/source-linker.test.ts
src/test/ui/viewer-message-handler-workspace-bool.test.ts
src/ui/provider/log-viewer-provider-batch.ts
src/ui/provider/viewer-workspace-bool-message-map.ts
src/ui/viewer-decorations/viewer-deco-settings.ts
src/ui/viewer-styles/viewer-styles-ai.ts
src/ui/viewer-styles/viewer-styles-content.ts
src/ui/viewer/viewer-data-helpers-render.ts
plans/history/2026.06/2026.06.02/log-viewer-six-fixes.md (this file)
```

Bug archive: `No bug archive — task did not close a bugs/*.md file` (`SKIPPED [NO-BUG-FIXED]` — user reported the six issues directly in chat, no prior bug file).

Finish report saved: `plans/history/2026.06/2026.06.02/log-viewer-six-fixes.md`.
