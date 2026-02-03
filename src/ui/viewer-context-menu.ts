/** Right-click context menu: copy, select-all, and quick actions on log lines. */
export function getContextMenuScript(): string {
    return /* javascript */ `
/** Currently right-clicked line index. */
var contextMenuLineIdx = -1;

/** The context menu element. */
var contextMenuEl = null;

/**
 * Initialize the context menu (called on load).
 */
function initContextMenu() {
    contextMenuEl = document.getElementById('context-menu');
    if (!contextMenuEl) {
        return;
    }

    // Hide menu when clicking elsewhere
    document.addEventListener('click', function(e) {
        if (!contextMenuEl.contains(e.target)) {
            hideContextMenu();
        }
    });

    // Hide menu on scroll
    var logEl = document.getElementById('log-content');
    if (logEl) {
        logEl.addEventListener('scroll', hideContextMenu);
    }

    // Hide menu on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideContextMenu();
        }
    });

    // Handle menu item clicks via event delegation
    contextMenuEl.addEventListener('click', function(e) {
        var item = e.target.closest('.context-menu-item');
        if (item && item.dataset.action) {
            onContextMenuAction(item.dataset.action);
        }
    });
}

/**
 * Show context menu at the given position for the specified line.
 */
function showContextMenu(x, y, lineIdx) {
    if (!contextMenuEl) {
        return;
    }

    contextMenuLineIdx = lineIdx;
    var hasLine = lineIdx >= 0 && lineIdx < allLines.length;

    // Toggle line-specific items
    var lineItems = contextMenuEl.querySelectorAll('[data-line-action]');
    for (var li = 0; li < lineItems.length; li++) {
        lineItems[li].style.display = hasLine ? '' : 'none';
    }

    // Show "Copy" only when there is a native text selection
    var sel = window.getSelection();
    var copySelItem = contextMenuEl.querySelector('[data-action="copy-selection"]');
    if (copySelItem) {
        copySelItem.style.display = sel && sel.toString().length > 0 ? '' : 'none';
    }

    // Show "Open Source File" only when the line contains a source link
    var lineData = hasLine ? allLines[lineIdx] : null;
    var hasSourceLink = lineData && lineData.html && lineData.html.indexOf('source-link') !== -1;
    var openSourceItem = contextMenuEl.querySelector('[data-action="open-source"]');
    if (openSourceItem) {
        openSourceItem.style.display = hasSourceLink ? '' : 'none';
    }

    positionContextMenu(x, y);
}

function positionContextMenu(x, y) {
    contextMenuEl.style.left = x + 'px';
    contextMenuEl.style.top = y + 'px';
    contextMenuEl.classList.add('visible');

    var rect = contextMenuEl.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenuEl.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        contextMenuEl.style.top = (y - rect.height) + 'px';
    }
}

function hideContextMenu() {
    if (contextMenuEl) {
        contextMenuEl.classList.remove('visible');
    }
    contextMenuLineIdx = -1;
}

function handleGlobalAction(action) {
    if (action === 'copy-selection') {
        var sel = window.getSelection();
        var text = sel ? sel.toString() : '';
        if (text.length > 0) {
            vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        }
        return true;
    }
    if (action === 'select-all') {
        var vp = document.getElementById('viewport');
        if (vp) {
            var range = document.createRange();
            range.selectNodeContents(vp);
            var selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
        return true;
    }
    return false;
}

function onContextMenuAction(action) {
    var lineIdx = contextMenuLineIdx;
    hideContextMenu();

    if (handleGlobalAction(action)) {
        return;
    }
    if (lineIdx < 0 || lineIdx >= allLines.length) {
        return;
    }

    var lineData = allLines[lineIdx];
    var plainText = stripTags(lineData.html || '');

    switch (action) {
        case 'copy':
            vscodeApi.postMessage({ type: 'copyToClipboard', text: plainText });
            break;

        case 'copy-to-search':
            if (typeof openSearch === 'function' && typeof searchInputEl !== 'undefined') {
                openSearch();
                searchInputEl.value = plainText;
                if (typeof updateSearch === 'function') {
                    updateSearch();
                }
            }
            break;

        case 'search-codebase':
            vscodeApi.postMessage({ type: 'searchCodebase', text: plainText });
            break;

        case 'search-sessions':
            vscodeApi.postMessage({ type: 'searchSessions', text: plainText });
            break;

        case 'add-watch':
            vscodeApi.postMessage({ type: 'addToWatch', text: plainText });
            break;

        case 'add-exclusion':
            vscodeApi.postMessage({ type: 'addToExclusion', text: plainText });
            break;

        case 'pin':
            if (typeof togglePin === 'function') {
                togglePin(lineIdx);
            }
            break;

        case 'annotate':
            if (typeof promptAnnotation === 'function') {
                promptAnnotation(lineIdx);
            }
            break;

        case 'open-source':
            // Find and click the source link in this line
            var viewport = document.getElementById('viewport');
            if (viewport) {
                var lineEl = viewport.querySelector('[data-idx="' + lineIdx + '"] .source-link');
                if (lineEl) {
                    lineEl.click();
                }
            }
            break;

        case 'edit':
            if (typeof openEditModal === 'function') {
                openEditModal(lineIdx);
            }
            break;

        case 'show-context':
            if (typeof openContextModal === 'function') {
                openContextModal(lineIdx);
            }
            break;
    }
}

/**
 * Handle right-click on log content.
 */
function onLogContextMenu(e) {
    e.preventDefault();

    // Find which line was clicked
    var target = e.target;
    while (target && target !== document.body) {
        if (target.dataset && target.dataset.idx !== undefined) {
            var idx = parseInt(target.dataset.idx, 10);
            if (!isNaN(idx)) {
                showContextMenu(e.clientX, e.clientY, idx);
                return;
            }
        }
        target = target.parentElement;
    }

    // Clicked outside a line — show minimal menu (Copy / Select All only)
    showContextMenu(e.clientX, e.clientY, -1);
}

// Attach context menu handler to log content
var _logEl = document.getElementById('log-content');
if (_logEl) {
    _logEl.addEventListener('contextmenu', onLogContextMenu);
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContextMenu);
} else {
    initContextMenu();
}
`;
}

/**
 * Returns the HTML for the context menu element.
 */
export function getContextMenuHtml(): string {
    return `<div id="context-menu" class="context-menu">
    <div class="context-menu-item" data-action="copy-selection">
        <span class="codicon codicon-copy"></span> Copy
    </div>
    <div class="context-menu-item" data-action="select-all">
        <span class="codicon codicon-list-flat"></span> Select All
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="copy" data-line-action>
        <span class="codicon codicon-copy"></span> Copy Line
    </div>
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
    <div class="context-menu-item" data-action="annotate" data-line-action>
        <span class="codicon codicon-comment"></span> Add Note
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
