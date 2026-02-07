/** Rendering for stack trace deep-dive — clickable frame list and inline mini-analysis. */

import { escapeHtml } from '../modules/ansi';
import type { SourceReference } from '../modules/source-linker';
import type { WorkspaceFileInfo } from '../modules/workspace-analyzer';
import type { BlameLine } from '../modules/git-blame';

/** A parsed stack frame with classification and optional source reference. */
export interface StackFrameInfo {
    readonly text: string;
    readonly isApp: boolean;
    readonly sourceRef?: SourceReference;
}

/** Render the full stack trace section with clickable app-code frames. */
export function renderFrameSection(frames: readonly StackFrameInfo[]): string {
    const appCount = frames.filter(f => f.isApp).length;
    const fwCount = frames.length - appCount;
    let html = `<details class="group" ${frames.length <= 15 ? 'open' : ''}>`;
    html += `<summary class="group-header">🔍 Stack Trace <span class="match-count">${frames.length} frames (${appCount} app, ${fwCount} fw)</span></summary>`;
    for (const f of frames) { html += renderFrame(f); }
    return html + '</details>';
}

function renderFrame(f: StackFrameInfo): string {
    const badgeCls = f.isApp ? 'frame-badge-app' : 'frame-badge-fw';
    const badgeLabel = f.isApp ? 'APP' : 'FW';
    const badge = `<span class="frame-badge ${badgeCls}">${badgeLabel}</span>`;
    if (f.isApp && f.sourceRef) {
        const file = escapeHtml(f.sourceRef.filePath);
        return `<div class="stack-frame frame-app" data-frame-file="${file}" data-frame-line="${f.sourceRef.line}">`
            + `${badge}<span class="line-text">${escapeHtml(f.text)}</span>`
            + `<div class="frame-detail"></div></div>`;
    }
    const cls = f.isApp ? 'stack-frame frame-app-nosrc' : 'stack-frame frame-fw';
    return `<div class="${cls}">${badge}<span class="line-text">${escapeHtml(f.text)}</span></div>`;
}

/** Render compact mini-analysis for a single frame (source preview + blame + annotations). */
export function renderFrameAnalysis(info: WorkspaceFileInfo, blame?: BlameLine): string {
    let html = '';
    if (info.sourcePreview) {
        const { lines, targetLine } = info.sourcePreview;
        const uriStr = info.uri.toString();
        html += '<div class="source-preview">';
        for (const l of lines) {
            const cls = l.num === targetLine ? 'source-line target-line' : 'source-line';
            html += `<div class="${cls}" data-source-uri="${escapeHtml(uriStr)}" data-line="${l.num}">`;
            html += `<span class="line-num">L${l.num}</span><span class="line-text">${escapeHtml(l.text)}</span></div>`;
        }
        html += '</div>';
    }
    if (blame) {
        html += `<div class="blame-line">Last changed by <strong>${escapeHtml(blame.author)}</strong>`;
        html += ` on ${escapeHtml(blame.date)} · <code>${escapeHtml(blame.hash)}</code> ${escapeHtml(blame.message)}</div>`;
    }
    if (info.annotations.length > 0) {
        const urgent = info.annotations.filter(a => /^(BUG|FIXME)$/i.test(a.type));
        if (urgent.length > 0) {
            html += `<div class="blame-line">⚠️ ${urgent.length} urgent annotation${urgent.length !== 1 ? 's' : ''} nearby</div>`;
        }
    }
    if (!html) { html = '<div class="no-matches">Source file found but no context available</div>'; }
    return html;
}
