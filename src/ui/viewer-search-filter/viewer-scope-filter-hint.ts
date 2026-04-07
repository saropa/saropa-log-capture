/**
 * Scope filter hint system for the log viewer webview.
 *
 * Shows guidance when most lines are hidden by a location scope or
 * many lines lack a debugger path. Hint updates are debounced from
 * the `recalcHeights` hook and flushed immediately after user-driven
 * scope changes.
 *
 * Depends on globals from viewer-scope-filter.ts: `scopeLevel`,
 * `scopeLocked`, `scopeHideUnattributed`, `allLines`, `setScopeLevel`.
 */

/** Returns the JavaScript code for the scope filter hint system. */
export function getScopeFilterHintScript(): string {
    return /* javascript */ `
var scopeHintMinLines = 8;
var scopeHintHiddenRatio = 0.75;
var scopeHintNoPathRatio = 0.25;
var scopeHintDebounceMs = 200;
var scopeHintDebounceTimer = null;

function clearScopeFilterHint() {
    var el = document.getElementById('scope-filter-hint');
    if (!el) return;
    el.innerHTML = '';
    el.style.display = 'none';
}

/** Debounced hint refresh for high-frequency layout passes (e.g. virtual scroll). */
function scheduleScopeFilterHint() {
    if (scopeLevel === 'all' || !scopeLocked.activeFilePath) {
        if (scopeHintDebounceTimer) {
            clearTimeout(scopeHintDebounceTimer);
            scopeHintDebounceTimer = null;
        }
        clearScopeFilterHint();
        return;
    }
    if (scopeHintDebounceTimer) clearTimeout(scopeHintDebounceTimer);
    scopeHintDebounceTimer = setTimeout(function() {
        scopeHintDebounceTimer = null;
        updateScopeFilterHint();
    }, scopeHintDebounceMs);
}

/** Run hint logic immediately (after user-driven scope changes). */
function flushScopeFilterHint() {
    if (scopeHintDebounceTimer) {
        clearTimeout(scopeHintDebounceTimer);
        scopeHintDebounceTimer = null;
    }
    if (scopeLevel === 'all' || !scopeLocked.activeFilePath) {
        clearScopeFilterHint();
        return;
    }
    updateScopeFilterHint();
}

/**
 * When a location scope is active, show short guidance if most lines are scope-hidden
 * or many lines lack a debugger path (helps empty-looking logs).
 */
function updateScopeFilterHint() {
    var el = document.getElementById('scope-filter-hint');
    if (!el) return;
    if (typeof scopeLevel === 'undefined' || scopeLevel === 'all' || !scopeLocked.activeFilePath) {
        clearScopeFilterHint();
        return;
    }
    if (typeof allLines === 'undefined' || !allLines.length) {
        clearScopeFilterHint();
        return;
    }
    var total = 0;
    var scopeHidden = 0;
    var noPath = 0;
    for (var hi = 0; hi < allLines.length; hi++) {
        var item = allLines[hi];
        if (item.type === 'marker') continue;
        total++;
        if (item.scopeFiltered) scopeHidden++;
        if (!item.sourcePath) noPath++;
    }
    if (total < scopeHintMinLines) {
        el.textContent = '';
        el.style.display = 'none';
        return;
    }
    var ratioHidden = scopeHidden / total;
    var ratioNoPath = noPath / total;
    var messages = [];
    var suggestReset = false;
    if (ratioHidden >= scopeHintHiddenRatio) {
        messages.push('Most lines are hidden by this location scope. Try All logs or a wider scope (e.g. Workspace) if the view looks empty.');
        suggestReset = true;
    }
    if (ratioNoPath >= scopeHintNoPathRatio && !scopeHideUnattributed) {
        messages.push('Many lines have no source file. Enable "Exclude lines with no source file" to drop them.');
    }
    if (messages.length === 0) {
        clearScopeFilterHint();
        return;
    }
    var html = '<span>' + messages.join(' ') + '</span>';
    if (suggestReset) {
        html += ' <button type="button" class="scope-hint-reset-btn" data-scope-reset="all">Reset to All logs</button>';
    }
    el.innerHTML = html;
    el.style.display = '';
}

var scopeHintEl = document.getElementById('scope-filter-hint');
if (scopeHintEl) {
    scopeHintEl.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-scope-reset="all"]') : null;
        if (!btn) return;
        setScopeLevel('all');
    });
}

var _origRecalcForScopeHint = typeof recalcHeights === 'function' ? recalcHeights : null;
if (_origRecalcForScopeHint) {
    recalcHeights = function() {
        _origRecalcForScopeHint();
        if (typeof scheduleScopeFilterHint === 'function') scheduleScopeFilterHint();
    };
}
`;
}
