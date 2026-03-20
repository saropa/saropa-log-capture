/**
 * CSS styles for overlay and popup elements in the viewer webview.
 *
 * Covers split breadcrumb, JSON collapsible blocks, and context menu.
 * Decoration and modal styles are in separate modules.
 */
import { getDecorationStyles } from './viewer-styles-decoration';
import { getModalStyles } from './viewer-styles-modal';

export function getOverlayStyles(): string {
    return getDecorationStyles() + getModalStyles() + /* css */ `

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
    max-height: 88px;
}
.session-nav-wrapper.smart-header-hidden.has-content {
    max-height: 0;
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
    gap: 4px;
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
#split-breadcrumb button, #session-nav button, #run-nav button {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}
#split-breadcrumb button:hover, #session-nav button:hover, #run-nav button:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
#split-breadcrumb button:disabled, #session-nav button:disabled, #run-nav button:disabled {
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

/* ===================================================================
   Context Menu
   Right-click menu for log lines. Provides actions like copy,
   pin, exclude, search codebase, etc.
   =================================================================== */
.context-menu {
    display: none;
    position: fixed;
    z-index: 200;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 160px;
    width: max-content;
    padding: 4px 0;
    white-space: nowrap;
}
@keyframes menu-pop-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.context-menu.visible { display: block; animation: menu-pop-in 0.12s ease-out; }
.context-menu-item {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
}
.context-menu-item:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.context-menu-item .codicon {
    font-size: 14px;
    opacity: 0.8;
}
.context-menu-separator {
    height: 1px;
    background: var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
    margin: 4px 8px;
}

/* --- Submenu trigger row --- */
.context-menu-submenu {
    position: relative;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
}
.context-menu-submenu:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.context-menu-submenu .codicon { font-size: 14px; opacity: 0.8; }
.context-menu-arrow { margin-left: auto; font-size: 12px !important; opacity: 0.6; }

/* --- Submenu flyout panel --- */
.context-menu-submenu-content {
    display: none;
    position: absolute;
    left: 100%;
    top: 0;
    z-index: 201;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 160px;
    width: max-content;
    padding: 4px 0;
    white-space: nowrap;
}
.context-menu-submenu:hover > .context-menu-submenu-content { display: block; }
/* Flip submenus left when context menu is near right viewport edge */
.context-menu.flip-submenu .context-menu-submenu-content { left: auto; right: 100%; }
/* When menu is near top, push submenu content down so top is not cropped (e.g. terminal tab bar, toolbar). */
.context-menu.flip-submenu-vertical-top .context-menu-submenu-content {
    top: var(--submenu-content-top, 0);
    bottom: auto;
}
/* Near bottom only: align submenu bottom with trigger so flyout opens upward. Must not apply when
   flip-submenu-vertical-top is also set — short panels often need both JS flags, and the top offset must win. */
.context-menu.flip-submenu-vertical:not(.flip-submenu-vertical-top) .context-menu-submenu-content { top: auto; bottom: 0; }

/* --- Toggle items (checkmark + label) --- */
.context-menu-toggle .context-menu-check { font-size: 14px; opacity: 0; }
.context-menu-toggle.checked .context-menu-check { opacity: 0.8; }
`;
}
