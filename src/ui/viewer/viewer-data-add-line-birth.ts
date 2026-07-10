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
 * via `calcLevelFiltered(lvl)`. Trouble Mode folds in the same way via
 * `calcTroubleFiltered(lvl)` so a line arriving while the mode is active is born
 * hidden rather than flashing visible until the next recalc. The blank check is
 * gated on `!_lineHidden` so already-filtered rows still collapse fully to 0.
 *
 * `spLen` is the structured-prefix length (`parseStructuredPrefix().prefixLen`).
 * It is required for parity with `calcItemHeight()`, which asks the same question
 * of the *displayed* body — see `isLineContentBlank` in viewer-data-helpers-core.ts.
 */

/** Get the embedded JavaScript for the lineItem birth-height computation. */
export function getLineBirthScript(): string {
    return /* javascript */ `
function computeLineBirthHeight(html, errorSuppressed, lineTierHidden, classHidden, catFiltered, lvl, scopeFilt, isAutoHidden, flowTag, spLen) {
    var _troubleHidden = typeof calcTroubleFiltered === 'function' && calcTroubleFiltered(lvl);
    /* Flow-tags 'hidden' mode (plan 109): a [flowmap] line arriving while the mode
       is hidden must be born at height 0, not flash visible until the next recalc. */
    var _flowHidden = typeof calcFlowFiltered === 'function' && calcFlowFiltered(flowTag);
    var _lineHidden = errorSuppressed || lineTierHidden || classHidden || catFiltered || calcLevelFiltered(lvl) || _troubleHidden || _flowHidden || scopeFilt || isAutoHidden;
    /* Blank-at-birth: gate on !_lineHidden so filtered rows do not get a quarter
       height (which would re-expose them). The probe must carry structuredPrefixLen,
       not html alone: isLineContentBlank measures the post-prefix-strip body, so an
       empty-message logcat line looks blank on recalc but non-blank at birth if the
       length is omitted — the row would flash at full height until the next
       recalcHeights() pass. */
    var _lineBlank = !_lineHidden && typeof isLineContentBlank === 'function'
        && isLineContentBlank({ html: html, structuredPrefixLen: spLen || 0 });
    return _lineHidden ? 0 : (_lineBlank ? Math.max(4, Math.floor(ROW_HEIGHT / 4)) : ROW_HEIGHT);
}
`;
}
