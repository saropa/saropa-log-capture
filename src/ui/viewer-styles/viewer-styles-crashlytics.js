"use strict";
/**
 * CSS styles for the Crashlytics slide-out panel.
 * Includes setup wizard, issue cards, and diagnostic box styles.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCrashlyticsPanelStyles = getCrashlyticsPanelStyles;
const viewer_styles_crashlytics_setup_1 = require("./viewer-styles-crashlytics-setup");
/** Return CSS for the crashlytics panel and all its sub-components. */
function getCrashlyticsPanelStyles() {
    return /* css */ `

/* ===================================================================
   Crashlytics Panel — slide-out
   =================================================================== */
.crashlytics-panel {
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

.crashlytics-panel.visible {
    display: flex;
}

.crashlytics-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.crashlytics-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.crashlytics-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.crashlytics-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.crashlytics-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.crashlytics-panel-close:hover { color: var(--vscode-errorForeground, #f44); }

.crashlytics-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}

/* --- Issue cards --- */
.cp-item {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
}

.cp-item:hover { background: var(--vscode-list-hoverBackground); }
.cp-title { font-weight: 600; margin-bottom: 2px; }
.cp-meta { font-size: 0.9em; opacity: 0.8; }

.cp-badge {
    font-size: 0.7em;
    padding: 1px 4px;
    border-radius: 2px;
    font-weight: 700;
    vertical-align: middle;
}

.cp-badge-fatal { background: #d32f2f; color: #fff; }
.cp-badge-nonfatal { background: #f9a825; color: #000; }
.cp-badge-regression, .cp-badge-regressed { background: #d32f2f; color: #fff; }
.cp-badge-closed { background: #388e3c; color: #fff; }
.cp-badge-open { background: #757575; color: #fff; }

.cp-actions { display: flex; gap: 4px; margin-top: 4px; }

.cp-action-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
}

.cp-action-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

.cp-console {
    padding: 8px 12px;
    text-align: center;
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
    font-size: 12px;
}

.cp-console:hover { text-decoration: underline; }

.cp-empty { padding: 16px 12px; opacity: 0.7; font-style: italic; text-align: center; font-size: 12px; }
.cp-error { color: var(--vscode-errorForeground); font-size: 0.9em; padding: 6px 12px; }

/* --- Crash detail (loaded into issue card) --- */
.cp-detail { overflow: hidden; max-height: 0; transition: max-height 0.3s ease; }
.cp-detail.expanded { max-height: 2000px; padding: 4px 0; border-top: 1px solid var(--vscode-panel-border); }
.cp-detail-loading {
    padding: 6px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    animation: cp-pulse 1.5s ease-in-out infinite;
}

@keyframes cp-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }

.cp-expand-icon { float: right; font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.2s; }
.cp-item.detail-open .cp-expand-icon { transform: rotate(90deg); }

/* --- Loading state --- */
.crashlytics-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    animation: cp-pulse 1.5s ease-in-out infinite;
}

/* --- Refresh note --- */
.cp-refresh-note { font-weight: normal; font-size: 0.85em; opacity: 0.6; margin-left: 4px; }

` + (0, viewer_styles_crashlytics_setup_1.getSetupStyles)() + (0, viewer_styles_crashlytics_setup_1.getDiagnosticStyles)();
}
//# sourceMappingURL=viewer-styles-crashlytics.js.map