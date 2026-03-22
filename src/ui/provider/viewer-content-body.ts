/**
 * Viewer webview body HTML (main-content through icon bar).
 * Extracted to keep viewer-content.ts under the line limit.
 */

import { getRunNavHtml } from '../viewer-nav/viewer-run-nav';
import { getSessionNavSearchHtml } from '../viewer-search-filter/viewer-search-html';
import { getSessionPanelHtml } from '../viewer-panels/viewer-session-panel';
import { getSessionContextMenuHtml } from '../viewer-context-menu/viewer-session-context-menu';
import { getFindPanelHtml } from '../viewer-panels/viewer-find-panel';
import { getBookmarkPanelHtml } from '../viewer-panels/viewer-bookmark-panel';
import { getTrashPanelHtml } from '../viewer-panels/viewer-trash-panel';
import { getFiltersPanelHtml } from '../viewer-search-filter/viewer-filters-panel';
import { getOptionsPanelHtml } from '../viewer-panels/viewer-options-panel';
import { getCrashlyticsPanelHtml } from '../panels/viewer-crashlytics-panel';
import { getInsightPanelHtml } from '../panels/viewer-insight-panel';
import { getAboutPanelHtml } from '../viewer-panels/viewer-about-panel';
import { getScrollbarMinimapHtml } from '../viewer/viewer-scrollbar-minimap';
import { getGotoLineHtml } from '../viewer/viewer-goto-line';
import { getReplayBarHtml } from '../viewer/viewer-replay';
import { getErrorBreakpointHtml } from '../viewer-decorations/viewer-error-breakpoint';
import { getContextMenuHtml } from '../viewer-context-menu/viewer-context-menu';
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
    <div id="session-nav-wrapper" class="session-nav-wrapper">
    <div id="session-nav">
        <span class="session-nav-controls">
        <button type="button" id="session-prev" class="session-nav-icon-btn" title="Previous log (older)" aria-label="Previous log (older)" disabled><span class="codicon codicon-chevron-left" aria-hidden="true"></span></button>
        <span class="nav-bar-label">Log <span id="session-nav-current">1</span> of <span id="session-nav-total">1</span></span>
        <button type="button" id="session-next" class="session-nav-icon-btn" title="Next log (newer)" aria-label="Next log (newer)" disabled><span class="codicon codicon-chevron-right" aria-hidden="true"></span></button>
        ${getRunNavHtml()}
        </span>
        <span id="session-details-inline" class="session-details-inline" aria-label="Log context"></span>
        <button type="button" id="session-perf-chip" class="session-perf-chip u-hidden" title="Open Performance panel" aria-label="Performance data available">Performance</button>
        ${getSessionNavSearchHtml()}
    </div>
    <div id="compress-suggest-banner" class="compress-suggest-banner u-hidden" role="status" aria-live="polite">
        <span class="compress-suggest-msg">Many identical lines in a row — try <strong>Compress lines</strong> (button above the log or Options → Layout).</span>
        <button type="button" id="compress-suggest-enable" class="compress-suggest-btn">Enable</button>
        <button type="button" id="compress-suggest-dismiss" class="compress-suggest-dismiss" title="Dismiss">×</button>
    </div>
    </div>
    <div id="split-breadcrumb">
        <button id="split-prev" title="Previous part" aria-label="Previous part" disabled>&#x25C0;</button>
        <span class="nav-bar-label" aria-hidden="true">Part <span id="split-current">1</span> of <span id="split-total">1</span></span>
        <button id="split-next" title="Next part" aria-label="Next part" disabled>&#x25B6;</button>
    </div>
    <div id="pinned-section"></div>
    <div id="panel-content-row">
    <div id="panel-slot">
    ${getSessionPanelHtml()}
    ${getSessionContextMenuHtml()}
    ${getFindPanelHtml()}
    ${getBookmarkPanelHtml()}
    ${getTrashPanelHtml()}
    ${getFiltersPanelHtml()}
    ${getOptionsPanelHtml()}
    ${getCrashlyticsPanelHtml()}
    ${getInsightPanelHtml()}
    ${getAboutPanelHtml()}
    </div>
    <div id="log-area-with-footer">
    <div id="log-content-wrapper">
    <div id="log-content" class="nowrap" role="log" aria-label="Log content">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
    </div>
    <button type="button" id="log-compress-toggle" class="log-compress-toggle" title="Compress lines (hide blanks + collapse consecutive duplicates)" aria-label="Compress lines" aria-pressed="false">
        <span class="codicon codicon-collapse-all" aria-hidden="true"></span>
    </button>
    <button id="jump-top-btn" title="Scroll to top" aria-label="Scroll to top">&#x2B06; Top</button>
    <button id="jump-btn" title="Scroll to bottom" aria-label="Scroll to bottom">&#x2B07; Bottom</button>
    <div id="copy-float" class="codicon codicon-copy" title="Copy line" role="button" aria-label="Copy line"></div>
    ${getScrollbarMinimapHtml()}
    ${getGotoLineHtml()}
    ${getReplayBarHtml()}
    </div>
    <div id="footer">
        <span id="footer-text" data-version="${version ? `v${version}` : ''}">Waiting for debug session...</span>
        ${getErrorBreakpointHtml()}
        <span id="level-menu-btn" class="level-summary" role="button" aria-label="Level filters" title="Level filters — click to open">
            <span class="level-dot-group" data-level="info" title="Info" role="img" aria-label="Info"><span class="level-dot active level-dot-info"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="warning" title="Warning" role="img" aria-label="Warning"><span class="level-dot active level-dot-warning"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="error" title="Error" role="img" aria-label="Error"><span class="level-dot active level-dot-error"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="performance" title="Perf" role="img" aria-label="Performance"><span class="level-dot active level-dot-performance"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="todo" title="TODO" role="img" aria-label="TODO"><span class="level-dot active level-dot-todo"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="debug" title="Debug" role="img" aria-label="Debug"><span class="level-dot active level-dot-debug"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="notice" title="Notice" role="img" aria-label="Notice"><span class="level-dot active level-dot-notice"></span><span class="dot-count"></span></span>
            <span id="level-trigger-label" class="level-trigger-label">All</span>
        </span>
        <span id="line-count" aria-live="polite" aria-atomic="true"></span>
        <span id="hidden-lines-counter" class="hidden-lines-counter u-hidden" role="button" title="Click to peek, double-click to manage" aria-label="Hidden lines counter">
            <span class="codicon codicon-eye-closed"></span>
            <span class="hidden-count-text"></span>
        </span>
        <span id="footer-selection" class="footer-selection"></span>
        <span id="filter-badge" class="filter-badge" role="button" title="Active filters — click to open filters" aria-label="Active filters — click to open options"></span>
        <span class="footer-spacer"></span>
        <button id="footer-replay-btn" class="footer-btn footer-replay-btn" title="Replay log" aria-label="Replay log"><span class="codicon codicon-debug-start"></span> Replay</button>
        <span class="footer-dot">&middot;</span>
        <a id="footer-version-link" href="#" class="footer-version-link" title="About Saropa" aria-label="About Saropa Log Capture">${version ? `v${version}` : ''}</a>
    </div>
    </div>
    </div>
    ${getContextMenuHtml()}
    ${getContextModalHtml()}
    ${getDecoSettingsHtml()}
    ${getExportModalHtml()}
    ${getEditModalHtml()}
    ${getAutoHideModalHtml()}
    <div id="level-flyup">
        <div class="level-flyup-title">Level Filters</div>
        <div class="level-flyup-header">
            <button type="button" id="level-select-all" class="active">All</button>
            <button type="button" id="level-select-none">None</button>
        </div>
        <button id="level-info-toggle" class="level-circle active" title="Info" aria-label="Toggle Info level"><span class="level-emoji">🟢</span><span class="level-label">Info</span><span class="level-count"></span></button>
        <button id="level-warning-toggle" class="level-circle active" title="Warning" aria-label="Toggle Warning level"><span class="level-emoji">🟠</span><span class="level-label">Warning</span><span class="level-count"></span></button>
        <button id="level-error-toggle" class="level-circle active" title="Error" aria-label="Toggle Error level"><span class="level-emoji">🔴</span><span class="level-label">Error</span><span class="level-count"></span></button>
        <button id="level-performance-toggle" class="level-circle active" title="Performance" aria-label="Toggle Performance level"><span class="level-emoji">🟣</span><span class="level-label">Perf</span><span class="level-count"></span></button>
        <button id="level-todo-toggle" class="level-circle active" title="TODO/FIXME" aria-label="Toggle TODO level"><span class="level-emoji">⚪</span><span class="level-label">TODO</span><span class="level-count"></span></button>
        <button id="level-debug-toggle" class="level-circle active" title="Debug/Trace" aria-label="Toggle Debug level"><span class="level-emoji">🟤</span><span class="level-label">Debug</span><span class="level-count"></span></button>
        <button id="level-notice-toggle" class="level-circle active" title="Notice" aria-label="Toggle Notice level"><span class="level-emoji">🟦</span><span class="level-label">Notice</span><span class="level-count"></span></button>
        <div class="level-flyup-context">
            <span class="level-flyup-context-label">Context: <span id="context-lines-label">3 lines</span></span>
            <input type="range" id="context-lines-slider" min="0" max="10" value="3" title="Number of preceding context lines shown when filtering" aria-label="Context lines when filtering" />
        </div>
    </div>
    </div>
    ${getIconBarHtml()}`;
}
