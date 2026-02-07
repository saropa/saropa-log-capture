/** CSS styles and webview script for the analysis panel. */

/** Get CSS styles for the analysis panel including progressive loading indicators. */
export function getAnalysisStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family, sans-serif); font-size: 13px; }
.header { padding: 12px 16px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); }
.analyzed-line { font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; color: var(--vscode-descriptionForeground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.summary { font-size: 11px; color: var(--vscode-descriptionForeground); }
.content { padding: 8px; }
.token { display: inline-block; margin: 4px 4px 0 0; padding: 2px 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; font-size: 11px; }
.group { margin-bottom: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
.group-header { padding: 8px 12px; cursor: pointer; font-weight: 600; font-size: 13px; list-style: none; }
.group-header::-webkit-details-marker { display: none; }
.group-header::before { content: '▶ '; font-size: 10px; }
details[open] > .group-header::before { content: '▼ '; }
.match-count { font-weight: normal; color: var(--vscode-descriptionForeground); font-size: 11px; margin-left: 8px; }
.no-matches { padding: 8px 12px; color: var(--vscode-disabledForeground); font-style: italic; font-size: 12px; }
.file-group { margin: 4px 8px; }
.file-name { padding: 4px 8px; font-size: 12px; font-weight: 500; color: var(--vscode-textLink-foreground); }
.match-line, .annotation-line { display: flex; gap: 8px; padding: 3px 8px 3px 24px; cursor: pointer; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; border-radius: 3px; }
.match-line:hover, .annotation-line:hover { background: var(--vscode-list-hoverBackground); }
.line-num { color: var(--vscode-editorLineNumber-foreground); min-width: 40px; flex-shrink: 0; }
.line-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.commit-line { display: flex; gap: 10px; padding: 3px 8px 3px 24px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
.commit-hash { color: var(--vscode-textLink-foreground); min-width: 60px; }
.commit-date { color: var(--vscode-descriptionForeground); min-width: 80px; }
.commit-msg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.anno-type { font-size: 10px; font-weight: 700; padding: 0 4px; border-radius: 3px; min-width: 44px; text-align: center; }
.anno-todo { background: var(--vscode-editorInfo-foreground, #3794ff); color: #fff; }
.anno-fixme { background: var(--vscode-editorWarning-foreground, #cca700); color: #000; }
.anno-hack { background: var(--vscode-editorWarning-foreground, #cca700); color: #000; }
.anno-bug { background: var(--vscode-editorError-foreground, #f14c4c); color: #fff; }
.anno-note { background: var(--vscode-descriptionForeground); color: var(--vscode-editor-background); }
.anno-xxx { background: var(--vscode-editorError-foreground, #f14c4c); color: #fff; }
.source-preview { font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
.source-line { display: flex; gap: 8px; padding: 1px 8px 1px 24px; cursor: pointer; }
.source-line:hover { background: var(--vscode-list-hoverBackground); }
.target-line { background: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 200, 0, 0.2)); border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700); padding-left: 21px; }
.target-line:hover { background: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 200, 0, 0.3)); }
.blame-line { padding: 6px 12px; font-size: 12px; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); }
.blame-line code { color: var(--vscode-textLink-foreground); }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
.section-slot { margin-bottom: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; overflow: hidden; transition: opacity 0.3s ease; }
.section-loading { display: flex; align-items: center; gap: 8px; padding: 10px 12px; color: var(--vscode-descriptionForeground); font-size: 12px; animation: pulse 2s ease-in-out infinite; }
.spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--vscode-descriptionForeground); border-top-color: var(--vscode-progressBar-background, #0078d4); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
.section-done { animation: none; }
.status-icon { font-size: 13px; flex-shrink: 0; width: 16px; text-align: center; }
.status-ok { color: var(--vscode-testing-iconPassed, #73c991); }
.status-empty { color: var(--vscode-disabledForeground); }
.status-error { color: var(--vscode-testing-iconFailed, #f14c4c); }
.doc-match { display: flex; gap: 8px; padding: 3px 8px 3px 24px; cursor: pointer; font-size: 12px; border-radius: 3px; }
.doc-match:hover { background: var(--vscode-list-hoverBackground); }
.doc-file { color: var(--vscode-textLink-foreground); font-weight: 500; min-width: 100px; flex-shrink: 0; }
.doc-token { font-size: 10px; padding: 0 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; flex-shrink: 0; }
.import-entry { display: flex; gap: 8px; padding: 2px 8px 2px 24px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
.import-local { color: var(--vscode-textLink-foreground); }
.import-package { color: var(--vscode-editorInfo-foreground, #3794ff); }
.import-badge { font-size: 10px; padding: 0 4px; border-radius: 3px; font-weight: 600; }
.import-badge-local { background: var(--vscode-editorInfo-foreground, #3794ff); color: #fff; }
.import-badge-pkg { background: var(--vscode-editorWarning-foreground, #cca700); color: #000; }
.symbol-entry { display: flex; gap: 8px; padding: 3px 8px 3px 24px; cursor: pointer; font-size: 12px; border-radius: 3px; }
.symbol-entry:hover { background: var(--vscode-list-hoverBackground); }
.symbol-kind { font-size: 10px; padding: 0 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; min-width: 44px; text-align: center; flex-shrink: 0; }
.symbol-name { font-weight: 500; }
.symbol-loc { color: var(--vscode-descriptionForeground); }
.cancel-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 2px 8px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-left: 8px; }
.cancel-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
.cancel-btn.hidden { display: none; }`;
}

/** Get the webview script with click handlers and progressive section updates. */
export function getAnalysisScript(): string {
    return /* javascript */ `
var vscodeApi = acquireVsCodeApi();
var cancelBtn = document.getElementById('cancel-btn');
if (cancelBtn) { cancelBtn.addEventListener('click', function() { vscodeApi.postMessage({ type: 'cancelAnalysis' }); cancelBtn.textContent = 'Stopped'; cancelBtn.disabled = true; }); }
var pendingCount = document.querySelectorAll('.section-loading:not(.section-done)').length;
document.addEventListener('click', function(e) {
    var line = e.target.closest('.match-line');
    if (line) { vscodeApi.postMessage({ type: 'openMatch', uri: line.dataset.uri, filename: line.dataset.filename, line: parseInt(line.dataset.line) }); return; }
    var src = e.target.closest('.source-line');
    if (src) { vscodeApi.postMessage({ type: 'openSource', uri: src.dataset.sourceUri, line: parseInt(src.dataset.line) }); return; }
    var anno = e.target.closest('.annotation-line');
    if (anno) { vscodeApi.postMessage({ type: 'openSource', uri: anno.dataset.sourceUri, line: parseInt(anno.dataset.line) }); return; }
    var doc = e.target.closest('.doc-match');
    if (doc) { vscodeApi.postMessage({ type: 'openDoc', uri: doc.dataset.uri, line: parseInt(doc.dataset.line || '1') }); return; }
    var sym = e.target.closest('.symbol-entry');
    if (sym) { vscodeApi.postMessage({ type: 'openSource', uri: sym.dataset.uri, line: parseInt(sym.dataset.line || '1') }); }
});
window.addEventListener('message', function(e) {
    if (e.data.type === 'sectionReady') {
        var slot = document.getElementById('section-' + e.data.id);
        if (slot) { slot.outerHTML = e.data.html; }
        pendingCount--;
        if (pendingCount <= 0 && cancelBtn) { cancelBtn.classList.add('hidden'); }
    }
});`;
}
