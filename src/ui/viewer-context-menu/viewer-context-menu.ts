/**
 * Right-click context menu for the log viewer: copy, select-all, and quick actions on log lines.
 *
 * ## Architecture
 * - **HTML** lives in `viewer-context-menu-html.ts` (`getContextMenuHtml`).
 * - **This module** concatenates globals, source-ref helpers, UI (show/hide/position), and
 *   `viewer-context-menu-actions.ts` handlers into one script string injected into the webview.
 *
 * ## Scroll map & scrollbar
 * Right-click the minimap strip (`#scrollbar-minimap` / `#scrollbar-minimap-column`) or the native
 * log scrollbar (when enabled) opens a compact menu with the same workspace toggles as the
 * **Scroll map & scrollbar** submenu on the main log context menu.
 *
 * ## Integration-gated items
 * Some actions only make sense when the extension host has enabled the matching session adapter.
 * The host pushes `window.integrationAdapters` via `integrationsAdapters` postMessage
 * (`sendIntegrationsAdaptersImpl` / user changes in Options). Until that first message, the array
 * may be missing: we treat that as **no adapters** and keep **Show code quality** **disabled**
 * (conservative — avoids an empty code-quality popover). After sync, it enables only when
 * `'codeQuality'` is present. **Open Quality Report** is in the footer Actions menu, not here.
 *
 * Disabled rows use class `is-disabled` + optional `title` tooltip; the root click handler ignores
 * them so we never call `onContextMenuAction` for blocked commands.
 */
export { getContextMenuHtml, getScrollChromeContextMenuHtml } from './viewer-context-menu-html';
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
/** Right-click menu on minimap / native scrollbar (same toggles as Scroll map & scrollbar submenu). */
var scrollChromeContextMenuEl = null;
`;
}

/** Menu initialization, show/hide, positioning, and toggle sync. */
function getContextMenuUiScript(): string {
    return /* javascript */ `
function initContextMenu() {
    contextMenuEl = document.getElementById('context-menu');
    scrollChromeContextMenuEl = document.getElementById('scroll-chrome-context-menu');
    document.addEventListener('click', function(e) {
        var inside = (contextMenuEl && contextMenuEl.contains(e.target))
            || (scrollChromeContextMenuEl && scrollChromeContextMenuEl.contains(e.target));
        if (!inside) hideContextMenu();
    });
    var logEl = document.getElementById('log-content');
    if (logEl) logEl.addEventListener('scroll', function() { if (window.__programmaticScroll) return; hideContextMenu(); }); /* user scroll only */
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideContextMenu(); });
    function wireMenuClicks(el) {
        if (!el) return;
        el.addEventListener('click', function(e) {
            var item = e.target.closest('.context-menu-item');
            if (item && item.classList && item.classList.contains('is-disabled')) return;
            if (item && item.dataset.action) onContextMenuAction(item.dataset.action);
        });
    }
    wireMenuClicks(contextMenuEl);
    wireMenuClicks(scrollChromeContextMenuEl);
}

/** Disable/enable a single context menu item by action id. */
function setContextMenuItemDisabled(action, disabled, disabledTitle) {
    if (!contextMenuEl) return;
    var item = contextMenuEl.querySelector('[data-action="' + action + '"]');
    if (!item) return;
    item.classList.toggle('is-disabled', !!disabled);
    if (disabled && disabledTitle) item.setAttribute('title', disabledTitle);
    else item.removeAttribute('title');
}

