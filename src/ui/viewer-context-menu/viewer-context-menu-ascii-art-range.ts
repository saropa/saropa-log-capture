/**
 * Inclusive viewer row range for an **ASCII art block** — the contiguous run of rows tagged
 * `artBlockPos` = 'start' | 'middle' | 'end' by `finalizeArtBlock` (box-drawing separators,
 * viewer-data-helpers-core.ts) or by the entropy detector (`feedAsciiArtDetector`,
 * viewer-data-add-ascii-art-detect.ts). Both paths emit one contiguous band, so the range is
 * simply the maximal neighbourhood of the clicked row where every row carries `artBlockPos`.
 *
 * Used by **Copy ASCII art** so the user grabs the whole banner in one gesture (mirrors
 * **Copy Error** / **Copy DB cluster**). Browser: {@link getAsciiArtRangeBrowserScript} defines
 * `computeAsciiArtBlockLineRange`. Keep both copies in sync (Node tests cover the TS one).
 */

/** Minimal `allLines` row shape for art-block range expansion. */
export interface AsciiArtRangeLineStub {
    /** 'start' | 'middle' | 'end' on art-block rows; absent on every other row. */
    readonly artBlockPos?: string;
    /** Present on real viewer rows — ignored by range logic; allowed for test fixtures. */
    readonly html?: string;
}

/**
 * Expand to the contiguous band of art-block rows containing `lineIdx`.
 *
 * @returns inclusive index range, or null when the clicked row is not part of an art block.
 */
export function computeAsciiArtBlockRange(
    allLines: readonly AsciiArtRangeLineStub[],
    lineIdx: number,
): { lo: number; hi: number } | null {
    if (lineIdx < 0 || lineIdx >= allLines.length) {
        return null;
    }
    const it = allLines[lineIdx];
    // No artBlockPos means the click is on an ordinary row — nothing to copy as a block.
    if (!it || !it.artBlockPos) {
        return null;
    }
    let lo = lineIdx;
    let hi = lineIdx;
    while (lo > 0 && allLines[lo - 1] && allLines[lo - 1].artBlockPos) {
        lo--;
    }
    while (hi < allLines.length - 1 && allLines[hi + 1] && allLines[hi + 1].artBlockPos) {
        hi++;
    }
    return { lo, hi };
}

/** Webview globals: assigns `computeAsciiArtBlockLineRange`. */
export function getAsciiArtRangeBrowserScript(): string {
    return /* javascript */ `
function computeAsciiArtBlockLineRange(lineIdx) {
    if (lineIdx < 0 || lineIdx >= allLines.length) return null;
    var it = allLines[lineIdx];
    if (!it || !it.artBlockPos) return null;
    var lo = lineIdx;
    var hi = lineIdx;
    while (lo > 0 && allLines[lo - 1] && allLines[lo - 1].artBlockPos) lo--;
    while (hi < allLines.length - 1 && allLines[hi + 1] && allLines[hi + 1].artBlockPos) hi++;
    return { lo: lo, hi: hi };
}
`;
}
