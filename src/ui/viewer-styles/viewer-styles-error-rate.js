"use strict";
/**
 * CSS styles for the Error Rate tab in the Performance panel.
 * Summary counts, SVG bar chart, and spike markers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorRateTabStyles = getErrorRateTabStyles;
/** Return CSS for the error rate chart and summary elements. */
function getErrorRateTabStyles() {
    return /* css */ `

/* --- Error Rate summary --- */
.pp-er-summary {
    padding: 8px 12px;
    font-size: 11px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.pp-er-count { font-weight: 600; }
.pp-er-count-error { color: var(--vscode-debugConsole-errorForeground, #f48771); }
.pp-er-count-warning { color: var(--vscode-debugConsole-warningForeground, #cca700); }
.pp-er-count-spike { color: var(--vscode-debugConsole-infoForeground, #b695f8); }

/* --- Error Rate chart --- */
.pp-er-chart-container {
    padding: 8px 12px;
}

.pp-er-chart { width: 100%; height: 120px; }

.pp-er-bar { cursor: pointer; }
.pp-er-bar:hover { opacity: 0.8; }
.pp-er-bar-error { fill: var(--vscode-debugConsole-errorForeground, #f48771); }
.pp-er-bar-warning { fill: var(--vscode-debugConsole-warningForeground, #cca700); }

.pp-er-spike-marker {
    fill: var(--vscode-debugConsole-infoForeground, #b695f8);
    font-size: 10px;
    pointer-events: none;
}
`;
}
//# sourceMappingURL=viewer-styles-error-rate.js.map