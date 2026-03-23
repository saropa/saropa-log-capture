/**
 * Shared tag-selection guard for viewer tag filters.
 *
 * Prevents "zero selected tags" states when users toggle chips off one-by-one.
 * If every known tag is hidden, we treat that state as "show all" by clearing
 * the hidden-tag map.
 */
export function getTagSelectionGuardScript(): string {
    return /* javascript */ `
/** Ensure at least one known tag remains visible; fallback to all-visible. */
function ensureAtLeastOneTagVisible(hiddenTags, tagCounts) {
    var keys = Object.keys(tagCounts || {});
    if (keys.length === 0) return hiddenTags || {};
    var nextHidden = hiddenTags || {};
    var visibleCount = 0;
    for (var i = 0; i < keys.length; i++) {
        if (!nextHidden[keys[i]]) visibleCount++;
    }
    return visibleCount === 0 ? {} : nextHidden;
}
`;
}
