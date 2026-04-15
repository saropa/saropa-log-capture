/**
 * Viewer webview body HTML (main-content through icon bar).
 * Extracted to keep viewer-content.ts under the line limit.
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
import { getAboutPanelHtml } from '../viewer-panels/viewer-about-panel';
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
import { getIconBarHtml } from '../viewer-nav/viewer-icon-bar';

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
    ${getSessionPanelHtml()}
    ${getSessionContextMenuHtml()}
    ${getFindPanelHtml()}
    ${getBookmarkPanelHtml()}
    ${getSqlQueryHistoryPanelHtml()}
    ${getTrashPanelHtml()}
    ${getOptionsPanelHtml()}
    ${getCrashlyticsPanelHtml()}
    ${getSignalPanelHtml()}
    ${getAboutPanelHtml()}
    </div>
    <div id="log-area-with-footer">
    ${getToolbarHtml({ version })}
    ${getSearchFlyoutHtml()}
    ${getFilterDrawerHtml()}
    ${getActionsDropdownHtml()}
    <div id="compress-suggest-banner" class="compress-suggest-banner u-hidden" role="status" aria-live="polite">
        <span class="compress-suggest-msg">Many identical lines in a row — try <strong>Compress lines</strong> (Options \u2192 Layout or right-click \u2192 Options).</span>
        <button type="button" id="compress-suggest-enable" class="compress-suggest-btn">Enable</button>
        <button type="button" id="compress-suggest-dismiss" class="compress-suggest-dismiss" title="Dismiss">\u00d7</button>
    </div>
    <div id="resume-session-banner" class="resume-session-banner u-hidden" role="status" aria-live="polite">
        <span class="resume-session-msg">Loaded latest log.</span>
        <button type="button" id="resume-session-btn" class="resume-session-action" title="Open last viewed session"></button>
        <button type="button" id="resume-session-dismiss" class="resume-session-dismiss" title="Dismiss">\u00d7</button>
    </div>
    <div id="split-breadcrumb">
        <button id="split-prev" title="Previous part" aria-label="Previous part" disabled>&#x25C0;</button>
        <span class="nav-bar-label" aria-hidden="true">Part <span id="split-current">1</span> of <span id="split-total">1</span></span>
        <button id="split-next" title="Next part" aria-label="Next part" disabled>&#x25B6;</button>
    </div>
    <div id="pinned-section"></div>
    <div id="root-cause-hypotheses" class="root-cause-hypotheses u-hidden" role="region" aria-label="Hypotheses"></div>
    <div id="log-content-wrapper">
    <div id="log-content" class="nowrap" role="log" aria-label="Log content">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
    </div>
    <button id="jump-top-btn" title="Scroll to top" aria-label="Scroll to top">&#x2B06; Top</button>
    <button id="jump-btn" title="Scroll to bottom" aria-label="Scroll to bottom">&#x2B07; Bottom</button>
    <div id="copy-float" class="codicon codicon-copy" title="Copy line" role="button" aria-label="Copy line"></div>
    ${getScrollbarMinimapHtml()}
    ${getGotoLineHtml()}
    ${getReplayBarHtml()}
    ${getErrorBreakpointHtml()}
    </div>
    </div>
    </div>
    ${getContextMenuHtml()}
    ${getScrollChromeContextMenuHtml()}
    ${getContextModalHtml()}
    ${getDecoSettingsHtml()}
    ${getExportModalHtml()}
    ${getEditModalHtml()}
    ${getAutoHideModalHtml()}
    </div>
    ${getIconBarHtml()}`;
}
