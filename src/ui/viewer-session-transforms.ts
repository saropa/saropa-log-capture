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

function trimSessionSeconds(name) {
    var ext = name.endsWith('.log') ? '.log' : '';
    var base = ext ? name.slice(0, -4) : name;
    var trimmed = base.replace(
        /(\\d{8}[_T -])(\\d{2})([-:]?)(\\d{2})\\3\\d{2}(?:[.,]\\d+)?/,
        '$1$2$3$4'
    );
    return trimmed + ext;
}

function stripSessionDatetime(name) {
    var ext = name.endsWith('.log') ? '.log' : '';
    var base = ext ? name.slice(0, -4) : name;
    var original = base;
    base = base.replace(leadingDatetimeRe, '') || base;
    if (base === original) base = base.replace(leadingShortDateRe, '') || base;
    base = base.replace(trailingDatetimeRe, '') || base;
    base = base.replace(trailingShortDateRe, '') || base;
    base = base.replace(/^[_ -]+|[_ -]+$/g, '');
    return (base || original) + ext;
}

function normalizeSessionName(name) {
    var ext = name.endsWith('.log') ? '.log' : '';
    var base = ext ? name.slice(0, -4) : name;
    var spaced = base.replace(/[_-]+/g, ' ').trim();
    var titled = spaced.split(/\\s+/).map(function(w) {
        return w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
    }).join(' ');
    return (titled || base) + ext;
}
`;
}
