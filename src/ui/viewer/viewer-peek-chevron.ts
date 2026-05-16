/**
 * Client-side JavaScript for the scoped peek feature in the log viewer.
 *
 * All expand / collapse affordances on regular log rows now route through
 * a single click target: `.deco-counter-row` (the clickable line-number +
 * ▶ / ▼ chevron in the decoration prefix). Its `data-affordance-kind`
 * attribute dispatches to one of three actions:
 *
 *   data-affordance-kind="dedup"  + data-dedup-survivor-idx
 *     → peekDedupFold(idx) when collapsed, unpeekChevron(peekAnchorKey)
 *       when expanded (state read from the survivor row).
 *   data-affordance-kind="gap"    + data-hidden-from / data-hidden-to
 *     → peekChevron(from, to, 'filter').
 *   data-affordance-kind="peek"   + data-peek-key
 *     → unpeekChevron(peekKey) — re-collapses a peek the user previously
 *       expanded; the trigger row carries the ▼ chevron until collapse.
 *
 * Stack-headers keep their own inline `.stack-toggle` (they have no
 * line-number prefix to host a counter-row), routed to toggleStackGroup
 * via the existing whole-row `.stack-header[data-gid]` handler in
 * viewer-script-click-handlers.ts.
 *
 * Concatenated into the same script scope as viewer-script.ts (shared
 * `allLines`, `recalcAndRender`, `renderViewport`, `recalcHeights`,
 * `toggleStackGroup`).
 */
