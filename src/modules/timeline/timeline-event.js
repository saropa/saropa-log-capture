"use strict";
/**
 * Unified timeline event model for correlating data from multiple sources.
 * Each event has a timestamp, source identifier, severity level, and navigation target.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLogLineToEvent = parseLogLineToEvent;
exports.parsePerfSampleToEvent = parsePerfSampleToEvent;
exports.parseHttpRequestToEvent = parseHttpRequestToEvent;
exports.parseTerminalLineToEvent = parseTerminalLineToEvent;
exports.parseDockerEventToEvent = parseDockerEventToEvent;
exports.parseBrowserEventToEvent = parseBrowserEventToEvent;
exports.parseDatabaseQueryToEvent = parseDatabaseQueryToEvent;
exports.parseGenericEventToEvent = parseGenericEventToEvent;
const ansi_1 = require("../capture/ansi");
const level_classifier_1 = require("../analysis/level-classifier");
const timestamp_parser_1 = require("./timestamp-parser");
__exportStar(require("./event-types"), exports);
function mapToTimelineLevel(level) {
    switch (level) {
        case 'error': return 'error';
        case 'warning': return 'warning';
        case 'performance': return 'perf';
        case 'debug': return 'debug';
        default: return 'info';
    }
}
const logLinePattern = /^\[([\d:.]+)\]\s*\[(\w+)\]\s?(.*)/;
function parseLogLineToEvent(line, opts) {
    const match = logLinePattern.exec(line);
    if (!match) {
        return undefined;
    }
    const [, timeStr, category, rest] = match;
    const timestamp = (0, timestamp_parser_1.parseTimestamp)(timeStr, opts.sessionStartMs);
    if (timestamp === undefined) {
        return undefined;
    }
    const classify = opts.classifyOpts ?? { strict: true, stderrTreatAsError: false };
    const plainText = (0, ansi_1.stripAnsi)(rest);
    const severity = (0, level_classifier_1.classifyLevel)(plainText, category, classify.strict, classify.stderrTreatAsError);
    return { timestamp, source: 'debug', level: mapToTimelineLevel(severity), summary: plainText.slice(0, 120), detail: plainText, location: { file: opts.fileUri, line: opts.lineIndex + 1 } };
}
function parsePerfSampleToEvent(sample, sidecarUri, index, prevSample) {
    const memChangeThreshold = 100, loadThreshold = 2.0;
    let summary = `Memory: ${sample.freememMb} MB free`, level = 'info', isSignificant = false;
    if (prevSample) {
        const memDelta = prevSample.freememMb - sample.freememMb;
        if (Math.abs(memDelta) >= memChangeThreshold) {
            isSignificant = true;
            summary = memDelta > 0 ? `Memory drop: ${prevSample.freememMb} → ${sample.freememMb} MB (-${memDelta} MB)` : `Memory freed: ${prevSample.freememMb} → ${sample.freememMb} MB (+${-memDelta} MB)`;
            level = memDelta > 200 ? 'warning' : 'perf';
        }
    }
    if (sample.loadAvg1 !== undefined && sample.loadAvg1 > loadThreshold) {
        isSignificant = true;
        summary += ` | Load: ${sample.loadAvg1.toFixed(2)}`;
        if (sample.loadAvg1 > 4.0) {
            level = 'warning';
        }
        else if (level === 'info') {
            level = 'perf';
        }
    }
    if (!isSignificant) {
        return undefined;
    }
    return { timestamp: sample.t, source: 'perf', level, summary, location: { file: sidecarUri, jsonPath: `samples[${index}]` } };
}
function parseHttpRequestToEvent(request, sidecarUri, index, sessionStartMs) {
    const timestamp = request.timestamp ?? (request.time ? (0, timestamp_parser_1.parseTimestamp)(request.time, sessionStartMs) : undefined);
    if (timestamp === undefined) {
        return undefined;
    }
    const method = request.method ?? 'GET', url = request.url ?? request.path ?? '/unknown';
    const status = request.status ?? request.statusCode, duration = request.duration ?? request.durationMs;
    let level = 'info', summary = `${method} ${url}`;
    if (status !== undefined) {
        summary += ` → ${status}`;
        if (status >= 500) {
            level = 'error';
        }
        else if (status >= 400) {
            level = 'warning';
        }
    }
    if (duration !== undefined) {
        summary += ` (${duration}ms)`;
        if (duration > 3000 && level === 'info') {
            level = 'perf';
        }
    }
    if (request.error) {
        level = 'error';
        summary += ` - ${request.error}`;
    }
    return { timestamp, source: 'http', level, summary: summary.slice(0, 120), detail: JSON.stringify(request, null, 2), location: { file: sidecarUri, jsonPath: `requests[${index}]` } };
}
const terminalTimestampPattern = /^\[?([\d\-T:.Z]+|\d{13}|\d{10})\]?\s*(.*)/;
function parseTerminalLineToEvent(line, lineIndex, sidecarUri, sessionStartMs) {
    const match = terminalTimestampPattern.exec(line);
    if (!match) {
        return undefined;
    }
    const [, timeStr, rest] = match;
    const timestamp = (0, timestamp_parser_1.parseTimestamp)(timeStr, sessionStartMs);
    if (timestamp === undefined) {
        return undefined;
    }
    const plainText = (0, ansi_1.stripAnsi)(rest || line);
    const level = (0, level_classifier_1.classifyLevel)(plainText, '', true);
    return { timestamp, source: 'terminal', level: mapToTimelineLevel(level), summary: plainText.slice(0, 120), detail: plainText, location: { file: sidecarUri, line: lineIndex + 1 } };
}
function parseDockerEventToEvent(event, sidecarUri, index, sessionStartMs) {
    const timestamp = event.timestamp ?? (event.time ? (0, timestamp_parser_1.parseTimestamp)(event.time, sessionStartMs) : undefined);
    if (timestamp === undefined) {
        return undefined;
    }
    const message = event.message ?? '';
    let level = event.stream === 'stderr' ? 'error' : 'info';
    if (event.level) {
        const lvl = event.level.toLowerCase();
        if (lvl.includes('error') || lvl.includes('fatal')) {
            level = 'error';
        }
        else if (lvl.includes('warn')) {
            level = 'warning';
        }
    }
    else {
        const severityLevel = (0, level_classifier_1.classifyLevel)(message, '', true);
        const classified = mapToTimelineLevel(severityLevel);
        if (classified === 'error' || classified === 'warning') {
            level = classified;
        }
    }
    return { timestamp, source: 'docker', level, summary: message.slice(0, 120), detail: message, location: { file: sidecarUri, jsonPath: `events[${index}]` } };
}
function parseBrowserEventToEvent(event, sidecarUri, index, sessionStartMs) {
    const timestamp = event.timestamp ?? (event.time ? (0, timestamp_parser_1.parseTimestamp)(event.time, sessionStartMs) : undefined);
    if (timestamp === undefined) {
        return undefined;
    }
    const message = event.message ?? event.text ?? '';
    const eventLevel = event.level ?? event.type ?? 'log';
    let level = 'info';
    if (eventLevel.includes('error')) {
        level = 'error';
    }
    else if (eventLevel.includes('warn')) {
        level = 'warning';
    }
    else if (eventLevel.includes('debug')) {
        level = 'debug';
    }
    let summary = message;
    if (event.url) {
        summary += ` (${event.url}${event.lineNumber !== undefined ? `:${event.lineNumber}` : ''})`;
    }
    return { timestamp, source: 'browser', level, summary: summary.slice(0, 120), detail: message, location: { file: sidecarUri, jsonPath: `events[${index}]` } };
}
function parseDatabaseQueryToEvent(query, sidecarUri, index, sessionStartMs) {
    const timestamp = query.timestamp ?? (query.time ? (0, timestamp_parser_1.parseTimestamp)(query.time, sessionStartMs) : undefined);
    if (timestamp === undefined) {
        return undefined;
    }
    const sql = query.query ?? query.sql ?? 'unknown query';
    const duration = query.duration ?? query.durationMs;
    let level = 'info', summary = sql.slice(0, 60);
    if (duration !== undefined) {
        summary += ` (${duration}ms)`;
        if (duration > 1000) {
            level = 'perf';
        }
        if (duration > 5000) {
            level = 'warning';
        }
    }
    if (query.rows !== undefined) {
        summary += ` → ${query.rows} rows`;
    }
    if (query.error) {
        level = 'error';
        summary += ` - ${query.error}`;
    }
    return { timestamp, source: 'database', level, summary: summary.slice(0, 120), detail: sql, location: { file: sidecarUri, jsonPath: `queries[${index}]` } };
}
function parseGenericEventToEvent(event, sidecarUri, index, sessionStartMs) {
    const timestamp = event.timestamp ?? event.t ?? (event.time ? (0, timestamp_parser_1.parseTimestamp)(event.time, sessionStartMs) : undefined);
    if (timestamp === undefined) {
        return undefined;
    }
    const eventType = event.type ?? event.name ?? 'event';
    const message = event.message ?? '';
    let level = 'info';
    if (event.level) {
        const lvl = event.level.toLowerCase();
        if (lvl.includes('error') || lvl.includes('fatal')) {
            level = 'error';
        }
        else if (lvl.includes('warn')) {
            level = 'warning';
        }
        else if (lvl.includes('debug') || lvl.includes('trace')) {
            level = 'debug';
        }
        else if (lvl.includes('perf')) {
            level = 'perf';
        }
    }
    const summary = message ? `[${eventType}] ${message}` : `[${eventType}]`;
    return { timestamp, source: 'events', level, summary: summary.slice(0, 120), detail: JSON.stringify(event, null, 2), location: { file: sidecarUri, jsonPath: `events[${index}]` } };
}
//# sourceMappingURL=timeline-event.js.map