/**
 * Webview-side JS for session display name transforms,
 * day heading formatting, and meta line helpers.
 *
 * These functions run in the webview and are used by the
 * session panel script (viewer-session-panel.ts).
 */

/** Return JS that defines session display transform + formatting functions. */
export function getSessionTransformsScript(): string {
    return /* js */ `
var leadingDatetimeRe = /^\\d{4}-?\\d{2}-?\\d{2}[_T -]?(?:\\d{2}[-:]?\\d{2}(?:[-:]?\\d{2})?[_ -]?)?/;
var leadingShortDateRe = /^\\d{6}[_T -]?(?:\\d{6}[_ -]?)?/;
var trailingDatetimeRe = /[_ -]\\d{4}-?\\d{2}-?\\d{2}(?:[_T -]?\\d{2}[-:]?\\d{2}(?:[-:]?\\d{2})?)?$/;
var trailingShortDateRe = /[_ -]\\d{6}(?:[_T -]?\\d{6})?$/;
var knownExtRe = /\\.(log|txt|md|csv|json|jsonl|html)$/i;

function splitFileExt(name) {
    var m = name.match(knownExtRe);
    if (m) return [name.slice(0, m.index), m[0]];
    return [name, ''];
}

function trimSessionSeconds(name) {
    var parts = splitFileExt(name);
    var trimmed = parts[0].replace(
        /(\\d{8}[_T -])(\\d{2})([-:]?)(\\d{2})\\3\\d{2}(?:[.,]\\d+)?/,
        '$1$2$3$4'
    );
    return trimmed + parts[1];
}

function stripSessionDatetime(name) {
    var parts = splitFileExt(name);
    var original = parts[0];
    var base = original;
    base = base.replace(leadingDatetimeRe, '') || base;
    if (base === original) base = base.replace(leadingShortDateRe, '') || base;
    base = base.replace(trailingDatetimeRe, '') || base;
    base = base.replace(trailingShortDateRe, '') || base;
    base = base.replace(/^[_ -]+|[_ -]+$/g, '');
    return (base || original) + parts[1];
}

function normalizeSessionName(name) {
    var parts = splitFileExt(name);
    var spaced = parts[0].replace(/[_-]+/g, ' ').trim();
    var titled = spaced.split(/\\s+/).map(function(w) {
        return w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
    }).join(' ');
    return (titled || parts[0]) + parts[1];
}

/* --- Day heading formatting --- */
var shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ordinalSuffix(n) {
    var s = ['th','st','nd','rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDayHeading(epochMs) {
    var d = new Date(epochMs);
    return dayNames[d.getDay()] + ', ' + ordinalSuffix(d.getDate()) + ' '
        + shortMonths[d.getMonth()] + ' ' + d.getFullYear();
}

function toDateKey(epochMs) {
    var d = new Date(epochMs);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

/* --- Meta line helpers --- */
function formatSessionSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
`;
}
