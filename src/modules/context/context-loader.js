"use strict";
/**
 * Context data loader for the context popover.
 *
 * Loads integration sidecar files (.perf.json, .requests.json, etc.)
 * and filters entries to a time window around a clicked log line.
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSidecarUris = findSidecarUris;
exports.loadContextData = loadContextData;
exports.loadContextFromMeta = loadContextFromMeta;
const vscode = __importStar(require("vscode"));
const context_sidecar_parsers_1 = require("./context-sidecar-parsers");
const SIDECAR_TYPES = [
    { suffix: '.perf.json', loader: context_sidecar_parsers_1.loadPerfContext },
    { suffix: '.requests.json', loader: context_sidecar_parsers_1.loadHttpContext },
    { suffix: '.terminal.log', loader: context_sidecar_parsers_1.loadTerminalContext },
    { suffix: '.browser.json', loader: context_sidecar_parsers_1.loadBrowserContext },
    { suffix: '.queries.json', loader: context_sidecar_parsers_1.loadDatabaseContext },
];
/**
 * Find sidecar files for a given log file.
 * Includes fixed types (.perf.json, .requests.json, .terminal.log) and
 * external log sidecars (basename.<label>.log, e.g. basename.app.log).
 *
 * @param logUri - URI of the main log file.
 * @returns Array of sidecar file URIs found in the same directory.
 */
async function findSidecarUris(logUri) {
    const logPath = logUri.fsPath;
    const lastDot = logPath.lastIndexOf('.');
    const basePath = lastDot > 0 ? logPath.substring(0, lastDot) : logPath;
    const baseName = basePath.slice(Math.max(basePath.lastIndexOf('/'), basePath.lastIndexOf('\\')) + 1) || basePath;
    const sidecars = [];
    for (const type of SIDECAR_TYPES) {
        const sidecarPath = basePath + type.suffix;
        const sidecarUri = vscode.Uri.file(sidecarPath);
        try {
            await vscode.workspace.fs.stat(sidecarUri);
            sidecars.push(sidecarUri);
        }
        catch {
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
    }
    catch {
        // Directory read failed, skip external sidecar discovery
    }
    return sidecars;
}
/**
 * Get the sidecar type suffix from a URI.
 */
function getSidecarSuffix(uri) {
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
async function loadContextData(logUri, window) {
    const result = {
        window,
        hasData: false,
    };
    const sidecars = await findSidecarUris(logUri);
    for (const sidecarUri of sidecars) {
        const suffix = getSidecarSuffix(sidecarUri);
        const sidecarType = SIDECAR_TYPES.find(t => t.suffix === suffix);
        if (!sidecarType) {
            continue;
        }
        try {
            const content = await vscode.workspace.fs.readFile(sidecarUri);
            const contentStr = Buffer.from(content).toString('utf-8');
            const partial = sidecarType.loader(contentStr, window);
            Object.assign(result, partial);
        }
        catch {
            // Failed to read sidecar, skip
        }
    }
    result.hasData = !!((result.performance && result.performance.length > 0) ||
        (result.http && result.http.length > 0) ||
        (result.terminal && result.terminal.length > 0) ||
        (result.docker && result.docker.length > 0) ||
        (result.database && result.database.length > 0) ||
        (result.events && result.events.length > 0) ||
        (result.browser && result.browser.length > 0));
    return result;
}
/**
 * Load context data from session metadata integrations.
 *
 * Used as a fallback when no sidecar files exist but integration
 * metadata was captured in the session.
 */
async function loadContextFromMeta(integrations, window) {
    if (!integrations) {
        return {};
    }
    const result = {};
    const perfMeta = integrations.performance;
    if (perfMeta?.snapshot) {
        const snapshot = perfMeta.snapshot;
        result.performance = [{
                timestamp: window.centerTime,
                freeMemMb: Number(snapshot.freeMemMb || 0),
                loadAvg1: Array.isArray(snapshot.loadAvg) ? Number(snapshot.loadAvg[0]) : undefined,
            }];
    }
    const dockerMeta = integrations.docker;
    if (dockerMeta?.containers && Array.isArray(dockerMeta.containers)) {
        const capturedAt = Number(dockerMeta.capturedAt || window.centerTime);
        result.docker = dockerMeta.containers.map(c => ({
            timestamp: capturedAt,
            containerId: String(c.containerId || c.id || '').substring(0, 12),
            containerName: String(c.name || c.containerName || ''),
            status: String(c.status || c.state || 'unknown'),
            health: c.health ? String(c.health) : undefined,
        }));
    }
    return result;
}
//# sourceMappingURL=context-loader.js.map