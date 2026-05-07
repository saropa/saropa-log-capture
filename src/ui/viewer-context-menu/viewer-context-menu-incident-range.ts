/**
 * Computes the line index range for a single logical error/warning "incident" in the viewer.
 * Used for **Copy Error** / **Copy Warning** so users copy full context in one gesture.
 *
 * **Primary rule:** expand to every **adjacent** line whose level is error or warning (including
 * `originalLevel` for demoted device lines) until a non–error/warning line **breaks** the chain.
 * Then merge **Flutter banner** groups (`bannerGroupId`) — one logical `════ Exception caught by … ════`
 * block, including long stdout render dumps where inner lines may be classified as info.
 * Then merge **continuation** fragments and **stack** groups (`groupId`) that touch that band.
 *
 * Browser copy: `getIncidentRangeBrowserScript()` — keep behavior in sync with
 * {@link computeIncidentRange} (validated by Node tests in `viewer-context-menu-incident-range.test.ts`).
 * **DB timestamp bursts:** `viewer-context-menu-db-burst-range.ts` defines `computeDbTimestampBurstLineRange` for Copy DB cluster.
 */

/** Minimal viewer line shape for range computation (matches webview `allLines` entries). */
export interface IncidentRangeLineStub {
    readonly type?: string;
    readonly level?: string;
    readonly originalLevel?: string;
    readonly html?: string;
    readonly contGroupId?: number;
    readonly groupId?: number;
    /** Flutter `════ Exception caught by … ════` block id (see `viewer-data-add-flutter-banner.ts`). */
    readonly bannerGroupId?: number;
}

export function effectiveErrorWarningLevel(
    item: IncidentRangeLineStub | null | undefined,
): 'error' | 'warning' | null {
    if (!item) {
        return null;
    }
    const t = item.type;
    if (t === 'marker' || t === 'run-separator') {
        return null;
    }
    const L = (item.originalLevel ?? item.level) as string | undefined;
    if (L === 'error' || L === 'warning') {
        return L;
    }
    return null;
}

function expandAdjacentEw(
    allLines: readonly IncidentRangeLineStub[],
    lo: number,
    hi: number,
): { lo: number; hi: number } {
    let l = lo;
    let h = hi;
    while (l > 0 && effectiveErrorWarningLevel(allLines[l - 1])) {
        l--;
    }
    while (h < allLines.length - 1 && effectiveErrorWarningLevel(allLines[h + 1])) {
        h++;
    }
    return { lo: l, hi: h };
}

interface MutableRange {
    lo: number;
    hi: number;
}

/** Merge stack-header / stack-frame groups and optional preamble line into [lo, hi]. */
function mergeStackForIndex(allLines: readonly IncidentRangeLineStub[], idx: number, range: MutableRange): void {
    const it = allLines[idx];
    const gid = it.groupId;
    if (typeof gid === 'number' && gid >= 0 && (it.type === 'stack-header' || it.type === 'stack-frame')) {
        mergeStackGidInto(allLines, gid, range);
    }
    if (it.type === 'line' && idx + 1 < allLines.length) {
        const n = allLines[idx + 1];
        const nGid = n.groupId;
        if (n.type === 'stack-header' && typeof nGid === 'number' && nGid >= 0) {
            mergeStackGidInto(allLines, nGid, range);
        }
    }
}

function mergeContGroupInto(allLines: readonly IncidentRangeLineStub[], idx: number, range: MutableRange): void {
    const it = allLines[idx];
    if (!it || typeof it.contGroupId !== 'number') {
        return;
    }
    const gid = it.contGroupId;
    for (let i = 0; i < allLines.length; i++) {
        if (allLines[i].contGroupId === gid) {
            range.lo = Math.min(range.lo, i);
            range.hi = Math.max(range.hi, i);
        }
    }
}

