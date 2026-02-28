/** Right-click context menu: copy, select-all, and quick actions on log lines. */
export { getContextMenuHtml } from './viewer-context-menu-html';

/** Get the context menu script with click handlers and keyboard shortcuts. */
export function getContextMenuScript(): string {
    return /* javascript */ `
var contextMenuLineIdx = -1;
var contextMenuEl = null;
var contextMenuSourcePath = '';
var contextMenuSourceLine = '';
var contextMenuSourceCol = '';
window.isContextMenuOpen = false;

function initContextMenu() {
    contextMenuEl = document.getElementById('context-menu');
    if (!contextMenuEl) return;
    document.addEventListener('click', function(e) { if (!contextMenuEl.contains(e.target)) hideContextMenu(); });
    var logEl = document.getElementById('log-content');
    if (logEl) logEl.addEventListener('scroll', function() { if (window.__programmaticScroll) return; hideContextMenu(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideContextMenu(); });
    contextMenuEl.addEventListener('click', function(e) {
        var item = e.target.closest('.context-menu-item');
        if (item && item.dataset.action) onContextMenuAction(item.dataset.action);
    });
}

/** Sync toggle checkmarks in Options submenu from current state. */
function syncContextMenuToggles() {
    if (!contextMenuEl) return;
    var toggles = contextMenuEl.querySelectorAll('.context-menu-toggle');
    for (var i = 0; i < toggles.length; i++) {
        var t = toggles[i];
        var action = t.dataset.action;
        var on = false;
        if (action === 'toggle-wrap') on = (typeof wordWrap !== 'undefined') && wordWrap;
        else if (action === 'toggle-decorations') on = (typeof showDecorations !== 'undefined') && showDecorations;
        else if (action === 'toggle-spacing') on = (typeof visualSpacingEnabled !== 'undefined') && visualSpacingEnabled;
        else if (action === 'toggle-hide-blank-lines') on = (typeof hideBlankLines !== 'undefined') && hideBlankLines;
        t.classList.toggle('checked', on);
    }
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

    syncContextMenuToggles();
    positionContextMenu(x, y);
    window.isContextMenuOpen = true;
}

/** Place menu at (x,y), clamp to viewport, and set flip classes so submenus stay on screen. */
function positionContextMenu(x, y) {
    contextMenuEl.style.left = x + 'px';
    contextMenuEl.style.top = y + 'px';
    contextMenuEl.classList.add('visible');
    var rect = contextMenuEl.getBoundingClientRect();
    var newX = x;
    var newY = y;
    if (rect.right > window.innerWidth) newX = Math.max(0, window.innerWidth - rect.width);
    if (rect.bottom > window.innerHeight) newY = Math.max(0, window.innerHeight - rect.height);
    contextMenuEl.style.left = newX + 'px';
    contextMenuEl.style.top = newY + 'px';
    rect = contextMenuEl.getBoundingClientRect();
    contextMenuEl.classList.toggle('flip-submenu', rect.right + 160 > window.innerWidth);
    var submenuMaxH = 220; /* max height of any submenu panel; flip vertical when near bottom */
    contextMenuEl.classList.toggle('flip-submenu-vertical', rect.bottom + submenuMaxH > window.innerHeight);
}

function hideContextMenu() {
    if (contextMenuEl) contextMenuEl.classList.remove('visible');
    contextMenuLineIdx = -1;
    window.isContextMenuOpen = false;
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

/** Handle toggle actions (Options submenu) — keep menu open. */
function handleToggleAction(action) {
    var toggleFns = {
        'toggle-wrap': typeof toggleWrap === 'function' ? toggleWrap : null,
        'toggle-decorations': typeof toggleDecorations === 'function' ? toggleDecorations : null,
        'toggle-spacing': typeof toggleVisualSpacing === 'function' ? toggleVisualSpacing : null,
        'toggle-hide-blank-lines': typeof toggleHideBlankLines === 'function' ? toggleHideBlankLines : null,
    };
    var fn = toggleFns[action];
    if (!fn) return false;
    fn();
    syncContextMenuToggles();
    if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
    return true;
}

function onContextMenuAction(action) {
    // Toggle actions keep menu open — handle before hideContextMenu
    if (handleToggleAction(action)) return;

    var lineIdx = contextMenuLineIdx;
    hideContextMenu();

    if (handleGlobalAction(action)) return;
    if (handleSourceAction(action)) return;
    if (lineIdx < 0 || lineIdx >= allLines.length) return;

    var lineData = allLines[lineIdx];
    var plainText = stripTags(lineData.html || '');

    switch (action) {
        case 'copy': {
            /* When multiple lines are selected (shift+click) and right-click is inside that range, copy all selected full lines; else copy single line. */
            var start = typeof selectionStart !== 'undefined' ? selectionStart : -1;
            var end = typeof selectionEnd !== 'undefined' ? selectionEnd : -1;
            var lo = Math.min(start, end);
            var hi = Math.max(start, end);
            var multiLine = start >= 0 && hi > lo && lineIdx >= lo && lineIdx <= hi;
            if (multiLine && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
                var lines = getSelectedLines();
                var text = lines.length > 0 ? linesToPlainText(lines) : plainText;
                vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
            } else {
                vscodeApi.postMessage({ type: 'copyToClipboard', text: plainText });
            }
            break;
        }
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
