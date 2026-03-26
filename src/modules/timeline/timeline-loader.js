"use strict";
/**
 * Timeline data loader: loads and merges events from all sources
 * (main log file + integration sidecars) into a chronological list.
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
exports.loadTimelineEvents = loadTimelineEvents;
exports.getSourceLabel = getSourceLabel;
exports.getSourceColor = getSourceColor;
const vscode = __importStar(require("vscode"));
const timeline_event_1 = require("./timeline-event");
const timestamp_parser_1 = require("./timestamp-parser");
const viewer_file_loader_1 = require("../../ui/viewer/viewer-file-loader");
const sidecar_loaders_1 = require("./sidecar-loaders");
/** Known sidecar extensions and their source types. */
const SIDECAR_MAP = [
    { ext: '.perf.json', source: 'perf' },
    { ext: '.requests.json', source: 'http' },
    { ext: '.terminal.log', source: 'terminal' },
    { ext: '.container.log', source: 'docker' },
    { ext: '.browser.json', source: 'browser' },
    { ext: '.queries.json', source: 'database' },
    { ext: '.events.json', source: 'events' },
];
/** Find integration sidecar files for a session log file. */
async function findSidecarUris(mainLogUri) {
    const dir = vscode.Uri.joinPath(mainLogUri, '..');
    const mainName = mainLogUri.path.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) {
        return new Map();
    }
    const base = baseMatch[1];
    const results = new Map();
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    }
    catch {
        return results;
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File) {
            continue;
        }
        if (!name.startsWith(base + '.')) {
            continue;
        }
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
async function loadTimelineEvents(options) {
    const { sessionUri, sources, timeRange, maxEvents = 10000, includeAll = true } = options;
    const allSources = ['debug', 'terminal', 'http', 'perf', 'docker', 'events', 'database', 'browser'];
    const enabledSources = new Set(sources ?? allSources);
    const events = [];
    const sourcesFound = [];
    const logData = await loadMainLog(sessionUri);
    const { sessionStart, sessionEnd } = logData;
    if (enabledSources.has('debug') && logData.events.length > 0) {
        events.push(...logData.events);
        sourcesFound.push('debug');
    }
    const sidecarUris = await findSidecarUris(sessionUri);
    const sidecarPromises = [];
    for (const [source, uri] of sidecarUris) {
        if (!enabledSources.has(source)) {
            continue;
        }
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
async function loadMainLog(fileUri) {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const allLines = Buffer.from(raw).toString('utf-8').split('\n');
    const headerEnd = (0, viewer_file_loader_1.findHeaderEnd)(allLines);
    const fields = (0, viewer_file_loader_1.parseHeaderFields)(allLines);
    const midnightMs = (0, viewer_file_loader_1.computeSessionMidnight)(fields['Date'] ?? '');
    const fileUriStr = fileUri.toString();
    const events = [];
    let firstTs = 0, lastTs = 0;
    for (let i = headerEnd; i < allLines.length; i++) {
        const line = allLines[i];
        const match = logLinePattern.exec(line);
        if (!match) {
            continue;
        }
        const ts = (0, viewer_file_loader_1.parseTimeToMs)(match[1], midnightMs);
        if (ts === 0) {
            continue;
        }
        if (firstTs === 0) {
            firstTs = ts;
        }
        lastTs = ts;
        const event = (0, timeline_event_1.parseLogLineToEvent)(line, i, fileUriStr, midnightMs);
        if (event) {
            events.push(event);
        }
    }
    let sessionStart = firstTs, sessionEnd = lastTs;
    const startField = fields['SessionStart'] ?? fields['Start'];
    const endField = fields['SessionEnd'] ?? fields['End'];
    if (startField) {
        const p = (0, timestamp_parser_1.parseTimestamp)(startField, midnightMs);
        if (p) {
            sessionStart = p;
        }
    }
    if (endField) {
        const p = (0, timestamp_parser_1.parseTimestamp)(endField, midnightMs);
        if (p) {
            sessionEnd = p;
        }
    }
    return { events, sessionStart, sessionEnd };
}
async function loadSidecar(source, uri, sessionStart) {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf-8');
    const uriStr = uri.toString();
    switch (source) {
        case 'perf': return (0, sidecar_loaders_1.loadPerfSidecar)(text, uriStr, sessionStart);
        case 'http': return (0, sidecar_loaders_1.loadHttpSidecar)(text, uriStr, sessionStart);
        case 'terminal': return (0, sidecar_loaders_1.loadTerminalSidecar)(text, uriStr, sessionStart);
        case 'docker': return (0, sidecar_loaders_1.loadDockerSidecar)(text, uriStr, sessionStart);
        case 'browser': return (0, sidecar_loaders_1.loadBrowserSidecar)(text, uriStr, sessionStart);
        case 'database': return (0, sidecar_loaders_1.loadDatabaseSidecar)(text, uriStr, sessionStart);
        case 'events': return (0, sidecar_loaders_1.loadEventsSidecar)(text, uriStr, sessionStart);
        default: return [];
    }
}
function computeStats(events, sessionStart, sessionEnd) {
    const bySource = { debug: 0, terminal: 0, http: 0, perf: 0, docker: 0, events: 0, database: 0, browser: 0 };
    const byLevel = { error: 0, warning: 0, info: 0, debug: 0, perf: 0 };
    for (const event of events) {
        bySource[event.source]++;
        byLevel[event.level] = (byLevel[event.level] ?? 0) + 1;
    }
    return { totalEvents: events.length, bySource, byLevel, durationMs: sessionEnd - sessionStart };
}
function getSourceLabel(source) {
    const labels = { debug: 'Debug', terminal: 'Terminal', http: 'HTTP', perf: 'Perf', docker: 'Docker', events: 'Events', database: 'DB', browser: 'Browser' };
    return labels[source] ?? source;
}
function getSourceColor(source) {
    const colors = {
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
//# sourceMappingURL=timeline-loader.js.map