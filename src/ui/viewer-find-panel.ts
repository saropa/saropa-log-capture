/**
 * Find in Files panel HTML and script for the webview.
 *
 * Searches all log files in the reports directory concurrently.
 * Displays matched files with counts; clicking cycles through matches.
 * Follows the same slide-out pattern as the session and options panels.
 */

/** Generate the Find in Files panel HTML. */
export function getFindPanelHtml(): string {
    return /* html */ `
<div id="find-panel" class="find-panel">
    <div class="find-panel-header">
        <span>Find in Files</span>
        <button id="find-panel-close" class="find-panel-close" title="Close">&times;</button>
    </div>
    <div class="find-panel-content" style="display:flex;flex-direction:column;flex:1;min-height:0;">
        <div class="find-input-wrapper">
            <input id="find-input" type="text" placeholder="Search all session files..." />
            <div class="find-input-actions">
                <button id="find-case-toggle" class="search-input-btn" title="Match Case">
                    <span class="codicon codicon-case-sensitive"></span>
                </button>
                <button id="find-word-toggle" class="search-input-btn" title="Match Whole Word">
                    <span class="codicon codicon-whole-word"></span>
                </button>
                <button id="find-regex-toggle" class="search-input-btn" title="Use Regular Expression">
                    <span class="codicon codicon-regex"></span>
                </button>
            </div>
        </div>
        <div id="find-summary" class="find-summary"></div>
        <div id="find-results" class="find-results"></div>
        <div id="find-empty" class="find-empty">Type to search across all session files</div>
        <div id="find-loading" class="find-loading" style="display:none">Searching...</div>
    </div>
</div>`;
}

