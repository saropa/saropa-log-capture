/**
 * Grouped-block copy actions for the log viewer context menu — Copy Error/Warning (plain text),
 * Copy Error/Warning JSON (structured, for analysts), and Copy DB cluster.
 *
 * Extracted from viewer-context-menu-line-actions.ts to keep that file under the 300-line limit.
 * Concatenated into the same webview script scope, so it relies on globals defined elsewhere
 * (allLines, stripTags, vscodeApi, showCopyToast, formatCopyToastMessage, sessionInfoData,
 * computeIncidentLineRange, computeDbTimestampBurstLineRange, computeAsciiArtBlockLineRange,
 * effectiveErrorWarningLevel, copyContextLines).
 *
 * Copy Error/Warning (both variants) includes `copyContextLines` lines of surrounding, non-error
 * context before/after the incident — the same setting `copy-with-source` already honors
 * (viewer-context-menu-line-actions.ts) — so an analyst gets a line or two of lead-up/aftermath,
 * not just the bare fault. Copy DB cluster / Copy ASCII art block stay exact: those groupings are
 * already a complete logical unit, and padding them with unrelated neighbor lines would blur it.
 */

/** Get the grouped-block copy handler script. */
export function getContextMenuBlockCopyScript(): string {
    return /* javascript */ String.raw`
/* Join the stripped text of allLines[lo..hi] with newlines. Shared by all grouped-block copy actions
   so the copied body is byte-identical whether the user picks the plain-text or the JSON variant. */
function joinLineRangeText(lo, hi) {
    var parts = [];
    for (var i = lo; i <= hi; i++) {
        var li = allLines[i];
        if (li && li.html != null) parts.push(stripTags(li.html));
    }
    return parts.join(String.fromCharCode(10));
}

/* Effective severity for an incident block: prefer the right-clicked line, else scan the range.
   Mirrors the menu-gate label logic so the copied 'level' matches the "Copy Error" vs "Copy Warning"
   wording the user just clicked. Defaults to 'error' when nothing in the range classifies. */
function incidentBlockLevel(inc, lineData) {
    if (typeof effectiveErrorWarningLevel !== 'function') return 'error';
    var lvl = effectiveErrorWarningLevel(lineData);
    for (var i = inc.lo; i <= inc.hi && !lvl; i++) lvl = effectiveErrorWarningLevel(allLines[i]);
    return lvl === 'warning' ? 'warning' : 'error';
}

/* Expand [lo, hi] by copyContextLines on each side, clamped to allLines bounds. Level/severity
   is always judged from the ORIGINAL incident range (a neighbor context line must never dilute
   what the copy is reporting as); only the copied text and line span grow. */
function expandByContextLines(lo, hi) {
    var n = typeof copyContextLines === 'number' ? Math.max(0, Math.min(20, copyContextLines)) : 0;
    return { lo: Math.max(0, lo - n), hi: Math.min(allLines.length - 1, hi + n) };
}

/* Copy the incident block as JSON for analysts. The HOST builds the final object because only the
   extension holds the absolute log path (currentFileUri); we hand it the block text, severity,
   1-based line range, first timestamp, and session metadata, then it attaches logPath + logFile. */
function copyIncidentBlockAsJson(inc, lineData) {
    var xJ = expandByContextLines(inc.lo, inc.hi);
    var textJ = joinLineRangeText(xJ.lo, xJ.hi);
    if (textJ.length === 0) return;
    var levelJ = incidentBlockLevel(inc, lineData);
    var tsJ = (allLines[inc.lo] && (allLines[inc.lo].timestamp || allLines[inc.lo].ts)) || lineData.timestamp || lineData.ts || null;
    // sourceLineNo is the real 1-based FILE line (accounts for the session header block); the
    // array index alone undercounts by the header's length, pointing analysts at the wrong lines.
    var loLineNo = (allLines[xJ.lo] && allLines[xJ.lo].sourceLineNo != null) ? allLines[xJ.lo].sourceLineNo : xJ.lo + 1;
    var hiLineNo = (allLines[xJ.hi] && allLines[xJ.hi].sourceLineNo != null) ? allLines[xJ.hi].sourceLineNo : xJ.hi + 1;
    vscodeApi.postMessage({
        type: 'copyErrorWarningJson',
        errorText: textJ,
        level: levelJ,
        lineStart: loLineNo,
        lineEnd: hiLineNo,
        timestamp: tsJ ? new Date(tsJ).toISOString() : null,
        sessionInfo: typeof sessionInfoData !== 'undefined' ? sessionInfoData : null,
    });
    if (typeof showCopyToast === 'function') {
        var nJ = xJ.hi - xJ.lo + 1;
        showCopyToast('Copied ' + levelJ + ' block (' + nJ + ' line' + (nJ === 1 ? '' : 's') + ') as JSON');
    }
}

/* Copy a contiguous line range as plain text with a "Copied lines L-H (N characters)" toast.
   Reports real FILE line numbers via sourceLineNo (accounts for the session header block),
   not the raw allLines array index, which undercounts by the header's length. */
function copyLineRangePlain(lo, hi) {
    var text = joinLineRangeText(lo, hi);
    vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
    if (text.length > 0 && typeof showCopyToast === 'function') {
        var loLineNo = (allLines[lo] && allLines[lo].sourceLineNo != null) ? allLines[lo].sourceLineNo : lo + 1;
        var hiLineNo = (allLines[hi] && allLines[hi].sourceLineNo != null) ? allLines[hi].sourceLineNo : hi + 1;
        showCopyToast(formatCopyToastMessage('lines', loLineNo, hiLineNo, text.length));
    }
}

/**
 * Handle the grouped-block copy actions. Returns true when @action is one of them so the caller can
 * short-circuit before its per-line switch; false otherwise so unrelated actions fall through.
 */
function handleBlockCopyAction(action, lineIdx, lineData) {
    if (action === 'copy-error-warning-block') {
        var inc = (typeof computeIncidentLineRange === 'function') ? computeIncidentLineRange(lineIdx) : null;
        if (inc) {
            var xB = expandByContextLines(inc.lo, inc.hi);
            copyLineRangePlain(xB.lo, xB.hi);
        }
        return true;
    }
    if (action === 'copy-error-warning-json') {
        var incJ = (typeof computeIncidentLineRange === 'function') ? computeIncidentLineRange(lineIdx) : null;
        if (incJ) copyIncidentBlockAsJson(incJ, lineData);
        return true;
    }
    if (action === 'copy-db-cluster-block') {
        var dbR = (typeof computeDbTimestampBurstLineRange === 'function') ? computeDbTimestampBurstLineRange(lineIdx) : null;
        if (dbR) copyLineRangePlain(dbR.lo, dbR.hi);
        return true;
    }
    if (action === 'copy-ascii-art-block') {
        var artR = (typeof computeAsciiArtBlockLineRange === 'function') ? computeAsciiArtBlockLineRange(lineIdx) : null;
        if (artR) copyLineRangePlain(artR.lo, artR.hi);
        return true;
    }
    return false;
}
`;
}
