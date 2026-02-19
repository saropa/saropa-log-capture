/** Keyboard shortcuts for the log viewer (keydown handler). */
export function getKeyboardScript(): string {
    return /* javascript */ `
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && typeof copyAsPlainText === 'function') {
        if (selectionStart >= 0) { e.preventDefault(); copyAsPlainText(); return; }
        var nSel = window.getSelection();
        var nTxt = nSel ? nSel.toString() : '';
        if (nTxt.trim()) {
            e.preventDefault();
            vscodeApi.postMessage({ type: 'copyToClipboard', text: nTxt });
            return;
        }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C' && typeof copyAsMarkdown === 'function') {
        e.preventDefault(); copyAsMarkdown(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A' && typeof copyAllToClipboard === 'function') {
        e.preventDefault(); copyAllToClipboard(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        if (typeof setActivePanel === 'function') setActivePanel('find');
        return;
    }
    if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
        e.preventDefault();
        if (typeof setActivePanel === 'function') setActivePanel('search');
        else if (typeof openSearch === 'function') openSearch();
        return;
    }
    if (e.key === 'Escape') {
        if (typeof closeContextModal === 'function' && typeof peekTargetIdx !== 'undefined' && peekTargetIdx >= 0) {
            closeContextModal();
            return;
        }
        if (typeof closeGotoLine === 'function') closeGotoLine(true);
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeFindPanel === 'function') closeFindPanel();
        if (typeof closeInfoPanel === 'function') closeInfoPanel();
        if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
        if (typeof closeSessionPanel === 'function') closeSessionPanel();
        return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault(); var r = document.createRange(); r.selectNodeContents(viewportEl);
        var s = window.getSelection(); if (s) { s.removeAllRanges(); s.addRange(r); } return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); if (typeof setFontSize === 'function') setFontSize(logFontSize + 1); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); if (typeof setFontSize === 'function') setFontSize(logFontSize - 1); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); if (typeof setFontSize === 'function') setFontSize(13); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); if (typeof openGotoLine === 'function') openGotoLine(); return; }
    if (e.key === ' ') { e.preventDefault(); vscodeApi.postMessage({ type: 'togglePause' }); }
    else if (e.key === 'w' || e.key === 'W') { toggleWrap(); }
    else if (e.key === 'Home') { suppressScroll = true; logEl.scrollTop = 0; suppressScroll = false; autoScroll = false; }
    else if (e.key === 'End') { jumpToBottom(); }
    else if (e.key === 'PageUp') { logEl.scrollTop -= logEl.clientHeight * 0.8; autoScroll = false; }
    else if (e.key === 'PageDown') { logEl.scrollTop += logEl.clientHeight * 0.8; }
    else if (e.key === 'm' || e.key === 'M') { vscodeApi.postMessage({ type: 'insertMarker' }); }
    else if ((e.key === 'p' || e.key === 'P') && typeof togglePin === 'function') { togglePin(getCenterIdx()); }
    else if ((e.key === 'n' || e.key === 'N') && typeof promptAnnotation === 'function') { promptAnnotation(getCenterIdx()); }
});
`;
}
