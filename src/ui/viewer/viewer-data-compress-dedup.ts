/**
 * Duplicate-line compression (consecutive and non-consecutive modes) for the
 * log viewer webview's height-recalculation pass. Extracted from
 * viewer-data.ts to keep both files under the line limit — recalcHeights()
 * (still in viewer-data.ts) calls applyCompressDedupModes() as its first step.
 */

export function getCompressDedupScript(): string {
    return /* javascript */ `
/**
 * Compression modes:
 * - compressLinesMode: collapse consecutive identical type==='line' rows (normalized plain text).
 *   Earlier rows in each run get compressDupHidden; the last gets compressDupCount.
 * - compressNonConsecutiveMode: collapse identical type==='line' rows globally.
 *   The first seen row keeps compressDupCount; later duplicates get compressDupHidden.
 *
 * Blank lines are intentionally excluded from both modes (blank handling is controlled only by
 * hideBlankLines).
 *
 * Duplicate grouping runs after level/source/search filters set flags on each row. Only rows
 * that would still be eligible for layout (same rules as calcItemHeight except compressDup*)
 * participate, so e.g. "Errors only" does not show one error line with a ×N badge inflated by
 * hidden info duplicates.
 *
 * Always clears compressDupHidden / compressDupCount on every call first, then returns early if
 * compress is off — so toggling compress off cannot leave stale flags on line objects.
 *
 * Performance: O(n) over allLines per recalcHeights. With compress on, addLines must call
 * recalcHeights (see viewer-script-messages) because a new tail line can change which prior
 * line is hidden in a duplicate run.
 */
function applyCompressDedupModes() {
    var i;
    for (i = 0; i < allLines.length; i++) {
        var cleared = allLines[i];
        if (cleared.compressDupHidden) cleared.compressDupHidden = false;
        if (cleared.compressDupCount != null) delete cleared.compressDupCount;
        /* Also clear the hidden-indices list stamped for the peek-dedup click
           handler. Without this, toggling compression off then on while a
           survivor's list is stale could point peekDedupFold at indices that
           are no longer hidden. */
        if (cleared.compressDupHiddenIndices != null) delete cleared.compressDupHiddenIndices;
    }
    var useExactConsecutive = (typeof compressLinesMode !== 'undefined') && compressLinesMode;
    var useGlobal = (typeof compressNonConsecutiveMode !== 'undefined') && compressNonConsecutiveMode;
    /* Numeric-variant fold runs only when no explicit compress mode is on — the explicit modes are
       strict dedup the user opted into, and silently broadening their match rule would surprise. */
    var useNumericVariant = !useExactConsecutive && !useGlobal
        && (typeof collapseNumericVariants !== 'undefined') && collapseNumericVariants;
    var useConsecutive = useExactConsecutive || useNumericVariant;
    if (!useConsecutive && !useGlobal) return;

    /** Build a dedup key from the visible message body — strip the same
     *  structured/source-tag prefix that renderItem removes so lines that
     *  look identical on screen produce the same key.
     *  WHY stack-frame is accepted alongside 'line': a Drift SELECT flood
     *  (11 000+ queries) emits identical \`DriftDebugInterceptor._log (...dart:92:5)\`
     *  stack frames under every call. Gating on \`type === 'line'\` alone meant
     *  non-consecutive compression passed them through untouched and the viewer
     *  rendered thousands of visually identical stack rows. Same plain text
     *  produces the same dedup key across both types. The fold's user-facing
     *  affordance is the inline .dedup-badge ("×N" pill) on the survivor row;
     *  see bugs/048_plan-severity-gutter-decoupling.md. */
    function lineDedupeKey(row) {
        if (!row) return null;
        if (row.type !== 'line' && row.type !== 'stack-frame') return null;
        var html = row.html || '';
        /* Strip structured prefix (timestamp/PID/tag) the same way renderItem does. */
        var useStructured = (typeof structuredLineParsing !== 'undefined' && structuredLineParsing);
        if (useStructured && row.structuredPrefixLen > 0 && typeof stripHtmlPrefix === 'function') {
            html = stripHtmlPrefix(html, row.structuredPrefixLen);
            /* Mirror renderItem: strip the same leading pure-severity head tags ([perf], [warn], …)
               left after the structured prefix so the dedup key matches what the user sees.
               Descriptive tags like [frame-stall] are kept (they stay visible in the render too). */
            if (typeof stripSourceTagPrefix !== 'undefined' && stripSourceTagPrefix && row.sourceTag) {
                html = html.replace(/^(?:\\[(?:perf|performance|warn|warning|error|err|notice|todo|debug|info)\\]\\s?)+/i, '');
            }
        } else if (typeof stripSourceTagPrefix !== 'undefined' && stripSourceTagPrefix && row.sourceTag) {
            html = html.replace(/^(?:\\[[^\\]]+\\]\\s?)+/, '');
        }
        var t = stripTags(html).replace(/\\s+/g, ' ').trim();
        if (t.length === 0) return null;
        /* Numeric-variant fold replaces every digit run with a placeholder so lines that differ
           only by counters/IDs hash to the same key. Source apps that emit "Repeated log #1",
           "Repeated log #2", … flood the viewer otherwise (FloodGuard and exact dedup both see
           distinct strings). Length normalization is intentional — '#1' and '#29' fold together.
           Active only when neither explicit compress mode is on (see useNumericVariant above);
           strict compress keeps the unmodified key. */
        if (useNumericVariant) t = t.replace(/\\d+/g, '<n>');
        if (t.length === 0) return null;
        return t;
    }

    /**
     * True if this line may occupy vertical space when compressDup* flags are cleared.
     * Mirrors calcItemHeight filter gates so duplicate collapse matches what the user can see
     * under current level/source/search/app-only/blank-collapse options.
     * Accepts both 'line' and 'stack-frame' (see lineDedupeKey for rationale).
     */
    function isLineEligibleForDupCompress(row) {
        if (!row) return false;
        if (row.type !== 'line' && row.type !== 'stack-frame') return false;
        if (row.filteredOut || row.excluded || row.levelFiltered || row.sourceFiltered || row.classFiltered || row.sqlPatternFiltered || row.searchFiltered || row.errorSuppressed || row.scopeFiltered || row.repeatHidden || row.metadataFiltered || (row.type === 'line' && row.timeRangeFiltered)) return false;
        var peeking = (typeof isPeeking !== 'undefined' && isPeeking);
        if (!peeking && (row.userHidden || row.autoHidden)) return false;
        if ((typeof hideBlankLines !== 'undefined' && hideBlankLines) && isLineContentBlank(row)) return false;
        if (typeof isTierHidden === 'function' && isTierHidden(row)) return false;
        return true;
    }

    if (useConsecutive) {
        var runStart = -1;
        var runKey = null;

        /* compressDupHiddenIndices: list of allLines indices hidden under this
           run's survivor. The peek-dedup click handler (viewer-peek-chevron.ts)
           reads it to reveal exactly this fold without touching other folds.
           WHY stamped on the survivor and not recomputed on click: click-time
           recomputation would need lineDedupeKey access plus a full scan of
           allLines; stamping is O(N) once per dedup pass and O(1) per click. */
        function flushRun(endInclusive) {
            if (runStart < 0) return;
            var runLen = endInclusive - runStart + 1;
            if (runLen > 1) {
                var j, _hidden = [];
                for (j = runStart; j < endInclusive; j++) {
                    allLines[j].compressDupHidden = true;
                    _hidden.push(j);
                }
                allLines[endInclusive].compressDupCount = runLen;
                allLines[endInclusive].compressDupHiddenIndices = _hidden;
            }
            runStart = -1;
            runKey = null;
        }

        for (i = 0; i < allLines.length; i++) {
            var item = allLines[i];
            var k = lineDedupeKey(item);
            if (k === null || !isLineEligibleForDupCompress(item)) {
                flushRun(i - 1);
                continue;
            }
            if (runKey === null) {
                runStart = i;
                runKey = k;
            } else if (k !== runKey) {
                flushRun(i - 1);
                runStart = i;
                runKey = k;
            }
        }
        flushRun(allLines.length - 1);
        return;
    }

    var firstIdxByKey = Object.create(null);
    var countByKey = Object.create(null);
    /* Per-key list of hidden indices — survivor gets this in compressDupHiddenIndices
       so the peek-dedup click handler can reveal exactly this fold. See the
       consecutive-mode comment above for rationale. */
    var hiddenIdxByKey = Object.create(null);
    for (i = 0; i < allLines.length; i++) {
        var globalItem = allLines[i];
        var globalKey = lineDedupeKey(globalItem);
        if (globalKey === null || !isLineEligibleForDupCompress(globalItem)) continue;
        if (firstIdxByKey[globalKey] == null) {
            firstIdxByKey[globalKey] = i;
            countByKey[globalKey] = 1;
            hiddenIdxByKey[globalKey] = [];
        } else {
            globalItem.compressDupHidden = true;
            countByKey[globalKey]++;
            hiddenIdxByKey[globalKey].push(i);
        }
    }
    for (var key in countByKey) {
        var count = countByKey[key];
        if (count > 1) {
            allLines[firstIdxByKey[key]].compressDupCount = count;
            allLines[firstIdxByKey[key]].compressDupHiddenIndices = hiddenIdxByKey[key];
        }
    }
}
`;
}
