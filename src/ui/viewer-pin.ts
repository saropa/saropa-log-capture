/**
 * Client-side JavaScript for pinning log entries in the viewer.
 * Pinned lines appear in a sticky section above the virtual scroll area.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getPinScript(): string {
    return /* javascript */ `
var pinnedSection = document.getElementById('pinned-section');
var pinnedIndices = new Set();

function togglePin(idx) {
    if (idx < 0 || idx >= allLines.length) return;
    if (pinnedIndices.has(idx)) {
        pinnedIndices.delete(idx);
    } else {
        pinnedIndices.add(idx);
    }
    renderPinnedSection();
}

function renderPinnedSection() {
    if (!pinnedSection) return;
    if (pinnedIndices.size === 0) {
        pinnedSection.style.display = 'none';
        pinnedSection.innerHTML = '';
        return;
    }
    pinnedSection.style.display = 'block';
    var sorted = Array.from(pinnedIndices).sort(function(a, b) { return a - b; });
    var parts = ['<div class="pinned-header">Pinned (' + sorted.length + ')</div>'];
    for (var i = 0; i < sorted.length; i++) {
        var item = allLines[sorted[i]];
        if (!item) continue;
        var html = (typeof highlightSearchInHtml === 'function') ? highlightSearchInHtml(item.html) : item.html;
        parts.push('<div class="pinned-item" data-pin-idx="' + sorted[i] + '">'
            + '<span class="unpin-btn" title="Unpin">\\u2715</span> '
            + '<span class="pinned-text">' + html + '</span>'
            + '</div>');
    }
    pinnedSection.innerHTML = parts.join('');
}

if (pinnedSection) {
    pinnedSection.addEventListener('click', function(e) {
        var btn = e.target.closest('.unpin-btn');
        if (btn) {
            var item = btn.closest('.pinned-item');
            if (item && item.dataset.pinIdx !== undefined) {
                togglePin(parseInt(item.dataset.pinIdx));
            }
            return;
        }
        var pinItem = e.target.closest('.pinned-item');
        if (pinItem && pinItem.dataset.pinIdx !== undefined) {
            var idx = parseInt(pinItem.dataset.pinIdx);
            var cumH = 0;
            for (var i = 0; i < idx; i++) cumH += allLines[i].height;
            logEl.scrollTop = cumH - logEl.clientHeight / 2;
            autoScroll = false;
        }
    });
}
`;
}
