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
import { ExclusionRule, testExclusion } from '../features/exclusion-matcher';
import { DapMessage, DapDirection, formatDapMessage } from '../capture/dap-formatter';
import { LineData, EarlyOutputBuffer } from './session-event-bus';

/** Read-only dependencies for output event processing. */
export interface OutputEventDeps {
    readonly sessions: ReadonlyMap<string, LogSession>;
    readonly earlyBuffer: EarlyOutputBuffer;
    readonly config: SaropaLogCaptureConfig;
    readonly exclusionRules: readonly ExclusionRule[];
    readonly floodGuard: FloodGuard;
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

    if (!deps.config.captureAll && !deps.config.categories.includes(category)) { return; }
    if (testExclusion(text, deps.exclusionRules)) { return; }

    const floodResult = deps.floodGuard.check(text);
    if (!floodResult.allow) { return; }
    const now = new Date();

    if (floodResult.suppressedCount) {
        target.counters.floodSuppressedTotal += floodResult.suppressedCount;
        const summary = `[FLOOD SUPPRESSED: ${floodResult.suppressedCount} identical messages]`;
        session.appendLine(summary, 'system', now);
        target.broadcastLine({
            text: summary, isMarker: false, lineCount: session.lineCount,
            category: 'system', timestamp: now,
        });
    }

    const sourceLocation: SourceLocation | undefined =
        body.source?.path ? { path: body.source.path, line: body.line, column: body.column } : undefined;
    session.appendLine(text, category, now, sourceLocation);
    target.counters.categoryCounts[category] = (target.counters.categoryCounts[category] ?? 0) + 1;
    target.broadcastLine({
        text, isMarker: false, lineCount: session.lineCount,
        category, timestamp: now,
        sourcePath: body.source?.path, sourceLine: body.line,
    });
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
                category: 'system', timestamp,
            });
        }
    }
    session.appendLine(text, category, timestamp);
    target.counters.categoryCounts[category] = (target.counters.categoryCounts[category] ?? 0) + 1;
    target.broadcastLine({
        text, isMarker: false, lineCount: session.lineCount,
        category, timestamp,
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
