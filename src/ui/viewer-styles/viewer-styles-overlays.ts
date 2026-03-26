/**
 * CSS styles for overlay and popup elements in the viewer webview.
 *
 * Covers split breadcrumb, JSON collapsible blocks, and context menu.
 * Decoration and modal styles are in separate modules.
 */
import { getContextMenuStyles } from './viewer-styles-context-menu';
import { getDecorationStyles } from './viewer-styles-decoration';
import { getModalStyles } from './viewer-styles-modal';

export function getOverlayStyles(): string {
    return getDecorationStyles() + getModalStyles() + getContextMenuStyles() + /* css */ `

/* ===================================================================
   Navigation Bars (Split Breadcrumb + Session Nav)
   Shared styles for the split-part breadcrumb and session prev/next
   navigation bar. Both use the same layout and button styling.
   =================================================================== */
/* Session nav wrapper: collapsed by default; expands when .has-content; scroll-up-reveal hides via .smart-header-hidden */
.session-nav-wrapper {
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.session-nav-wrapper.has-content {
    /* Two rows when session nav wraps (log controls + full-width search strip). */
    max-height: 120px;
}
/* Suggestion row below session nav when many consecutive duplicate lines are detected */
.session-nav-wrapper.has-content.compress-suggest-visible {
    max-height: 162px;
}
.session-nav-wrapper.smart-header-hidden.has-content {
    max-height: 0;
}
.compress-suggest-banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 4px 8px 6px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--vscode-foreground);
    background: var(--vscode-inputValidation-infoBackground, rgba(55, 148, 255, 0.12));
    border-top: 1px solid var(--vscode-inputValidation-infoBorder, var(--vscode-focusBorder));
}
.compress-suggest-msg {
    flex: 1 1 180px;
    min-width: 0;
}
.compress-suggest-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    padding: 2px 10px;
    font-size: 11px;
    cursor: pointer;
}
.compress-suggest-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.compress-suggest-dismiss {
    background: transparent;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    border-radius: 2px;
}
.compress-suggest-dismiss:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground);
}
.session-details-inline {
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid var(--vscode-panel-border);
    min-width: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
}
.session-perf-chip {
    margin-left: 8px;
    padding: 2px 6px;
    font-size: 10px;
    color: var(--vscode-textLink-foreground, #3794ff);
    background: var(--vscode-textLinkActiveBackground, rgba(55, 148, 255, 0.2));
    border: 1px solid var(--vscode-textLink-foreground, #3794ff);
    border-radius: 3px;
    cursor: pointer;
}
.session-perf-chip:hover {
    text-decoration: underline;
}
#split-breadcrumb, #session-nav {
    display: none;
    align-items: center;
    flex-wrap: wrap;
    row-gap: 4px;
    column-gap: 4px;
    padding: 2px 8px;
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
#session-nav-wrapper.has-content #session-nav { display: flex; }
.session-nav-controls { display: none; align-items: center; gap: 4px; }
#session-nav.visible .session-nav-controls { display: flex; }
#split-breadcrumb.visible { display: flex; }
#run-nav {
    display: none;
    align-items: center;
    gap: 4px;
}
#run-nav.visible { display: flex; }
.nav-bar-sep {
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
    margin: 0 2px;
    user-select: none;
}
.nav-bar-label { font-weight: bold; }
/* Only prev/next (and run nav inside the same strip)—not the compact find widget or perf chip. */
#split-breadcrumb button,
#session-nav .session-nav-controls button,
#run-nav button {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}
/* Icon-only session log prev/next (chevrons); tooltips carry the full phrase. */
#session-nav .session-nav-controls button.session-nav-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    min-width: 22px;
    padding: 0;
    box-sizing: border-box;
}
#session-nav .session-nav-controls button.session-nav-icon-btn .codicon {
    font-size: 16px;
}
#split-breadcrumb button:hover,
#session-nav .session-nav-controls button:hover,
#run-nav button:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
#split-breadcrumb button:disabled,
#session-nav .session-nav-controls button:disabled,
#run-nav button:disabled {
    opacity: 0.4;
    cursor: default;
}

/* ===================================================================
   JSON Collapsible Blocks
   Inline expandable JSON objects in log output. Toggle between
   a compact one-line preview and full formatted expansion.
   =================================================================== */
.json-collapsible { display: inline; }
.json-toggle {
    cursor: pointer;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-family: sans-serif;
    font-size: 10px;
    padding: 0 4px;
    user-select: none;
}
.json-toggle:hover { color: var(--vscode-textLink-activeForeground, #3794ff); }
/* Collapsed: shows truncated preview text */
.json-preview {
    color: var(--vscode-descriptionForeground);
    font-size: 0.95em;
}
/* Expanded: full formatted JSON in a quote block */
.json-expanded {
    display: block;
    margin: 4px 0 4px 16px;
    padding: 4px 8px;
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
    border-left: 2px solid var(--vscode-textBlockQuote-border, #007acc);
    font-size: 0.95em;
    line-height: 1.4;
    white-space: pre;
    overflow-x: auto;
}
.json-expanded.hidden { display: none; }
.json-preview.hidden { display: none; }
`;
}