/** Sync toggle checkmarks (main menu + scroll-chrome menu) from current state. */
function syncContextMenuToggles() {
    var roots = [];
    if (contextMenuEl) roots.push(contextMenuEl);
    if (scrollChromeContextMenuEl) roots.push(scrollChromeContextMenuEl);
    for (var r = 0; r < roots.length; r++) {
        var toggles = roots[r].querySelectorAll('.context-menu-toggle');
        for (var i = 0; i < toggles.length; i++) {
            var t = toggles[i];
            var action = t.dataset.action;
            var on = false;
            if (action === 'toggle-wrap') on = (typeof wordWrap !== 'undefined') && wordWrap;
            else if (action === 'toggle-decorations') on = (typeof showDecorations !== 'undefined') && showDecorations;
            else if (action === 'toggle-timestamp') on = (typeof decoShowTimestamp !== 'undefined') && decoShowTimestamp; /* per-line time in margin */
            else if (action === 'toggle-session-elapsed') on = (typeof decoShowSessionElapsed !== 'undefined') && decoShowSessionElapsed;
            else if (action === 'toggle-spacing') on = (typeof visualSpacingEnabled !== 'undefined') && visualSpacingEnabled;
            else if (action === 'toggle-line-height') on = (typeof logLineHeight !== 'undefined') && logLineHeight >= 1.5; /* comfortable when >= 1.5 (presets: 1.2 / 2.0) */
            else if (action === 'toggle-hide-blank-lines') on = (typeof hideBlankLines !== 'undefined') && hideBlankLines;
            else if (action === 'toggle-compress-lines') on = (typeof compressLinesMode !== 'undefined') && compressLinesMode;
            else if (action === 'toggle-compress-lines-global') on = (typeof compressNonConsecutiveMode !== 'undefined') && compressNonConsecutiveMode;
            else if (action === 'toggle-minimap-proportional') on = (typeof minimapProportionalLines !== 'undefined') && minimapProportionalLines;
            else if (action === 'toggle-show-scrollbar') on = document.body.classList.contains('scrollbar-visible');
            else if (action === 'toggle-minimap-info-markers') on = (typeof minimapShowInfoMarkers !== 'undefined') && minimapShowInfoMarkers;
            else if (action === 'toggle-minimap-sql-density') on = (typeof minimapShowSqlDensity !== 'undefined') && minimapShowSqlDensity;
            else if (action === 'toggle-minimap-viewport-red-outline') on = (typeof minimapViewportRedOutline !== 'undefined') && minimapViewportRedOutline;
            else if (action === 'toggle-minimap-outside-arrow') on = (typeof minimapViewportOutsideArrow !== 'undefined') && minimapViewportOutsideArrow;
            t.classList.toggle('checked', on);
        }
    }
}

