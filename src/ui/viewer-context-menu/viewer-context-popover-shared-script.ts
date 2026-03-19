export function getContextPopoverSharedScript(): string {
    return /* javascript */ `
function escapeHtmlBasic(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function copyPopoverContent() {
    var content = contextPopoverEl ? contextPopoverEl.innerText : '';
    vscodeApi.postMessage({ type: 'copyToClipboard', text: content });
}

function showPopoverToast(message) {
    var existing = document.getElementById('popover-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'popover-toast';
    toast.className = 'copy-toast visible';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { toast.remove(); }, 200);
    }, 2500);
}

function handleContextPopoverData(msg) {
    if (msg.error) {
        showPopoverToast(msg.error);
        return;
    }
    var lineIdx = msg.lineIndex || 0;
    var lineEl = document.querySelector('[data-idx="' + lineIdx + '"]');
    var anchorX = 100;
    var anchorY = 100;
    if (lineEl) {
        var rect = lineEl.getBoundingClientRect();
        anchorX = rect.left + 20;
        anchorY = rect.bottom;
    }
    showContextPopover(lineIdx, anchorX, anchorY, msg);
}
`;
}
