/**
 * Viewer Context Menu Script
 *
 * Provides right-click context menu with quick actions on log lines:
 * - Search codebase for selected text
 * - Copy line text
 * - Add pattern to watch list
 * - Add pattern to exclusion filters
 * - Pin/unpin the line
 *
 * The menu is shown on right-click and dispatches actions via postMessage.
 */

/**
 * Returns the JavaScript code for context menu handling in the webview.
 */
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
}

/**
 * Show context menu at the given position for the specified line.
 */
function showContextMenu(x, y, lineIdx) {
    if (!contextMenuEl) {
        return;
    }

    contextMenuLineIdx = lineIdx;

    // Get the line data
    var lineData = allLines[lineIdx];
    var hasSourceLink = lineData && lineData.html && lineData.html.indexOf('source-link') !== -1;

    // Update menu items based on context
    var openSourceItem = contextMenuEl.querySelector('[data-action="open-source"]');
    if (openSourceItem) {
        openSourceItem.style.display = hasSourceLink ? 'block' : 'none';
    }

    // Position the menu
    contextMenuEl.style.left = x + 'px';
    contextMenuEl.style.top = y + 'px';
    contextMenuEl.classList.add('visible');

    // Ensure menu stays within viewport
    var rect = contextMenuEl.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenuEl.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        contextMenuEl.style.top = (y - rect.height) + 'px';
    }
}

/**
 * Hide the context menu.
 */
function hideContextMenu() {
    if (contextMenuEl) {
        contextMenuEl.classList.remove('visible');
    }
    contextMenuLineIdx = -1;
}

/**
 * Handle context menu item click.
 */
function onContextMenuAction(action) {
    var lineIdx = contextMenuLineIdx;
    hideContextMenu();

    if (lineIdx < 0 || lineIdx >= allLines.length) {
        return;
    }

    var lineData = allLines[lineIdx];
    var plainText = stripTags(lineData.html || '');

    switch (action) {
        case 'copy':
            vscodeApi.postMessage({ type: 'copyToClipboard', text: plainText });
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

    // Clicked outside a line - hide menu
    hideContextMenu();
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
    <div class="context-menu-item" data-action="copy" onclick="onContextMenuAction('copy')">
        <span class="codicon codicon-copy"></span> Copy Line
    </div>
    <div class="context-menu-item" data-action="search-codebase" onclick="onContextMenuAction('search-codebase')">
        <span class="codicon codicon-search"></span> Search Codebase
    </div>
    <div class="context-menu-item" data-action="search-sessions" onclick="onContextMenuAction('search-sessions')">
        <span class="codicon codicon-history"></span> Search Past Sessions
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="open-source" onclick="onContextMenuAction('open-source')">
        <span class="codicon codicon-go-to-file"></span> Open Source File
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="pin" onclick="onContextMenuAction('pin')">
        <span class="codicon codicon-pin"></span> Pin Line
    </div>
    <div class="context-menu-item" data-action="annotate" onclick="onContextMenuAction('annotate')">
        <span class="codicon codicon-comment"></span> Add Note
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="add-watch" onclick="onContextMenuAction('add-watch')">
        <span class="codicon codicon-eye"></span> Add to Watch List
    </div>
    <div class="context-menu-item" data-action="add-exclusion" onclick="onContextMenuAction('add-exclusion')">
        <span class="codicon codicon-eye-closed"></span> Add to Exclusions
    </div>
</div>`;
}
