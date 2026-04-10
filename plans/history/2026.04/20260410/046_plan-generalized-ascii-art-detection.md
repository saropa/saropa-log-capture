# 046 - Generalized ASCII Art Detection

## Problem

The existing `isSeparatorLine` heuristic catches rule/border lines (`═══`, `───`, `***`) and paired-bar content (`│ text │`, `║ text ║`), but misses **pixel-based ASCII art** that uses letters and punctuation as shading characters (e.g. the Saropa logo, figlet banners, image-to-ASCII output). These blocks render as noisy, unstyled log lines instead of getting the art-block visual treatment (yellow tint, shimmer, grouped layout).

## Goal

Detect multi-line ASCII art blocks that use alphanumeric/punctuation "pixels" and flag them with `isSeparator = true` so they receive the existing art-block grouping and styling.

## User setting

`saropaLogCapture.viewerDetectAsciiArt` (boolean, default `false`).

- Sits next to the existing `viewerGroupAsciiArt` in `package.json` and config — same feature family.
- Default off because the sliding-window heuristic has a per-line cost and may false-positive on unusual logs. Users opt in.
- When off, zero overhead — the scoring path is never entered.
- `viewerGroupAsciiArt` controls the visual grouping once lines are flagged; `viewerDetectAsciiArt` controls whether the heuristic detection runs. Both must be on for the full effect.

## Approach

No single line is enough to confirm ASCII art. Use a **scoring system over a sliding window** of consecutive lines, looking for the absence of normal language patterns and the presence of geometric text structure.

### Heuristics (scored per line within the window)

1. **Shading-character density** (+25/+20) -- Long runs of identical heavy characters (`@#MW&8%`) or light fill (`.`, `-`, `+`, `~`, `:`) that don't appear in normal logs. Regex: `([@#MW&8%]{5,})` or `([.\-+~=:]{10,})`.

2. **Consonant clusters** (+25) -- 5+ consecutive consonants with no vowels. Normal English and code have predictable vowel frequency. A line like `mhyso+++oosydNNMMMMMMMMMdP+` fails immediately.

3. **High punctuation-to-alphanumeric ratio** (+25) -- If >40% of non-space characters are punctuation (excluding JSON/XML structural chars `{`, `}`, `"`, `:`), the line is likely shading or edges.

4. **Repeated identical characters** (+15) -- 3+ consecutive identical characters (e.g. `MMM`, `...`).

5. **Low token count** (+15) -- Lines ≥15 chars with ≤2 space-separated tokens. Art lines are dense single-token blocks; normal log lines have many words.

6. **Exclusion penalty** (-30) -- Known log formats: package paths, URLs, hex literals, base64, JSON/array openers.

### Sliding window

- Maintain a window of the last 12 lines (bounded).
- Each line accumulates a 0–100 score from the per-line heuristics above.
- **Majority-in-window:** at least 70% of lines must score ≥35 (not strict consecutive — one weak line inside art doesn't break detection).
- **Vertical uniformity bonus** (+10 to window average): if trimmed line-length spread across the window is <15 characters, reward the fixed-width structure typical of ASCII art generators.
- **Final gate:** window average score (with bonuses) must reach 40.
- When a block is flagged, the window is cleared so prior entries don't pollute detection of the next block.

### Integration with existing system

- Runs inside `addToData()` after the existing `isSeparatorLine` check, gated by `viewerDetectAsciiArt`.
- Lines already flagged `isSeparator` by the existing check are not re-scored.
- Newly flagged lines get `lvl = 'info'` (same as existing separators) so they don't pollute error signals.
- The existing `artBlockTracker` handles grouping and rendering once lines are flagged.

## Risks

- **False positives** on minified JS, base64 payloads, hex dumps, Android class paths. Mitigate with exclusion patterns for known formats (`0x`, `==` base64 padding, URL patterns, package paths).
- **Performance** in hot sessions. The window scan is bounded O(1) per line (fixed 12-entry window, 3 small loops per call). Setting defaults to off so users with high-throughput logs aren't affected.
- **Retroactive flagging** -- if a block is only confirmed after N lines, we need to go back and re-flag/re-render earlier lines. This has implications for virtual scroll and height recalculation.

## Files affected

- `package.json` -- `viewerDetectAsciiArt` setting definition
- `package.nls.json` (+ all NLS files) -- setting title and description
- `src/modules/config/config-types.ts` -- added to `SaropaLogCaptureConfig`
- `src/modules/config/config.ts` -- reads the setting
- `src/ui/viewer/viewer-script.ts` -- passes setting to webview
- `src/ui/viewer/viewer-data-add.ts` -- integrates scoring into `addToData` flow
- `src/ui/viewer/viewer-data-add-ascii-art-detect.ts` -- embedded JS: `scoreAsciiArtLine` + `feedAsciiArtDetector`
- `src/modules/analysis/ascii-art-score.ts` -- TS source-of-truth for unit tests (sync contract with JS mirror)
- `src/test/modules/analysis/ascii-art-score.test.ts` -- per-line scoring tests
- `src/test/ui/viewer-ascii-art-block.test.ts` -- structural integration tests

## Complexity

Medium-high. The heuristics are individually simple but the sliding window with retroactive flagging adds state management complexity in the webview.
