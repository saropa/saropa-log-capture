/**
 * Source scope filter for the log viewer webview.
 *
 * Filters log lines by their DAP source path relative to the active
 * editor file. Supports 5 scope levels: all, workspace, package,
 * directory, file. Lines without a source path ("unattributed") can
 * optionally be hidden.
 */

/** Returns the JavaScript code for the scope filter. */
export function getScopeFilterScript(): string {
    return /* javascript */ `
var scopeLevel = 'all';
var scopeHideUnattributed = false;
var scopeContext = { activeFilePath: null, workspaceFolder: null, packageRoot: null, activeDirectory: null };
var scopeHintMinLines = 8;
var scopeHintHiddenRatio = 0.75;
var scopeHintNoPathRatio = 0.25;

function normScopePath(p) {
    if (!p) return null;
    return p.replace(/\\\\/g, '/').toLowerCase();
}

/** Returns true if the line should be hidden by the scope filter. */
function calcScopeFiltered(sourcePath) {
    if (scopeLevel === 'all') return false;
    var sp = normScopePath(sourcePath);
    if (!sp) return scopeHideUnattributed;
    switch (scopeLevel) {
        case 'workspace':
            return !scopeContext.workspaceFolder || sp.indexOf(scopeContext.workspaceFolder) !== 0;
        case 'package':
            return !scopeContext.packageRoot || sp.indexOf(scopeContext.packageRoot) !== 0;
        case 'directory':
            if (!scopeContext.activeDirectory) return true;
            var dirPrefix = scopeContext.activeDirectory.endsWith('/') ? scopeContext.activeDirectory : scopeContext.activeDirectory + '/';
            return sp.indexOf(dirPrefix) !== 0 && sp !== scopeContext.activeDirectory;
        case 'file':
            return !scopeContext.activeFilePath || sp !== scopeContext.activeFilePath;
        default:
            return false;
    }
}

function applyScopeFilter() {
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') continue;
        item.scopeFiltered = calcScopeFiltered(item.sourcePath);
    }
    recalcHeights();
    renderViewport(true);
}

function setScopeLevel(level) {
    scopeLevel = level;
    applyScopeFilter();
    updateScopeRadios();
    if (typeof markPresetDirty === 'function') markPresetDirty();
}

function handleScopeContextMessage(msg) {
    scopeContext.activeFilePath = msg.activeFilePath || null;
    scopeContext.workspaceFolder = msg.workspaceFolder || null;
    scopeContext.packageRoot = msg.packageRoot || null;
    scopeContext.activeDirectory = msg.activeDirectory || null;
    if (!scopeContext.activeFilePath && scopeLevel !== 'all') {
        scopeLevel = 'all';
        applyScopeFilter();
    }
    updateScopeStatus();
    updateScopeRadioDisabled();
    updateScopeNarrowingVisibility();
    if (scopeLevel !== 'all') applyScopeFilter();
    if (typeof updateScopeFilterHint === 'function') updateScopeFilterHint();
}

function resetScopeFilter() {
    scopeLevel = 'all';
    scopeHideUnattributed = false;
    var cb = document.getElementById('scope-hide-unattrib');
    if (cb) cb.checked = false;
    updateScopeRadios();
    applyScopeFilter();
}

function syncScopeUi() {
    updateScopeRadios();
    updateScopeRadioDisabled();
    updateScopeStatus();
    updateScopeNarrowingVisibility();
    var cb = document.getElementById('scope-hide-unattrib');
    if (cb) cb.checked = scopeHideUnattributed;
    if (typeof updateScopeFilterHint === 'function') updateScopeFilterHint();
}

/** Show workspace/package/directory/file controls only when an active editor file exists. */
function updateScopeNarrowingVisibility() {
    var block = document.getElementById('scope-narrowing-block');
    var hint = document.getElementById('scope-no-context-hint');
    if (!block || !hint) return;
    var hasFile = !!scopeContext.activeFilePath;
    block.style.display = hasFile ? '' : 'none';
    hint.style.display = hasFile ? 'none' : '';
}

function updateScopeRadios() {
    var radios = document.querySelectorAll('input[name="scope"]');
    for (var i = 0; i < radios.length; i++) {
        radios[i].checked = (radios[i].value === scopeLevel);
    }
}

function updateScopeRadioDisabled() {
    var map = {
        workspace: !!scopeContext.workspaceFolder,
        package: !!scopeContext.packageRoot,
        directory: !!scopeContext.activeDirectory,
        file: !!scopeContext.activeFilePath
    };
    var radios = document.querySelectorAll('input[name="scope"]');
    for (var i = 0; i < radios.length; i++) {
        var v = radios[i].value;
        if (v === 'all') continue;
        radios[i].disabled = !map[v];
        var lbl = radios[i].closest('label');
        if (lbl) lbl.classList.toggle('scope-disabled', !map[v]);
    }
}

function updateScopeStatus() {
    var el = document.getElementById('scope-status');
    if (!el) return;
    if (!scopeContext.activeFilePath) {
        el.textContent = 'No active editor — location filters are unavailable';
        el.removeAttribute('title');
        return;
    }
    var parts = scopeContext.activeFilePath.split('/');
    el.textContent = 'Active file: ' + (parts[parts.length - 1] || 'Unknown');
    el.title = scopeContext.activeFilePath;
}

// Wire radio button change events
var scopeRadios = document.querySelectorAll('input[name="scope"]');
for (var sri = 0; sri < scopeRadios.length; sri++) {
    scopeRadios[sri].addEventListener('change', function(e) {
        setScopeLevel(e.target.value);
    });
}

// Wire unattributed checkbox
var scopeUnattribCb = document.getElementById('scope-hide-unattrib');
if (scopeUnattribCb) {
    scopeUnattribCb.addEventListener('change', function(e) {
        scopeHideUnattributed = e.target.checked;
        if (scopeLevel !== 'all') applyScopeFilter();
        if (typeof markPresetDirty === 'function') markPresetDirty();
    });
}

/**
 * When a location scope is active, show short guidance if most lines are scope-hidden
 * or many lines lack a debugger path (helps empty-looking logs).
 */
function updateScopeFilterHint() {
    var el = document.getElementById('scope-filter-hint');
    if (!el) return;
    if (typeof scopeLevel === 'undefined' || scopeLevel === 'all' || !scopeContext.activeFilePath) {
        el.textContent = '';
        el.style.display = 'none';
        return;
    }
    if (typeof allLines === 'undefined' || !allLines.length) {
        el.textContent = '';
        el.style.display = 'none';
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
        messages.push('Many lines have no debugger file path. Enable Hide lines without file path to drop them while a location scope is on.');
    }
    if (messages.length === 0) {
        el.textContent = '';
        el.style.display = 'none';
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
        updateScopeFilterHint();
    });
}

var _origRecalcForScopeHint = typeof recalcHeights === 'function' ? recalcHeights : null;
if (_origRecalcForScopeHint) {
    recalcHeights = function() {
        _origRecalcForScopeHint();
        if (typeof updateScopeFilterHint === 'function') updateScopeFilterHint();
    };
}
`;
}
