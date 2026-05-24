/**
 * Changelog-since popover (plan 055 Stage 4): shows the releases listed after a version token found
 * on a log line ("What changed since this version?"). Self-contained — registers its own message
 * listener and is injected as a standalone script tag (like the About panel), so it doesn't add to
 * the central popover router. Body comes pre-rendered/escaped from the host
 * ([changelog-since-handler.ts](../shared/handlers/changelog-since-handler.ts)).
 */

export function getChangelogPopoverScript(): string {
    return /* javascript */ `
var changelogPopoverEl = null;

function closeChangelogPopover() {
    if (changelogPopoverEl) {
        changelogPopoverEl.remove();
        changelogPopoverEl = null;
    }
}

function buildChangelogPopoverBody(msg) {
    if (msg.html) { return '<div class="popover-section">' + msg.html + '</div>'; }
    if (msg.error) {
        var e = typeof escapeHtml === 'function' ? escapeHtml(msg.error) : msg.error;
        return '<div class="popover-section"><p class="popover-error">' + e + '</p></div>';
    }
    var m = msg.message ? (typeof escapeHtml === 'function' ? escapeHtml(msg.message) : msg.message) : '';
    return '<div class="popover-section"><p class="popover-empty">' + m + '</p></div>';
}

function showChangelogPopover(lineIdx, msg) {
    closeChangelogPopover();
    if (typeof closeContextPopover === 'function') closeContextPopover();
    if (typeof closeGitHistoryPopover === 'function') closeGitHistoryPopover();
    var popover = document.createElement('div');
    popover.id = 'changelog-popover';
    popover.className = 'context-popover changelog-popover';
    popover.innerHTML = '<button class="popover-close" aria-label="' + vt('viewer.popover.close') + '">&times;</button>' + buildChangelogPopoverBody(msg);
    document.body.appendChild(popover);
    changelogPopoverEl = popover;

    var lineEl = document.querySelector('[data-idx="' + lineIdx + '"]');
    var anchorX = 100;
    var anchorY = 100;
    if (lineEl) {
        var lineRect = lineEl.getBoundingClientRect();
        anchorX = lineRect.left + 20;
        anchorY = lineRect.bottom;
    }
    var rect = popover.getBoundingClientRect();
    var left = anchorX + 10;
    var top = anchorY + 10;
    if (left + rect.width > window.innerWidth - 20) left = window.innerWidth - rect.width - 20;
    if (top + rect.height > window.innerHeight - 20) top = anchorY - rect.height - 10;
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';

    popover.querySelector('.popover-close').addEventListener('click', function() { closeChangelogPopover(); });
    setTimeout(function() {
        document.addEventListener('click', function onOut(e) {
            if (changelogPopoverEl && !changelogPopoverEl.contains(e.target)) {
                document.removeEventListener('click', onOut);
                closeChangelogPopover();
            }
        });
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onEsc);
                closeChangelogPopover();
            }
        });
    }, 0);
}

window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'changelogSincePopoverData') return;
    showChangelogPopover(e.data.lineIndex || 0, e.data);
});
`;
}
