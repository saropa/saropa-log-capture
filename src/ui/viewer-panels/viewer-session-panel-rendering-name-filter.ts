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
    /** Build one removable chip for a dropdown filter (date range / minimum size) when it is
        not at its 'all' default. The chip label is read straight from the matching <option>'s
        text so it always equals what the dropdown shows — no duplicated label strings here.
        data-filter-clear names the option key the events handler resets to 'all'. */
    function renderFilterChip(selectId, key, icon) {
        var val = sessionDisplayOptions[key] || 'all';
        if (val === 'all') return '';
        var sel = document.getElementById(selectId);
        var label = val;
        if (sel) {
            var opt = sel.querySelector('option[value="' + val + '"]');
            if (opt) label = opt.textContent;
        }
        var removeTitle = vt('viewer.session.filterChip.remove.title', label);
        return '<span class="session-filter-chip">'
            + '<span class="codicon codicon-' + icon + '"></span> '
            + '<span class="session-filter-chip-label">' + escapeHtmlText(label) + '</span>'
            + '<button type="button" class="session-filter-chip-remove" data-filter-clear="' + escapeAttr(key) + '" title="' + escapeAttr(removeTitle) + '" aria-label="' + escapeAttr(removeTitle) + '">'
            + '<span class="codicon codicon-close"></span></button>'
            + '</span>';
    }

    /** Active-filters bar: a leading funnel icon, one removable chip per active dropdown filter
        (date, size), then the cumulative name filter (verb + per-name pills + "Show All"). Hidden
        only when NOTHING is filtered. Also toggles the kebab's "active filters" dot here — this runs
        on every render, so the dot stays correct whether a filter changed via the menu or a chip. */
    function renderNameFilterBar() {
        var nameFilterBarEl = document.getElementById('session-name-filter-bar');
        if (!nameFilterBarEl) return;
        var dateChip = renderFilterChip('session-date-range', 'dateRange', 'calendar');
        var sizeChip = renderFilterChip('session-size-range', 'sizeRange', 'database');
        var nameActive = !!(sessionNameFilter && sessionNameFilter.names.length);
        var kebab = document.getElementById('session-options-toggle');
        if (kebab) kebab.classList.toggle('has-active-filters', !!(dateChip || sizeChip || nameActive));
        /* Filter group row dot: lights when a date or size filter (the controls that live inside the
           Filter submenu) is active, so the indicator points at the group holding the active filter
           — not just the kebab. Name filtering has its own always-visible chip bar, so it is not
           mirrored here. */
        var filterGroup = document.getElementById('session-filter-group');
        if (filterGroup) filterGroup.classList.toggle('has-active-filters', !!(dateChip || sizeChip));
        if (!dateChip && !sizeChip && !nameActive) {
            nameFilterBarEl.style.display = 'none';
            nameFilterBarEl.innerHTML = '';
            return;
        }
        var html = '<span class="session-name-filter-label"><span class="codicon codicon-filter"></span></span>'
            + dateChip + sizeChip;
        if (nameActive) {
            var verb = sessionNameFilter.mode === 'only'
                ? vt('viewer.session.nameFilter.only') : vt('viewer.session.nameFilter.hiding');
            html += '<span class="session-name-filter-verb">' + escapeHtmlText(verb) + '</span>'
                + '<span class="session-name-filter-pills">' + renderNameFilterPills() + '</span>'
                + '<button type="button" id="session-name-filter-clear" class="session-name-filter-clear" title="' + vt('viewer.session.nameFilter.clear.title') + '" aria-label="' + vt('viewer.session.nameFilter.clear.title') + '">'
                + '<span class="codicon codicon-close"></span> ' + vt('viewer.session.nameFilter.showAll') + '</button>';
        }
        nameFilterBarEl.innerHTML = html;
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
