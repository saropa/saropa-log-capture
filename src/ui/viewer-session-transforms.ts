/**
 * Webview-side JS for session display name transforms.
 *
 * These functions run in the webview and mirror the logic
 * in session-display.ts (TypeScript side).
 */

/** Return JS that defines session display transform functions. */
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
`;
}
