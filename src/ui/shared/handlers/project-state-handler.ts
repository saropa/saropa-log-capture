/**
 * Host handler for the session "Project state" panel (plan 055 Stage 3). Gathers the workspace git
 * state, the session's detected app version, and the changelog releases after that version, then
 * renders the panel body as HTML and posts it. The "may already be fixed" insight from the
 * crashlytics detail, now for any captured session.
 *
 * Passive by construction: when there is no git AND no detectable version there is nothing to say, so
 * `renderPanelBody` returns '' and the webview shows its empty state — the panel never nags.
 */

import { t } from '../../../l10n';
import { escapeHtml } from '../../../modules/capture/ansi';
import { detectAppVersion } from '../../../modules/misc/app-version';
import { getProjectState, type ProjectState } from '../../../modules/git/project-state';
import { changelogSinceAffected } from '../../../modules/git/changelog-locate';
import type { ChangelogVersion } from '../../../modules/git/changelog';

export type PostFn = (msg: unknown) => void;

/** Branch / last-commit / dirty block, or a "no git" note when the workspace is not a repo. */
function renderGitState(state: ProjectState): string {
    if (!state.hasGit) {
        return `<div class="ps-row ps-note">${t('viewer.projectState.noGit')}</div>`;
    }
    const rows: string[] = [];
    rows.push(`<div class="ps-row"><span class="ps-label">${t('viewer.projectState.branch')}</span>`
        + `<span class="ps-value">${escapeHtml(state.branch ?? '')}</span></div>`);
    const c = state.lastCommit;
    if (c) {
        rows.push(`<div class="ps-row"><span class="ps-label">${t('viewer.projectState.lastCommit')}</span>`
            + `<span class="ps-value">${escapeHtml(c.hash)} · ${escapeHtml(c.author)} · ${escapeHtml(c.date)}</span></div>`);
        if (c.subject) { rows.push(`<div class="ps-commit-subject">${escapeHtml(c.subject)}</div>`); }
    }
    const dirtyCls = state.dirty ? 'ps-dirty' : 'ps-clean';
    const dirtyText = state.dirty ? t('viewer.projectState.treeDirty') : t('viewer.projectState.treeClean');
    rows.push(`<div class="ps-row"><span class="ps-label">${t('viewer.projectState.tree')}</span>`
        + `<span class="ps-value ${dirtyCls}">${dirtyText}</span></div>`);
    return rows.join('');
}

/** App version line + the "may already be fixed" banner and changelog-since list (reuses crashlytics CSS). */
function renderVersionInsight(version: string | undefined, since: readonly ChangelogVersion[]): string {
    const verText = version ? escapeHtml(version) : t('viewer.projectState.versionUnknown');
    let html = `<div class="ps-row"><span class="ps-label">${t('viewer.projectState.appVersion')}</span>`
        + `<span class="ps-value">${verText}</span></div>`;
    if (since.length > 0 && version) {
        html += `<div class="cd-maybe-fixed">${t('viewer.crashlytics.project.mayBeFixed', escapeHtml(version), since.length)}</div>`;
        const rows = since.map(v =>
            `<div class="cd-proj-row"><span class="cd-proj-ver">${escapeHtml(v.version)}</span>`
            + `<span class="cd-proj-text">${escapeHtml(v.summary)}</span></div>`).join('');
        html += `<div class="cd-proj"><div class="cd-proj-label">${t('viewer.crashlytics.project.changelogSince')}</div>${rows}</div>`;
    }
    return html;
}

/** Whole panel body; '' when there is nothing to show so the webview falls back to its empty state. */
function renderPanelBody(state: ProjectState, version: string | undefined, since: readonly ChangelogVersion[]): string {
    if (!state.hasGit && !version) { return ''; }
    return `<div class="ps-section">${renderGitState(state)}</div>`
        + `<div class="ps-section">${renderVersionInsight(version, since)}</div>`;
}

/** Gather git state + app version + changelog-since and post the rendered panel body. Never throws. */
export async function handleProjectStateRequest(post: PostFn): Promise<void> {
    try {
        const [state, version] = await Promise.all([getProjectState(), detectAppVersion()]);
        const since = await changelogSinceAffected(version);
        post({ type: 'projectStateData', html: renderPanelBody(state, version, since) });
    } catch {
        post({ type: 'projectStateData', html: '' });
    }
}
