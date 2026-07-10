# Viewer gutter, links, overflow, and AI-row legibility

The log viewer's left gutter showed two parallel colored bars — the severity dot column and a separate AI-activity rail — that shared the same colors and shape and read as two contradictory severity indicators; the severity dots also failed to join into a continuous band, long lines painted unreadable text over the row below, and clickable file links were drawn in a gray that vanished on dark backgrounds. This change makes the gutter carry one meaning, joins same-color runs, contains overflow, restores link visibility, and gives AI rows a readable labeled tag plus a single gutter color.

## Finish Report (2026-07-10)

### Defects addressed

1. **Severity dots did not join.** The connector was a per-pair CSS rule (`:has(+ .level-bar-X)::after`, one selector per level) that painted a half-and-half stripe (`top: 50%`/`bottom: -50%`) only when a row's IMMEDIATE next sibling carried the EXACT same `level-bar-*` class. Any intervening row — a blank line, a `.slow-gap` timing divider, or a stack-frame row — severed the band, and `info` vs `framework` (both `--vscode-charts-blue`: same color, different class) never joined despite looking identical. Users saw disconnected dots where a continuous band was intended.

2. **Long lines bled over the next row.** `.line` used `white-space: pre-wrap` with a fixed one-line height (`calcItemHeight` returns a single `ROW_HEIGHT` for normal rows) and `overflow: visible`. A wrapped second visual line had no allocated height and painted downward over the following row as dim, unreadable ghost text. The `overflow: visible` was required only so the old connector stripe could overshoot into the next row.

3. **File links were invisible.** `.source-link` (clickable `file.ext:line:col`, wired to the `linkClicked` webview message) used `--vscode-editorLineNumber-foreground` (line-number gray), which recedes against the dark viewer background to the point of being unreadable and reading as non-clickable.

4. **AI rows had two competing signals and no tag.** AI activity lines (`[AI Edit]`, `[AI Bash]`, `[AI Ask]`, `[AI Warn]`) rendered the category as plain bracketed text whose only visual cue was a solid `box-shadow` left rail colored per category. The rail sat beside the severity dot column and, sharing the gutter's colored-vertical-bar language, read as a second severity bar. Every other tagged line already renders its `[tag]` as a chip; AI rows were the exception.

### Changes

- **Connector → full-height per-row stripe.** Replaced the per-level `:has(+ .level-bar-X)::after` chain with a single class-agnostic rule: `[class*="level-bar-"]:not(:is(.art-block-start, .art-block-middle, .art-block-end, .line-blank))::after` painting `top: 0`/`bottom: 0` in the row's own `--bar-color`. Consecutive same-color rows abut into one continuous band; the dot (`::before`, z-index 2) stays on top of the stripe (`::after`, z-index 1). No adjacency or class-equality dependency, so same-color runs join across blanks/dividers/stack frames and across same-color-different-class levels. (`viewer-styles-decoration-bars.ts`)

- **`.line` clips its overflow.** Base `.line` changed to `overflow: hidden`; `#log-content.nowrap .line/.stack-header` overrides back to `overflow: visible` so no-wrap mode's long single lines still extend past the row and expand `#log-content`'s scrollWidth for horizontal scroll. The stripe no longer overshoots, so nothing needs to escape the box. (`viewer-styles-lines.ts`)

- **`.source-link` uses the theme link color.** Color changed to `--vscode-textLink-foreground` with a resting `underline dotted`; hover promotes to a solid underline. (`viewer-styles-lines.ts`)

- **AI rows: chip + single gutter dot, rail removed.** The `[AI …]` prefix now renders as `.ai-tag-chip` (reads `--ai-rail-color`, set per category on `.ai-line`), mirroring `.flow-chip`. The `.ai-line` `box-shadow` rail was removed; `--ai-rail-color` is retained solely as the chip's color source. AI rows emit `level-bar-ai` (a dedicated magenta gutter dot, `--vscode-terminal-ansiMagenta`, unused by any severity level) instead of `level-bar-<severity>`, so a run of AI activity reads as its own joined band. Severity of an AI line still tints the text via `_aiLvlCls` (`level-<level>`); only the gutter dot color is AI-dedicated. (`viewer-data-helpers-render.ts`, `viewer-styles-ai.ts`, `viewer-styles-decoration-bars.ts`)

### Tests

- `viewer-severity-bar-connector.test.ts` — repinned to the single `[class*="level-bar-"]::after` stripe: asserts the class-agnostic rule exists, the per-pair `:has(+ .level-bar-` chain is absent, geometry is `top: 0`/`bottom: 0` with no `-50%` overshoot, and the art-block exclusion still matches (now with `.line-blank` appended).
- `viewer-level-line-colors.test.ts` — connector regex updated to the stripe rule; `color-mix(45%)` and no-opacity regression guards retained.
- `viewer-muted-decorations.test.ts` — `source-link` tests repinned: defaults to `textLink-foreground` (not the receding gray) and carries a resting dotted underline promoting to solid on hover; `url-link` stays gray (unchanged).
- Stale comment-only references to the retired `:has()` chain and box-shadow rail updated in `viewer-flutter-banner-group.test.ts`, `viewer-script-null-guards.test.ts`, and `viewer-data-viewport.ts`.

Verification: `check-types` clean; affected tests pass (`viewer-severity-bar-connector` 29, `viewer-level-line-colors` 6, `viewer-column-layout` 10, `viewer-script-null-guards` 21, `viewer-muted-decorations` 11); `npm run compile` and all `verify:*` gates pass (`verify:l10n-keys` clean — no new keys; dist 5.09 MiB under ceiling).

### Known tradeoff (by design)

An AI line that `classifyLevel` tags `error`/`warning` no longer shows a red/amber gutter DOT — it shows the magenta AI dot. The severity is not lost: the AI line's text is still tinted by its level, and the `.ai-tag-chip` category color distinguishes system/warn actions. The gutter dot deliberately answers "is this AI activity" rather than the AI row's severity.

### Out-of-scope observations (not changed)

- `.url-link` still uses the line-number gray that `.source-link` abandoned; bare-URL visibility was not part of the reported symptom.
