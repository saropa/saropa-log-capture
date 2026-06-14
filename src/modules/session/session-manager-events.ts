/**
 * DAP event processing logic extracted from SessionManagerImpl.
 * Handles output events (filtering, flood suppression, log append)
 * and verbose DAP protocol message recording.
 */

import { LogSession } from '../capture/log-session';
import { SourceLocation } from '../capture/log-session-helpers';
import { SaropaLogCaptureConfig } from '../config/config';
import { DapOutputBody } from '../capture/tracker';
import { FloodGuard } from '../capture/flood-guard';
import { ExclusionRule, testExclusion, findExclusionMatch } from '../features/exclusion-matcher';
import { DapMessage, DapDirection, formatDapMessage } from '../capture/dap-formatter';
import { LineData, EarlyOutputBuffer } from './session-event-bus';

/** Read-only dependencies for output event processing. */
export interface OutputEventDeps {
    readonly sessions: ReadonlyMap<string, LogSession>;
    readonly earlyBuffer: EarlyOutputBuffer;
    readonly config: SaropaLogCaptureConfig;
    readonly exclusionRules: readonly ExclusionRule[];
    readonly floodGuard: FloodGuard;
    /** Output channel for diagnostics (e.g. categories dropped by the captureAll whitelist). */
    readonly outputChannel?: { appendLine(message: string): void };
    /** Per-session memo of categories already reported as dropped, to log each at most once. */
    readonly droppedCategoriesLogged?: Set<string>;
    /** Per-session memo of exclusion patterns already reported, to log each at most once. */
    readonly excludedRulesLogged?: Set<string>;
}

/** Mutable counters updated during output processing. */
export interface OutputEventCounters {
    categoryCounts: Record<string, number>;
    floodSuppressedTotal: number;
}

/** Mutable output target: counters and broadcast callback. */
export interface OutputEventTarget {
    counters: OutputEventCounters;
    broadcastLine: (data: Omit<LineData, 'watchHits'>) => void;
}

/** Process a DAP output event — buffer, filter, append to log, and broadcast. */
export function processOutputEvent(
    deps: OutputEventDeps,
    target: OutputEventTarget,
    sessionId: string,
    body: DapOutputBody,
): void {
    const session = deps.sessions.get(sessionId);
    // Buffer events arriving before async session init completes (DAP can fire before startSession returns).
    if (!session) { deps.earlyBuffer.add(sessionId, body); return; }
    if (!deps.config.enabled) { return; }

    const category = body.category ?? 'console';
    const text = body.output.replace(/[\r\n]+$/, '');
    if (text.length === 0) { return; }

    if (!deps.config.captureAll && !deps.config.categories.includes(category)) {
        // Plan 102 Step 3: a missing Debug Console line is most often dropped here —
        // captureAll is off and the line's DAP category is not in the whitelist, so it
        // vanishes with no trace. Surface each unrecognized category once to the output
        // channel (memoized to avoid flooding) so users can diagnose the filtering gap
        // instead of assuming capture is broken.
        reportDroppedCategory(deps, category);
        traceOutcome(deps, category, 'dropped (category not in capture list)', text);
        return;
    }
    const excludedBy = findExclusionMatch(text, deps.exclusionRules);
    if (excludedBy) {
        // Plan 102 (captureAll: true path): once a line clears the category gate, exclusion is
        // the only in-extension drop that stays silent — flood drops surface a FLOOD SUPPRESSED
        // summary, but an exclusion match leaves no trace. A user chasing a "missing Debug Console
        // line" with captureAll ON sees nothing here, so report each matching pattern once
        // (memoized) naming the rule that hid the line.
        reportExcludedLine(deps, excludedBy.source);
        traceOutcome(deps, category, `dropped (exclusion "${excludedBy.source}")`, text);
        return;
    }

    const floodResult = deps.floodGuard.check(text);
    if (!floodResult.allow) {
        traceOutcome(deps, category, 'flood-suppressed', text);
        return;
    }
    const now = new Date();

    if (floodResult.suppressedCount) {
        target.counters.floodSuppressedTotal += floodResult.suppressedCount;
        const summary = `[FLOOD SUPPRESSED: ${floodResult.suppressedCount} identical messages]`;
        session.appendLine(summary, 'system', now);
        target.broadcastLine({
            text: summary, isMarker: false, lineCount: session.lineCount,
            category: 'system', timestamp: now, logFileUri: session.fileUri.fsPath,
        });
    }

    const sourceLocation: SourceLocation | undefined =
        body.source?.path ? { path: body.source.path, line: body.line, column: body.column } : undefined;
    session.appendLine(text, category, now, sourceLocation);
    target.counters.categoryCounts[category] = (target.counters.categoryCounts[category] ?? 0) + 1;
    target.broadcastLine({
        text, isMarker: false, lineCount: session.lineCount,
        category, timestamp: now, logFileUri: session.fileUri.fsPath,
        sourcePath: body.source?.path, sourceLine: body.line,
    });
    traceOutcome(deps, category, 'captured', text);
}

/**
 * Log a DAP category that was dropped by the captureAll whitelist, at most once per
 * category. The first time a category is filtered out, users get an actionable hint in
 * the Saropa Log Capture output channel naming the category and how to capture it.
 */
