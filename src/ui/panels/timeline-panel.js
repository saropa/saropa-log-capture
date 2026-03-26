"use strict";
/**
 * Unified timeline panel: correlates all data sources (debug console, terminal,
 * integrations) on a single time-synchronized view.
 * Phase 3: Virtual scrolling, time scrubber, minimap, export.
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
exports.showTimeline = showTimeline;
exports.disposeTimelinePanel = disposeTimelinePanel;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../../modules/capture/ansi");
const session_summary_1 = require("../../modules/session/session-summary");
const viewer_content_1 = require("../provider/viewer-content");
const log_search_1 = require("../../modules/search/log-search");
const timeline_panel_styles_1 = require("./timeline-panel-styles");
const timeline_panel_script_1 = require("./timeline-panel-script");
const l10n_1 = require("../../l10n");
const timeline_loader_1 = require("../../modules/timeline/timeline-loader");
const timestamp_parser_1 = require("../../modules/timeline/timestamp-parser");
const correlation_detector_1 = require("../../modules/correlation/correlation-detector");
const correlation_store_1 = require("../../modules/correlation/correlation-store");
let panel;
let currentUri;
let currentResult;
async function showTimeline(fileUri) {
    currentUri = fileUri;
    ensurePanel();
    panel.webview.html = buildLoadingHtml();
    try {
        currentResult = await (0, timeline_loader_1.loadTimelineEvents)({ sessionUri: fileUri, includeAll: true, maxEvents: 100000 });
        if (!panel || currentUri !== fileUri) {
            return;
        }
        const sessionUriStr = fileUri.toString();
        const corrConfig = getCorrelationConfig();
        if (corrConfig.enabled && currentResult.events.length > 0) {
            panel.webview.html = buildLoadingHtml((0, l10n_1.t)('panel.timeline.detectingCorrelations'));
            const correlations = await (0, correlation_detector_1.detectCorrelations)(currentResult.events, corrConfig);
            // Race guard: only apply if user still has this session open (e.g. did not switch to another timeline).
            if (!panel || currentUri !== fileUri) {
                return;
            }
            (0, correlation_store_1.setCorrelations)(sessionUriStr, correlations);
        }
        const filename = fileUri.fsPath.split(/[\\/]/).pop() ?? '';
        panel.webview.html = buildTimelineHtml(currentResult, filename, sessionUriStr);
    }
    catch (err) {
        if (!panel) {
            return;
        }
        panel.webview.html = buildErrorHtml(err instanceof Error ? err.message : String(err));
    }
}
function disposeTimelinePanel() { panel?.dispose(); panel = undefined; currentResult = undefined; }
function ensurePanel() {
    if (panel) {
        panel.reveal();
        return;
    }
    panel = vscode.window.createWebviewPanel('saropaLogCapture.timeline', (0, l10n_1.t)('panel.timeline.title'), vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; currentResult = undefined; });
}
function handleMessage(msg) {
    if (msg.type === 'openLine' && currentUri) {
        (0, log_search_1.openLogAtLine)({ uri: currentUri, filename: '', lineNumber: Number(msg.lineNumber), lineText: '', matchStart: 0, matchEnd: 0 }).catch(() => { });
    }
    else if (msg.type === 'openSidecar' && msg.file) {
        vscode.window.showTextDocument(vscode.Uri.parse(String(msg.file)), { preview: true }).then(() => { }, () => { });
    }
    else if (msg.type === 'openAtLocation' && msg.file && typeof msg.line === 'number') {
        const line = Number(msg.line);
        if (Number.isFinite(line)) {
            (0, log_search_1.openLogAtLine)({ uri: vscode.Uri.parse(String(msg.file)), filename: '', lineNumber: line, lineText: '', matchStart: 0, matchEnd: 0 }).catch(() => { });
        }
    }
    else if (msg.type === 'openFile' && msg.file) {
        vscode.window.showTextDocument(vscode.Uri.parse(String(msg.file)), { preview: true }).then(() => { }, () => { });
    }
    else if (msg.type === 'export' && currentResult) {
        exportTimeline(String(msg.format), currentResult);
    }
}
async function exportTimeline(format, result) {
    const defaultName = `timeline.${format}`;
    const filters = format === 'json' ? { 'JSON': ['json'] } : { 'CSV': ['csv'] };
    const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultName), filters });
    if (!uri) {
        return;
    }
    let content;
    if (format === 'json') {
        content = JSON.stringify(result.events.map(e => ({ timestamp: e.timestamp, source: e.source, level: e.level, summary: e.summary, detail: e.detail })), null, 2);
    }
    else {
        const header = 'timestamp,time,source,level,summary\n';
        const rows = result.events.map(e => `${e.timestamp},"${(0, timestamp_parser_1.formatTimestampShort)(e.timestamp)}","${e.source}","${e.level}","${e.summary.replace(/"/g, '""')}"`).join('\n');
        content = header + rows;
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage((0, l10n_1.t)('msg.exportedTo', uri.fsPath));
}
function buildLoadingHtml(message) {
    const nonce = (0, viewer_content_1.getNonce)();
    const text = message ?? (0, l10n_1.t)('panel.timeline.loading');
    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">${(0, timeline_panel_styles_1.getUnifiedTimelineStyles)()}</style></head><body><div class="loading">${text}</div></body></html>`;
}
function buildErrorHtml(message) {
    const nonce = (0, viewer_content_1.getNonce)();
    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';"><style nonce="${nonce}">${(0, timeline_panel_styles_1.getUnifiedTimelineStyles)()}</style></head><body><div class="error-state">${(0, ansi_1.escapeHtml)(message)}</div></body></html>`;
}
function getCorrelationConfig() {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const enabled = cfg.get('correlation.enabled', true);
    return {
        enabled,
        windowMs: cfg.get('correlation.windowMs', 2000),
        minConfidence: cfg.get('correlation.minConfidence', 'medium'),
        enabledTypes: cfg.get('correlation.types', ['error-http', 'error-memory', 'timeout-network']),
        maxEvents: cfg.get('correlation.maxEvents', 10000),
    };
}
function buildTimelineHtml(result, filename, sessionUriStr) {
    const nonce = (0, viewer_content_1.getNonce)();
    const { events, stats, sourcesFound, sessionStart, sessionEnd } = result;
    if (events.length === 0) {
        return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';"><style nonce="${nonce}">${(0, timeline_panel_styles_1.getUnifiedTimelineStyles)()}</style></head><body>${renderHeader(filename)}<div class="empty-state">${(0, l10n_1.t)('panel.timeline.noEvents')}</div></body></html>`;
    }
    const byLoc = (0, correlation_store_1.getCorrelationByLocation)(sessionUriStr);
    const eventsWithCorrelation = events.map(e => {
        const file = e.location?.file ?? '';
        const line = e.location?.line;
        const key = line !== undefined ? `${file}:${line}` : file;
        const corr = byLoc.get(key);
        return {
            ts: e.timestamp,
            src: e.source,
            lvl: e.level,
            sum: e.summary,
            line: e.location?.line,
            file: e.location?.file,
            cid: corr?.id,
            cdesc: corr?.description,
        };
    });
    const eventsJson = JSON.stringify(eventsWithCorrelation);
    const minimapData = buildMinimapData(events, sessionStart, sessionEnd);
    const correlationsSection = renderCorrelationsSection(sessionUriStr);
    const correlationScript = correlationsSection ? getCorrelationJumpScript(nonce) : '';
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${(0, timeline_panel_styles_1.getUnifiedTimelineStyles)()}</style>
</head><body>
<div role="main" aria-label="Timeline">
${renderHeader(filename)}
${renderToolbar(sourcesFound, stats)}
${correlationsSection}
${renderTimeScrubber(sessionStart, sessionEnd)}
${renderMinimap(minimapData)}
<div class="timeline-container" id="timeline-container"></div>
</div>
<script nonce="${nonce}">${(0, timeline_panel_script_1.getAdvancedScript)(eventsJson, sessionStart, sessionEnd)}</script>
${correlationScript}
</body></html>`;
}
/** Renders the Correlations block HTML when the session has detected correlations; otherwise empty string. */
function renderCorrelationsSection(sessionUriStr) {
    const correlations = (0, correlation_store_1.getCorrelations)(sessionUriStr);
    if (correlations.length === 0) {
        return '';
    }
    const body = correlations.map(c => renderCorrelationItem(c)).join('');
    return `<div class="timeline-correlations">
<div class="cp-header">${(0, l10n_1.t)('panel.correlation.title')}</div>
<div class="cp-list">${body}</div>
</div>`;
}
function renderCorrelationItem(c) {
    const confClass = c.confidence === 'high' ? 'cp-high' : c.confidence === 'medium' ? 'cp-medium' : 'cp-low';
    const eventsHtml = c.events.map((e) => {
        const line = e.location?.line;
        const file = e.location?.file ?? '';
        const label = (0, ansi_1.escapeHtml)(e.summary.slice(0, 60) + (e.summary.length > 60 ? '…' : ''));
        const fileEsc = (0, ansi_1.escapeHtml)(file);
        if (line !== undefined && file) {
            return `<li><button class="cp-jump" data-file="${fileEsc}" data-line="${line}" data-action="openAt" title="${(0, l10n_1.t)('panel.correlation.jumpTo')}">${(0, ansi_1.escapeHtml)(e.source)} L${line}</button> ${label}</li>`;
        }
        if (file) {
            return `<li><button class="cp-jump" data-file="${fileEsc}" data-action="openFile">${(0, ansi_1.escapeHtml)(e.source)}</button> ${label}</li>`;
        }
        return `<li>${label}</li>`;
    }).join('');
    return `<div class="cp-item ${confClass}">
<div class="cp-desc">${(0, ansi_1.escapeHtml)(c.description)}</div>
<ul class="cp-events">${eventsHtml}</ul>
</div>`;
}
/** Inline script that binds .cp-jump buttons to postMessage(openAtLocation/openFile). */
function getCorrelationJumpScript(nonce) {
    return `<script nonce="${nonce}">(function(){var v=acquireVsCodeApi();document.querySelectorAll('.cp-jump').forEach(function(btn){btn.addEventListener('click',function(){var f=btn.getAttribute('data-file');var a=btn.getAttribute('data-action');if(a==='openAt'){var l=parseInt(btn.getAttribute('data-line'),10);v.postMessage({type:'openAtLocation',file:f,line:l})}else{v.postMessage({type:'openFile',file:f})}})})})();</script>`;
}
function renderHeader(filename) {
    return `<div class="header"><div class="title">${(0, l10n_1.t)('panel.timeline.title')}</div><div class="subtitle">${(0, ansi_1.escapeHtml)(filename)}</div></div>`;
}
function renderToolbar(sources, stats) {
    const filterHtml = sources.map(s => `<label class="source-filter"><input type="checkbox" data-source="${s}" checked><span class="source-dot" style="background:${(0, timeline_loader_1.getSourceColor)(s)}"></span><span class="source-label">${(0, timeline_loader_1.getSourceLabel)(s)}</span><span class="source-count">(${stats.bySource[s] ?? 0})</span></label>`).join('');
    const dur = (0, session_summary_1.formatDuration)(stats.durationMs);
    return `<div class="toolbar">
<div class="source-filters">${filterHtml}</div>
<div class="stats-bar">
<span class="stat-item"><span class="stat-label">${(0, l10n_1.t)('panel.timeline.duration')}:</span> ${dur}</span>
<span class="stat-item"><span class="stat-label">${(0, l10n_1.t)('panel.timeline.total')}:</span> ${stats.totalEvents}</span>
<span class="stat-item"><span class="stat-dot error"></span>${stats.byLevel.error ?? 0}</span>
<span class="stat-item"><span class="stat-dot warning"></span>${stats.byLevel.warning ?? 0}</span>
</div>
<div class="export-buttons">
<button class="export-btn" data-format="json">${(0, l10n_1.t)('panel.timeline.exportJson')}</button>
<button class="export-btn" data-format="csv">${(0, l10n_1.t)('panel.timeline.exportCsv')}</button>
</div>
</div>`;
}
function renderTimeScrubber(start, end) {
    const startTime = (0, timestamp_parser_1.formatTimestampShort)(start);
    const endTime = (0, timestamp_parser_1.formatTimestampShort)(end);
    return `<div class="time-scrubber">
<span class="time-label start">${startTime}</span>
<div class="scrubber-track"><div class="scrubber-range" id="scrubber-range"></div><div class="scrubber-handle left" id="handle-left"></div><div class="scrubber-handle right" id="handle-right"></div></div>
<span class="time-label end">${endTime}</span>
<div class="zoom-controls"><button class="zoom-btn" data-zoom="in">+</button><button class="zoom-btn" data-zoom="out">−</button><button class="zoom-btn" data-zoom="reset">⟲</button></div>
</div>`;
}
function buildMinimapData(events, start, end) {
    const bucketCount = 100;
    const range = end - start || 1;
    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
        buckets.push({ x: i, errors: 0, warnings: 0, info: 0 });
    }
    for (const e of events) {
        const idx = Math.min(Math.floor(((e.timestamp - start) / range) * bucketCount), bucketCount - 1);
        if (e.level === 'error') {
            buckets[idx].errors++;
        }
        else if (e.level === 'warning') {
            buckets[idx].warnings++;
        }
        else {
            buckets[idx].info++;
        }
    }
    return buckets;
}
function renderMinimap(buckets) {
    const maxHeight = 30;
    const maxCount = Math.max(1, ...buckets.map(b => b.errors + b.warnings + b.info));
    const bars = buckets.map(b => {
        const total = b.errors + b.warnings + b.info;
        const h = Math.max(2, (total / maxCount) * maxHeight);
        const color = b.errors > 0 ? 'var(--vscode-editorError-foreground)' : b.warnings > 0 ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-descriptionForeground)';
        return `<div class="minimap-bar" style="height:${h}px;background:${color}" data-bucket="${b.x}"></div>`;
    }).join('');
    return `<div class="minimap" id="minimap"><div class="minimap-viewport" id="minimap-viewport"></div>${bars}</div>`;
}
//# sourceMappingURL=timeline-panel.js.map