/** Rendering for stack trace deep-dive — clickable frame list and inline mini-analysis. */

import { escapeHtml } from '../../modules/capture/ansi';
import type { SourceReference } from '../../modules/source/source-linker';
import type { WorkspaceFileInfo } from '../../modules/misc/workspace-analyzer';
import type { BlameLine } from '../../modules/git/git-blame';

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

/**
 * Render the crash stack with framework noise folded out of the way.
 *
 * App frames render inline and clickable so the reader lands on their own code
 * first; runs of consecutive framework frames collapse into a native <details>
 * the reader expands on demand. Native <details>/<summary> means the toggle
 * needs no extra webview JS. Runs of <=2 framework frames stay inline — folding
 * one or two lines costs more attention than it saves. Distinct from
 * renderFrameSection (used by the analysis panel) so that view keeps its flat
 * "all frames at once" behavior unchanged.
 */
export function renderSmartFrameSection(frames: readonly StackFrameInfo[]): string {
    const appCount = frames.filter(f => f.isApp).length;
    const fwCount = frames.length - appCount;
    let html = '<details class="group" open>';
    html += `<summary class="group-header">🔍 Stack Trace <span class="match-count">${frames.length} frames (${appCount} app, ${fwCount} fw)</span></summary>`;
    // App-only toggle (#1d): a stack control outside the <summary> so clicking it doesn't collapse the
    // group; the webview toggles a body class that hides framework frames/groups via CSS.
    html += '<div class="cd-stack-controls"><button class="cd-apponly" aria-pressed="false">App frames only</button></div>';
    let fwRun: StackFrameInfo[] = [];
    let fwStart = 0;
    let idx = 0;
    const flushRun = (): void => {
        if (fwRun.length === 0) { return; }
        html += fwRun.length <= 2 ? fwRun.map((f, i) => renderFrame(f, fwStart + i)).join('') : renderFwRun(fwRun, fwStart);
        fwRun = [];
    };
    for (const f of frames) {
        if (f.isApp) { flushRun(); html += renderFrame(f, idx); }
        else { if (fwRun.length === 0) { fwStart = idx; } fwRun.push(f); }
        idx++;
    }
    flushRun();
    return html + '</details>';
}

/** Wrap a run of framework frames in a collapsed <details> the reader can open. */
function renderFwRun(run: readonly StackFrameInfo[], startIndex: number): string {
    let inner = '';
    for (let i = 0; i < run.length; i++) { inner += renderFrame(run[i], startIndex + i); }
    return `<details class="cd-fw-group"><summary class="cd-fw-summary">`
        + `⋯ ${run.length} framework frames</summary>${inner}</details>`;
}

/**
 * Render one frame. When `index` is supplied (the smart/crashlytics variant) the row gains a `#N`
 * gutter (#1a), a hover copy button (#1b), and a `data-fw` marker on framework frames (#1d app-only
 * filter); the analysis panel calls renderFrame(f) with no index and keeps its plain rows.
 */
function renderFrame(f: StackFrameInfo, index?: number): string {
    const badgeCls = f.isApp ? 'frame-badge-app' : 'frame-badge-fw';
    const badgeLabel = f.isApp ? 'APP' : 'FW';
    const badge = `<span class="frame-badge ${badgeCls}">${badgeLabel}</span>`;
    const num = index !== undefined ? `<span class="frame-num">#${index}</span>` : '';
    const copy = index !== undefined ? `<button class="cd-frame-copy" data-copy="${escapeHtml(f.text)}" title="Copy frame">⧉</button>` : '';
    const fwAttr = !f.isApp && index !== undefined ? ' data-fw="1"' : '';
    if (f.isApp && f.sourceRef) {
        const file = escapeHtml(f.sourceRef.filePath);
        return `<div class="stack-frame frame-app" data-frame-file="${file}" data-frame-line="${f.sourceRef.line}">`
            + `${num}${badge}<span class="line-text">${escapeHtml(f.text)}</span>${copy}`
            + `<div class="frame-detail"></div></div>`;
    }
    const cls = f.isApp ? 'stack-frame frame-app-nosrc' : 'stack-frame frame-fw';
    return `<div class="${cls}"${fwAttr}>${num}${badge}<span class="line-text">${escapeHtml(f.text)}</span>${copy}</div>`;
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