/** Merge all lines in the same Flutter exception banner (RenderFlex dumps, etc.). */
function mergeBannerGroupInto(allLines: readonly IncidentRangeLineStub[], idx: number, range: MutableRange): void {
    const it = allLines[idx];
    if (!it || typeof it.bannerGroupId !== 'number' || it.bannerGroupId < 0) {
        return;
    }
    const bg = it.bannerGroupId;
    for (let i = 0; i < allLines.length; i++) {
        if (allLines[i].bannerGroupId === bg) {
            range.lo = Math.min(range.lo, i);
            range.hi = Math.max(range.hi, i);
        }
    }
}

function mergeStackGidInto(
    allLines: readonly IncidentRangeLineStub[],
    gid: number,
    range: MutableRange,
): void {
    if (gid < 0) {
        return;
    }
    let slo = Number.POSITIVE_INFINITY;
    let shi = -1;
    for (let i = 0; i < allLines.length; i++) {
        const it = allLines[i];
        if (it.groupId === gid && (it.type === 'stack-header' || it.type === 'stack-frame')) {
            slo = Math.min(slo, i);
            shi = Math.max(shi, i);
        }
    }
    if (shi < 0) {
        return;
    }
    range.lo = Math.min(range.lo, slo);
    range.hi = Math.max(range.hi, shi);
    if (slo > 0 && allLines[slo - 1].type === 'line') {
        range.lo = Math.min(range.lo, slo - 1);
    }
}

/**
 * @returns Inclusive line index range, or null if the click is not part of a copyable incident.
 */
export function computeIncidentRange(
    allLines: readonly IncidentRangeLineStub[],
    lineIdx: number,
): { lo: number; hi: number } | null {
    if (lineIdx < 0 || lineIdx >= allLines.length) {
        return null;
    }

    let lo = lineIdx;
    let hi = lineIdx;
    let bounded = expandAdjacentEw(allLines, lo, hi);
    lo = bounded.lo;
    hi = bounded.hi;

    const range: MutableRange = { lo, hi };
    const maxPasses = 64;
    for (let pass = 0; pass < maxPasses; pass++) {
        const prevLo = range.lo;
        const prevHi = range.hi;

        for (let i = range.lo; i <= range.hi; i++) {
            mergeContGroupInto(allLines, i, range);
        }
        for (let i = range.lo; i <= range.hi; i++) {
            mergeBannerGroupInto(allLines, i, range);
        }
        for (let i = range.lo; i <= range.hi; i++) {
            mergeStackForIndex(allLines, i, range);
        }

        bounded = expandAdjacentEw(allLines, range.lo, range.hi);
        range.lo = bounded.lo;
        range.hi = bounded.hi;

        if (range.lo === prevLo && range.hi === prevHi) {
            break;
        }
    }
    lo = range.lo;
    hi = range.hi;

    if (!rangeHasCopyableIncident(allLines, lo, hi)) {
        return null;
    }
    return { lo, hi };
}

/**
 * True if the range should be copyable as Copy Error / Warning: any row is EW, or any row joins a
 * Flutter banner group where at least one row in that group is EW (body lines may show as info).
 */
function rangeHasCopyableIncident(
    allLines: readonly IncidentRangeLineStub[],
    lo: number,
    hi: number,
): boolean {
    for (let i = lo; i <= hi; i++) {
        if (effectiveErrorWarningLevel(allLines[i])) {
            return true;
        }
    }
    const bannerGids = new Set<number>();
    for (let i = lo; i <= hi; i++) {
        const b = allLines[i].bannerGroupId;
        if (typeof b === 'number' && b >= 0) {
            bannerGids.add(b);
        }
    }
    for (const bg of bannerGids) {
        for (let j = 0; j < allLines.length; j++) {
            if (allLines[j].bannerGroupId === bg && effectiveErrorWarningLevel(allLines[j])) {
                return true;
            }
        }
    }
    return false;
}

