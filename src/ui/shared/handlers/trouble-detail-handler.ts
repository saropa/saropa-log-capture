/**
 * Trouble Mode detail pane (plan Trouble Mode dashboard, Stage 4) — host builder.
 *
 * When a feed row is selected while Trouble Mode is active, the webview posts the
 * row's file line number (`sourceLineNo`) + plain text + level. This module reads
 * the current log, locates the line, and builds the detail HTML by REUSING the
 * signal-report builders (describeTimelinePosition, findPrecedingAction,
 * renderEvidenceSection) rather than duplicating markup, then posts it back to the
 * in-viewer pane. The "zero context" rule governs the FEED, not the selected
 * issue — so the pane deliberately shows surrounding context here.
 *
 * Locating the line is defensive: `sourceLineNo` is a hint (it can be absent for
 * live capture, and carries a post-header offset), so it is only trusted when the
 * file line at that position actually contains the posted text; otherwise the text
 * is searched for. If the line cannot be located the pane still shows the fault
 * line + severity, degrading gracefully instead of showing wrong context.
 */

import * as vscode from 'vscode';
import { t } from '../../../l10n';
import { escapeHtml } from '../../../modules/capture/ansi';
import { describeTimelinePosition, findPrecedingAction } from '../../signals/signal-report-context';
import { renderEvidenceSection, resolveSourcePaths, type EvidenceGroup } from '../../signals/signal-report-render';
import { scanAnrRisk } from '../../../modules/analysis/anr-risk-scorer';
import { logExtensionError } from '../../../modules/misc/extension-logger';

type PostFn = (msg: unknown) => void;

const CONTEXT_RADIUS = 10;
const MAX_STACK_EXTEND = 30;

/** Read and split the current log file; empty array when unreadable (non-critical). */
async function readLogLines(fileUri: vscode.Uri | undefined): Promise<string[]> {
    if (!fileUri) { return []; }
    try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        return Buffer.from(raw).toString('utf-8').split(/\r?\n/);
    } catch {
        return [];
    }
}

/** Dart/Java/generic stack-frame line — used to extend context past a trace (mirrors signal-report). */
function isStackTraceLine(line: string): boolean {
    const s = line.trimStart();
    if (/^#\d+\s/.test(s)) { return true; }
    if (/^at\s+\S/.test(s)) { return true; }
    return line.startsWith('\t') && /\.\w+\(/.test(line);
}

/**
 * Find the file line index for the selected row. Trusts `sourceLineNo` only when
 * that line actually contains the posted text (guards the header-offset skew);
 * otherwise searches for the text. Returns -1 when it cannot be located.
 */
export function locateLine(logLines: readonly string[], sourceLineNo: number, plainText: string): number {
    const hint = sourceLineNo - 1;
    const text = plainText.trim();
    if (hint >= 0 && hint < logLines.length && (text === '' || logLines[hint].includes(text))) {
        return hint;
    }
    if (text !== '') {
        const found = logLines.findIndex(l => l.includes(text));
        if (found >= 0) { return found; }
    }
    return hint >= 0 && hint < logLines.length ? hint : -1;
}

/** The fault line itself, accented by severity to match the feed and the chart. */
function faultSection(text: string, level: string): string {
    const cls = level === 'warning' ? 'td-fault-warning' : level === 'performance' ? 'td-fault-performance' : '';
    return `<div class="td-section"><div class="td-section-title">${escapeHtml(t('viewer.troubleDetail.faultTitle'))}</div>`
        + `<div class="td-fault ${cls}">${escapeHtml(text)}</div></div>`;
}

/** One key/value row. */
function kv(key: string, value: string): string {
    return `<div class="td-kv"><span class="td-k">${escapeHtml(key)}</span><span class="td-v">${escapeHtml(value)}</span></div>`;
}

/** Severity + ANR-risk facts. ANR is shown only when it is medium/high (low is noise). */
function factsSection(level: string, logLines: readonly string[]): string {
    const rows = [kv(t('viewer.troubleDetail.severity'), t('viewer.level.' + level))];
    if (logLines.length > 0) {
        const anr = scanAnrRisk(logLines.join('\n'));
        if (anr.level !== 'low') {
            rows.push(kv(t('viewer.troubleDetail.anr'), t('viewer.troubleDetail.anr.' + anr.level)));
        }
    }
    return `<div class="td-section">${rows.join('')}</div>`;
}

/** Surrounding context: reuses the signal-report evidence renderer (target line highlighted). */
function contextSection(logLines: readonly string[], targetIdx: number): string {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const start = Math.max(0, targetIdx - CONTEXT_RADIUS);
    let end = Math.min(logLines.length - 1, targetIdx + CONTEXT_RADIUS);
    while (end < logLines.length - 1 && end < targetIdx + MAX_STACK_EXTEND) {
        if (!isStackTraceLine(logLines[end + 1])) { break; }
        end++;
    }
    const lines = [];
    for (let i = start; i <= end; i++) {
        lines.push({ lineIndex: i, text: wsRoot ? resolveSourcePaths(logLines[i], wsRoot) : logLines[i], isTarget: i === targetIdx });
    }
    const group: EvidenceGroup = {
        lines,
        meta: { timelinePosition: describeTimelinePosition(targetIdx, logLines.length), precedingAction: findPrecedingAction(logLines, targetIdx) },
    };
    return `<div class="td-section"><div class="td-section-title">${escapeHtml(t('viewer.troubleDetail.contextTitle'))}</div>`
        + `${renderEvidenceSection([group])}</div>`;
}

/** Assemble the detail HTML; context omitted (with a note) when the line cannot be located. */
function buildDetailHtml(logLines: readonly string[], targetIdx: number, plainText: string, level: string): string {
    const faultText = (targetIdx >= 0 ? logLines[targetIdx] : plainText) || plainText;
    const parts = [faultSection(faultText, level), factsSection(level, logLines)];
    if (targetIdx >= 0 && logLines.length > 0) {
        parts.push(contextSection(logLines, targetIdx));
    } else {
        parts.push(`<div class="td-section"><div class="no-data">${escapeHtml(t('viewer.troubleDetail.noContext'))}</div></div>`);
    }
    return parts.join('');
}

/** Short pane title: severity label + a trimmed excerpt of the fault line. */
function buildTitle(level: string, logLines: readonly string[], targetIdx: number, plainText: string): string {
    const raw = ((targetIdx >= 0 ? logLines[targetIdx] : plainText) || '').trim();
    return `${t('viewer.level.' + level)}: ${raw.slice(0, 80)}`;
}

/** Build the detail for the selected feed row and post it back to the in-viewer pane. */
export async function handleTroubleDetail(
    fileUri: vscode.Uri | undefined,
    sourceLineNo: number,
    plainText: string,
    level: string,
    post: PostFn,
): Promise<void> {
    try {
        const logLines = await readLogLines(fileUri);
        const targetIdx = locateLine(logLines, sourceLineNo, plainText);
        post({
            type: 'troubleDetailReady',
            html: buildDetailHtml(logLines, targetIdx, plainText, level),
            title: buildTitle(level, logLines, targetIdx, plainText),
        });
    } catch (err) {
        logExtensionError('troubleDetail', err instanceof Error ? err : new Error(String(err)));
        post({
            type: 'troubleDetailReady',
            html: `<div class="no-data">${escapeHtml(t('viewer.troubleDetail.unavailable'))}</div>`,
            title: t('viewer.troubleDetail.region'),
        });
    }
}
