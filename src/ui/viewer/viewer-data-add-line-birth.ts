/**
 * Embedded JavaScript for the regular log-line birth-height computation.
 *
 * Extracted from `viewer-data-add.ts` so that file stays under the eslint
 * 300-line cap. Mirrors `buildDocItem`'s quarter-height-at-birth contract:
 * a streaming whitespace-only row was previously born at `ROW_HEIGHT` and
 * only collapsed on the next `recalcHeights()` pass, leaving a visible
 * full-height gap. Stamps the same `Math.max(4, Math.floor(ROW_HEIGHT / 4))`
 * value `calcItemHeight()` would return so addToData and a later recalc
 * agree on the same row geometry.
 *
 * The streaming-lines filter gap (lines arriving after a level toggle bypassed
 * the filter until `applyLevelFilter()` next ran) is folded into `_lineHidden`
 * via `calcLevelFiltered(lvl)`. The blank check is gated on `!_lineHidden` so
 * already-filtered rows still collapse fully to 0.
 */

/** Get the embedded JavaScript for the lineItem birth-height computation. */
export function getLineBirthScript(): string {
    return /* javascript */ `
function computeLineBirthHeight(html, errorSuppressed, lineTierHidden, classHidden, catFiltered, lvl, scopeFilt, isAutoHidden) {
    var _lineHidden = errorSuppressed || lineTierHidden || classHidden || catFiltered || calcLevelFiltered(lvl) || scopeFilt || isAutoHidden;
    /* Blank-at-birth: gate on !_lineHidden so filtered rows do not get a quarter
       height (which would re-expose them). isLineContentBlank consults html
       only — same input calcItemHeight uses on the next recalc pass. */
    var _lineBlank = !_lineHidden && typeof isLineContentBlank === 'function' && isLineContentBlank({ html: html });
    return _lineHidden ? 0 : (_lineBlank ? Math.max(4, Math.floor(ROW_HEIGHT / 4)) : ROW_HEIGHT);
}
`;
}
