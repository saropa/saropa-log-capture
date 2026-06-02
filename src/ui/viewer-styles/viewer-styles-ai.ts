/**
 * CSS styles for AI activity lines in the log viewer.
 *
 * AI lines are injected alongside debug output with a coloured left border
 * and prefix text to distinguish them visually. Uses VS Code theme
 * variables for automatic light/dark adaptation.
 */

export function getAiStyles(): string {
    return /* css */ `

/* ===================================================================
   AI Activity Lines
   Shared base for all ai-* categories. Distinguished by a coloured
   left border and slightly reduced opacity vs primary debug output.
   =================================================================== */

/* Rail is drawn with inset box-shadow (NOT border-left) so it is OUT OF FLOW.
   With border-left:3px the AI rows' content shifted 3px right of non-AI rows
   — the line-number digits on every AI line landed 3px right of the digits
   on regular log lines, breaking column alignment across the viewport.
   box-shadow:inset paints the same 3px stripe inside the row's left edge
   without adding to its box width, so columns stay straight. Per-category
   color overrides set --ai-rail-color; the .ai-line rule reads it via fallback. */
.line.ai-line {
    --ai-rail-color: var(--vscode-terminal-ansiMagenta, #bc3fbc);
    box-shadow: inset 3px 0 0 var(--ai-rail-color);
    opacity: 0.85;
}
/* Decoration-off rows have no .line-decoration prefix, so they don't inherit
   the regular hanging-indent padding from viewer-styles-decoration.ts. Without
   this fallback the message would butt directly against the 3px accent rail. */
.line.ai-line:not(:has(.line-decoration)) {
    padding-left: 13px;
}

/* --- User prompt breadcrumbs --- */
.line.ai-prompt {
    --ai-rail-color: var(--vscode-terminal-ansiCyan, #11a8cd);
    font-style: italic;
}
.line.ai-prompt .ai-prefix {
    color: var(--vscode-terminal-ansiCyan, #11a8cd);
}

/* --- File mutations (Write, Edit) --- */
.line.ai-edit {
    --ai-rail-color: var(--vscode-terminal-ansiYellow, #e5e510);
}
.line.ai-edit .ai-prefix {
    color: var(--vscode-terminal-ansiYellow, #e5e510);
}

/* --- Bash commands --- */
.line.ai-bash {
    --ai-rail-color: var(--vscode-terminal-ansiMagenta, #bc3fbc);
}
.line.ai-bash .ai-prefix {
    color: var(--vscode-terminal-ansiMagenta, #bc3fbc);
}

/* --- Read/search operations (dimmed when visible) --- */
.line.ai-read {
    --ai-rail-color: var(--vscode-descriptionForeground, #717171);
    opacity: 0.6;
}
.line.ai-read .ai-prefix {
    color: var(--vscode-descriptionForeground, #717171);
}

/* --- System warnings (rate limits, hook blocks) --- */
.line.ai-system {
    --ai-rail-color: var(--vscode-editorWarning-foreground, #ff9800);
}
.line.ai-system .ai-prefix {
    color: var(--vscode-editorWarning-foreground, #ff9800);
}

/* --- AI prefix label (e.g., "[AI Edit]") --- */
.ai-prefix {
    font-weight: 600;
    margin-right: 6px;
}
`;
}
