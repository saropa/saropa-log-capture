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
/* WHY user-select:text on .ab-changelog and its descendants: the global body
   rule sets user-select:none to confine native selection to #viewport; without
   re-enabling it here, users can't drag-select the formatted changelog. The
   cursor:text reinforces the affordance. */
.ab-changelog { margin-bottom: 8px; overflow-y: auto; font-size: 11px; line-height: 1.4; user-select: text; -webkit-user-select: text; cursor: text; }
.ab-changelog, .ab-changelog * { user-select: text; -webkit-user-select: text; }
.ab-changelog-loading { opacity: 0.6; }
/* --- Inline markdown rendering inside .ab-changelog --- */
.ab-md-h { font-weight: 700; margin: 8px 0 4px 0; line-height: 1.3; }
.ab-md-h1 { font-size: 1.35em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 2px; }
.ab-md-h2 { font-size: 1.2em; }
.ab-md-h3 { font-size: 1.08em; }
.ab-md-h4, .ab-md-h5, .ab-md-h6 { font-size: 1em; opacity: 0.9; }
.ab-md-hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 8px 0; height: 0; display: block; }
.ab-md-ul { padding-left: 18px; margin: 4px 0; list-style: disc; }
.ab-md-ul li { margin: 1px 0; }
.ab-md-bq { border-left: 2px solid var(--vscode-panel-border); padding-left: 8px; margin: 4px 0; opacity: 0.85; }
.ab-md-p { margin: 2px 0; }
.ab-md-code { font-family: var(--vscode-editor-font-family, monospace); background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.12)); padding: 0 4px; border-radius: 3px; font-size: 0.92em; }
.ab-md-link { color: var(--vscode-textLink-foreground); text-decoration: underline; }
.ab-changelog-link { display: inline-block; color: var(--vscode-textLink-foreground); font-size: 11px; margin-bottom: 4px; }
.ab-changelog-link:hover { text-decoration: underline; }
.ab-tagline { font-weight: 600; font-style: italic; opacity: 0.9; margin: 0 0 6px 0; font-size: 0.95em; }
.ab-blurb { opacity: 0.8; margin: 0 0 16px 0; font-size: 0.9em; }
.ab-section { font-weight: 600; font-size: 1.05em; margin-bottom: 8px; margin-top: 12px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
.ab-link { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; }
.ab-link:hover { background: var(--vscode-list-hoverBackground); }
.ab-link-icon { font-size: 1.2em; flex-shrink: 0; margin-top: 1px; }
.ab-link-title { display: block; color: var(--vscode-textLink-foreground); font-weight: 500; }
.ab-link-badge { display: block; font-size: 0.8em; opacity: 0.6; margin-top: 1px; }
.ab-link-desc { display: block; font-size: 0.85em; opacity: 0.8; margin-top: 2px; line-height: 1.35; }
`;
}
