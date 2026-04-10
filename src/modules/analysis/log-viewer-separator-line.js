"use strict";
/**
 * Log viewer: classify plain text lines that should use "separator" styling (yellow / preserved layout).
 *
 * Used conceptually by the webview's embedded `isSeparatorLine` (see `viewer-data-helpers-core.ts`).
 * The webview bundle duplicates this logic in JavaScript; **keep behavior in sync** when editing —
 * unit tests run against this module only.
 *
 * @module log-viewer-separator-line
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLogViewerSeparatorLine = isLogViewerSeparatorLine;
const stack_parser_1 = require("./stack-parser");
/**
 * Single-character test for "art" symbols in the ratio heuristic (===, box-drawing, etc.).
 * ASCII space counts separately, matching the embedded viewer loop (`artChars.test(ch) || ch === ' '`).
 */
const ART_CHAR = /^[=+*_#~|/\\<>[\]{}()^v─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╭╮╯╰-]$/;
/** Strip logcat (`I/flutter (1234): `) or bracket (`[log] `) prefix so separator detection runs on message body only. */
const SOURCE_PREFIX = /^(?:[VDIWEFA]\/[^(:\s]+\s*(?:\(\s*\d+\))?:\s|\[[^\]]+]\s)/;
function charCountsTowardSeparatorRatio(ch) {
    return ch === " " || ART_CHAR.test(ch);
}
/**
 * True when the line is mostly decorative (banners, rules, Drift-style boxes) and should get
 * `.separator-line` styling in the log viewer.
 */
function isLogViewerSeparatorLine(plainText) {
    const prefixMatch = SOURCE_PREFIX.exec(plainText);
    const body = prefixMatch ? plainText.slice(prefixMatch[0].length) : plainText;
    if ((0, stack_parser_1.isAsciiBoxDrawingDecorLine)(body)) {
        return true;
    }
    const trimmed = body.trim();
    if (trimmed.length < 3) {
        return false;
    }
    let artCount = 0;
    for (const ch of trimmed) {
        if (charCountsTowardSeparatorRatio(ch)) {
            artCount++;
        }
    }
    return artCount / trimmed.length >= 0.6;
}
//# sourceMappingURL=log-viewer-separator-line.js.map