/** Assigns `effectiveErrorWarningLevel` and `computeIncidentLineRange` in the webview global scope. */
export function getIncidentRangeBrowserScript(): string {
    return /* javascript */ `
function effectiveErrorWarningLevel(item) {
    if (!item) return null;
    var t = item.type;
    if (t === 'marker' || t === 'run-separator') return null;
    var L = item.originalLevel != null ? item.originalLevel : item.level;
    if (L === 'error' || L === 'warning') return L;
    return null;
}

function expandAdjacentEw(lo, hi) {
    var l = lo;
    var h = hi;
    while (l > 0 && effectiveErrorWarningLevel(allLines[l - 1])) l--;
    while (h < allLines.length - 1 && effectiveErrorWarningLevel(allLines[h + 1])) h++;
    return { lo: l, hi: h };
}

function computeIncidentLineRange(lineIdx) {
    if (lineIdx < 0 || lineIdx >= allLines.length) return null;
    var lo = lineIdx;
    var hi = lineIdx;
    var b = expandAdjacentEw(lo, hi);
    lo = b.lo;
    hi = b.hi;

    function mergeCont(idx) {
        var it = allLines[idx];
        if (!it || typeof it.contGroupId !== 'number') return;
        var gid = it.contGroupId;
        for (var i = 0; i < allLines.length; i++) {
            if (allLines[i].contGroupId === gid) {
                lo = Math.min(lo, i);
                hi = Math.max(hi, i);
            }
        }
    }

    function mergeBanner(idx) {
        var it = allLines[idx];
        if (!it || typeof it.bannerGroupId !== 'number' || it.bannerGroupId < 0) return;
        var bg = it.bannerGroupId;
        for (var i = 0; i < allLines.length; i++) {
            if (allLines[i].bannerGroupId === bg) {
                lo = Math.min(lo, i);
                hi = Math.max(hi, i);
            }
        }
    }

    function mergeStackGid(gid) {
        if (typeof gid !== 'number' || gid < 0) return;
        var slo = Infinity;
        var shi = -1;
        for (var i = 0; i < allLines.length; i++) {
            var it = allLines[i];
            if (it.groupId === gid && (it.type === 'stack-header' || it.type === 'stack-frame')) {
                slo = Math.min(slo, i);
                shi = Math.max(shi, i);
            }
        }
        if (shi < 0) return;
        lo = Math.min(lo, slo);
        hi = Math.max(hi, shi);
        if (slo > 0 && allLines[slo - 1].type === 'line') {
            lo = Math.min(lo, slo - 1);
        }
    }

    var maxPasses = 64;
    for (var pass = 0; pass < maxPasses; pass++) {
        var prevLo = lo;
        var prevHi = hi;

        for (var ci = lo; ci <= hi; ci++) mergeCont(ci);
        for (var bi = lo; bi <= hi; bi++) mergeBanner(bi);
        for (var si = lo; si <= hi; si++) {
            var sit = allLines[si];
            var sgid = sit.groupId;
            if (typeof sgid === 'number' && sgid >= 0 && (sit.type === 'stack-header' || sit.type === 'stack-frame')) {
                mergeStackGid(sgid);
            }
            if (sit.type === 'line' && si + 1 < allLines.length) {
                var sn = allLines[si + 1];
                var sng = sn.groupId;
                if (sn.type === 'stack-header' && typeof sng === 'number' && sng >= 0) {
                    mergeStackGid(sng);
                }
            }
        }

        b = expandAdjacentEw(lo, hi);
        lo = b.lo;
        hi = b.hi;

        if (lo === prevLo && hi === prevHi) break;
    }

    if (!rangeHasCopyableIncident(lo, hi)) return null;
    return { lo: lo, hi: hi };
}

function rangeHasCopyableIncident(lo, hi) {
    var xi;
    for (xi = lo; xi <= hi; xi++) {
        if (effectiveErrorWarningLevel(allLines[xi])) return true;
    }
    var gids = [];
    for (xi = lo; xi <= hi; xi++) {
        var b = allLines[xi].bannerGroupId;
        if (typeof b === 'number' && b >= 0 && gids.indexOf(b) < 0) gids.push(b);
    }
    for (var gi = 0; gi < gids.length; gi++) {
        var bgid = gids[gi];
        for (var j = 0; j < allLines.length; j++) {
            if (allLines[j].bannerGroupId === bgid && effectiveErrorWarningLevel(allLines[j])) return true;
        }
    }
    return false;
}
`;
}
