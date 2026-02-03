/**
 * JavaScript for the interactive HTML export.
 *
 * Generates the client-side script that powers the interactive features:
 * theme toggle, word wrap, category filtering, search with highlighting,
 * stack trace collapse/expand, JSON collapse/expand, and keyboard shortcuts.
 *
 * Runs as an IIFE to avoid polluting the global scope.
 */

/** Generate the JavaScript for the interactive HTML export. */
export function getInteractiveScript(): string {
    return `
(function() {
    var logContent = document.getElementById('log-content');
    var searchBar = document.getElementById('search-bar');
    var searchInput = document.getElementById('search-input');
    var matchCount = document.getElementById('match-count');
    var filterSelect = document.getElementById('filter-select');
    var wrapToggle = document.getElementById('wrap-toggle');
    var themeToggle = document.getElementById('theme-toggle');
    var footerText = document.getElementById('footer-text');
    var hiddenCount = document.getElementById('hidden-count');
    var statsEl = document.getElementById('stats');

    var searchOpen = false;
    var searchRegex = null;
    var matchElements = [];
    var currentMatchIdx = -1;
    var wordWrap = false;

    // Count total lines
    var allLines = document.querySelectorAll('.line');
    statsEl.textContent = allLines.length + ' lines';

    // Theme toggle
    themeToggle.addEventListener('click', function() {
        var body = document.body;
        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            themeToggle.textContent = '🌙';
        } else {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            themeToggle.textContent = '☀️';
        }
    });

    // Word wrap toggle
    wrapToggle.addEventListener('click', function() {
        wordWrap = !wordWrap;
        logContent.classList.toggle('nowrap', !wordWrap);
        wrapToggle.textContent = wordWrap ? 'No Wrap' : 'Wrap';
    });

    // Category filter
    filterSelect.addEventListener('change', function() {
        var selected = [];
        for (var i = 0; i < filterSelect.options.length; i++) {
            if (filterSelect.options[i].selected) {
                selected.push(filterSelect.options[i].value);
            }
        }
        var hidden = 0;
        for (var i = 0; i < allLines.length; i++) {
            var cat = allLines[i].dataset.cat || 'console';
            var isHidden = selected.indexOf(cat) === -1;
            allLines[i].classList.toggle('hidden', isHidden);
            if (isHidden) hidden++;
        }
        hiddenCount.textContent = hidden > 0 ? hidden + ' hidden' : '';
    });

    // Search
    function openSearch() {
        searchOpen = true;
        searchBar.style.display = 'flex';
        searchInput.focus();
    }

    function closeSearch() {
        searchOpen = false;
        searchBar.style.display = 'none';
        clearSearchHighlights();
    }

    function clearSearchHighlights() {
        for (var i = 0; i < matchElements.length; i++) {
            matchElements[i].classList.remove('search-match', 'current-match');
        }
        matchElements = [];
        currentMatchIdx = -1;
        matchCount.textContent = '';
        // Remove mark tags
        var marks = logContent.querySelectorAll('mark');
        for (var i = 0; i < marks.length; i++) {
            var parent = marks[i].parentNode;
            parent.replaceChild(document.createTextNode(marks[i].textContent), marks[i]);
            parent.normalize();
        }
    }

    function updateSearch() {
        clearSearchHighlights();
        var query = searchInput.value;
        if (!query) return;

        try {
            searchRegex = new RegExp(query.replace(/[-\\\\/^$*+?.()|[\\]{}]/g, '\\\\$&'), 'gi');
        } catch (e) {
            return;
        }

        for (var i = 0; i < allLines.length; i++) {
            var line = allLines[i];
            if (line.classList.contains('hidden')) continue;

            var text = line.textContent;
            searchRegex.lastIndex = 0;
            if (searchRegex.test(text)) {
                matchElements.push(line);
                line.classList.add('search-match');
                // Highlight matches within
                highlightMatches(line, searchRegex);
            }
        }

        if (matchElements.length > 0) {
            currentMatchIdx = 0;
            matchElements[0].classList.add('current-match');
            matchElements[0].scrollIntoView({ block: 'center' });
        }
        updateMatchCount();
    }

    function highlightMatches(el, regex) {
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var nodesToReplace = [];
        while (walker.nextNode()) {
            var node = walker.currentNode;
            regex.lastIndex = 0;
            if (regex.test(node.textContent)) {
                nodesToReplace.push(node);
            }
        }
        for (var i = 0; i < nodesToReplace.length; i++) {
            var node = nodesToReplace[i];
            var span = document.createElement('span');
            regex.lastIndex = 0;
            span.innerHTML = node.textContent.replace(regex, '<mark>$&</mark>');
            node.parentNode.replaceChild(span, node);
        }
    }

    function updateMatchCount() {
        if (matchElements.length === 0) {
            matchCount.textContent = searchInput.value ? 'No matches' : '';
        } else {
            matchCount.textContent = (currentMatchIdx + 1) + '/' + matchElements.length;
        }
    }

    function searchNext() {
        if (matchElements.length === 0) return;
        matchElements[currentMatchIdx].classList.remove('current-match');
        currentMatchIdx = (currentMatchIdx + 1) % matchElements.length;
        matchElements[currentMatchIdx].classList.add('current-match');
        matchElements[currentMatchIdx].scrollIntoView({ block: 'center' });
        updateMatchCount();
    }

    function searchPrev() {
        if (matchElements.length === 0) return;
        matchElements[currentMatchIdx].classList.remove('current-match');
        currentMatchIdx = (currentMatchIdx - 1 + matchElements.length) % matchElements.length;
        matchElements[currentMatchIdx].classList.add('current-match');
        matchElements[currentMatchIdx].scrollIntoView({ block: 'center' });
        updateMatchCount();
    }

    searchInput.addEventListener('input', updateSearch);
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.shiftKey ? searchPrev() : searchNext();
            e.preventDefault();
        }
        if (e.key === 'Escape') {
            closeSearch();
            e.preventDefault();
        }
    });

    document.getElementById('search-next').addEventListener('click', searchNext);
    document.getElementById('search-prev').addEventListener('click', searchPrev);
    document.getElementById('search-close').addEventListener('click', closeSearch);

    // Stack trace collapse/expand
    document.querySelectorAll('.stack-header').forEach(function(header) {
        header.addEventListener('click', function() {
            var gid = header.dataset.gid;
            var frames = document.querySelector('.stack-frames[data-gid="' + gid + '"]');
            if (!frames) return;

            var collapsed = header.classList.toggle('collapsed');
            frames.style.display = collapsed ? 'none' : 'block';
            header.textContent = (collapsed ? '▶' : '▼') + header.textContent.slice(1);
        });
    });

    // JSON collapse/expand
    document.querySelectorAll('.json-toggle').forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            var container = toggle.closest('.json-collapsible');
            if (!container) return;

            var preview = container.querySelector('.json-preview');
            var expanded = container.querySelector('.json-expanded');
            var isCollapsed = toggle.textContent === '▶';

            toggle.textContent = isCollapsed ? '▼' : '▶';
            preview.classList.toggle('hidden', !isCollapsed);
            expanded.classList.toggle('hidden', isCollapsed);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F3') {
            e.preventDefault();
            if (!searchOpen) openSearch();
            else e.shiftKey ? searchPrev() : searchNext();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            openSearch();
            return;
        }
        if (e.key === 'Escape' && searchOpen) {
            closeSearch();
        }
    });

    footerText.textContent = 'Generated by Saropa Log Capture';
})();
`;
}
