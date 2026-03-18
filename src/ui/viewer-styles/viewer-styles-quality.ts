/**
 * CSS for quality coverage badges on stack frame lines.
 * Colour thresholds: green (>=80%), yellow (50-79%), red (<50%).
 * Uses VS Code theme CSS variables for dark/light compatibility.
 */

/** Returns the CSS for quality badge styling. */
export function getQualityBadgeStyles(): string {
    return `
.quality-badge {
    display: inline-block;
    padding: 0 4px;
    margin-right: 3px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    vertical-align: middle;
}
.qb-high {
    background: rgba(0, 200, 83, 0.15);
    color: var(--vscode-debugConsole-sourceForeground, #89d185);
    border: 1px solid rgba(0, 200, 83, 0.3);
}
.qb-med {
    background: rgba(255, 165, 0, 0.15);
    color: var(--vscode-debugConsole-warningForeground, #cca700);
    border: 1px solid rgba(255, 165, 0, 0.3);
}
.qb-low {
    background: rgba(255, 0, 0, 0.15);
    color: var(--vscode-errorForeground, #f48771);
    border: 1px solid rgba(255, 0, 0, 0.3);
}

/* Heatmap: subtle line background for stack frames by coverage (when quality badge is shown). */
.line-quality-high {
    background: rgba(0, 200, 83, 0.06);
}
.line-quality-med {
    background: rgba(255, 165, 0, 0.06);
}
.line-quality-low {
    background: rgba(255, 0, 0, 0.06);
}
`;
}
