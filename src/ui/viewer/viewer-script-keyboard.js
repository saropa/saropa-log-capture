"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeyboardScript = getKeyboardScript;
exports.getKeyboardScriptWithDefaults = getKeyboardScriptWithDefaults;
/** Keyboard shortcuts for the log viewer (keydown handler). Uses configurable keyToAction map. */
const viewer_keybindings_1 = require("./viewer-keybindings");
/** Returns the JavaScript keyboard handler. Initial keyToAction is injected so keys work before first setViewerKeybindings message. */
function getKeyboardScript(initialKeyToAction) {
    const defaultMapJson = JSON.stringify(initialKeyToAction);
    return /* javascript */ `
window.viewerKeyMap = window.viewerKeyMap || ${defaultMapJson};
window.viewerKeybindingRecordingFor = null;

/** Must match normalizeKeyDescriptor() in viewer-keybindings.ts (same key string format). */
function normalizeViewerKey(e) {
    var parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    var k = (e.key || '').toLowerCase();
    if (k === ' ') k = 'space';
    if (k === 'pageup') k = 'pageup';
    if (k === 'pagedown') k = 'pagedown';
    parts.push(k);
    return parts.join('+');
}

document.addEventListener('keydown', function(e) {
    if (window.viewerKeybindingRecordingFor) {
        e.preventDefault();
        var key = normalizeViewerKey(e);
        if (key === 'escape') {
            vscodeApi.postMessage({ type: 'viewerKeybindingRecordCancelled' });
        } else {
            vscodeApi.postMessage({ type: 'viewerKeybindingRecorded', actionId: window.viewerKeybindingRecordingFor, key: key });
        }
        window.viewerKeybindingRecordingFor = null;
        return;
    }
    var key = normalizeViewerKey(e);
    var action = window.viewerKeyMap && window.viewerKeyMap[key];
    if (!action) return;

    if (action === 'copyPlain') {
        if (typeof copyAsPlainText === 'function' && selectionStart >= 0) { e.preventDefault(); copyAsPlainText(); return; }
        var nSel = window.getSelection();
        var nTxt = nSel ? nSel.toString() : '';
        if (nTxt.trim()) { e.preventDefault(); vscodeApi.postMessage({ type: 'copyToClipboard', text: nTxt }); return; }
        return;
    }
    if (action === 'copyMarkdown') { e.preventDefault(); if (typeof copyAsMarkdown === 'function') copyAsMarkdown(); return; }
    if (action === 'copyAll') { e.preventDefault(); if (typeof copyAllToClipboard === 'function') copyAllToClipboard(); return; }
    if (action === 'copyRaw') { e.preventDefault(); if (typeof copyAsRawText === 'function') copyAsRawText(); return; }
    if (action === 'openFindPanel') {
        e.preventDefault();
        if (typeof setActivePanel === 'function') setActivePanel('find');
        return;
    }
    if (action === 'openSearch') {
        e.preventDefault();
        if (typeof openSearch === 'function') openSearch();
        return;
    }
    if (action === 'escape') {
        if (typeof closeContextModal === 'function' && typeof peekTargetIdx !== 'undefined' && peekTargetIdx >= 0) { closeContextModal(); return; }
        if (typeof closeGotoLine === 'function') closeGotoLine(true);
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeFindPanel === 'function') closeFindPanel();
        if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
        if (typeof closeSessionPanel === 'function') closeSessionPanel();
        return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (action === 'selectAll') {
        e.preventDefault();
        var r = document.createRange(); r.selectNodeContents(viewportEl);
        var s = window.getSelection(); if (s) { s.removeAllRanges(); s.addRange(r); }
        return;
    }
    if (action === 'fontSizeUp') { e.preventDefault(); if (typeof setFontSize === 'function') setFontSize(logFontSize + 1); return; }
    if (action === 'fontSizeDown') { e.preventDefault(); if (typeof setFontSize === 'function') setFontSize(logFontSize - 1); return; }
    if (action === 'fontSizeReset') { e.preventDefault(); if (typeof setFontSize === 'function') setFontSize(13); return; }
    if (action === 'gotoLine') { e.preventDefault(); if (typeof openGotoLine === 'function') openGotoLine(); return; }
    if (action === 'togglePause') { e.preventDefault(); vscodeApi.postMessage({ type: 'togglePause' }); return; }
    if (action === 'toggleWrap') { e.preventDefault(); toggleWrap(); return; }
    if (action === 'home') {
        e.preventDefault();
        if (window.isContextMenuOpen) return;
        if (window.setProgrammaticScroll) window.setProgrammaticScroll();
        suppressScroll = true; logEl.scrollTop = 0; suppressScroll = false; autoScroll = false;
        return;
    }
    if (action === 'end') { e.preventDefault(); jumpToBottom(); return; }
    if (action === 'pageUp') { e.preventDefault(); logEl.scrollTop -= logEl.clientHeight * 0.8; autoScroll = false; return; }
    if (action === 'pageDown') { e.preventDefault(); logEl.scrollTop += logEl.clientHeight * 0.8; return; }
    if (action === 'insertMarker') { e.preventDefault(); vscodeApi.postMessage({ type: 'insertMarker' }); return; }
    if (action === 'togglePin' && typeof togglePin === 'function') { e.preventDefault(); togglePin(getCenterIdx()); return; }
    if (action === 'annotate' && typeof promptAnnotation === 'function') { e.preventDefault(); promptAnnotation(getCenterIdx()); return; }
    /* Cycle device tier: none → warnplus → all → none */
    if (action === 'toggleDevice' && typeof setShowDevice === 'function') { e.preventDefault(); var _dm = showDevice === 'none' ? 'warnplus' : showDevice === 'warnplus' ? 'all' : 'none'; setShowDevice(_dm); var _dr = document.querySelector('input[name="tier-device"][value="' + _dm + '"]'); if (_dr) _dr.checked = true; return; }

    /* Keyboard shortcuts reference — opens standalone panel in the main editor area */
    if (action === 'showKeyboardShortcuts') { e.preventDefault(); vscodeApi.postMessage({ type: 'showKeyboardShortcuts' }); return; }

    /* Panel toggles — each opens the panel or closes it if already active */
    if (action === 'toggleOptions') { e.preventDefault(); if (typeof setActivePanel === 'function') setActivePanel('options'); return; }
    if (action === 'toggleFilters') { e.preventDefault(); if (typeof setActivePanel === 'function') setActivePanel('filters'); return; }
    if (action === 'toggleSignals') { e.preventDefault(); if (typeof setActivePanel === 'function') setActivePanel('signal'); return; }
    if (action === 'toggleBookmarks') { e.preventDefault(); if (typeof setActivePanel === 'function') setActivePanel('bookmarks'); return; }
    if (action === 'toggleSessions') { e.preventDefault(); if (typeof setActivePanel === 'function') setActivePanel('sessions'); return; }
    if (action === 'toggleCollections') { e.preventDefault(); if (typeof setActivePanel === 'function') setActivePanel('collections'); return; }
    if (action === 'toggleSqlHistory') { e.preventDefault(); if (typeof setActivePanel === 'function') setActivePanel('sqlHistory'); return; }
    if (action === 'toggleTrash') { e.preventDefault(); if (typeof setActivePanel === 'function') setActivePanel('trash'); return; }

    /* Bookmark center line */
    if (action === 'bookmark') { e.preventDefault(); var _bi = getCenterIdx(); var _bd = allLines[_bi]; var _bt = _bd ? (_bd.text || '') : ''; vscodeApi.postMessage({ type: 'addBookmark', lineIndex: _bi, text: _bt }); return; }

    /* Display toggles */
    if (action === 'toggleCompress' && typeof toggleCompressLines === 'function') { e.preventDefault(); toggleCompressLines(); return; }
    if (action === 'toggleBlankLines' && typeof toggleHideBlankLines === 'function') { e.preventDefault(); toggleHideBlankLines(); return; }
    if (action === 'toggleSpacing' && typeof toggleVisualSpacing === 'function') { e.preventDefault(); toggleVisualSpacing(); return; }

    /* Session / split part navigation */
    if (action === 'prevSession') { e.preventDefault(); vscodeApi.postMessage({ type: 'navigateSession', direction: -1 }); return; }
    if (action === 'nextSession') { e.preventDefault(); vscodeApi.postMessage({ type: 'navigateSession', direction: 1 }); return; }
    if (action === 'prevPart') { e.preventDefault(); if (typeof currentPart !== 'undefined' && currentPart > 1) vscodeApi.postMessage({ type: 'navigatePart', part: currentPart - 1 }); return; }
    if (action === 'nextPart') { e.preventDefault(); if (typeof currentPart !== 'undefined' && typeof totalParts !== 'undefined' && currentPart < totalParts) vscodeApi.postMessage({ type: 'navigatePart', part: currentPart + 1 }); return; }

    /* Line height adjustment — mirrors font size shortcuts */
    if (action === 'lineHeightUp') { e.preventDefault(); if (typeof setLineHeight === 'function') setLineHeight(logLineHeight + 0.1); return; }
    if (action === 'lineHeightDown') { e.preventDefault(); if (typeof setLineHeight === 'function') setLineHeight(logLineHeight - 0.1); return; }
    if (action === 'lineHeightReset') { e.preventDefault(); if (typeof setLineHeight === 'function') setLineHeight(2.0); return; }

    /* File actions */
    if (action === 'copyFilePath') { e.preventDefault(); vscodeApi.postMessage({ type: 'copyCurrentFilePath' }); return; }
    if (action === 'revealFile') { e.preventDefault(); vscodeApi.postMessage({ type: 'revealLogFile' }); return; }
});
`;
}
/** Get keyboard script with default keybindings injected. */
function getKeyboardScriptWithDefaults() {
    return getKeyboardScript((0, viewer_keybindings_1.getDefaultKeyToAction)());
}
//# sourceMappingURL=viewer-script-keyboard.js.map