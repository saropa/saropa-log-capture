/**
 * Handler for the "What changed since this version?" line action (plan 055 Stage 4): a log line that
 * contains a version token can ask the workspace CHANGELOG what was released after it.
 *
 * Honest by construction (the Pillar A rule): a version that is NOT present in the changelog reports
 * "not found" — it must never imply "nothing changed". The three outcomes (not found / latest /
 * newer releases exist) are distinguished here using the pure `changelogSince.found` flag, which the
 * convenience `changelogSinceAffected` discards.
 */

import * as vscode from 'vscode';
import { t } from '../../../l10n';
import { escapeHtml } from '../../../modules/capture/ansi';
import { findRootChangelog } from '../../../modules/git/changelog-locate';
import { parseChangelogVersions, changelogSince } from '../../../modules/git/changelog';

export type PostFn = (msg: unknown) => void;

const MAX_RELEASES = 12;

/** Build the popover body listing releases after `version` (reuses crashlytics `.cd-proj` classes). */
function renderReleases(version: string, since: readonly { version: string; summary: string }[]): string {
    const banner = `<div class="cd-maybe-fixed">${t('viewer.changelogSince.heading', escapeHtml(version), since.length)}</div>`;
    const rows = since.slice(0, MAX_RELEASES).map(v =>
        `<div class="cd-proj-row"><span class="cd-proj-ver">${escapeHtml(v.version)}</span>`
        + `<span class="cd-proj-text">${escapeHtml(v.summary)}</span></div>`).join('');
    return `${banner}<div class="cd-proj">${rows}</div>`;
}

/**
 * Resolve the changelog, locate `version`, and post the releases-since result. The webview extracted
 * the token from the line, so this only validates and looks it up. Never throws.
 */
export async function handleChangelogSinceForVersion(lineIndex: number, version: string, post: PostFn): Promise<void> {
    const v = version.trim();
    if (!v) {
        post({ type: 'changelogSincePopoverData', lineIndex, error: t('viewer.changelogSince.noVersion') });
        return;
    }
    try {
        const uri = await findRootChangelog();
        if (!uri) {
            post({ type: 'changelogSincePopoverData', lineIndex, version: v, error: t('viewer.changelogSince.noChangelog') });
            return;
        }
        const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
        const result = changelogSince(parseChangelogVersions(text), v);
        if (!result.found) {
            // Honesty: absent version is reported as such, never as "nothing changed".
            post({ type: 'changelogSincePopoverData', lineIndex, version: v, error: t('viewer.changelogSince.notFound', escapeHtml(v)) });
            return;
        }
        if (result.since.length === 0) {
            post({ type: 'changelogSincePopoverData', lineIndex, version: v, message: t('viewer.changelogSince.latest', escapeHtml(v)) });
            return;
        }
        post({ type: 'changelogSincePopoverData', lineIndex, version: v, html: renderReleases(v, result.since) });
    } catch {
        post({ type: 'changelogSincePopoverData', lineIndex, version: v, error: t('viewer.changelogSince.noChangelog') });
    }
}
