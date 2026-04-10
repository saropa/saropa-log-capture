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
    'db-insight': '#c586c0',
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
    var rawHtml = item.html;
    if (typeof stripSourceTagPrefix !== 'undefined' && stripSourceTagPrefix && item.sourceTag) {
        rawHtml = rawHtml.replace(/^\\[([^\\]]+)\\]\\s?/, '');
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
        } else if (item.type !== 'stack-frame' && item.type !== 'repeat-notification' && item.type !== 'n-plus-one-insight') {
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
        return '<div class="marker' + spacingCls + '"' + idxAttr + '>' + html + '</div>';
    }
    if (item.type === 'run-separator') {
        var rs = item.runSummary;
        if (!rs) return '<div class="run-separator"' + idxAttr + '></div>';
        var startStr = (typeof formatRunTime === 'function') ? formatRunTime(rs.startTime) : '--:--:--';
        var endStr = (typeof formatRunTime === 'function') ? formatRunTime(rs.endTime) : '--:--:--';
        var durStr = (typeof formatDuration === 'function') ? formatDuration(rs.durationMs) : '';
        var runNum = (item.runIndex != null) ? item.runIndex + 1 : 0;
        var dots = '';
        if (rs.errors > 0) dots += '<span class="run-sep-dot run-sep-dot-error" title="Errors">' + rs.errors + '</span>';
        if (rs.warnings > 0) dots += '<span class="run-sep-dot run-sep-dot-warning" title="Warnings">' + rs.warnings + '</span>';
        if (rs.perfs > 0) dots += '<span class="run-sep-dot run-sep-dot-perf" title="Perf">' + rs.perfs + '</span>';
        if (rs.infos > 0) dots += '<span class="run-sep-dot run-sep-dot-info" title="Info">' + rs.infos + '</span>';
        if (!dots) dots = '<span class="run-sep-dot run-sep-dot-none">0</span>';
        return '<div class="run-separator"' + idxAttr + '><div class="run-separator-inner">' +
            '<span class="run-sep-title">Run ' + runNum + '</span>' +
            '<span class="run-sep-times">' + startStr + ' \\u2013 ' + endStr + '</span>' +
            '<span class="run-sep-duration">' + durStr + '</span>' +
            '<span class="run-sep-counts">' + dots + '</span></div></div>';
    }
    if (item.type === 'repeat-notification' || item.type === 'n-plus-one-insight') {
        return '<div class="line' + matchCls + '"' + idxAttr + '>' + html + '</div>';
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
        // Unicode triangles for state: ▶ collapsed, ▼ expanded, ▷ preview (code uses \\u25b6/\\u25bc/\\u25b7)
        var ch, sf;
        if (item.collapsed === true) {
            ch = '\u25b6';
            sf = item.frameCount > 1 ? '  [+' + (item.frameCount - 1) + ' frames]' : '';
        } else if (item.collapsed === false) { ch = '\u25bc'; sf = ''; }
        else {
            ch = '\u25b7';
            var appFrames = item._appFrameCount || 0;
            var totalFrames = item.frameCount || 0;
            var fwFrames = totalFrames - appFrames;
            var hiddenCount = Math.max(0, appFrames - (item.previewCount || 3)) + fwFrames;
            sf = hiddenCount > 0 ? '  [+' + hiddenCount + ' more]' : '';
        }
        var dup = item.dupCount > 1 ? ' <span class="stack-dedup-badge">(x' + item.dupCount + ')</span>' : '';
        var hdrQb = (typeof getQualityBadge === 'function') ? getQualityBadge(item) : '';
        var hdrHeat = (item.qualityPercent != null && typeof decoShowQuality !== 'undefined' && decoShowQuality) ? (item.qualityPercent >= 80 ? ' line-quality-high' : (item.qualityPercent >= 50 ? ' line-quality-med' : ' line-quality-low')) : '';
        return '<div class="stack-header' + matchCls + spacingCls + barCls + hdrHeat + '"' + idxAttr + ' data-gid="' + item.groupId + '">' + ch + ' ' + hdrQb + html.trim() + dup + sf + '</div>';
    }
    if (item.type === 'stack-frame') {
        var sfQb = (typeof getQualityBadge === 'function') ? getQualityBadge(item) : '';
        var sfHeat = (item.qualityPercent != null && typeof decoShowQuality !== 'undefined' && decoShowQuality) ? (item.qualityPercent >= 80 ? ' line-quality-high' : (item.qualityPercent >= 50 ? ' line-quality-med' : ' line-quality-low')) : '';
        return '<div class="line stack-line' + (item.fw ? ' framework-frame' : '') + matchCls + barCls + sfHeat + '"' + idxAttr + '>' + sfQb + html + '</div>';
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
    /* idx passed so decoration can show file line number (idx+1); blank-line counter gated by decoShowCounterOnBlank. */
    var deco = isArtCont ? '' : ((typeof getDecorationPrefix === 'function') ? getDecorationPrefix(item, idx) : '');
    var annHtml = (typeof getAnnotationHtml === 'function') ? getAnnotationHtml(idx) : '';
    var badge = '';
    var compressDupBadge = '';
    if (item.compressDupCount > 1) {
        compressDupBadge = '<span class="compress-dup-badge" title="' + item.compressDupCount + ' identical lines">(×' + item.compressDupCount + ')</span> ';
    }
    if (typeof getErrorBadge === 'function' && item.errorClass) badge = getErrorBadge(item.errorClass);
    if (!badge && item.isAnr) badge = '<span class="error-badge error-badge-anr" title="ANR Pattern Detected">\\u23f1 ANR</span> ';
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
    var contBadge = '';
    if (item.contChildCount > 0 && item.contGroupId >= 0) {
        var contCls = item.contCollapsed ? 'cont-badge' : 'cont-badge cont-badge-expanded';
        var contLabel = item.contCollapsed ? '[+' + item.contChildCount + ' lines]' : '[\\u2212' + item.contChildCount + ' lines]';
        var contTip = item.contCollapsed ? 'Click to expand ' + item.contChildCount + ' continuation lines' : 'Click to collapse continuation lines';
        contBadge = ' <span class="' + contCls + '" data-cont-gid="' + item.contGroupId + '" title="' + contTip + '">' + contLabel + '</span>';
    }
    var catBadge = getCategoryBadge(item);
    return gap + '<div class="line' + cat + levelCls + sepCls + ctxCls + matchCls + tintCls + barCls + blankCls + spacingCls + '"' + idxAttr + titleAttr + '>' + deco + elapsed + badge + compressDupBadge + catBadge + html + contBadge + '</div>' + annHtml;
}
`;
}
