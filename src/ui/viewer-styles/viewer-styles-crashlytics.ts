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
/* Search shares a row with the regex toggle (flex-basis < 100% so the button does not wrap alone);
   the version/device/OS selects wrap to the next row as before. */
.cp-search { flex: 1 1 70%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 3px; padding: 2px 6px; font-size: 11px; min-width: 80px; }
/* Regex toggle (#2 advanced search): monospace .* glyph; pressed state borrows the focus accent. */
.cp-regex { flex: 0 0 auto; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 3px; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; padding: 2px 6px; cursor: pointer; opacity: 0.7; }
.cp-regex:hover { opacity: 1; }
.cp-regex.cp-regex-on { opacity: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-focusBorder); }
/* Invalid regex pattern: red outline so the user knows the filter is not applied. */
.cp-search.cp-search-invalid { border-color: var(--vscode-errorForeground); }
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
.cp-badge-repetitive { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-editorWarning-foreground); border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground)); }
.cp-archive-btn { background: transparent; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; padding: 0 4px; opacity: 0; flex: 0 0 auto; }
.cp-item:hover .cp-archive-btn, .cp-item.cp-item-archived .cp-archive-btn { opacity: 0.85; }
.cp-archive-btn:hover { color: var(--vscode-foreground); }
.cp-item-archived { opacity: 0.55; }

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
/* "View on Firebase" link (#3): the project console opens in the browser. Icon-only to stay compact. */
.cd-console-link { margin-left: 6px; color: var(--vscode-textLink-foreground); text-decoration: none; font-size: 12px; cursor: pointer; }
.cd-console-link:hover { text-decoration: underline; }

/* Dashboard stat cards (#4 / #5 first slice): the issue's severity + counts + state + versions read at
   a glance instead of living only in the copied Markdown. Cards wrap on a narrow overlay. */
.cd-stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 2px 0 12px; }
.cd-stat { background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background)); border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 6px 12px; min-width: 64px; }
.cd-stat-val { display: block; font-size: 15px; font-weight: 700; line-height: 1.2; }
.cd-stat-label { display: block; font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
.cd-sev-crash { color: var(--vscode-errorForeground); }
.cd-sev-anr { color: var(--vscode-editorWarning-foreground, #cca700); }
.cd-sev-nf { color: var(--vscode-descriptionForeground); }
.cd-back, .cd-copy, .cd-newissue {
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    border: none; border-radius: 3px; padding: 3px 10px; font-size: 12px; cursor: pointer; flex: none;
}
.cd-back:hover, .cd-copy:hover, .cd-newissue:hover { background: var(--vscode-button-secondaryHoverBackground); }
/* Dashboard grid (#5 full layout): small data panels tile into columns as cards; the stack, stats
   strip, device line, and thread headers span the full width. auto-fit collapses to one column on a
   narrow overlay, and streamed-in panels (.cd-tile) slot into the grid as they arrive. */
.cd-body { flex: 1; overflow-y: auto; padding: 8px 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; align-content: start; }
.cd-body > * { grid-column: 1 / -1; min-width: 0; }
.cd-body > .cd-tile { grid-column: span 1; }
.cd-body > .group { background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background)); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 6px 10px; }
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
/* Per-frame line numbers (#1a), hover copy (#1b), app-only filter (#1d) in the crash stack. */
.cd-body .stack-frame { position: relative; }
.cd-body .frame-num { color: var(--vscode-descriptionForeground); opacity: 0.5; font-family: var(--vscode-editor-font-family, monospace); font-size: 10px; margin-right: 6px; }
.cd-body .cd-frame-copy { position: absolute; right: 4px; top: 1px; opacity: 0; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; font-size: 11px; padding: 0 5px; cursor: pointer; }
.cd-body .stack-frame:hover .cd-frame-copy { opacity: 0.8; }
.cd-body .cd-frame-copy:hover { opacity: 1; }
/* Plan 054 5b: ↻×N badge on a frame that stands in for a run of identical (recursive) frames. */
.cd-body .frame-repeat { margin-left: 8px; padding: 0 5px; border-radius: 3px; font-size: 10px; font-weight: 700; color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); }
/* Plan 054 5b: Other-Threads grouping — ×N badge for collapsed identical threads, sibling names, overflow. */
.cd-body .cd-thread-count { padding: 0 5px; border-radius: 3px; font-size: 10px; font-weight: 700; color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); }
.cd-body .crash-thread-names { font-size: 10px; color: var(--vscode-descriptionForeground); margin: 0 0 4px 6px; }
.cd-body .crash-thread-more { font-size: 11px; color: var(--vscode-descriptionForeground); margin: 6px 0 0 6px; font-style: italic; }
.cd-stack-controls { margin: 2px 0 4px; }
.cd-apponly { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 3px; font-size: 11px; padding: 1px 8px; cursor: pointer; opacity: 0.8; }
.cd-apponly:hover { opacity: 1; }
.cd-apponly.cd-apponly-on { opacity: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-focusBorder); }
/* App-only mode hides framework rows and their folded groups. */
.cd-body.cd-appcode-only .frame-fw, .cd-body.cd-appcode-only .cd-fw-group { display: none; }

