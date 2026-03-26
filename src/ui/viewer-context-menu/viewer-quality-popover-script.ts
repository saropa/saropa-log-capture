/**
 * Code quality popover script for the log viewer.
 * Shows coverage, lint, and docs for the selected stack frame file.
 */

export function getQualityPopoverScript(): string {
    return /* javascript */ `
var qualityPopoverEl = null;

function closeQualityPopover() {
    if (qualityPopoverEl) {
        qualityPopoverEl.remove();
        qualityPopoverEl = null;
    }
}

function buildQualityPopoverContent(data) {
    if (data.error) {
        return '<div class="popover-section"><p class="popover-error">' + (typeof escapeHtml === 'function' ? escapeHtml(data.error) : data.error) + '</p></div>';
    }
    var m = data.metrics || {};
    var parts = [];
    parts.push('<div class="popover-section"><strong class="popover-title">Code Quality</strong>');
    parts.push('<p class="popover-path">' + (typeof escapeHtml === 'function' ? escapeHtml(data.filePath || '') : data.filePath || '') + '</p></div>');
    if (m.linePercent !== undefined) {
        var covCls = m.linePercent >= 80 ? 'qb-high' : (m.linePercent >= 50 ? 'qb-med' : 'qb-low');
        parts.push('<div class="popover-section"><span>Coverage</span> <span class="quality-badge ' + covCls + '">' + m.linePercent + '%</span> lines</div>');
    } else {
        parts.push('<div class="popover-section"><span>Coverage</span> —</div>');
    }
    var lintW = m.lintWarnings ?? 0;
    var lintE = m.lintErrors ?? 0;
    if (lintW > 0 || lintE > 0) {
        parts.push('<div class="popover-section"><span>Lint</span> ' + lintW + ' warning(s), ' + lintE + ' error(s)</div>');
        if (m.lintTopMessages && m.lintTopMessages.length > 0) {
            parts.push('<ul class="popover-list">');
            for (var i = 0; i < m.lintTopMessages.length; i++) {
                parts.push('<li>' + (typeof escapeHtml === 'function' ? escapeHtml(m.lintTopMessages[i]) : m.lintTopMessages[i]) + '</li>');
            }
            parts.push('</ul>');
        }
    } else {
        parts.push('<div class="popover-section"><span>Lint</span> 0 warnings, 0 errors</div>');
    }
    if (m.commentRatio !== undefined || (m.documentedExports !== undefined && m.totalExports !== undefined)) {
        var docLine = 'Docs ';
        if (m.commentRatio !== undefined) docLine += (Math.round(m.commentRatio * 100) + '% comment ratio');
        if (m.documentedExports !== undefined && m.totalExports !== undefined) {
            if (m.commentRatio !== undefined) docLine += '; ';
            docLine += m.documentedExports + '/' + m.totalExports + ' exports documented';
        }
        parts.push('<div class="popover-section">' + docLine + '</div>');
    }
    return parts.join('');
}

function showQualityPopover(lineIdx, data) {
    closeQualityPopover();
    closeContextPopover();
    closeRelatedQueriesPopover();
    var popover = document.createElement('div');
    popover.id = 'quality-popover';
    popover.className = 'context-popover quality-popover';
    popover.innerHTML = '<button class="popover-close" aria-label="Close">&times;</button>' + buildQualityPopoverContent(data);
    document.body.appendChild(popover);
    qualityPopoverEl = popover;

    var lineEl = document.querySelector('[data-idx="' + lineIdx + '"]');
    var anchorX = 100;
    var anchorY = 100;
    if (lineEl) {
        var rect = lineEl.getBoundingClientRect();
        anchorX = rect.left + 20;
        anchorY = rect.bottom;
    }
    var rect = popover.getBoundingClientRect();
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var left = anchorX + 10;
    var top = anchorY + 10;
    if (left + rect.width > viewportWidth - 20) left = viewportWidth - rect.width - 20;
    if (top + rect.height > viewportHeight - 20) top = anchorY - rect.height - 10;
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';

    popover.querySelector('.popover-close').addEventListener('click', function() { closeQualityPopover(); });
    setTimeout(function() {
        document.addEventListener('click', function onOut(e) {
            if (qualityPopoverEl && !qualityPopoverEl.contains(e.target)) {
                document.removeEventListener('click', onOut);
                closeQualityPopover();
            }
        });
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onEsc);
                closeQualityPopover();
            }
        });
    }, 0);
}

function handleCodeQualityPopoverData(msg) {
    if (msg.error && !msg.filePath) {
        showPopoverToast(msg.error);
        return;
    }
    var lineIdx = msg.lineIndex ?? 0;
    showQualityPopover(lineIdx, msg);
}
`;
}
