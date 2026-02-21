/**
 * Helper functions for viewer data processing and rendering.
 *
 * Contains repeat detection, separator detection, context extraction,
 * height calculation, and item rendering logic.
 */
export function getViewerDataHelpers(): string {
    return /* javascript */ `
/**
 * Escape HTML special characters to prevent XSS in rendered content.
 * Used by repeat notifications, edit modal, and session header.
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Real-time repeat detection for duplicate log lines.
 * Tracks recent message hashes and shows repeat notifications.
 */
var repeatTracker = {
    lastHash: null,
    lastPlainText: null,
    lastLevel: null,
    count: 0,
    lastTimestamp: 0
};
var anrPattern = /\\b(anr|application\\s+not\\s+responding|input\\s+dispatching\\s+timed\\s+out)\\b/i;
var repeatWindowMs = 3000; // 3 second window for detecting repeats
var repeatPreviewLength = 85; // Characters to show in repeat preview

/**
 * Generate a hash for repeat detection.
 * Uses level + message content (first 200 chars) for smart grouping.
 */
function generateRepeatHash(level, plainText) {
    var preview = plainText.substring(0, 200).trim();
    return level + '::' + preview;
}

/**
 * Detect if a line is ASCII art (separators, box-drawing, banners, etc.).
 * Returns true if at least 60% of the line consists of ASCII art characters.
 */
function isSeparatorLine(plainText) {
    var trimmed = plainText.trim();
    if (trimmed.length < 3) return false;

    // Expanded pattern to include box-drawing and common ASCII art characters
    // Includes: = - + * _ # ~ | / \\\\ < > [ ] { } ( ) ^ v and Unicode box chars
    var artChars = /[=+*_#~|/\\\\\\\\<>\\\\[\\\\]{}()^v─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬\\\\-]/;
    var artCount = 0;
    for (var i = 0; i < trimmed.length; i++) {
        if (artChars.test(trimmed[i]) || trimmed[i] === ' ') artCount++;
    }
    // Lowered threshold to 60% to catch more ASCII art patterns
    return (artCount / trimmed.length) >= 0.6;
}

/**
 * Extract context metadata from stack frame text.
 * Parses patterns like:
 * - "at functionName (file.js:123:45)"
 * - "functionName@file.js:123:45"
 * - "file.js:123:45 in functionName"
 * @returns {object|null} {file, func, line} or null if not a stack frame
 */
function extractContext(plainText) {
    // Pattern: "at functionName (file.js:123:45)" or "at file.js:123:45"
    var atMatch = /at\\s+(?:(.+?)\\s+\\()?([^\\s()]+?):(\\d+)(?::(\\d+))?\\)?/.exec(plainText);
    if (atMatch) {
        return {
            file: atMatch[2] || '',
            func: atMatch[1] || '',
            line: atMatch[3] || ''
        };
    }

    // Pattern: "functionName@file.js:123:45"
    var mozMatch = /([^@]+)@([^:]+):(\\d+)(?::(\\d+))?/.exec(plainText);
    if (mozMatch) {
        return {
            file: mozMatch[2] || '',
            func: mozMatch[1] || '',
            line: mozMatch[3] || ''
        };
    }

    return null;
}

/**
 * Calculate the height of a log item based on its type and filter state.
 */
function calcItemHeight(item) {
    if (item.filteredOut || item.excluded || item.levelFiltered || item.sourceFiltered || item.classFiltered || item.searchFiltered || item.errorSuppressed || item.scopeFiltered) return 0;
    if (item.type === 'marker') return MARKER_HEIGHT;
    var isAppOnly = (typeof appOnlyMode !== 'undefined' && appOnlyMode);
    if (item.type === 'stack-frame' && item.groupId >= 0) {
        var header = (typeof groupHeaderMap !== 'undefined') ? groupHeaderMap[item.groupId] : null;
        if (!header) return 0;
        if (header.collapsed === true) return 0;
        if (header.collapsed === false) {
            return (isAppOnly && item.fw) ? 0 : ROW_HEIGHT;
        }
        if (header.collapsed === 'preview') {
            if (item.fw) return 0;
            var appIdx = (item._appFrameIdx !== undefined) ? item._appFrameIdx : -1;
            return (appIdx >= 0 && appIdx < (header.previewCount || 3)) ? ROW_HEIGHT : 0;
        }
        return 0;
    }
    if (isAppOnly && item.fw) return 0;
    return ROW_HEIGHT;
}

/**
 * Renders a single log item to HTML.
 * Handles markers, stack frames, and regular lines with appropriate styling.
 * Applies search highlighting, pattern highlights, and category styling.
 */
function renderItem(item, idx) {
    var idxAttr = ' data-idx="' + idx + '"';
    var html = (typeof highlightSearchInHtml === 'function') ? highlightSearchInHtml(item.html) : item.html;

    var matchCls = (typeof isCurrentMatch === 'function' && isCurrentMatch(idx)) ? ' current-match'
        : (typeof isSearchMatch === 'function' && isSearchMatch(idx)) ? ' search-match' : '';

    // Compute visual spacing classes before early returns so all item types benefit
    var spacingCls = '';
    if (typeof visualSpacingEnabled !== 'undefined' && visualSpacingEnabled) {
        var spPrev = idx > 0 ? allLines[idx - 1] : null;
        if (item.type === 'marker') {
            if (spPrev) spacingCls += ' spacing-before';
            spacingCls += ' spacing-after';
        } else if (item.type === 'stack-header') {
            if (spPrev && spPrev.type !== 'stack-frame' && spPrev.type !== 'stack-header') {
                spacingCls += ' spacing-before';
            }
        } else if (item.type !== 'stack-frame' && item.type !== 'repeat-notification') {
            if (spPrev && spPrev.type !== 'marker') {
                if (item.level && spPrev.level && item.level !== spPrev.level) {
                    spacingCls += ' spacing-before';
                } else if (item.isSeparator && !spPrev.isSeparator) {
                    spacingCls += ' spacing-before';
                }
            }
        }
    }

    if (item.type === 'marker') {
        return '<div class="marker' + spacingCls + '"' + idxAttr + '>' + html + '</div>';
    }

    if (item.type === 'repeat-notification') {
        return '<div class="line' + matchCls + '"' + idxAttr + '>' + html + '</div>';
    }

    if (item.type === 'stack-header') {
        var ch, sf;
        if (item.collapsed === true) {
            ch = '\\\\u25b6'; // Collapsed
            sf = item.frameCount > 1 ? '  [+' + (item.frameCount - 1) + ' frames]' : '';
        } else if (item.collapsed === false) {
            ch = '\\\\u25bc'; // Fully expanded
            sf = '';
        } else {
            // Preview mode
            ch = '\\\\u25b7'; // Different arrow for preview
            var appFrames = item._appFrameCount || 0;
            var totalFrames = item.frameCount || 0;
            var fwFrames = totalFrames - appFrames;
            var hiddenCount = Math.max(0, appFrames - (item.previewCount || 3)) + fwFrames;
            sf = hiddenCount > 0 ? '  [+' + hiddenCount + ' more]' : '';
        }
        var dup = item.dupCount > 1 ? ' <span class="stack-dedup-badge">(x' + item.dupCount + ')</span>' : '';
        return '<div class="stack-header' + matchCls + spacingCls + '"' + idxAttr + ' data-gid="' + item.groupId + '">' + ch + ' ' + html.trim() + dup + sf + '</div>';
    }

    if (item.type === 'stack-frame') {
        return '<div class="line stack-line' + (item.fw ? ' framework-frame' : '') + matchCls + '"' + idxAttr + '>' + html + '</div>';
    }

    // AI activity lines get a distinct prefix and CSS class
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

    // Add error classification badge if applicable
    var badge = '';
    if (typeof getErrorBadge === 'function' && item.errorClass) {
        badge = getErrorBadge(item.errorClass);
    }
    if (!badge && item.isAnr) {
        badge = '<span class="error-badge error-badge-anr" title="ANR Pattern Detected">\\u23f1 ANR</span> ';
    }

    var titleAttr = '';
    if (typeof applyHighlightStyles === 'function') {
        var plainText = stripTags(item.html);
        var hl = applyHighlightStyles(html, plainText);
        html = hl.html;
        titleAttr = hl.titleAttr;
    }
    if (typeof wrapTagLink === 'function') {
        if (item.logcatTag) { html = wrapTagLink(html, item.logcatTag); }
        if (item.sourceTag) { html = wrapTagLink(html, item.sourceTag); }
    }

    var ctxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
    var tintCls = (typeof getLineTintClass === 'function' && !item.isContext) ? getLineTintClass(item) : '';

    // Add severity bar class if enabled
    var barCls = '';
    if (typeof decoShowBar !== 'undefined' && decoShowBar && item.level && !item.isContext) {
        if (item.fw) {
            barCls = ' level-bar-framework';
        } else {
            barCls = ' level-bar-' + item.level;
        }
    }

    return gap + '<div class="line' + cat + levelCls + sepCls + ctxCls + matchCls + tintCls + barCls + spacingCls + '"' + idxAttr + titleAttr + '>' + deco + elapsed + badge + html + '</div>' + annHtml;
}
`;
}
