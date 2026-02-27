/**
 * Session timeline panel.
 *
 * Reads a log file, classifies every line by timestamp and severity,
 * and renders an SVG timeline showing errors/warnings over time.
 */

import * as vscode from 'vscode';
import { stripAnsi, escapeHtml } from '../modules/ansi';
import { formatDuration } from '../modules/session-summary';
import { getNonce } from './viewer-content';
import { findHeaderEnd, parseHeaderFields, computeSessionMidnight, parseTimeToMs } from './viewer-file-loader';
import { classifyLevel, isActionableLevel, type SeverityLevel } from '../modules/level-classifier';
import { openLogAtLine } from '../modules/log-search';
import { getTimelineStyles } from './timeline-panel-styles';

interface TimelinePoint {
    readonly timestamp: number;
    readonly level: SeverityLevel;
    readonly lineNumber: number;
    readonly lineText: string;
}

interface TimelineStats {
    readonly startTime: number;
    readonly endTime: number;
    readonly duration: number;
    readonly totalLines: number;
    readonly errorCount: number;
    readonly warningCount: number;
    readonly perfCount: number;
    readonly todoCount: number;
}

let panel: vscode.WebviewPanel | undefined;
let currentUri: vscode.Uri | undefined;

/** Show the timeline for a log file. */
export async function showTimeline(fileUri: vscode.Uri): Promise<void> {
    currentUri = fileUri;
    ensurePanel();
    panel!.webview.html = buildLoadingHtml();
    const data = await parseTimelineData(fileUri);
    if (!panel) { return; }
    const filename = fileUri.fsPath.split(/[\\/]/).pop() ?? '';
    panel.webview.html = buildTimelineHtml(data.points, data.stats, filename);
}

/** Dispose the singleton panel. */
export function disposeTimelinePanel(): void { panel?.dispose(); panel = undefined; }

function ensurePanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.timeline', 'Saropa Log Timeline',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}

function handleMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'openLine' && currentUri) {
        const match = { uri: currentUri, filename: '', lineNumber: Number(msg.lineNumber), lineText: '', matchStart: 0, matchEnd: 0 };
        openLogAtLine(match).catch(() => {});
    }
}

async function parseTimelineData(fileUri: vscode.Uri): Promise<{ points: TimelinePoint[]; stats: TimelineStats }> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const allLines = Buffer.from(raw).toString('utf-8').split('\n');
    const headerEnd = findHeaderEnd(allLines);
    const fields = parseHeaderFields(allLines);
    const midnightMs = computeSessionMidnight(fields['Date'] ?? '');
    const tsPattern = /^\[([\d:.]+)\]\s*\[(\w+)\]\s?(.*)/;
    const points: TimelinePoint[] = [];
    const counts = { error: 0, warning: 0, performance: 0, todo: 0 };
    for (let i = headerEnd; i < allLines.length; i++) {
        const line = allLines[i];
        const m = tsPattern.exec(line);
        if (!m) { continue; }
        const ts = parseTimeToMs(m[1], midnightMs);
        if (ts === 0) { continue; }
        const plain = stripAnsi(m[3]);
        const level = classifyLevel(plain, m[2], true);
        if (isActionableLevel(level)) {
            points.push({ timestamp: ts, level, lineNumber: i + 1, lineText: plain.slice(0, 120) });
            counts[level as keyof typeof counts]++;
        }
    }
    const stats = buildStats(points, allLines.length - headerEnd, counts);
    return { points: bucketIfNeeded(points), stats };
}

function buildStats(
    points: readonly TimelinePoint[], totalLines: number, counts: Record<string, number>,
): TimelineStats {
    if (points.length === 0) {
        return { startTime: 0, endTime: 0, duration: 0, totalLines, errorCount: 0, warningCount: 0, perfCount: 0, todoCount: 0 };
    }
    const start = points[0].timestamp;
    const end = points[points.length - 1].timestamp;
    return { startTime: start, endTime: end, duration: end - start, totalLines, ...spreadCounts(counts) };
}

function spreadCounts(c: Record<string, number>): { errorCount: number; warningCount: number; perfCount: number; todoCount: number } {
    return { errorCount: c.error ?? 0, warningCount: c.warning ?? 0, perfCount: c.performance ?? 0, todoCount: c.todo ?? 0 };
}

