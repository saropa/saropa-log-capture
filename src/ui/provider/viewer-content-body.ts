/**
 * Viewer webview body HTML (main-content through icon bar).
 * Extracted to keep viewer-content.ts under the line limit.
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer-b.ts.
 * The log-content title is escapeHtml()-wrapped because its text contains quotes.
 */

import { getToolbarHtml } from '../viewer-toolbar/viewer-toolbar-html';
import { getSearchFlyoutHtml } from '../viewer-toolbar/viewer-toolbar-search-html';
import { getFilterDrawerHtml } from '../viewer-toolbar/viewer-toolbar-filter-drawer-html';
import { getActionsDropdownHtml } from '../viewer-toolbar/viewer-toolbar-actions-html';
import { getSessionPanelHtml } from '../viewer-panels/viewer-session-panel';
import { getSessionContextMenuHtml } from '../viewer-context-menu/viewer-session-context-menu';
import { getFindPanelHtml } from '../viewer-panels/viewer-find-panel';
import { getBookmarkPanelHtml } from '../viewer-panels/viewer-bookmark-panel';
import { getSqlQueryHistoryPanelHtml } from '../viewer-panels/viewer-sql-query-history-panel';
import { getTrashPanelHtml } from '../viewer-panels/viewer-trash-panel';
import { getOptionsPanelHtml } from '../viewer-panels/viewer-options-panel';
import { getCrashlyticsPanelHtml } from '../panels/viewer-crashlytics-panel';
import { getSignalPanelHtml } from '../panels/viewer-signal-panel';
import { getCollectionsPanelHtml } from '../viewer-panels/viewer-collections-panel';
import { getAboutPanelHtml } from '../viewer-panels/viewer-about-panel';
import { getProjectStatePanelHtml } from '../viewer-panels/viewer-project-state-panel';

import { getScrollbarMinimapHtml } from '../viewer/viewer-scrollbar-minimap';
import { getGotoLineHtml } from '../viewer/viewer-goto-line';
import { getReplayBarHtml } from '../viewer/viewer-replay';
import { getErrorBreakpointHtml } from '../viewer-decorations/viewer-error-breakpoint';
import { getContextMenuHtml, getScrollChromeContextMenuHtml } from '../viewer-context-menu/viewer-context-menu';
import { getContextModalHtml } from '../viewer-context-menu/viewer-context-modal';
import { getDecoSettingsHtml } from '../viewer-decorations/viewer-deco-settings';
import { getExportModalHtml } from '../viewer-panels/viewer-export';
import { getEditModalHtml } from '../viewer-context-menu/viewer-edit-modal';
import { getAutoHideModalHtml } from '../viewer/viewer-auto-hide-modal';
import { getLogFileModalHtml } from '../viewer/viewer-log-file-modal';
import { getFilesListModalHtml } from '../viewer/viewer-files-list-modal';
import { getSessionInfoModalHtml } from '../viewer/viewer-session-info-modal';
import { getIconBarHtml } from '../viewer-nav/viewer-icon-bar';
import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';

export interface ViewerBodyOptions {
    readonly version?: string;
}

