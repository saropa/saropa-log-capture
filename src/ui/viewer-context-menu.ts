/** Right-click context menu: copy, select-all, and quick actions on log lines. */
export function getContextMenuScript(): string {
    return /* javascript */ `
var contextMenuLineIdx = -1;
var contextMenuEl = null;
var contextMenuSourcePath = '';
var contextMenuSourceLine = '';
var contextMenuSourceCol = '';

function initContextMenu() {
    contextMenuEl = document.getElementById('context-menu');
    if (!contextMenuEl) return;
    document.addEventListener('click', function(e) { if (!contextMenuEl.contains(e.target)) hideContextMenu(); });
    var logEl = document.getElementById('log-content');
    if (logEl) logEl.addEventListener('scroll', hideContextMenu);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideContextMenu(); });
    contextMenuEl.addEventListener('click', function(e) {
        var item = e.target.closest('.context-menu-item');
        if (item && item.dataset.action) onContextMenuAction(item.dataset.action);
    });
}

function showContextMenu(x, y, lineIdx, sourceLink) {
    if (!contextMenuEl) return;
    contextMenuLineIdx = lineIdx;
    var hasLine = lineIdx >= 0 && lineIdx < allLines.length;

    var lineItems = contextMenuEl.querySelectorAll('[data-line-action]');
    for (var li = 0; li < lineItems.length; li++) {
        lineItems[li].style.display = hasLine ? '' : 'none';
    }

    var sel = window.getSelection();
    var copySelItem = contextMenuEl.querySelector('[data-action="copy-selection"]');
    if (copySelItem) copySelItem.style.display = sel && sel.toString().length > 0 ? '' : 'none';

    var lineData = hasLine ? allLines[lineIdx] : null;
    var hasSourceLink = lineData && lineData.html && lineData.html.indexOf('source-link') !== -1;
    var openSourceItem = contextMenuEl.querySelector('[data-action="open-source"]');
    if (openSourceItem) openSourceItem.style.display = hasSourceLink ? '' : 'none';

    // Show source-link items only when right-clicking directly on a source link
    var hasSource = !!sourceLink;
    contextMenuEl.querySelectorAll('[data-source-action]').forEach(function(el) {
        el.style.display = hasSource ? '' : 'none';
    });
    if (sourceLink) {
        contextMenuSourcePath = sourceLink.dataset.path || '';
        contextMenuSourceLine = sourceLink.dataset.line || '1';
        contextMenuSourceCol = sourceLink.dataset.col || '1';
    }

    positionContextMenu(x, y);
}

function positionContextMenu(x, y) {
    contextMenuEl.style.left = x + 'px';
    contextMenuEl.style.top = y + 'px';
    contextMenuEl.classList.add('visible');
    var rect = contextMenuEl.getBoundingClientRect();
    if (rect.right > window.innerWidth) x = Math.max(0, x - rect.width);
    if (rect.bottom > window.innerHeight) y = Math.max(0, y - rect.height);
    contextMenuEl.style.left = x + 'px';
    contextMenuEl.style.top = y + 'px';
    contextMenuEl.style.maxHeight = (window.innerHeight - y - 4) + 'px';
}

function hideContextMenu() {
    if (contextMenuEl) contextMenuEl.classList.remove('visible');
    contextMenuLineIdx = -1;
}

function handleGlobalAction(action) {
    if (action === 'copy-selection') {
        var sel = window.getSelection();
        var text = sel ? sel.toString() : '';
        if (text.length > 0) vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        return true;
    }
    if (action === 'copy-all') {
        if (typeof copyAllToClipboard === 'function') copyAllToClipboard();
        return true;
    }
    if (action === 'copy-all-decorated') {
        if (typeof copyAllDecorated === 'function') copyAllDecorated();
        return true;
    }
    if (action === 'select-all') {
        var vp = document.getElementById('viewport');
        if (vp) {
            var range = document.createRange();
            range.selectNodeContents(vp);
            var selection = window.getSelection();
            if (selection) { selection.removeAllRanges(); selection.addRange(range); }
        }
        return true;
    }
    return false;
}

function handleSourceAction(action) {
    if (!contextMenuSourcePath) return false;
    if (action === 'open-source-link') {
        vscodeApi.postMessage({
            type: 'linkClicked', path: contextMenuSourcePath,
            line: parseInt(contextMenuSourceLine, 10), col: parseInt(contextMenuSourceCol, 10),
            splitEditor: false,
        });
        return true;
    }
    if (action === 'copy-relative-path') {
        vscodeApi.postMessage({ type: 'copySourcePath', path: contextMenuSourcePath, mode: 'relative' });
        return true;
    }
    if (action === 'copy-full-path') {
        vscodeApi.postMessage({ type: 'copySourcePath', path: contextMenuSourcePath, mode: 'full' });
        return true;
    }
    return false;
}

function onContextMenuAction(action) {
    var lineIdx = contextMenuLineIdx;
    hideContextMenu();

    if (handleGlobalAction(action)) return;
    if (handleSourceAction(action)) return;
    if (lineIdx < 0 || lineIdx >= allLines.length) return;

    var lineData = allLines[lineIdx];
    var plainText = stripTags(lineData.html || '');

    switch (action) {
        case 'copy': vscodeApi.postMessage({ type: 'copyToClipboard', text: plainText }); break;
        case 'copy-decorated':
            if (typeof decorateLine === 'function') {
                vscodeApi.postMessage({ type: 'copyToClipboard', text: decorateLine(lineData) });
            }
            break;
        case 'copy-to-search':
            if (typeof openSearch === 'function' && typeof searchInputEl !== 'undefined') {
                openSearch();
                searchInputEl.value = plainText;
                if (typeof updateSearch === 'function') updateSearch();
            }
            break;
        case 'search-codebase': vscodeApi.postMessage({ type: 'searchCodebase', text: plainText }); break;
        case 'search-sessions': vscodeApi.postMessage({ type: 'searchSessions', text: plainText }); break;
        case 'analyze-line': vscodeApi.postMessage({ type: 'analyzeLine', text: plainText, lineIndex: lineIdx }); break;
        case 'generate-report': vscodeApi.postMessage({ type: 'generateReport', text: plainText, lineIndex: lineIdx }); break;
        case 'add-watch': vscodeApi.postMessage({ type: 'addToWatch', text: plainText }); break;
        case 'add-exclusion': vscodeApi.postMessage({ type: 'addToExclusion', text: plainText }); break;
        case 'pin': if (typeof togglePin === 'function') togglePin(lineIdx); break;
        case 'annotate': if (typeof promptAnnotation === 'function') promptAnnotation(lineIdx); break;
        case 'bookmark': vscodeApi.postMessage({ type: 'addBookmark', lineIndex: lineIdx, text: plainText }); break;
        case 'open-source':
            var viewport = document.getElementById('viewport');
            if (viewport) {
                var lineEl = viewport.querySelector('[data-idx="' + lineIdx + '"] .source-link');
                if (lineEl) lineEl.click();
            }
            break;
        case 'edit': if (typeof openEditModal === 'function') openEditModal(lineIdx); break;
        case 'show-context': if (typeof openContextModal === 'function') openContextModal(lineIdx); break;
    }
}

function onLogContextMenu(e) {
    e.preventDefault();
    var sourceLink = e.target.closest('.source-link');
    var target = e.target;
    while (target && target !== document.body) {
        if (target.dataset && target.dataset.idx !== undefined) {
            var idx = parseInt(target.dataset.idx, 10);
            if (!isNaN(idx)) { showContextMenu(e.clientX, e.clientY, idx, sourceLink); return; }
        }
        target = target.parentElement;
    }
    showContextMenu(e.clientX, e.clientY, -1, null);
}

var _logEl = document.getElementById('log-content');
if (_logEl) _logEl.addEventListener('contextmenu', onLogContextMenu);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContextMenu);
} else {
    initContextMenu();
}
`;
}

