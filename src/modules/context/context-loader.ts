/**
 * Context data loader for the context popover.
 *
 * Loads integration sidecar files (.perf.json, .requests.json, etc.)
 * and filters entries to a time window around a clicked log line.
 */

import * as vscode from 'vscode';
import { parseJSONOrDefault } from '../misc/safe-json';

/** Time window specification for filtering context data. */
export interface ContextWindow {
    /** Center time in epoch milliseconds (from clicked line). */
    centerTime: number;
    /** Window size in milliseconds (applied ±). Default: 5000ms. */
    windowMs: number;
}

/** Performance sample entry from .perf.json sidecar. */
export interface PerfContextEntry {
    timestamp: number;
    freeMemMb: number;
    loadAvg1?: number;
    delta?: string;
}

/** HTTP request entry from .requests.json sidecar. */
export interface HttpContextEntry {
    timestamp: number;
    method: string;
    url: string;
    status: number;
    durationMs: number;
    requestId?: string;
}

/** Terminal output entry from .terminal.log sidecar. */
export interface TerminalContextEntry {
    timestamp: number;
    line: string;
}

/** Docker container event from metadata or sidecar. */
export interface DockerContextEntry {
    timestamp: number;
    containerId: string;
    containerName: string;
    status: string;
    health?: string;
}

/** Generic event entry for other integration sources. */
export interface EventContextEntry {
    timestamp: number;
    source: string;
    message: string;
    level?: string;
}

/** Combined context data from all integration sources. */
export interface ContextData {
    performance?: PerfContextEntry[];
    http?: HttpContextEntry[];
    terminal?: TerminalContextEntry[];
    docker?: DockerContextEntry[];
    events?: EventContextEntry[];
    /** The time window used for filtering. */
    window: ContextWindow;
    /** Whether any data was found. */
    hasData: boolean;
}

/** Sidecar file type to loader mapping. */
interface SidecarType {
    suffix: string;
    loader: (content: string, window: ContextWindow) => Partial<ContextData>;
}

const SIDECAR_TYPES: SidecarType[] = [
    { suffix: '.perf.json', loader: loadPerfContext },
    { suffix: '.requests.json', loader: loadHttpContext },
    { suffix: '.terminal.log', loader: loadTerminalContext },
];

/**
 * Find sidecar files for a given log file.
 *
 * @param logUri - URI of the main log file.
 * @returns Array of sidecar file URIs found in the same directory.
 */
export async function findSidecarUris(logUri: vscode.Uri): Promise<vscode.Uri[]> {
    const logPath = logUri.fsPath;
    const lastDot = logPath.lastIndexOf('.');
    const basePath = lastDot > 0 ? logPath.substring(0, lastDot) : logPath;

    const sidecars: vscode.Uri[] = [];
    for (const type of SIDECAR_TYPES) {
        const sidecarPath = basePath + type.suffix;
        const sidecarUri = vscode.Uri.file(sidecarPath);
        try {
            await vscode.workspace.fs.stat(sidecarUri);
            sidecars.push(sidecarUri);
        } catch {
            // Sidecar doesn't exist, skip
        }
    }
    return sidecars;
}

/**
 * Get the sidecar type suffix from a URI.
 */
function getSidecarSuffix(uri: vscode.Uri): string {
    const path = uri.fsPath;
    for (const type of SIDECAR_TYPES) {
        if (path.endsWith(type.suffix)) {
            return type.suffix;
        }
    }
    return '';
}

/**
 * Load and filter context data from all available sidecar files.
 *
 * @param logUri - URI of the main log file.
 * @param window - Time window to filter data.
 * @returns Combined context data from all sources.
 */
export async function loadContextData(
    logUri: vscode.Uri,
    window: ContextWindow,
): Promise<ContextData> {
    const result: ContextData = {
        window,
        hasData: false,
    };

    const sidecars = await findSidecarUris(logUri);

    for (const sidecarUri of sidecars) {
        const suffix = getSidecarSuffix(sidecarUri);
        const sidecarType = SIDECAR_TYPES.find(t => t.suffix === suffix);
        if (!sidecarType) { continue; }

        try {
            const content = await vscode.workspace.fs.readFile(sidecarUri);
            const contentStr = Buffer.from(content).toString('utf-8');
            const partial = sidecarType.loader(contentStr, window);
            Object.assign(result, partial);
        } catch {
            // Failed to read sidecar, skip
        }
    }

    result.hasData = !!(
        (result.performance && result.performance.length > 0) ||
        (result.http && result.http.length > 0) ||
        (result.terminal && result.terminal.length > 0) ||
        (result.docker && result.docker.length > 0) ||
        (result.events && result.events.length > 0)
    );

    return result;
}

/**
 * Load and filter performance samples from .perf.json sidecar.
 */
