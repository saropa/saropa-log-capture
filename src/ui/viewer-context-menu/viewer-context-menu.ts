/**
 * Right-click context menu for the log viewer: copy, select-all, and quick actions on log lines.
 * Exposes HTML and inline script; click handlers and toggle state live in the script.
 */
export { getContextMenuHtml } from './viewer-context-menu-html';
import { getContextMenuSourcesScript } from './viewer-context-menu-sources';
import { getContextMenuActionsScript } from './viewer-context-menu-actions';

/** Get the context menu script with click handlers and keyboard shortcuts. */
export function getContextMenuScript(): string {
    return getContextMenuGlobalsScript()
        + getContextMenuSourcesScript()
        + getContextMenuUiScript()
        + getContextMenuActionsScript();
}

/** Global state variables and copy-context setting for the context menu. */
function getContextMenuGlobalsScript(): string {
    return /* javascript */ `
var contextMenuLineIdx = -1;
var contextMenuEl = null;
var contextMenuSourcePath = '';
var contextMenuSourceLine = '';
var contextMenuSourceCol = '';
/** Lines before/after selection to include in Copy with source (0 = selection only). Set via setCopyContextLines. */
var copyContextLines = 3;
/** Set by show/hide; other scripts skip programmatic scroll when true. */
window.isContextMenuOpen = false;
`;
}

/** Menu initialization, show/hide, positioning, and toggle sync. */
function getContextMenuUiScript(): string {
    return /* javascript */ `
function initContextMenu() {
    contextMenuEl = document.getElementById('context-menu');
    if (!contextMenuEl) return;
    document.addEventListener('click', function(e) { if (!contextMenuEl.contains(e.target)) hideContextMenu(); });
    var logEl = document.getElementById('log-content');
    if (logEl) logEl.addEventListener('scroll', function() { if (window.__programmaticScroll) return; hideContextMenu(); }); /* user scroll only */
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
        else if (action === 'toggle-line-height') on = (typeof logLineHeight !== 'undefined') && logLineHeight >= 1.5; /* comfortable when >= 1.5 (presets: 1.2 / 2.0) */
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
    var hasTextSelection = sel && sel.toString().length > 0;
    var copySelItem = contextMenuEl.querySelector('[data-action="copy-selection"]');
    if (copySelItem) copySelItem.style.display = hasTextSelection ? '' : 'none';
    var copyWithSourceItem = contextMenuEl.querySelector('[data-action="copy-with-source"]');
    if (copyWithSourceItem) copyWithSourceItem.style.display = (hasTextSelection || hasLine) ? '' : 'none';

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContextMenu);
} else {
    initContextMenu();
}
`;
}
