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
    <!-- Unified log status bar (plan 109). One inline surface, two modes driven by
         viewer-log-banner.ts: STATUS (persistent while a log is open — filename + lifespan +
         session metadata + file actions; only its × collapses it) and AUTO (a newer
         main-project/controller log was detected — Open / Dismiss, then back to STATUS). Fed by the
         host logContextInfo message, not the session list. Starts hidden because no log is open
         yet; role=status + aria-live announces the auto alert without stealing focus. Its chrome is
         built by the script — do not add children here. -->
    <div id="viewer-newer-banner" class="session-newer-banner viewer-newer-banner" style="display:none" role="status" aria-live="polite"></div>
    <div id="split-breadcrumb">
        <button id="split-prev" title="${t('viewer.split.prev.title')}" aria-label="${t('viewer.split.prev.label')}" disabled>&#x25C0;</button>
        <span class="nav-bar-label" aria-hidden="true">${t('viewer.split.part')} <span id="split-current">1</span> ${t('viewer.split.of')} <span id="split-total">1</span></span>
        <button id="split-next" title="${t('viewer.split.next.title')}" aria-label="${t('viewer.split.next.label')}" disabled>&#x25B6;</button>
    </div>
    <div id="pinned-section"></div>
    <div id="root-cause-hypotheses" class="root-cause-hypotheses u-hidden" role="region" aria-label="${t('viewer.rootCause.region')}"></div>
    <!-- Trouble Mode severity chart (Stage 3). Shown only while Trouble Mode is active
         (CSS keyed on body.slc-trouble-active); the chart script fills the body only. -->
    <div id="trouble-chart" class="trouble-chart" role="region" aria-label="${t('viewer.troubleChart.region')}">
        <!-- Legend chips and the peak count live in the head row (not under the strip) so the
             readability additions cost the feed almost no vertical space. The peak label was
             moved out of the plot because a tall leading bar (the device-startup warning rush)
             drew straight through it — an overlapped label is worse than no label. -->
        <div class="trouble-chart-head">
            <button id="trouble-chart-toggle" class="tc-toggle" type="button" aria-expanded="true"
                aria-controls="trouble-chart-body" title="${t('viewer.troubleChart.toggle.title')}"
                aria-label="${t('viewer.troubleChart.toggle.label')}">&#x25BE;</button>
            <span id="trouble-chart-title" class="trouble-chart-title">${t('viewer.troubleChart.title')}</span>
            <span id="trouble-chart-peak" class="tc-peak"></span>
            <span id="trouble-chart-legend" class="tc-legend"></span>
        </div>
        <!-- role="img" belongs on the plot, not the region: the region now holds a real button,
             and an interactive control inside role="img" is unreachable to a screen reader. -->
        <div id="trouble-chart-body" class="trouble-chart-body" role="img"
            aria-label="${t('viewer.troubleChart.region')}"></div>
    </div>
    <!-- Trouble Mode Crashlytics band (Stage 5). Top cached crash issues from the
         background watcher's cache; hidden until Trouble Mode is active AND the band
         has rows. A row click opens the existing in-viewer Crashlytics detail overlay. -->
    <div id="trouble-crashlytics" class="trouble-crashlytics u-hidden" role="region" aria-label="${t('viewer.troubleCrashlytics.region')}">
        <div class="trouble-crashlytics-head">
            <span class="tcx-head-left">
                <button id="trouble-crashlytics-toggle" class="tcx-toggle" type="button" aria-expanded="true"
                    aria-controls="trouble-crashlytics-rows" title="${t('viewer.troubleCrashlytics.toggle.title')}"
                    aria-label="${t('viewer.troubleCrashlytics.toggle.label')}">&#x25BE;</button>
                <span id="trouble-crashlytics-title" class="tcx-head-title">${t('viewer.troubleCrashlytics.title')}</span>
            </span>
            <!-- Cache freshness (plan 110, Stage 5): the band is fed from the background
                 watcher's on-disk cache of Firebase Crashlytics (cloud), never a live fetch
                 and unrelated to the log's own timeframe, so its age must be visible. -->
            <span id="trouble-crashlytics-fresh" class="tcx-fresh" title="${t('viewer.troubleCrashlytics.freshTitle')}"></span>
        </div>
        <div id="trouble-crashlytics-rows" class="trouble-crashlytics-rows"></div>
        <div id="trouble-crashlytics-more" class="trouble-crashlytics-more u-hidden"></div>
    </div>
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
    <!-- Trouble Mode side rail (plan 110, Stage 1). A flex COLUMN to the right of the
         feed once the wrapper is wide enough (body.slc-trouble-rail-wide); below that
         width it falls back to the original full-feed overlay. Triage means reading the
         report against the log, so the feed must stay on screen.

         Two content slots, one rail: #trouble-detail-body holds the host-built feed-row
         report; #trouble-detail-crashlytics holds the Crashlytics issue detail when a
         band row is clicked (rail carries .td-mode-cd, which hides the head + body).
         aria-live announces late-arriving content without stealing focus.

         Resize handle is a SIBLING before the rail (mirrors #panel-slot-resize), not a
         child of it, so it stays a normal flex item next to #trouble-detail in the
         #log-content-wrapper row — CSS only reveals it while the rail is open AND in the
         wide static-column layout (viewer-trouble-detail.ts owns the drag). -->
    <div id="trouble-rail-resize" class="trouble-rail-resize" aria-hidden="true"></div>
    <div id="trouble-detail" class="trouble-detail u-hidden" role="region" tabindex="-1" aria-label="${t('viewer.troubleDetail.region')}">
        <div class="trouble-detail-head">
            <div class="trouble-detail-head-top">
                <span id="trouble-detail-title" class="trouble-detail-title"></span>
                <button type="button" id="trouble-detail-close" class="trouble-detail-close" title="${t('viewer.troubleDetail.close.title')}" aria-label="${t('viewer.troubleDetail.close.title')}">×</button>
            </div>
            <div class="trouble-detail-actions">
                <button type="button" id="trouble-detail-reveal" class="trouble-detail-btn" title="${t('viewer.troubleDetail.reveal.title')}" aria-label="${t('viewer.troubleDetail.reveal.label')}">${t('viewer.troubleDetail.reveal.label')}</button>
                <button type="button" id="trouble-detail-copy" class="trouble-detail-btn" title="${t('viewer.troubleDetail.copy.title')}" aria-label="${t('viewer.troubleDetail.copy.label')}">${t('viewer.troubleDetail.copy.label')}</button>
            </div>
        </div>
        <div id="trouble-detail-body" class="trouble-detail-body" aria-live="polite"></div>
        <div id="trouble-detail-crashlytics" class="trouble-detail-cd" aria-live="polite"></div>
    </div>
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
