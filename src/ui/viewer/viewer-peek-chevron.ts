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

/** Wire up viewport-level event delegation for chevron peek / un-peek. Delegated
    because the chevron divs are re-created on every renderViewport() call — a direct
    listener would be lost. Shift+click is handled by viewer-copy.ts (selection); we
    only act on plain clicks so selection and peek don't collide. stopPropagation
    prevents the row click handler from also firing on the same event. */
function initPeekChevron() {
    var vp = document.getElementById('viewport');
    if (!vp) return;
    vp.addEventListener('click', function(e) {
        if (e.shiftKey) return;
        var target = e.target.closest('.hidden-chevron, .peek-collapse');
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        if (target.classList.contains('hidden-chevron')) {
            var from = parseInt(target.dataset.from, 10);
            var to = parseInt(target.dataset.to, 10);
            if (from >= 0 && to > from) peekChevron(from, to);
        } else {
            unpeekChevron(parseInt(target.dataset.peekKey, 10));
        }
    });
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
