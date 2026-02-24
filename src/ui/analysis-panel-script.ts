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
    var urlLink = e.target.closest('.url-link');
    if (urlLink && urlLink.dataset.url) { vscodeApi.postMessage({ type: 'openFirebaseUrl', url: urlLink.dataset.url }); return; }
    var ghItem = e.target.closest('.gh-item');
    if (ghItem && ghItem.dataset.url) { vscodeApi.postMessage({ type: 'openGitHubUrl', url: ghItem.dataset.url }); return; }
    var fbConsole = e.target.closest('.fb-console');
    if (fbConsole && fbConsole.dataset.url) { vscodeApi.postMessage({ type: 'openFirebaseUrl', url: fbConsole.dataset.url }); return; }
    var fbItem = e.target.closest('.fb-item[data-issue-id]');
    if (fbItem) {
        var iid = fbItem.dataset.issueId;
        var det = document.getElementById('crash-detail-' + iid);
        if (det && det.classList.contains('expanded')) { det.classList.remove('expanded'); fbItem.classList.remove('detail-open'); }
        else if (det) { if (!det.dataset.loaded) { det.innerHTML = '<div class="crash-loading"><span class="spinner"></span> Loading crash details\u2026</div>'; det.dataset.loaded = '1'; vscodeApi.postMessage({ type: 'fetchCrashDetail', issueId: iid }); } det.classList.add('expanded'); fbItem.classList.add('detail-open'); }
        return;
    }
    var navBtn = e.target.closest('.crash-nav-btn');
    if (navBtn && !navBtn.disabled) {
        var nav = navBtn.closest('.crash-event-nav');
        var iid = nav ? nav.dataset.issueId : '';
        var lbl = nav ? nav.querySelector('.crash-nav-label') : null;
        var cur = lbl ? parseInt(lbl.textContent.split(' ')[1]) - 1 : 0;
        var dir = parseInt(navBtn.dataset.dir || '0');
        vscodeApi.postMessage({ type: 'navigateCrashEvent', issueId: iid, eventIndex: cur + dir });
        return;
    }
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
    } else if (e.data.type === 'crashDetailReady') {
        var cd = document.getElementById('crash-detail-' + e.data.issueId);
        if (cd) { cd.innerHTML = e.data.html; cd.classList.add('expanded'); }
    } else if (e.data.type === 'crashAiSummary') {
        var cd2 = document.getElementById('crash-detail-' + e.data.issueId);
        if (cd2) { cd2.insertAdjacentHTML('afterbegin', e.data.html); }
    } else if (e.data.type === 'issueStatsReady') {
        var cs = document.getElementById('crash-stats-' + e.data.issueId);
        if (cs) { cs.innerHTML = e.data.html; }
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
