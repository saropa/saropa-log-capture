/**
 * Name filter bar rendering for the session list. Returns a JS fragment that runs
 * inside the session panel IIFE scope (function declarations hoist across the
 * concatenated fragments, so renderSessionList in the sibling rendering script can
 * call renderNameFilterBar). Extracted from viewer-session-panel-rendering.ts to
 * keep that file under the 300-line code limit (see `.claude/rules/global.md`).
 *
 * The bar shows a verb label ("Hiding:" / "Showing only:") followed by one
 * removable pill per filtered name, then a "Show All" button. The cumulative
 * filter state (`sessionNameFilter = { mode, names[] }`) lives in
 * viewer-session-panel.ts; pill [x] / clear clicks are wired in
 * viewer-session-panel-events.ts.
 */

/** Get the name-filter-bar rendering script fragment. */
export function getNameFilterBarScript(): string {
    return /* javascript */ `
    /** Update the name filter bar: verb label + one removable pill per filtered
        name + a "Show All" clear button when active, hidden when not. */
    function renderNameFilterBar() {
        var nameFilterBarEl = document.getElementById('session-name-filter-bar');
        if (!nameFilterBarEl) return;
        if (!sessionNameFilter || !sessionNameFilter.names.length) {
            nameFilterBarEl.style.display = 'none';
            nameFilterBarEl.innerHTML = '';
            return;
        }
        var verb = sessionNameFilter.mode === 'only'
            ? vt('viewer.session.nameFilter.only') : vt('viewer.session.nameFilter.hiding');
        nameFilterBarEl.innerHTML = '<span class="session-name-filter-label">'
            + '<span class="codicon codicon-filter"></span> '
            + escapeHtmlText(verb)
            + '</span>'
            + '<span class="session-name-filter-pills">' + renderNameFilterPills() + '</span>'
            + '<button type="button" id="session-name-filter-clear" class="session-name-filter-clear" title="' + vt('viewer.session.nameFilter.clear.title') + '" aria-label="' + vt('viewer.session.nameFilter.clear.title') + '">'
            + '<span class="codicon codicon-close"></span> ' + vt('viewer.session.nameFilter.showAll') + '</button>';
        nameFilterBarEl.style.display = '';
    }

    /** One pill per filtered name. data-name carries the RAW basename (the filter's
        identity) while the visible label uses current display-option transforms so it
        matches what the user sees in the list (adapts when Dates/Tidy change). */
    function renderNameFilterPills() {
        return sessionNameFilter.names.map(function(rawName) {
            var label = applySessionDisplayOptions(rawName);
            var removeTitle = vt('viewer.session.nameFilter.remove.title', label);
            return '<span class="session-name-filter-pill">'
                + '<span class="session-name-filter-pill-label">' + escapeHtmlText(label) + '</span>'
                + '<button type="button" class="session-name-filter-pill-remove" data-name="' + escapeAttr(rawName) + '" title="' + escapeAttr(removeTitle) + '" aria-label="' + escapeAttr(removeTitle) + '">'
                + '<span class="codicon codicon-close"></span></button>'
                + '</span>';
        }).join('');
    }
`;
}
