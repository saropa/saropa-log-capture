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

const CLOCK_RE = /^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/;

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
function detectCrash(lines: readonly string[], projectRoot?: string): CrashInfo | undefined {
    const bannerIdx = lines.findIndex(l => /Exception caught by [\w ]+library/i.test(l));
    if (bannerIdx === -1) {
        return undefined;
    }
    // Message = first prose line after the banner that is not the "assertion was thrown" preamble.
    for (let i = bannerIdx + 1; i < Math.min(bannerIdx + 8, lines.length); i++) {
        const content = stripPrefix(lines[i]);
        if (!content || /was thrown during|^={3,}/.test(content)) {
            continue;
        }
        const clk = parseClock(lines[i]);
        const widget = parseErrorCausingWidget(lines, projectRoot);
        return {
            tsMs: clk?.tsMs ?? 0,
            clock: clk?.clock ?? '',
            message: content,
            widget: widget?.widget,
            source: widget?.source,
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

/** Fold one timestamped line's breadcrumb / slow-query / warning content into the scan state. */
function scanLine(line: string, tsMs: number, clock: string, state: ScanState): void {
    state.lastClock = clock;
    const event = classifyBreadcrumb(line, tsMs, clock);
    if (event) {
        state.events.push(event);
    }
    const slow = parseSlowQuery(line);
    if (slow) {
        state.slowCount++;
        if (!state.worstSlow || slow.ms > state.worstSlow.ms) {
            state.worstSlow = slow;
        }
    }
    if (isRepeatBatch(line)) {
        state.repeatCount++;
    }
    const warn = classifyWarning(line, tsMs, clock);
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

    for (const line of lines) {
        const clk = parseClock(line);
        if (clk) {
            scanLine(line, clk.tsMs, clk.clock, state);
        }
    }

    const crash = detectCrash(lines, projectRoot);
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
