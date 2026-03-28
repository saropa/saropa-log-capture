/**
 * Shared tag-selection guard for viewer tag filters.
 *
 * Prevents "zero selected tags" states when users toggle chips off one-by-one.
 * If every known tag is hidden, we treat that state as "show all" by clearing
 * the hidden-tag map.
 */
export function getTagSelectionGuardScript(): string {
    return /* javascript */ `
// Compact counts for toolbar badges; keep in sync with log-count-short-format.ts (unit tests).
function formatScaledCountForToolbar(value, unit) {
    var s;
    if (value >= 100) s = Math.floor(value).toString();
    else if (value >= 10) s = value.toFixed(1);
    else if (Math.abs(value - Math.round(value)) < 1e-9) s = value.toFixed(0);
    else s = value.toFixed(1);
    return s.replace(/\\.0$/, '') + unit;
}
function formatLogCountShort(n) {
    var x = Math.floor(Number(n));
    if (!isFinite(x) || x < 0) return '0';
    if (x < 1000) return String(x);
    if (x < 1000000) return formatScaledCountForToolbar(x / 1000, 'k');
    if (x < 1000000000) return formatScaledCountForToolbar(x / 1000000, 'M');
    return formatScaledCountForToolbar(x / 1000000000, 'B');
}

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
