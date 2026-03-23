/**
 * DB_14: root-cause hypotheses strip UI + scroll wiring. Algorithm chunk:
 * `viewer-root-cause-hints-embed-algorithm.ts`.
 */
import { getViewerRootCauseHintsEmbedAlgorithmChunk } from './viewer-root-cause-hints-embed-algorithm';

export function getViewerRootCauseHintsScript(): string {
  return (
    getViewerRootCauseHintsEmbedAlgorithmChunk() +
    /* javascript */ `
function scrollViewerToLineIndex0(idx) {
    if (typeof allLines === 'undefined' || !logEl) return;
    if (idx < 0 || idx >= allLines.length) return;
    var ch = 0;
    for (var si = 0; si < idx; si++) ch += allLines[si].height;
    if (window.setProgrammaticScroll) window.setProgrammaticScroll();
    suppressScroll = true;
    logEl.scrollTop = ch;
    suppressScroll = false;
    autoScroll = false;
}

function renderRootCauseHypothesesIfNeeded() {
    var host = document.getElementById('root-cause-hypotheses');
    if (!host) return;
    if (rootCauseHypothesesDismissed) {
        host.classList.add('u-hidden');
        host.innerHTML = '';
        return;
    }
    if (typeof allLines === 'undefined' || !allLines.length) {
        host.classList.add('u-hidden');
        host.innerHTML = '';
        return;
    }
    var bundle = collectRootCauseHintBundleEmbedded();
    var hy = buildHypothesesEmbedded(bundle);
    if (!hy.length) {
        host.classList.add('u-hidden');
        host.innerHTML = '';
        return;
    }
    var parts = [];
    parts.push('<div class="root-cause-hypotheses-header">');
    parts.push('<span class="root-cause-hypotheses-title">Hypotheses</span>');
    parts.push('<button type="button" class="root-cause-hypotheses-dismiss" aria-label="Dismiss hypotheses" title="Dismiss for this log">\\u00d7</button>');
    parts.push('</div>');
    parts.push('<p class="root-cause-hypotheses-disclaimer">Hypothesis, not fact.</p>');
    parts.push('<ul class="root-cause-hypotheses-list">');
    var hi, item, li, ev, ei, idx, validIdx;
    for (hi = 0; hi < hy.length; hi++) {
        item = hy[hi];
        li = '<li>';
        li += '<span class="rch-hyp-text">' + escapeHtml(item.text) + '</span>';
        if (item.confidence) {
            li += '<span class="root-cause-hyp-conf">' + escapeHtml(String(item.confidence)) + '</span>';
        }
        ev = item.evidenceLineIds || [];
        for (ei = 0; ei < ev.length; ei++) {
            idx = ev[ei];
            validIdx = typeof idx === 'number' && idx >= 0 && idx < allLines.length;
            if (validIdx) {
                li += ' <button type="button" class="root-cause-hyp-evidence" data-line-idx="' + idx + '" title="Scroll to evidence">line ' + (idx + 1) + '</button>';
            }
        }
        li += '</li>';
        parts.push(li);
    }
    parts.push('</ul>');
    host.innerHTML = parts.join('');
    host.classList.remove('u-hidden');
}

function scheduleRootCauseHypothesesRefresh() {
    if (rootCauseHypothesesRaf) return;
    rootCauseHypothesesRaf = requestAnimationFrame(function() {
        rootCauseHypothesesRaf = null;
        renderRootCauseHypothesesIfNeeded();
    });
}

function resetRootCauseHypothesesSession() {
    rootCauseHintSessionEpoch = (rootCauseHintSessionEpoch || 0) + 1;
    rootCauseHypothesesDismissed = false;
    var host = document.getElementById('root-cause-hypotheses');
    if (host) {
        host.classList.add('u-hidden');
        host.innerHTML = '';
    }
}

function initRootCauseHypothesesUi() {
    var host = document.getElementById('root-cause-hypotheses');
    if (!host || host.dataset.rchInit === '1') return;
    host.dataset.rchInit = '1';
    host.addEventListener('click', function(ev) {
        var t = ev.target;
        if (t && t.classList && t.classList.contains('root-cause-hypotheses-dismiss')) {
            ev.preventDefault();
            rootCauseHypothesesDismissed = true;
            host.classList.add('u-hidden');
            host.innerHTML = '';
            return;
        }
        var btn = t && t.closest ? t.closest('.root-cause-hyp-evidence') : null;
        if (btn && btn.dataset && btn.dataset.lineIdx !== undefined) {
            ev.preventDefault();
            var lix = parseInt(btn.dataset.lineIdx, 10);
            if (!isNaN(lix)) scrollViewerToLineIndex0(lix);
        }
    });
}

initRootCauseHypothesesUi();
`
  );
}
