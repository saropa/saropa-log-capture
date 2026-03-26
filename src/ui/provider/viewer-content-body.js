"use strict";
/**
 * Viewer webview body HTML (main-content through icon bar).
 * Extracted to keep viewer-content.ts under the line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerBodyHtml = getViewerBodyHtml;
const viewer_run_nav_1 = require("../viewer-nav/viewer-run-nav");
const viewer_search_html_1 = require("../viewer-search-filter/viewer-search-html");
const viewer_session_panel_1 = require("../viewer-panels/viewer-session-panel");
const viewer_session_context_menu_1 = require("../viewer-context-menu/viewer-session-context-menu");
const viewer_find_panel_1 = require("../viewer-panels/viewer-find-panel");
const viewer_bookmark_panel_1 = require("../viewer-panels/viewer-bookmark-panel");
const viewer_sql_query_history_panel_1 = require("../viewer-panels/viewer-sql-query-history-panel");
const viewer_trash_panel_1 = require("../viewer-panels/viewer-trash-panel");
const viewer_filters_panel_1 = require("../viewer-search-filter/viewer-filters-panel");
const viewer_options_panel_1 = require("../viewer-panels/viewer-options-panel");
const viewer_crashlytics_panel_1 = require("../panels/viewer-crashlytics-panel");
const viewer_insight_panel_1 = require("../panels/viewer-insight-panel");
const viewer_about_panel_1 = require("../viewer-panels/viewer-about-panel");
const viewer_scrollbar_minimap_1 = require("../viewer/viewer-scrollbar-minimap");
const viewer_goto_line_1 = require("../viewer/viewer-goto-line");
const viewer_replay_1 = require("../viewer/viewer-replay");
const viewer_error_breakpoint_1 = require("../viewer-decorations/viewer-error-breakpoint");
const viewer_context_menu_1 = require("../viewer-context-menu/viewer-context-menu");
const viewer_context_modal_1 = require("../viewer-context-menu/viewer-context-modal");
const viewer_deco_settings_1 = require("../viewer-decorations/viewer-deco-settings");
const viewer_export_1 = require("../viewer-panels/viewer-export");
const viewer_edit_modal_1 = require("../viewer-context-menu/viewer-edit-modal");
const viewer_auto_hide_modal_1 = require("../viewer/viewer-auto-hide-modal");
const viewer_icon_bar_1 = require("../viewer-nav/viewer-icon-bar");
/** Body HTML inside <body>: main-content div through icon bar. */
function getViewerBodyHtml(opts) {
    const version = opts.version ?? '';
    return /* html */ `
    <div id="main-content" role="main">
    <div id="session-nav-wrapper" class="session-nav-wrapper">
    <div id="session-nav">
        <span class="session-nav-controls">
        <button type="button" id="session-prev" class="session-nav-icon-btn" title="Previous log (older)" aria-label="Previous log (older)" disabled><span class="codicon codicon-chevron-left" aria-hidden="true"></span></button>
        <span class="nav-bar-label">Log <span id="session-nav-current">1</span> of <span id="session-nav-total">1</span></span>
        <button type="button" id="session-next" class="session-nav-icon-btn" title="Next log (newer)" aria-label="Next log (newer)" disabled><span class="codicon codicon-chevron-right" aria-hidden="true"></span></button>
        ${(0, viewer_run_nav_1.getRunNavHtml)()}
        </span>
        <span id="session-details-inline" class="session-details-inline" aria-label="Log context"></span>
        <button type="button" id="session-perf-chip" class="session-perf-chip u-hidden" title="Open Performance panel" aria-label="Performance data available">Performance</button>
        ${(0, viewer_search_html_1.getSessionNavSearchHtml)()}
    </div>
    <div id="compress-suggest-banner" class="compress-suggest-banner u-hidden" role="status" aria-live="polite">
        <span class="compress-suggest-msg">Many identical lines in a row — try <strong>Compress lines</strong> (Options → Layout or right-click → Options).</span>
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
    ${(0, viewer_session_panel_1.getSessionPanelHtml)()}
    ${(0, viewer_session_context_menu_1.getSessionContextMenuHtml)()}
    ${(0, viewer_find_panel_1.getFindPanelHtml)()}
    ${(0, viewer_bookmark_panel_1.getBookmarkPanelHtml)()}
    ${(0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelHtml)()}
    ${(0, viewer_trash_panel_1.getTrashPanelHtml)()}
    ${(0, viewer_filters_panel_1.getFiltersPanelHtml)()}
    ${(0, viewer_options_panel_1.getOptionsPanelHtml)()}
    ${(0, viewer_crashlytics_panel_1.getCrashlyticsPanelHtml)()}
    ${(0, viewer_insight_panel_1.getInsightPanelHtml)()}
    ${(0, viewer_about_panel_1.getAboutPanelHtml)()}
    </div>
    <div id="log-area-with-footer">
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
    ${(0, viewer_scrollbar_minimap_1.getScrollbarMinimapHtml)()}
    ${(0, viewer_goto_line_1.getGotoLineHtml)()}
    ${(0, viewer_replay_1.getReplayBarHtml)()}
    </div>
    <div id="footer">
        <span id="footer-text" data-version="${version ? `v${version}` : ''}">Waiting for debug session...</span>
        ${(0, viewer_error_breakpoint_1.getErrorBreakpointHtml)()}
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
        <div id="footer-actions-menu" class="footer-actions-menu">
            <button id="footer-actions-btn" class="footer-btn footer-actions-btn" title="Actions" aria-label="Actions menu" aria-haspopup="true" aria-expanded="false">
                <span class="codicon codicon-tools"></span> Actions
            </button>
            <div id="footer-actions-popover" class="footer-actions-popover" role="menu" aria-label="Actions">
                <button type="button" class="footer-actions-item" data-action="replay" role="menuitem">
                    <span class="codicon codicon-debug-start" aria-hidden="true"></span> Replay
                </button>
                <hr class="footer-actions-separator" role="separator">
                <button type="button" class="footer-actions-item" data-action="open-quality-report" role="menuitem">
                    <span class="codicon codicon-file-code" aria-hidden="true"></span> Open Quality Report
                </button>
                <hr class="footer-actions-separator" role="separator">
                <button type="button" class="footer-actions-item" data-action="export" role="menuitem">
                    <span class="codicon codicon-export" aria-hidden="true"></span> Export
                </button>
            </div>
        </div>
        <span class="footer-dot">&middot;</span>
        <a id="footer-version-link" href="#" class="footer-version-link" title="About Saropa" aria-label="About Saropa Log Capture">${version ? `v${version}` : ''}</a>
    </div>
    </div>
    </div>
    ${(0, viewer_context_menu_1.getContextMenuHtml)()}
    ${(0, viewer_context_modal_1.getContextModalHtml)()}
    ${(0, viewer_deco_settings_1.getDecoSettingsHtml)()}
    ${(0, viewer_export_1.getExportModalHtml)()}
    ${(0, viewer_edit_modal_1.getEditModalHtml)()}
    ${(0, viewer_auto_hide_modal_1.getAutoHideModalHtml)()}
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
    ${(0, viewer_icon_bar_1.getIconBarHtml)()}`;
}
//# sourceMappingURL=viewer-content-body.js.map