/**
 * Derive a release date from an Android `versionCode` string.
 *
 * Teams commonly encode the build date into the versionCode (e.g. `2026012501` =
 * 2026-01-25, build 01). This module detects such a date across the common encodings so the
 * Crashlytics panel can filter and group issues by release date rather than by an opaque integer.
 *
 * The parser is deliberately conservative: it only returns a date when the digits form a REAL
 * calendar date whose year falls in a plausible window. That is what keeps non-date codes
 * (semantic versions like `10402`, monotonic counters like `4521`) and impossible dates from
 * being misread — a false "release date" would silently mis-group issues.
 */

/** Android shipped from 2008; cap the upper bound generously so the window itself never rejects a real build. */
const MIN_YEAR = 2008;
const MAX_YEAR = 2099;

/** Which digit layout matched. Useful for tests and for a future "how was this read" tooltip. */
export type VersionDateFormat = 'yyyymmddNN' | 'yyyymmdd' | 'ddmmyyyy' | 'mmddyyyy' | 'yymmdd';

export interface VersionDate {
    /** Canonical, locale-neutral `YYYY-MM-DD` — the grouping / filter key. */
    readonly ymd: string;
    readonly year: number;
    /** 1-12. */
    readonly month: number;
    /** 1-31. */
    readonly day: number;
    readonly format: VersionDateFormat;
    /** Trailing build-of-day counter when the layout carries one (e.g. the `01` in `2026012501`). */
    readonly buildSeq?: number;
}

/** Days in a month, honoring Gregorian leap years, so e.g. `20260230` (Feb 30) is rejected. */
function daysInMonth(year: number, month: number): number {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return lengths[month - 1] ?? 0;
}

/** True only for a real calendar date inside the plausible release-year window. */
function isValidDate(year: number, month: number, day: number): boolean {
    if (year < MIN_YEAR || year > MAX_YEAR) { return false; }
    if (month < 1 || month > 12) { return false; }
    return day >= 1 && day <= daysInMonth(year, month);
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

/** A (year, month, day) triple before validation / formatting. */
interface DateParts { readonly year: number; readonly month: number; readonly day: number; }

function build(parts: DateParts, format: VersionDateFormat, buildSeq?: number): VersionDate {
    const { year, month, day } = parts;
    return { ymd: `${year}-${pad2(month)}-${pad2(day)}`, year, month, day, format, buildSeq };
}

/** A layout to try: slice the 8 date digits into (year, month, day) the named way. */
interface Layout {
    readonly format: VersionDateFormat;
    readonly read: (d8: string) => DateParts;
}

/** Order matters — earlier layouts win when more than one interpretation is a valid date. */
const EIGHT_DIGIT_LAYOUTS: readonly Layout[] = [
    { format: 'yyyymmdd', read: (d) => ({ year: +d.slice(0, 4), month: +d.slice(4, 6), day: +d.slice(6, 8) }) },
    { format: 'ddmmyyyy', read: (d) => ({ day: +d.slice(0, 2), month: +d.slice(2, 4), year: +d.slice(4, 8) }) },
    { format: 'mmddyyyy', read: (d) => ({ month: +d.slice(0, 2), day: +d.slice(2, 4), year: +d.slice(4, 8) }) },
];

/** First 8-digit layout that yields a valid calendar date, or null. `seq` is carried through for the 10-digit case. */
function fromEightDigits(d8: string, withSeq: boolean, seq?: number): VersionDate | null {
    for (const layout of EIGHT_DIGIT_LAYOUTS) {
        const parts = layout.read(d8);
        if (isValidDate(parts.year, parts.month, parts.day)) {
            const format: VersionDateFormat = withSeq ? 'yyyymmddNN' : layout.format;
            return build(parts, format, withSeq ? seq : undefined);
        }
    }
    return null;
}

/** `yymmdd` → 20yy-mm-dd. Lowest precedence: the 2-digit year is the most ambiguous anchor. */
function fromSixDigits(d6: string): VersionDate | null {
    const parts: DateParts = { year: 2000 + +d6.slice(0, 2), month: +d6.slice(2, 4), day: +d6.slice(4, 6) };
    return isValidDate(parts.year, parts.month, parts.day) ? build(parts, 'yymmdd') : null;
}

/**
 * Parse a release date out of a versionCode string, or return null when no confident date reading
 * exists (the common case for semantic versions and plain counters — callers display those unchanged).
 */
export function parseVersionDate(versionCode: string | undefined | null): VersionDate | null {
    if (!versionCode) { return null; }
    const digits = versionCode.replace(/\D/g, '');
    // 10 digits = 8-digit date + 2-digit build-of-day counter (e.g. `2026012501`); try date+seq first.
    if (digits.length === 10) {
        return fromEightDigits(digits.slice(0, 8), true, +digits.slice(8, 10));
    }
    if (digits.length === 8) {
        return fromEightDigits(digits, false);
    }
    if (digits.length === 6) {
        return fromSixDigits(digits);
    }
    return null;
}
