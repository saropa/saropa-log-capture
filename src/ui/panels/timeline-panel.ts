/**
 * Unified timeline panel: correlates all data sources (debug console, terminal,
 * integrations) on a single time-synchronized view.
 * Phase 3: Virtual scrolling, time scrubber, minimap, export.
 */

import * as vscode from 'vscode';
import { escapeHtml } from '../../modules/capture/ansi';
import { formatDuration } from '../../modules/session/session-summary';
import { getNonce } from '../provider/viewer-content';
import { openLogAtLine } from '../../modules/search/log-search';
import { getUnifiedTimelineStyles } from './timeline-panel-styles';
import { getAdvancedScript } from './timeline-panel-script';
import { t } from '../../l10n';
import { loadTimelineEvents, getSourceLabel, getSourceColor, type TimelineLoadResult } from '../../modules/timeline/timeline-loader';
import { type TimelineEvent, type TimelineSource } from '../../modules/timeline/timeline-event';
import { formatTimestampShort } from '../../modules/timeline/timestamp-parser';
import { detectCorrelations, type DetectorConfig } from '../../modules/correlation/correlation-detector';
import { setCorrelations, getCorrelationByLocation } from '../../modules/correlation/correlation-store';

let panel: vscode.WebviewPanel | undefined;
let currentUri: vscode.Uri | undefined;
let currentResult: TimelineLoadResult | undefined;

export async function showTimeline(fileUri: vscode.Uri): Promise<void> {
    currentUri = fileUri;
    ensurePanel();
    panel!.webview.html = buildLoadingHtml();

    try {
        currentResult = await loadTimelineEvents({ sessionUri: fileUri, includeAll: true, maxEvents: 100000 });
        if (!panel || currentUri !== fileUri) { return; }
        const sessionUriStr = fileUri.toString();
        const corrConfig = getCorrelationConfig();
        if (corrConfig.enabled && currentResult.events.length > 0) {
            panel.webview.html = buildLoadingHtml(t('panel.timeline.detectingCorrelations'));
            const correlations = await detectCorrelations(currentResult.events, corrConfig);
            // Race guard: only apply if user still has this session open (e.g. did not switch to another timeline).
            if (!panel || currentUri !== fileUri) { return; }
            setCorrelations(sessionUriStr, correlations);
        }
        const filename = fileUri.fsPath.split(/[\\/]/).pop() ?? '';
        panel.webview.html = buildTimelineHtml(currentResult, filename, sessionUriStr);
    } catch (err) {
        if (!panel) { return; }
        panel.webview.html = buildErrorHtml(err instanceof Error ? err.message : String(err));
    }
}

export function disposeTimelinePanel(): void { panel?.dispose(); panel = undefined; currentResult = undefined; }

function ensurePanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel('saropaLogCapture.timeline', t('panel.timeline.title'), vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; currentResult = undefined; });
}

function handleMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'openLine' && currentUri) {
        openLogAtLine({ uri: currentUri, filename: '', lineNumber: Number(msg.lineNumber), lineText: '', matchStart: 0, matchEnd: 0 }).catch(() => {});
    } else if (msg.type === 'openSidecar' && msg.file) {
        vscode.window.showTextDocument(vscode.Uri.parse(String(msg.file)), { preview: true }).then(() => {}, () => {});
    } else if (msg.type === 'export' && currentResult) {
        exportTimeline(String(msg.format), currentResult);
    }
}

async function exportTimeline(format: string, result: TimelineLoadResult): Promise<void> {
    const defaultName = `timeline.${format}`;
    const filters: Record<string, string[]> = format === 'json' ? { 'JSON': ['json'] } : { 'CSV': ['csv'] };
    const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultName), filters });
    if (!uri) { return; }

    let content: string;
    if (format === 'json') {
        content = JSON.stringify(result.events.map(e => ({ timestamp: e.timestamp, source: e.source, level: e.level, summary: e.summary, detail: e.detail })), null, 2);
    } else {
        const header = 'timestamp,time,source,level,summary\n';
        const rows = result.events.map(e => `${e.timestamp},"${formatTimestampShort(e.timestamp)}","${e.source}","${e.level}","${e.summary.replace(/"/g, '""')}"`).join('\n');
        content = header + rows;
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage(t('msg.exportedTo', uri.fsPath));
}

function buildLoadingHtml(message?: string): string {
    const nonce = getNonce();
    const text = message ?? t('panel.timeline.loading');
    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">${getUnifiedTimelineStyles()}</style></head><body><div class="loading">${text}</div></body></html>`;
}

function buildErrorHtml(message: string): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';"><style nonce="${nonce}">${getUnifiedTimelineStyles()}</style></head><body><div class="error-state">${escapeHtml(message)}</div></body></html>`;
}

