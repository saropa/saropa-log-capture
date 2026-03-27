/**
 * Log viewer: classify plain text lines that should use “separator” styling (yellow / preserved layout).
 *
 * Used conceptually by the webview’s embedded `isSeparatorLine` (see `viewer-data-helpers-core.ts`).
 * The webview bundle duplicates this logic in JavaScript; **keep behavior in sync** when editing —
 * unit tests run against this module only.
 *
 * @module log-viewer-separator-line
 */

import { isAsciiBoxDrawingDecorLine } from "./stack-parser";

/**
 * Single-character test for “art” symbols in the ratio heuristic (===, box-drawing, etc.).
 * ASCII space counts separately, matching the embedded viewer loop (`artChars.test(ch) || ch === ' '`).
 */
const ART_CHAR = /^[=+*_#~|/\\<>[\]{}()^v─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╭╮╯╰-]$/;

function charCountsTowardSeparatorRatio(ch: string): boolean {
    return ch === " " || ART_CHAR.test(ch);
}

/**
 * True when the line is mostly decorative (banners, rules, Drift-style boxes) and should get
 * `.separator-line` styling in the log viewer.
 */
export function isLogViewerSeparatorLine(plainText: string): boolean {
    if (isAsciiBoxDrawingDecorLine(plainText)) {
        return true;
    }
    const trimmed = plainText.trim();
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
