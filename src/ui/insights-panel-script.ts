/** Webview script for the cross-session insights panel. */
export function getInsightsPanelScript(): string {
    return `(function() {
    const vscode = acquireVsCodeApi();
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });
    document.getElementById('time-range')?.addEventListener('change', (e) => {
        vscode.postMessage({ type: 'setTimeRange', range: e.target.value });
    });
    document.addEventListener('click', (e) => {
        var act = e.target.closest('.err-action');
        if (act) { e.stopPropagation(); vscode.postMessage({ type: 'setErrorStatus', hash: act.dataset.hash, status: act.dataset.status }); return; }
        var match = e.target.closest('.drill-down-match');
        if (match) { vscode.postMessage({ type: 'openMatch', uri: match.dataset.uri, filename: match.dataset.filename, line: parseInt(match.dataset.line) }); return; }
        var el = e.target.closest('[data-action]');
        if (!el) return;
        if (el.dataset.action === 'openFile') {
            vscode.postMessage({ type: 'openFile', filename: el.dataset.filename });
        } else if (el.dataset.action === 'drillDown') {
            toggleDrillDown(el);
        }
    });
    function toggleDrillDown(el) {
        var existing = el.nextElementSibling;
        if (existing && existing.classList.contains('drill-down-panel')) {
            existing.remove(); el.classList.remove('expanded'); return;
        }
        var panel = document.createElement('div');
        panel.className = 'drill-down-panel';
        panel.dataset.hash = el.dataset.hash;
        panel.innerHTML = '<div class="drill-down-loading">Searching across sessions...</div>';
        el.after(panel); el.classList.add('expanded');
        vscode.postMessage({ type: 'drillDownError', hash: el.dataset.hash, normalized: el.dataset.normalized });
    }
    // --- Category chip filtering ---
    var excludedCats = {};
    var chipBar = document.querySelector('.cat-chip-bar');
    if (chipBar) chipBar.addEventListener('click', function(ev) {
        var chip = ev.target.closest('[data-cat-chip]');
        if (chip) {
            var cat = chip.dataset.catChip;
            excludedCats[cat] = !excludedCats[cat];
            chip.classList.toggle('active', !excludedCats[cat]);
            applyFilters(); return;
        }
        var action = ev.target.closest('[data-cat-action]');
        if (!action) return;
        var allChips = chipBar.querySelectorAll('[data-cat-chip]');
        var isNone = action.dataset.catAction === 'none';
        for (var i = 0; i < allChips.length; i++) {
            excludedCats[allChips[i].dataset.catChip] = isNone;
            allChips[i].classList.toggle('active', !isNone);
        }
        applyFilters();
    });

    // --- Search input filtering ---
    var searchInput = document.getElementById('insights-search');
    var searchTimer = null;
    if (searchInput) searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, 150);
    });

    function applyFilters() {
        var query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        var anyExcluded = Object.keys(excludedCats).some(function(k) { return excludedCats[k]; });
        // Filter hot files by search only
        var hotFiles = document.querySelectorAll('.hot-file');
        for (var i = 0; i < hotFiles.length; i++) {
            var show = !query || (hotFiles[i].dataset.searchText || '').indexOf(query) !== -1;
            hotFiles[i].style.display = show ? '' : 'none';
        }
        // Filter error groups by search + category
        var errors = document.querySelectorAll('.error-group');
        for (var j = 0; j < errors.length; j++) {
            var el = errors[j];
            var matchSearch = !query || (el.dataset.searchText || '').indexOf(query) !== -1;
            var matchCat = !anyExcluded || !el.dataset.cat || !excludedCats[el.dataset.cat];
            el.style.display = (matchSearch && matchCat) ? '' : 'none';
        }
    }

    window.addEventListener('message', (event) => {
        var msg = event.data;
        if (msg.type === 'drillDownResults') {
            var panel = document.querySelector('.drill-down-panel[data-hash="' + msg.hash + '"]');
            if (panel) panel.innerHTML = msg.html;
        } else if (msg.type === 'productionBridgeLoading') {
            var loadEl = document.getElementById('production-loading');
            if (loadEl) loadEl.style.display = '';
        } else if (msg.type === 'productionBridgeResults') {
            var loadEl2 = document.getElementById('production-loading');
            if (loadEl2) loadEl2.style.display = 'none';
            var bridges = msg.bridges || {};
            Object.keys(bridges).forEach(function(hash) {
                var badge = document.querySelector('.production-badge[data-badge-hash="' + hash + '"]');
                if (badge) badge.textContent = ' · Production: ' + bridges[hash];
            });
        }
    });
})();`;
}
