/**
 * CSS styles for the Crashlytics slide-out panel.
 * Includes setup wizard, issue cards, and diagnostic box styles.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */

import { getSetupStyles, getDiagnosticStyles } from './viewer-styles-crashlytics-setup';

/** Return CSS for the crashlytics panel and all its sub-components. */
export function getCrashlyticsPanelStyles(): string {
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
    padding: 9px 12px;
    cursor: pointer;
    font-size: 12px;
}

.cp-item:hover { background: var(--vscode-list-hoverBackground); }
/* Severity accent stripe so the list reads at a glance (color, #1). */
.cp-item-fatal { border-left: 3px solid var(--vscode-errorForeground); padding-left: 9px; }
.cp-item-nonfatal { border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700); padding-left: 9px; }
/* Typography hierarchy (UI #5): bold primary, muted metadata, room to breathe. */
.cp-title { font-weight: 600; font-size: 12.5px; line-height: 1.45; margin-bottom: 3px; }
.cp-meta { font-size: 11px; opacity: 0.65; line-height: 1.4; }

/* --- Compact sidebar filter bar (#5): icons/abbreviations for the narrow panel --- */
.cp-filterbar { border-bottom: 1px solid var(--vscode-panel-border); padding: 4px 8px; }
.cp-tabs { display: flex; gap: 2px; margin-bottom: 4px; }
.cp-tab { flex: 1; background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 3px; padding: 2px 0; font-size: 11px; cursor: pointer; opacity: 0.75; }
.cp-tab:hover { opacity: 1; }
.cp-tab.cp-tab-sel { opacity: 1; font-weight: 700; background: var(--vscode-button-secondaryBackground); border-color: var(--vscode-focusBorder); }
.cp-fcontrols { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.cp-search { flex: 1 1 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 3px; padding: 2px 6px; font-size: 11px; min-width: 80px; }
.cp-fselect { flex: 1 1 auto; min-width: 56px; max-width: 33%; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border)); border-radius: 3px; font-size: 11px; padding: 1px; }

/* Pill badges (UI #2/#3): soft tints + crisp borders via theme tokens, so they adapt to any theme. */
.cp-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.7em;
    padding: 1px 7px;
    border-radius: 9px;
    font-weight: 600;
    border: 1px solid transparent;
    vertical-align: middle;
}
.cp-badge-crash { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); }
.cp-badge-anr { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-editorWarning-foreground); border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground)); }
.cp-badge-nf { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.cp-badge-regression, .cp-badge-regressed { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); }
.cp-badge-closed { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.cp-badge-open { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }

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

/* ===================================================================
   In-viewer issue detail — fills the log area beside the sidebar list.
   Replaces the dropped editor-tab dashboard: clicking a sidebar issue
   shows its detail here (like a session opens in the log viewer).
   =================================================================== */
/* Full overlay over the whole log area (#log-area-with-footer is position:relative) so the log's
   toolbar / line-count / file path / footer do NOT bleed through behind the issue detail. */
/* z-index must beat the log toolbar (z-index:50) so "Log X of Y" / search / line-count / filename
   do not show above the issue detail (and so the detail's own header + Copy button are visible). */
.crashlytics-detail { position: absolute; inset: 0; z-index: 200; display: flex; flex-direction: column; overflow: hidden; background: var(--vscode-editor-background); }
.crashlytics-detail.u-hidden { display: none; }
.cd-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 2px solid var(--vscode-focusBorder); background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
.cd-title { font-weight: 600; font-size: 13px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cd-back, .cd-copy {
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    border: none; border-radius: 3px; padding: 3px 10px; font-size: 12px; cursor: pointer; flex: none;
}
.cd-back:hover, .cd-copy:hover { background: var(--vscode-button-secondaryHoverBackground); }
.cd-body { flex: 1; overflow-y: auto; padding: 8px 12px; }
.cd-loading { padding: 16px; opacity: 0.7; animation: cp-pulse 1.5s ease-in-out infinite; }
.cp-item.cp-selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }

/* Codebase context streamed under an app frame (source line + git blame) — #8 made visible in-viewer. */
.cd-frame-ctx { margin: 1px 0 6px 22px; padding: 3px 6px; border-left: 2px solid var(--vscode-panel-border); }
.cd-frame-code { display: block; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; white-space: pre-wrap; word-break: break-all; }
.cd-frame-blame { display: block; font-size: 10px; opacity: 0.7; margin-top: 2px; color: var(--vscode-gitDecoration-modifiedResourceForeground, var(--vscode-descriptionForeground)); }

/* Device / OS distribution bars (renderDeviceDistribution output) — were dashboard-only; restored
   here so the in-viewer detail shows colored bars instead of plain text. */
/* Colorize the whole detail (#1), not just the stack: device meta, section headers, keys, and the
   app-vs-framework distinction all get color so the eye lands on what matters. */
.cd-body .crash-device-meta { font-size: 11px; margin: 0 0 8px; color: var(--vscode-charts-blue, var(--vscode-foreground)); }
.cd-body .crash-thread-header { font-weight: 600; font-size: 12px; margin: 10px 0 4px; padding-left: 6px; border-left: 3px solid var(--vscode-errorForeground); }
.cd-body .group-header { color: var(--vscode-textLink-foreground); font-weight: 600; cursor: pointer; }
.cd-body .group-header .match-count { color: var(--vscode-descriptionForeground); font-weight: 400; }
.cd-body .frame-badge { font-size: 9px; padding: 0 4px; border-radius: 3px; margin-right: 6px; font-weight: 700; }
.cd-body .frame-badge-app { background: var(--vscode-charts-blue, #4daafc); color: var(--vscode-editor-background); }
.cd-body .frame-badge-fw { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); opacity: 0.7; }
.cd-body .frame-app .line-text, .cd-body .frame-app-nosrc .line-text { color: var(--vscode-foreground); }
.cd-body .frame-fw { opacity: 0.55; }
.cd-body .frame-app[data-frame-file] { cursor: pointer; }
.cd-body .frame-app[data-frame-file]:hover { background: var(--vscode-list-hoverBackground); }
.cd-body .crash-key-name { color: var(--vscode-symbolIcon-propertyForeground, var(--vscode-foreground)); }
.crash-dist-label { font-weight: 600; font-size: 11px; margin: 8px 0 4px; opacity: 0.85; }
.crash-dist-row { display: flex; align-items: center; gap: 8px; font-size: 11px; margin: 3px 0; }
.crash-dist-name { width: 140px; flex: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crash-dist-bar-bg { flex: 1; height: 9px; background: var(--vscode-panel-border); border-radius: 5px; overflow: hidden; }
/* Rounded, subtly-gradient accent bar (UI #1). */
.crash-dist-bar-fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, var(--vscode-charts-blue, #0e70c0), var(--vscode-progressBar-background, #4daafc)); }
.crash-dist-count { width: 76px; flex: none; text-align: right; opacity: 0.8; }

` + getSetupStyles() + getDiagnosticStyles();
}
