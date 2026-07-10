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
 * Input is one options object `o`, not a positional list: the birth inputs had grown
 * to ten arguments, past the project's 4-param limit, and a positional call is easy to
 * mis-order. Fields: `html`, `errorSuppressed`, `lineTierHidden`, `classHidden`,
 * `catFiltered`, `lvl`, `scopeFilt`, `isAutoHidden`, `flowTag`, and `spLen` — the
 * structured-prefix length (`parseStructuredPrefix().prefixLen`), required for parity
 * with `calcItemHeight()`, which measures the same *displayed* body via
 * `isLineContentBlank` in viewer-line-text-helpers.ts.
 */

/** Get the embedded JavaScript for the lineItem birth-height computation. */
export function getLineBirthScript(): string {
    return /* javascript */ `
function computeLineBirthHeight(o) {
    var _troubleHidden = typeof calcTroubleFiltered === 'function' && calcTroubleFiltered(o.lvl);
    /* Flow-tags 'hidden' mode (plan 109): a [flowmap] line arriving while the mode
       is hidden must be born at height 0, not flash visible until the next recalc. */
    var _flowHidden = typeof calcFlowFiltered === 'function' && calcFlowFiltered(o.flowTag);
    var _lineHidden = o.errorSuppressed || o.lineTierHidden || o.classHidden || o.catFiltered || calcLevelFiltered(o.lvl) || _troubleHidden || _flowHidden || o.scopeFilt || o.isAutoHidden;
    /* Blank-at-birth: gate on !_lineHidden so filtered rows do not get a quarter
       height (which would re-expose them). The probe must carry structuredPrefixLen,
       not html alone: isLineContentBlank measures the post-prefix-strip body, so an
       empty-message logcat line looks blank on recalc but non-blank at birth if the
       length is omitted — the row would flash at full height until the next
       recalcHeights() pass. */
    var _lineBlank = !_lineHidden && typeof isLineContentBlank === 'function'
        && isLineContentBlank({ html: o.html, structuredPrefixLen: o.spLen || 0 });
    return _lineHidden ? 0 : (_lineBlank ? Math.max(4, Math.floor(ROW_HEIGHT / 4)) : ROW_HEIGHT);
}
`;
}
