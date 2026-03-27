/**
 * Unified timeline event model for correlating data from multiple sources.
 * Each event has a timestamp, source identifier, severity level, and navigation target.
 */

import { stripAnsi } from '../capture/ansi';
import { classifyLevel, type SeverityLevel } from '../analysis/level-classifier';
import { parseTimestamp } from './timestamp-parser';
export * from './event-types';
import type { PerfSample, HttpRequest, DockerEvent, BrowserEvent, DatabaseQuery, GenericEvent } from './event-types';

/** Source types for timeline events. */
export type TimelineSource = 'debug' | 'terminal' | 'http' | 'perf' | 'docker' | 'events' | 'database' | 'browser';

/** Timeline event severity for visual styling. */
export type TimelineLevel = 'error' | 'warning' | 'info' | 'debug' | 'perf';

/** Navigation target for opening the source of an event. */
export interface TimelineLocation {
    file: string;
    line?: number;
    jsonPath?: string;
}

/** A single event in the unified timeline. */
export interface TimelineEvent {
    timestamp: number;
    source: TimelineSource;
    level: TimelineLevel;
    summary: string;
    detail?: string;
    location?: TimelineLocation;
}

function mapToTimelineLevel(level: SeverityLevel): TimelineLevel {
    switch (level) {
        case 'error': return 'error';
        case 'warning': return 'warning';
        case 'performance': return 'perf';
        case 'debug': return 'debug';
        default: return 'info';
    }
}

const logLinePattern = /^\[([\d:.]+)\]\s*\[(\w+)\]\s?(.*)/;

/** Classification options for debug log lines (must match workspace defaults when omitted). */
export interface DebugLogClassifyOptions {
    readonly strict: boolean;
    readonly stderrTreatAsError: boolean;
}

export function parseLogLineToEvent(
    line: string,
    lineIndex: number,
    fileUri: string,
    sessionStartMs: number,
    classifyOpts: DebugLogClassifyOptions = { strict: true, stderrTreatAsError: false },
): TimelineEvent | undefined {
    const match = logLinePattern.exec(line);
    if (!match) { return undefined; }
    const [, timeStr, category, rest] = match;
    const timestamp = parseTimestamp(timeStr, sessionStartMs);
    if (timestamp === undefined) { return undefined; }
    const plainText = stripAnsi(rest);
    const severity = classifyLevel(plainText, category, classifyOpts.strict, classifyOpts.stderrTreatAsError);
    return { timestamp, source: 'debug', level: mapToTimelineLevel(severity), summary: plainText.slice(0, 120), detail: plainText, location: { file: fileUri, line: lineIndex + 1 } };
}

export function parsePerfSampleToEvent(sample: PerfSample, sidecarUri: string, index: number, prevSample?: PerfSample): TimelineEvent | undefined {
    const memChangeThreshold = 100, loadThreshold = 2.0;
    let summary = `Memory: ${sample.freememMb} MB free`, level: TimelineLevel = 'info', isSignificant = false;
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
        if (sample.loadAvg1 > 4.0) { level = 'warning'; }
        else if (level === 'info') { level = 'perf'; }
    }
    if (!isSignificant) { return undefined; }
    return { timestamp: sample.t, source: 'perf', level, summary, location: { file: sidecarUri, jsonPath: `samples[${index}]` } };
}

export function parseHttpRequestToEvent(request: HttpRequest, sidecarUri: string, index: number, sessionStartMs: number): TimelineEvent | undefined {
    const timestamp = request.timestamp ?? (request.time ? parseTimestamp(request.time, sessionStartMs) : undefined);
    if (timestamp === undefined) { return undefined; }
    const method = request.method ?? 'GET', url = request.url ?? request.path ?? '/unknown';
    const status = request.status ?? request.statusCode, duration = request.duration ?? request.durationMs;
    let level: TimelineLevel = 'info', summary = `${method} ${url}`;
    if (status !== undefined) { summary += ` → ${status}`; if (status >= 500) { level = 'error'; } else if (status >= 400) { level = 'warning'; } }
    if (duration !== undefined) { summary += ` (${duration}ms)`; if (duration > 3000 && level === 'info') { level = 'perf'; } }
    if (request.error) { level = 'error'; summary += ` - ${request.error}`; }
    return { timestamp, source: 'http', level, summary: summary.slice(0, 120), detail: JSON.stringify(request, null, 2), location: { file: sidecarUri, jsonPath: `requests[${index}]` } };
}

const terminalTimestampPattern = /^\[?([\d\-T:.Z]+|\d{13}|\d{10})\]?\s*(.*)/;

