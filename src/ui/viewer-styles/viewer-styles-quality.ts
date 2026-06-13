/**
 * CSS for quality coverage badges on stack frame lines.
 * Color thresholds: green (>=80%), yellow (50-79%), red (<50%).
 * Uses VS Code theme CSS variables for dark/light/high-contrast compatibility.
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
/* Background and border are derived from each badge's own foreground token via color-mix
   (the project's established tint idiom, see viewer-styles-decoration-bars.ts). Hardcoded
   rgba green/yellow/red assumed a dark canvas and stayed invisible on light/high-contrast
   themes — the style guide requires every color come from a --vscode-* variable. The tint
   now tracks whatever the active theme paints the matching severity foreground. */
.qb-high {
    color: var(--vscode-debugConsole-sourceForeground, #89d185);
    background: color-mix(in srgb, var(--vscode-debugConsole-sourceForeground, #89d185) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--vscode-debugConsole-sourceForeground, #89d185) 30%, transparent);
}
.qb-med {
    color: var(--vscode-debugConsole-warningForeground, #cca700);
    background: color-mix(in srgb, var(--vscode-debugConsole-warningForeground, #cca700) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--vscode-debugConsole-warningForeground, #cca700) 30%, transparent);
}
.qb-low {
    color: var(--vscode-errorForeground, #f48771);
    background: color-mix(in srgb, var(--vscode-errorForeground, #f48771) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--vscode-errorForeground, #f48771) 30%, transparent);
}

/* Heatmap: subtle line background for stack frames by coverage (when quality badge is shown).
   Same theme-derived tint, at a lower percentage so it reads as a faint wash behind the row. */
.line-quality-high {
    background: color-mix(in srgb, var(--vscode-debugConsole-sourceForeground, #89d185) 7%, transparent);
}
.line-quality-med {
    background: color-mix(in srgb, var(--vscode-debugConsole-warningForeground, #cca700) 7%, transparent);
}
.line-quality-low {
    background: color-mix(in srgb, var(--vscode-errorForeground, #f48771) 7%, transparent);
}
`;
}
