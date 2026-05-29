# AI Row Gutter Parity + Bare-Path Linkification

## What triggered the work

User looked at the log viewer rendering of `d:\src\contacts\reports\20260529\20260529_123051_contacts.log` and asked two questions about the Claude Code AI activity rows interleaved with the captured Flutter log: (1) "where does the purple & yellow text come from?" — pointing at a stretch of `[AI Bash]` (purple) and `[AI Edit]` (yellow) lines that sat between `T12:58:22 System Command Run: franececece` and `T14:48:09 MediaCodec Media Quality Service not found`, with the rest of the log's line-number / timestamp gutter visibly absent on those rows; and (2) "can we show time, set a tag, indent it to the other text and ALSO detect paths (e.g. d:/src/contacts/lib/views/home/home_tab.dart)?" After explaining the source (Claude Code JSONL parsed by `src/modules/ai/ai-jsonl-parser.ts`, formatted by `ai-line-formatter.ts`, colored by `viewer-styles-ai.ts`), the user authorized the suggested follow-up: fold AI rows into the standard prefix chain so they share the gutter columns, and add a bare-path linkifier so `[AI Edit] <path>` rows become clickable.

## Finish Report (2026-05-29)

### Critical Note

This work will be reviewed by another AI.

### Scope

(B) VS Code extension — TypeScript only. No Flutter / Dart code.

### Files Changed

- `src/modules/source/source-linker.ts` — added `linkifyBarePaths()` export plus `BARE_PATH_PATTERN_SRC` / `buildBarePathPattern()` / `linkifyBarePathSegment()` helpers.
- `src/ui/provider/log-viewer-provider-batch.ts` — import `linkifyBarePaths`; in `buildPendingLineFromLineData`, call it after `buildLogLineHtmlWithOptionalDriftArgsDim` gated on `!data.isMarker && data.category?.startsWith('ai-')`.
- `src/ui/viewer/viewer-data-helpers-render.ts` — AI branch (~line 183) now emits `getSlowGapHtml + getDecorationPrefix + getElapsedPrefix` in front of the existing `aiPrefix + aiCompress + aiBody`. Declarations consolidated on one line to keep the file under the 300-line max-lines cap.
- `src/ui/viewer-styles/viewer-styles-ai.ts` — moved `.line.ai-line { padding-left: 13px }` into a `.line.ai-line:not(:has(.line-decoration))` rule so the decoration column's larger `--deco-prefix-width-em` padding wins when decorations are on; 13px fallback remains for decoration-off mode.
- `src/test/modules/source/source-linker.test.ts` — added `import linkifyBarePaths` and a 10-test `suite('linkifyBarePaths')` block.
- `CHANGELOG.md` — new `## [Unreleased]` block above the 7.14.1 heading with one entry under `### Changed` covering both fixes.

### Files NOT changed (left in working tree from prior work)

