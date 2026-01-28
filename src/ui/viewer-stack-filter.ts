/**
 * Client-side JavaScript for the app-only stack trace filter.
 * When enabled, framework/library stack frames are hidden in expanded groups.
 */
export function getStackFilterScript(): string {
  return /* javascript */ `
var appOnlyMode = false;

function toggleAppOnly() {
    appOnlyMode = !appOnlyMode;
    var headerByGroup = {};
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'stack-header') { headerByGroup[item.groupId] = item; continue; }
        if (item.type !== 'stack-frame') continue;
        var hdr = headerByGroup[item.groupId];
        if (!hdr || hdr.collapsed) continue;
        var newH = (appOnlyMode && item.fw) ? 0 : ROW_HEIGHT;
        totalHeight += newH - item.height;
        item.height = newH;
    }
    var btn = document.getElementById('app-only-toggle');
    if (btn) btn.textContent = appOnlyMode ? 'App Only: ON' : 'App Only: OFF';
    if (typeof vscodeApi !== 'undefined') {
        vscodeApi.postMessage({ type: 'setCaptureAll', value: !appOnlyMode });
    }
    renderViewport(true);
}

// Wrap toggleStackGroup to respect app-only mode when expanding groups.
var _origToggleStack = toggleStackGroup;
toggleStackGroup = function(groupId) {
    _origToggleStack(groupId);
    if (!appOnlyMode) return;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.groupId !== groupId || item.type !== 'stack-frame' || !item.fw) continue;
        if (item.height > 0) { totalHeight -= item.height; item.height = 0; }
    }
    renderViewport(true);
};

document.addEventListener('keydown', function(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'a' || e.key === 'A') toggleAppOnly();
});
`;
}
