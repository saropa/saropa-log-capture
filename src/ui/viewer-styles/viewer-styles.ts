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
import { getContentStyles } from './viewer-styles-content';
import { getNPlusOneInsightStyles } from './viewer-styles-n-plus-one-insight';
import { getSqlRepeatDrilldownStyles } from './viewer-styles-sql-repeat-drilldown';
import { getComponentStyles } from './viewer-styles-components';
import { getOverlayStyles } from './viewer-styles-overlays';
import { getTagStyles } from './viewer-styles-tags';
import { getOptionsStyles } from './viewer-styles-options';
import { getErrorStyles } from './viewer-styles-errors';
import { getIconBarStyles } from './viewer-styles-icon-bar';
import { getSessionPanelStyles } from './viewer-styles-session';
import { getFindPanelStyles } from './viewer-styles-find';
import { getBookmarkPanelStyles } from './viewer-styles-bookmarks';
import { getSqlQueryHistoryPanelStyles } from './viewer-styles-sql-query-history';
import { getTrashPanelStyles } from './viewer-styles-trash';
import { getAboutPanelStyles } from './viewer-styles-about';
import { getCrashlyticsPanelStyles } from './viewer-styles-crashlytics';
import { getRecurringPanelStyles } from './viewer-styles-recurring';
import { getPerformancePanelStyles } from './viewer-styles-performance';
import { getInsightPanelStyles } from './viewer-styles-insight';
import { getAiStyles } from './viewer-styles-ai';
import { getRunSeparatorStyles } from './viewer-styles-run-separator';
import { getContextPopoverStyles } from './viewer-styles-ui';
import { getReplayStyles } from './viewer-styles-replay';
import { getRootCauseHypothesesStyles } from './viewer-styles-root-cause-hints';
import { getToolbarStyles } from './viewer-styles-toolbar';
import { getFilterDrawerStyles } from './viewer-styles-filter-drawer';
import { getLineStyles } from './viewer-styles-lines';

export function getViewerStyles(): string {
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
` + getLineStyles() + getContentStyles() + getNPlusOneInsightStyles() + getSqlRepeatDrilldownStyles() + getReplayStyles() + getComponentStyles() + getOverlayStyles() + getTagStyles() + getOptionsStyles() + getErrorStyles() + getIconBarStyles() + getSessionPanelStyles() + getFindPanelStyles() + getBookmarkPanelStyles() + getSqlQueryHistoryPanelStyles() + getTrashPanelStyles() + getAboutPanelStyles() + getCrashlyticsPanelStyles() + getRecurringPanelStyles() + getPerformancePanelStyles() + getInsightPanelStyles() + getAiStyles() + getRunSeparatorStyles() + getContextPopoverStyles() + getRootCauseHypothesesStyles() + getToolbarStyles() + getFilterDrawerStyles();
}
