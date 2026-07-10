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

## Known follow-ups (not addressed)

- `viewer-data-helpers-core.ts` stands at 362 lines against a 300-line `max-lines` cap. The cap was already exceeded before this change; the added rationale comments widened the gap. The whitespace/entity normalization helpers (`decodeHtmlWhitespaceEntities`, `normalizeForBlankCheck`, `isAsciiBoxDrawingDecorLine`, `isSeparatorLine`) are a cohesive extraction candidate.
- `computeLineBirthHeight()` now takes 10 positional parameters against a project limit of 4; it was already at 9. Collapsing the inputs into one options object built at the `addToData` call site would remove the positional coupling that two test files currently encode by comment.
- Blankness is immutable per row for a fixed parsing state, yet `isLineContentBlank()` is recomputed for every row on every recalc and again per visible row during render. Memoizing onto the item, invalidated when the structured-parsing toggle changes, would remove the repeated `stripHtmlPrefix` + `stripTags` + normalization passes.
