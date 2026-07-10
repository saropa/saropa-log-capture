# Empty-message structured log lines rendered as full-height, tag-only rows

Android devices emit warnings that carry a tag and no message body — `07-10 08:23:05.388 924 17991 W keystore2:` with nothing after the colon. The log viewer rendered each of these as a full-height row containing only a tag chip, and such rows could additionally host the filter-hidden-gap reveal chevron, reproducing the "blank row with an expander arrow" defect that the blank-row affordance work had previously closed for whitespace-only rows.

## Root cause

The viewer's blank-row predicate measured the wrong string.

`isLineContentBlank(item)` in `src/ui/viewer/viewer-data-helpers-core.ts` tested `stripTags(item.html)` — the *stored* html, which still contained the parsed timestamp, PID, TID, level, and tag. But with structured line parsing active, `renderItem()` (`src/ui/viewer/viewer-data-helpers-render.ts`) strips `item.structuredPrefixLen` visible characters off the front before painting, lifting those fields into their own decoration columns.

For an empty-message logcat line the `logcat-threadtime` format in `src/ui/viewer/viewer-structured-line-parser.ts` matches with `msg === ''`, so `prefixLen = plain.length - msg.length` spans the entire line. The renderer therefore stripped everything and painted nothing, while the predicate — reading the unstripped html — reported the row as non-blank.

Three behaviors followed from that single disagreement:

1. `calcItemHeight()` returned `ROW_HEIGHT` instead of the quarter-height sliver.
2. `buildDecoParts()` (`src/ui/viewer-decorations/viewer-deco-content.ts`) gates every decoration cell on `!isBlank`, so the row kept its parsed-tag chip and rendered as a tag with no text.
3. `computeRowAffordances()` (`src/ui/viewer/viewer-data-divider.ts`) skips only blank rows when choosing a chevron anchor, so an empty-message row remained eligible to display the hidden-gap expander.

## Change

`isLineContentBlank()` now measures the body the row actually displays: when structured parsing is active and `item.structuredPrefixLen > 0`, it runs `stripHtmlPrefix()` before the blank test. Because the predicate is the single source of truth consumed by height calculation, decoration cells, affordance anchoring, and `countHiddenNonBlank()`, all three symptoms resolve from the one correction.

`computeLineBirthHeight()` (`src/ui/viewer/viewer-data-add-line-birth.ts`) gained a trailing `spLen` parameter, supplied from `slp.prefixLen` at the `addToData` call site. Without it the birth-time probe measured raw html and a streaming row would be born at full height, collapsing only on the next `recalcHeights()` pass — a visible flash. Existing 9-argument callers are unaffected: `spLen || 0` yields no strip.

## Deliberate scope decisions

- **The collapse is format-agnostic.** An empty-message `sda-log`, `log4j`, or `syslog-3164` line collapses and loses its tag or logger chip, not only logcat. A row displaying a tag and no text is not worth a row. The tag remains in copy output (`viewer-copy.ts` reads `rawText`) and returns in full when structured parsing is switched off. Pinned by test.
- **The predicate is not a complete mirror of the renderer.** `renderItem()` additionally strips leading `[head tag]` brackets. A structured line whose post-prefix body is only head tags would measure non-blank while rendering as chips alone. This is unreachable today because head tags parse from line start, ahead of any timestamp, so the gap is documented at the call site rather than coded around.
- **An entity invariant now carries correctness weight.** `prefixLen` is counted on `stripTags(html)`, which decodes exactly the five entities `escapeHtml` emits, while `stripHtmlPrefix()` counts each `&entity;` as one visible character. The two agree only under that symmetry; a raw `&nbsp;` or numeric entity inside the prefix region would desync them and over-strip a real message into a false blank. Decorations use a literal ` `, never `&nbsp;`. Recorded as a comment and pinned by a test using a tag containing `&`.

## Verification

