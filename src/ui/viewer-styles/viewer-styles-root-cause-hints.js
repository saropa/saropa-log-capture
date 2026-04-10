"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRootCauseHypothesesStyles = getRootCauseHypothesesStyles;
/**
 * DB_14: CSS for the Signals (root-cause hypotheses) strip in the log viewer webview.
 *
 * Visibility is controlled by the toolbar signals icon; the panel has no internal
 * header or toggle — just the hypothesis list, "Copy signals" button, and per-signal dismiss.
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
    margin-left: 6px;
    vertical-align: middle;
    opacity: 0.92;
    cursor: help;
}
/* Copy all signals button */
.rch-copy-all-btn {
    display: block;
    margin: 8px 0 0;
    padding: 4px 10px;
    border: 1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border, var(--vscode-panel-border)));
    border-radius: 2px;
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    font-size: 11px;
    cursor: pointer;
    appearance: none;
}
.rch-copy-all-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, rgba(90, 93, 94, 0.5));
}
/* Brief toast shown after copy */
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
/* Flash highlight on evidence scroll target */
@keyframes rch-evidence-flash {
    0% { background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33)); }
    100% { background: transparent; }
}
.rch-evidence-flash {
    animation: rch-evidence-flash 1.5s ease-out;
}
@media (prefers-reduced-motion: reduce) {
    .root-cause-hypotheses { transition: none !important; }
    .rch-copy-btn, .rch-dismiss-btn { transition: none !important; }
    .rch-toast { animation: none !important; }
    .rch-evidence-flash { animation: none !important; background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33)); }
}
`;
}
//# sourceMappingURL=viewer-styles-root-cause-hints.js.map