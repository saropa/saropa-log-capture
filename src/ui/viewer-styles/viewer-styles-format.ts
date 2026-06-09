/**
 * CSS styles for structured file format rendering (plan 051).
 * Covers markdown, JSON, and CSV formatted views.
 */

/** Returns CSS for structured file format modes. */
export function getFormatStyles(): string {
    return /* css */ `

/* ---- Format toggle button active state ---- */

.toolbar-icon-btn-active {
    background: var(--vscode-toolbar-activeBackground, rgba(255, 255, 255, 0.12));
    border-radius: 4px;
}

/* ---- Markdown ---- */

/* All markdown lines share one left edge. The 1.85em log gutter (severity bars) is
   irrelevant in markdown mode, so trim it to a small uniform margin — this is the fix
   for the ragged left edge that per-heading borders/padding used to cause. */
.line.fmt-markdown { padding-left: 1em; }

/* Headings: no left border (it broke alignment). The row is pinned to a taller height
   (calcItemHeight + inline style); flex-centering the text inside it yields the vertical
   padding, and the collapse chevron is pushed to the right edge. */
.line.fmt-md-h1, .line.fmt-md-h2, .line.fmt-md-h3,
.line.fmt-md-h4, .line.fmt-md-h5, .line.fmt-md-h6 {
    display: flex;
    /* flex-end: the row's extra height (mdHeadingRowHeight allocates ~0.6*fontEm of padding)
       lands ABOVE the text, giving generous top spacing that detaches the heading from the
       content above it while keeping it close to the section it introduces below. */
    align-items: flex-end;
    overflow: hidden;
}

.md-heading {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    font-weight: bold;
    cursor: pointer;
}
.md-heading:hover { opacity: 0.85; }

/* ---- Markdown gutter (line number + type tag) — shown when line-number decorations are on.
   Non-heading rows use a hanging indent so wrapped lines align under the content, not the
   gutter; heading rows are flex, so the gutter is just the first flex item. ---- */
.line.fmt-markdown.md-has-gutter { padding-left: 0; }
.line.fmt-markdown.md-has-gutter:not([class*="fmt-md-h"]) {
    padding-left: var(--md-gutter-width, 6.75em);
    text-indent: calc(-1 * var(--md-gutter-width, 6.75em));
}
.md-gutter {
    display: inline-block;
    flex: 0 0 auto;
    width: var(--md-gutter-width, 6.75em);
    box-sizing: border-box;
    text-indent: 0;
    padding-right: 0.75em;
    font-size: 0.85em;
    color: var(--vscode-editorLineNumber-foreground, #858585);
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    vertical-align: top;
}
.md-gutter-num { display: inline-block; width: 3em; text-align: right; }
/* Wider so the structure tags (H1, code ‹›, table ▦, quote ❝, bullet •) are clearly readable. */
.md-gutter-tag { display: inline-block; width: 3.5em; text-align: right; opacity: 0.8; }

.md-htext {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* Tight, fixed line height so the larger heading font's line box stays within the row that
       calcItemHeight allocated (fontEm * 1.5 * base). Must match the 1.35 factor used there. */
    line-height: 1.35;
}

/* Font sizes MUST match the per-level fontEm in mdHeadingRowHeight (heading row height is
   computed from them); the line's own font-size stays at base so the pinned px height is exact.
   Per-level colors give scannable hierarchy; the minimap mirrors these (keep MM_HEADING_COLORS
   in viewer-scrollbar-minimap-paint.ts in sync with these hex fallbacks). */
.md-h1 .md-htext { font-size: 1.45em; color: var(--vscode-charts-blue, #4fc1ff); }
.md-h2 .md-htext { font-size: 1.3em; color: var(--vscode-charts-green, #89d185); }
.md-h3 .md-htext { font-size: 1.2em; color: var(--vscode-charts-purple, #b180d7); }
.md-h4 .md-htext { font-size: 1.05em; color: var(--vscode-charts-orange, #d18616); }
.md-h5 .md-htext { font-size: 1.0em; color: var(--vscode-charts-yellow, #cca700); }
.md-h6 .md-htext { font-size: 1.0em; color: var(--vscode-descriptionForeground, #888); }

/* Subtle, right-aligned collapse affordance. */
.md-chevron {
    flex: 0 0 auto;
    margin-left: 8px;
    opacity: 0.35;
    font-size: 0.7em;
    color: var(--vscode-descriptionForeground, #888);
}
.md-heading:hover .md-chevron { opacity: 0.7; }

.md-collapse-badge {
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground, #888);
    font-weight: normal;
    margin-left: 8px;
}

.md-hr {
    display: block;
    border: none;
    border-top: 1px solid var(--vscode-editorWidget-border, #454545);
    margin: 2px 0;
    height: 0;
}

.md-blockquote {
    display: inline-block;
    border-left: 2px solid var(--vscode-textBlockQuote-border, #555);
    padding-left: calc(var(--bq-depth, 1) * 8px);
    color: var(--vscode-descriptionForeground, #999);
    font-style: italic;
}

/* Top-level bullets align to the body left edge; only nested items indent (by depth). */
.md-bullet {
    padding-left: calc(var(--md-indent, 0) * 12px);
}

.md-code {
    background: var(--vscode-textCodeBlock-background, rgba(255, 255, 255, 0.06));
    border-radius: 3px;
    padding: 1px 4px;
    font-family: var(--vscode-editor-font-family);
}

.md-link {
    text-decoration: underline;
    color: var(--vscode-textLink-foreground, #3794ff);
}

/* HTML comments render muted + italic (the conventional "this is a comment" treatment, theme-safe
   across light/dark). A multi-line comment's opening line is a collapse toggle with a right chevron. */
.md-comment {
    color: var(--vscode-descriptionForeground, #6a9955);
    font-style: italic;
    opacity: 0.85;
}
.md-comment-open {
    display: flex;
    align-items: center;
    width: 100%;
    cursor: pointer;
}
.md-comment-open .md-htext { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.md-comment-open:hover { opacity: 1; }

/* Tables render as aligned columns: each cell is a fixed-ch-width inline-block (width set
   per column in buildMdTables), so columns line up in the monospace font. The header row is
   bold with a bottom border; the |---| separator row is collapsed to 0 height upstream. */
.md-table-row {
    font-family: var(--vscode-editor-font-family);
    white-space: nowrap;
}

.md-table-header {
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
}

.md-td {
    display: inline-block;
    box-sizing: border-box;
    vertical-align: top;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 1ch;
}

.md-table-rule {
    display: block;
    border-top: 1px solid var(--vscode-editorWidget-border, #454545);
    height: 0;
}

/* Fenced code blocks (triple-backtick + language). Body lines render verbatim in a
   monospace, tinted block; the open/close delimiters become thin rules so the block
   reads as one unit. */
.md-fence-body {
    display: inline-block;
    width: 100%;
    background: var(--vscode-textCodeBlock-background, rgba(255, 255, 255, 0.06));
    font-family: var(--vscode-editor-font-family);
    white-space: pre;
    padding: 0 6px;
}
.md-fence-open,
.md-fence-close {
    display: block;
    background: var(--vscode-textCodeBlock-background, rgba(255, 255, 255, 0.06));
    border-top: 1px solid var(--vscode-editorWidget-border, #454545);
}
/* Close has no label, so collapse it to a thin closing rule. Open auto-sizes to its
   language label below. */
.md-fence-close { height: 4px; }
.md-fence-lang {
    font-family: var(--vscode-editor-font-family);
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground, #888);
    padding: 0 6px;
}

/* ---- JSON ---- */

.json-line {
    padding-left: calc(var(--json-depth, 0) * 16px);
    cursor: default;
}
.json-line[data-json-section] { cursor: pointer; }
.json-line[data-json-section]:hover { opacity: 0.8; }

.json-key { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
.json-string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
.json-number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
.json-bool { color: var(--vscode-debugTokenExpression-boolean, #4fc1ff); }
.json-brace { color: var(--vscode-descriptionForeground, #888); }

.json-collapse-badge {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground, #888);
    margin-left: 4px;
}

/* ---- CSV ---- */

.csv-row {
    font-family: var(--vscode-editor-font-family);
    white-space: pre;
}

.csv-header-row {
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
}

.csv-alt-row {
    background: rgba(255, 255, 255, 0.02);
}

.csv-cell {
    display: inline-block;
    padding: 0 4px;
}

.csv-header-cell {
    display: inline-block;
    padding: 0 4px;
    font-weight: bold;
}

.csv-sep {
    color: var(--vscode-descriptionForeground, #555);
    padding: 0 2px;
}

/* ---- Generic format line wrapper ---- */

.fmt-markdown,
.fmt-json,
.fmt-csv,
.fmt-html {
    /* No level-based coloring for structured documents. */
    color: var(--vscode-editor-foreground, #d4d4d4);
}
`;
}