function getCorrelationConfig(): DetectorConfig & { enabled: boolean } {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const enabled = cfg.get<boolean>('correlation.enabled', true);
    return {
        enabled,
        windowMs: cfg.get<number>('correlation.windowMs', 2000),
        minConfidence: cfg.get<'low' | 'medium' | 'high'>('correlation.minConfidence', 'medium'),
        enabledTypes: cfg.get<string[]>('correlation.types', ['error-http', 'error-memory', 'timeout-network']) as DetectorConfig['enabledTypes'],
        maxEvents: cfg.get<number>('correlation.maxEvents', 10000),
    };
}

function buildTimelineHtml(result: TimelineLoadResult, filename: string, sessionUriStr: string): string {
    const nonce = getNonce();
    const { events, stats, sourcesFound, sessionStart, sessionEnd } = result;

    if (events.length === 0) {
        return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';"><style nonce="${nonce}">${getUnifiedTimelineStyles()}</style></head><body>${renderHeader(filename)}<div class="empty-state">${t('panel.timeline.noEvents')}</div></body></html>`;
    }

    const byLoc = getCorrelationByLocation(sessionUriStr);
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

    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getUnifiedTimelineStyles()}</style>
</head><body>
${renderHeader(filename)}
${renderToolbar(sourcesFound, stats)}
${renderTimeScrubber(sessionStart, sessionEnd)}
${renderMinimap(minimapData)}
<div class="timeline-container" id="timeline-container"></div>
<script nonce="${nonce}">${getAdvancedScript(eventsJson, sessionStart, sessionEnd)}</script>
</body></html>`;
}

function renderHeader(filename: string): string {
    return `<div class="header"><div class="title">${t('panel.timeline.title')}</div><div class="subtitle">${escapeHtml(filename)}</div></div>`;
}

function renderToolbar(sources: TimelineSource[], stats: { totalEvents: number; durationMs: number; bySource: Record<TimelineSource, number>; byLevel: Record<string, number> }): string {
    const filterHtml = sources.map(s => `<label class="source-filter"><input type="checkbox" data-source="${s}" checked><span class="source-dot" style="background:${getSourceColor(s)}"></span><span class="source-label">${getSourceLabel(s)}</span><span class="source-count">(${stats.bySource[s] ?? 0})</span></label>`).join('');
    const dur = formatDuration(stats.durationMs);
    return `<div class="toolbar">
<div class="source-filters">${filterHtml}</div>
<div class="stats-bar">
<span class="stat-item"><span class="stat-label">${t('panel.timeline.duration')}:</span> ${dur}</span>
<span class="stat-item"><span class="stat-label">${t('panel.timeline.total')}:</span> ${stats.totalEvents}</span>
<span class="stat-item"><span class="stat-dot error"></span>${stats.byLevel.error ?? 0}</span>
<span class="stat-item"><span class="stat-dot warning"></span>${stats.byLevel.warning ?? 0}</span>
</div>
<div class="export-buttons">
<button class="export-btn" data-format="json">${t('panel.timeline.exportJson')}</button>
<button class="export-btn" data-format="csv">${t('panel.timeline.exportCsv')}</button>
</div>
</div>`;
}

function renderTimeScrubber(start: number, end: number): string {
    const startTime = formatTimestampShort(start);
    const endTime = formatTimestampShort(end);
    return `<div class="time-scrubber">
<span class="time-label start">${startTime}</span>
<div class="scrubber-track"><div class="scrubber-range" id="scrubber-range"></div><div class="scrubber-handle left" id="handle-left"></div><div class="scrubber-handle right" id="handle-right"></div></div>
<span class="time-label end">${endTime}</span>
<div class="zoom-controls"><button class="zoom-btn" data-zoom="in">+</button><button class="zoom-btn" data-zoom="out">−</button><button class="zoom-btn" data-zoom="reset">⟲</button></div>
</div>`;
}

interface MinimapBucket { x: number; errors: number; warnings: number; info: number; }

function buildMinimapData(events: TimelineEvent[], start: number, end: number): MinimapBucket[] {
    const bucketCount = 100;
    const range = end - start || 1;
    const buckets: MinimapBucket[] = [];
    for (let i = 0; i < bucketCount; i++) { buckets.push({ x: i, errors: 0, warnings: 0, info: 0 }); }
    for (const e of events) {
        const idx = Math.min(Math.floor(((e.timestamp - start) / range) * bucketCount), bucketCount - 1);
        if (e.level === 'error') { buckets[idx].errors++; }
        else if (e.level === 'warning') { buckets[idx].warnings++; }
        else { buckets[idx].info++; }
    }
    return buckets;
}

function renderMinimap(buckets: MinimapBucket[]): string {
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
