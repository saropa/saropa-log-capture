/**
 * Find in Files panel HTML and script for the webview.
 *
 * Searches all log files in the reports directory concurrently.
 * Displays matched files with counts; clicking cycles through matches.
 * Follows the same slide-out pattern as the session and options panels.
 */

import { t } from '../../l10n';
import { escapeHtmlScript } from '../escape-html-script';

/** Generate the Find in Files panel HTML. */
export function getFindPanelHtml(): string {
    return /* html */ `
<div id="find-panel" class="find-panel" role="region" aria-label="${t('viewer.find.region')}">
    <div class="find-panel-header">
        <span>${t('viewer.find.header')}</span>
        <div class="find-panel-header-actions">
            <button id="find-sort-toggle" class="find-header-btn" title="${t('viewer.find.sort.title')}" aria-label="${t('viewer.find.sort.label')}"><span class="codicon codicon-sort-precedence"></span></button>
            <button id="find-panel-close" class="find-panel-close" title="${t('viewer.find.close.title')}" aria-label="${t('viewer.find.close.label')}"><span class="codicon codicon-close"></span></button>
        </div>
    </div>
    <div class="find-panel-content" style="display:flex;flex-direction:column;flex:1;min-height:0;">
        <div class="find-input-wrapper">
            <input id="find-input" type="text" placeholder="${t('viewer.find.input.placeholder')}" title="${t('viewer.find.input.title')}" aria-label="${t('viewer.find.input.label')}" />
            <div class="find-input-actions">
                <button id="find-case-toggle" class="search-input-btn" title="${t('viewer.search.case.title')}" aria-label="${t('viewer.search.case.label')}">
                    <span class="codicon codicon-case-sensitive"></span>
                </button>
                <button id="find-word-toggle" class="search-input-btn" title="${t('viewer.search.word.title')}" aria-label="${t('viewer.search.word.label')}">
                    <span class="codicon codicon-whole-word"></span>
                </button>
                <button id="find-regex-toggle" class="search-input-btn" title="${t('viewer.search.regex.title')}" aria-label="${t('viewer.search.regex.label')}">
                    <span class="codicon codicon-regex"></span>
                </button>
            </div>
        </div>
        <div id="find-summary" class="find-summary"></div>
        <div id="find-results" class="find-results"></div>
        <div id="find-empty" class="find-empty">${t('viewer.find.empty')}</div>
        <div id="find-loading" class="find-loading" style="display:none">${t('viewer.find.loading')}</div>
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
    var findSortByHits = false;
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
        var ibBtn = document.getElementById('ib-find');
        if (ibBtn) ibBtn.focus();
    };

    function triggerSearch() {
        var query = findInputEl.value.trim();
        if (query.length < 2) {
            clearResults();
            findEmptyEl.style.display = query ? 'none' : '';
            findSummaryEl.textContent = query ? vt('viewer.find.minChars') : '';
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
            findEmptyEl.textContent = vt('viewer.find.noMatches');
            findSummaryEl.textContent = data
                ? vt('viewer.find.summaryZero', data.totalMatches, data.totalFiles)
                : '';
            return;
        }
        findEmptyEl.style.display = 'none';
        findSummaryEl.textContent = vt('viewer.find.summary',
            data.totalMatches,
            vt(data.totalMatches === 1 ? 'viewer.find.matchWord.one' : 'viewer.find.matchWord.many'),
            data.files.length,
            data.totalFiles,
            vt(data.totalFiles === 1 ? 'viewer.find.fileWord.one' : 'viewer.find.fileWord.many'));

        var files = data.files.slice();
        if (findSortByHits) {
            files.sort(function(a, b) { return b.matchCount - a.matchCount; });
        }
        var html = '';
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
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
        toggleClass('find-sort-toggle', findSortByHits);
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

    /* Sort toggle re-renders cached results without a new search. */
    var findSortBtn = document.getElementById('find-sort-toggle');
    if (findSortBtn) findSortBtn.addEventListener('click', function() {
        findSortByHits = !findSortByHits;
        syncToggles();
        if (cachedResults) renderResults(cachedResults);
    });

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

    ${escapeHtmlScript('escapeHtml')}
})();
`;
}
