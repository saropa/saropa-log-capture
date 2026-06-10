/**
 * Per-file letter-code registry for the cumulative cross-session live feed (plan 057).
 *
 * The live Logs viewer never clears at debug-session boundaries — every broadcast
 * line from every session in the window's lifetime accumulates in one continuous
 * `allLines`, while each session writes its own `.log` file. So a single global row
 * number (idx+1 / seq) matches no file on disk and copy carries no provenance.
 *
 * This assigns each distinct origin file a sequential letter (A, B, … Z, AA, AB …)
 * in first-seen order and stamps `fileLetter` + a per-file `fileLineNo` (resets to 1
 * at each file's first content row) onto the items `addToData()` just pushed. The
 * gutter and copy use the pair `A1139`; the letter→path map drives the files dialog
 * and the copy legend.
 *
 * Mirrors the post-hoc stamping pattern of viewer-source-line-stamp.ts: one input
 * line can push multiple items (stack header + synthetic chip, folded frames), so we
 * bracket the addToData call with `before`/`allLines.length` to catch them all.
 *
 * Lines parsed from a single loaded file carry no `logFileUri` (the feed is then
 * single-file) — the gutter keeps its existing bare number and no letter shows.
 */
export function getFileCodeStampScript(): string {
    return /* javascript */ `
/* path -> { letter, name, path, lineCount, firstTs, lastTs }; fileCodeOrder holds
   the paths in first-seen order so the index drives the letter assignment. */
var fileCodeByPath = {};
var fileCodeOrder = [];

/** A, B, … Z, AA, AB … for a 0-based index (bijective base-26). */
function fileCodeLetter(n) {
    var s = '';
    n = n | 0;
    do {
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
}

/** Number of distinct origin files seen so far (drives "show letters" gate + footer counter). */
function fileCodeCount() { return fileCodeOrder.length; }

/** Look up or create the registry entry for an origin log file path. */
function ensureFileCode(path, name) {
    var existing = fileCodeByPath[path];
    if (existing) return existing;
    var entry = {
        letter: fileCodeLetter(fileCodeOrder.length),
        path: path, name: name || path, lineCount: 0, firstTs: 0, lastTs: 0,
    };
    fileCodeByPath[path] = entry;
    fileCodeOrder.push(path);
    return entry;
}

/** Stamp fileLetter + per-file fileLineNo onto every item the just-completed
    addToData() pushed (indices [before, allLines.length)). No-op when the line
    carries no origin file (single loaded file / in-memory stream). */
function stampFileCodeOnNewItems(before, logFileUri, ts) {
    if (!logFileUri) return;
    var name = String(logFileUri).replace(/\\\\/g, '/').split('/').pop();
    var entry = ensureFileCode(logFileUri, name);
    if (ts) { if (!entry.firstTs) entry.firstTs = ts; entry.lastTs = ts; }
    for (var k = before; k < allLines.length; k++) {
        var it = allLines[k];
        if (it.fileLetter === undefined) it.fileLetter = entry.letter;
        /* Per-file ordinal only on rows that own a gutter number — markers and
           synthetic chips (repeat-notification) inherit the letter but no number. */
        if (it.fileLineNo === undefined
            && (it.type === 'line' || it.type === 'doc' || it.type === 'stack-header')) {
            it.fileLineNo = ++entry.lineCount;
        }
    }
}

/** Reset the registry when the feed is cleared (loadFromFile / explicit clear). */
function resetFileCodes() { fileCodeByPath = {}; fileCodeOrder = []; }

/** Ordered list for the files dialog: [{ letter, name, path, lineCount, firstTs, lastTs }]. */
function fileCodeList() {
    return fileCodeOrder.map(function (p) { return fileCodeByPath[p]; });
}
`;
}
