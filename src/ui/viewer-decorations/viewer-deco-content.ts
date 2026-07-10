/**
 * Decoration content builders for the log viewer (plan 055).
 *
 * Extracted from viewer-decorations.ts / viewer-data-helpers-render.ts so both
 * stay under the 300-LOC cap when the grid-cell renderer was added. Holds the
 * per-row decoration CONTENT (not the layout math, which stays in
 * applyDecorationLayoutWidth):
 *   - getCategoryBadge()    — output-channel badge
 *   - buildDecoParts()      — the ordered { key, html } parts (single source of truth)
 *   - getDecorationPrefix() — legacy inline-block prefix (un-migrated paths)
 *   - getDecorationCells()  — grid cells, one clipping .deco-cell per part
 *
 * Concatenated into the same webview script scope (via getDecorationsScript), so
 * its top-level function declarations are reachable from renderItem in the
 * data-helpers script exactly like the rest of the decoration helpers.
 */
export function getDecoContentScript(): string {
    return /* javascript */ `
/** Whether to show output channel badges on log lines (toggled from Decorations panel). */
var showCategoryBadges = false;

/** Channel badge colors keyed by DAP category. */
var categoryBadgeColors = {
    stdout: '#4ec9b0',
    stderr: '#f48771',
    'ai-bash': '#ce9178',
    'ai-edit': '#d7ba7d',
    logcat: '#9cdcfe',
    'db-signal': '#c586c0',
    system: '#b5cea8'
};

/** Return a small inline badge for the line's output channel, or empty string. */
function getCategoryBadge(item) {
    if (!showCategoryBadges || !item.category || item.category === 'console') return '';
    var label = item.category;
    var clr = categoryBadgeColors[label] || '#888';
    return '<span class="category-badge" style="--cat-clr:' + clr + '" title="' + vt('viewer.deco.outputChannel', label) + '">' + label + '</span> ';
}

/* Build the ordered decoration parts as { key, html } objects (plan 055).
   Single source of truth shared by BOTH renderers so they can never diverge:
   - getDecorationPrefix()  — legacy inline-block prefix (un-migrated paths)
   - getDecorationCells()   — grid cells, one clipping cell per part
   key drives the grid column placement class (.deco-cell-<key>); order matches
   the fixed grid-column indices in viewer-styles-columns.ts.

   hiddenAfter — when present, info about lines hidden BETWEEN this visible row
   and the next; drives the small chevron right of the line number (the chevron
   + counter form one click target for collapsed gaps / dedup-fold / stack). */
function buildDecoParts(item, idx, hiddenAfter) {
    if (!areDecorationsOn()) return [];
    if (!item || item.type === 'marker' || item.type === 'stack-frame') return [];

    var isBlank = typeof isLineContentBlank === 'function' && isLineContentBlank(item);
    if (isBlank && (typeof decoShowCounterOnBlank === 'undefined' || !decoShowCounterOnBlank)) return [];

    var parts = [];
    // Emoji dots are NOT shown in the visual prefix — the CSS severity bar
    // (level-bar-*) is the visual indicator. Emoji dots appear only in
    // decorated copy format (see decorateLine() in viewer-copy.ts).
    /* Show counter when Counter is on, or when blank and "Show line number on blank lines" is on. */
    if (decoShowCounter || (isBlank && decoShowCounterOnBlank)) {
        // Prefer the source-file line number stamped at line arrival in viewer-script-messages.ts.
        // idx is the position in allLines, which counts hidden stack-frame items, folded
        // async-gap markers, and synthetic chip rows — so idx+1 does NOT track the user's raw
        // file line. Fall back to idx+1 only when no source line is available (e.g. multi-part
        // sessions or in-memory streams where a single offset cannot represent the source).
        var lineNoSrc = (typeof item.sourceLineNo === 'number') ? item.sourceLineNo
            : ((typeof idx === 'number') ? (idx + 1) : (item.seq !== undefined ? item.seq : '?'));
        var seqStr = String(lineNoSrc);
        /* Cumulative cross-session feed (plan 057): when ≥2 distinct origin files are
           present, prefix the per-file ordinal with the file's letter code (A1139, B12)
           so the gutter number maps to a specific .log file. The pair is what copy emits
           and the files dialog resolves. Single-file feeds keep the bare number. */
        if (typeof fileCodeCount === 'function' && fileCodeCount() >= 2 && item.fileLetter) {
            seqStr = item.fileLetter + (typeof item.fileLineNo === 'number' ? item.fileLineNo : '');
        }
        /* getCounterAffordance returns either '' (plain counter) or the full
           clickable counter+chevron HTML with data-affordance-* attrs the click
           delegate routes on; the digits live inside so the whole numeric column
           is clickable. */
        var counterHtml = '<span class="deco-counter">' + seqStr.padStart(getCounterDigitsForLayout(), '\\u00a0') + '</span>';
        var affordance = (typeof getCounterAffordance === 'function')
            ? getCounterAffordance(item, idx, hiddenAfter, counterHtml) : '';
        parts.push({ key: 'num', html: affordance || counterHtml });
    }
    if (!isBlank && decoShowTimestamp) {
        var ts = formatDecoTimestamp(item.timestamp);
        if (ts) parts.push({ key: 'time', html: ts });
    }
    if (!isBlank && decoShowSessionElapsed && item.timestamp && sessionStartTs) {
        parts.push({ key: 'sessElapsed', html: formatSessionElapsed(item.timestamp - sessionStartTs) });
    }
    if (!isBlank && typeof showParsedPidTid !== 'undefined' && showParsedPidTid) {
        var pidParts = [];
        if (item.parsedPid != null) pidParts.push('<span class="meta-filter-toggle" data-meta-key="pid" data-meta-value="' + item.parsedPid + '" title="' + vt('viewer.deco.filterByPid', item.parsedPid) + '">' + item.parsedPid + '</span>');
        if (item.parsedTid != null) pidParts.push('<span class="meta-filter-toggle" data-meta-key="tid" data-meta-value="' + item.parsedTid + '" title="' + vt('viewer.deco.filterByTid', item.parsedTid) + '">' + item.parsedTid + '</span>');
        if (pidParts.length) parts.push({ key: 'pidtid', html: '<span class="deco-pid-tid">[' + pidParts.join(':') + ']</span>' });
    }
    if (!isBlank && typeof showParsedLevelPrefix !== 'undefined' && showParsedLevelPrefix && item.parsedRawLevel) {
        parts.push({ key: 'level', html: '<span class="deco-level-prefix">' + item.parsedRawLevel + '</span>' });
    }
    /* The one tag cell holds every per-line tag chip: the structured device tag
       (keystore2) first — gated by its column toggle + structured parsing — then
       ALL app head tags ([db]/[perf]/[frame-stall]), which need neither toggle nor
       structured parsing. The cell title lists every head tag so a name clipped by
       the fixed column width is recoverable on hover. */
    var tagHtml = '';
    var tagTitle = '';
    if (!isBlank && item.parsedTag
        && typeof structuredLineParsing !== 'undefined' && structuredLineParsing
        && (typeof decoShowParsedTag === 'undefined' || decoShowParsedTag)) {
        tagHtml += '<span class="meta-filter-toggle deco-parsed-tag deco-parsed-tag-chip" data-meta-key="tag" data-meta-value="' + item.parsedTag.replace(/"/g, '&quot;') + '" title="' + vt('viewer.deco.filterByTag', item.parsedTag.replace(/"/g, '&quot;')) + '">' + item.parsedTag + '</span>';
    }
    if (!isBlank && item.headTags && item.headTags.length > 0 && typeof renderHeadTagChips === 'function') {
        tagHtml += renderHeadTagChips(item.headTags);
        if (typeof headTagsTitle === 'function') tagTitle = headTagsTitle(item.headTags);
    }
    if (tagHtml) parts.push({ key: 'tag', html: tagHtml, title: tagTitle });
    return parts;
}

/* Legacy inline-block prefix — used by render paths not yet migrated to the
   grid (.cols) model. The grid path uses getDecorationCells() instead. The two
   trailing &nbsp; keep a gap before the message; copy output (viewer-copy.ts)
   still emits a '»' separator because plain text has no columns to anchor to. */
function getDecorationPrefix(item, idx, hiddenAfter) {
    var parts = buildDecoParts(item, idx, hiddenAfter);
    if (parts.length === 0) return '';
    var htmls = parts.map(function (p) { return p.html; });
    return '<span class="line-decoration">' + htmls.join('&nbsp; ') + '&nbsp;&nbsp;' + '</span>';
}

/* Grid cell renderer (plan 055). Each part becomes its own .deco-cell placed in
   a fixed grid column (.deco-cell-<key>) and clipping to its own track, so no
   part can paint over a neighbor or the message. The .line-decoration wrapper is
   display:contents (viewer-styles-columns.ts) so the cells are direct grid items
   of the row. The tag gets .ellipsis (variable width). */
function getDecorationCells(item, idx, hiddenAfter) {
    var parts = buildDecoParts(item, idx, hiddenAfter);
    if (parts.length === 0) return '';
    var cells = '';
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var ell = (p.key === 'tag') ? ' ellipsis' : '';
        /* Optional whole-cell tooltip (head-tag column uses it for the full tag
           list behind +N / an ellipsis-clipped name). Title text is pre-escaped
           by the part builder. */
        var titleAttr = p.title ? ' title="' + p.title + '"' : '';
        cells += '<span class="deco-cell deco-cell-' + p.key + ell + '"' + titleAttr + '>' + p.html + '</span>';
    }
    return '<span class="line-decoration">' + cells + '</span>';
}
`;
}
