/**
 * Empty-state breadcrumb diagnostic (plan 117 follow-up). When a log has no recognized navigation
 * breadcrumbs, `flowDiagramHtml` renders a dead-end note pointing at the phase-D escape hatch
 * (`saropaLogCapture.flowMap.customBreadcrumbs`) but gives no hint what to put in it. This module
 * scans the log's OWN lines for repeated `Prefix: value` shapes that look like navigation and turns
 * them into ready-to-use custom-rule suggestions — onboarding instead of a dead end.
 *
 * Pure module (no vscode import) so it can run from the command layer (which already has the raw
 * lines) or be unit-tested without the Extension Host.
 */

/** One suggested custom breadcrumb rule, ready to hand to the `customBreadcrumbs` setting. */
export interface BreadcrumbSuggestion {
    readonly pattern: string;
    readonly label: string;
    readonly sample: string;
    readonly count: number;
}

/** Matches the parser's `[HH:MM:SS.mmm]` stamp (mirrors `flow-map-log-parser.ts`'s CLOCK_RE). */
const CLOCK_RE = /^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/;

/**
 * A `Prefix: value` line shape. The prefix itself is unrestricted here (real prefixes carry the odd
 * digit or parenthesis, e.g. "Nav (v2): HomePage") — `isNoisePrefix` does the "mostly letters" and
 * word-count filtering afterward, so the pattern only bounds where the prefix ends.
 */
const PREFIX_LINE_RE = /^([A-Za-z][^:\n]*?):\s+(.+)$/;

/** Prefixes the built-in matchers (`flow-map-breadcrumbs.ts`) already handle — never suggest these. */
const BUILTIN_SKIP_RE = [/^Screen Navigation$/, /Screen Reached/, /^Viewed /, /^App (Startup|Shutdown)$/];

const MAX_PREFIX_LEN = 40;
const MAX_SAMPLE_LEN = 70;
/** Bound the scan on huge logs — a repeated shape that matters shows up well within the first 5000
 * timestamped lines; scanning further just burns time on a report the user is waiting on. */
const MAX_TIMESTAMPED_LINES = 5000;

/** Strip the `[clock]` and any `[channel]` prefix, mirroring the parser's `stripPrefix` shape. */
function stripPrefix(line: string): string {
    return line.replace(CLOCK_RE, '').replace(/^\s*\[[^\]]+\]\s*/, '').trim();
}

/**
 * True when the prefix is noise: too long, single-letter, not "mostly letters/spaces" (rules out
 * IDs/timestamps/paths that happen to precede a colon), too many words, or already built-in territory.
 */
function isNoisePrefix(prefix: string): boolean {
    if (prefix.length > MAX_PREFIX_LEN || prefix.length <= 1) {
        return true;
    }
    const words = prefix.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 5) {
        return true;
    }
    const letterCount = (prefix.match(/[A-Za-z]/g) ?? []).length;
    if (letterCount / prefix.length < 0.5) {
        return true;
    }
    return BUILTIN_SKIP_RE.some((re) => re.test(prefix));
}

/** Escape regex metacharacters in a literal prefix before embedding it in a generated pattern. */
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface PrefixGroup {
    count: number;
    firstValue: string;
}

/** Fold one candidate line into the running per-prefix tally, seeding the sample on first sight. */
function recordPrefix(groups: Map<string, PrefixGroup>, prefix: string, value: string): void {
    const existing = groups.get(prefix);
    if (existing) {
        existing.count += 1;
        return;
    }
    groups.set(prefix, { count: 1, firstValue: value });
}

/** Truncate to a readable sample length without leaving a dangling ellipsis on already-short text. */
function truncateSample(s: string): string {
    return s.length > MAX_SAMPLE_LEN ? `${s.slice(0, MAX_SAMPLE_LEN).trimEnd()}…` : s;
}

/** Rank groups by count desc, drop singletons, and cap the result at `max`. */
function rankGroups(groups: Map<string, PrefixGroup>, max: number): BreadcrumbSuggestion[] {
    const ranked = [...groups.entries()]
        .filter(([, g]) => g.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, max);
    return ranked.map(([prefix, g]) => ({
        pattern: `^${escapeRegex(prefix)}: (.+)$`,
        label: '$1',
        sample: truncateSample(g.firstValue.trim()),
        count: g.count,
    }));
}

/**
 * Scan the log for repeated `Prefix: value` line shapes that could be custom navigation breadcrumbs.
 * Never throws — a malformed or empty log simply yields no suggestions. Capped at the first
 * `MAX_TIMESTAMPED_LINES` timestamped lines so a huge capture doesn't stall report generation.
 */
export function suggestBreadcrumbPatterns(lines: readonly string[], max = 3): BreadcrumbSuggestion[] {
    if (!Array.isArray(lines) || lines.length === 0) {
        return [];
    }
    const groups = new Map<string, PrefixGroup>();
    let timestamped = 0;
    for (const line of lines) {
        if (typeof line !== 'string' || !CLOCK_RE.test(line)) {
            continue;
        }
        timestamped += 1;
        if (timestamped > MAX_TIMESTAMPED_LINES) {
            break;
        }
        const content = stripPrefix(line);
        const m = PREFIX_LINE_RE.exec(content);
        if (!m || isNoisePrefix(m[1])) {
            continue;
        }
        recordPrefix(groups, m[1], m[2]);
    }
    return rankGroups(groups, max);
}