/** Body HTML inside <body>: main-content div through icon bar. */
export function getViewerBodyHtml(opts: ViewerBodyOptions): string {
    const version = opts.version ?? '';
    return /* html */ `
    <div id="main-content" role="main">
    <div id="panel-content-row">
    <div id="panel-slot">
    <!-- Single resize handle for the shared slide-out width. It lives on the
         persistent #panel-slot (not inside any one panel) so EVERY panel is
         resizable from the same edge — previously the handle sat inside the
         session panel markup, which is display:none whenever another panel
         (SQL history, bookmarks, etc.) was the active one, so only Sessions
         could be dragged. The slot width is the single shared width all panels
         render into at width:100%. -->
    <div id="panel-slot-resize" class="panel-slot-resize" aria-hidden="true"></div>
    ${getSessionPanelHtml()}
    ${getSessionContextMenuHtml()}
    ${getFindPanelHtml()}
    ${getBookmarkPanelHtml()}
    ${getSqlQueryHistoryPanelHtml()}
    ${getTrashPanelHtml()}
    ${getOptionsPanelHtml()}
    ${getCrashlyticsPanelHtml()}
    ${getProjectStatePanelHtml()}
    ${getCollectionsPanelHtml()}
    ${getSignalPanelHtml()}
    ${getAboutPanelHtml()}
    ${getFilterDrawerHtml()}
    </div>
    <div id="log-area-with-footer">
    ${getToolbarHtml({ version })}
    ${getSearchFlyoutHtml()}
    ${getActionsDropdownHtml()}
    <div id="compress-suggest-banner" class="compress-suggest-banner u-hidden" role="status" aria-live="polite">
        <span class="compress-suggest-msg">${t('viewer.compressBanner.msg', '<strong>' + t('viewer.compressBanner.boldTerm') + '</strong>')}</span>
        <button type="button" id="compress-suggest-enable" class="compress-suggest-btn">${t('viewer.compressBanner.enable')}</button>
        <button type="button" id="compress-suggest-dismiss" class="compress-suggest-dismiss" title="${t('viewer.compressBanner.dismiss')}">×</button>
    </div>
    <div id="resume-session-banner" class="resume-session-banner u-hidden" role="status" aria-live="polite">
        <span class="resume-session-msg">${t('viewer.resumeBanner.msg')}</span>
        <button type="button" id="resume-session-btn" class="resume-session-action" title="${t('viewer.resumeBanner.btn.title')}"></button>
        <button type="button" id="resume-session-dismiss" class="resume-session-dismiss" title="${t('viewer.resumeBanner.dismiss')}">×</button>
    </div>
    <div id="split-breadcrumb">
        <button id="split-prev" title="${t('viewer.split.prev.title')}" aria-label="${t('viewer.split.prev.label')}" disabled>&#x25C0;</button>
        <span class="nav-bar-label" aria-hidden="true">${t('viewer.split.part')} <span id="split-current">1</span> ${t('viewer.split.of')} <span id="split-total">1</span></span>
        <button id="split-next" title="${t('viewer.split.next.title')}" aria-label="${t('viewer.split.next.label')}" disabled>&#x25B6;</button>
    </div>
    <div id="pinned-section"></div>
    <div id="root-cause-hypotheses" class="root-cause-hypotheses u-hidden" role="region" aria-label="${t('viewer.rootCause.region')}"></div>
    <div id="log-content-wrapper">
    <div class="log-content-clip">
    <div id="log-content" class="nowrap" role="log" aria-label="${t('viewer.logContent.region')}" title="${escapeHtml(t('viewer.logContent.title'))}">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
    </div>
    </div>
    <button id="jump-top-btn" title="${t('viewer.jumpTop.title')}" aria-label="${t('viewer.jumpTop.title')}">&#x2B06; ${t('viewer.jumpTop.text')}</button>
    <button id="jump-btn" title="${t('viewer.jumpBottom.title')}" aria-label="${t('viewer.jumpBottom.title')}">&#x2B07; ${t('viewer.jumpBottom.text')}</button>
    <div id="copy-float" class="codicon codicon-copy" title="${t('viewer.copyFloat.title')}" role="button" aria-label="${t('viewer.copyFloat.label')}"></div>
    ${getScrollbarMinimapHtml()}
    ${getGotoLineHtml()}
    ${getReplayBarHtml()}
    ${getErrorBreakpointHtml()}
    </div>
    <div id="crashlytics-detail" class="crashlytics-detail u-hidden" role="region" aria-label="${t('viewer.crashlytics.detail.region')}"></div>
    </div>
    </div>
    ${getContextMenuHtml()}
    ${getScrollChromeContextMenuHtml()}
    ${getContextModalHtml()}
    ${getDecoSettingsHtml()}
    ${getExportModalHtml()}
    ${getLogFileModalHtml()}
    ${getFilesListModalHtml()}
    ${getSessionInfoModalHtml()}
    ${getEditModalHtml()}
    ${getAutoHideModalHtml()}
    </div>
    ${getIconBarHtml()}`;
}
