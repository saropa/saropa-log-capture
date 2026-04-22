/**
 * Client-side JavaScript for the scoped peek-chevron feature in the log viewer.
 * Clicking a `.hidden-chevron` (rendered between visible lines when non-blank lines
 * are filtered out) reveals exactly that gap's hidden items under a fresh per-group
 * key; a matching `.peek-collapse` marker then appears above the first revealed line
 * so the user can collapse that one group again without touching other peeks or
 * disturbing the global filter state.
 *
 * Concatenated into the same script scope as viewer-script.ts (shared `allLines`,
 * `recalcAndRender`, `renderViewport`, `recalcHeights`).
 */
export function getPeekChevronScript(): string {
    return /* javascript */ `
/** Monotonic key for scoped chevron peek groups. Each click on a .hidden-chevron mints
    one key and stamps every item in that gap's [from, to) range with it, so a second
    click on the matching .peek-collapse marker can clear exactly that group without
    touching other peeked ranges. WHY per-group keys (not just a boolean peekOverride):
    two adjacent gaps both peeked must collapse independently — a single boolean would
    collapse both on one click. */
var nextPeekKey = 1;

/** Wire up viewport-level event delegation for peek / un-peek on the unified
    .bar-hidden-rows row state. Delegated because the row divs are re-created
    on every renderViewport() call — a direct listener would be lost.

    WHY .bar-hidden-rows replaces the old .hidden-chevron / .peek-collapse
    selectors: the unified line-collapsing plan (bugs/unified-line-collapsing.md)
    retires those separate glyph elements in favour of an outlined severity dot
    on the row itself. Both "reveal hidden gap" and "re-collapse peeked group"
    states now live on the same class; which action fires depends on which
    data-* attrs the row carries (set by the render loop in viewer-data-viewport.ts).

    WHY ignore shift-click: viewer-copy.ts uses shift-click for range selection.
    Letting plain clicks toggle the peek preserves the text-selection affordance
    (click-drag still selects text because the click event only fires on mouseup
    without a drag — Chromium / Firefox never fire click on drag-select).

    WHY stopPropagation: other viewport-level click handlers (viewer-copy, etc.)
    also listen to the same event — without stopPropagation the row would both
    toggle peek AND register a line selection. */
function initPeekChevron() {
    var vp = document.getElementById('viewport');
    if (!vp) return;
    vp.addEventListener('click', function(e) {
        if (e.shiftKey) return;
        var target = e.target.closest('.bar-hidden-rows');
        if (!target) return;
        /* WHY dispatch before stopPropagation: a stack-header collapsed by the
           user carries .bar-hidden-rows (the outlined-dot state from the
           rethink) but has NO peek-key / hidden-from / dedup-count data-attrs —
           its click handler lives elsewhere (toggleStackGroup). Calling
           stopPropagation unconditionally up-front would swallow the click and
           prevent the header from expanding. So: detect our handled cases
           first, and only stop propagation when we actually handle the click. */
        var handled = false;
        if (target.dataset.peekKey) {
            /* Un-peek path: row belongs to an already-expanded peek group,
               click collapses exactly that group. */
            unpeekChevron(parseInt(target.dataset.peekKey, 10));
            handled = true;
        } else if (target.dataset.hiddenFrom !== undefined) {
            /* Peek path: row sits immediately after a filter-hidden run; reveal it. */
            var from = parseInt(target.dataset.hiddenFrom, 10);
            var to = parseInt(target.dataset.hiddenTo, 10);
            if (from >= 0 && to > from) {
                peekChevron(from, to);
                handled = true;
            }
        } else if (target.dataset.dedupCount) {
            /* Dedup fold path: row is the survivor of a non-consecutive or
               consecutive dedup run; reveal all the duplicates listed on the
               survivor's compressDupHiddenIndices. Unlike filter-hiding, the
               hidden indices are not contiguous (non-consecutive mode scatters
               them across the file), so peekChevron(from, to) would reveal
               unrelated rows in between — peekDedupFold walks the explicit
               index list instead. */
            var _idxAttr = target.getAttribute('data-idx');
            if (_idxAttr !== null) {
                peekDedupFold(parseInt(_idxAttr, 10));
                handled = true;
            }
        }
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
}

/** Reveal every duplicate hidden under this dedup-fold survivor. Reads the
    compressDupHiddenIndices list stamped by applyCompressDedupModes in
    viewer-data.ts. Uses the existing peekOverride / peekAnchorKey mechanism
    so a second click on the survivor (which will then carry a fresh
    peekAnchorKey stamped in renderViewport) collapses the fold back. */
function peekDedupFold(survivorIdx) {
    var survivor = allLines[survivorIdx];
    if (!survivor) return;
    var hiddenList = survivor.compressDupHiddenIndices || [];
    if (!hiddenList.length) return;
    var key = nextPeekKey++;
    /* Stamp the survivor too so the next renderViewport marks it as the
       first-of-peek-group and the un-peek click target. Without this, clicking
       the survivor again after expanding would re-fire peekDedupFold and
       double-stamp the already-peeked duplicates with a new key. */
    survivor.peekAnchorKey = key;
    for (var i = 0; i < hiddenList.length; i++) {
        var it = allLines[hiddenList[i]];
        if (!it) continue;
        it.peekOverride = true;
        it.peekAnchorKey = key;
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

/** Reveal every hidden item in [from, to) under a fresh peek key. Sets peekOverride
    so calcItemHeight() bypasses filter/hide gates for these items only. Does not
    modify filter flags themselves — a global filter change followed by un-peek
    restores the pre-peek state cleanly. */
function peekChevron(from, to) {
    var key = nextPeekKey++;
    for (var i = from; i < to && i < allLines.length; i++) {
        var it = allLines[i];
        if (!it) continue;
        /* Skip markers and items already peeked by another gap (shouldn't happen but
           defensive — preserves the existing key so un-peek of the other gap works). */
        if (it.type === 'marker') continue;
        if (it.peekAnchorKey !== undefined && it.peekAnchorKey !== null) continue;
        it.peekOverride = true;
        it.peekAnchorKey = key;
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
        }
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}
`;
}
