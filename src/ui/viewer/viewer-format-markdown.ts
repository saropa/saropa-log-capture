/**
 * Markdown formatting for the viewer (plan 051).
 *
 * When fileMode === 'markdown' and formatEnabled === true, transforms
 * plain-text markdown lines into lightweight HTML: headings (collapsible),
 * bullets, bold/italic, inline code, blockquotes, and horizontal rules.
 *
 * Collapse uses the same calcItemHeight() → 0 pattern as stack groups.
 */

/** Returns the markdown formatting script chunk. */
export function getViewerFormatMarkdownScript(): string {
    return /* javascript */ `

/** Markdown section collapse map: headingIndex → { level, collapsed, endIndex }. */
var mdSections = {};

/**
 * Build the markdown section map from allLines. Each heading line stores
 * its level (1–6) and the index of the last line before the next heading
 * of equal or higher level (or end of file).
 */
function buildMdSections() {
    mdSections = {};
    if (fileMode !== 'markdown') return;
    var headings = [];
    for (var i = 0; i < allLines.length; i++) {
        var plain = stripTags(allLines[i].html);
        var m = /^(#{1,6})\\s/.exec(plain);
        if (m) headings.push({ idx: i, level: m[1].length });
    }
    for (var h = 0; h < headings.length; h++) {
        var cur = headings[h];
        /* End index: line before next heading of equal or higher (lower number) level. */
        var endIdx = allLines.length - 1;
        for (var n = h + 1; n < headings.length; n++) {
            if (headings[n].level <= cur.level) {
                endIdx = headings[n].idx - 1;
                break;
            }
        }
        mdSections[cur.idx] = { level: cur.level, collapsed: false, endIndex: endIdx };
    }
}

/** Toggle a markdown section collapse. Called from click handler on heading lines. */
function toggleMdSection(headingIdx) {
    var sec = mdSections[headingIdx];
    if (!sec) return;
    sec.collapsed = !sec.collapsed;
    /* Set height 0 on all lines in the collapsed range. */
    for (var i = headingIdx + 1; i <= sec.endIndex && i < allLines.length; i++) {
        /* Skip nested headings that have their own collapse state — they stay
           hidden when the parent is collapsed, but keep their own state. */
        allLines[i]._mdSectionHidden = sec.collapsed;
    }
    if (typeof recalcHeights === 'function') recalcHeights();
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/**
 * Format a single markdown line for display. Returns modified HTML.
 * Only called when fileMode === 'markdown' && formatEnabled.
 */
function formatMarkdownLine(item, idx) {
    var html = item.html;
    var plain = stripTags(html);

    /* Heading: # through ###### */
    var hMatch = /^(#{1,6})\\s+(.*)$/.exec(plain);
    if (hMatch) {
        var hLevel = hMatch[1].length;
        var hText = escapeHtml(hMatch[2]);
        /* Apply inline formatting to heading text */
        hText = applyMdInline(hText);
        var sec = mdSections[idx];
        var chevron = '';
        var badge = '';
        if (sec) {
            chevron = sec.collapsed ? '\\u25b6 ' : '\\u25bc ';
            if (sec.collapsed) {
                var count = sec.endIndex - idx;
                badge = ' <span class="md-collapse-badge">(' + count + ' lines)</span>';
            }
        }
        return '<span class="md-heading md-h' + hLevel + '" data-md-section="' + idx + '">' + chevron + hText + badge + '</span>';
    }

    /* Horizontal rule: ---, ***, ___ (3+ chars, optionally with spaces) */
    if (/^\\s*([\\-\\*\\_])\\1{2,}\\s*$/.test(plain)) {
        return '<span class="md-hr"></span>';
    }

    /* Blockquote: > text */
    var bqMatch = /^(>+)\\s?(.*)$/.exec(plain);
    if (bqMatch) {
        var depth = bqMatch[1].length;
        var bqText = applyMdInline(escapeHtml(bqMatch[2]));
        return '<span class="md-blockquote" style="--bq-depth:' + depth + '">' + bqText + '</span>';
    }

    /* Unordered list: - item or * item */
    var ulMatch = /^(\\s*)[\\-\\*]\\s+(.*)$/.exec(plain);
    if (ulMatch) {
        var indent = ulMatch[1].length;
        var liText = applyMdInline(escapeHtml(ulMatch[2]));
        return '<span class="md-bullet" style="--md-indent:' + indent + '">\\u2022 ' + liText + '</span>';
    }

    /* Ordered list: 1. item */
    var olMatch = /^(\\s*)(\\d+)\\.\\s+(.*)$/.exec(plain);
    if (olMatch) {
        var olIndent = olMatch[1].length;
        var olNum = olMatch[2];
        var olText = applyMdInline(escapeHtml(olMatch[3]));
        return '<span class="md-bullet" style="--md-indent:' + olIndent + '">' + olNum + '. ' + olText + '</span>';
    }

    /* Table row: | col | col | */
    if (/^\\s*\\|/.test(plain) && plain.indexOf('|') > -1) {
        /* Table separator rows (|---|---| etc.) render as thin lines */
        if (/^\\s*\\|[\\s\\-:|]+\\|\\s*$/.test(plain)) {
            return '<span class="md-table-sep">' + escapeHtml(plain) + '</span>';
        }
        return '<span class="md-table-row">' + escapeHtml(plain) + '</span>';
    }

    /* Plain text with inline formatting */
    return applyMdInline(html);
}

/** Apply inline markdown formatting: bold, italic, inline code, links. */
function applyMdInline(html) {
    /* Inline code: backtick-wrapped text (must come before bold/italic to avoid conflicts).
       Uses \\x60 (hex for backtick) because this runs inside a template literal. */
    var btRe = new RegExp('\\x60([^\\x60]+)\\x60', 'g');
    html = html.replace(btRe, '<span class="md-code">$1</span>');
    /* Bold: **text** or __text__ */
    html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    /* Italic: *text* or _text_ (single) */
    html = html.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
    html = html.replace(/(?<![\\w])_([^_]+)_(?![\\w])/g, '<em>$1</em>');
    /* Links: [text](url) — show underlined text, not clickable for security */
    html = html.replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '<span class="md-link">$1</span>');
    return html;
}
`;
}
