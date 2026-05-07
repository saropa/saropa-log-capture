/**
 * Computes the line index range for a single logical error/warning "incident" in the viewer.
 * Used for **Copy Error** / **Copy Warning** so users copy continuation groups, stack traces
 * (plus the preceding message line), and consecutive duplicate error/warning rows together.
 *
 * Browser copy: `getIncidentRangeBrowserScript()` — keep behavior in sync with
 * {@link computeIncidentRange} (validated by Node tests in `viewer-context-menu-incident-range.test.ts`).
 */

/** Minimal viewer line shape for range computation (matches webview `allLines` entries). */
export interface IncidentRangeLineStub {
    readonly type?: string;
    readonly level?: string;
    readonly originalLevel?: string;
    readonly html?: string;
    readonly contGroupId?: number;
    readonly groupId?: number;
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

/**
 * @param strip - Strip HTML to plain text; webview passes `stripTags`. Tests use identity.
 * @returns Inclusive line index range, or null if the click is not part of a copyable incident.
 */
export function computeIncidentRange(
    allLines: readonly IncidentRangeLineStub[],
    lineIdx: number,
    strip: (html: string) => string,
): { lo: number; hi: number } | null {
    if (lineIdx < 0 || lineIdx >= allLines.length) {
        return null;
    }

    let lo = lineIdx;
    let hi = lineIdx;
    const item = allLines[lineIdx];

    const mergeCont = (idx: number): void => {
        const it = allLines[idx];
        if (!it || typeof it.contGroupId !== 'number') {
            return;
        }
        const gid = it.contGroupId;
        for (let i = 0; i < allLines.length; i++) {
            if (allLines[i].contGroupId === gid) {
                lo = Math.min(lo, i);
                hi = Math.max(hi, i);
            }
        }
    };
    mergeCont(lineIdx);

    const mergeStackGid = (gid: number | undefined): void => {
        if (typeof gid !== 'number' || gid < 0) {
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
        lo = Math.min(lo, slo);
        hi = Math.max(hi, shi);
        if (slo > 0 && allLines[slo - 1].type === 'line') {
            lo = Math.min(lo, slo - 1);
        }
    };

    const itemGid = item.groupId;
    if (
        typeof itemGid === 'number' &&
        itemGid >= 0 &&
        (item.type === 'stack-header' || item.type === 'stack-frame')
    ) {
        mergeStackGid(itemGid);
    }
    if (item.type === 'line' && lineIdx + 1 < allLines.length) {
        const n = allLines[lineIdx + 1];
        const nGid = n.groupId;
        if (n.type === 'stack-header' && typeof nGid === 'number' && nGid >= 0) {
            mergeStackGid(nGid);
        }
    }

    let anchorIdx = -1;
    let anchorPlain = '';
    for (let i = lo; i <= hi; i++) {
        const L = allLines[i];
        if (L.type === 'line' && effectiveErrorWarningLevel(L)) {
            anchorIdx = i;
            anchorPlain = strip(L.html ?? '');
            break;
        }
    }
    if (anchorIdx < 0 && item.type === 'line') {
        anchorIdx = lineIdx;
        anchorPlain = strip(item.html ?? '');
    }

    if (anchorIdx >= 0 && effectiveErrorWarningLevel(allLines[anchorIdx])) {
        let i = anchorIdx - 1;
        while (i >= 0) {
            const L = allLines[i];
            if (L.type !== 'line' || !effectiveErrorWarningLevel(L)) {
                break;
            }
            if (strip(L.html ?? '') !== anchorPlain) {
                break;
            }
            lo = Math.min(lo, i);
            i--;
        }
        i = anchorIdx + 1;
        while (i < allLines.length) {
            const L = allLines[i];
            if (L.type !== 'line' || !effectiveErrorWarningLevel(L)) {
                break;
            }
            if (strip(L.html ?? '') !== anchorPlain) {
                break;
            }
            hi = Math.max(hi, i);
            i++;
        }
    }

    let anyEw = false;
    for (let i = lo; i <= hi; i++) {
        if (effectiveErrorWarningLevel(allLines[i])) {
            anyEw = true;
            break;
        }
    }
    if (!anyEw) {
        return null;
    }
    return { lo, hi };
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

function computeIncidentLineRange(lineIdx) {
    if (lineIdx < 0 || lineIdx >= allLines.length) return null;
    var lo = lineIdx;
    var hi = lineIdx;
    var item = allLines[lineIdx];

    function mergeCont(idx) {
        var it = allLines[idx];
        if (!it || it.contGroupId == null) return;
        var gid = it.contGroupId;
        for (var i = 0; i < allLines.length; i++) {
            if (allLines[i].contGroupId === gid) {
                lo = Math.min(lo, i);
                hi = Math.max(hi, i);
            }
        }
    }
    mergeCont(lineIdx);

    function mergeStackGid(gid) {
        if (gid == null || gid < 0) return;
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

    if (item.groupId != null && item.groupId >= 0 && (item.type === 'stack-header' || item.type === 'stack-frame')) {
        mergeStackGid(item.groupId);
    }
    if (item.type === 'line' && lineIdx + 1 < allLines.length) {
        var n = allLines[lineIdx + 1];
        if (n.type === 'stack-header' && n.groupId != null && n.groupId >= 0) {
            mergeStackGid(n.groupId);
        }
    }

    var anchorIdx = -1;
    var anchorPlain = '';
    for (var ai = lo; ai <= hi; ai++) {
        var L = allLines[ai];
        if (L.type === 'line' && effectiveErrorWarningLevel(L)) {
            anchorIdx = ai;
            anchorPlain = stripTags(L.html || '');
            break;
        }
    }
    if (anchorIdx < 0 && item.type === 'line') {
        anchorIdx = lineIdx;
        anchorPlain = stripTags(item.html || '');
    }

    if (anchorIdx >= 0 && effectiveErrorWarningLevel(allLines[anchorIdx])) {
        var i = anchorIdx - 1;
        while (i >= 0) {
            var L2 = allLines[i];
            if (L2.type !== 'line' || !effectiveErrorWarningLevel(L2)) break;
            if (stripTags(L2.html || '') !== anchorPlain) break;
            lo = Math.min(lo, i);
            i--;
        }
        i = anchorIdx + 1;
        while (i < allLines.length) {
            var L3 = allLines[i];
            if (L3.type !== 'line' || !effectiveErrorWarningLevel(L3)) break;
            if (stripTags(L3.html || '') !== anchorPlain) break;
            hi = Math.max(hi, i);
            i++;
        }
    }

    var anyEw = false;
    for (var xi = lo; xi <= hi; xi++) {
        if (effectiveErrorWarningLevel(allLines[xi])) {
            anyEw = true;
            break;
        }
    }
    if (!anyEw) return null;
    return { lo: lo, hi: hi };
}
`;
}
