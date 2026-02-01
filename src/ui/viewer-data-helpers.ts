/**
 * Helper functions for viewer data processing and rendering.
 *
 * Contains repeat detection, separator detection, context extraction,
 * height calculation, and item rendering logic.
 */
export function getViewerDataHelpers(): string {
    return /* javascript */ `
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
    var artChars = /[=\\\\-+*_#~|/\\\\\\\\<>\\\\[\\\\]{}()^v─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬]/;
    var artCount = 0;
    for (var i = 0; i < trimmed.length; i++) {
        if (artChars.test(trimmed[i]) || trimmed[i] === ' ') artCount++;
    }
    // Lowered threshold to 60% to catch more ASCII art patterns
    return (artCount / trimmed.length) >= 0.6;
}

/**
 * Whether to show inline context metadata (file, function, line).
 */
var showInlineContext = false;

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
    var atMatch = /at\\\\s+(?:(.+?)\\\\s+\\\\()?([^\\\\s()]+?):(\\\\d+)(?::(\\\\d+))?\\\\)?/.exec(plainText);
    if (atMatch) {
        return {
            file: atMatch[2] || '',
            func: atMatch[1] || '',
            line: atMatch[3] || ''
        };
    }

    // Pattern: "functionName@file.js:123:45"
    var mozMatch = /([^@]+)@([^:]+):(\\\\d+)(?::(\\\\d+))?/.exec(plainText);
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
    if (item.filteredOut || item.excluded || item.levelFiltered || item.sourceFiltered || item.searchFiltered) return 0;
    if (item.type === 'marker') return MARKER_HEIGHT;
    if (item.type === 'stack-frame' && item.groupId >= 0) {
        for (var k = 0; k < allLines.length; k++) {
            if (allLines[k].groupId === item.groupId && allLines[k].type === 'stack-header') {
                var header = allLines[k];
                if (header.collapsed === true) return 0; // Fully collapsed
                if (header.collapsed === false) return ROW_HEIGHT; // Fully expanded
                // Preview mode: show first N non-framework frames
                if (header.collapsed === 'preview') {
                    var frameIdx = 0;
                    var appFrameCount = 0;
                    for (var j = 0; j < allLines.length; j++) {
                        if (allLines[j].groupId === item.groupId && allLines[j].type === 'stack-frame') {
                            if (allLines[j] === item) {
                                // Show if we haven't hit preview limit or if it's an app frame within limit
                                if (item.fw) return 0; // Framework frames hidden in preview
                                return appFrameCount < (header.previewCount || 3) ? ROW_HEIGHT : 0;
                            }
                            if (!allLines[j].fw) appFrameCount++;
                        }
                    }
                }
                return 0;
            }
        }
    }
    return ROW_HEIGHT;
}

/**
 * Renders a single log item to HTML.
 * Handles markers, stack frames, and regular lines with appropriate styling.
 * Applies search highlighting, pattern highlights, and category styling.
 */
function renderItem(item, idx) {
    var html = (typeof highlightSearchInHtml === 'function') ? highlightSearchInHtml(item.html) : item.html;

    var matchCls = (typeof isCurrentMatch === 'function' && isCurrentMatch(idx)) ? ' current-match'
        : (typeof isSearchMatch === 'function' && isSearchMatch(idx)) ? ' search-match' : '';

    if (item.type === 'marker') {
        return '<div class="marker">' + html + '</div>';
    }

    if (item.type === 'repeat-notification') {
        return '<div class="line' + matchCls + '">' + html + '</div>';
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
            // Count how many frames are hidden
            var appFrames = 0;
            var fwFrames = 0;
            for (var j = 0; j < allLines.length; j++) {
                if (allLines[j].groupId === item.groupId && allLines[j].type === 'stack-frame') {
                    if (allLines[j].fw) fwFrames++;
                    else appFrames++;
                }
            }
            var hiddenCount = Math.max(0, appFrames - (item.previewCount || 3)) + fwFrames;
            sf = hiddenCount > 0 ? '  [+' + hiddenCount + ' more]' : '';
        }
        var dup = item.dupCount > 1 ? ' <span class="stack-dedup-badge">(x' + item.dupCount + ')</span>' : '';
        return '<div class="stack-header' + matchCls + '" data-gid="' + item.groupId + '">' + ch + ' ' + html.trim() + dup + sf + '</div>';
    }

    if (item.type === 'stack-frame') {
        return '<div class="line stack-line' + (item.fw ? ' framework-frame' : '') + matchCls + '">' + html + '</div>';
    }

    var cat = item.category === 'stderr' ? ' cat-stderr' : '';
    // Only apply level color when decorations are off (decorator shows level via colored dot)
    var hasDeco = (typeof showDecorations !== 'undefined' && showDecorations);
    var levelCls = (item.level && !hasDeco) ? ' level-' + item.level : '';
    var sepCls = item.isSeparator ? ' separator-line' : '';
    var gap = (typeof getSlowGapHtml === 'function') ? getSlowGapHtml(item, idx) : '';
    var elapsed = (typeof getElapsedPrefix === 'function') ? getElapsedPrefix(item, idx) : '';
    var deco = (typeof getDecorationPrefix === 'function') ? getDecorationPrefix(item) : '';
    var annHtml = (typeof getAnnotationHtml === 'function') ? getAnnotationHtml(idx) : '';

    var titleAttr = '';
    if (typeof applyHighlightStyles === 'function') {
        var plainText = stripTags(item.html);
        var hl = applyHighlightStyles(html, plainText);
        html = hl.html;
        titleAttr = hl.titleAttr;
    }

    var ctxCls = item.isContext ? ' context-line' : '';
    var tintCls = (typeof getLineTintClass === 'function') ? getLineTintClass(item) : '';

    // Add severity bar class if enabled
    var barCls = '';
    if (typeof decoShowBar !== 'undefined' && decoShowBar && item.level) {
        if (item.isFramework) {
            barCls = ' level-bar-framework';
        } else {
            barCls = ' level-bar-' + item.level;
        }
    }

    // Add visual spacing if enabled
    var spacingCls = '';
    if (typeof visualSpacingEnabled !== 'undefined' && visualSpacingEnabled) {
        var prev = idx > 0 ? allLines[idx - 1] : null;
        var next = idx < allLines.length - 1 ? allLines[idx + 1] : null;

        // Spacing before: level change to error/warning, or before markers
        if (prev && prev.type !== 'marker' && item.type !== 'marker') {
            if ((item.level === 'error' || item.level === 'warning') && prev.level !== item.level) {
                spacingCls += ' spacing-before';
            }
        }
        if (item.type === 'marker') {
            spacingCls += ' spacing-before';
        }

        // Spacing after: markers, or after last stack frame
        if (next && item.type === 'marker') {
            spacingCls += ' spacing-after';
        }
    }

    return gap + '<div class="line' + cat + levelCls + sepCls + ctxCls + matchCls + tintCls + barCls + spacingCls + '"' + titleAttr + '>' + deco + elapsed + html + '</div>' + annHtml;
}
`;
}
