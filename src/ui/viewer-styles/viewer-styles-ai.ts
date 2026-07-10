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

/* The left rail (box-shadow: inset 3px) was REMOVED 2026-07-10: it sat in its own
   column beside the severity gutter and read as a second severity bar. AI rows now
   use the shared severity gutter with a dedicated magenta dot (.level-bar-ai in
   viewer-styles-decoration-bars.ts), and the AI action is named by the .ai-tag-chip.
   --ai-rail-color is kept ONLY as the per-category color source the chip reads. */
.line.ai-line {
    --ai-rail-color: var(--vscode-terminal-ansiMagenta, #bc3fbc);
    opacity: 0.85;
}
/* Decoration-off rows have no .line-decoration prefix, so they don't inherit the
   regular hanging-indent padding from viewer-styles-decoration.ts; this keeps the
   message off the left edge. Scoped :not(.cols) — grid AI rows (plan 055 Phase 2)
   already get the shared 1.25em clearance from .line.cols, so this legacy fallback
   must not stack a second indent on top of it. */
.line.ai-line:not(.cols):not(:has(.line-decoration)) {
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
    --ai-rail-color: var(--muted);
    opacity: 0.6;
}
.line.ai-read .ai-prefix {
    color: var(--muted);
}

/* --- System warnings (rate limits, hook blocks) --- */
.line.ai-system {
    --ai-rail-color: var(--accent-warning);
}
.line.ai-system .ai-prefix {
    color: var(--accent-warning);
}

/* --- AI prefix label (e.g., "[AI Edit]") --- */
.ai-prefix {
    font-weight: 600;
    margin-right: 6px;
}

/* AI category chip — replaces the plain bracketed [AI Edit] prefix so the
   category is a readable label, not just a color rail. Mirrors the .flow-chip
   shape (viewer-styles-decoration-bars.ts) and reads --ai-rail-color, which
   .ai-line already sets per category (magenta bash, yellow edit, cyan prompt,
   muted read, warning system) — so one rule covers every category and the chip
   color always matches its row's rail. */
.ai-tag-chip {
    display: inline-block;
    padding: 0.02em 0.5em;
    margin-right: 6px;
    border-radius: 0.9em;
    font-size: 0.8em;
    font-weight: 600;
    line-height: 1.4;
    user-select: none;
    vertical-align: baseline;
    white-space: nowrap;
    color: var(--ai-rail-color, var(--vscode-terminal-ansiMagenta, #bc3fbc));
    background: color-mix(in srgb, var(--ai-rail-color, #bc3fbc) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--ai-rail-color, #bc3fbc) 35%, transparent);
}
`;
}
