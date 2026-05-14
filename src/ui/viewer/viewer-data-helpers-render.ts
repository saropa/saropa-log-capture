/**
 * renderItem() for the log viewer — item-to-HTML rendering.
 * Extracted to keep viewer-data-helpers.ts under the line limit.
 *
 * Severity coloring on device lines is handled by the tier system:
 * - Device-other lines have their level demoted to `info` at capture in `addToData()`,
 *   so they never show red/yellow regardless of logcat prefix.
 * - Device-critical lines keep their real severity (e.g. `E/AndroidRuntime` shows red).
 * The severity gutter always uses `level-bar-{item.level}` so dot/connector color matches text.
 */

import {
  VIEWER_RENDER_EMBED_LINE_DB_TS_BURST,
  VIEWER_RENDER_EMBED_MARKER_BURST_EDGE,
} from "./viewer-data-helpers-render-db-ts-burst-snips";
import { VIEWER_RENDER_EMBED_RUN_SEPARATOR } from "./viewer-data-helpers-render-run-separator-snip";

export function getViewerDataHelpersRender(): string {
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
    return '<span class="category-badge" style="--cat-clr:' + clr + '" title="Output channel: ' + label + '">' + label + '</span> ';
}

function renderItem(item, idx, prevVis) {
    var idxAttr = ' data-idx="' + idx + '"';
    /* Structured file formatting (plan 051): when format toggle is on for
       a non-log file, delegate to the mode-specific formatter. */
    if (fileMode !== 'log' && formatEnabled && item.type === 'line') {
        var fmtHtml = '';
        if (fileMode === 'markdown' && typeof formatMarkdownLine === 'function') fmtHtml = formatMarkdownLine(item, idx);
        else if (fileMode === 'json' && typeof formatJsonLine === 'function') fmtHtml = formatJsonLine(item, idx);
        else if (fileMode === 'csv' && typeof formatCsvLine === 'function') fmtHtml = formatCsvLine(item, idx);
        else fmtHtml = item.html;
        /* Same .line.line-blank quarter-height as plain log mode (viewer-styles-decoration-bars). */
        var _fmtBlank = typeof isLineContentBlank === 'function' && isLineContentBlank(item);
        var _fmtBlankCls = _fmtBlank ? ' line-blank' : '';
        return '<div class="line fmt-' + fileMode + _fmtBlankCls + '"' + idxAttr + '>' + fmtHtml + '</div>';
    }
    var rawHtml = item.html;
    /* Structured line parsing: strip the detected prefix (timestamp, PID, TID, level, tag).
       When active, this subsumes source-tag stripping for structured formats.
       parseStructuredPrefix already accounts for leading [bracket] pairs
       (e.g. [11:49:55.128] [logcat]) in the prefixLen, so one stripHtmlPrefix
       call removes brackets + structured prefix together. */
    if (typeof structuredLineParsing !== 'undefined' && structuredLineParsing && item.structuredPrefixLen > 0) {
        rawHtml = (typeof stripHtmlPrefix === 'function') ? stripHtmlPrefix(rawHtml, item.structuredPrefixLen) : rawHtml;
    } else if (typeof stripSourceTagPrefix !== 'undefined' && stripSourceTagPrefix && item.sourceTag) {
        /* Strip ALL leading [bracket] pairs — DAP adapters may prepend multiple
           (e.g. [11:49:55.128] [stdout]) and we only want the message body. */
        rawHtml = rawHtml.replace(/^(?:\\[[^\\]]+\\]\\s?)+/, '');
    }
    var html = (typeof highlightSearchInHtml === 'function') ? highlightSearchInHtml(rawHtml) : rawHtml;
    var matchCls = (typeof isCurrentMatch === 'function' && isCurrentMatch(idx)) ? ' current-match'
        : (typeof isSearchMatch === 'function' && isSearchMatch(idx)) ? ' search-match' : '';
    var spacingCls = '';
    if (typeof visualSpacingEnabled !== 'undefined' && visualSpacingEnabled && !item.artBlockPos) {
        var spPrev = null;
        if (prevVis !== undefined) { spPrev = prevVis; }
        else {
            for (var sp = idx - 1; sp >= 0; sp--) {
                if (allLines[sp].height > 0) { spPrev = allLines[sp]; break; }
            }
        }
        if (item.type === 'marker') {
            if (spPrev) spacingCls += ' spacing-before';
            spacingCls += ' spacing-after';
        } else if (item.isContextFirst) {
            // No spacing-before for context lines; gap goes after the error instead
        } else if (item.type === 'stack-header') {
            if (spPrev && spPrev.type !== 'stack-frame' && spPrev.type !== 'stack-header') spacingCls += ' spacing-before';
        } else if (item.type !== 'stack-frame' && item.type !== 'repeat-notification' && item.type !== 'n-plus-one-signal') {
            if (spPrev && spPrev.type !== 'marker') {
                if (item.level && spPrev.level && item.level !== spPrev.level) spacingCls += ' spacing-before';
                else if (item.isSeparator && !spPrev.isSeparator) spacingCls += ' spacing-before';
            }
        }
        // Add spacing after lines that end a context group (target of filtered level)
        if (!item.isContext && item.type !== 'marker' && spPrev && spPrev.isContext) {
            spacingCls += ' spacing-after';
        }
    }
    if (item.type === 'marker') {
        /* Collapsed runs: markerCollapseCount > 1 → title tooltip (048 / unified collapsing). */
        var _mkTitle = (item.markerCollapseCount && item.markerCollapseCount > 1)
            ? ' title="' + item.markerCollapseCount + ' adjacent identical markers collapsed into this one"'
            : '';
` +
        VIEWER_RENDER_EMBED_MARKER_BURST_EDGE +
        /* javascript */ `
        return '<div class="marker' + _burstEdgeCls + spacingCls + '"' + idxAttr + _mkTitle + '>' + html + '</div>';
    }
