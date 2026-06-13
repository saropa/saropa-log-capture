/**
 * Parses one session log into a ParsedLog: header, ordered nav/action events, issue overlay, and
 * the crash (plan 056, Source 2 — runtime). Pure string work, no VS Code dependency, so it is
 * unit-tested directly against the real contacts log fixture.
 */

import {
    type CrashInfo, type IssueEvent, type ParsedLog, type SessionHeader, type TimelineEvent,
} from './flow-map-model';
import { classifyBreadcrumb } from './flow-map-breadcrumbs';
import { classifyWarning, isRepeatBatch, parseSlowQuery, type SlowQuery } from './flow-map-issues';
import { parseErrorCausingWidget } from './error-causing-widget-parser';
import { stripAnsi } from './flow-map-format';

const CLOCK_RE = /^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/;
const DAY_MS = 24 * 60 * 60 * 1000;


/** Parse the leading `[HH:MM:SS.mmm]` stamp into ms-of-day + a display clock, or undefined. */
function parseClock(line: string): { tsMs: number; clock: string } | undefined {
    const m = CLOCK_RE.exec(line);
    if (!m) {
        return undefined;
    }
    const [, hh, mm, ss, ms] = m;
    const tsMs = (((+hh * 60) + +mm) * 60 + +ss) * 1000 + +ms;
    return { tsMs, clock: `${hh}:${mm}:${ss}` };
}

/**
 * Resolve every line's clock-only stamp into a monotonic ms value across the whole session.
 *
 * The log carries only `[HH:MM:SS.mmm]` (ms-of-day, no date). A session that runs past midnight
 * would otherwise have a later event with a *smaller* ms-of-day, producing negative dwell times
 * and a broken activity-chart span (maxTs < minTs). We detect midnight by a large backward jump in
 * the clock — a real rollover is always a ~24h step back, while cross-thread reordering is sub-second
 * — and add a day's worth of ms per rollover so the resulting timeline is monotonic. The values stay
 * relative (ms since the first day's midnight); all flow-map consumers use differences, not epochs.
 *
 * @returns Array parallel to `lines`; `undefined` where a line has no parseable clock.
 */
function resolveClockTimeline(lines: readonly string[]): (number | undefined)[] {
    const out = new Array<number | undefined>(lines.length);
    let dayOffset = 0;
    let prevMs = -1;
    for (let i = 0; i < lines.length; i++) {
        const clk = parseClock(lines[i]);
        if (!clk) { out[i] = undefined; continue; }
        // A backward step over half a day means we crossed midnight; sub-second reordering never does.
        if (prevMs >= 0 && prevMs - clk.tsMs > DAY_MS / 2) { dayOffset += DAY_MS; }
        prevMs = clk.tsMs;
        out[i] = clk.tsMs + dayOffset;
    }
    return out;
}

/** Read a quoted value (`key: "value"`) or bare trailing value (`key:   value`) from header lines. */
function headerField(lines: readonly string[], re: RegExp): string | undefined {
    for (const line of lines) {
        const m = re.exec(line);
        if (m) {
            return m[1].trim();
        }
    }
    return undefined;
}

/** Extract session header fields from the SESSION START banner (the un-timestamped preamble). */
function parseHeader(lines: readonly string[]): SessionHeader {
    const head = lines.slice(0, 60);
    return {
        project: headerField(head, /^Project:\s*(.+)$/),
        projectRoot: headerField(head, /projectRootPath:\s*"([^"]+)"/),
        device: headerField(head, /deviceName:\s*"([^"]+)"/),
        branch: headerField(head, /^Git Branch:\s*(.+)$/),
        commit: headerField(head, /^Git Commit:\s*(.+)$/),
        version: headerField(head, /^Extension version:\s*(.+)$/),
    };
}

/** Strip the `[clock] [channel] ` decorations to get the bare line content. */
function stripPrefix(line: string): string {
    return line.replace(CLOCK_RE, '').replace(/^\s*\[[^\]]+\]\s*/, '').trim();
}

/** Locate the rendering-exception block and recover its message + crashing-widget anchor. */
function detectCrash(
    lines: readonly string[],
    lineTimes: readonly (number | undefined)[],
    projectRoot?: string,
): CrashInfo | undefined {
    const bannerIdx = lines.findIndex(l => /Exception caught by [\w ]+library/i.test(l));
    if (bannerIdx === -1) {
        return undefined;
    }
    // Message = first prose line after the banner that is not the "assertion was thrown" preamble.
    for (let i = bannerIdx + 1; i < Math.min(bannerIdx + 8, lines.length); i++) {
        const content = stripAnsi(stripPrefix(lines[i]));
        if (!content || /was thrown during|^={3,}/.test(content)) {
            continue;
        }
        const clk = parseClock(lines[i]);
        const widget = parseErrorCausingWidget(lines, projectRoot);
        return {
            // Use the rollover-resolved time so an after-midnight crash sorts after earlier events.
            tsMs: lineTimes[i] ?? clk?.tsMs ?? 0,
            clock: clk?.clock ?? '',
            message: content,
            widget: widget?.widget,
            source: widget?.source,
            logLine: i + 1,
        };
    }
    return undefined;
}

