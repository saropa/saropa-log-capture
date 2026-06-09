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

/** Fenced-code map: lineIndex → { role: 'open'|'close'|'body', lang }. Lines inside a
    \\x60\\x60\\x60 fence are verbatim code, so they must skip inline/heading formatting. */
var mdFences = {};

/** Table map: lineIndex → { cols: [visibleCharWidth...], role: 'header'|'sep'|'body' }.
    Column widths are the max VISIBLE (post-inline-format) char count per column across the
    block, so cells render as fixed-ch-width inline-blocks that line up in the monospace font. */
var mdTables = {};

/** Split a markdown table row into trimmed cells, dropping the empty edges that a
    leading/trailing pipe produces (\\\`| a | b |\\\` → ['a','b']). */
function splitTableCells(plain) {
    var cells = plain.split('|');
    if (cells.length && cells[0].trim() === '') cells.shift();
    if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
    return cells.map(function (c) { return c.trim(); });
}

/** A separator row is the \\\`|---|:--:|\\\` line under the header: only pipes, dashes, colons, spaces. */
function isMdTableSep(plain) {
    return plain.indexOf('-') > -1 && /^\\s*\\|?[\\s\\-:|]+\\|?\\s*$/.test(plain);
}

/** Visible width of a cell = length AFTER inline formatting strips markers (backticks,
    asterisks, link syntax). Measured via the real render path so width matches what shows. */
function mdCellVisibleLen(cell) {
    return stripTags(applyMdInline(escapeHtml(cell))).length;
}

/** True if a stripped line looks like a table row: starts with a pipe and has 2+ pipes total
    (indexOf('|') is always 0 for a leading pipe, so count pipes instead of checking position). */
function isMdTableRow(plain) {
    return /^\\s*\\|/.test(plain) && (plain.match(/\\|/g) || []).length >= 2;
}

/**
 * Scan allLines for contiguous table blocks (outside fences) and populate mdTables with
 * per-column widths + each row's role. The first non-separator row is the header; the
 * \\\`|---|\\\` row is the separator (hidden via calcItemHeight); the rest are body rows.
 */
function buildMdTables() {
    mdTables = {};
    if (fileMode !== 'markdown') return;
    var i = 0;
    while (i < allLines.length) {
        var plain0 = mdFences[i] ? '' : stripTags(allLines[i].html);
        if (!mdFences[i] && isMdTableRow(plain0)) {
            var rows = [];
            while (i < allLines.length && !mdFences[i]) {
                var p = stripTags(allLines[i].html);
                if (!isMdTableRow(p)) break;
                rows.push({ idx: i, plain: p, sep: isMdTableSep(p) });
                i++;
            }
            assignMdTableBlock(rows);
        } else {
            i++;
        }
    }
}

/** Compute column widths for one collected table block and record role + widths per row. */
function assignMdTableBlock(rows) {
    var widths = [];
    for (var r = 0; r < rows.length; r++) {
        if (rows[r].sep) continue;
        var cells = splitTableCells(rows[r].plain);
        for (var c = 0; c < cells.length; c++) {
            var w = mdCellVisibleLen(cells[c]);
            if (!widths[c] || w > widths[c]) widths[c] = w;
        }
    }
    var headerSeen = false;
    for (var k = 0; k < rows.length; k++) {
        var role = rows[k].sep ? 'sep' : (headerSeen ? 'body' : 'header');
        if (!rows[k].sep) headerSeen = true;
        mdTables[rows[k].idx] = { cols: widths, role: role };
        /* calcItemHeight reads this flag to collapse the separator row to zero height. */
        allLines[rows[k].idx]._mdTableSep = rows[k].sep;
    }
}

/**
 * Scan allLines for fenced code blocks (\\x60\\x60\\x60 or ~~~, 3+ chars) and populate
 * mdFences. A fence opens on the first delimiter and closes on the next; the
 * opening delimiter carries the language. Called from buildMdSections so the
 * heading scan can skip lines that live inside a fence (a '#' in code is not a heading).
 */
