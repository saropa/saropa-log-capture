/**
 * Embedded JavaScript for the structured-file (non-log) line-item builder.
 *
 * Extracted from `viewer-data-add.ts` so that file stays under the eslint
 * 300-line cap. The builder must keep blank-at-birth parity with
 * `calcItemHeight()` — a streaming whitespace-only row was previously born
 * at `ROW_HEIGHT` and only collapsed on the next `recalcHeights()` pass,
 * leaving a visible full-height gap between non-blank rows until layout was
 * re-triggered. The same `Math.max(4, Math.floor(ROW_HEIGHT / 4))` value
 * `calcItemHeight()` would return is stamped here so the two paths agree on
 * the same row geometry. The blank check is gated on `!_docHidden` so
 * already-filtered rows still collapse fully to 0 (a quarter > 0 would
 * silently re-show them).
 */

/** Get the embedded JavaScript for the docItem builder. */
export function getDocItemBuilderScript(): string {
    return /* javascript */ `
function buildDocItem(html, rawText, category, ts, sp, lineSource, catFiltered) {
    /* Hidden-first: when category or level filter excludes this row at birth,
       it must be born at height 0 (not a quarter) so it stays fully collapsed
       until the user widens a filter. */
    var _docHidden = (catFiltered || calcLevelFiltered('info'));
    /* Blank-at-birth: gate on !_docHidden so filtered rows do not get a quarter
       height (which would re-expose them). isLineContentBlank consults html
       only — same input calcItemHeight uses on the next recalc pass. */
    var _docBlank = !_docHidden && typeof isLineContentBlank === 'function' && isLineContentBlank({ html: html });
    return { html: html, rawText: rawText || null, type: 'line', height: _docHidden ? 0 : (_docBlank ? Math.max(4, Math.floor(ROW_HEIGHT / 4)) : ROW_HEIGHT), category: category, groupId: -1, timestamp: ts, level: 'info', seq: nextSeq++, sourceTag: null, logcatTag: null, sqlVerb: null, tier: undefined, filteredOut: catFiltered, sourceFiltered: false, sqlPatternFiltered: false, classFiltered: false, classTags: [], isSeparator: false, errorClass: null, errorSuppressed: false, fw: undefined, sourcePath: sp || null, scopeFiltered: false, isAnr: false, autoHidden: false, source: lineSource, timeRangeFiltered: false, recentErrorContext: false, levelFiltered: calcLevelFiltered('info') };
}
`;
}
