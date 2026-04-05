/**
 * Timeline data loader: loads and merges events from all sources
 * (main log file + integration sidecars) into a chronological list.
 */

import * as vscode from 'vscode';
import { getConfig } from '../config/config';
import { type TimelineEvent, type TimelineSource, parseLogLineToEvent } from './timeline-event';
import { parseTimestamp } from './timestamp-parser';
import { findHeaderEnd, parseHeaderFields, computeSessionMidnight, parseTimeToMs } from '../../ui/viewer/viewer-file-loader';
import {
    loadPerfSidecar,
    loadHttpSidecar,
    loadTerminalSidecar,
    loadDockerSidecar,
    loadBrowserSidecar,
    loadDatabaseSidecar,
    loadEventsSidecar,
} from './sidecar-loaders';

/** Known sidecar extensions and their source types. */
const SIDECAR_MAP: { ext: string; source: TimelineSource }[] = [
    { ext: '.perf.json', source: 'perf' },
    { ext: '.requests.json', source: 'http' },
    { ext: '.terminal.log', source: 'terminal' },
    { ext: '.container.log', source: 'docker' },
    { ext: '.browser.json', source: 'browser' },
    { ext: '.queries.json', source: 'database' },
    { ext: '.events.json', source: 'events' },
];

/** Options for loading timeline events. */
export interface TimelineLoadOptions {
    /** URI of the main session log file. */
    sessionUri: vscode.Uri;
    /** Which sources to include. Empty = all. */
    sources?: TimelineSource[];
    /** Time range filter (epoch ms). */
    timeRange?: { start: number; end: number };
    /** Maximum events to return (default 10,000). */
    maxEvents?: number;
    /** Include all events or only actionable (errors, warnings, perf). */
    includeAll?: boolean;
}

/** Result of loading timeline events. */
export interface TimelineLoadResult {
    events: TimelineEvent[];
    stats: TimelineStats;
    sessionStart: number;
    sessionEnd: number;
    sourcesFound: TimelineSource[];
}

/** Timeline statistics. */
export interface TimelineStats {
    totalEvents: number;
    bySource: Record<TimelineSource, number>;
    byLevel: Record<string, number>;
    durationMs: number;
}

/** Find integration sidecar files for a session log file. */
async function findSidecarUris(mainLogUri: vscode.Uri): Promise<Map<TimelineSource, vscode.Uri>> {
    const dir = vscode.Uri.joinPath(mainLogUri, '..');
    const mainName = mainLogUri.path.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) { return new Map(); }
    const base = baseMatch[1];
    const results = new Map<TimelineSource, vscode.Uri>();

    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return results;
    }

    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File) { continue; }
        if (!name.startsWith(base + '.')) { continue; }

        for (const { ext, source } of SIDECAR_MAP) {
            if (name.endsWith(ext)) {
                results.set(source, vscode.Uri.joinPath(dir, name));
                break;
            }
        }
    }

    return results;
}

/** Load and merge timeline events from a session and its sidecars. */
export async function loadTimelineEvents(options: TimelineLoadOptions): Promise<TimelineLoadResult> {
    const { sessionUri, sources, timeRange, maxEvents = 10000, includeAll = true } = options;
    const allSources: TimelineSource[] = ['debug', 'terminal', 'http', 'perf', 'docker', 'events', 'database', 'browser'];
    const enabledSources = new Set<TimelineSource>(sources ?? allSources);
    const events: TimelineEvent[] = [];
    const sourcesFound: TimelineSource[] = [];

    const logData = await loadMainLog(sessionUri);
    const { sessionStart, sessionEnd } = logData;

    if (enabledSources.has('debug') && logData.events.length > 0) {
        events.push(...logData.events);
        sourcesFound.push('debug');
    }

    const sidecarUris = await findSidecarUris(sessionUri);
    const sidecarPromises: Promise<TimelineEvent[]>[] = [];

    for (const [source, uri] of sidecarUris) {
        if (!enabledSources.has(source)) { continue; }
        sourcesFound.push(source);
        sidecarPromises.push(loadSidecar(source, uri, sessionStart));
    }

    const sidecarResults = await Promise.all(sidecarPromises);
    for (const sidecarEvents of sidecarResults) {
        events.push(...sidecarEvents);
    }

    events.sort((a, b) => a.timestamp - b.timestamp);

    let filtered = events;
    if (timeRange) {
        filtered = events.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end);
    }
    if (!includeAll) {
        filtered = filtered.filter(e => e.level === 'error' || e.level === 'warning' || e.level === 'perf');
    }
    if (filtered.length > maxEvents) {
        filtered = filtered.slice(0, maxEvents);
    }

    return { events: filtered, stats: computeStats(filtered, sessionStart, sessionEnd), sessionStart, sessionEnd, sourcesFound };
}