function showContextMenu(x, y, lineIdx, sourceLink) {
    if (!contextMenuEl) return;
    if (scrollChromeContextMenuEl) scrollChromeContextMenuEl.classList.remove('visible');
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

    // Code-quality actions depend on the codeQuality session adapter.
    var integrationAdapters = (typeof window !== 'undefined' && Array.isArray(window.integrationAdapters))
        ? window.integrationAdapters
        : [];
    var hasCodeQualityIntegration = integrationAdapters.indexOf('codeQuality') >= 0;
    setContextMenuItemDisabled(
        'show-code-quality',
        !hasCodeQualityIntegration,
        'Enable the codeQuality integration to show per-file code quality.',
    );

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

    // Hide Lines submenu visibility
    var hasShiftSelection = (typeof selectionStart !== 'undefined' && selectionStart >= 0 &&
        typeof selectionEnd !== 'undefined' && selectionEnd >= 0 &&
        Math.abs(selectionEnd - selectionStart) > 0);
    var lineIsHidden = hasLine && (typeof isLineHidden === 'function') && isLineHidden(lineIdx);
    var anyHidden = (typeof hasHiddenLines === 'function') && hasHiddenLines();
    var selectionHasHidden = hasShiftSelection && (typeof hasSelectionWithHidden === 'function') && hasSelectionWithHidden();

    // Show hide submenu if we have a line, there are hidden lines, or text is selected
    var hideSubmenu = contextMenuEl.querySelector('#hide-lines-submenu');
    if (hideSubmenu) hideSubmenu.style.display = (hasLine || anyHidden || hasTextSelection) ? '' : 'none';

    // Text-selection-based auto-hide items (browser text selection, not shift-click)
    contextMenuEl.querySelectorAll('[data-text-selection-action]').forEach(function(el) {
        el.style.display = hasTextSelection ? '' : 'none';
    });

    // Selection-based items
    contextMenuEl.querySelectorAll('[data-selection-action]').forEach(function(el) {
        el.style.display = hasShiftSelection ? '' : 'none';
    });

    // Open in Drift Advisor: Drift categories or database-tagged (Drift SQL) lines when extension is present
    var driftLineCat = lineData && (lineData.category === 'drift-perf' || lineData.category === 'drift-query' || lineData.sourceTag === 'database');
    var driftAvailable = (typeof window !== 'undefined' && window.driftAdvisorAvailable);
    contextMenuEl.querySelectorAll('[data-drift-line-action]').forEach(function(el) {
        el.style.display = (hasLine && driftLineCat && driftAvailable) ? '' : 'none';
    });

    var hasSqlFingerprint = !!(lineData && lineData.dbInsight && lineData.dbInsight.fingerprint);
    var staticSqlOn = (typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled);
    contextMenuEl.querySelectorAll('[data-static-sql-line-action]').forEach(function(el) {
        el.style.display = (hasLine && hasSqlFingerprint && staticSqlOn) ? '' : 'none';
    });

    // Unhide line (only if this line is hidden)
    var unhideLineItem = contextMenuEl.querySelector('[data-action="unhide-line"]');
    if (unhideLineItem) unhideLineItem.style.display = lineIsHidden ? '' : 'none';

    // Unhide selection (only if selection contains hidden lines)
    var unhideSelItem = contextMenuEl.querySelector('[data-action="unhide-selection"]');
    if (unhideSelItem) unhideSelItem.style.display = (hasShiftSelection && selectionHasHidden) ? '' : 'none';

    // Unhide all (only if there are hidden lines)
    var unhideAllItem = contextMenuEl.querySelector('[data-action="unhide-all"]');
    if (unhideAllItem) unhideAllItem.style.display = anyHidden ? '' : 'none';

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
    /* Near top: push submenu flyout down so its top is not cropped (e.g. terminal tab bar, toolbar). 48px clears typical panel header height; threshold 100px. */
    var safeTopPx = 48;
    var nearTopThresholdPx = 100;
    var nearTop = rect.top < nearTopThresholdPx;
    contextMenuEl.classList.toggle('flip-submenu-vertical-top', nearTop);
    if (nearTop) {
        var submenuContentTop = Math.max(0, safeTopPx - rect.top);
        contextMenuEl.style.setProperty('--submenu-content-top', submenuContentTop + 'px');
    } else {
        contextMenuEl.style.removeProperty('--submenu-content-top');
    }
}

function hideContextMenu() {
    if (contextMenuEl) contextMenuEl.classList.remove('visible');
    if (scrollChromeContextMenuEl) scrollChromeContextMenuEl.classList.remove('visible');
    contextMenuLineIdx = -1;
    window.isContextMenuOpen = false;
}

/** Right-click on minimap strip / native scrollbar: compact menu for scroll map + scrollbar settings. */
function showScrollChromeContextMenu(x, y) {
    if (!scrollChromeContextMenuEl) return;
    if (contextMenuEl) contextMenuEl.classList.remove('visible');
    syncContextMenuToggles();
    scrollChromeContextMenuEl.style.left = x + 'px';
    scrollChromeContextMenuEl.style.top = y + 'px';
    scrollChromeContextMenuEl.classList.add('visible');
    var rect = scrollChromeContextMenuEl.getBoundingClientRect();
    var newX = x;
    var newY = y;
    if (rect.right > window.innerWidth) newX = Math.max(0, window.innerWidth - rect.width);
    if (rect.bottom > window.innerHeight) newY = Math.max(0, window.innerHeight - rect.height);
    scrollChromeContextMenuEl.style.left = newX + 'px';
    scrollChromeContextMenuEl.style.top = newY + 'px';
    window.isContextMenuOpen = true;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContextMenu);
} else {
    initContextMenu();
}
`;
}