function reportDroppedCategory(deps: OutputEventDeps, category: string): void {
    const logged = deps.droppedCategoriesLogged;
    if (!logged || logged.has(category)) { return; }
    logged.add(category);
    deps.outputChannel?.appendLine(
        `[capture] Dropped DAP output category "${category}" — captureAll is off and this ` +
        `category is not in saropaLogCapture.categories, so its lines are not captured. ` +
        `Enable saropaLogCapture.captureAll, or add "${category}" to saropaLogCapture.categories.`,
    );
}

/**
 * Log that an exclusion pattern hid a Debug Console line, at most once per pattern.
 * This is the captureAll-on counterpart to {@link reportDroppedCategory}: exclusion is the
 * only silent in-extension drop when every category is captured, so naming the matching
 * pattern (once) makes a "missing line" diagnosable instead of looking like broken capture.
 */
function reportExcludedLine(deps: OutputEventDeps, pattern: string): void {
    const logged = deps.excludedRulesLogged;
    if (!logged || logged.has(pattern)) { return; }
    logged.add(pattern);
    deps.outputChannel?.appendLine(
        `[capture] Hid a Debug Console line matching exclusion pattern "${pattern}" ` +
        `(saropaLogCapture.exclusions). Remove or adjust the pattern to capture these lines.`,
    );
}

/** Max characters of line text shown in a diagnostic trace — keep the output channel readable. */
const diagnosticSnippetMax = 80;

/**
 * Trace one DAP output event's fate to the output channel when `diagnosticCapture` is on.
 *
 * This is the decisive signal for "a line is in the Debug Console but missing from the log":
 * every event the extension RECEIVES via DAP is logged here with what happened to it
 * (captured / dropped-category / excluded / flood-suppressed). So if a Debug Console line
 * appears in this trace, the extension got it and the disposition explains the outcome; if a
 * Debug Console line never appears here, it was never delivered to the extension over DAP and
 * cannot be captured — that is a VS Code boundary, not a filtering bug. Off by default; this is
 * an opt-in debug switch, so per-line verbosity is acceptable.
 */
function traceOutcome(deps: OutputEventDeps, category: string, disposition: string, text: string): void {
    if (!deps.config.diagnosticCapture) { return; }
    const snippet = text.length > diagnosticSnippetMax ? `${text.slice(0, diagnosticSnippetMax)}…` : text;
    deps.outputChannel?.appendLine(
        `Capture diagnostic: DAP output category="${category}" -> ${disposition} | "${snippet}"`,
    );
}

/** Dependencies for API writeLine processing (subset of OutputEventDeps). */
export interface WriteLineDeps {
    readonly config: Pick<SaropaLogCaptureConfig, 'enabled'>;
    readonly exclusionRules: readonly ExclusionRule[];
    readonly floodGuard: FloodGuard;
}

/** Input data for a single API-written line. */
export interface WriteLineInput {
    readonly session: LogSession;
    readonly text: string;
    readonly category: string;
    readonly timestamp: Date;
}

/**
 * Process an API-written line — filter, append to log, and broadcast.
 *
 * Unlike {@link processOutputEvent}, this skips the category whitelist
 * (API callers explicitly choose to write) and splits multi-line text.
 */
export function processApiWriteLine(
    deps: WriteLineDeps,
    target: OutputEventTarget,
    input: WriteLineInput,
): void {
    if (!deps.config.enabled) { return; }
    const normalized = input.text.replace(/[\r\n]+$/, '');
    const lines = normalized.includes('\n') ? normalized.split(/\r?\n/) : [normalized];
    for (const line of lines) {
        writeOneLine(deps, target, { ...input, text: line });
    }
}

/** Write a single line through the exclusion/flood/append/broadcast pipeline. */
function writeOneLine(
    deps: WriteLineDeps,
    target: OutputEventTarget,
    input: WriteLineInput,
): void {
    const { session, text, category, timestamp } = input;
    if (text.length > 0) {
        if (testExclusion(text, deps.exclusionRules)) { return; }
        const floodResult = deps.floodGuard.check(text);
        if (!floodResult.allow) { return; }
        if (floodResult.suppressedCount) {
            target.counters.floodSuppressedTotal += floodResult.suppressedCount;
            const summary = `[FLOOD SUPPRESSED: ${floodResult.suppressedCount} identical messages]`;
            session.appendLine(summary, 'system', timestamp);
            target.broadcastLine({
                text: summary, isMarker: false, lineCount: session.lineCount,
                category: 'system', timestamp, logFileUri: session.fileUri.fsPath,
            });
        }
    }
    session.appendLine(text, category, timestamp);
    target.counters.categoryCounts[category] = (target.counters.categoryCounts[category] ?? 0) + 1;
    target.broadcastLine({
        text, isMarker: false, lineCount: session.lineCount,
        category, timestamp, logFileUri: session.fileUri.fsPath,
    });
}

/** Process a verbose DAP protocol message — record it in the log file. */
export function processDapMessage(
    deps: Pick<OutputEventDeps, 'config' | 'sessions'>,
    sessionId: string,
    msg: unknown,
    direction: DapDirection,
): void {
    if (!deps.config.verboseDap) { return; }
    const session = deps.sessions.get(sessionId);
    if (!session) { return; }

    session.appendDapLine(formatDapMessage(msg as DapMessage, direction, new Date()));
}
