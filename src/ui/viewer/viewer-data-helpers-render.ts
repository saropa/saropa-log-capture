/**
 * renderItem() for the log viewer — item-to-HTML rendering.
 * Extracted to keep viewer-data-helpers.ts under the line limit.
 */
export function getViewerDataHelpersRender(): string {
    return /* javascript */ `
function renderItem(item, idx, prevVis) {
    var idxAttr = ' data-idx="' + idx + '"';
    var html = (typeof highlightSearchInHtml === 'function') ? highlightSearchInHtml(item.html) : item.html;
    var matchCls = (typeof isCurrentMatch === 'function' && isCurrentMatch(idx)) ? ' current-match'
        : (typeof isSearchMatch === 'function' && isSearchMatch(idx)) ? ' search-match' : '';
    var spacingCls = '';
    if (typeof visualSpacingEnabled !== 'undefined' && visualSpacingEnabled) {
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
        } else if (item.type !== 'stack-frame' && item.type !== 'repeat-notification') {
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
    if (item.type === 'repeat-notification') {
        return '<div class="line' + matchCls + '"' + idxAttr + '>' + html + '</div>';
    }
    var isBlank = isLineContentBlank(item);
    var barCls = '';
    if (typeof decoShowBar !== 'undefined' && decoShowBar && !item.isContext) {
        var level = item.level;
        // Blank lines: inherit severity bar from previous line for visual continuity (no decoration prefix).
        if (isBlank && idx > 0 && typeof allLines !== 'undefined' && allLines[idx - 1] && allLines[idx - 1].level) {
            level = allLines[idx - 1].level;
            var prevFw = allLines[idx - 1].fw;
            var hasSeverity = level === 'error' || level === 'warning' || level === 'performance';
            barCls = (prevFw && !hasSeverity) ? ' level-bar-framework' : ' level-bar-' + level;
        } else if (!isBlank && level) {
            var hasSeverity = level === 'error' || level === 'warning' || level === 'performance';
            barCls = (item.fw && !hasSeverity) ? ' level-bar-framework' : ' level-bar-' + level;
        }
    }
    if (item.type === 'stack-header') {
        // Unicode triangles for state: ▶ collapsed, ▼ expanded, ▷ preview (use \u25b6/\u25bc/\u25b7, not literal \u strings)
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
        return '<div class="line ai-line ' + aiCat + matchCls + spacingCls + '"' + idxAttr + '>' + aiPrefix + aiBody + '</div>';
    }
    var cat = item.category === 'stderr' ? ' cat-stderr' : '';
    var fwMuted = (typeof deemphasizeFrameworkLevels !== 'undefined' && deemphasizeFrameworkLevels && item.fw);
    var lcOn = (typeof lineColorsEnabled !== 'undefined' && lineColorsEnabled);
    var levelCls = (lcOn && item.level && !item.isContext && !fwMuted) ? ' level-' + item.level : '';
    var sepCls = item.isSeparator ? ' separator-line' : '';
    var gap = (typeof getSlowGapHtml === 'function') ? getSlowGapHtml(item, idx) : '';
    var elapsed = (typeof getElapsedPrefix === 'function') ? getElapsedPrefix(item, idx) : '';
    var deco = (typeof getDecorationPrefix === 'function') ? getDecorationPrefix(item) : '';
    var annHtml = (typeof getAnnotationHtml === 'function') ? getAnnotationHtml(idx) : '';
    var badge = '';
    if (typeof getErrorBadge === 'function' && item.errorClass) badge = getErrorBadge(item.errorClass);
    if (!badge && item.isAnr) badge = '<span class="error-badge error-badge-anr" title="ANR Pattern Detected">\\u23f1 ANR</span> ';
    if (typeof getQualityBadge === 'function') badge += getQualityBadge(item);
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
    var ctxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
    var tintCls = (typeof getLineTintClass === 'function' && !item.isContext) ? getLineTintClass(item) : '';
    if (isBlank && idx > 0 && typeof allLines !== 'undefined' && allLines[idx - 1] && allLines[idx - 1].level) {
        tintCls = ' line-tint-' + allLines[idx - 1].level;
    }
    var blankCls = isBlank ? ' line-blank' : '';
    return gap + '<div class="line' + cat + levelCls + sepCls + ctxCls + matchCls + tintCls + barCls + blankCls + spacingCls + '"' + idxAttr + titleAttr + '>' + deco + elapsed + badge + html + '</div>' + annHtml;
}
`;
}