/** Returns the HTML for the context menu element. */
export function getContextMenuHtml(): string {
    return `<div id="context-menu" class="context-menu">
    <div class="context-menu-item" data-action="open-source-link" data-source-action>
        <span class="codicon codicon-go-to-file"></span> Open File
    </div>
    <div class="context-menu-item" data-action="copy-relative-path" data-source-action>
        <span class="codicon codicon-copy"></span> Copy Relative Path
    </div>
    <div class="context-menu-item" data-action="copy-full-path" data-source-action>
        <span class="codicon codicon-copy"></span> Copy Full Path
    </div>
    <div class="context-menu-separator" data-source-action></div>
    <div class="context-menu-item" data-action="copy-selection">
        <span class="codicon codicon-copy"></span> Copy
    </div>
    <div class="context-menu-item" data-action="copy" data-line-action>
        <span class="codicon codicon-copy"></span> Copy Line
    </div>
    <div class="context-menu-item" data-action="copy-decorated" data-line-action>
        <span class="codicon codicon-copy"></span> Copy Line Decorated
    </div>
    <div class="context-menu-item" data-action="copy-all">
        <span class="codicon codicon-clippy"></span> Copy All
    </div>
    <div class="context-menu-item" data-action="copy-all-decorated">
        <span class="codicon codicon-clippy"></span> Copy All Decorated
    </div>
    <div class="context-menu-item" data-action="select-all">
        <span class="codicon codicon-list-flat"></span> Select All
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="copy-to-search" data-line-action>
        <span class="codicon codicon-search"></span> Copy to Search
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="search-codebase" data-line-action>
        <span class="codicon codicon-search"></span> Search Codebase
    </div>
    <div class="context-menu-item" data-action="search-sessions" data-line-action>
        <span class="codicon codicon-history"></span> Search Past Sessions
    </div>
    <div class="context-menu-item" data-action="analyze-line" data-line-action>
        <span class="codicon codicon-search-fuzzy"></span> Analyze Across Sessions
    </div>
    <div class="context-menu-item" data-action="generate-report" data-line-action>
        <span class="codicon codicon-report"></span> Generate Bug Report
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="open-source" data-line-action>
        <span class="codicon codicon-go-to-file"></span> Open Source File
    </div>
    <div class="context-menu-item" data-action="show-context" data-line-action>
        <span class="codicon codicon-list-flat"></span> Show Context
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="pin" data-line-action>
        <span class="codicon codicon-pin"></span> Pin Line
    </div>
    <div class="context-menu-item" data-action="bookmark" data-line-action>
        <span class="codicon codicon-bookmark"></span> Bookmark Line
    </div>
    <div class="context-menu-item" data-action="edit" data-line-action>
        <span class="codicon codicon-edit"></span> Edit Line
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="add-watch" data-line-action>
        <span class="codicon codicon-eye"></span> Add to Watch List
    </div>
    <div class="context-menu-item" data-action="add-exclusion" data-line-action>
        <span class="codicon codicon-eye-closed"></span> Add to Exclusions
    </div>
</div>`;
}