/* Frame right-click context menu (#1c). z-index beats the detail overlay (200); position:fixed so it
   escapes the overlay's overflow:hidden. */
.cd-ctxmenu { position: fixed; z-index: 300; min-width: 160px; padding: 4px 0; font-size: 12px; border-radius: 4px; background: var(--vscode-menu-background, var(--vscode-editorWidget-background)); border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border)); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); }
.cd-ctxmenu.u-hidden { display: none; }
.cd-ctxitem { padding: 4px 14px; cursor: pointer; color: var(--vscode-menu-foreground, var(--vscode-foreground)); white-space: nowrap; }
.cd-ctxitem:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground)); color: var(--vscode-menu-selectionForeground, var(--vscode-foreground)); }

/* Folded framework-frame run (#1 smart collapse): a quiet, dashed inline disclosure so the
   noise stays one click away without competing with the app frames it sits between. */
.cd-body .cd-fw-group { margin: 2px 0; }
.cd-body .cd-fw-summary {
    cursor: pointer; font-size: 11px; opacity: 0.6; padding: 1px 0 1px 22px;
    color: var(--vscode-descriptionForeground); list-style: none;
}
.cd-body .cd-fw-summary:hover { opacity: 0.95; }
.cd-body .cd-fw-group[open] > .cd-fw-summary { opacity: 0.85; margin-bottom: 2px; }
.cd-body .crash-key-name { color: var(--vscode-symbolIcon-propertyForeground, var(--vscode-foreground)); }

/* "In your project" panel (#2 / 5c): recent commits + changelog-since + annotations. */
.cd-proj { font-size: 11px; }
/* "May already be fixed" banner — the headline signal that newer releases exist after the affected
   version. Warning-tinted so it reads as actionable, not error. */
.cd-maybe-fixed { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-editorWarning-foreground, #cca700); border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground)); border-radius: 5px; padding: 5px 9px; margin: 4px 0 8px; font-weight: 600; }
.cd-proj-label { font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; margin: 8px 0 3px; }
.cd-proj-row { display: flex; gap: 8px; align-items: baseline; padding: 1px 0; }
.cd-proj-ver, .cd-proj-sha { flex: none; font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-textLink-foreground); }
.cd-proj-date { flex: none; opacity: 0.55; min-width: 56px; }
.cd-proj-tag { flex: none; font-weight: 700; color: var(--vscode-editorWarning-foreground, #cca700); min-width: 44px; }
.cd-proj-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cd-proj-link { color: var(--vscode-textLink-foreground); text-decoration: none; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.cd-proj-link:hover { text-decoration: underline; }
/* "Seen in your logs" match row (5c-4): session:line in link color, the log text muted alongside. */
.cd-log-link { display: flex; gap: 8px; align-items: baseline; text-decoration: none; cursor: pointer; padding: 1px 0; }
.cd-log-link:hover { background: var(--vscode-list-hoverBackground); }
.cd-log-link .cd-proj-text { color: var(--vscode-descriptionForeground); }
.crash-dist-label { font-weight: 600; font-size: 11px; margin: 8px 0 4px; opacity: 0.85; }
.crash-dist-row { display: flex; align-items: center; gap: 8px; font-size: 11px; margin: 3px 0; }
.crash-dist-name { width: 140px; flex: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crash-dist-bar-bg { flex: 1; height: 9px; background: var(--vscode-panel-border); border-radius: 5px; overflow: hidden; }
/* Rounded, subtly-gradient accent bar (UI #1). */
.crash-dist-bar-fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, var(--vscode-charts-blue, #0e70c0), var(--vscode-progressBar-background, #4daafc)); }
.crash-dist-count { width: 76px; flex: none; text-align: right; opacity: 0.8; }

` + getSetupStyles() + getDiagnosticStyles();
}
