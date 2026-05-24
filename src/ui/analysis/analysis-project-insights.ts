/**
 * Render the "In your project" panel for the in-viewer crash detail (plan 054 Stage 5c-1/5c-2):
 * the "may already be fixed" banner + changelog-since, recent commits at the crash site, and nearby
 * TODO/FIXME annotations. Pure HTML from a ProjectInsights snapshot.
 */

import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import type { ProjectInsights } from '../../modules/crashlytics/crash-project-links';
import type { LogCorrelation } from '../../modules/crashlytics/crash-log-correlation';

/** "⚠ Changed since the affected version — may already be fixed", with the count of newer releases. */
function mayBeFixedBanner(insights: ProjectInsights): string {
    if (!insights.mayBeFixed) { return ''; }
    const n = insights.changelogSince.length;
    const ver = insights.affectedVersion ? escapeHtml(insights.affectedVersion) : '';
    return `<div class="cd-maybe-fixed">${t('viewer.crashlytics.project.mayBeFixed', ver, n)}</div>`;
}

function changelogSection(insights: ProjectInsights): string {
    if (insights.changelogSince.length === 0) { return ''; }
    const rows = insights.changelogSince.map(v =>
        `<div class="cd-proj-row"><span class="cd-proj-ver">${escapeHtml(v.version)}</span>`
        + `<span class="cd-proj-text">${escapeHtml(v.summary)}</span></div>`).join('');
    return `<div class="cd-proj-label">${t('viewer.crashlytics.project.changelogSince')}</div>${rows}`;
}

function commitsSection(insights: ProjectInsights): string {
    if (insights.recentCommits.length === 0) { return ''; }
    const rows = insights.recentCommits.map(c =>
        `<div class="cd-proj-row"><span class="cd-proj-sha">${escapeHtml(c.hash.slice(0, 7))}</span>`
        + `<span class="cd-proj-date">${escapeHtml(c.date)}</span>`
        + `<span class="cd-proj-text">${escapeHtml(c.message)}</span></div>`).join('');
    return `<div class="cd-proj-label">${t('viewer.crashlytics.project.recentCommits')}</div>${rows}`;
}

function annotationsSection(insights: ProjectInsights): string {
    if (insights.annotations.length === 0) { return ''; }
    const rows = insights.annotations.map(a =>
        `<div class="cd-proj-row"><span class="cd-proj-tag">${escapeHtml(a.type)}</span>`
        + `<span class="cd-proj-text">L${a.line}: ${escapeHtml(a.text)}</span></div>`).join('');
    return `<div class="cd-proj-label">${t('viewer.crashlytics.project.annotations')}</div>${rows}`;
}

/** Clickable PR/issue rows (open in the browser via the detail's .cd-proj-link handler). */
function linkSection(links: ProjectInsights['prs'], label: string): string {
    if (links.length === 0) { return ''; }
    const rows = links.map(l =>
        `<div class="cd-proj-row"><a class="cd-proj-link" data-url="${escapeHtml(l.url)}">`
        + `#${l.number} ${escapeHtml(l.title)}</a></div>`).join('');
    return `<div class="cd-proj-label">${label}</div>${rows}`;
}

/**
 * "Seen in your captured logs" panel (5c-4): each match opens that session's log at the line via the
 * detail's .cd-log-link handler. Separate panel because it streams from its own async log search.
 */
export function renderLogCorrelation(matches: readonly LogCorrelation[], token: string): string {
    if (matches.length === 0) { return ''; }
    const rows = matches.map(m =>
        `<div class="cd-proj-row"><a class="cd-log-link" data-uri="${escapeHtml(m.uri)}" data-line="${m.line}" data-col="${m.col}">`
        + `<span class="cd-proj-sha">${escapeHtml(m.fileName)}:${m.line}</span>`
        + `<span class="cd-proj-text">${escapeHtml(m.lineText)}</span></a></div>`).join('');
    return `<details class="group cd-tile" open><summary class="group-header">${t('viewer.crashlytics.project.seenInLogs', token)}`
        + ` <span class="match-count">${matches.length}</span></summary><div class="cd-proj">${rows}</div></details>`;
}

/** The whole panel; '' when there is nothing to show so the caller can skip appending it. */
export function renderProjectInsights(insights: ProjectInsights): string {
    const body = mayBeFixedBanner(insights) + changelogSection(insights) + commitsSection(insights)
        + linkSection(insights.prs, t('viewer.crashlytics.project.relatedPrs'))
        + linkSection(insights.issues, t('viewer.crashlytics.project.relatedIssues'))
        + annotationsSection(insights);
    if (!body) { return ''; }
    const fileNote = insights.file ? ` <span class="match-count">${escapeHtml(insights.file.split(/[\\/]/).pop() ?? '')}</span>` : '';
    return `<details class="group cd-tile" open><summary class="group-header">${t('viewer.crashlytics.project.title')}${fileNote}</summary>`
        + `<div class="cd-proj">${body}</div></details>`;
}
