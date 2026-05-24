/**
 * Styles for the App Quality Insights editor-tab dashboard.
 *
 * A 3-pane grid (issues | detail | breakdown) under a toolbar, matching Android Studio's
 * App Quality Insights layout. Includes a focused subset of the crash-detail / distribution classes
 * so the reused `renderCrashDetail` / `renderDeviceDistribution` HTML renders correctly in this
 * standalone webview (which does not load the main viewer stylesheet).
 */

/** All CSS for the dashboard webview. */
export function getDashboardStyles(): string {
    return /* css */ `
:root { color-scheme: light dark; }
body { margin: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
.aqi-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); flex-wrap: wrap; }
.aqi-title { font-weight: 600; font-size: 1.1em; }
.aqi-pkg { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; opacity: 0.7; }
.aqi-spacer { flex: 1; }
.aqi-toolbar select, .aqi-btn {
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-panel-border); border-radius: 3px; padding: 3px 8px; font-size: 12px; cursor: pointer;
}
.aqi-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
.aqi-note { font-size: 11px; opacity: 0.6; }
.aqi-stale { opacity: 1; color: var(--vscode-editorWarning-foreground, #cca700); }
.aqi-link { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; font-size: 12px; }
.aqi-link:hover { text-decoration: underline; }

/* Source/type tabs + filters row. */
.aqi-filterbar { display: flex; align-items: center; gap: 10px; padding: 5px 12px; border-bottom: 1px solid var(--vscode-panel-border); flex-wrap: wrap; }
.aqi-tabs { display: flex; gap: 2px; }
.aqi-tab { background: transparent; color: var(--vscode-foreground); border: none; border-bottom: 2px solid transparent; padding: 4px 10px; font-size: 12px; cursor: pointer; opacity: 0.75; }
.aqi-tab:hover { opacity: 1; }
.aqi-tab.selected { opacity: 1; font-weight: 600; border-bottom-color: var(--vscode-focusBorder); }
.aqi-tab-count { opacity: 0.6; font-weight: 400; font-size: 11px; }
.aqi-search { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 3px; padding: 3px 8px; font-size: 12px; min-width: 180px; }

/* 3-pane layout fills the viewport below the toolbar + filter bar. */
.aqi-grid { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(360px, 1.6fr) minmax(220px, 0.9fr); height: calc(100vh - 84px); }
.aqi-pane { overflow: auto; padding: 8px 10px; }
.aqi-pane + .aqi-pane { border-left: 1px solid var(--vscode-panel-border); }
.aqi-pane-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; margin: 2px 0 8px; }

/* Issues list */
.aqi-issue { padding: 6px 8px; border-radius: 4px; cursor: pointer; border: 1px solid transparent; }
.aqi-issue:hover { background: var(--vscode-list-hoverBackground); }
.aqi-issue.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); border-color: var(--vscode-focusBorder); }
.aqi-issue-head { display: flex; align-items: center; gap: 6px; }
.aqi-sev { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.aqi-sev-fatal { background: var(--vscode-errorForeground); }
.aqi-sev-nonfatal { background: var(--vscode-editorWarning-foreground, #cca700); }
.aqi-issue-title { font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aqi-issue-sub { font-size: 11px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 15px; }
.aqi-issue-meta { font-size: 11px; opacity: 0.8; margin-left: 15px; }
.aqi-issue-meta b { font-weight: 600; }

.aqi-empty { opacity: 0.6; font-size: 12px; padding: 12px 4px; }
.aqi-setup { padding: 16px; max-width: 520px; }
.aqi-setup h2 { font-size: 1.1em; }
.aqi-setup code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 2px; font-family: var(--vscode-editor-font-family); }

/* Detail header */
.aqi-detail-head { margin-bottom: 8px; }
.aqi-detail-title { font-weight: 600; font-size: 13px; }
.aqi-detail-meta { font-size: 11px; opacity: 0.8; margin-top: 2px; }
.aqi-badge { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-right: 4px; }
.aqi-badge-fatal { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); }
.aqi-badge-nonfatal { background: var(--vscode-inputValidation-warningBackground); }

/* --- reused crash-detail / distribution classes (subset) --- */
.crash-device-meta { font-size: 11px; opacity: 0.8; margin: 4px 0 8px; }
.crash-thread-header { font-weight: 600; font-size: 12px; margin: 8px 0 4px; }
.stack-frame { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; padding: 1px 0; white-space: pre-wrap; word-break: break-all; }
.frame-app { color: var(--vscode-foreground); }
.frame-app-nosrc, .frame-framework { opacity: 0.6; }
.frame-badge { font-size: 9px; padding: 0 4px; border-radius: 3px; margin-right: 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.group { margin: 8px 0; }
.group-header { cursor: pointer; font-weight: 600; font-size: 12px; }
.match-count { opacity: 0.6; font-weight: 400; }
.crash-keys-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.crash-key-name { font-weight: 600; padding: 2px 8px 2px 0; vertical-align: top; }
.crash-log-entry { font-size: 11px; padding: 1px 0; }
.crash-log-ts { opacity: 0.6; }
.no-matches { opacity: 0.6; font-size: 12px; }

/* Codebase enrichment shown under an app frame: the source line + git blame. */
.aqi-frame-ctx { margin: 1px 0 6px 22px; padding: 3px 6px; border-left: 2px solid var(--vscode-panel-border); }
.aqi-frame-code { display: block; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; white-space: pre-wrap; word-break: break-all; color: var(--vscode-foreground); }
.aqi-frame-blame { display: block; font-size: 10px; opacity: 0.7; margin-top: 2px; }
.crash-dist-label { font-weight: 600; font-size: 11px; margin: 8px 0 4px; }
.crash-dist-row { display: flex; align-items: center; gap: 6px; font-size: 11px; margin: 2px 0; }
.crash-dist-name { width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crash-dist-bar-bg { flex: 1; height: 8px; background: var(--vscode-panel-border); border-radius: 4px; overflow: hidden; }
.crash-dist-bar-fill { height: 100%; background: var(--vscode-progressBar-background, #0e70c0); }
.crash-dist-count { width: 72px; text-align: right; opacity: 0.8; }
.aqi-breakdown-agg { font-size: 11px; }
.aqi-most { margin-top: 8px; font-size: 11px; opacity: 0.8; font-style: italic; }
`;
}
