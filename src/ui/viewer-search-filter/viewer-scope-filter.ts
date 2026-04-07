/**
 * Source scope filter for the log viewer webview.
 *
 * Filters log lines by their DAP source path relative to the active
 * editor file. Supports 5 scope levels: all, workspace, package,
 * directory, file. Lines without a source path ("unattributed") can
 * optionally be hidden.
 *
 * Scope filter hint system lives in viewer-scope-filter-hint.ts.
 */

/** Returns the JavaScript code for the scope filter. */
export function getScopeFilterScript(): string {
    return /* javascript */ `
var scopeLevel = 'all';
var scopeHideUnattributed = false;
/** Live context from the active editor — updates on every editor change. */
var scopeContext = { activeFilePath: null, workspaceFolder: null, packageRoot: null, activeDirectory: null };
/** Locked context snapshot — set when user picks a scope level, used for filtering. */
var scopeLocked = { activeFilePath: null, workspaceFolder: null, packageRoot: null, activeDirectory: null };
function normScopePath(p) {
    if (!p) return null;
    var n = p.replace(/\\\\/g, '/').toLowerCase();
    /* Strip leading / before drive letter (uri.path gives /d:/… but DAP gives d:\\…). */
    if (n.length >= 3 && n[0] === '/' && n[2] === ':') n = n.substring(1);
    return n;
}

/** Returns true if the line should be hidden by the scope filter. Uses locked (snapshot) paths. */
function calcScopeFiltered(sourcePath) {
    if (scopeLevel === 'all') return false;
    var sp = normScopePath(sourcePath);
    if (!sp) return scopeHideUnattributed;
    switch (scopeLevel) {
        case 'workspace':
            return !scopeLocked.workspaceFolder || sp.indexOf(scopeLocked.workspaceFolder) !== 0;
        case 'package':
            return !scopeLocked.packageRoot || sp.indexOf(scopeLocked.packageRoot) !== 0;
        case 'directory':
            if (!scopeLocked.activeDirectory) return true;
            var dirPrefix = scopeLocked.activeDirectory.endsWith('/') ? scopeLocked.activeDirectory : scopeLocked.activeDirectory + '/';
            return sp.indexOf(dirPrefix) !== 0 && sp !== scopeLocked.activeDirectory;
        case 'file':
            return !scopeLocked.activeFilePath || sp !== scopeLocked.activeFilePath;
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
    if (typeof flushScopeFilterHint === 'function') flushScopeFilterHint();
}

/** Extract last path segment for display. */
function lastPathSegment(raw) {
    if (!raw) return null;
    var segs = raw.replace(/\\/+$/, '').split('/');
    return segs[segs.length - 1] || raw;
}

function scopeSummaryLabel(level) {
    if (level === 'all') return '';
    var ids = { workspace: 'workspaceFolder', package: 'packageRoot', directory: 'activeDirectory', file: 'activeFilePath' };
    var name = lastPathSegment(scopeLocked[ids[level]]);
    return name ? ('Only ' + name) : level;
}

function setScopeLevel(level) {
    scopeLevel = level;
    /* Lock the current context so switching editors won't change the active filter. */
    if (level !== 'all') {
        scopeLocked.activeFilePath = normScopePath(scopeContext.activeFilePath);
        scopeLocked.workspaceFolder = normScopePath(scopeContext.workspaceFolder);
        scopeLocked.packageRoot = normScopePath(scopeContext.packageRoot);
        scopeLocked.activeDirectory = normScopePath(scopeContext.activeDirectory);
    } else {
        scopeLocked.activeFilePath = null;
        scopeLocked.workspaceFolder = null;
        scopeLocked.packageRoot = null;
        scopeLocked.activeDirectory = null;
    }
    if (typeof setAccordionSummary === 'function') {
        setAccordionSummary('scope-section', scopeSummaryLabel(level));
    }
    applyScopeFilter();
    updateScopeRadios();
    updateScopeUnattribState();
    if (typeof markPresetDirty === 'function') markPresetDirty();
}

function handleScopeContextMessage(msg) {
    scopeContext.activeFilePath = msg.activeFilePath || null;
    scopeContext.workspaceFolder = msg.workspaceFolder || null;
    scopeContext.packageRoot = msg.packageRoot || null;
    scopeContext.activeDirectory = msg.activeDirectory || null;
    /* Update UI (suffixes, disabled state) but do NOT re-apply the filter — locked paths are stable. */
    updateScopeStatus();
    updateScopeRadioDisabled();
    updateScopeSuffixes();
    updateScopeUnattribState();
}

function resetScopeFilter() {
    scopeLevel = 'all';
    scopeLocked.activeFilePath = null;
    scopeLocked.workspaceFolder = null;
    scopeLocked.packageRoot = null;
    scopeLocked.activeDirectory = null;
    if (typeof setAccordionSummary === 'function') setAccordionSummary('scope-section', '');
    scopeHideUnattributed = false;
    var cb = document.getElementById('scope-hide-unattrib');
    if (cb) cb.checked = false;
    updateScopeRadios();
    updateScopeUnattribState();
    applyScopeFilter();
}

function syncScopeUi() {
    updateScopeRadios();
    updateScopeRadioDisabled();
    updateScopeStatus();
    updateScopeUnattribState();
    var cb = document.getElementById('scope-hide-unattrib');
    if (cb) cb.checked = scopeHideUnattributed;
    if (typeof flushScopeFilterHint === 'function') flushScopeFilterHint();
}

/** Enable/disable the unattributed checkbox based on active scope. */
function updateScopeUnattribState() {
    var cb = document.getElementById('scope-hide-unattrib');
    if (!cb) return;
    var active = scopeLevel !== 'all';
    cb.disabled = !active;
    var lbl = cb.closest('label');
    if (lbl) lbl.classList.toggle('scope-disabled', !active);
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
        el.textContent = 'Open a source file to enable scope filters';
        el.removeAttribute('title');
        return;
    }
    el.textContent = '';
    el.removeAttribute('title');
}

/** Show the actual path segment each scope radio would filter to. */
function updateScopeSuffixes() {
    var ids = { workspace: 'workspaceFolder', package: 'packageRoot', directory: 'activeDirectory', file: 'activeFilePath' };
    var keys = ['workspace', 'package', 'directory', 'file'];
    for (var si = 0; si < keys.length; si++) {
        var span = document.getElementById('scope-suffix-' + keys[si]);
        if (!span) continue;
        /* Show locked path for the active scope level, live context for others. */
        var raw = (scopeLevel === keys[si]) ? scopeLocked[ids[keys[si]]] : scopeContext[ids[keys[si]]];
        var name = lastPathSegment(raw);
        if (!name) { span.textContent = ''; continue; }
        span.textContent = ' (' + name + ')';
        span.title = raw || '';
    }
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
