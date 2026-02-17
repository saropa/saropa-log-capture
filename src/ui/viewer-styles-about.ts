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
    position: fixed;
    left: -100%;
    top: 0;
    bottom: 0;
    width: 30%;
    min-width: 280px;
    max-width: 420px;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    transition: left 0.15s ease;
    z-index: 240;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: none;
}

.about-panel.visible {
    left: var(--icon-bar-width, 36px);
    pointer-events: auto;
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
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.about-panel-close:hover { color: var(--vscode-errorForeground, #f44); }

.about-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.4;
}

/* --- About panel content styles --- */
.ab-header { font-size: 1.4em; font-weight: 700; margin-bottom: 8px; }
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
