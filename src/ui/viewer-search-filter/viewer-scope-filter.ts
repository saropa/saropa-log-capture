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
    updateScopeStatus();
    updateScopeRadioDisabled();
    if (scopeLevel !== 'all') applyScopeFilter();
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
    var cb = document.getElementById('scope-hide-unattrib');
    if (cb) cb.checked = scopeHideUnattributed;
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
        el.textContent = 'No active editor';
        return;
    }
    var parts = scopeContext.activeFilePath.split('/');
    el.textContent = parts[parts.length - 1] || 'Unknown';
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
`;
}
