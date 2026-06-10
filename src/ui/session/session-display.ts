/**
 * Display transformation utilities for session filenames.
 *
 * Provides formatting, datetime stripping, and name normalization
 * used by both the tree view and the webview session panel.
 */

/** Date range filter for the session list. */
export type SessionDateRange =
    | '1h' | '4h' | '8h' | '1d' | '7d' | '30d'
    | '3m' | '6m' | '1y' | 'all';

/** Minimum-size filter for the session list. Each value is a lower bound on
 *  file size, so the list keeps only logs at least that big — built to surface
 *  the large files a user is hunting for, not to bucket by exact size band. */
export type SessionSizeRange =
    | 'all' | '25k' | '50k' | '100k' | '500k' | '1m' | '5m' | '10m' | '50m';

/** Per-day Reports bucket default state.
 *  `collapsed` — bucket visible but folded; click to expand (default behavior).
 *  `expanded`  — bucket auto-expanded so every report row renders inline.
 *  `hidden`    — bucket emits nothing; reports vanish from the panel entirely.
 *  See [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md]. */
export type ReportsBucketState = 'collapsed' | 'expanded' | 'hidden';

/** Persisted display options for the session list. */
export interface SessionDisplayOptions {
    readonly stripDatetime: boolean;
    readonly normalizeNames: boolean;
    readonly showDayHeadings: boolean;
    readonly reverseSort: boolean;
    readonly showLatestOnly?: boolean;
    readonly panelWidth?: number;
    /** Filter sessions by modified time: all, last 7 days, or last 30 days. */
    readonly dateRange?: SessionDateRange;
    /** Filter sessions by minimum file size (lower bound). 'all' keeps every
     *  log; the other values hide anything smaller than the chosen threshold so
     *  large logs are easy to find. */
    readonly sizeRange?: SessionSizeRange;
    /** Logs per page in Logs panel (pagination). Default 100. */
    readonly sessionListPageSize?: number;
    /** Day groups the user has collapsed in the session list, keyed by YYYY-MM-DD. */
    readonly collapsedDays?: Readonly<Record<string, boolean>>;
    /** Session groups the user has collapsed in the session list, keyed by groupId. */
    readonly collapsedGroups?: Readonly<Record<string, boolean>>;
    /** Controller blocks the user has collapsed in the session list, keyed by "ctrl:<uriString>". */
    readonly collapsedControllers?: Readonly<Record<string, boolean>>;
    /** Panel-wide default for the per-day Reports bucket. Seeded from
     *  `saropaLogCapture.reportsBucketDefault` at activation. */
    readonly reportsBucketState?: ReportsBucketState;
    /** Per-day Reports bucket expansion override, keyed by YYYY-MM-DD. Wins over
     *  `reportsBucketState` for that day. Persists so a day the user expanded
     *  stays expanded across reloads. */
    readonly expandedReportBuckets?: Readonly<Record<string, boolean>>;
    /** Sticky newer-log banner above the day list. Seeded from
     *  `saropaLogCapture.newerLogBanner`. Default true. */
    readonly newerLogBannerEnabled?: boolean;
    /** Per-row blue unread dot. Seeded from `saropaLogCapture.newerLogDot`.
     *  Default true. */
    readonly newerLogDotEnabled?: boolean;
}

/** Default display options. */
export const defaultDisplayOptions: SessionDisplayOptions = {
    stripDatetime: true,
    normalizeNames: true,
    showDayHeadings: true,
    reverseSort: false,
    // OFF by default: folding older same-name runs behind a "+N older" badge surprised users who
    // expected every run to show — the collapsed count read as missing logs. Opt-in via the toggle
    // instead; the default list shows every run so nothing appears to vanish.
    showLatestOnly: false,
    dateRange: 'all',
    sizeRange: 'all',
    sessionListPageSize: 100,
    reportsBucketState: 'collapsed',
    newerLogBannerEnabled: true,
    newerLogDotEnabled: true,
};

const shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format hours as 12-hour time with am/pm (e.g. "4:13pm"). */
function formatTime12h(d: Date): string {
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'pm' : 'am';
    return `${h}:${m}${ampm}`;
}

/** Format an epoch-ms timestamp as a compact date+time string (e.g. "Feb 2, 4:13pm"). */
export function formatMtime(epochMs: number): string {
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
export function formatMtimeTimeOnly(epochMs: number): string {
    return formatTime12h(new Date(epochMs));
}

/** Approximate relative time for sessions within the last 24 hours, or empty string. */
export function formatRelativeTime(epochMs: number): string {
    const diffMs = Date.now() - epochMs;
    if (diffMs < 0 || diffMs >= 86_400_000) { return ''; }
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) { return '(just now)'; }
    if (mins < 60) { return `(${mins} min ago)`; }
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
const leadingDatetime =
    /^\d{4}-?\d{2}-?\d{2}[_T -]?(?:\d{2}[-:]?\d{2}(?:[-:]?\d{2})?[_ -]?)?/;

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
function splitExt(name: string): [string, string] {
    const m = name.match(knownExtRe);
    if (m) { return [name.slice(0, m.index), m[0]]; }
    return [name, ''];
}

/** Strip leading and trailing datetime patterns from a filename. */
export function stripDatetime(name: string): string {
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
function titleWord(word: string): string {
    if (word.length === 0) { return word; }
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/** Normalize a filename: replace underscores/hyphens/dots with spaces, Title Case. */
export function normalizeFilename(name: string): string {
    const [base, ext] = splitExt(name);
    // Dots are separators in names like "contacts.drift-advisor"
    const spaced = base.replace(/[_.\-]+/g, ' ').trim();
    const titled = spaced.split(/\s+/).map(titleWord).join(' ');
    return (titled || base) + ext;
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Format an ordinal suffix (1st, 2nd, 3rd, etc.). */
function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    // Negative index from (v-20)%10 yields undefined → falls through to s[v] or s[0].
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Format an epoch-ms timestamp as a day heading string (e.g. "Tue, 3rd Mar 2026"). */
export function formatDayHeading(epochMs: number): string {
    const d = new Date(epochMs);
    const dow = dayNames[d.getDay()];
    const day = ordinal(d.getDate());
    const month = shortMonths[d.getMonth()];
    const year = d.getFullYear();
    return `${dow}, ${day} ${month} ${year}`;
}

/** Get a date key (YYYY-MM-DD) from an epoch-ms timestamp for grouping. */
export function dateKey(epochMs: number): string {
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
export function trimSeconds(name: string): string {
    const [base, ext] = splitExt(name);
    // Match YYYYMMDD separator HH sep MM sep SS and drop the seconds portion.
    const trimmed = base.replace(
        /(\d{8}[_T -])(\d{2})([-:]?)(\d{2})\3\d{2}(?:[.,]\d+)?/,
        '$1$2$3$4',
    );
    return trimmed + ext;
}

/** Apply enabled display options to a filename. */
export function applyDisplayOptions(name: string, options: SessionDisplayOptions): string {
    let result = trimSeconds(name);
    if (options.stripDatetime) {
        result = stripDatetime(result);
    }
    if (options.normalizeNames) {
        result = normalizeFilename(result);
    }
    return result;
}
