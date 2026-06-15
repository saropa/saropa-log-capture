/**
 * CSS styles for error-specific sections in the analysis panel.
 *
 * Covers: error header with triage, timeline sparkline, occurrence cards,
 * and action bar buttons.
 */

/** Get CSS styles for error analysis sections. */
export function getAnalysisErrorStyles(): string {
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
.err-class-critical { background: color-mix(in srgb, var(--accent-critical) 20%, transparent); color: var(--accent-critical); }
.err-class-transient { background: color-mix(in srgb, var(--accent-warning) 20%, transparent); color: var(--accent-warning); }
/* No pink token exists; a bug class is an escalated (above-warning) severity, so --accent-high is the closest semantic. */
.err-class-bug { background: color-mix(in srgb, var(--accent-high) 20%, transparent); color: var(--accent-high); }
.err-cat {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 2px;
    text-transform: uppercase;
}
.err-cat-fatal { background: color-mix(in srgb, var(--accent-critical) 15%, transparent); color: var(--accent-critical); }
.err-cat-anr { background: color-mix(in srgb, var(--accent-warning) 15%, transparent); color: var(--accent-warning); }
/* No purple token exists; out-of-memory is a fatal-severity crash, so --accent-critical is the closest semantic. */
.err-cat-oom { background: color-mix(in srgb, var(--accent-critical) 15%, transparent); color: var(--accent-critical); }
/* Native crashes are escalated above a plain warning but not strictly fatal; --accent-high sits between critical and warning. */
.err-cat-native { background: color-mix(in srgb, var(--accent-high) 15%, transparent); color: var(--accent-high); }
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
.triage-btn-open.triage-active { background: color-mix(in srgb, var(--accent-info) 20%, transparent); color: var(--accent-info); border-color: var(--accent-info); }
.triage-btn-closed.triage-active { background: color-mix(in srgb, var(--status-good) 20%, transparent); color: var(--status-good); border-color: var(--status-good); }
/* Muted/triaged-away state reads as de-emphasized; --muted is the gray neutral token. */
.triage-btn-muted.triage-active { background: color-mix(in srgb, var(--muted) 20%, transparent); color: var(--muted); border-color: var(--muted); }

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
.spark-bar { fill: var(--vscode-charts-blue, var(--accent-info)); transition: fill 0.15s ease; }
.spark-bar:hover { fill: var(--vscode-charts-yellow, var(--accent-warning)); }
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
