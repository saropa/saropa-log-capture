"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRootCauseHypothesesStyles = getRootCauseHypothesesStyles;
/**
 * DB_14: CSS for the Signals (root-cause hypotheses) strip in the log viewer webview.
 *
 * Evidence line targets are rendered as `<button class="root-cause-hyp-evidence">`; user-agent
 * styling in embedded webviews can show a light filled button unless those controls are reset to
 * look like theme links (transparent background, no border, `appearance: none`).
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
}
.root-cause-hypotheses-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}
.root-cause-hyp-toggle {
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 2px;
    flex-shrink: 0;
}
.root-cause-hyp-toggle:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.root-cause-hypotheses-title {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    flex: 1;
    min-width: 0;
}
.root-cause-hyp-explain-ai {
    border: none;
    background: transparent;
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 2px;
    flex-shrink: 0;
}
.root-cause-hyp-explain-ai:hover {
    text-decoration: underline;
}
.root-cause-hypotheses-dismiss {
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
    border-radius: 2px;
}
.root-cause-hypotheses-dismiss:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.root-cause-hypotheses-list {
    margin: 0;
    padding-left: 1.15em;
}
.root-cause-hypotheses-list li {
    margin: 4px 0;
}
/* Native <button> defaults add light background/border in webviews; reset to a theme link. */
.root-cause-hyp-evidence {
    margin: 0 0 0 6px;
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    font-size: 11px;
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
    text-decoration: underline;
    white-space: nowrap;
    appearance: none;
}
.root-cause-hyp-evidence:hover {
    color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground, #3794ff));
    opacity: 0.9;
}
.rch-copy-btn {
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 4px;
    margin-left: 4px;
    border-radius: 2px;
    vertical-align: middle;
    opacity: 0;
    transition: opacity 0.15s;
}
.root-cause-hypotheses-list li:hover .rch-copy-btn {
    opacity: 1;
}
.rch-copy-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.rch-copy-btn-done {
    opacity: 1;
    color: var(--vscode-charts-green, #89d185);
    font-size: 11px;
}
.root-cause-hyp-conf {
    display: inline-block;
    font-size: 12px;
    line-height: 1;
    margin-left: 6px;
    vertical-align: middle;
    opacity: 0.92;
    cursor: help;
}
`;
}
//# sourceMappingURL=viewer-styles-root-cause-hints.js.map