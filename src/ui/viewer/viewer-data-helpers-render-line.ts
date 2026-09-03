/**
 * renderItem()'s non-marker, non-format-mode line path for the log viewer —
 * stack-header/stack-frame dispatch, the AI-category line, and the regular
 * .line render (badges, decoration cells, art-block/banner classes).
 * Extracted from viewer-data-helpers-render.ts to keep both files under the
 * line limit; called as the tail of renderItem() with the values it had
 * already computed (html, matchCls, spacingCls, barCls, stackGutter, isBlank).
 */

import { VIEWER_RENDER_EMBED_LINE_DB_TS_BURST } from "./viewer-data-helpers-render-db-ts-burst-snips";

export function getViewerDataHelpersRenderLineScript(): string {
    return /* javascript */ `
function renderNonMarkerLine(item, idx, idxAttr, html, matchCls, spacingCls, barCls, stackGutter, isBlank) {
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
            /* Render the [AI Edit] / [AI Bash] label as a labeled chip (brackets stripped)
               instead of plain bracketed text. Other tagged lines already chip their
               [db]/[perf] tags; AI lines were the only tagged rows left reading their
               category from an undocumented color rail alone (user report 2026-07-10).
               The chip reads --ai-rail-color (set per category on .ai-line) so its color
               matches the rail without duplicating the category-to-color map. */
            aiPrefix = _aiBracketMatch[1] + '<span class="ai-tag-chip">' + escapeHtml(_aiBracketMatch[2]) + '</span>';
            aiBody = html.substring(_aiBracketMatch[0].length);
        }
        var aiCompress = '';
        if (item.compressDupCount > 1) { aiCompress = '<span class="compress-dup-badge" title="' + vt('viewer.deco.identicalLines', item.compressDupCount) + '">(×' + item.compressDupCount + ')</span> '; }
        // Plan 055 Phase 2: AI rows join the gutter grid (.cols.log-cols) — getDecorationCells (clipping cells, same source as regular rows) + a min-width:0 .line-msg. The AI gutter mark is now the shared severity dot (level-bar-ai, below); the old box-shadow left rail was removed 2026-07-10.
        var _aiGap = (typeof getSlowGapHtml === 'function') ? getSlowGapHtml(item, idx) : '', _aiDeco = (typeof getDecorationCells === 'function') ? getDecorationCells(item, idx, item._hiddenAfter) : '', _aiElapsed = (typeof getElapsedPrefix === 'function') ? getElapsedPrefix(item, idx) : '';
        // AI rows carry ONE dedicated gutter color (level-bar-ai, magenta) rather
        // than their severity level: AI activity lines rarely have a real severity,
        // and a single AI dot color makes a run of Claude Code activity read as its
        // own joined band. Which AI action it was lives in the .ai-tag-chip. This
        // replaced the old box-shadow left rail that read as a second severity bar.
        var _aiBar = (typeof decoShowBar !== 'undefined' && decoShowBar && !item.isContext) ? ' level-bar-ai' : '';
        var _aiLvlCls = ((typeof lineColorsEnabled !== 'undefined' && lineColorsEnabled) && item.level && !item.isContext) ? ' level-' + item.level : '';
        return _aiGap + '<div class="line ai-line cols log-cols ' + aiCat + matchCls + spacingCls + _aiBar + _aiLvlCls + '"' + idxAttr + '>' + _aiDeco + '<span class="line-msg">' + _aiElapsed + aiPrefix + aiCompress + aiBody + '</span></div>';
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
    /* Collapsed start row: full rounded border (its hidden end row no longer
       supplies the bottom corners) so the lone visible row reads as a closed tab. */
    if (abp === 'start' && item.artCollapsed) sepCls += ' art-collapsed';
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
    /* DB badge: line has correlated database queries (request-ID match). Clicking opens the related-queries popover. */
    var dbq = (typeof databaseQueryLinesByIndex !== 'undefined' && databaseQueryLinesByIndex[idx]);
    if (dbq) badge += '<span class="db-query-badge" data-db-idx="' + idx + '" title="' + vt('viewer.deco.relatedQueries', dbq).replace(/"/g, '&quot;') + '">\\ud83d\\uddc3</span> ';
    /* OpenTelemetry trace badge: line carries a trace id; clicking opens the trace in the configured backend. */
    var trl = (typeof traceLinksByIndex !== 'undefined' && traceLinksByIndex[idx]);
    if (trl) badge += '<span class="trace-link-badge" data-trace-url="' + (trl.url || '').replace(/"/g, '&quot;') + '" title="' + vt('viewer.deco.openTrace', trl.traceId).replace(/"/g, '&quot;') + '">\\ud83d\\udd17</span> ';
    /* Screenshot badge (plan 114): a capture is anchored to this line; clicking opens the thumbnail popover. */
    var shot = (typeof screenshotByIdx !== 'undefined' && screenshotByIdx[idx]);
    if (shot) badge += '<span class="screenshot-badge" data-shot-file="' + (shot.file || '').replace(/"/g, '&quot;') + '" title="' + vt('viewer.deco.screenshot').replace(/"/g, '&quot;') + '">\\ud83d\\udcf7</span> ';
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
    /* Flutter exception banner grouping: tag the header/body/footer lines of an
       \`════ Exception caught by … ════\` block via banner-group-* CSS classes (a
       faint background tint — no left rail) and add a collapse chevron + hidden-line
       count to the header. Applied here — not on a wrapper div — so virtualized
       viewport rendering stays a flat list and no layout reflow happens during
       expand/scroll. */
    var bannerCls = '';
    var bannerChevron = '';
    if (item.bannerGroupId !== undefined && item.bannerGroupId >= 0) {
        if (item.bannerRole === 'header') {
            bannerCls = ' banner-group-start';
            /* Disclosure triangle reflecting the group's collapse state (collapsed by
               default). The whole header row is the click target (viewer-script-click-handlers.ts). */
            var _bCollapsed = (item.bannerCollapsed !== false);
            var _bCount = item.bannerMemberCount || 0;
            /* Tooltip mirrors the stack-header pattern: collapsed names the hidden
               count + how to expand. Full sentence via vt() — never concatenated. */
            var _bTip = (typeof vt === 'function')
                ? vt(_bCollapsed ? 'viewer.bannerHeader.collapsed' : 'viewer.bannerHeader.expanded', _bCount)
                : '';
            var _bTipAttr = _bTip ? ' title="' + _bTip + '"' : '';
            bannerChevron = '<span class="banner-chevron"' + _bTipAttr + '>' + (_bCollapsed ? '\\u25b6' : '\\u25bc') + '</span>';
            /* Visible hidden-line count when collapsed, so the folded block still tells
               the user how much it hides (reuses the existing viewer.meta.lines key). */
            if (_bCollapsed && _bCount > 0 && typeof vt === 'function') {
                bannerChevron += '<span class="banner-count">' + vt('viewer.meta.lines', _bCount) + '</span>';
            }
        }
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
    /* Flow-tag chip (plan 109): 'chips' mode swaps a [flowmap] line's raw text for a chip
       (logic in viewer-flow-tags.ts; 'raw' returns html unchanged, 'hidden' never reaches here). */
    if (typeof flowChipSwap === 'function') html = flowChipSwap(item, html);
    /* Head-tag chips ([db]/[perf]/[frame-stall]) render in their own fixed
       decoration column (deco-cell-htags via buildDecoParts), NOT inline here —
       inline chips shifted the message text and cluttered the body. The leading
       [bracket] text was already stripped above so the column is the sole home. */
    var msgInner = bannerChevron + contBadge + elapsed + badge + catBadge + html;
    /* Collapse affordance — start row only. Absolutely positioned (CSS) over the
       block's top-right corner so it never shifts the white-space:pre box art.
       Collapsed shows ▸ + the row count ("N"); expanded shows ▾. The whole block
       toggles via toggleAsciiArtBlock (click handler keys on .art-collapse-chevron). */
    var artChevron = '';
    if (abp === 'start') {
        var _artCol = !!item.artCollapsed;
        var _artGlyph = _artCol ? '\\u25B8' : '\\u25BE';
        var _artCnt = item.artBlockCount || 0;
        var _artCntHtml = (_artCol && _artCnt > 0) ? '<span class="art-collapse-count">' + _artCnt + '</span>' : '';
        var _artTip = _artCol ? vt('viewer.art.expand', _artCnt) : vt('viewer.art.collapse');
        artChevron = '<span class="art-collapse-chevron" data-art-toggle="1" title="' + _artTip + '">' + _artGlyph + _artCntHtml + '</span>';
    }
    /* Art-block rows (start/middle/end) keep the legacy flat structure: their
       continuous border + box-drawing alignment break under the gutter grid.
       Not migrated to .cols (plan 055 phasing). */
    if (isArtBlock) {
        return gap + '<div class="' + baseCls + '"' + idxAttr + titleAttr + '>' + artChevron + stackGutter + deco + msgInner + '</div>' + annHtml;
    }
    /* Grid column model: each decoration datum is its own clipping cell; the
       message is a separate .line-msg cell (min-width:0) so nothing can paint
       over it. See viewer-styles-columns.ts. */
    return gap + '<div class="' + baseCls + ' cols log-cols"' + idxAttr + titleAttr + '>' + deco + '<span class="line-msg">' + msgInner + '</span></div>' + annHtml;
}
`;
}
