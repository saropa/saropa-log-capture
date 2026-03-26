"use strict";
/**
 * CSS styles for error-specific sections in the analysis panel.
 *
 * Covers: error header with triage, timeline sparkline, occurrence cards,
 * and action bar buttons.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalysisErrorStyles = getAnalysisErrorStyles;
/** Get CSS styles for error analysis sections. */
function getAnalysisErrorStyles() {
    return /* css */ `
/* Error header */
.err-header {
    padding: 12px 16px;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 8px;
}
.err-badges {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    flex-wrap: wrap;
}
.err-class {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
}
.err-class-critical { background: rgba(255, 60, 60, 0.2); color: #ff5555; }
.err-class-transient { background: rgba(255, 180, 60, 0.2); color: #ffb43c; }
.err-class-bug { background: rgba(255, 100, 160, 0.2); color: #ff64a0; }
.err-cat {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 2px;
    text-transform: uppercase;
}
.err-cat-fatal { background: rgba(255, 40, 40, 0.15); color: #ff4040; }
.err-cat-anr { background: rgba(255, 160, 40, 0.15); color: #ffa028; }
.err-cat-oom { background: rgba(200, 80, 255, 0.15); color: #c850ff; }
.err-cat-native { background: rgba(255, 120, 60, 0.15); color: #ff783c; }
.err-hash {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
}
.err-text {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 8px;
}

/* Triage controls */
.err-triage { display: flex; align-items: center; gap: 4px; }
.triage-group { display: flex; gap: 2px; }
.triage-btn {
    font-size: 11px;
    padding: 3px 10px;
    border: 1px solid var(--vscode-panel-border);
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.15s ease;
}
.triage-btn:first-child { border-radius: 3px 0 0 3px; }
.triage-btn:last-child { border-radius: 0 3px 3px 0; }
.triage-btn:not(:first-child) { border-left: none; }
.triage-btn:hover { background: var(--vscode-list-hoverBackground); }
.triage-btn-open.triage-active { background: rgba(60, 180, 255, 0.2); color: #3cb4ff; border-color: #3cb4ff; }
.triage-btn-closed.triage-active { background: rgba(100, 200, 100, 0.2); color: #64c864; border-color: #64c864; }
.triage-btn-muted.triage-active { background: rgba(160, 160, 160, 0.2); color: #a0a0a0; border-color: #a0a0a0; }

/* Timeline sparkline */
.err-version-info {
    padding: 4px 12px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
.err-sparkline {
    width: 100%;
    max-width: 500px;
    height: auto;
    margin: 4px 12px 8px;
}
.spark-bar { fill: var(--vscode-charts-blue, #3794ff); transition: fill 0.15s ease; }
.spark-bar:hover { fill: var(--vscode-charts-yellow, #cca700); }
.spark-axis { stroke: var(--vscode-panel-border); stroke-width: 1; }
.spark-label { font-size: 9px; fill: var(--vscode-descriptionForeground); }

/* Occurrences */
.err-occurrence {
    padding: 3px 12px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-left: 2px solid var(--vscode-panel-border);
    margin: 2px 8px;
}
.err-more {
    padding: 4px 12px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}

/* Action bar */
.err-action-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px 16px;
    border-top: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background);
    position: sticky;
    bottom: 0;
}
.err-action {
    font-size: 11px;
    padding: 4px 10px;
    border: 1px solid var(--vscode-panel-border);
    background: transparent;
    color: var(--vscode-editor-foreground);
    cursor: pointer;
    border-radius: 3px;
    transition: background 0.15s ease;
}
.err-action:hover { background: var(--vscode-list-hoverBackground); }
.err-action-ai {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: transparent;
}
.err-action-ai:hover { background: var(--vscode-button-hoverBackground); }
`;
}
//# sourceMappingURL=analysis-error-styles.js.map