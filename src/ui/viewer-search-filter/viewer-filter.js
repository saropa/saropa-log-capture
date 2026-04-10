"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilterScript = getFilterScript;
/**
 * Client-side JavaScript for the category filter in the log viewer webview.
 *
 * Categories (DAP output channels like stdout, stderr, console) are shown
 * as checkboxes in the Log Inputs section of the filter drawer/panel.
 * Dynamically populated when categories arrive from the extension.
 */
function getFilterScript() {
    return /* javascript */ `
/** Set of allowed categories, or null to show all. */
var activeFilters = null;

/**
 * Set filteredOut flag on each line based on category membership.
 * Delegates height recalculation to the shared recalcHeights() so that
 * exclusion and level filters are also respected.
 */
function applyFilter() {
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        item.filteredOut = !!(activeFilters && !activeFilters.has(item.category) && item.type !== 'marker');
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

/**
 * Handle channel checkbox changes — rebuild activeFilters set.
 */
function handleChannelChange() {
    var boxes = document.querySelectorAll('#output-channels-list input[type="checkbox"]');
    var selected = [];
    var total = 0;
    for (var i = 0; i < boxes.length; i++) {
        total++;
        if (boxes[i].checked) selected.push(boxes[i].dataset.category);
    }
    activeFilters = selected.length === total ? null : new Set(selected);
    if (typeof updateLogInputsSummary === 'function') updateLogInputsSummary();
    applyFilter();
}

/**
 * Handle setCategories message from extension.
 * Creates checkboxes in the Log Inputs section.
 */
function handleSetCategories(msg) {
    var container = document.getElementById('output-channels-list');
    var section = document.getElementById('log-inputs-section');
    if (!container || !msg.categories) return;

    for (var ci = 0; ci < msg.categories.length; ci++) {
        var cat = msg.categories[ci];
        if (document.getElementById('channel-' + cat)) continue;

        var label = document.createElement('label');
        label.className = 'options-row';
        label.title = 'Show or hide ' + cat + ' output';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'channel-' + cat;
        cb.checked = true;
        cb.dataset.category = cat;
        cb.addEventListener('change', handleChannelChange);

        var span = document.createElement('span');
        span.textContent = cat;

        label.appendChild(cb);
        label.appendChild(span);
        container.appendChild(label);
    }

    if (container.children.length > 0 && section) {
        section.style.display = '';
    }

    // Show divider if sources also exist
    var divider = document.getElementById('log-inputs-divider');
    var sourceList = document.getElementById('source-filter-list');
    if (divider && sourceList && sourceList.children.length > 0 && container.children.length > 0) {
        divider.style.display = '';
    }

    if (typeof updateLogInputsSummary === 'function') updateLogInputsSummary();
}
`;
}
//# sourceMappingURL=viewer-filter.js.map