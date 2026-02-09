/** HTML rendering for related lines, referenced files, GitHub, and Firebase sections. */

import { escapeHtml } from '../modules/ansi';
import type { RelatedLine, RelatedLinesResult } from '../modules/related-lines-scanner';
import type { WorkspaceFileInfo } from '../modules/workspace-analyzer';
import type { BlameLine } from '../modules/git-blame';
import type { GitHubContext } from '../modules/github-context';
import type { FirebaseContext } from '../modules/firebase-crashlytics';
import { doneSlot, emptySlot } from './analysis-panel-render';

/** Render related lines as a diagnostic timeline. */
export function renderRelatedLinesSection(result: RelatedLinesResult, analyzedIdx: number): string {
    const n = result.lines.length;
    if (n === 0) { return emptySlot('related', '📋 No related lines found'); }
    const fileNote = result.uniqueFiles.length > 0 ? ` · ${result.uniqueFiles.length} source file${result.uniqueFiles.length !== 1 ? 's' : ''}` : '';
    let html = `<details class="group" open><summary class="group-header">📋 Related Lines <span class="match-count">${n} ${escapeHtml(result.tag)} line${n !== 1 ? 's' : ''}${fileNote}</span></summary>`;
    const showAll = n <= 25;
    const visible = showAll ? result.lines : result.lines.slice(0, 10);
    for (const line of visible) { html += renderRelatedLine(line, analyzedIdx); }
    if (!showAll) {
        html += `<div class="related-overflow" id="related-overflow">${n - 10} more lines hidden · <a href="#" onclick="document.querySelectorAll('.related-hidden').forEach(e=>e.style.display='flex');this.parentElement.style.display='none';return false">Show all</a></div>`;
        for (let i = 10; i < result.lines.length; i++) {
            html += renderRelatedLine(result.lines[i], analyzedIdx, true);
        }
    }
    return doneSlot('related', html + '</details>');
}

function renderRelatedLine(line: RelatedLine, analyzedIdx: number, hidden = false): string {
    const cls = line.lineIndex === analyzedIdx ? 'related-line analyzed' : 'related-line';
    const style = hidden ? ' style="display:none"' : '';
    const hiddenCls = hidden ? ' related-hidden' : '';
    const srcTag = line.sourceRef ? ` <span class="related-src">${escapeHtml(line.sourceRef.file)}:${line.sourceRef.line}</span>` : '';
    const trimmed = line.text.length > 120 ? line.text.slice(0, 117) + '...' : line.text;
    return `<div class="${cls}${hiddenCls}" data-line="${line.lineIndex}"${style}><span class="related-idx">${line.lineIndex + 1}</span><span class="line-text">${escapeHtml(trimmed)}</span>${srcTag}</div>`;
}

/** Analysis result for a single referenced file. */
export interface FileAnalysis {
    readonly filename: string;
    readonly line: number;
    readonly info: WorkspaceFileInfo;
    readonly blame?: BlameLine;
}

/** Render referenced files section with blame and annotation context. */
export function renderReferencedFilesSection(analyses: readonly FileAnalysis[]): string {
    if (analyses.length === 0) { return emptySlot('files', '📁 No source files resolved'); }
    let html = `<details class="group" open><summary class="group-header">📁 Referenced Files <span class="match-count">${analyses.length} file${analyses.length !== 1 ? 's' : ''}</span></summary>`;
    for (const a of analyses) { html += renderFileCard(a); }
    return doneSlot('files', html + '</details>');
}

function renderFileCard(a: FileAnalysis): string {
    const annos = a.info.annotations.length;
    const urgent = a.info.annotations.filter(x => /^(BUG|FIXME)$/i.test(x.type)).length;
    let meta = '';
    if (a.blame) { meta += `${escapeHtml(a.blame.author)} · ${escapeHtml(a.blame.date)}`; }
    if (annos > 0) { meta += ` · ${annos} annotation${annos !== 1 ? 's' : ''}`; }
    if (urgent > 0) { meta += ` · <span class="ref-file-urgent">⚠️ ${urgent} urgent</span>`; }
    const uri = a.info.uri.toString();
    return `<div class="ref-file-card" data-source-uri="${escapeHtml(uri)}" data-line="${a.line}"><div class="ref-file-name">${escapeHtml(a.filename)}:${a.line}</div>${meta ? `<div class="ref-file-meta">${meta}</div>` : ''}</div>`;
}

