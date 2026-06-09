/**
 * Markdown layout + typography helpers for the viewer (plan 051 follow-up).
 *
 * Split out of viewer-format-markdown.ts (line-limit) and consumed by the generic renderer
 * (renderItem) and height calc (calcItemHeight) so those stay format-agnostic:
 * - applyMarkdownTypography: drives the viewer's line-height control for comfortable prose.
 * - mdHeadingRowHeight: overlap-proof heading row height (bugs/markdown_render_spacing_attempts.md).
 * - mdLineDecorate: per-line heading class + pinned height + line-number/type gutter.
 * - mdGutterTag: compact structure indicator for the gutter.
 */

/** Returns the markdown layout/typography script chunk. */
export function getViewerFormatMarkdownLayoutScript(): string {
    return /* javascript */ `

/**
 * Scan allLines for HTML comment regions (\\\`<!-- ... -->\\\`) and populate mdComments +
 * mdCommentBlocks (declared in viewer-format-markdown.ts). Built FIRST (before fences/tables/
 * headings) so a '#', '|', or fence marker inside a comment is not mistaken for real structure.
 * Multi-line comments become collapsible: the opening line is the toggle, body + close fold under it.
 */
function buildMdComments() {
    mdComments = {};
    mdCommentBlocks = {};
    if (fileMode !== 'markdown') return;
    var openIdx = -1;
    for (var i = 0; i < allLines.length; i++) {
        var p = stripTags(allLines[i].html);
        if (openIdx < 0) {
            if (p.indexOf('<!--') === -1) { allLines[i]._mdComment = false; continue; }
            /* Opens here: single line if it also closes, else start of a multi-line block. */
            if (p.indexOf('-->') > -1) { mdComments[i] = { role: 'single' }; }
            else { mdComments[i] = { role: 'open' }; openIdx = i; }
            allLines[i]._mdComment = true;
        } else {
            mdComments[i] = { role: (p.indexOf('-->') > -1) ? 'close' : 'body' };
            allLines[i]._mdComment = true;
            if (p.indexOf('-->') > -1) { mdCommentBlocks[openIdx] = { collapsed: false, endIndex: i }; openIdx = -1; }
        }
    }
}

/** Toggle a multi-line comment block collapse (mirrors toggleMdSection). */
function toggleMdComment(openIdx) {
    var blk = mdCommentBlocks[openIdx];
    if (!blk) return;
    blk.collapsed = !blk.collapsed;
    for (var i = openIdx + 1; i <= blk.endIndex && i < allLines.length; i++) allLines[i]._mdCommentHidden = blk.collapsed;
    if (typeof recalcHeights === 'function') recalcHeights();
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/** Comfortable line height applied while a markdown document is rendered. Markdown reads as
    prose, so it drives the viewer's existing uniform line-height control rather than a parallel
    per-line multiplier (which would compound with the user's line-height choice). */
var MD_LINE_HEIGHT = 1.7;

/**
 * Apply (or restore) the document line height for markdown view. When markdown formatting is
 * active, bump the viewer's line height to MD_LINE_HEIGHT; otherwise restore the user's
 * configured default. setLineHeight() re-measures ROW_HEIGHT and re-renders, so body spacing
 * comes from the real typography control and stays adjustable by the font / line-height tools.
 */
function applyMarkdownTypography() {
    if (typeof setLineHeight !== 'function' || typeof logLineHeight === 'undefined') return;
    var active = (fileMode === 'markdown' && typeof formatEnabled !== 'undefined' && formatEnabled);
    var target = active ? MD_LINE_HEIGHT : (typeof logLineHeightDefault === 'number' ? logLineHeightDefault : 1.1);
    /* Only act on a real change so this is safe to call from every mode transition. */
    if (logLineHeight !== target) setLineHeight(target);
}

/**
 * Heading row height in px. Computed from the heading's OWN font requirement (fontEm * 1.5 *
 * base px, base = rowHeight / lineHeight) so the row fits the larger font whether or not the
 * comfortable document line height took effect — prevents the overlap regression
 * (bugs/markdown_render_spacing_attempts.md). Font factors MUST match the CSS .md-hN sizes.
 */
function mdHeadingRowHeight(item, rowHeight, lineH) {
    var hl = item._mdHeadingLevel;
    var fEm = (hl === 1) ? 1.45 : (hl === 2) ? 1.3 : (hl === 3) ? 1.2 : (hl === 4) ? 1.05 : 1.0;
    var lh = (lineH > 0) ? lineH : 1.1;
    /* Row = content line box (fontEm * 1.35) + fixed padding (0.85em top + 0.2em bottom), all in
       base em. The CSS uses box-sizing:border-box with exactly padding-top:0.85em /
       padding-bottom:0.2em, so the content lands 0.85em below the row top — guaranteed visible
       TOP spacing that does not depend on flex free-space distribution. base px = rowHeight / lh. */
    return Math.max(rowHeight, Math.ceil((fEm * 1.35 + 1.05) * rowHeight / lh));
}

/**
 * Per-line markdown decoration for renderItem: the heading level class + pinned inline height,
 * and (when line-number decorations are on) the gutter HTML. Kept here so the generic renderer
 * stays format-agnostic. Returns { cls, style, gutter }.
 */
function mdLineDecorate(item, idx) {
    var cls = '', style = '', gutter = '';
    if (item._mdHeadingLevel) {
        cls = ' fmt-md-h' + item._mdHeadingLevel;
        if (item.height > 0) style = ' style="height:' + item.height + 'px"';
    }
    var blank = (typeof isLineContentBlank === 'function') && isLineContentBlank(item);
    if (typeof decoShowCounter !== 'undefined' && decoShowCounter && item.type === 'line' && !blank) {
        var ln = (item.sourceLineNo != null) ? item.sourceLineNo : (idx + 1);
        gutter = '<span class="md-gutter"><span class="md-gutter-num">' + ln
            + '</span><span class="md-gutter-tag">' + mdGutterTag(item, idx) + '</span></span>';
    }
    return { cls: cls, style: style, gutter: gutter };
}

/**
 * Compact gutter type indicator for a markdown line. Heading level, code-fence, table,
 * blockquote, and list each get a short tag so a reader can scan structure; prose returns ''.
 */
function mdGutterTag(item, idx) {
    if (item._mdHeadingLevel) return 'H' + item._mdHeadingLevel;
    if (item._mdComment) return '//';
    if (item._mdFence) return '\\u2039\\u203a';
    if (item._mdTable) return '\\u25a6';
    var plain = stripTags(item.html);
    if (/^\\s*>+\\s?/.test(plain)) return '\\u275d';
    if (/^\\s*([\\-\\*]\\s+|\\d+\\.\\s+)/.test(plain)) return '\\u2022';
    return '';
}
`;
}
