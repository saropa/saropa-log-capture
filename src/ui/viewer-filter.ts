/**
 * Client-side JavaScript for the category filter in the log viewer webview.
 * Provides filter state, apply/toggle logic, and setCategories message handling.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getFilterScript(): string {
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
    recalcHeights();
    renderViewport(true);
}

function handleFilterChange() {
    var sel = document.getElementById('filter-select');
    if (!sel) return;
    var opts = sel.options;
    var selected = [];
    for (var i = 0; i < opts.length; i++) {
        if (opts[i].selected) selected.push(opts[i].value);
    }
    activeFilters = selected.length === opts.length ? null : new Set(selected);
    applyFilter();
}

function handleSetCategories(msg) {
    var sel = document.getElementById('filter-select');
    if (sel && msg.categories) {
        var existing = new Set();
        for (var ci = 0; ci < sel.options.length; ci++) existing.add(sel.options[ci].value);
        for (var ci = 0; ci < msg.categories.length; ci++) {
            if (!existing.has(msg.categories[ci])) {
                var opt = document.createElement('option');
                opt.value = msg.categories[ci];
                opt.textContent = msg.categories[ci];
                opt.selected = true;
                sel.appendChild(opt);
            }
        }
        // Show the filter dropdown now that it has content
        if (sel.options.length > 0) {
            sel.style.display = '';
        }
    }
}

// Register filter change handler
var filterSelect = document.getElementById('filter-select');
if (filterSelect) {
    filterSelect.addEventListener('change', handleFilterChange);
}
`;
}