/** Render GitHub context section with PRs and issues. */
export function renderGitHubSection(ctx: GitHubContext): string {
    if (!ctx.available) {
        const hint = ctx.setupHint ? ` ${escapeHtml(ctx.setupHint)}` : '';
        return emptySlot('github', `🔗 GitHub CLI not available.${hint}`);
    }
    const total = (ctx.blamePr ? 1 : 0) + ctx.filePrs.length + ctx.issues.length;
    if (total === 0) { return emptySlot('github', '🔗 No recent GitHub activity for these files'); }
    let html = `<details class="group" open><summary class="group-header">🔗 GitHub <span class="match-count">${total} result${total !== 1 ? 's' : ''}</span></summary>`;
    if (ctx.blamePr) {
        html += `<div class="gh-item gh-blame-pr" data-url="${escapeHtml(ctx.blamePr.url)}">🔴 <strong>PR #${ctx.blamePr.number}</strong> introduced blame commit · "${escapeHtml(ctx.blamePr.title)}" · @${escapeHtml(ctx.blamePr.author)}</div>`;
    }
    for (const pr of ctx.filePrs) {
        const cls = pr.state === 'OPEN' ? 'gh-pr-open' : pr.state === 'MERGED' ? 'gh-pr-merged' : '';
        html += `<div class="gh-item ${cls}" data-url="${escapeHtml(pr.url)}">PR #${pr.number} · ${escapeHtml(pr.title)} · @${escapeHtml(pr.author)} · ${pr.state.toLowerCase()}</div>`;
    }
    for (const iss of ctx.issues) {
        const labels = iss.labels.length > 0 ? ` · ${iss.labels.map(l => escapeHtml(l)).join(', ')}` : '';
        html += `<div class="gh-item gh-issue" data-url="${escapeHtml(iss.url)}">Issue #${iss.number} · ${escapeHtml(iss.title)}${labels}</div>`;
    }
    return doneSlot('github', html + '</details>');
}

/** Render Firebase Crashlytics section with matching crash issues and console links. */
export function renderFirebaseSection(ctx: FirebaseContext): string {
    if (!ctx.available) {
        const hint = ctx.setupHint ? ` ${escapeHtml(ctx.setupHint)}` : '';
        return emptySlot('firebase', `🔥 Firebase not configured.${hint}`);
    }
    const n = ctx.issues.length;
    const consoleLink = ctx.consoleUrl
        ? `<div class="fb-console" data-url="${escapeHtml(ctx.consoleUrl)}">Open Firebase Console →</div>` : '';
    if (n === 0) { return doneSlot('firebase', `<details class="group" open><summary class="group-header">🔥 Firebase <span class="match-count">0 matches</span></summary><div class="fb-empty">No matching Crashlytics issues found</div>${consoleLink}</details>`); }
    let html = `<details class="group" open><summary class="group-header">🔥 Firebase <span class="match-count">${n} crash${n !== 1 ? 'es' : ''}</span></summary>`;
    for (const issue of ctx.issues) {
        const users = issue.userCount > 0 ? ` · ${issue.userCount} user${issue.userCount !== 1 ? 's' : ''}` : '';
        html += `<div class="fb-item" data-url="${escapeHtml(ctx.consoleUrl ?? '')}"><div class="fb-title">${escapeHtml(issue.title)}</div><div class="fb-meta">${escapeHtml(issue.subtitle)} · ${issue.eventCount} event${issue.eventCount !== 1 ? 's' : ''}${users}</div></div>`;
    }
    return doneSlot('firebase', html + consoleLink + '</details>');
}
