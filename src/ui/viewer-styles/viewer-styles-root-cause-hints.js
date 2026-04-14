"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRootCauseHypothesesStyles = getRootCauseHypothesesStyles;
/**
 * DB_14: CSS for the Signals (root-cause hypotheses) strip in the log viewer webview.
 *
 * Visibility is controlled by the toolbar signals icon; the strip is a clickable index
 * of detected signals. Clicking a signal opens a report webview panel with full details.
 */
function getRootCauseHypothesesStyles() {
    return /* css */ `
.root-cause-hypotheses {
    flex-shrink: 0;
    margin: 0 0 4px 0;
    padding: 6px 10px 8px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    font-size: 12px;
    line-height: 1.35;
    max-height: 42vh;
    overflow: auto;
    transition: max-height 0.25s ease-out, opacity 0.25s ease-out,
                padding 0.25s ease-out, margin 0.25s ease-out,
                border-color 0.25s ease-out;
}
/* Collapsed by filter drawer mutual exclusion */
.root-cause-hypotheses.signals-drawer-hidden {
    max-height: 0 !important;
    opacity: 0;
    overflow: hidden;
    padding-top: 0;
    padding-bottom: 0;
    margin: 0;
    border-color: transparent;
}
.root-cause-hypotheses-list {
    margin: 0;
    padding-left: 1.15em;
}
.root-cause-hypotheses-list li {
    margin: 4px 0;
}
/* Hypothesis text as clickable report button */
.rch-report-btn {
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
    appearance: none;
}
.rch-report-btn:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}
.rch-dismiss-btn {
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 4px;
    margin-left: 2px;
    border-radius: 2px;
    vertical-align: middle;
    opacity: 0;
    transition: opacity 0.15s;
}
.root-cause-hypotheses-list li:hover .rch-dismiss-btn {
    opacity: 1;
}
.rch-dismiss-btn:hover {
    color: var(--vscode-errorForeground, #f48771);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.rch-restore-btn {
    display: block;
    margin: 6px 0 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    cursor: pointer;
    appearance: none;
}
.rch-restore-btn:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}
.root-cause-hyp-conf {
    display: inline-block;
    font-size: 12px;
    line-height: 1;
    vertical-align: middle;
    opacity: 0.92;
    cursor: help;
}
/* Brief toast shown after dismiss */
.rch-toast {
    display: inline-block;
    margin-left: 8px;
    font-size: 11px;
    color: var(--vscode-charts-green, #89d185);
    animation: rch-toast-fade 1.5s ease-out forwards;
}
@keyframes rch-toast-fade {
    0%, 60% { opacity: 1; }
    100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
    .root-cause-hypotheses { transition: none !important; }
    .rch-dismiss-btn { transition: none !important; }
    .rch-toast { animation: none !important; }
}
`;
}
//# sourceMappingURL=viewer-styles-root-cause-hints.js.map