/** Generate the Find in Files panel script. */
export function getFindPanelScript(): string {
    return /* js */ `
(function() {
    var findPanelEl = document.getElementById('find-panel');
    var findInputEl = document.getElementById('find-input');
    var findSummaryEl = document.getElementById('find-summary');
    var findResultsEl = document.getElementById('find-results');
    var findEmptyEl = document.getElementById('find-empty');
    var findLoadingEl = document.getElementById('find-loading');

    var findPanelOpen = false;
    var findCaseSensitive = false;
    var findWholeWord = false;
    var findRegexMode = false;
    var cachedResults = null;
    var activeFileUri = null;
    var activeMatchIdx = 0;
    var lastQuery = '';
    var findTimeout = null;

    window.openFindPanel = function() {
        if (!findPanelEl) return;
        findPanelOpen = true;
        findPanelEl.classList.add('visible');
        findInputEl.focus();
    };

    window.closeFindPanel = function() {
        if (!findPanelEl) return;
        findPanelEl.classList.remove('visible');
        findPanelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('find');
    };

    function triggerSearch() {
        var query = findInputEl.value.trim();
        if (query.length < 2) {
            clearResults();
            findEmptyEl.style.display = query ? 'none' : '';
            findSummaryEl.textContent = query ? 'Type at least 2 characters' : '';
            return;
        }
        findLoadingEl.style.display = '';
        findEmptyEl.style.display = 'none';
        findSummaryEl.textContent = '';
        activeFileUri = null;
        activeMatchIdx = 0;
        lastQuery = query;
        vscodeApi.postMessage({
            type: 'requestFindInFiles',
            query: query,
            caseSensitive: findCaseSensitive,
            wholeWord: findWholeWord,
            useRegex: findRegexMode,
        });
    }

    function clearResults() {
        cachedResults = null;
        activeFileUri = null;
        activeMatchIdx = 0;
        if (findResultsEl) findResultsEl.innerHTML = '';
        if (findLoadingEl) findLoadingEl.style.display = 'none';
    }

    function renderResults(data) {
        findLoadingEl.style.display = 'none';
        if (!data || !data.files || data.files.length === 0) {
            findResultsEl.innerHTML = '';
            findEmptyEl.style.display = '';
            findEmptyEl.textContent = 'No matches found';
            findSummaryEl.textContent = data
                ? data.totalMatches + ' matches in 0 of ' + data.totalFiles + ' files'
                : '';
            return;
        }
        findEmptyEl.style.display = 'none';
        findSummaryEl.textContent = data.totalMatches + ' match'
            + (data.totalMatches === 1 ? '' : 'es') + ' in '
            + data.files.length + ' of ' + data.totalFiles + ' file'
            + (data.totalFiles === 1 ? '' : 's');

        var html = '';
        for (var i = 0; i < data.files.length; i++) {
            var f = data.files[i];
            var activeCls = (f.uriString === activeFileUri) ? ' active' : '';
            html += '<div class="find-result-item' + activeCls + '" data-uri="'
                + escapeAttr(f.uriString) + '" data-count="' + f.matchCount + '">'
                + '<span class="codicon codicon-file"></span>'
                + '<span class="find-result-name">' + escapeHtml(f.filename) + '</span>'
                + '<span class="find-result-badge">' + f.matchCount + '</span>'
                + '</div>';
        }
        findResultsEl.innerHTML = html;
    }

    function handleFileClick(uriString, matchCount) {
        if (uriString === activeFileUri) {
            activeMatchIdx = (activeMatchIdx + 1) % matchCount;
            vscodeApi.postMessage({
                type: 'findNavigateMatch',
                uriString: uriString,
                matchIndex: activeMatchIdx,
            });
        } else {
            activeFileUri = uriString;
            activeMatchIdx = 0;
            vscodeApi.postMessage({
                type: 'openFindResult',
                uriString: uriString,
                query: findInputEl.value,
                caseSensitive: findCaseSensitive,
                wholeWord: findWholeWord,
                useRegex: findRegexMode,
            });
        }
        highlightActive(uriString);
    }

    function highlightActive(uriString) {
        if (!findResultsEl) return;
        var items = findResultsEl.querySelectorAll('.find-result-item');
        for (var i = 0; i < items.length; i++) {
            items[i].classList.toggle('active', items[i].getAttribute('data-uri') === uriString);
        }
    }

    /* --- Toggle buttons --- */

    function syncToggles() {
        toggleClass('find-case-toggle', findCaseSensitive);
        toggleClass('find-word-toggle', findWholeWord);
        toggleClass('find-regex-toggle', findRegexMode);
    }

    function toggleClass(id, active) {
        var el = document.getElementById(id);
        if (el) el.classList.toggle('active', active);
    }

    function bindToggle(id, getter, setter) {
        var btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', function() {
            setter(!getter());
            syncToggles();
            debouncedSearch();
        });
    }

    bindToggle('find-case-toggle',
        function() { return findCaseSensitive; },
        function(v) { findCaseSensitive = v; });
    bindToggle('find-word-toggle',
        function() { return findWholeWord; },
        function(v) { findWholeWord = v; });
    bindToggle('find-regex-toggle',
        function() { return findRegexMode; },
        function(v) { findRegexMode = v; });

    syncToggles();

    /* --- Debounced input --- */

    function debouncedSearch() {
        if (findTimeout) clearTimeout(findTimeout);
        findTimeout = setTimeout(triggerSearch, 300);
    }

    findInputEl.addEventListener('input', debouncedSearch);
    findInputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); triggerSearch(); }
        if (e.key === 'Escape') { e.preventDefault(); closeFindPanel(); }
    });

    /* --- Result clicks --- */

    if (findResultsEl) {
        findResultsEl.addEventListener('click', function(e) {
            var item = e.target.closest('.find-result-item');
            if (!item) return;
            var uri = item.getAttribute('data-uri');
            var count = parseInt(item.getAttribute('data-count') || '1', 10);
            if (uri) handleFileClick(uri, count);
        });
    }

    /* --- Close / outside click --- */

    var closeBtn = document.getElementById('find-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeFindPanel);

    findPanelEl.addEventListener('click', function(e) { e.stopPropagation(); });

    document.addEventListener('click', function(e) {
        if (!findPanelOpen) return;
        if (findPanelEl && findPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-find');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeFindPanel();
    });

    /* --- Message listener --- */

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'findResults') {
            if (e.data.query !== lastQuery) return;
            cachedResults = e.data;
            renderResults(e.data);
        }
    });

    /* --- Helpers --- */

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
})();
`;
}
