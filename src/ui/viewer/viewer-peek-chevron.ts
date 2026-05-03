/**
 * Client-side JavaScript for the scoped peek feature in the log viewer.
 *
 * EXPAND: clicking the outlined severity dot (`.bar-hidden-rows` row state)
 * with a `data-hidden-from` attr reveals exactly that filter-hidden gap's
 * items; a `data-dedup-count` attr reveals a dedup-fold survivor's hidden
 * duplicates. Each expansion mints a fresh peek key (via `nextPeekKey++`)
 * stamped on every revealed item's `peekAnchorKey`, so two adjacent gaps can
 * be expanded and collapsed independently.
 *
 * COLLAPSE: clicking the outlined dot does NOT collapse — that behavior
 * deleted lines from view in a way users perceived as data loss (the dot
 * looks identical for "expand" and "collapse" states; the only signal was
 * the hover tooltip). Collapse now requires an explicit click on the
 * `.peek-collapse-link` pill rendered as a sibling row directly below every
 * peek-anchor row. See bug 048 plan.
 *
 * Concatenated into the same script scope as viewer-script.ts (shared
 * `allLines`, `recalcAndRender`, `renderViewport`, `recalcHeights`).
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

/** Wire up viewport-level event delegation for two distinct controls:
      1. .peek-collapse-link[data-peek-key] — explicit collapse pill (only
         emitted under expanded peek-anchor rows). Click → unpeekChevron.
      2. .bar-hidden-rows row state — outlined severity dot. Click → expand
         a filter-hidden gap (data-hidden-from) or a dedup fold
         (data-dedup-count). NEVER collapses; see file header.

    Delegated because both targets are re-created on every renderViewport()
    call — a direct listener would be lost.

    WHY ignore shift-click: viewer-copy.ts uses shift-click for range
    selection. Letting plain clicks fire here preserves the text-selection
    affordance (click-drag still selects text because the click event only
    fires on mouseup without a drag — Chromium / Firefox never fire click on
    drag-select).

    WHY stopPropagation only when handled: other viewport-level click
    handlers (viewer-copy, viewer-script-click-handlers for stack-headers,
    etc.) listen on the same viewport. We must let those fire when this
    handler did not own the click (e.g. a stack-header click that happens
    to land on a row also carrying .bar-hidden-rows but with no peek-key /
    hidden-from / dedup-count attrs). */
function initPeekChevron() {
    var vp = document.getElementById('viewport');
    if (!vp) return;
    vp.addEventListener('click', function(e) {
        if (e.shiftKey) return;

        /* Explicit collapse control: an inline ".peek-collapse-link" sibling
           row sits directly below every peek-anchor row when it is expanded.
           Clicking that link is now the ONLY way a click can collapse a peek
           group. Plain clicks on the severity dot deliberately do nothing
           here. WHY: when dot-click also collapsed, users perceived it as
           the viewer deleting their lines — the dot looks identical for
           "click to expand" and "click to collapse" and the only signal
           distinguishing them was the hover tooltip, which is invisible
           during scroll-and-click. See bug 048 plan and the immediate fix. */
        var collapseLink = e.target.closest('.peek-collapse-link[data-peek-key]');
        if (collapseLink) {
            unpeekChevron(parseInt(collapseLink.dataset.peekKey, 10));
            e.preventDefault();
            e.stopPropagation();
            return;
        }

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
            /* Already-expanded peek anchor: dot click is a deliberate no-op.
               The user collapses via the .peek-collapse-link sibling row that
               renders directly below the anchor (see top of this handler).
               WHY return rather than fall through: without this guard the
               dedup-survivor branch below would re-fire peekDedupFold on each
               click and mint a fresh peek key indefinitely. */
            return;
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
