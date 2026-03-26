"use strict";
/** HTML rendering for related lines, referenced files, GitHub, and Firebase sections. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderRelatedLinesSection = renderRelatedLinesSection;
exports.renderReferencedFilesSection = renderReferencedFilesSection;
exports.renderGitHubSection = renderGitHubSection;
exports.renderFirebaseSection = renderFirebaseSection;
const ansi_1 = require("../../modules/capture/ansi");
const source_linker_1 = require("../../modules/source/source-linker");
const analysis_panel_render_1 = require("./analysis-panel-render");
/** Render related lines as a diagnostic timeline. */
function renderRelatedLinesSection(result, analyzedIdx) {
    const n = result.lines.length;
    if (n === 0) {
        return (0, analysis_panel_render_1.emptySlot)('related', '📋 No related lines found');
    }
    const fileNote = result.uniqueFiles.length > 0 ? ` · ${result.uniqueFiles.length} source file${result.uniqueFiles.length !== 1 ? 's' : ''}` : '';
    let html = `<details class="group" open><summary class="group-header">📋 Related Lines <span class="match-count">${n} ${(0, ansi_1.escapeHtml)(result.tag)} line${n !== 1 ? 's' : ''}${fileNote}</span></summary>`;
    const showAll = n <= 25;
    const visible = showAll ? result.lines : result.lines.slice(0, 10);
    for (const line of visible) {
        html += renderRelatedLine(line, analyzedIdx);
    }
    if (!showAll) {
        html += `<div class="related-overflow" id="related-overflow">${n - 10} more lines hidden · <a href="#" onclick="document.querySelectorAll('.related-hidden').forEach(e=>e.style.display='flex');this.parentElement.style.display='none';return false">Show all</a></div>`;
        for (let i = 10; i < result.lines.length; i++) {
            html += renderRelatedLine(result.lines[i], analyzedIdx, true);
        }
    }
    return (0, analysis_panel_render_1.doneSlot)('related', html + '</details>');
}
function renderRelatedLine(line, analyzedIdx, hidden = false) {
    const cls = line.lineIndex === analyzedIdx ? 'related-line analyzed' : 'related-line';
    const style = hidden ? ' style="display:none"' : '';
    const hiddenCls = hidden ? ' related-hidden' : '';
    const srcTag = line.sourceRef ? ` <span class="related-src">${(0, ansi_1.escapeHtml)(line.sourceRef.file)}:${line.sourceRef.line}</span>` : '';
    const trimmed = line.text.length > 120 ? line.text.slice(0, 117) + '...' : line.text;
    return `<div class="${cls}${hiddenCls}" data-line="${line.lineIndex}"${style}><span class="related-idx">${line.lineIndex + 1}</span><span class="line-text">${(0, ansi_1.escapeHtml)(trimmed)}</span>${srcTag}</div>`;
}
/** Render referenced files section with blame and annotation context. */
function renderReferencedFilesSection(analyses) {
    if (analyses.length === 0) {
        return (0, analysis_panel_render_1.emptySlot)('files', '📁 No source files resolved');
    }
    let html = `<details class="group" open><summary class="group-header">📁 Referenced Files <span class="match-count">${analyses.length} file${analyses.length !== 1 ? 's' : ''}</span></summary>`;
    for (const a of analyses) {
        html += renderFileCard(a);
    }
    return (0, analysis_panel_render_1.doneSlot)('files', html + '</details>');
}
function renderFileCard(a) {
    const annos = a.info.annotations.length;
    const urgent = a.info.annotations.filter(x => /^(BUG|FIXME)$/i.test(x.type)).length;
    let meta = '';
    if (a.blame) {
        meta += `${(0, ansi_1.escapeHtml)(a.blame.author)} · ${(0, ansi_1.escapeHtml)(a.blame.date)}`;
    }
    if (annos > 0) {
        meta += ` · ${annos} annotation${annos !== 1 ? 's' : ''}`;
    }
    if (urgent > 0) {
        meta += ` · <span class="ref-file-urgent">⚠️ ${urgent} urgent</span>`;
    }
    const uri = a.info.uri.toString();
    return `<div class="ref-file-card" data-source-uri="${(0, ansi_1.escapeHtml)(uri)}" data-line="${a.line}"><div class="ref-file-name">${(0, ansi_1.escapeHtml)(a.filename)}:${a.line}</div>${meta ? `<div class="ref-file-meta">${meta}</div>` : ''}</div>`;
}
/** Render GitHub context section with PRs and issues. */
function renderGitHubSection(ctx) {
    if (!ctx.available) {
        const hint = ctx.setupHint ? ` ${(0, source_linker_1.linkifyUrls)((0, ansi_1.escapeHtml)(ctx.setupHint))}` : '';
        return (0, analysis_panel_render_1.emptySlot)('github', `🔗 GitHub CLI not available.${hint}`);
    }
    const total = (ctx.blamePr ? 1 : 0) + ctx.filePrs.length + ctx.issues.length;
    if (total === 0) {
        return (0, analysis_panel_render_1.emptySlot)('github', '🔗 No recent GitHub activity for these files');
    }
    let html = `<details class="group" open><summary class="group-header">🔗 GitHub <span class="match-count">${total} result${total !== 1 ? 's' : ''}</span></summary>`;
    if (ctx.blamePr) {
        html += `<div class="gh-item gh-blame-pr" data-url="${(0, ansi_1.escapeHtml)(ctx.blamePr.url)}">🔴 <strong>PR #${ctx.blamePr.number}</strong> introduced blame commit · "${(0, ansi_1.escapeHtml)(ctx.blamePr.title)}" · @${(0, ansi_1.escapeHtml)(ctx.blamePr.author)}</div>`;
    }
    for (const pr of ctx.filePrs) {
        const cls = pr.state === 'OPEN' ? 'gh-pr-open' : pr.state === 'MERGED' ? 'gh-pr-merged' : '';
        html += `<div class="gh-item ${cls}" data-url="${(0, ansi_1.escapeHtml)(pr.url)}">PR #${pr.number} · ${(0, ansi_1.escapeHtml)(pr.title)} · @${(0, ansi_1.escapeHtml)(pr.author)} · ${pr.state.toLowerCase()}</div>`;
    }
    for (const iss of ctx.issues) {
        const labels = iss.labels.length > 0 ? ` · ${iss.labels.map(l => (0, ansi_1.escapeHtml)(l)).join(', ')}` : '';
        html += `<div class="gh-item gh-issue" data-url="${(0, ansi_1.escapeHtml)(iss.url)}">Issue #${iss.number} · ${(0, ansi_1.escapeHtml)(iss.title)}${labels}</div>`;
    }
    return (0, analysis_panel_render_1.doneSlot)('github', html + '</details>');
}
function renderIssueBadges(issue) {
    const parts = [];
    const severityClass = issue.isFatal ? 'fb-badge-fatal' : 'fb-badge-nonfatal';
    const severityLabel = issue.isFatal ? 'FATAL' : 'NON-FATAL';
    parts.push(`<span class="fb-badge ${severityClass}">${severityLabel}</span>`);
    if (issue.state !== 'UNKNOWN') {
        const stateClass = issue.state === 'REGRESSION' ? 'fb-badge-regressed' : issue.state === 'CLOSED' ? 'fb-badge-closed' : 'fb-badge-open';
        parts.push(`<span class="fb-badge ${stateClass}">${issue.state}</span>`);
    }
    return parts.join(' ');
}
function renderVersionRange(issue) {
    if (!issue.firstVersion && !issue.lastVersion) {
        return '';
    }
    const range = issue.firstVersion && issue.lastVersion && issue.firstVersion !== issue.lastVersion
        ? `${(0, ansi_1.escapeHtml)(issue.firstVersion)} → ${(0, ansi_1.escapeHtml)(issue.lastVersion)}`
        : (0, ansi_1.escapeHtml)(issue.firstVersion ?? issue.lastVersion ?? '');
    return ` · <span class="fb-versions">${range}</span>`;
}
/** Render Firebase Crashlytics section with matching crash issues and console links. */
function renderFirebaseSection(ctx) {
    if (!ctx.available) {
        const hint = ctx.setupHint ? ` ${(0, source_linker_1.linkifyUrls)((0, ansi_1.escapeHtml)(ctx.setupHint))}` : '';
        return (0, analysis_panel_render_1.emptySlot)('firebase', `🔥 Firebase not configured.${hint}`);
    }
    const n = ctx.issues.length;
    const refreshNote = ctx.queriedAt ? ` <span class="fb-refresh-time">(${(0, ansi_1.formatElapsedLabel)(ctx.queriedAt)})</span>` : '';
    const consoleLink = ctx.consoleUrl
        ? `<div class="fb-console" data-url="${(0, ansi_1.escapeHtml)(ctx.consoleUrl)}">Open Firebase Console →</div>` : '';
    if (n === 0) {
        return (0, analysis_panel_render_1.doneSlot)('firebase', `<details class="group" open><summary class="group-header">🔥 Firebase <span class="match-count">0 matches</span>${refreshNote}</summary><div class="fb-empty">No matching Crashlytics issues found</div>${consoleLink}</details>`);
    }
    let html = `<details class="group" open><summary class="group-header">🔥 Firebase <span class="match-count">${n} crash${n !== 1 ? 'es' : ''}</span>${refreshNote}</summary>`;
    for (const issue of ctx.issues) {
        const users = issue.userCount > 0 ? ` · ${issue.userCount} user${issue.userCount !== 1 ? 's' : ''}` : '';
        const eid = (0, ansi_1.escapeHtml)(issue.id);
        const badges = renderIssueBadges(issue);
        const versions = renderVersionRange(issue);
        html += `<div class="fb-item" data-issue-id="${eid}"><div class="fb-title">${badges} <span class="crash-expand-icon">▶</span>${(0, ansi_1.escapeHtml)(issue.title)}</div><div class="fb-meta">${(0, ansi_1.escapeHtml)(issue.subtitle)} · ${issue.eventCount} event${issue.eventCount !== 1 ? 's' : ''}${users}${versions}</div><div class="crash-detail" id="crash-detail-${eid}"></div></div>`;
    }
    return (0, analysis_panel_render_1.doneSlot)('firebase', html + consoleLink + '</details>');
}
//# sourceMappingURL=analysis-related-render.js.map