/**
 * Copy provenance helpers for the cumulative cross-session feed (plan 057).
 *
 * Extracted from viewer-copy.ts to keep that file under its 300-LOC cap. Provides
 * the per-line file code prefix (`A1139  `) and the legend block (`# A = /abs/path`)
 * that copy formats prepend when the live view spans ≥2 origin files. Concatenated
 * into the same webview script scope as viewer-copy.ts, so its functions are in
 * scope for the serializers there. Reads the registry from viewer-file-code-stamp.ts
 * (`fileCodeCount()` / `fileCodeList()`) and the per-item `fileLetter` / `fileLineNo`.
 */
export function getCopyFileCodesScript(): string {
    return /* javascript */ `
/* True when the live view holds ≥2 origin files — the only case codes apply. */
function copyCodesActive() {
    return typeof fileCodeCount === 'function' && fileCodeCount() >= 2;
}

/** "A1139  " prefix for a line item, or '' when codes are inactive / unstamped. */
function copyCodePrefix(item) {
    if (!copyCodesActive() || !item || !item.fileLetter) return '';
    return item.fileLetter + (typeof item.fileLineNo === 'number' ? item.fileLineNo : '') + '  ';
}

/** Legend block ("# A = /abs/path") for the distinct files referenced by lines,
    in first-referenced order. Empty when codes are inactive. */
function copyCodeLegend(lines) {
    if (!copyCodesActive()) return '';
    var seen = {}, order = [];
    for (var i = 0; i < lines.length; i++) {
        var it = lines[i];
        if (it && it.fileLetter && !seen[it.fileLetter]) { seen[it.fileLetter] = 1; order.push(it.fileLetter); }
    }
    if (order.length === 0) return '';
    var pathByLetter = {};
    if (typeof fileCodeList === 'function') {
        var fl = fileCodeList();
        for (var j = 0; j < fl.length; j++) { pathByLetter[fl[j].letter] = fl[j].path; }
    }
    var out = [];
    for (var k = 0; k < order.length; k++) { out.push('# ' + order[k] + ' = ' + (pathByLetter[order[k]] || '')); }
    return out.join('\\n') + '\\n';
}
`;
}
