/**
 * Inclusive viewer row range for a **DB timestamp burst** boxed group (markers + SQL lines).
 * Mirrors `markerBurstEdge` / `dbTsBurstSegment` set in `viewer-data-add-db-marker-apply.ts`.
 *
 * Browser: {@link getDbTimestampBurstRangeBrowserScript} defines `computeDbTimestampBurstLineRange`.
 */

/** Minimal `allLines` row shape for DB burst grouping. */
export interface DbTimestampBurstRangeLineStub {
    readonly type?: string;
    /** Present on real viewer rows — ignored by range logic; allowed for test fixtures / tooling. */
    readonly html?: string;
    readonly markerBurstEdge?: "top" | "bottom";
    readonly dbTsBurstSegment?: "first" | "mid" | "last";
}

/** @returns inclusive index range spanning top marker … bottom marker, or null. */
export function computeDbTimestampBurstRange(
    allLines: readonly DbTimestampBurstRangeLineStub[],
    lineIdx: number,
): { lo: number; hi: number } | null {
    if (lineIdx < 0 || lineIdx >= allLines.length) {
        return null;
    }
    const it = allLines[lineIdx];
    if (!it) {
        return null;
    }
    if (it.type === "marker" && it.markerBurstEdge === "top") {
        return expandDbBurstDownFromTop(allLines, lineIdx);
    }
    if (it.type === "marker" && it.markerBurstEdge === "bottom") {
        return expandDbBurstUpFromBottom(allLines, lineIdx);
    }
    if (it.type === "line" && it.dbTsBurstSegment) {
        let lo = lineIdx;
        while (lo > 0) {
            const p = allLines[lo - 1];
            if (p.type === "marker" && p.markerBurstEdge === "top") {
                lo--;
                break;
            }
            if (p.type === "line" && p.dbTsBurstSegment) {
                lo--;
                continue;
            }
            return null;
        }
        let hi = lineIdx;
        while (hi < allLines.length - 1) {
            const n = allLines[hi + 1];
            if (n.type === "marker" && n.markerBurstEdge === "bottom") {
                hi++;
                break;
            }
            if (n.type === "line" && n.dbTsBurstSegment) {
                hi++;
                continue;
            }
            return null;
        }
        return { lo, hi };
    }
    return null;
}

function expandDbBurstDownFromTop(
    allLines: readonly DbTimestampBurstRangeLineStub[],
    topIdx: number,
): { lo: number; hi: number } | null {
    let hi = topIdx;
    while (hi < allLines.length - 1) {
        const n = allLines[hi + 1];
        if (n.type === "marker" && n.markerBurstEdge === "bottom") {
            hi++;
            return { lo: topIdx, hi };
        }
        if (n.type === "line" && n.dbTsBurstSegment) {
            hi++;
            continue;
        }
        return null;
    }
    return null;
}

function expandDbBurstUpFromBottom(
    allLines: readonly DbTimestampBurstRangeLineStub[],
    botIdx: number,
): { lo: number; hi: number } | null {
    let lo = botIdx;
    while (lo > 0) {
        const p = allLines[lo - 1];
        if (p.type === "marker" && p.markerBurstEdge === "top") {
            lo--;
            return { lo, hi: botIdx };
        }
        if (p.type === "line" && p.dbTsBurstSegment) {
            lo--;
            continue;
        }
        return null;
    }
    return null;
}

/** Webview globals: assigns `computeDbTimestampBurstLineRange`. */
export function getDbTimestampBurstRangeBrowserScript(): string {
    return /* javascript */ `
function computeDbTimestampBurstLineRange(lineIdx) {
    if (lineIdx < 0 || lineIdx >= allLines.length) return null;
    var it = allLines[lineIdx];
    if (!it) return null;

    function expandDownFromTop(topIdx) {
        var hi = topIdx;
        while (hi < allLines.length - 1) {
            var nx = allLines[hi + 1];
            if (nx.type === 'marker' && nx.markerBurstEdge === 'bottom') {
                hi++;
                return { lo: topIdx, hi: hi };
            }
            if (nx.type === 'line' && nx.dbTsBurstSegment) {
                hi++;
                continue;
            }
            return null;
        }
        return null;
    }

    function expandUpFromBottom(botIdx) {
        var lo = botIdx;
        while (lo > 0) {
            var pv = allLines[lo - 1];
            if (pv.type === 'marker' && pv.markerBurstEdge === 'top') {
                lo--;
                return { lo: lo, hi: botIdx };
            }
            if (pv.type === 'line' && pv.dbTsBurstSegment) {
                lo--;
                continue;
            }
            return null;
        }
        return null;
    }

    if (it.type === 'marker' && it.markerBurstEdge === 'top') {
        return expandDownFromTop(lineIdx);
    }
    if (it.type === 'marker' && it.markerBurstEdge === 'bottom') {
        return expandUpFromBottom(lineIdx);
    }
    if (it.type === 'line' && it.dbTsBurstSegment) {
        var loM = lineIdx;
        while (loM > 0) {
            var pm = allLines[loM - 1];
            if (pm.type === 'marker' && pm.markerBurstEdge === 'top') {
                loM--;
                break;
            }
            if (pm.type === 'line' && pm.dbTsBurstSegment) {
                loM--;
                continue;
            }
            return null;
        }
        var hiM = lineIdx;
        while (hiM < allLines.length - 1) {
            var nm = allLines[hiM + 1];
            if (nm.type === 'marker' && nm.markerBurstEdge === 'bottom') {
                hiM++;
                break;
            }
            if (nm.type === 'line' && nm.dbTsBurstSegment) {
                hiM++;
                continue;
            }
            return null;
        }
        return { lo: loM, hi: hiM };
    }
    return null;
}
`;
}
