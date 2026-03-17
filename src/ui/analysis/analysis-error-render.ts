/**
 * HTML rendering functions for error-specific sections in the analysis panel.
 *
 * These sections appear conditionally when the analyzed line is an error/warning.
 * Includes: error header with triage, timeline sparkline, occurrences, rate, action bar.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import type { CrashCategory } from '../../modules/analysis/error-fingerprint';
import type { ErrorStatus } from '../../modules/misc/error-status-store';
import type { RecurringError } from '../../modules/misc/cross-session-aggregator';
import { extractDateFromFilename } from '../../modules/analysis/stack-parser';
import { doneSlot, emptySlot } from './analysis-panel-render';

/** Options for the error header section rendered at the top of the panel. */
export interface ErrorHeaderOptions {
    readonly errorText: string;
    readonly errorClass: string | undefined;
    readonly crashCategory: CrashCategory;
    readonly hash: string;
    readonly triageStatus: ErrorStatus;
}

/** Render the error classification header with triage controls. */
export function renderErrorHeader(opts: ErrorHeaderOptions): string {
    const { errorText, errorClass, crashCategory, hash, triageStatus } = opts;
    const classBadge = renderClassBadge(errorClass);
    const catBadge = crashCategory !== 'non-fatal'
        ? `<span class="err-cat err-cat-${escapeHtml(crashCategory)}">${escapeHtml(crashCategory.toUpperCase())}</span>`
        : '';
    const triageHtml = renderTriageButtons(hash, triageStatus);
    const text = errorText.length > 200 ? errorText.substring(0, 200) + '\u2026' : errorText;

    return `<div class="err-header">
        <div class="err-badges">${classBadge}${catBadge}<span class="err-hash" title="Fingerprint hash">#${escapeHtml(hash)}</span></div>
        <div class="err-text">${escapeHtml(text)}</div>
        <div class="err-triage">${triageHtml}</div>
    </div>`;
}

function renderClassBadge(errorClass: string | undefined): string {
    if (!errorClass) { return ''; }
    const labels: Record<string, string> = {
        critical: 'CRITICAL',
        transient: 'TRANSIENT',
        bug: 'BUG',
    };
    return `<span class="err-class err-class-${escapeHtml(errorClass)}">${labels[errorClass] ?? errorClass}</span>`;
}

/** Render triage toggle buttons (open/closed/muted). */
function renderTriageButtons(hash: string, status: ErrorStatus): string {
    const states: ErrorStatus[] = ['open', 'closed', 'muted'];
    return '<span class="triage-group">' + states.map(s =>
        `<button class="triage-btn triage-btn-${s}${s === status ? ' triage-active' : ''}" data-triage-hash="${escapeHtml(hash)}" data-triage-status="${s}">${s}</button>`,
    ).join('') + '</span>';
}

/** Render updated triage buttons (sent after status change). */
export function renderTriageUpdate(hash: string, status: ErrorStatus): string {
    return renderTriageButtons(hash, status);
}

/** Render cross-session timeline section with sparkline SVG. */
export function renderTimelineSection(error: RecurringError): string {
    const trend = error.timeline
        .map(t => ({ date: extractDateFromFilename(t.session), count: t.count }))
        .filter((t): t is { date: string; count: number } => t.date !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date));

    const logs = `${error.sessionCount} log${error.sessionCount !== 1 ? 's' : ''}`;
    let html = `<details class="group" open><summary class="group-header">📊 Error History <span class="match-count">${error.totalOccurrences} occurrences across ${logs}</span></summary>`;
    html += renderVersionInfo(error);
    if (trend.length >= 2) { html += buildSparkline(trend); }
    html += '</details>';
    return doneSlot('error-timeline', html);
}

function renderVersionInfo(error: RecurringError): string {
    const parts: string[] = [];
    if (error.firstSeen) {
        const date = extractDateFromFilename(error.firstSeen);
        if (date) { parts.push(`First: ${escapeHtml(date)}`); }
    }
    if (error.lastSeen) {
        const date = extractDateFromFilename(error.lastSeen);
        if (date) { parts.push(`Last: ${escapeHtml(date)}`); }
    }
    if (error.firstSeenVersion) { parts.push(`v${escapeHtml(error.firstSeenVersion)}`); }
    if (error.lastSeenVersion && error.lastSeenVersion !== error.firstSeenVersion) {
        parts.push(`→ v${escapeHtml(error.lastSeenVersion)}`);
    }
    return parts.length > 0 ? `<div class="err-version-info">${parts.join(' &middot; ')}</div>` : '';
}

