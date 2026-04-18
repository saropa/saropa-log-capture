/**
 * CSV formatting for the viewer (plan 051).
 *
 * When fileMode === 'csv' and formatEnabled === true, detects the
 * separator (comma, tab, semicolon), bolds the header row, and
 * aligns columns using computed widths from the first 100 rows.
 * Alternating rows get a subtle background tint.
 */

/** Returns the CSV formatting script chunk. */
export function getViewerFormatCsvScript(): string {
    return /* javascript */ `

/** Detected CSV separator character. */
var csvSep = ',';
/** Column widths (in characters) computed from the first N rows. */
var csvColWidths = [];
/** Number of columns detected from the header row. */
var csvColCount = 0;

/**
 * Detect separator and compute column widths from allLines.
 * Scans the first 100 data rows to determine max width per column.
 */
function buildCsvLayout() {
    csvSep = ',';
    csvColWidths = [];
    csvColCount = 0;
    if (fileMode !== 'csv' || allLines.length === 0) return;

    var firstLine = stripTags(allLines[0].html);
    /* Auto-detect separator: tab, semicolon, or comma (in priority order). */
    if (firstLine.indexOf('\\t') >= 0) csvSep = '\\t';
    else if (firstLine.split(';').length > firstLine.split(',').length) csvSep = ';';
    else csvSep = ',';

    /* Parse first 100 rows to compute column widths. */
    var scanLimit = Math.min(allLines.length, 100);
    for (var i = 0; i < scanLimit; i++) {
        var cols = parseCsvRow(stripTags(allLines[i].html));
        if (cols.length > csvColCount) csvColCount = cols.length;
        for (var c = 0; c < cols.length; c++) {
            var w = cols[c].length;
            if (!csvColWidths[c] || w > csvColWidths[c]) csvColWidths[c] = w;
        }
    }
    /* Cap column widths at 40 characters to avoid extreme widths. */
    for (var j = 0; j < csvColWidths.length; j++) {
        if (csvColWidths[j] > 40) csvColWidths[j] = 40;
    }
}

/**
 * Parse a CSV row respecting quoted values.
 * Returns an array of cell strings.
 */
function parseCsvRow(line) {
    var cells = [];
    var current = '';
    var inQuote = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inQuote) {
            if (ch === '"') {
                /* Escaped quote ("") */
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuote = false;
                }
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            inQuote = true;
        } else if (ch === csvSep) {
            cells.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    cells.push(current);
    return cells;
}

/**
 * Format a single CSV line for display. Returns modified HTML.
 * Only called when fileMode === 'csv' && formatEnabled.
 */
function formatCsvLine(item, idx) {
    var plain = stripTags(item.html);
    var cols = parseCsvRow(plain);
    var isHeader = (idx === 0);
    var isAlt = (idx % 2 === 1);

    var parts = [];
    for (var c = 0; c < csvColCount; c++) {
        var val = (c < cols.length) ? cols[c] : '';
        var maxW = (c < csvColWidths.length) ? csvColWidths[c] : val.length;
        /* Pad to column width for alignment. */
        var padded = escapeHtml(val);
        while (padded.length < maxW) padded += '\\u00a0';
        var cls = isHeader ? 'csv-header-cell' : 'csv-cell';
        parts.push('<span class="' + cls + '">' + padded + '</span>');
    }

    var rowCls = 'csv-row';
    if (isHeader) rowCls += ' csv-header-row';
    if (isAlt) rowCls += ' csv-alt-row';
    return '<span class="' + rowCls + '">' + parts.join('<span class="csv-sep">\\u2502</span>') + '</span>';
}
`;
}
