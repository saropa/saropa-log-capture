"use strict";
/**
 * Embedded webview script chunk for the log viewer (`getViewerDataScript()`).
 *
 * **Purpose:** Detect **consecutive** duplicate **normal log lines** in O(1) per appended
 * line (streaming-friendly) and, when compress mode is **off**, show a one-time suggestion
 * banner after `COMPRESS_SUGGEST_STREAK` identical lines. Full collapse/dedupe is handled
 * separately by `applyCompressConsecutiveDedup` in `viewer-data.ts` when the user enables
 * compress — this module only **suggests**; it does not mutate line heights.
 *
 * **Guards:** `updateCompressDupStreakAfterLine` no-ops when any compression mode is on or
 * after dismiss; `resetCompressDupStreak` runs on markers, stack frames, repeat-notification
 * lines, and on `clear` (see viewer-script-messages) so streaks do not span unrelated
 * regions.
 *
 * **Load order:** Injected after `getViewerDataHelpers()` and before `addToData`. Depends on
 * layout script for `toggleCompressLines`, `hideCompressSuggestionBanner`,
 * `showCompressSuggestionBanner` (layout runs before viewer-data in the bundle).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompressStreakScript = getCompressStreakScript;
/** Returns JS for streak state, reset/update, and banner button listeners. */
function getCompressStreakScript() {
    return /* javascript */ `

var compressDupStreakKey = null;
var compressDupStreakLen = 0;
var compressSuggestShown = false;
var compressSuggestBannerDismissed = false;
var COMPRESS_SUGGEST_STREAK = 20;

function resetCompressDupStreak() {
    compressDupStreakKey = null;
    compressDupStreakLen = 0;
}

function updateCompressDupStreakAfterLine(plain) {
    if ((typeof compressLinesMode !== 'undefined' && compressLinesMode)
        || (typeof compressNonConsecutiveMode !== 'undefined' && compressNonConsecutiveMode)) return;
    if (compressSuggestBannerDismissed) return;
    var t = (plain || '').replace(/\\s+/g, ' ').trim();
    var k = t.length === 0 ? '__EMPTY__' : t;
    if (k === compressDupStreakKey) {
        compressDupStreakLen++;
    } else {
        compressDupStreakKey = k;
        compressDupStreakLen = 1;
    }
    if (!compressSuggestShown && compressDupStreakLen >= COMPRESS_SUGGEST_STREAK) {
        compressSuggestShown = true;
        if (typeof showCompressSuggestionBanner === 'function') showCompressSuggestionBanner();
    }
}

function initCompressSuggestListeners() {
    var en = document.getElementById('compress-suggest-enable');
    var dis = document.getElementById('compress-suggest-dismiss');
    if (en) {
        en.addEventListener('click', function() {
            var anyCompress = (typeof compressLinesMode !== 'undefined' && compressLinesMode)
                || (typeof compressNonConsecutiveMode !== 'undefined' && compressNonConsecutiveMode);
            if (anyCompress) {
                if (typeof hideCompressSuggestionBanner === 'function') hideCompressSuggestionBanner();
            } else if (typeof toggleCompressLines === 'function') {
                toggleCompressLines();
            }
        });
    }
    if (dis) {
        dis.addEventListener('click', function() {
            compressSuggestBannerDismissed = true;
            if (typeof hideCompressSuggestionBanner === 'function') hideCompressSuggestionBanner();
        });
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCompressSuggestListeners);
} else {
    initCompressSuggestListeners();
}
`;
}
//# sourceMappingURL=viewer-data-compress-streak.js.map