export function getPeekChevronScript(): string {
    return /* javascript */ `
/** Monotonic key for scoped peek groups. Each click on an expand affordance
    mints one key and stamps every revealed item with it, so a second click
    on the matching collapse affordance can clear exactly that group without
    touching other peeked ranges. WHY per-group keys (not just a boolean
    peekOverride): two adjacent gaps both peeked must collapse independently
    — a single boolean would collapse both on one click. */
var nextPeekKey = 1;

/** Wire up viewport-level event delegation for the four collapse-control
    affordances introduced by plan 048. Delegated because the targets are
    re-created on every renderViewport() call — a direct listener would be
    lost.

    WHY ignore shift-click: viewer-copy.ts uses shift-click for range
    selection. Letting plain clicks fire here preserves the text-selection
    affordance (click-drag still selects text because the click event only
    fires on mouseup without a drag — Chromium / Firefox never fire click
    on drag-select).

    WHY stopPropagation only when handled: other viewport-level click
    handlers (viewer-copy, viewer-script-click-handlers for stack-headers,
    etc.) listen on the same viewport. We must let those fire when this
    handler did not own the click. */
function initPeekChevron() {
    var vp = document.getElementById('viewport');
    if (!vp) return;
    vp.addEventListener('click', function(e) {
        if (e.shiftKey) return;
        if (handleCounterRowClick(e)) return;
    });
}

/** Route a click on a .deco-counter-row through the right peek/unpeek
    function based on its data-affordance-kind. The whole counter+chevron
    span is the click target — line-number digits or chevron, same result.
    Returns true when handled (caller short-circuits). */
function handleCounterRowClick(e) {
    var row = e.target.closest('.deco-counter-row[data-affordance-kind]');
    if (!row) return false;
    var kind = row.dataset.affordanceKind;
    if (kind === 'dedup') {
        var idx = parseInt(row.dataset.dedupSurvivorIdx, 10);
        if (isNaN(idx) || !allLines[idx]) return false;
        var survivor = allLines[idx];
        if (survivor.peekAnchorKey != null) {
            /* Already expanded — collapse via the same peek key that
               peekDedupFold stamped on the survivor and its duplicates. */
            unpeekChevron(survivor.peekAnchorKey);
        } else {
            peekDedupFold(idx);
        }
        stopHandled(e);
        return true;
    }
    if (kind === 'gap') {
        var from = parseInt(row.dataset.hiddenFrom, 10);
        var to = parseInt(row.dataset.hiddenTo, 10);
        if (from >= 0 && to > from) {
            peekChevron(from, to, 'filter');
            stopHandled(e);
            return true;
        }
    }
    if (kind === 'peek') {
        var peekKey = parseInt(row.dataset.peekKey, 10);
        if (peekKey > 0) {
            unpeekChevron(peekKey);
            stopHandled(e);
            return true;
        }
    }
    if (kind === 'stack') {
        /* Stack toggle moved off the stack-header (no more inline chip) and
           onto the previous log line's counter-row chevron. data-stack-gid
           routes through the same toggleStackGroup handler the whole-row
           click in viewer-script-click-handlers.ts uses, so behavior is
           identical regardless of where the user clicks. */
        var stackGid = parseInt(row.dataset.stackGid, 10);
        if (!isNaN(stackGid) && typeof toggleStackGroup === 'function') {
            toggleStackGroup(stackGid);
            stopHandled(e);
            return true;
        }
    }
    return false;
}

/** Stop event propagation when a handler owned the click. Pulled into a
    helper so the four branches above don't repeat the two-line dance. */
function stopHandled(e) {
    e.preventDefault();
    e.stopPropagation();
}

/** Reveal every duplicate hidden under this dedup-fold survivor. Reads the
    compressDupHiddenIndices list stamped by applyCompressDedupModes in
    viewer-data.ts. Stamps the survivor + every revealed duplicate with the
    same peekAnchorKey so a single click on the badge (which mutates to
    "×N hide" once the survivor carries the key) collapses the whole group. */
function peekDedupFold(survivorIdx) {
    var survivor = allLines[survivorIdx];
    if (!survivor) return;
    var hiddenList = survivor.compressDupHiddenIndices || [];
    if (!hiddenList.length) return;
    var key = nextPeekKey++;
    /* Stamp the survivor too so the badge re-renders in its expanded form
       on the next paint and the click handler can find the peek key without
       walking the duplicates list. peekKind='dedup' tells renderViewport
       not to emit the leading/trailing .viewer-divider brackets — the
       badge handles toggle for dedup, dividers would be redundant. */
    survivor.peekAnchorKey = key;
    survivor.peekKind = 'dedup';
    for (var i = 0; i < hiddenList.length; i++) {
        var it = allLines[hiddenList[i]];
        if (!it) continue;
        it.peekOverride = true;
        it.peekAnchorKey = key;
        it.peekKind = 'dedup';
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

/** Reveal every hidden item in [from, to) under a fresh peek key. Sets
    peekOverride so calcItemHeight() bypasses filter/hide gates for these
    items only. Does not modify filter flags themselves — a global filter
    change followed by un-peek restores the pre-peek state cleanly.
    The kind argument distinguishes filter-gap peeks ('filter') from
    dedup peeks ('dedup'); only filter peeks get bracketing dividers. */
function peekChevron(from, to, kind) {
    var key = nextPeekKey++;
    var pkind = kind || 'filter';
    for (var i = from; i < to && i < allLines.length; i++) {
        var it = allLines[i];
        if (!it) continue;
        /* Skip markers and items already peeked by another gap (shouldn't
           happen but defensive — preserves the existing key so un-peek of
           the other gap works). */
        if (it.type === 'marker') continue;
        if (it.peekAnchorKey !== undefined && it.peekAnchorKey !== null) continue;
        it.peekOverride = true;
        it.peekAnchorKey = key;
        it.peekKind = pkind;
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

/** Collapse a single peek group by matching key. Other peeked groups are untouched. */
function unpeekChevron(key) {
    if (!(key > 0)) return;
    for (var i = 0; i < allLines.length; i++) {
        var it = allLines[i];
        if (it && it.peekAnchorKey === key) {
            it.peekOverride = false;
            it.peekAnchorKey = undefined;
            it.peekKind = undefined;
        }
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}
`;
}
