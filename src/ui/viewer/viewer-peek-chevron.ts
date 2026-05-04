/**
 * Client-side JavaScript for the scoped peek feature in the log viewer.
 *
 * Severity-gutter decoupling (plan: bugs/048_plan-severity-gutter-decoupling.md).
 * The severity dot is no longer interactive. Each expand/collapse concept
 * is wired to its own dedicated affordance:
 *
 *   .viewer-divider[data-divider-action="show-gap"]
 *     → peekChevron(from, to) — reveals a filter-hidden gap.
 *   .viewer-divider[data-divider-action="hide-peek"]
 *     → unpeekChevron(peekKey) — collapses an expanded peek group from
 *       either the leading (above) or trailing (below) bracket.
 *   .viewer-divider[data-divider-action="show-frames"]
 *     → toggleStackGroup(gid) — expands a Preview-mode stack group from
 *       its trimmed-frames notice below the last visible app-frame.
 *   .dedup-badge[data-dedup-survivor-idx]
 *     → peekDedupFold(idx) when collapsed, or unpeekChevron(peekAnchorKey)
 *       when the survivor itself already carries a peekAnchorKey.
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
        if (handleDividerClick(e)) return;
        if (handleDedupBadgeClick(e)) return;
    });
}

/** Route a click on a .viewer-divider through the right peek/expand
    function based on its data-divider-action. Returns true when the click
    was handled (so the outer delegate can short-circuit). */
function handleDividerClick(e) {
    var divider = e.target.closest('.viewer-divider[data-divider-action]');
    if (!divider) return false;
    var action = divider.dataset.dividerAction;
    if (action === 'show-gap') {
        var from = parseInt(divider.dataset.hiddenFrom, 10);
        var to = parseInt(divider.dataset.hiddenTo, 10);
        if (from >= 0 && to > from) {
            peekChevron(from, to, 'filter');
            stopHandled(e);
            return true;
        }
    } else if (action === 'hide-peek') {
        var peekKey = parseInt(divider.dataset.peekKey, 10);
        if (peekKey > 0) {
            unpeekChevron(peekKey);
            stopHandled(e);
            return true;
        }
    } else if (action === 'show-frames') {
        /* Preview-mode stack expansion. WHY route through toggleStackGroup
           rather than minting a peek key: a stack group has its own
           collapsed=true/false state machine separate from the peekOverride
           system. Reusing toggleStackGroup keeps the two states (header
           expand and divider expand) wired to the same source of truth. */
        var gid = parseInt(divider.dataset.gid, 10);
        if (!isNaN(gid) && typeof toggleStackGroup === 'function') {
            toggleStackGroup(gid);
            stopHandled(e);
            return true;
        }
    }
    return false;
}

/** Route a click on a .dedup-badge through peek/unpeek. The badge mutates
    its label between collapsed ("×N") and expanded ("×N hide") based on
    whether the survivor carries a peekAnchorKey, so a single click target
    handles both directions. Returns true when handled. */
function handleDedupBadgeClick(e) {
    var badge = e.target.closest('.dedup-badge[data-dedup-survivor-idx]');
    if (!badge) return false;
    var idx = parseInt(badge.dataset.dedupSurvivorIdx, 10);
    if (isNaN(idx) || !allLines[idx]) return false;
    var survivor = allLines[idx];
    if (survivor.peekAnchorKey !== undefined && survivor.peekAnchorKey !== null) {
        /* Already expanded — collapse via the same peek key that
           peekDedupFold stamped on the survivor and the duplicates. */
        unpeekChevron(survivor.peekAnchorKey);
    } else {
        peekDedupFold(idx);
    }
    stopHandled(e);
    return true;
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
