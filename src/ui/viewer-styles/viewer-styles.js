"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerStyles = getViewerStyles;
/**
 * CSS styles for the log viewer webview.
 *
 * All colors use --vscode-* CSS variables so the viewer automatically
 * matches the user's active VS Code theme (light, dark, or high-contrast).
 *
 * Layout: The viewer lives in the VS Code bottom panel (next to Output /
 * Terminal tabs). Panel-scoped elements use --vscode-panel-background to
 * blend seamlessly with the surrounding panel chrome.
 */
const viewer_styles_content_1 = require("./viewer-styles-content");
const viewer_styles_n_plus_one_insight_1 = require("./viewer-styles-n-plus-one-insight");
const viewer_styles_sql_repeat_drilldown_1 = require("./viewer-styles-sql-repeat-drilldown");
const viewer_styles_components_1 = require("./viewer-styles-components");
const viewer_styles_overlays_1 = require("./viewer-styles-overlays");
const viewer_styles_tags_1 = require("./viewer-styles-tags");
const viewer_styles_options_1 = require("./viewer-styles-options");
const viewer_styles_errors_1 = require("./viewer-styles-errors");
const viewer_styles_icon_bar_1 = require("./viewer-styles-icon-bar");
const viewer_styles_session_1 = require("./viewer-styles-session");
const viewer_styles_find_1 = require("./viewer-styles-find");
const viewer_styles_bookmarks_1 = require("./viewer-styles-bookmarks");
const viewer_styles_sql_query_history_1 = require("./viewer-styles-sql-query-history");
const viewer_styles_trash_1 = require("./viewer-styles-trash");
const viewer_styles_about_1 = require("./viewer-styles-about");
const viewer_styles_crashlytics_1 = require("./viewer-styles-crashlytics");
const viewer_styles_recurring_1 = require("./viewer-styles-recurring");
const viewer_styles_performance_1 = require("./viewer-styles-performance");
const viewer_styles_insight_1 = require("./viewer-styles-insight");
const viewer_styles_ai_1 = require("./viewer-styles-ai");
const viewer_styles_run_separator_1 = require("./viewer-styles-run-separator");
const viewer_styles_ui_1 = require("./viewer-styles-ui");
const viewer_styles_replay_1 = require("./viewer-styles-replay");
const viewer_styles_root_cause_hints_1 = require("./viewer-styles-root-cause-hints");
const viewer_styles_toolbar_1 = require("./viewer-styles-toolbar");
const viewer_styles_filter_drawer_1 = require("./viewer-styles-filter-drawer");
const viewer_styles_lines_1 = require("./viewer-styles-lines");
const viewer_styles_ascii_art_1 = require("./viewer-styles-ascii-art");
function getViewerStyles() {
    return /* css */ `
/* Utility: hide element without inline style (CSP-friendly) */
.u-hidden { display: none !important; }

/* ===================================================================
   Reset & Root Layout
   The webview body is a flex row: icon bar + main content column.
   Default: icon bar on left (row-reverse). data-icon-bar=”right” flips it.
   The #main-content div contains the panel-content row (panels + log area)
   plus fixed-position overlays (context menus, modals).
   =================================================================== */
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace);
    font-size: var(--log-font-size, var(--vscode-editor-font-size, 13px));
    overflow: hidden;
    height: 100vh;
    display: flex;
    flex-direction: row-reverse;
    user-select: none; /* Confine native text selection to #viewport only */
}
body[data-icon-bar=”right”] { flex-direction: row; }
#viewport { user-select: text; }

#main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100vh;
    overflow: hidden;
}

/* ===================================================================
   Panel-Content Row
   Flex row containing the panel slot and log+footer area.
   Panel sits on the icon-bar side; log area (content + footer) takes remaining space.
   =================================================================== */
#panel-content-row {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
}
body[data-icon-bar=”right”] #panel-content-row {
    flex-direction: row-reverse;
}
#log-area-with-footer {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

/* ===================================================================
   Panel Slot
   Container for all slide-out panels. Width is 0 when no panel is
   open; animates to target width when a panel opens. Uses CSS grid
   to stack all panels in a single cell (only one visible at a time).
   =================================================================== */
#panel-slot {
    width: 0;
    flex-shrink: 0;
    overflow: hidden;
    transition: width 0.25s ease-out;
    position: relative;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    max-width: 70vw;
}
#panel-slot > * {
    grid-row: 1;
    grid-column: 1;
}
#panel-slot.open {
    overflow: visible;
}

/* ===================================================================
   Log Content Wrapper
   Flex row containing the scrollable log area and the minimap panel.
   =================================================================== */
#log-content-wrapper {
    --mm-w: 60px; /* minimap width — updated by JS when size changes */
    --scrollbar-w: 0; /* native vertical scrollbar width when showScrollbar is on */
    position: relative;
    flex: 1;
    min-height: 0;
    /* Flex row child: allow horizontal shrink so #log-content + minimap share width predictably */
    min-width: 0;
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: stretch;
}
body.scrollbar-visible #log-content-wrapper { --scrollbar-w: 10px; }

/* ===================================================================
   Log Content Area
   Main scrollable region. Vertical scrollbar is hidden because
   the minimap panel serves as the vertical-scroll replacement.
   Horizontal scrollbar is styled to match the VS Code theme.
   =================================================================== */
#log-content {
    flex: 1 1 0%;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    /* Horizontal scroll when lines use white-space: pre (banners, stacks) — same idea as the Debug Console wide line. */
    overflow-x: auto;
    overflow-anchor: none;
    padding: 4px 0 40px;
    position: relative;
    /* Vertical scrollbar hidden by ::-webkit-scrollbar width:0 below; horizontal stays 10px.
       Do NOT add scrollbar-width:none — Chromium 130+ treats it as authoritative and hides
       the horizontal bar too, making wide nowrap lines invisible on the right side. */
}
body.scrollbar-visible #log-content {
    scrollbar-width: auto; /* show both scrollbars when the user opts in */
}
#log-content::-webkit-scrollbar { width: 0; height: 10px; }
body.scrollbar-visible #log-content::-webkit-scrollbar { width: 10px; height: 10px; }
#log-content::-webkit-scrollbar-thumb {
    background: var(--vscode-scrollbarSlider-background);
    border-radius: 4px;
}
#log-content::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-hoverBackground);
}
#log-content::-webkit-scrollbar-track { background: transparent; }
` + (0, viewer_styles_lines_1.getLineStyles)() + (0, viewer_styles_ascii_art_1.getAsciiArtStyles)() + (0, viewer_styles_content_1.getContentStyles)() + (0, viewer_styles_n_plus_one_insight_1.getNPlusOneInsightStyles)() + (0, viewer_styles_sql_repeat_drilldown_1.getSqlRepeatDrilldownStyles)() + (0, viewer_styles_replay_1.getReplayStyles)() + (0, viewer_styles_components_1.getComponentStyles)() + (0, viewer_styles_overlays_1.getOverlayStyles)() + (0, viewer_styles_tags_1.getTagStyles)() + (0, viewer_styles_options_1.getOptionsStyles)() + (0, viewer_styles_errors_1.getErrorStyles)() + (0, viewer_styles_icon_bar_1.getIconBarStyles)() + (0, viewer_styles_session_1.getSessionPanelStyles)() + (0, viewer_styles_find_1.getFindPanelStyles)() + (0, viewer_styles_bookmarks_1.getBookmarkPanelStyles)() + (0, viewer_styles_sql_query_history_1.getSqlQueryHistoryPanelStyles)() + (0, viewer_styles_trash_1.getTrashPanelStyles)() + (0, viewer_styles_about_1.getAboutPanelStyles)() + (0, viewer_styles_crashlytics_1.getCrashlyticsPanelStyles)() + (0, viewer_styles_recurring_1.getRecurringPanelStyles)() + (0, viewer_styles_performance_1.getPerformancePanelStyles)() + (0, viewer_styles_insight_1.getInsightPanelStyles)() + (0, viewer_styles_ai_1.getAiStyles)() + (0, viewer_styles_run_separator_1.getRunSeparatorStyles)() + (0, viewer_styles_ui_1.getContextPopoverStyles)() + (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)() + (0, viewer_styles_toolbar_1.getToolbarStyles)() + (0, viewer_styles_filter_drawer_1.getFilterDrawerStyles)();
}
//# sourceMappingURL=viewer-styles.js.map