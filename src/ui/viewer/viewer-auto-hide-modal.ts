/**
 * Auto-hide pattern management modal for the log viewer.
 * Lists session and persistent auto-hide patterns with remove buttons.
 * Opened by double-clicking the hidden-lines counter in the footer.
 */

/** Returns the JavaScript code for the auto-hide modal in the webview. */
export function getAutoHideModalScript(): string {
    return /* javascript */ `
var autoHideModalEl = null;

function initAutoHideModal() {
    autoHideModalEl = document.getElementById('auto-hide-modal');
    if (!autoHideModalEl) return;
    autoHideModalEl.querySelector('.auto-hide-modal-backdrop').addEventListener('click', closeAutoHideModal);
    autoHideModalEl.querySelector('.auto-hide-modal-close').addEventListener('click', closeAutoHideModal);
    autoHideModalEl.querySelector('.auto-hide-modal-list').addEventListener('click', function(e) {
        var btn = e.target.closest('.auto-hide-remove');
        if (!btn) return;
        var pattern = btn.dataset.pattern || '';
        var persistent = btn.dataset.persistent === 'true';
        if (typeof removeAutoHidePattern === 'function') removeAutoHidePattern(pattern, persistent);
        populateAutoHideModal();
    });
}

function openAutoHideModal() {
    if (!autoHideModalEl) return;
    populateAutoHideModal();
    autoHideModalEl.classList.remove('u-hidden');
    document.addEventListener('keydown', autoHideModalEscape);
}

function closeAutoHideModal() {
    if (!autoHideModalEl) return;
    autoHideModalEl.classList.add('u-hidden');
    document.removeEventListener('keydown', autoHideModalEscape);
}

function autoHideModalEscape(e) {
    if (e.key === 'Escape') closeAutoHideModal();
}

function populateAutoHideModal() {
    if (!autoHideModalEl) return;
    var list = autoHideModalEl.querySelector('.auto-hide-modal-list');
    var empty = autoHideModalEl.querySelector('.auto-hide-modal-empty');
    var patterns = (typeof getAllAutoHidePatterns === 'function') ? getAllAutoHidePatterns() : [];
    if (patterns.length === 0) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('u-hidden');
        return;
    }
    if (empty) empty.classList.add('u-hidden');
    var parts = [];
    for (var i = 0; i < patterns.length; i++) {
        var p = patterns[i];
        var escaped = (p.pattern || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        var badge = p.persistent ? '<span class="auto-hide-badge">always</span>' : '<span class="auto-hide-badge session">this log</span>';
        parts.push(
            '<div class="auto-hide-item">'
            + '<span class="auto-hide-text">' + escaped + '</span>'
            + badge
            + '<button class="auto-hide-remove" data-pattern="' + escaped + '" data-persistent="' + p.persistent + '" title="Remove">&times;</button>'
            + '</div>'
        );
    }
    list.innerHTML = parts.join('');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoHideModal);
} else {
    initAutoHideModal();
}
`;
}

/** Returns the HTML for the auto-hide modal element. */
export function getAutoHideModalHtml(): string {
    return `<div id="auto-hide-modal" class="auto-hide-modal u-hidden">
    <div class="auto-hide-modal-backdrop"></div>
    <div class="auto-hide-modal-content">
        <div class="auto-hide-modal-header">
            <span>Auto-Hide Patterns</span>
            <button class="auto-hide-modal-close" title="Close">&times;</button>
        </div>
        <div class="auto-hide-modal-list"></div>
        <div class="auto-hide-modal-empty u-hidden">No auto-hide patterns configured</div>
    </div>
</div>`;
}
