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
const PREFIX_LINE_RE = /^([A-Za-z][^\n]*?(?::|->|→))\s+(.+)$/;

/** Trailing separator, stripped from a captured head to get the bare prefix for noise checks. */
const TRAILING_SEP_RE = /\s*(?::|->|→)$/;

/**
 * Prefix words that make a once-seen line worth suggesting anyway. The default "seen at least twice"
 * bar assumes a session long enough to repeat itself; a short capture can hold exactly one genuine
 * navigation line, and offering nothing there is the same dead end this feature exists to remove.
 */
const NAV_WORD_RE = /\b(route|nav|navigat|screen|page|view|open|enter|push|present)/i;

/** Prefixes the built-in matchers (`flow-map-breadcrumbs.ts`) already handle — never suggest these. */
const BUILTIN_SKIP_RE = [/^Screen Navigation$/, /Screen Reached/, /^Viewed /, /^App (Startup|Shutdown)$/];

/**
 * Android logcat tag prefixes (`W/ViewRootImpl(15450)`, `D/FirebaseSessions`). These dominate a
 * logcat-heavy capture by sheer volume, but they are platform plumbing, not app navigation — and the
 * embedded PID changes every run, so a generated rule would both create junk nodes AND stop matching
 * on the next session. Excluded outright rather than ranked down.
 */
const LOGCAT_TAG_RE = /^[VDIWEFA]\/\S+$/;

const MAX_PREFIX_LEN = 40;
const MAX_SAMPLE_LEN = 70;
/** Bound the scan on huge logs — a repeated shape that matters shows up well within the first 5000
 * timestamped lines; scanning further just burns time on a report the user is waiting on. */
const MAX_TIMESTAMPED_LINES = 5000;

/**
 * Strip the `[clock]` and EVERY leading `[bracket]` group. Real capture lines stack them —
 * `[08:00:01.000] [console] [log] Route pushed: Home` carries both the DAP channel and the Flutter
 * `[log]` marker — so stripping a single group (as the parser's own stripPrefix does, because it
 * peels `[log]` separately) would leave a `[`-leading string that no prefix shape can match.
 */
function stripPrefix(line: string): string {
    let out = line.replace(CLOCK_RE, '').trim();
    let prev = '';
    while (out !== prev) {
        prev = out;
        out = out.replace(/^\[[^\]]*\]\s*/, '').trim();
    }
    return out;
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
    // A prefix carrying a bare process id would bake that id into the generated rule, which then
    // matches nothing after the next app restart. Catches logcat tags and `Worker(1234)` shapes alike.
    if (LOGCAT_TAG_RE.test(prefix) || /\(\d{3,}\)/.test(prefix)) {
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
    /**
     * The head EXACTLY as it appeared, separator and internal spacing included (`Route pushed:`,
     * `Navigated ->`). Reproducing it verbatim is what makes the generated rule match the very lines
     * it was derived from; rebuilding it from a trimmed prefix plus a separator drops the spacing and
     * yields a rule that matches nothing.
     */
    head: string;
}

/** Fold one candidate line into the running tally, keyed by the verbatim head. */
function recordPrefix(groups: Map<string, PrefixGroup>, head: string, value: string): void {
    const existing = groups.get(head);
    if (existing) {
        existing.count += 1;
        return;
    }
    groups.set(head, { count: 1, firstValue: value, head });
}

/** Truncate to a readable sample length without leaving a dangling ellipsis on already-short text. */
function truncateSample(s: string): string {
    return s.length > MAX_SAMPLE_LEN ? `${s.slice(0, MAX_SAMPLE_LEN).trimEnd()}…` : s;
}

/**
 * Build one suggestion from a tallied group. `\s+` (not a literal space) after the head so the rule
 * survives the alignment padding some loggers emit between the separator and the value.
 */
function toSuggestion(g: PrefixGroup): BreadcrumbSuggestion {
    return {
        pattern: `^${escapeRegex(g.head)}\\s+(.+)$`,
        label: '$1',
        sample: truncateSample(g.firstValue.trim()),
        count: g.count,
    };
}

/**
 * Rank by count desc and cap at `max`. Repeated shapes (seen twice or more) are the confident
 * signal. Only when NOTHING repeats does the bar drop to a single sighting, and then only for
 * prefixes whose wording reads as navigation — a short capture holding one real route line should
 * still get an offer, without letting one-off noise through on a long log that simply lacks nav.
 */
function rankGroups(groups: Map<string, PrefixGroup>, max: number): BreadcrumbSuggestion[] {
    const all = [...groups.values()].sort((a, b) => b.count - a.count);
    const repeated = all.filter((g) => g.count >= 2);
    const chosen = repeated.length > 0
        ? repeated
        : all.filter((g) => NAV_WORD_RE.test(g.head));
    return chosen.slice(0, max).map(toSuggestion);
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
        // Noise checks read the bare prefix; the tally keeps the head verbatim for rule generation.
        if (!m || isNoisePrefix(m[1].replace(TRAILING_SEP_RE, ''))) {
            continue;
        }
        recordPrefix(groups, m[1], m[2]);
    }
    return rankGroups(groups, max);
}
