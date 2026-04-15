"use strict";
/**
 * Display transformation utilities for session filenames.
 *
 * Provides formatting, datetime stripping, and name normalization
 * used by both the tree view and the webview session panel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultDisplayOptions = void 0;
exports.formatMtime = formatMtime;
exports.formatMtimeTimeOnly = formatMtimeTimeOnly;
exports.formatRelativeTime = formatRelativeTime;
exports.stripDatetime = stripDatetime;
exports.normalizeFilename = normalizeFilename;
exports.formatDayHeading = formatDayHeading;
exports.dateKey = dateKey;
exports.trimSeconds = trimSeconds;
exports.applyDisplayOptions = applyDisplayOptions;
/** Default display options. */
exports.defaultDisplayOptions = {
    stripDatetime: true,
    normalizeNames: true,
    showDayHeadings: true,
    reverseSort: false,
    showLatestOnly: false,
    dateRange: 'all',
    sessionListPageSize: 100,
};
const shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
/** Format hours as 12-hour time with am/pm (e.g. "4:13pm"). */
function formatTime12h(d) {
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'pm' : 'am';
    return `${h}:${m}${ampm}`;
}
/** Format an epoch-ms timestamp as a compact date+time string (e.g. "Feb 2, 4:13pm"). */
function formatMtime(epochMs) {
    const d = new Date(epochMs);
    const month = shortMonths[d.getMonth()];
    const day = d.getDate();
    const time = formatTime12h(d);
    if (d.getFullYear() === new Date().getFullYear()) {
        return `${month} ${day}, ${time}`;
    }
    return `${month} ${day}, ${d.getFullYear()}, ${time}`;
}
/** Format an epoch-ms timestamp as time only (e.g. "4:13pm"). */
function formatMtimeTimeOnly(epochMs) {
    return formatTime12h(new Date(epochMs));
}
/** Approximate relative time for sessions within the last 24 hours, or empty string. */
function formatRelativeTime(epochMs) {
    const diffMs = Date.now() - epochMs;
    if (diffMs < 0 || diffMs >= 86_400_000) {
        return '';
    }
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) {
        return '(just now)';
    }
    if (mins < 60) {
        return `(${mins} min ago)`;
    }
    const hrs = Math.floor(mins / 60);
    return hrs === 1 ? '(1 hr ago)' : `(${hrs} hrs ago)`;
}
/**
 * Leading datetime patterns:
 * - YYYYMMDD_HHMMSS_ (e.g. 20250115_154932_)
 * - YYYYMMDD_HH-MM-SS_ or YYYYMMDD_HH-MM_
 * - YYYYMMDD_ (date only)
 * - YYYY-MM-DD_ (with dashes)
 * - YYMMDD_HHMMSS_
 * - YYMMDD_
 */
const leadingDatetime = /^\d{4}-?\d{2}-?\d{2}[_T -]?(?:\d{2}[-:]?\d{2}(?:[-:]?\d{2})?[_ -]?)?/;
const leadingShortDate = /^\d{6}[_T -]?(?:\d{6}[_ -]?)?/;
/**
 * Trailing datetime patterns (before file extension):
 * - _YYYYMMDD_HHMMSS or _YYYYMMDD
 * - _YYMMDD
 */
const trailingDatetime = /[_ -]\d{4}-?\d{2}-?\d{2}(?:[_T -]?\d{2}[-:]?\d{2}(?:[-:]?\d{2})?)?$/;
const trailingShortDate = /[_ -]\d{6}(?:[_T -]?\d{6})?$/;
const knownExtRe = /\.(log|txt|md|csv|json|jsonl|html)$/i;
/** Split a filename into [baseName, extension]. */
function splitExt(name) {
    const m = name.match(knownExtRe);
    if (m) {
        return [name.slice(0, m.index), m[0]];
    }
    return [name, ''];
}
/** Strip leading and trailing datetime patterns from a filename. */
function stripDatetime(name) {
    const [original, ext] = splitExt(name);
    let base = original;
    base = base.replace(leadingDatetime, '') || base;
    // Only try short-date pattern if long-date had no match.
    if (base === original) {
        base = base.replace(leadingShortDate, '') || base;
    }
    base = base.replace(trailingDatetime, '') || base;
    base = base.replace(trailingShortDate, '') || base;
    // Trim leftover separators from edges
    base = base.replace(/^[_ -]+|[_ -]+$/g, '');
    return (base || original) + ext;
}
/** Capitalize the first letter of a word, lowercase the rest. */
function titleWord(word) {
    if (word.length === 0) {
        return word;
    }
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
}
/** Normalize a filename: replace underscores/hyphens/dots with spaces, Title Case. */
function normalizeFilename(name) {
    const [base, ext] = splitExt(name);
    // Dots are separators in names like "contacts.drift-advisor"
    const spaced = base.replace(/[_.\-]+/g, ' ').trim();
    const titled = spaced.split(/\s+/).map(titleWord).join(' ');
    return (titled || base) + ext;
}
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Format an ordinal suffix (1st, 2nd, 3rd, etc.). */
function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    // Negative index from (v-20)%10 yields undefined → falls through to s[v] or s[0].
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
/** Format an epoch-ms timestamp as a day heading string (e.g. "Tue, 3rd Mar 2026"). */
function formatDayHeading(epochMs) {
    const d = new Date(epochMs);
    const dow = dayNames[d.getDay()];
    const day = ordinal(d.getDate());
    const month = shortMonths[d.getMonth()];
    const year = d.getFullYear();
    return `${dow}, ${day} ${month} ${year}`;
}
/** Get a date key (YYYY-MM-DD) from an epoch-ms timestamp for grouping. */
function dateKey(epochMs) {
    const d = new Date(epochMs);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/**
 * Trim seconds (and optional sub-second digits) from the time portion of a filename.
 * YYYYMMDD_HHMMSS → YYYYMMDD_HHMM, YYYYMMDD_HH-MM-SS → YYYYMMDD_HH-MM.
 * Always applied to keep filenames compact.
 */
function trimSeconds(name) {
    const [base, ext] = splitExt(name);
    // Match YYYYMMDD separator HH sep MM sep SS and drop the seconds portion.
    const trimmed = base.replace(/(\d{8}[_T -])(\d{2})([-:]?)(\d{2})\3\d{2}(?:[.,]\d+)?/, '$1$2$3$4');
    return trimmed + ext;
}
/** Apply enabled display options to a filename. */
function applyDisplayOptions(name, options) {
    let result = trimSeconds(name);
    if (options.stripDatetime) {
        result = stripDatetime(result);
    }
    if (options.normalizeNames) {
        result = normalizeFilename(result);
    }
    return result;
}
//# sourceMappingURL=session-display.js.map