- `package.json` / `package-lock.json` — version bump 7.14.0 → 7.14.1 was already uncommitted at session start. Not part of this task.
- `src/ui/viewer-styles/viewer-styles-lines.ts` — `transform: translateZ(0)` row-isolation fix was already uncommitted at session start (someone else's per-row compositor work). Not part of this task.

### Diff Summary

**Bare-path linkifier (`source-linker.ts`):**
```ts
const BARE_PATH_PATTERN_SRC =
    `(?<![\\w./\\\\:~-])(?:[A-Za-z]:[\\\\/]|/)[\\w./\\\\:~-]+\\.(EXT_SET)\\b`;
```
- Regex anchors at either a Windows drive letter (`d:/`, `D:\`) or POSIX root (`/`).
- Negative lookbehind `(?<![\w./\\:~-])` rejects matches when the leading `/` is mid-word — without it the `/` in `lib/foo.dart` (relative path mid-prose) or `https://example.com/foo.dart` (URL) would falsely anchor a match.
- Extension allowlist (`EXT_SET`) is the existing `sourceExtensions` set shared with `linkifyHtml`, so `.log`, `.txt`, `.md`, etc. are deliberately not matched.
- Wraps in `<a class="source-link" data-path="..." data-line="1">…</a>` reusing `buildPathSegmentSpans` so Ctrl+hover/Ctrl+click filtering works identically to stack-frame links.
- `data-line="1"` falls through to the existing click handler's `parseInt(... || '1')` default, so no click-handler change required.

**Gating (`log-viewer-provider-batch.ts`):**
```ts
if (!data.isMarker && data.category && data.category.startsWith('ai-')) {
    html = linkifyBarePaths(html);
}
```
- Bare-path pass only runs for `ai-bash` / `ai-edit` / `ai-read` / `ai-prompt` / `ai-system` rows.
- Regular log lines are unaffected, so the deliberate negative case in `linkifyHtml` ("see foo.dart 42 description" must stay plain) is preserved untouched.

**Prefix chain (`viewer-data-helpers-render.ts`):**
```js
var _aiGap = getSlowGapHtml(...), _aiDeco = getDecorationPrefix(...), _aiElapsed = getElapsedPrefix(...);
return _aiGap + '<div class="line ai-line ...">' + _aiDeco + _aiElapsed + aiPrefix + aiCompress + aiBody + '</div>';
```
- AI rows now emit the same `gap + deco + elapsed` chain as the regular `.line` branch (`viewer-data-helpers-render.ts:303`), so columns align across the viewer.
- All three helpers degrade to empty string when their gating settings (`areDecorationsOn()`, `showElapsed`) are off — AI rows then render the same as before this change.
- `getSlowGapHtml` draws a "── 1h gap ──" divider when AI tool calls sit inside a long-quiet stretch of log, which previously rendered as a blank.

**CSS fallback (`viewer-styles-ai.ts`):**
```css
.line.ai-line { border-left: 3px solid …; opacity: 0.85; }
.line.ai-line:not(:has(.line-decoration)) { padding-left: 13px; }
```
- Required because `.line.ai-line` and `.line:has(.line-decoration)` are same-specificity (2 classes / 1-class + `:has()` pseudo). Without the `:not(:has(...))` restriction, the AI rule's `padding-left: 13px` declared later in the bundle order would override the decoration column's `--deco-prefix-width-em` padding (~200px), pulling AI text out of column alignment.

### Deep Review

- **Logic & safety:** `barePathRegex.lastIndex = 0` reset on every `linkifyBarePathSegment` call (required for `/g` regex shared across invocations). No async, no recursion, no shared mutable state beyond the cached regex.
- **Architecture:** Reuses `escapeHtml`, `buildPathSegmentSpans`, `getSlowGapHtml`, `getDecorationPrefix`, `getElapsedPrefix` — no parallel implementations. Gate at the call site, not inside the linker module — matches how `linkifyHtml` is wired.
- **Performance:** Bare-path regex only runs for `ai-*` rows (rare relative to total log volume). The negative lookbehind costs one char of lookback per candidate position, well below the cost of the existing `linkifyHtml` scan. No new I/O.
- **UI/UX:** Existing AI border-rail color scheme preserved. Click handler default (`data-col="1"`) produces a sensible "open at file top" behavior for bare paths. `:has()` is supported in all Electron versions VS Code ships with.
- **Documentation:** Verbose doc headers on `linkifyBarePaths` and `BARE_PATH_PATTERN_SRC` name the failure modes the conservative pattern + lookbehind exist to prevent (prose `lib/foo.dart`, URL `https://example.com/foo.dart`). AI render branch has an 8-line WHY comment naming the visible failure mode (text against left edge) and the CSS interaction. Test comments name the regression cases.

### Testing Validation

**A. Existing-test audit (grep across `src/test/` for changed symbols):**

| File | Decision | Verified by |
| --- | --- | --- |
| `src/test/modules/source/source-linker.test.ts` | Existing 38 `linkifyHtml` / `linkifyUrls` tests untouched. New 10 `linkifyBarePaths` tests added. | Ran `npm run test:file -- out/test/modules/source/source-linker.test.js` → **48 passing**. |
| `src/test/ui/viewer-broadcaster-live-line.test.ts` | All cases use `category: 'stdout'`; my `ai-*` gate never fires. | Ran the file → **11 passing**. |
| `src/test/modules/ai/ai-line-formatter.test.ts` | Formatter API unchanged (no edits to `formatAiEntry` / `filterAiEntries`). | Ran the file → **12 passing**. |
| `src/test/modules/ai/ai-jsonl-types.test.ts` | Tests `toolNameToCategory()`; I didn't touch the function or the `AiCategory` union. | Audited by inspection — no symbols I changed are referenced. |
| `src/test/modules/ai/ai-prompt.test.ts` | No overlap with changed symbols. | Audited by inspection. |
| `src/test/ui/viewer-data-helpers-render-fw-muted.test.ts` | Tests fw-tier severity (unchanged territory). | Ran the file → **3 passing**. |
| `src/test/extension-smoke.test.ts` | Activation only; sensitive to extension import errors. | Ran `npm run test:smoke` → **1 passing** (extension activates 250ms). |

No existing test required modification — none pinned a value or behavior I changed.

**B. New behavior coverage in `linkifyBarePaths`:**

- `should linkify Windows drive-letter path with forward slashes` — `d:/src/...`
- `should linkify Windows drive-letter path with backslashes` — `D:\src\...`
- `should linkify POSIX absolute path` — `/usr/local/...`
- `should NOT linkify bare filename in prose (no leading root)` — `foo.dart` mid-sentence
- `should NOT linkify relative path without leading root` — `lib/foo.dart` mid-sentence (this and the URL case were the two that failed with my first regex, both fixed by adding the negative lookbehind)
- `should not double-wrap inside existing HTML tags` — tag-split regex skips inside `<…>`
- `should reject URL-like context (preceding //)` — `https://example.com/foo.dart`
- `should handle empty string` — early exit
- `should not match unsupported extension` — `.log` deliberately excluded
- `should linkify only the path, leaving surrounding text untouched`

### Quality Gates

- `npm run preflight` (doctor + check-types + verify-nls) — **clean**, 0 errors, NLS aligned across 465 keys × 11 locales.
- `npm run lint` — 6 pre-existing warnings, 0 errors, **0 new warnings**. (The new `max-lines` warning my first edit briefly added in `viewer-data-helpers-render.ts` was resolved by consolidating 3 `var` declarations into one statement.)
- `npm run compile` — **clean**; `dist/extension.js` 4.31 MiB (below 12 MiB cap); webview-incoming, webview-outbound, and list-commands catalogs all match sources.
- `npm run compile-tests` — **clean**.
- `npm run test:smoke` — **passing** (extension activation).
- Source-linker, broadcaster, AI formatter, and render-fw-muted test files — all **passing**.

### l10n

SKIPPED [B-NOT-IN-SCOPE] — extension uses NLS pipeline (`package.nls*.json`), not Flutter ARB. No `%key%` additions to `package.json`; `verify-nls` clean.

### Bug Archival

`No bug archive — task did not close a bugs/*.md file.` This was a user-initiated polish/feature pass, not a tracked defect.

### Outstanding Work

None. The two questions the user asked are fully answered: AI rows now share the gutter columns + clickable paths land for `[AI Edit]` / `[AI Read]` rows that surface absolute file paths. Path truncation (the `truncatePath` helper in `ai-line-formatter.ts` clips paths longer than 60 chars to `...tail`) was left untouched — truncated paths start with `...` and so don't match the bare-path regex's drive-letter / POSIX-root anchor, which means very long paths will not be linkified. That's an acceptable trade-off for now since the click would otherwise open the wrong file; widening this would require changing the formatter to preserve full paths and use CSS ellipsis for display, which is out of scope for this task.

Finish report saved: plans/history/2026.05/2026.05.29/ai-row-gutter-and-bare-path-linkify.md