const sparkW = 400;
const sparkH = 44;
const sparkPad = 28;
const sparkPlotW = sparkW - sparkPad * 2;
const sparkPlotH = sparkH - 14;

function buildSparkline(points: readonly { date: string; count: number }[]): string {
    const maxCount = points.reduce((m, p) => Math.max(m, p.count), 0);
    const barW = Math.min(20, Math.max(4, Math.floor(sparkPlotW / points.length) - 2));
    const totalBarsW = points.length * (barW + 2) - 2;
    const offsetX = sparkPad + Math.max(0, (sparkPlotW - totalBarsW) / 2);

    let svg = `<svg class="err-sparkline" viewBox="0 0 ${sparkW} ${sparkH}" preserveAspectRatio="xMidYMid meet">`;
    svg += `<line class="spark-axis" x1="${sparkPad}" y1="${sparkH - 10}" x2="${sparkW - sparkPad}" y2="${sparkH - 10}"/>`;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const h = maxCount > 0 ? (p.count / maxCount) * sparkPlotH : 0;
        const x = offsetX + i * (barW + 2);
        const y = sparkH - 10 - h;
        svg += `<rect class="spark-bar" x="${x}" y="${y}" width="${barW}" height="${h}" rx="1"><title>${escapeHtml(p.date)}: ${p.count}</title></rect>`;
    }
    const first = points[0].date;
    const last = points[points.length - 1].date;
    svg += `<text class="spark-label" x="${sparkPad}" y="${sparkH}" text-anchor="start">${escapeHtml(formatDateShort(first))}</text>`;
    svg += `<text class="spark-label" x="${sparkW - sparkPad}" y="${sparkH}" text-anchor="end">${escapeHtml(formatDateShort(last))}</text>`;
    return svg + '</svg>';
}

function formatDateShort(date: string): string {
    const parts = date.split('-');
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : date;
}

/** Render current-log occurrences section. */
export function renderOccurrencesSection(count: number, examples: readonly string[]): string {
    if (count === 0) { return emptySlot('error-occurrences', '🔁 No other occurrences in this log'); }
    const label = count === 1 ? '1 occurrence' : `${count} occurrences`;
    let html = `<details class="group" open><summary class="group-header">🔁 Log Occurrences <span class="match-count">${label}</span></summary>`;
    const shown = examples.slice(0, 10);
    for (const ex of shown) {
        const truncated = ex.length > 150 ? ex.substring(0, 150) + '\u2026' : ex;
        html += `<div class="err-occurrence">${escapeHtml(truncated)}</div>`;
    }
    if (count > 10) {
        html += `<div class="err-more">+ ${count - 10} more</div>`;
    }
    html += '</details>';
    return doneSlot('error-occurrences', html);
}

/** Render the action bar with export/diagnostic buttons. */
export function renderActionBar(hash: string, hasAi: boolean): string {
    let html = '<div class="err-action-bar">';
    html += `<button class="err-action" data-action="copyContext" title="Copy error context to clipboard">📋 Copy Context</button>`;
    html += `<button class="err-action" data-action="bugReport" data-hash="${escapeHtml(hash)}" title="Generate bug report">🐛 Bug Report</button>`;
    html += `<button class="err-action" data-action="exportSlc" title="Export log as .slc bundle">📦 Export .slc</button>`;
    html += `<button class="err-action" data-action="exportJson" title="Export as JSON">{ } JSON</button>`;
    html += `<button class="err-action" data-action="exportCsv" title="Export as CSV">📊 CSV</button>`;
    if (hasAi) {
        html += `<button class="err-action err-action-ai" data-action="aiExplain" title="Explain with AI">🤖 AI Explain</button>`;
    }
    html += '</div>';
    return html;
}
