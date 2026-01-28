/**
 * Client-side JavaScript for the category filter in the log viewer webview.
 * Provides filter state, apply/toggle logic, and setCategories message handling.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getFilterScript(): string {
    return /* javascript */ `
var activeFilters = null;

function applyFilter() {
    totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        var hidden = activeFilters && !activeFilters.has(item.category) && item.type !== 'marker';
        item.filteredOut = !!hidden;
        if (!hidden) {
            var defaultH = item.type === 'marker' ? MARKER_HEIGHT : ROW_HEIGHT;
            if (item.type === 'stack-frame' && item.groupId >= 0) {
                var hdr = allLines.find(function(x) { return x.groupId === item.groupId && x.type === 'stack-header'; });
                item.height = (hdr && hdr.collapsed) ? 0 : defaultH;
            } else {
                item.height = defaultH;
            }
        } else {
            item.height = 0;
        }
        totalHeight += item.height;
    }
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
    }
}
`;
}
