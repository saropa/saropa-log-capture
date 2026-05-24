/**
 * Git-history popover for a source-linked log line (plan 055 Stage 2). Shows git blame for the
 * referenced line plus the file's recent commits, mirroring the quality popover's lifecycle
 * (single instance, click-outside / Escape to close). Reuses the shared `.popover-*` classes so no
 * new CSS is needed.
 */

export function getGitHistoryPopoverScript(): string {
    return /* javascript */ `
var gitHistoryPopoverEl = null;

function closeGitHistoryPopover() {
    if (gitHistoryPopoverEl) {
        gitHistoryPopoverEl.remove();
        gitHistoryPopoverEl = null;
    }
}

function ghEsc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s);
}

function buildGitHistoryPopoverContent(data) {
    if (data.error && !data.blame && !(data.commits && data.commits.length)) {
        return '<div class="popover-section"><p class="popover-error">' + ghEsc(data.error) + '</p></div>';
    }
    var parts = [];
    var pathLabel = (data.filePath || '') + (data.line ? ':' + data.line : '');
    parts.push('<div class="popover-section"><strong class="popover-title">' + vt('viewer.gitHistory.title') + '</strong>');
    parts.push('<p class="popover-path">' + ghEsc(pathLabel) + '</p></div>');
    var b = data.blame;
    if (b) {
        parts.push('<div class="popover-section"><span>' + vt('viewer.gitHistory.blameLabel') + '</span> '
            + '<span class="popover-path">' + ghEsc(b.hash) + ' · ' + ghEsc(b.author) + ' · ' + ghEsc(b.date) + '</span>'
            + '<p>' + ghEsc(b.message) + '</p></div>');
    }
    var commits = data.commits || [];
    if (commits.length > 0) {
        parts.push('<div class="popover-section"><span>' + vt('viewer.gitHistory.recentCommits') + '</span><ul class="popover-list">');
        for (var i = 0; i < commits.length; i++) {
            var c = commits[i];
            parts.push('<li>' + ghEsc(c.hash) + ' · ' + ghEsc(c.date) + ' — ' + ghEsc(c.message) + '</li>');
        }
        parts.push('</ul></div>');
    }
    if (!b && commits.length === 0) {
        parts.push('<div class="popover-section"><p class="popover-empty">' + vt('viewer.gitHistory.none') + '</p></div>');
    }
    return parts.join('');
}

function showGitHistoryPopover(lineIdx, data) {
    closeGitHistoryPopover();
    if (typeof closeContextPopover === 'function') closeContextPopover();
    if (typeof closeQualityPopover === 'function') closeQualityPopover();
    var popover = document.createElement('div');
    popover.id = 'git-history-popover';
    popover.className = 'context-popover git-history-popover';
    popover.innerHTML = '<button class="popover-close" aria-label="' + vt('viewer.popover.close') + '">&times;</button>' + buildGitHistoryPopoverContent(data);
    document.body.appendChild(popover);
    gitHistoryPopoverEl = popover;

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

    popover.querySelector('.popover-close').addEventListener('click', function() { closeGitHistoryPopover(); });
    setTimeout(function() {
        document.addEventListener('click', function onOut(e) {
            if (gitHistoryPopoverEl && !gitHistoryPopoverEl.contains(e.target)) {
                document.removeEventListener('click', onOut);
                closeGitHistoryPopover();
            }
        });
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onEsc);
                closeGitHistoryPopover();
            }
        });
    }, 0);
}

function handleGitHistoryPopoverData(msg) {
    if (msg.error && !msg.filePath) {
        showPopoverToast(msg.error);
        return;
    }
    showGitHistoryPopover(msg.lineIndex ?? 0, msg);
}
`;
}