function loadPerfContext(content: string, window: ContextWindow): Partial<ContextData> {
    const data = parseJSONOrDefault<{ samples?: { t: number; freememMb: number; loadAvg1?: number }[] }>(content, {});
    if (!data.samples || !Array.isArray(data.samples)) {
        return {};
    }

    const minTime = window.centerTime - window.windowMs;
    const maxTime = window.centerTime + window.windowMs;

    const filtered: PerfContextEntry[] = data.samples
        .filter(s => s.t >= minTime && s.t <= maxTime)
        .map(s => ({
            timestamp: s.t,
            freeMemMb: s.freememMb,
            loadAvg1: s.loadAvg1,
        }));

    if (filtered.length === 0) { return {}; }

    if (filtered.length >= 2) {
        const first = filtered[0];
        const last = filtered[filtered.length - 1];
        const memDelta = last.freeMemMb - first.freeMemMb;
        const sign = memDelta >= 0 ? '+' : '';
        last.delta = `${sign}${memDelta}MB from window start`;
    }

    return { performance: filtered };
}

/**
 * Load and filter HTTP requests from .requests.json sidecar.
 */
function loadHttpContext(content: string, window: ContextWindow): Partial<ContextData> {
    const data = parseJSONOrDefault<{ requests?: Record<string, unknown>[] }>(content, {});
    if (!data.requests || !Array.isArray(data.requests)) {
        return {};
    }

    const minTime = window.centerTime - window.windowMs;
    const maxTime = window.centerTime + window.windowMs;

    const filtered: HttpContextEntry[] = [];
    for (const req of data.requests) {
        const timestamp = extractTimestamp(req);
        if (timestamp === 0 || timestamp < minTime || timestamp > maxTime) {
            continue;
        }

        filtered.push({
            timestamp,
            method: String(req.method || 'GET'),
            url: String(req.url || req.path || ''),
            status: Number(req.status || req.statusCode || 0),
            durationMs: Number(req.duration || req.durationMs || req.responseTime || 0),
            requestId: req.requestId ? String(req.requestId) : undefined,
        });
    }

    if (filtered.length === 0) { return {}; }

    filtered.sort((a, b) => a.timestamp - b.timestamp);
    return { http: filtered.slice(0, 50) };
}

/**
 * Load and filter terminal output from .terminal.log sidecar.
 */
function loadTerminalContext(content: string, window: ContextWindow): Partial<ContextData> {
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) { return {}; }

    const minTime = window.centerTime - window.windowMs;
    const maxTime = window.centerTime + window.windowMs;

    const filtered: TerminalContextEntry[] = [];
    for (const line of lines) {
        const tsMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/);
        if (!tsMatch) { continue; }

        const timestamp = new Date(tsMatch[1]).getTime();
        if (isNaN(timestamp) || timestamp < minTime || timestamp > maxTime) {
            continue;
        }

        const text = line.substring(tsMatch[0].length).trim();
        if (text) {
            filtered.push({ timestamp, line: text });
        }
    }

    if (filtered.length === 0) { return {}; }

    return { terminal: filtered.slice(0, 30) };
}

/**
 * Extract timestamp from a request object.
 */
function extractTimestamp(obj: Record<string, unknown>): number {
    const candidates = ['timestamp', 'time', 'ts', 'startTime', 'requestTime', 'createdAt'];
    for (const key of candidates) {
        const val = obj[key];
        if (typeof val === 'number' && val > 0) {
            return val < 1e12 ? val * 1000 : val;
        }
        if (typeof val === 'string') {
            const parsed = Date.parse(val);
            if (!isNaN(parsed)) { return parsed; }
        }
    }
    return 0;
}

/**
 * Load context data from session metadata integrations.
 *
 * Used as a fallback when no sidecar files exist but integration
 * metadata was captured in the session.
 */
export async function loadContextFromMeta(
    integrations: Record<string, unknown> | undefined,
    window: ContextWindow,
): Promise<Partial<ContextData>> {
    if (!integrations) { return {}; }

    const result: Partial<ContextData> = {};

    const perfMeta = integrations.performance as Record<string, unknown> | undefined;
    if (perfMeta?.snapshot) {
        const snapshot = perfMeta.snapshot as Record<string, unknown>;
        result.performance = [{
            timestamp: window.centerTime,
            freeMemMb: Number(snapshot.freeMemMb || 0),
            loadAvg1: Array.isArray(snapshot.loadAvg) ? Number(snapshot.loadAvg[0]) : undefined,
        }];
    }

    const dockerMeta = integrations.docker as Record<string, unknown> | undefined;
    if (dockerMeta?.containers && Array.isArray(dockerMeta.containers)) {
        const capturedAt = Number(dockerMeta.capturedAt || window.centerTime);
        result.docker = (dockerMeta.containers as Record<string, unknown>[]).map(c => ({
            timestamp: capturedAt,
            containerId: String(c.containerId || c.id || '').substring(0, 12),
            containerName: String(c.name || c.containerName || ''),
            status: String(c.status || c.state || 'unknown'),
            health: c.health ? String(c.health) : undefined,
        }));
    }

    return result;
}