const logLinePattern = /^\[([\d:.]+)\]\s*\[(\w+)\]\s?(.*)/;

async function loadMainLog(fileUri: vscode.Uri): Promise<{ events: TimelineEvent[]; sessionStart: number; sessionEnd: number }> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const allLines = Buffer.from(raw).toString('utf-8').split('\n');
    const headerEnd = findHeaderEnd(allLines);
    const fields = parseHeaderFields(allLines);
    const midnightMs = computeSessionMidnight(fields['Date'] ?? '');
    const fileUriStr = fileUri.toString();
    const cfg = getConfig();
    const classifyOpts = {
        strict: cfg.levelDetection === 'strict',
        stderrTreatAsError: cfg.stderrTreatAsError,
    };
    const events: TimelineEvent[] = [];
    let firstTs = 0, lastTs = 0;

    for (let i = headerEnd; i < allLines.length; i++) {
        const line = allLines[i];
        const match = logLinePattern.exec(line);
        if (!match) { continue; }
        const ts = parseTimeToMs(match[1], midnightMs);
        if (ts === 0) { continue; }
        if (firstTs === 0) { firstTs = ts; }
        lastTs = ts;
        const event = parseLogLineToEvent(line, { lineIndex: i, fileUri: fileUriStr, sessionStartMs: midnightMs, classifyOpts });
        if (event) { events.push(event); }
    }

    let sessionStart = firstTs, sessionEnd = lastTs;
    const startField = fields['SessionStart'] ?? fields['Start'];
    const endField = fields['SessionEnd'] ?? fields['End'];
    if (startField) { const p = parseTimestamp(startField, midnightMs); if (p) { sessionStart = p; } }
    if (endField) { const p = parseTimestamp(endField, midnightMs); if (p) { sessionEnd = p; } }

    return { events, sessionStart, sessionEnd };
}

async function loadSidecar(source: TimelineSource, uri: vscode.Uri, sessionStart: number): Promise<TimelineEvent[]> {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf-8');
    const uriStr = uri.toString();

    switch (source) {
        case 'perf': return loadPerfSidecar(text, uriStr, sessionStart);
        case 'http': return loadHttpSidecar(text, uriStr, sessionStart);
        case 'terminal': return loadTerminalSidecar(text, uriStr, sessionStart);
        case 'docker': return loadDockerSidecar(text, uriStr, sessionStart);
        case 'browser': return loadBrowserSidecar(text, uriStr, sessionStart);
        case 'database': return loadDatabaseSidecar(text, uriStr, sessionStart);
        case 'events': return loadEventsSidecar(text, uriStr, sessionStart);
        default: return [];
    }
}

function computeStats(events: TimelineEvent[], sessionStart: number, sessionEnd: number): TimelineStats {
    const bySource: Record<TimelineSource, number> = { debug: 0, terminal: 0, http: 0, perf: 0, docker: 0, events: 0, database: 0, browser: 0 };
    const byLevel: Record<string, number> = { error: 0, warning: 0, info: 0, debug: 0, perf: 0 };
    for (const event of events) {
        bySource[event.source]++;
        byLevel[event.level] = (byLevel[event.level] ?? 0) + 1;
    }
    return { totalEvents: events.length, bySource, byLevel, durationMs: sessionEnd - sessionStart };
}

export function getSourceLabel(source: TimelineSource): string {
    const labels: Record<TimelineSource, string> = { debug: 'Debug', terminal: 'Terminal', http: 'HTTP', perf: 'Perf', docker: 'Docker', events: 'Events', database: 'DB', browser: 'Browser' };
    return labels[source] ?? source;
}

export function getSourceColor(source: TimelineSource): string {
    const colors: Record<TimelineSource, string> = {
        debug: 'var(--vscode-debugIcon-startForeground, #89d185)',
        terminal: 'var(--vscode-terminal-foreground, #cccccc)',
        http: 'var(--vscode-charts-green, #4dc9a2)',
        perf: 'var(--vscode-charts-purple, #b267e6)',
        docker: 'var(--vscode-charts-blue, #75beff)',
        events: 'var(--vscode-charts-orange, #d18616)',
        database: 'var(--vscode-charts-yellow, #dcdcaa)',
        browser: 'var(--vscode-charts-red, #f14c4c)',
    };
    return colors[source] ?? 'var(--vscode-editor-foreground)';
}
