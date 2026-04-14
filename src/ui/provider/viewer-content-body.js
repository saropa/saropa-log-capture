"use strict";
/**
 * Viewer webview body HTML (main-content through icon bar).
 * Extracted to keep viewer-content.ts under the line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerBodyHtml = getViewerBodyHtml;
const viewer_toolbar_html_1 = require("../viewer-toolbar/viewer-toolbar-html");
const viewer_toolbar_search_html_1 = require("../viewer-toolbar/viewer-toolbar-search-html");
const viewer_toolbar_filter_drawer_html_1 = require("../viewer-toolbar/viewer-toolbar-filter-drawer-html");
const viewer_toolbar_actions_html_1 = require("../viewer-toolbar/viewer-toolbar-actions-html");
const viewer_session_panel_1 = require("../viewer-panels/viewer-session-panel");
const viewer_session_context_menu_1 = require("../viewer-context-menu/viewer-session-context-menu");
const viewer_find_panel_1 = require("../viewer-panels/viewer-find-panel");
const viewer_bookmark_panel_1 = require("../viewer-panels/viewer-bookmark-panel");
const viewer_sql_query_history_panel_1 = require("../viewer-panels/viewer-sql-query-history-panel");
const viewer_trash_panel_1 = require("../viewer-panels/viewer-trash-panel");
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
    <div id="panel-content-row">
    <div id="panel-slot">
    ${(0, viewer_session_panel_1.getSessionPanelHtml)()}
    ${(0, viewer_session_context_menu_1.getSessionContextMenuHtml)()}
    ${(0, viewer_find_panel_1.getFindPanelHtml)()}
    ${(0, viewer_bookmark_panel_1.getBookmarkPanelHtml)()}
    ${(0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelHtml)()}
    ${(0, viewer_trash_panel_1.getTrashPanelHtml)()}
    ${(0, viewer_options_panel_1.getOptionsPanelHtml)()}
    ${(0, viewer_crashlytics_panel_1.getCrashlyticsPanelHtml)()}
    ${(0, viewer_insight_panel_1.getInsightPanelHtml)()}
    ${(0, viewer_about_panel_1.getAboutPanelHtml)()}
    </div>
    <div id="log-area-with-footer">
    ${(0, viewer_toolbar_html_1.getToolbarHtml)({ version })}
    ${(0, viewer_toolbar_search_html_1.getSearchFlyoutHtml)()}
    ${(0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)()}
    ${(0, viewer_toolbar_actions_html_1.getActionsDropdownHtml)()}
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
    ${(0, viewer_scrollbar_minimap_1.getScrollbarMinimapHtml)()}
    ${(0, viewer_goto_line_1.getGotoLineHtml)()}
    ${(0, viewer_replay_1.getReplayBarHtml)()}
    ${(0, viewer_error_breakpoint_1.getErrorBreakpointHtml)()}
    </div>
    </div>
    </div>
    ${(0, viewer_context_menu_1.getContextMenuHtml)()}
    ${(0, viewer_context_menu_1.getScrollChromeContextMenuHtml)()}
    ${(0, viewer_context_modal_1.getContextModalHtml)()}
    ${(0, viewer_deco_settings_1.getDecoSettingsHtml)()}
    ${(0, viewer_export_1.getExportModalHtml)()}
    ${(0, viewer_edit_modal_1.getEditModalHtml)()}
    ${(0, viewer_auto_hide_modal_1.getAutoHideModalHtml)()}
    </div>
    ${(0, viewer_icon_bar_1.getIconBarHtml)()}`;
}
//# sourceMappingURL=viewer-content-body.js.map