const maxDots = 400;
function bucketIfNeeded(points: TimelinePoint[]): TimelinePoint[] {
    if (points.length <= maxDots) { return points; }
    const start = points[0].timestamp;
    const end = points[points.length - 1].timestamp;
    const bucketWidth = (end - start) / maxDots;
    const buckets = new Map<number, TimelinePoint>();
    const severityRank: Record<string, number> = { error: 4, warning: 3, performance: 2, todo: 1 };
    for (const p of points) {
        const idx = Math.min(Math.floor((p.timestamp - start) / bucketWidth), maxDots - 1);
        const existing = buckets.get(idx);
        if (!existing || (severityRank[p.level] ?? 0) > (severityRank[existing.level] ?? 0)) {
            buckets.set(idx, p);
        }
    }
    return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function buildLoadingHtml(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getTimelineStyles()}</style>
</head><body><div class="empty-state">Analyzing session...</div></body></html>`;
}

function buildTimelineHtml(points: TimelinePoint[], stats: TimelineStats, filename: string): string {
    const nonce = getNonce();
    if (stats.duration === 0 && points.length === 0) {
        return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getTimelineStyles()}</style>
</head><body>${renderHeader(filename)}
<div class="no-timestamps">No timestamped actionable events found in this session.</div></body></html>`;
    }
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getTimelineStyles()}</style>
</head><body>${renderHeader(filename)}
${renderStatsBar(stats)}${renderLegend()}
<div class="timeline-container">${renderSvg(points, stats)}</div>
<script nonce="${nonce}">${getScript()}</script></body></html>`;
}

function renderHeader(filename: string): string {
    return `<div class="header"><div class="title">Saropa Log Timeline</div><div class="subtitle">${escapeHtml(filename)}</div></div>`;
}

function renderStatsBar(stats: TimelineStats): string {
    const dur = formatDuration(stats.duration);
    return `<div class="stats-bar">
<div class="stat-item"><span class="stat-label">Duration:</span><span class="stat-count">${dur}</span></div>
<div class="stat-item"><span class="stat-dot error"></span><span class="stat-count">${stats.errorCount}</span><span class="stat-label">errors</span></div>
<div class="stat-item"><span class="stat-dot warning"></span><span class="stat-count">${stats.warningCount}</span><span class="stat-label">warnings</span></div>
<div class="stat-item"><span class="stat-dot performance"></span><span class="stat-count">${stats.perfCount}</span><span class="stat-label">perf</span></div>
<div class="stat-item"><span class="stat-dot todo"></span><span class="stat-count">${stats.todoCount}</span><span class="stat-label">todos</span></div>
</div>`;
}

function renderLegend(): string {
    return `<div class="legend">
<div class="legend-item"><span class="stat-dot error"></span>Error</div>
<div class="legend-item"><span class="stat-dot warning"></span>Warning</div>
<div class="legend-item"><span class="stat-dot performance"></span>Performance</div>
<div class="legend-item"><span class="stat-dot todo"></span>Todo</div></div>`;
}

function renderSvg(points: readonly TimelinePoint[], stats: TimelineStats): string {
    const w = 800, h = 120, pad = 40;
    const plotW = w - pad * 2;
    const range = stats.duration || 1;
    const levelY: Record<string, number> = { error: 20, warning: 45, performance: 70, todo: 95 };
    const levelColor: Record<string, string> = { error: 'var(--vscode-editorError-foreground, #f14c4c)', warning: 'var(--vscode-editorWarning-foreground, #cca700)', performance: '#b267e6', todo: 'var(--vscode-descriptionForeground)' };
    let dots = '';
    for (const p of points) {
        const x = pad + ((p.timestamp - stats.startTime) / range) * plotW;
        const y = levelY[p.level] ?? 50;
        const c = levelColor[p.level] ?? '#888';
        const title = escapeHtml(`L${p.lineNumber}: ${p.lineText}`);
        dots += `<circle class="timeline-dot" cx="${x.toFixed(1)}" cy="${y}" r="4" fill="${c}" data-line="${p.lineNumber}"><title>${title}</title></circle>`;
    }
    const startLabel = formatTime(stats.startTime);
    const endLabel = formatTime(stats.endTime);
    return `<svg class="timeline-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
<line class="axis-line" x1="${pad}" y1="${h - 5}" x2="${w - pad}" y2="${h - 5}"/>
<text class="axis-label" x="${pad}" y="${h}" text-anchor="start">${startLabel}</text>
<text class="axis-label" x="${w - pad}" y="${h}" text-anchor="end">${endLabel}</text>
${dots}</svg>`;
}

function formatTime(epoch: number): string {
    if (epoch === 0) { return ''; }
    const d = new Date(epoch);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function getScript(): string {
    return `(function() {
    var vscode = acquireVsCodeApi();
    document.addEventListener('click', function(e) {
        var dot = e.target.closest('.timeline-dot');
        if (dot) { vscode.postMessage({ type: 'openLine', lineNumber: parseInt(dot.dataset.line) }); }
    });
})();`;
}
