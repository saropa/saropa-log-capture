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
.token { display: inline-block; margin: 4px 4px 0 0; padding: 3px 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; font-size: 11px; }
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
.anno-todo { background: var(--vscode-editorInfo-foreground, #3794ff); color: var(--vscode-editor-background); }
.anno-fixme { background: var(--vscode-editorWarning-foreground, #cca700); color: var(--vscode-editor-background); }
.anno-hack { background: var(--vscode-editorWarning-foreground, #cca700); color: var(--vscode-editor-background); }
.anno-bug { background: var(--vscode-editorError-foreground, #f14c4c); color: var(--vscode-editor-background); }
.anno-note { background: var(--vscode-descriptionForeground); color: var(--vscode-editor-background); }
.anno-xxx { background: var(--vscode-editorError-foreground, #f14c4c); color: var(--vscode-editor-background); }
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
.section-loading { display: flex; align-items: center; gap: 8px; padding: 10px 12px; color: var(--vscode-descriptionForeground); font-size: 12px; animation: pulse 1.2s ease-in-out infinite; }
.spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--vscode-descriptionForeground); border-top-color: var(--vscode-progressBar-background, #0078d4); border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0; }
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
.import-badge-local { background: var(--vscode-editorInfo-foreground, #3794ff); color: var(--vscode-editor-background); }
.import-badge-pkg { background: var(--vscode-editorWarning-foreground, #cca700); color: var(--vscode-editor-background); }
.symbol-entry { display: flex; gap: 8px; padding: 3px 8px 3px 24px; cursor: pointer; font-size: 12px; border-radius: 3px; }
.symbol-entry:hover { background: var(--vscode-list-hoverBackground); }
.symbol-kind { font-size: 10px; padding: 0 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; min-width: 44px; text-align: center; flex-shrink: 0; }
.symbol-name { font-weight: 500; }
.symbol-loc { color: var(--vscode-descriptionForeground); }
.cancel-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 2px 8px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-left: 8px; }
.cancel-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
.cancel-btn.hidden { display: none; }
.executive-summary { margin: 8px; padding: 12px 16px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); border-left: 3px solid var(--vscode-editorInfo-foreground, #3794ff); border-radius: 4px; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.summary-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--vscode-editor-foreground); }
.summary-finding { display: flex; align-items: flex-start; gap: 8px; padding: 3px 0; font-size: 12px; }
.finding-high { color: var(--vscode-editorWarning-foreground, #cca700); font-weight: 500; }
.finding-medium { color: var(--vscode-editor-foreground); }
.finding-icon { flex-shrink: 0; width: 16px; }
.diff-summary { padding: 6px 12px; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); }
.stack-frame { display: flex; align-items: center; gap: 6px; padding: 3px 8px 3px 24px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
.frame-app { cursor: pointer; border-radius: 3px; }
.frame-app:hover { background: var(--vscode-list-hoverBackground); }
.frame-app-nosrc { color: var(--vscode-editor-foreground); }
.frame-fw { color: var(--vscode-disabledForeground); }
.frame-badge { font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: 700; flex-shrink: 0; }
.frame-badge-app { background: var(--vscode-editorInfo-foreground, #3794ff); color: var(--vscode-editor-background); }
.frame-badge-fw { background: var(--vscode-descriptionForeground); color: var(--vscode-editor-background); }
.frame-detail { padding: 0 8px 0 40px; overflow: hidden; max-height: 0; transition: max-height 0.3s ease; }
.frame-detail.expanded { max-height: 500px; padding: 4px 8px 8px 40px; border-bottom: 1px solid var(--vscode-panel-border); }
.trend-chart { width: 100%; min-height: 50px; padding: 4px 0; }
.trend-bar { fill: var(--vscode-editorWarning-foreground, #cca700); opacity: 0.8; }
.trend-bar:hover { fill: var(--vscode-editorInfo-foreground, #3794ff); opacity: 1; }
.trend-label { fill: var(--vscode-descriptionForeground); font-size: 10px; font-family: var(--vscode-font-family, sans-serif); }
.trend-axis { stroke: var(--vscode-panel-border); stroke-width: 1; }
.progress-bar-track { height: 2px; background: var(--vscode-panel-border); margin-top: 6px; border-radius: 1px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: var(--vscode-progressBar-background, #0078d4); width: 0%; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 1px; }
.progress-bar-fill.complete { background: var(--vscode-testing-iconPassed, #73c991); }
@keyframes barFadeOut { from { opacity: 1; } to { opacity: 0; height: 0; margin: 0; } }
.progress-bar-track.complete { animation: barFadeOut 1s ease 1s forwards; }
.progress-msg { transition: opacity 0.2s ease; }
.progress-msg.fading { opacity: 0; }
.related-line { display: flex; gap: 8px; padding: 3px 8px 3px 24px; cursor: pointer; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; border-radius: 3px; }
.related-line:hover { background: var(--vscode-list-hoverBackground); }
.related-line.analyzed { background: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 200, 0, 0.2)); border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700); padding-left: 21px; }
.related-idx { color: var(--vscode-editorLineNumber-foreground); min-width: 24px; flex-shrink: 0; }
.related-src { color: var(--vscode-descriptionForeground); font-size: 11px; margin-left: auto; flex-shrink: 0; }
.related-overflow { padding: 6px 24px; font-size: 12px; color: var(--vscode-descriptionForeground); }
.related-overflow a { color: var(--vscode-textLink-foreground); }
.ref-file-card { padding: 6px 12px 6px 24px; cursor: pointer; border-radius: 3px; }
.ref-file-card:hover { background: var(--vscode-list-hoverBackground); }
.ref-file-name { font-weight: 500; font-size: 12px; color: var(--vscode-textLink-foreground); }
.ref-file-meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
.ref-file-urgent { color: var(--vscode-editorWarning-foreground, #cca700); font-weight: 600; }
.gh-item { padding: 4px 12px 4px 24px; cursor: pointer; font-size: 12px; border-radius: 3px; }
.gh-item:hover { background: var(--vscode-list-hoverBackground); }
.gh-blame-pr { background: var(--vscode-inputValidation-warningBackground, rgba(255, 200, 0, 0.1)); border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700); padding-left: 21px; }
.gh-pr-open { color: var(--vscode-testing-iconPassed, #73c991); }
.gh-pr-merged { color: var(--vscode-editorInfo-foreground, #3794ff); }
.gh-issue { color: var(--vscode-editorWarning-foreground, #cca700); }
.fb-item { padding: 6px 12px 6px 24px; cursor: pointer; border-radius: 3px; }
.fb-item:hover { background: var(--vscode-list-hoverBackground); }
.fb-title { font-weight: 500; font-size: 12px; }
.fb-meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
.fb-console { padding: 6px 12px 6px 24px; cursor: pointer; font-size: 12px; color: var(--vscode-textLink-foreground); }
.fb-console:hover { text-decoration: underline; }
.fb-empty { padding: 6px 12px; font-size: 12px; color: var(--vscode-disabledForeground); font-style: italic; }`;
}

/** Get the webview script with click handlers and progressive section updates. */
export function getAnalysisScript(): string {
    return /* javascript */ `
var vscodeApi = acquireVsCodeApi();
var cancelBtn = document.getElementById('cancel-btn');
if (cancelBtn) { cancelBtn.addEventListener('click', function() { vscodeApi.postMessage({ type: 'cancelAnalysis' }); cancelBtn.textContent = 'Stopped'; cancelBtn.disabled = true; }); }
var pendingCount = document.querySelectorAll('.section-loading:not(.section-done)').length;
var progressFill = document.getElementById('progress-fill');
var progressText = document.getElementById('progress-text');
var totalSections = progressFill ? parseInt(progressFill.dataset.total || '0') : 0;
function updateProgressBar() {
    var done = totalSections - pendingCount;
    if (progressFill) { progressFill.style.width = (totalSections > 0 ? Math.round((done / totalSections) * 100) : 0) + '%'; }
    if (progressText) { progressText.textContent = 'Analyzing... ' + done + '/' + totalSections + ' complete'; }
}
function completeProgress() {
    if (progressFill) { progressFill.style.width = '100%'; progressFill.classList.add('complete'); }
    if (progressText) { progressText.textContent = '\u2713 Analysis complete'; }
    var track = document.querySelector('.progress-bar-track');
    if (track) { track.classList.add('complete'); }
    if (cancelBtn) { cancelBtn.classList.add('hidden'); }
}
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
    if (sym) { vscodeApi.postMessage({ type: 'openSource', uri: sym.dataset.uri, line: parseInt(sym.dataset.line || '1') }); return; }
    var rel = e.target.closest('.related-line');
    if (rel) { vscodeApi.postMessage({ type: 'openRelatedLine', line: parseInt(rel.dataset.line) }); return; }
    var fileCard = e.target.closest('.ref-file-card');
    if (fileCard) { vscodeApi.postMessage({ type: 'openSource', uri: fileCard.dataset.sourceUri, line: parseInt(fileCard.dataset.line || '1') }); return; }
    var ghItem = e.target.closest('.gh-item');
    if (ghItem && ghItem.dataset.url) { vscodeApi.postMessage({ type: 'openGitHubUrl', url: ghItem.dataset.url }); return; }
    var fbItem = e.target.closest('.fb-item, .fb-console');
    if (fbItem && fbItem.dataset.url) { vscodeApi.postMessage({ type: 'openFirebaseUrl', url: fbItem.dataset.url }); return; }
    var frame = e.target.closest('.frame-app[data-frame-file]');
    if (frame && !frame.classList.contains('frame-loading')) {
        frame.classList.add('frame-loading');
        var det = frame.querySelector('.frame-detail');
        if (det && !det.classList.contains('expanded')) {
            det.innerHTML = '<span class="spinner"></span> Analyzing frame...';
            det.classList.add('expanded');
            vscodeApi.postMessage({ type: 'analyzeFrame', file: frame.dataset.frameFile, line: parseInt(frame.dataset.frameLine) });
        } else if (det) { det.classList.toggle('expanded'); }
    }
});
window.addEventListener('message', function(e) {
    if (e.data.type === 'sectionReady') {
        var slot = document.getElementById('section-' + e.data.id);
        if (slot) { slot.outerHTML = e.data.html; }
        pendingCount--;
        updateProgressBar();
        if (pendingCount <= 0) { completeProgress(); }
    } else if (e.data.type === 'sectionProgress') {
        var pSlot = document.getElementById('section-' + e.data.id);
        if (pSlot) {
            var msg = pSlot.querySelector('.progress-msg');
            if (msg) { msg.classList.add('fading'); setTimeout(function() { msg.textContent = e.data.message; msg.classList.remove('fading'); }, 200); }
        }
    } else if (e.data.type === 'frameReady') {
        var frames = document.querySelectorAll('.frame-app[data-frame-file="' + e.data.file + '"][data-frame-line="' + e.data.line + '"]');
        frames.forEach(function(fr) { var d = fr.querySelector('.frame-detail'); if (d) { d.innerHTML = e.data.html; d.classList.add('expanded'); } fr.classList.remove('frame-loading'); });
    } else if (e.data.type === 'summaryReady') {
        var target = document.getElementById('executive-summary');
        if (target && e.data.html) { target.innerHTML = e.data.html; }
        (e.data.collapseSections || []).forEach(function(id) {
            var slot = document.getElementById('section-' + id);
            if (!slot) { return; }
            var det = slot.querySelectorAll('details[open]');
            det.forEach(function(d) { d.removeAttribute('open'); });
        });
    }
});`;
}
