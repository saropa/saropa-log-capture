/**
 * CSS styles for the About Saropa slide-out panel.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */

/** Return CSS for the about panel and its content. */
export function getAboutPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   About Panel — slide-out (same pattern as trash/bookmark panels)
   =================================================================== */
.about-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.about-panel.visible {
    display: flex;
}

.about-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.about-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.about-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.about-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.4;
}

/* --- About panel content styles --- */
/* WHY cursor:pointer + user-select:none: this row is the long-press copy target,
   so we suppress text drag (it would compete with the press timer) and hint the
   gesture. The opacity dip during press is the only feedback users get before
   the toast fires at 500 ms, so keep it visible. */
.ab-version-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; cursor: pointer; user-select: none; -webkit-user-select: none; transition: opacity 0.1s ease; }
.ab-version-row.ab-title-pressing { opacity: 0.55; }
.ab-version-label { font-size: 1.1em; font-weight: 700; }
.ab-version-badge { font-size: 0.9em; font-weight: 500; color: var(--vscode-descriptionForeground); }
.ab-changelog-link { display: inline-block; color: var(--vscode-textLink-foreground); font-size: 11px; margin: 2px 0 4px 0; cursor: pointer; }
.ab-changelog-link:hover { text-decoration: underline; }
.ab-tagline { font-weight: 600; font-style: italic; opacity: 0.9; margin: 0 0 6px 0; font-size: 0.95em; }
.ab-blurb { opacity: 0.8; margin: 0 0 16px 0; font-size: 0.9em; }
/* Section header is now a collapse/expand toggle. cursor:pointer + user-select:none so the
   click doesn't start a text selection. The chevron flips via codicon class swap in script. */
.ab-section { font-weight: 600; font-size: 1.05em; margin-bottom: 8px; margin-top: 12px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
.ab-section-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; -webkit-user-select: none; }
.ab-section-toggle:hover { color: var(--vscode-textLink-foreground); }
.ab-section-chevron { font-size: 0.9em; opacity: 0.8; flex-shrink: 0; }
/* Collapsed body is fully removed from flow (not just hidden) so the sections stack tightly. */
.ab-section-body-hidden { display: none; }
/* --- Debug section: meta files/folders the extension uses --- */
.ab-debug-loading { opacity: 0.6; font-size: 0.9em; }
.ab-debug-row { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.ab-debug-row:hover { background: var(--vscode-list-hoverBackground); border-color: var(--vscode-panel-border); }
.ab-debug-label { font-weight: 600; display: flex; align-items: center; gap: 5px; }
.ab-debug-state { font-weight: 500; font-size: 0.8em; padding: 0 5px; border-radius: 8px; }
.ab-debug-present { color: var(--vscode-testing-iconPassed, #3fb950); background: rgba(63, 185, 80, 0.12); }
.ab-debug-missing { color: var(--vscode-list-warningForeground, #d29922); background: rgba(210, 153, 34, 0.14); }
.ab-debug-usage { font-size: 0.85em; opacity: 0.8; line-height: 1.35; }
.ab-debug-path { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.8em; opacity: 0.65; word-break: break-all; }
.ab-link { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; }
.ab-link:hover { background: var(--vscode-list-hoverBackground); }
.ab-link-icon { font-size: 1.2em; flex-shrink: 0; margin-top: 1px; }
.ab-link-title { display: block; color: var(--vscode-textLink-foreground); font-weight: 500; }
.ab-link-badge { display: block; font-size: 0.8em; opacity: 0.6; margin-top: 1px; }
.ab-link-desc { display: block; font-size: 0.85em; opacity: 0.8; margin-top: 2px; line-height: 1.35; }
`;
}
