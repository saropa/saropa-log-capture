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
/* getCategoryBadge / categoryBadgeColors / showCategoryBadges moved to
   viewer-deco-content.ts (plan 055) to keep this file under the 300-LOC cap.
   They remain global in the shared webview scope, so renderItem still calls
   getCategoryBadge() below. */
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
        /* Markdown headings: tag the line with its level (CSS sizes/centers the text) and
           pin the row to its computed height so the taller heading row matches the scroll
           math calcItemHeight() produced — block-flow rows derive position from real DOM
           height, so an unpinned heading would drift the prefix sums. */
        var _hCls = '', _hStyle = '';
        if (fileMode === 'markdown') {
            /* Heading rows carry their level class (font + flex centering); other non-code,
               non-blank lines get the padded class for readable line spacing. Either way the
               row height is pinned inline to the value calcItemHeight() produced so the taller
               rows match the scroll math exactly (block-flow rows derive position from real
               DOM height — an unpinned tall row would drift the prefix sums). */
            if (item._mdHeadingLevel) _hCls = ' fmt-md-h' + item._mdHeadingLevel;
            else if (!item._mdFence && !_fmtBlank) _hCls = ' fmt-md-pad';
            if (item.height > 0) _hStyle = ' style="height:' + item.height + 'px"';
        }
        return '<div class="line fmt-' + fileMode + _fmtBlankCls + _hCls + '"' + idxAttr + _hStyle + '>' + fmtHtml + '</div>';
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
        } else if (item.type === 'stack-header' && item.frameCount > 1) {
            // Multi-frame stack-header: separate visually from a preceding non-stack line.
            // Single-frame synthesized stack-headers (Dart Trace.toString() with one frame)
            // fall through to the next branch and get the same level-transition spacing
            // as a normal log line — they are rendered through the regular .line path
            // (see the frameCount > 1 guard on the renderStackHeader dispatch below).
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
            ? ' title="' + vt('viewer.marker.collapsed', item.markerCollapseCount) + '"'
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
    /* Stack-gutter-spacer retired. It existed to compensate for the OLD
       inline .stack-toggle ▶ chevron on stack-header rows (regular rows
       got an invisible-▶ spacer of the same width to keep columns aligned).
       Now the chevron lives in the counter-row column on BOTH stack-headers
       AND regular rows, so any compensating spacer would be a one-sided
       shift — and was exactly the cause of "_StringStackTrace doesn't align
       with the message column" the user kept reporting. */
    var stackGutter = '';
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
    if (item.type === 'stack-header' && item.frameCount > 1) {
        /* Multi-frame trace: render as a chevron-bearing collapsible header.
           Delegated to viewer-data-helpers-render-stack.ts (renderStackHeader).
           Single-frame "traces" (Dart Trace.toString() output where one log
           message has a one-frame stack — common pattern in contacts app
           audit/log calls) fall through to the regular .line render path
           below. There is nothing to expand/collapse with one frame, and the
           .stack-header HTML composition (hdrDeco + hdrQb + html.trim()) is
           missing the elapsed / badge / catBadge prefix elements that regular
           .line rows carry, so a synthesized header sits visually left of the
           parent log message above it. Falling through restores column
           alignment with the parent line. */
        return renderStackHeader(item, idx, html, spacingCls, matchCls, barCls, idxAttr);
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
        // Regex-match leading [LABEL] only when present. Prior split-on-']' captured the whole body and fabricated a ']' when stripSourceTagPrefix had already removed the bracket (line 65) — caused AI rows to render the body twice.
        var _aiBracketMatch = /^((?:<[^>]*>)*)\\[([^\\]]+)\\]\\s*/.exec(html);
        var aiPrefix = '', aiBody = html;
        if (_aiBracketMatch) {
            aiPrefix = _aiBracketMatch[1] + '<span class="ai-prefix">[' + escapeHtml(_aiBracketMatch[2]) + ']</span>';
            aiBody = html.substring(_aiBracketMatch[0].length);
        }
        var aiCompress = '';
        if (item.compressDupCount > 1) { aiCompress = '<span class="compress-dup-badge" title="' + vt('viewer.deco.identicalLines', item.compressDupCount) + '">(×' + item.compressDupCount + ')</span> '; }
        // Prefix chain parity. .ai-line rail draws via box-shadow:inset (viewer-styles-ai.ts) — out of flow, doesn't shift line-number column.
        var _aiGap = (typeof getSlowGapHtml === 'function') ? getSlowGapHtml(item, idx) : '', _aiDeco = (typeof getDecorationPrefix === 'function') ? getDecorationPrefix(item, idx, item._hiddenAfter) : '', _aiElapsed = (typeof getElapsedPrefix === 'function') ? getElapsedPrefix(item, idx) : '';
        // Severity classes parity with regular branch — AI rows now show gutter dot + tint when classifyLevel tagged them (prior AI branch silently suppressed both).
        var _aiBar = (typeof decoShowBar !== 'undefined' && decoShowBar && !item.isContext && item.level) ? ' level-bar-' + item.level : '';
        var _aiLvlCls = ((typeof lineColorsEnabled !== 'undefined' && lineColorsEnabled) && item.level && !item.isContext) ? ' level-' + item.level : '';
        return _aiGap + '<div class="line ai-line ' + aiCat + matchCls + spacingCls + _aiBar + _aiLvlCls + '"' + idxAttr + '>' + _aiDeco + _aiElapsed + aiPrefix + aiCompress + aiBody + '</div>';
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
    /* Shimmer-once gate. renderViewport() rebuilds the whole visible DOM from
       scratch on every scroll / incoming-line render (atomic replaceChildren
       swap — see viewer-data-viewport.ts), so a CSS animation on the bare
       art-block-* class would restart from iteration 0 on every rebuild and
       read as a perpetual sweep no matter its iteration-count. Emit the
       shimmer-triggering class only the FIRST time a row is rendered, latched
       by a per-item flag, so the single sweep plays on arrival and never
       re-triggers when the row is recreated by a later viewport rebuild. */
    if (abp && !item._artShimmered) {
        sepCls += ' art-shimmer-play';
        item._artShimmered = true;
    }
    var isArtCont = (abp === 'middle' || abp === 'end');
    /* ALL art-block rows (start/middle/end) stay on the legacy flat layout, NOT
       the gutter grid: the block draws a continuous left border + box-drawing
       glyphs that must align edge-to-edge, which the grid's padding + columns
       break. Migrating only the start row (as the first cut did) split the box —
       its top sat in the grid while the sides stayed flat. Gate the whole block. */
    var isArtBlock = abp === 'start' || isArtCont;
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
            ? vt('viewer.deco.contExpand', item.contChildCount)
            : vt('viewer.deco.contCollapse', item.contChildCount);
        contBadge = '<span class="' + contCls + '" data-cont-gid="' + item.contGroupId + '" title="' + contTip + '">' + contLabel + '</span>';
    }
    /* idx is the allLines position; getDecorationPrefix prefers item.sourceLineNo (stamped at
       line arrival from the raw file) and falls back to idx+1 only when no source line is
       available. Blank-line counter gated by decoShowCounterOnBlank.
       3rd arg item._hiddenAfter (stamped by computeRowAffordances in the
       render pre-pass): when this row has filter-hidden lines below it the
       prefix builder emits a ▶ chevron right of the line number with the
       gap's count and click route. dedup-fold survivors get the same
       chevron treatment via item.compressDupCount, peek-trigger rows via
       item._triggeredPeekKey — see getCounterAffordance for the priority
       order. No floating chips, no tag replacement, no overlay collisions. */
    /* Grid column model (plan 055): emit one clipping .deco-cell per part. The
       continuation badge no longer splices into the prefix — it renders at the
       start of the .line-msg cell below. Art-block-start keeps the LEGACY inline
       prefix (it renders on the flat, non-grid path with its sibling rows). */
    var deco = isArtCont ? ''
        : (isArtBlock
            ? ((typeof getDecorationPrefix === 'function') ? getDecorationPrefix(item, idx, item._hiddenAfter) : '')
            : ((typeof getDecorationCells === 'function') ? getDecorationCells(item, idx, item._hiddenAfter) : ''));
    var annHtml = (typeof getAnnotationHtml === 'function') ? getAnnotationHtml(idx) : '';
    var badge = '';
    if (typeof getErrorBadge === 'function' && item.errorClass) badge = getErrorBadge(item.errorClass);
    /* ANR marker: gutter icon (absolute, .error-badge-gutter) for the same reason
       as the bug/transient badges — an inline "⏱ ANR" pill shifted the line text. */
    if (!badge && item.isAnr) badge = '<span class="error-badge-gutter error-badge-anr" title="' + vt('viewer.deco.anr') + '" aria-label="' + vt('viewer.deco.anr') + '">\\u23f1</span>';
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
        var recTip = vt('viewer.deco.recentErrorContext');
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
    /* Dedup-fold affordance now lives in the line-number column (chevron
       wrapper in deco). No trailing chip after html anymore — see the
       counter-row affordance in buildDecoParts. */
    var baseCls = 'line' + cat + levelCls + sepCls + ctxCls + matchCls + tintCls + barCls + blankCls + spacingCls + bannerCls + dbTsBurstCls;
    var msgInner = contBadge + elapsed + badge + catBadge + html;
    /* Art-block rows (start/middle/end) keep the legacy flat structure: their
       continuous border + box-drawing alignment break under the gutter grid.
       Not migrated to .cols (plan 055 phasing). */
    if (isArtBlock) {
        return gap + '<div class="' + baseCls + '"' + idxAttr + titleAttr + '>' + stackGutter + deco + msgInner + '</div>' + annHtml;
    }
    /* Grid column model: each decoration datum is its own clipping cell; the
       message is a separate .line-msg cell (min-width:0) so nothing can paint
       over it. See viewer-styles-columns.ts. */
    return gap + '<div class="' + baseCls + ' cols log-cols"' + idxAttr + titleAttr + '>' + deco + '<span class="line-msg">' + msgInner + '</span></div>' + annHtml;
}
`;
}