` +
        VIEWER_RENDER_EMBED_RUN_SEPARATOR +
        /* javascript */ `
    if (item.type === 'repeat-notification' || item.type === 'n-plus-one-signal') {
        // Defense in depth: applyLevelFilter now skips these as context anchors so they
        // shouldn't reach this branch with isContext=true, but apply the mute anyway so
        // any future code path that flips isContext on a chip renders consistently.
        var chipCtxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
        /* Tabular-column alignment: when decorations are globally on, push chip
           rows to the same content column as decorated lines via the spacer-only
           class. No real prefix is rendered (chip rows have no meaningful
           per-line counter/timestamp to display), but the CSS rule reserves
           padding-left so the chip label and any embedded drilldown panel sit
           in the same column as message text on regular lines. */
        var chipDecoCls = (typeof areDecorationsOn === 'function' && areDecorationsOn()) ? ' line-deco-spacer-only' : '';
        /* When the SQL repeat drilldown is expanded, the .line embeds a block
           <div class="sql-repeat-drilldown-detail"> child. Block children
           overflow the .line's strict 1em height and visually overlap
           subsequent rows. line-has-block flips height to auto so the row
           grows to fit the panel — matches the larger value calcItemHeight()
           returns for this case. */
        var chipBlockCls = item.sqlRepeatDrilldownOpen ? ' line-has-block' : '';
        return '<div class="line' + matchCls + chipCtxCls + chipDecoCls + chipBlockCls + '"' + idxAttr + '>' + html + '</div>';
    }
    /* Stack gutter: when any stack groups exist, non-header lines get an
       invisible spacer matching the arrow width so line numbers stay aligned. */
    var stackGutter = '';
    if (typeof nextGroupId !== 'undefined' && nextGroupId > 0 && item.type !== 'stack-header') {
        stackGutter = '<span class="stack-gutter-spacer">\\u25b6 </span>';
    }
    var isBlank = isLineContentBlank(item);
    var barCls = '';
    // Blank lines get no bar class here; the connector bridge in renderViewport() adds the
    // correct level-bar-* when the blank sits between two same-level dots.
    if (typeof decoShowBar !== 'undefined' && decoShowBar && !item.isContext && !isBlank && item.level) {
        if (item.recentErrorContext && item.level === 'error') {
            barCls = ' level-bar-error-recent-context';
        } else {
            barCls = ' level-bar-' + item.level;
        }
    }
    /* Art-block gutter: CSS border-left handles the continuous bar (not bar-up/bar-down pseudo
       which would conflict with the shimmer ::after). Only the start line keeps its dot. */
    if (item.type === 'stack-header') {
        /* Delegated to viewer-data-helpers-render-stack-header.ts.
           Moved there as part of the unified line-collapsing rethink to keep
           this file under the 300-line eslint max-lines limit. */
        return renderStackHeader(item, html, spacingCls, matchCls, barCls, idxAttr);
    }
    if (item.type === 'stack-frame') {
        /* Delegated to viewer-data-helpers-render-stack.ts. Emits inline
           .dedup-badge for cross-type dedup-fold survivors; preview-mode
           "more frames hidden" notices are pushed by the render loop in
           viewer-data-viewport.ts as sibling .viewer-divider rows. idx is
           passed so the badge can carry data-dedup-survivor-idx for the
           click delegate in viewer-peek-chevron.ts. */
        return renderStackFrame(item, idx, html, matchCls, barCls, idxAttr, stackGutter);
    }
    if (item.category && item.category.indexOf('ai-') === 0) {
        var aiCat = item.category;
        var aiPrefix = '<span class="ai-prefix">' + escapeHtml(stripTags(html).split(']')[0] + ']') + '</span>';
        var aiBody = html.indexOf('] ') >= 0 ? html.substring(html.indexOf('] ') + 2) : html;
        var aiCompress = '';
        if (item.compressDupCount > 1) {
            aiCompress = '<span class="compress-dup-badge" title="' + item.compressDupCount + ' identical lines">(×' + item.compressDupCount + ')</span> ';
        }
        return '<div class="line ai-line ' + aiCat + matchCls + spacingCls + '"' + idxAttr + '>' + aiPrefix + aiCompress + aiBody + '</div>';
    }
    var cat = (item.category === 'stderr' && stderrTreatAsError) ? ' cat-stderr' : '';
    var lcOn = (typeof lineColorsEnabled !== 'undefined' && lineColorsEnabled);
    var levelCls = (lcOn && item.level && !item.isContext) ? ' level-' + item.level : '';
    if (item.recentErrorContext && item.level === 'error' && !item.isContext) {
        levelCls += ' recent-error-context';
    }
    var sepCls = item.isSeparator ? ' separator-line' : '';
    /* Art-block classes: start gets decoration, middle/end get none. */
    var abp = item.artBlockPos;
    if (abp === 'start') sepCls += ' art-block-start';
    else if (abp === 'middle') sepCls += ' art-block-middle';
    else if (abp === 'end') sepCls += ' art-block-end';
    var isArtCont = (abp === 'middle' || abp === 'end');
    var gap = isArtCont ? '' : ((typeof getSlowGapHtml === 'function') ? getSlowGapHtml(item, idx) : '');
    var elapsed = isArtCont ? '' : ((typeof getElapsedPrefix === 'function') ? getElapsedPrefix(item, idx) : '');
    /* Compute continuation badge early so it can be injected into the
       decoration prefix (inside the .line-decoration span, near the line numbers). */
    var contBadge = '';
    if (item.contChildCount > 0 && item.contGroupId >= 0) {
        var contCls = item.contCollapsed ? 'cont-badge' : 'cont-badge cont-badge-expanded';
        var contLabel = item.contCollapsed
            ? '+' + item.contChildCount
            : '\\u2212' + item.contChildCount;
        var contTip = item.contCollapsed
            ? 'Click to expand ' + item.contChildCount + ' continuation lines'
            : 'Click to collapse ' + item.contChildCount + ' continuation lines';
        contBadge = '<span class="' + contCls + '" data-cont-gid="' + item.contGroupId + '" title="' + contTip + '">' + contLabel + '</span>';
    }
    /* idx passed so decoration can show file line number (idx+1); blank-line counter gated by decoShowCounterOnBlank. */
    var deco = isArtCont ? '' : ((typeof getDecorationPrefix === 'function') ? getDecorationPrefix(item, idx) : '');
    /* Splice continuation badge into the trailing whitespace of the decoration
       prefix (the prefix now ends '&nbsp;&nbsp;</span>' after the chevron was
       removed). The badge then sits inside the .line-decoration span, just
       before the closing tag, immediately right of the timestamp. */
    if (contBadge && deco) {
        deco = deco.replace('&nbsp;&nbsp;</span>', '&nbsp;' + contBadge + '&nbsp;</span>');
        contBadge = '';
    }
    var annHtml = (typeof getAnnotationHtml === 'function') ? getAnnotationHtml(idx) : '';
    var badge = '';
    /* Severity-gutter decoupling (plan: bugs/048_plan-severity-gutter-decoupling.md).
       The prior outlined-dot state (.bar-hidden-rows) on the dedup-fold
       survivor was overloaded with three other concepts (filter-gap peek,
       expanded peek anchor, collapsed stack header) and the dot looked
       identical for "click to expand" and "click to collapse". The
       survivor now carries a dedicated inline .dedup-badge ("×N" / "×N hide")
       at the END of its text content. Click → peekDedupFold (reveals the
       hidden duplicates listed on item.compressDupHiddenIndices) when
       collapsed, or unpeekChevron(peekAnchorKey) when expanded. */
    var dupBadge = '';
    if (item.compressDupCount > 1) {
        /* Dedup peek is "expanded" when the survivor itself carries a
           peekAnchorKey — peekDedupFold stamps both the survivor and the
           revealed duplicates with the same key so a single click on the
           badge can collapse the whole group via the same key. */
        var _dupExpanded = (item.peekAnchorKey !== undefined && item.peekAnchorKey !== null);
        var _dupLabel = '\\u00d7' + item.compressDupCount + (_dupExpanded ? ' hide' : '');
        var _dupCls = _dupExpanded ? 'dedup-badge dedup-badge-expanded' : 'dedup-badge';
        var _dupTitle = _dupExpanded
            ? item.compressDupCount + ' identical rows revealed \\u00b7 click to hide'
            : item.compressDupCount + ' identical rows collapsed here \\u00b7 click to show';
        dupBadge = '<span class="' + _dupCls + '" data-dedup-survivor-idx="' + idx + '" title="' + _dupTitle + '">' + _dupLabel + '</span>';
    }
    if (typeof getErrorBadge === 'function' && item.errorClass) badge = getErrorBadge(item.errorClass);
    /* ANR marker: gutter icon (absolute, .error-badge-gutter) for the same reason
       as the bug/transient badges — an inline "⏱ ANR" pill shifted the line text. */
    if (!badge && item.isAnr) badge = '<span class="error-badge-gutter error-badge-anr" title="ANR Pattern Detected" aria-label="ANR Pattern Detected">\\u23f1</span>';
    if (typeof getQualityBadge === 'function') badge += getQualityBadge(item);
    if (typeof getLintBadge === 'function') badge += getLintBadge(item);
    var corr = (typeof correlationByLineIndex !== 'undefined' && correlationByLineIndex[idx]);
    if (corr) badge += '<span class="correlation-badge" data-correlation-id="' + (corr.id || '').replace(/"/g, '&quot;') + '" title="' + (corr.description || '').replace(/"/g, '&quot;') + '">\\u27a4</span> ';
    var titleAttr = '';
    if (typeof applyHighlightStyles === 'function') {
        var plainText = stripTags(item.html);
        var hl = applyHighlightStyles(html, plainText);
        html = hl.html;
        titleAttr = hl.titleAttr;
    }
    if (typeof wrapTagLink === 'function') {
        if (item.logcatTag) html = wrapTagLink(html, item.logcatTag);
        if (item.sourceTag) html = wrapTagLink(html, item.sourceTag);
    }
    if (item.recentErrorContext && item.level === 'error') {
        var recTip = 'Recent-error context: not the primary faulting line; tinted because a real error or stack line occurred within 2 seconds above.';
        if (titleAttr && titleAttr.indexOf('title=\"') >= 0) {
            titleAttr = titleAttr.replace(/title=\"([^\"]*)\"/, function (_, inner) {
                return 'title=\"' + inner + ' — ' + recTip.replace(/\"/g, '&quot;') + '\"';
            });
        } else {
            titleAttr = ' title=\"' + recTip.replace(/\"/g, '&quot;') + '\"';
        }
    }
    /* Level tooltip: show the full level name (e.g. "Warning") on hover. */
    if (!titleAttr && item.levelTooltip) {
        titleAttr = ' title="' + item.levelTooltip + '"';
    }
    var ctxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
    var tintCls = (typeof getLineTintClass === 'function' && !item.isContext) ? getLineTintClass(item) : '';
    if (isBlank && idx > 0 && typeof allLines !== 'undefined' && allLines[idx - 1] && allLines[idx - 1].level) {
        tintCls = ' line-tint-' + allLines[idx - 1].level;
    }
    var blankCls = isBlank ? ' line-blank' : '';
    if (isBlank && idx > 0 && typeof allLines !== 'undefined' && allLines[idx - 1]
        && allLines[idx - 1].recentErrorContext && allLines[idx - 1].level === 'error') {
        blankCls += ' recent-error-context';
    }
    var catBadge = getCategoryBadge(item);
    /* Flutter exception banner grouping: visually connect the header/body/footer
       lines of an \`════ Exception caught by … ════\` block via banner-group-*
       CSS classes (left accent rail + background tint, rounded top/bottom).
       Applied here — not on a wrapper div — so virtualized viewport rendering
       stays a flat list and no layout reflow happens during expand/scroll. */
    var bannerCls = '';
    if (item.bannerGroupId !== undefined && item.bannerGroupId >= 0) {
        if (item.bannerRole === 'header') bannerCls = ' banner-group-start';
        else if (item.bannerRole === 'footer') bannerCls = ' banner-group-end';
        else bannerCls = ' banner-group-mid';
    }
` +
        VIEWER_RENDER_EMBED_LINE_DB_TS_BURST +
        /* javascript */ `
    /* Tail: deco → contBadge; dupBadge after line text (048 dedup affordance). */
    return gap + '<div class="line' + cat + levelCls + sepCls + ctxCls + matchCls + tintCls + barCls + blankCls + spacingCls + bannerCls + dbTsBurstCls + '"' + idxAttr + titleAttr + '>' + stackGutter + deco + contBadge + elapsed + badge + catBadge + html + dupBadge + '</div>' + annHtml;
}
`;
}
