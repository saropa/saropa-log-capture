"use strict";
/**
 * DAP event processing logic extracted from SessionManagerImpl.
 * Handles output events (filtering, flood suppression, log append)
 * and verbose DAP protocol message recording.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processOutputEvent = processOutputEvent;
exports.processApiWriteLine = processApiWriteLine;
exports.processDapMessage = processDapMessage;
const exclusion_matcher_1 = require("../features/exclusion-matcher");
const dap_formatter_1 = require("../capture/dap-formatter");
/** Process a DAP output event — buffer, filter, append to log, and broadcast. */
function processOutputEvent(deps, target, sessionId, body) {
    const session = deps.sessions.get(sessionId);
    // Buffer events arriving before async session init completes (DAP can fire before startSession returns).
    if (!session) {
        deps.earlyBuffer.add(sessionId, body);
        return;
    }
    if (!deps.config.enabled) {
        return;
    }
    const category = body.category ?? 'console';
    const text = body.output.replace(/[\r\n]+$/, '');
    if (text.length === 0) {
        return;
    }
    if (!deps.config.captureAll && !deps.config.categories.includes(category)) {
        return;
    }
    if ((0, exclusion_matcher_1.testExclusion)(text, deps.exclusionRules)) {
        return;
    }
    const floodResult = deps.floodGuard.check(text);
    if (!floodResult.allow) {
        return;
    }
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
    const sourceLocation = body.source?.path ? { path: body.source.path, line: body.line, column: body.column } : undefined;
    session.appendLine(text, category, now, sourceLocation);
    target.counters.categoryCounts[category] = (target.counters.categoryCounts[category] ?? 0) + 1;
    target.broadcastLine({
        text, isMarker: false, lineCount: session.lineCount,
        category, timestamp: now,
        sourcePath: body.source?.path, sourceLine: body.line,
    });
}
/**
 * Process an API-written line — filter, append to log, and broadcast.
 *
 * Unlike {@link processOutputEvent}, this skips the category whitelist
 * (API callers explicitly choose to write) and splits multi-line text.
 */
function processApiWriteLine(deps, target, input) {
    if (!deps.config.enabled) {
        return;
    }
    const normalized = input.text.replace(/[\r\n]+$/, '');
    const lines = normalized.includes('\n') ? normalized.split(/\r?\n/) : [normalized];
    for (const line of lines) {
        writeOneLine(deps, target, { ...input, text: line });
    }
}
/** Write a single line through the exclusion/flood/append/broadcast pipeline. */
function writeOneLine(deps, target, input) {
    const { session, text, category, timestamp } = input;
    if (text.length > 0) {
        if ((0, exclusion_matcher_1.testExclusion)(text, deps.exclusionRules)) {
            return;
        }
        const floodResult = deps.floodGuard.check(text);
        if (!floodResult.allow) {
            return;
        }
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
function processDapMessage(deps, sessionId, msg, direction) {
    if (!deps.config.verboseDap) {
        return;
    }
    const session = deps.sessions.get(sessionId);
    if (!session) {
        return;
    }
    session.appendDapLine((0, dap_formatter_1.formatDapMessage)(msg, direction, new Date()));
}
//# sourceMappingURL=session-manager-events.js.map