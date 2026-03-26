/**
 * Context data loader for the context popover.
 *
 * Loads integration sidecar files (.perf.json, .requests.json, etc.)
 * and filters entries to a time window around a clicked log line.
 */

import * as vscode from 'vscode';
import type { ContextWindow, ContextData, SidecarType } from './context-loader-types';
import { loadPerfContext, loadHttpContext, loadTerminalContext, loadBrowserContext } from './context-sidecar-parsers';

export type {
    ContextWindow,
    ContextData,
    PerfContextEntry,
    HttpContextEntry,
    TerminalContextEntry,
    DockerContextEntry,
    EventContextEntry,
    BrowserContextEntry,
} from './context-loader-types';

const SIDECAR_TYPES: SidecarType[] = [
    { suffix: '.perf.json', loader: loadPerfContext },
    { suffix: '.requests.json', loader: loadHttpContext },
    { suffix: '.terminal.log', loader: loadTerminalContext },
    { suffix: '.browser.json', loader: loadBrowserContext },
];

/**
 * Find sidecar files for a given log file.
 * Includes fixed types (.perf.json, .requests.json, .terminal.log) and
 * external log sidecars (basename.<label>.log, e.g. basename.app.log).
 *
 * @param logUri - URI of the main log file.
 * @returns Array of sidecar file URIs found in the same directory.
 */
export async function findSidecarUris(logUri: vscode.Uri): Promise<vscode.Uri[]> {
    const logPath = logUri.fsPath;
    const lastDot = logPath.lastIndexOf('.');
    const basePath = lastDot > 0 ? logPath.substring(0, lastDot) : logPath;
    const baseName = basePath.slice(Math.max(basePath.lastIndexOf('/'), basePath.lastIndexOf('\\')) + 1) || basePath;

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

    try {
        const dirUri = vscode.Uri.joinPath(logUri, '..');
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        const prefix = baseName + '.';
        const terminalSuffix = baseName + '.terminal.log';
        for (const [name] of entries) {
            if (name.startsWith(prefix) && name.endsWith('.log') && name !== terminalSuffix) {
                sidecars.push(vscode.Uri.joinPath(dirUri, name));
            }
        }
    } catch {
        // Directory read failed, skip external sidecar discovery
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
        (result.events && result.events.length > 0) ||
        (result.browser && result.browser.length > 0)
    );

    return result;
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
