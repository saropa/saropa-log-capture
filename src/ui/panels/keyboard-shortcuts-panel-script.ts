/**
 * Client-side JavaScript for the standalone keyboard shortcuts panel.
 *
 * Provides real-time filtering: the user types in the search input and rows
 * that don't match (by key, action name, or description) are hidden. Section
 * headings are hidden when all their rows are filtered out. A match counter
 * shows how many rows are visible. Clearing the input restores everything.
 */

/** Returns the inline JavaScript for the keyboard shortcuts search. */
export function getKeyboardShortcutsPanelScript(): string {
    return /* javascript */ `
(function() {
    var input = document.getElementById('shortcut-search');
    var clearBtn = document.getElementById('shortcut-search-clear');
    var countEl = document.getElementById('shortcut-match-count');
    if (!input) return;

    /** Filter all table rows by the search query. */
    function filterRows() {
        var query = input.value.toLowerCase().trim();
        var rows = document.querySelectorAll('tbody tr');
        var visible = 0;
        var total = rows.length;

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (!query) {
                row.style.display = '';
                visible++;
                continue;
            }
            /* Search across all three columns: key, action, description */
            var text = (row.textContent || '').toLowerCase();
            var match = text.indexOf(query) >= 0;
            row.style.display = match ? '' : 'none';
            if (match) visible++;
        }

        /* Hide section headings (h2) + tables when all rows in that table are hidden */
        var sections = document.querySelectorAll('h2');
        for (var j = 0; j < sections.length; j++) {
            var h2 = sections[j];
            var table = h2.nextElementSibling;
            if (!table || table.tagName !== 'TABLE') continue;
            var sectionRows = table.querySelectorAll('tbody tr');
            var anyVisible = false;
            for (var k = 0; k < sectionRows.length; k++) {
                if (sectionRows[k].style.display !== 'none') { anyVisible = true; break; }
            }
            h2.style.display = anyVisible ? '' : 'none';
            table.style.display = anyVisible ? '' : 'none';
        }

        /* Update match counter */
        if (countEl) {
            if (!query) {
                countEl.textContent = total + ' shortcuts';
            } else {
                countEl.textContent = visible + ' of ' + total + ' match';
            }
        }

        /* Show/hide clear button */
        if (clearBtn) {
            clearBtn.style.display = query ? '' : 'none';
        }
    }

    input.addEventListener('input', filterRows);

    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            input.value = '';
            filterRows();
            input.focus();
        });
    }

    /* Run once on load to set initial counter */
    filterRows();
})();
`;
}