export function parseTerminalLineToEvent(line: string, lineIndex: number, sidecarUri: string, sessionStartMs: number): TimelineEvent | undefined {
    const match = terminalTimestampPattern.exec(line);
    if (!match) { return undefined; }
    const [, timeStr, rest] = match;
    const timestamp = parseTimestamp(timeStr, sessionStartMs);
    if (timestamp === undefined) { return undefined; }
    const plainText = stripAnsi(rest || line);
    const level = classifyLevel(plainText, '', true);
    return { timestamp, source: 'terminal', level: mapToTimelineLevel(level), summary: plainText.slice(0, 120), detail: plainText, location: { file: sidecarUri, line: lineIndex + 1 } };
}

export function parseDockerEventToEvent(event: DockerEvent, sidecarUri: string, index: number, sessionStartMs: number): TimelineEvent | undefined {
    const timestamp = event.timestamp ?? (event.time ? parseTimestamp(event.time, sessionStartMs) : undefined);
    if (timestamp === undefined) { return undefined; }
    const message = event.message ?? '';
    let level: TimelineLevel = event.stream === 'stderr' ? 'error' : 'info';
    if (event.level) {
        const lvl = event.level.toLowerCase();
        if (lvl.includes('error') || lvl.includes('fatal')) { level = 'error'; }
        else if (lvl.includes('warn')) { level = 'warning'; }
    } else {
        const severityLevel = classifyLevel(message, '', true);
        const classified = mapToTimelineLevel(severityLevel);
        if (classified === 'error' || classified === 'warning') { level = classified; }
    }
    return { timestamp, source: 'docker', level, summary: message.slice(0, 120), detail: message, location: { file: sidecarUri, jsonPath: `events[${index}]` } };
}

export function parseBrowserEventToEvent(event: BrowserEvent, sidecarUri: string, index: number, sessionStartMs: number): TimelineEvent | undefined {
    const timestamp = event.timestamp ?? (event.time ? parseTimestamp(event.time, sessionStartMs) : undefined);
    if (timestamp === undefined) { return undefined; }
    const message = event.message ?? event.text ?? '';
    const eventLevel = event.level ?? event.type ?? 'log';
    let level: TimelineLevel = 'info';
    if (eventLevel.includes('error')) { level = 'error'; } else if (eventLevel.includes('warn')) { level = 'warning'; } else if (eventLevel.includes('debug')) { level = 'debug'; }
    let summary = message;
    if (event.url) { summary += ` (${event.url}${event.lineNumber !== undefined ? `:${event.lineNumber}` : ''})`; }
    return { timestamp, source: 'browser', level, summary: summary.slice(0, 120), detail: message, location: { file: sidecarUri, jsonPath: `events[${index}]` } };
}

export function parseDatabaseQueryToEvent(query: DatabaseQuery, sidecarUri: string, index: number, sessionStartMs: number): TimelineEvent | undefined {
    const timestamp = query.timestamp ?? (query.time ? parseTimestamp(query.time, sessionStartMs) : undefined);
    if (timestamp === undefined) { return undefined; }
    const sql = query.query ?? query.sql ?? 'unknown query';
    const duration = query.duration ?? query.durationMs;
    let level: TimelineLevel = 'info', summary = sql.slice(0, 60);
    if (duration !== undefined) { summary += ` (${duration}ms)`; if (duration > 1000) { level = 'perf'; } if (duration > 5000) { level = 'warning'; } }
    if (query.rows !== undefined) { summary += ` → ${query.rows} rows`; }
    if (query.error) { level = 'error'; summary += ` - ${query.error}`; }
    return { timestamp, source: 'database', level, summary: summary.slice(0, 120), detail: sql, location: { file: sidecarUri, jsonPath: `queries[${index}]` } };
}

export function parseGenericEventToEvent(event: GenericEvent, sidecarUri: string, index: number, sessionStartMs: number): TimelineEvent | undefined {
    const timestamp = event.timestamp ?? event.t ?? (event.time ? parseTimestamp(event.time, sessionStartMs) : undefined);
    if (timestamp === undefined) { return undefined; }
    const eventType = event.type ?? event.name ?? 'event';
    const message = event.message ?? '';
    let level: TimelineLevel = 'info';
    if (event.level) { const lvl = event.level.toLowerCase(); if (lvl.includes('error') || lvl.includes('fatal')) { level = 'error'; } else if (lvl.includes('warn')) { level = 'warning'; } else if (lvl.includes('debug') || lvl.includes('trace')) { level = 'debug'; } else if (lvl.includes('perf')) { level = 'perf'; } }
    const summary = message ? `[${eventType}] ${message}` : `[${eventType}]`;
    return { timestamp, source: 'events', level, summary: summary.slice(0, 120), detail: JSON.stringify(event, null, 2), location: { file: sidecarUri, jsonPath: `events[${index}]` } };
}