function buildMdFences() {
    mdFences = {};
    if (fileMode !== 'markdown') return;
    var inFence = false;
    for (var i = 0; i < allLines.length; i++) {
        var plain = stripTags(allLines[i].html);
        var fm = /^\\s*(\\x60{3,}|~{3,})\\s*([\\w-]*)\\s*$/.exec(plain);
        if (fm) {
            /* Opening delimiter records the language; closing delimiter has none. */
            mdFences[i] = { role: inFence ? 'close' : 'open', lang: inFence ? '' : fm[2] };
            inFence = !inFence;
            allLines[i]._mdFence = true;
        } else if (inFence) {
            mdFences[i] = { role: 'body', lang: '' };
            allLines[i]._mdFence = true;
        } else {
            /* Code lines keep dense spacing; calcItemHeight reads this to skip the extra
               vertical room it gives ordinary markdown lines. */
            allLines[i]._mdFence = false;
        }
    }
}

/**
 * Build the markdown section map from allLines. Each heading line stores
 * its level (1–6) and the index of the last line before the next heading
 * of equal or higher level (or end of file).
 */
function buildMdSections() {
    mdSections = {};
    if (fileMode !== 'markdown') return;
    /* Fences first: heading + table detection must ignore lines inside code blocks. */
    buildMdFences();
    buildMdTables();
    var headings = [];
    for (var i = 0; i < allLines.length; i++) {
        if (mdFences[i]) continue;
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
        /* calcItemHeight + renderItem read this to allocate a taller, padded heading row. */
        allLines[cur.idx]._mdHeadingLevel = cur.level;
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

    /* Fenced code block: render verbatim (escaped, no inline markdown), so diagram
       source like \\x60\\x60\\x60mermaid and table/SQL snippets are not mangled by bold/italic/
       link rules. stripTags() decodes entities, escapeHtml() re-encodes them cleanly. */
    var fence = mdFences[idx];
    if (fence) {
        if (fence.role === 'open') {
            var lang = fence.lang ? '<span class="md-fence-lang">' + escapeHtml(fence.lang) + '</span>' : '';
            return '<span class="md-fence md-fence-open">' + lang + '</span>';
        }
        if (fence.role === 'close') return '<span class="md-fence md-fence-close"></span>';
        return '<span class="md-fence md-fence-body">' + escapeHtml(stripTags(html)) + '</span>';
    }

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
            /* Subtle, right-aligned collapse affordance (md-chevron is floated via flex). */
            chevron = '<span class="md-chevron">' + (sec.collapsed ? '\\u25b8' : '\\u25be') + '</span>';
            if (sec.collapsed) {
                var count = sec.endIndex - idx;
                badge = ' <span class="md-collapse-badge">(' + count + ' lines)</span>';
            }
        }
        /* data-md-section on the wrapper so a click on the text OR the chevron collapses. */
        return '<span class="md-heading md-h' + hLevel + '" data-md-section="' + idx + '">'
            + '<span class="md-htext">' + hText + badge + '</span>' + chevron + '</span>';
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

    /* Table row: render cells as fixed-ch-width inline-blocks so columns align (see buildMdTables). */
    var tbl = mdTables[idx];
    if (tbl) {
        /* Separator row is collapsed to 0 height by calcItemHeight; the header's bottom
           border is the divider. Still return a thin rule as a fallback if it does render. */
        if (tbl.role === 'sep') return '<span class="md-table-rule"></span>';
        var cells = splitTableCells(plain);
        var out = '';
        for (var c = 0; c < tbl.cols.length; c++) {
            var cellTxt = (c < cells.length) ? cells[c] : '';
            /* +2 ch gives a column gutter; width in ch lines up in the monospace font. */
            out += '<span class="md-td" style="width:' + (tbl.cols[c] + 2) + 'ch">'
                + applyMdInline(escapeHtml(cellTxt)) + '</span>';
        }
        var rowCls = (tbl.role === 'header') ? 'md-table-row md-table-header' : 'md-table-row';
        return '<span class="' + rowCls + '">' + out + '</span>';
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