/** Mutable accumulators threaded through the line scan. */
interface ScanState {
    readonly events: TimelineEvent[];
    readonly issues: IssueEvent[];
    readonly seenWarnings: Set<string>;
    worstSlow?: SlowQuery;
    slowCount: number;
    repeatCount: number;
    lastClock?: string;
}

/** One timestamped line's parsed coordinates. */
interface LineContext {
    readonly text: string;
    readonly tsMs: number;
    readonly clock: string;
    readonly logLine: number;
}

/** Fold one timestamped line's breadcrumb / slow-query / warning content into the scan state. */
function scanLine(ctx: LineContext, state: ScanState): void {
    state.lastClock = ctx.clock;
    // Strip ANSI color codes first so they never leak into node labels or break anchored matchers.
    const text = stripAnsi(ctx.text);
    const event = classifyBreadcrumb(text, ctx.tsMs, ctx.clock, ctx.logLine);
    if (event) {
        state.events.push(event);
    }
    const slow = parseSlowQuery(text);
    if (slow) {
        state.slowCount++;
        if (!state.worstSlow || slow.ms > state.worstSlow.ms) {
            state.worstSlow = { ...slow, logLine: ctx.logLine };
        }
    }
    if (isRepeatBatch(text)) {
        state.repeatCount++;
    }
    const warn = classifyWarning(text, ctx.tsMs, ctx.clock, ctx.logLine);
    if (warn && !state.seenWarnings.has(warn.category)) {
        state.seenWarnings.add(warn.category);
        state.issues.push(warn);
    }
}

/**
 * The session banner prints paths from a JSON args dump, so backslashes arrive doubled
 * (`D:\\src\\contacts`). Collapse runs of backslashes so path-relativization and `Uri.file` work.
 */
function normalizeRoot(root: string | undefined): string | undefined {
    return root?.replace(/\\{2,}/g, '\\');
}

/** Parse a full session log (already split into lines) into the ParsedLog model. */
export function parseLog(lines: readonly string[], projectRootOverride?: string): ParsedLog {
    const header = parseHeader(lines);
    const projectRoot = normalizeRoot(projectRootOverride ?? header.projectRoot);
    const state: ScanState = {
        events: [], issues: [], seenWarnings: new Set(), slowCount: 0, repeatCount: 0,
    };

    // Resolve clocks once so events crossing midnight stay in monotonic order (no negative dwell).
    const lineTimes = resolveClockTimeline(lines);
    for (let i = 0; i < lines.length; i++) {
        const clk = parseClock(lines[i]);
        if (clk) {
            scanLine({ text: lines[i], tsMs: lineTimes[i] ?? clk.tsMs, clock: clk.clock, logLine: i + 1 }, state);
        }
    }

    const crash = detectCrash(lines, lineTimes, projectRoot);
    appendWorstSlow(state);
    if (crash) {
        state.issues.push(crashIssue(crash));
    }
    state.issues.sort((a, b) => a.tsMs - b.tsMs);

    return {
        header: { ...header, projectRoot, captureStartClock: firstClock(lines) },
        events: state.events,
        issues: state.issues,
        crash,
        slowQueryCount: state.slowCount,
        repeatBatchCount: state.repeatCount,
        lastClock: state.lastClock,
    };
}

/** Promote the single worst slow query into an issue row (the rest are summarized by count). */
function appendWorstSlow(state: ScanState): void {
    if (!state.worstSlow) {
        return;
    }
    const w = state.worstSlow;
    state.issues.push({
        tsMs: 0,
        clock: '',
        severity: 'perf',
        category: 'Slow query',
        detail: `Drift SLOW ${w.ms}ms ${w.kind} — worst of session`,
        source: w.source,
        logLine: w.logLine,
    });
}

/** Build the crash issue row. */
function crashIssue(crash: CrashInfo): IssueEvent {
    return {
        tsMs: crash.tsMs,
        clock: crash.clock,
        severity: 'error',
        category: 'Crash',
        detail: crash.message,
        source: crash.source,
        logLine: crash.logLine,
    };
}

/** Clock of the first timestamped line (session start in device-local time). */
function firstClock(lines: readonly string[]): string | undefined {
    for (const line of lines) {
        const clk = parseClock(line);
        if (clk) {
            return clk.clock;
        }
    }
    return undefined;
}
