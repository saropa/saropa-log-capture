/**
 * Icon bar HTML markup for the vertical activity bar.
 * Extracted from viewer-icon-bar.ts to keep that file under the 300-line limit.
 *
 * Tools open a slide-out panel in `#panel-slot` with mutual exclusion. In-log search lives only
 * in the session-nav field (top bar); use Ctrl+F / focus the search input — not an icon here.
 *
 * Optional text labels: click the bar background or separator (not a button) to toggle;
 * preference is persisted in webview state (iconBarLabelsVisible).
 *
 * User-facing strings resolve through t() (host-built HTML); IDs are load-bearing
 * (scripts query them) so the markup is migrated inline, not via a helper.
 */

import { t } from '../../l10n';

/** Generate the icon bar HTML with codicon-based buttons and optional labels. */
export function getIconBarHtml(): string {
    return /* html */ `
<div id="icon-bar" role="toolbar" aria-label="${t('viewer.iconBar.toolbar.label')}" title="${t('viewer.iconBar.toolbar.title')}">
    <button id="ib-sessions" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.sessions.title')}" aria-label="${t('viewer.iconBar.sessions.label')}">
        <span class="codicon codicon-files"></span><span class="ib-label">${t('viewer.iconBar.sessions.text')}</span>
    </button>
    <button id="ib-find" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.find.title')}" aria-label="${t('viewer.iconBar.find.label')}">
        <span class="codicon codicon-search"></span><span class="ib-label">${t('viewer.iconBar.find.text')}</span>
    </button>
    <button id="ib-signal" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.signal.title')}" aria-label="${t('viewer.iconBar.signal.label')}">
        <span class="codicon codicon-pulse"></span><span id="ib-signal-badge" class="ib-badge"></span><span class="ib-label">${t('viewer.iconBar.signal.text')}<span id="ib-signal-count" class="ib-count"></span></span>
    </button>
    <button id="ib-sql-query-history" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.sqlHistory.title')}" aria-label="${t('viewer.iconBar.sqlHistory.label')}">
        <span class="codicon codicon-database"></span><span id="ib-sql-badge" class="ib-badge"></span><span class="ib-label">${t('viewer.iconBar.sqlHistory.text')}<span id="ib-sql-count" class="ib-count"></span></span>
    </button>
    <div class="ib-separator"></div>
    <button id="ib-crashlytics" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.crashlytics.title')}" aria-label="${t('viewer.iconBar.crashlytics.label')}">
        <span class="codicon codicon-flame"></span><span id="ib-crashlytics-badge" class="ib-badge"></span><span class="ib-label">${t('viewer.iconBar.crashlytics.text')}<span id="ib-crashlytics-count" class="ib-count"></span></span>
    </button>
    <button id="ib-project-state" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.projectState.title')}" aria-label="${t('viewer.iconBar.projectState.label')}">
        <span class="codicon codicon-git-commit"></span><span class="ib-label">${t('viewer.iconBar.projectState.text')}</span>
    </button>
    <button id="ib-collections" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.collections.title')}" aria-label="${t('viewer.iconBar.collections.label')}">
        <span class="codicon codicon-folder-library"></span><span id="ib-collections-badge" class="ib-badge"></span><span class="ib-label">${t('viewer.iconBar.collections.text')}<span id="ib-collections-count" class="ib-count"></span></span>
    </button>
    <button id="ib-bookmarks" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.bookmarks.title')}" aria-label="${t('viewer.iconBar.bookmarks.label')}">
        <span class="codicon codicon-bookmark"></span><span id="ib-bookmarks-badge" class="ib-badge"></span><span class="ib-label">${t('viewer.iconBar.bookmarks.text')}<span id="ib-bookmarks-count" class="ib-count"></span></span>
    </button>
    <button id="ib-trash" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.trash.title')}" aria-label="${t('viewer.iconBar.trash.label')}">
        <span class="codicon codicon-trash"></span><span id="ib-trash-badge" class="ib-badge"></span><span class="ib-label">${t('viewer.iconBar.trash.text')}<span id="ib-trash-count" class="ib-count"></span></span>
    </button>
    <div class="ib-separator"></div>
    <button id="ib-options" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.options.title')}" aria-label="${t('viewer.iconBar.options.label')}">
        <span class="codicon codicon-settings-gear"></span><span class="ib-label">${t('viewer.iconBar.options.text')}</span>
    </button>
    <button id="ib-about" class="ib-icon" tabindex="0" title="${t('viewer.iconBar.about.title')}" aria-label="${t('viewer.iconBar.about.label')}">
        <span class="codicon codicon-home"></span><span class="ib-label">${t('viewer.iconBar.about.text')}</span>
    </button>
</div>`;
}