Eight cases in `src/test/ui/viewer-blank-structured-message.test.ts`, building the real parser, `calcItemHeight`, `buildDecoParts`, and `computeLineBirthHeight` in a VM: blankness in both directions, quarter height, absence of a tag-only row, birth-height parity with `calcItemHeight`, the sda-log collapse, the parsing-off reversal, and the entity-in-prefix guard.

Six coupled test files re-run green (64 cases): `viewer-blank-row-affordance`, `viewer-flow-tags` (whose 9-argument `computeLineBirthHeight` call proves the new parameter is back-compatible), `viewer-data-add-embed`, `viewer-severity-bar-connector`, `viewer-trouble-mode`, `viewer-bracket-prefix-strip`. Typecheck clean.

## Finish Report (2026-07-10)

Three follow-ups recorded above were then completed as an authorized refactor.

### 1. File split to clear the `max-lines` cap

`viewer-data-helpers-core.ts` had reached 362 lines against a 300-line `max-lines` cap — comments inside the template literal count as code lines, because they are string content rather than TypeScript comments that `skipComments` would drop. The per-line text/HTML classification block (separator/ASCII-art detection, invisible-char normalization, blank detection, stack-frame reformatting) moved to a new sibling `viewer-line-text-helpers.ts`. `getViewerDataHelpersCore()` concatenates the new module's script into its own returned string, so the emitted webview JavaScript, and the scope every test builds from it, is unchanged. Core dropped to 235 physical lines; the new module is 177. The cap warning is gone.

### 2. Options object for `computeLineBirthHeight`

The birth-height inputs had grown to ten positional parameters, past the project's four-parameter limit and easy to mis-order. The signature became a single options object. The one production call site and the two test call sites were updated. `viewer-flow-tags` and the blank-structured-message suite now encode the object shape rather than a positional list.

### 3. Memoized `isLineContentBlank`

`recalcHeights()` calls the predicate for every row, and the renderer calls it again per visible row. The result is memoized on `item._contentBlank` under a key that folds in the two global toggles that can change the answer for a fixed item — `structuredLineParsing` (the parsed-prefix strip) and `formatEnabled` (`toggleFormat` flips it in place and only calls `recalcHeights`, so a file-mode row's formatted-output blankness can change without the item being rebuilt) — plus `fileMode` for safety. `toggleFormat` was read to confirm it does not rebuild items, which is why the key cannot be `structuredLineParsing` alone.

### Defect the review caught and fixed

The memo introduced a stale-cache regression in the manual line-edit feature. `saveEditedLine` (`viewer-edit-modal.ts`) rewrites `allLines[lineIdx].html` in place and re-renders without a recalc; the cache key does not cover `item.html`, so an edit that turned a filled line into whitespace would keep its stale full-height, barred rendering while displaying blank. Before the memo the predicate recomputed from current html on every call. Fixed by clearing `item._contentBlank` at the edit site. The `''`-empty and blank-to-filled directions self-correct — the predicate's empty-html guard returns before the cache, and a line born blank never has its memo written — so only a filled-to-whitespace (or prefix-strips-to-nothing) edit was the live path. Any future in-place html mutation on a line item must clear the memo; the invariant is documented at both the predicate and the edit site.

### Verification

Eleven cases in `viewer-blank-structured-message.test.ts` (the original eight plus memo recompute-on-toggle, the stale-after-in-place-edit regression, and a probe-object-isolation check). The pure-VM specs that build the scope from `getViewerDataHelpersCore()` re-run green — `viewer-blank-row-affordance`, `viewer-flow-tags`, `viewer-dart-frame-format`, `viewer-data-add-embed`, `viewer-ascii-art-block`, `viewer-ascii-art-collapse` — proving the extraction preserved the concatenated scope and the options-object call is back-compatible. `check-types` clean; eslint clean on all touched files, including the `max-lines` warning now cleared. eslint also caught a backtick pair in an edit-site comment that would have truncated the emitted webview template literal — `tsc` accepted it as valid TypeScript, so the lint pass was the gate that mattered here.
