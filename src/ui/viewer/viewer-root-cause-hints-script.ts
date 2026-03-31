/**
 * DB_14 — Root-cause hypotheses strip (webview embed).
 *
 * Bundles the deterministic hypothesis algorithm (`viewer-root-cause-hints-embed-algorithm.ts`) with UI:
 * evidence scroll targets, **Copy signals** clipboard action, and per-signal dismiss/restore.
 *
 * Visibility is controlled by the toolbar signals icon (`#toolbar-signals-btn`).
 * The toolbar badge (`#toolbar-signals-count`) shows the number of detected signals.
 *
 * The host command/context-menu path still uses `runTriggerExplainRootCauseHypothesesFromHost` for
 * `explainRootCauseHypotheses` / `explainRootCauseHypothesesEmpty` messages.
 *
 * **Signal strength:** Each hypothesis may show a compact emoji (stronger vs weaker heuristic); copy lives in
 * `viewer.rchConfTooltip*` and is applied via `title` / `aria-label` — not a statistical confidence score.
 */
import { getViewerRootCauseHintsEmbedAlgorithmChunk } from './viewer-root-cause-hints-embed-algorithm';

export function getViewerRootCauseHintsScript(): string {
  return (
    getViewerRootCauseHintsEmbedAlgorithmChunk() +
    /* javascript */ `
function rchStr(key, fallback) {
    var L = (typeof window !== 'undefined' && window.rchL10n) ? window.rchL10n : {};
    var v = L[key];
    return (typeof v === 'string' && v.length) ? v : fallback;
}

var rchDismissedKeys = Object.create(null);

function buildRootCauseHypothesesExplainText(bundle, hy) {
    var lines = [];
    lines.push('Log viewer root-cause hypotheses (deterministic heuristics, not verified facts):');
    var hi;
    for (hi = 0; hi < hy.length; hi++) {
        lines.push('- ' + String(hy[hi].text || ''));
    }
    lines.push('');
    lines.push('Session id: ' + String(bundle && bundle.sessionId ? bundle.sessionId : ''));
    return lines.join('\\n');
}

/** Command + context menu: posts explainRootCauseHypotheses to extension host. */
function runTriggerExplainRootCauseHypothesesFromHost() {
    if (typeof vscodeApi === 'undefined' || !vscodeApi) return;
    var b = collectRootCauseHintBundleEmbedded();
    var hList = buildHypothesesEmbedded(b);
    if (!hList.length) {
        vscodeApi.postMessage({ type: 'explainRootCauseHypothesesEmpty' });
        return;
    }
    var narr = buildRootCauseHypothesesExplainText(b, hList);
    var explainLine = 0;
    if (b.errors && b.errors.length) explainLine = b.errors[0].lineIndex;
    vscodeApi.postMessage({ type: 'explainRootCauseHypotheses', text: narr, lineIndex: explainLine });
}

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
    requestAnimationFrame(function() {
        flashLineAtIndex(idx);
    });
}

/** Briefly flash-highlight a rendered line so the user can see where they landed. */
function flashLineAtIndex(idx) {
    var el = document.querySelector('[data-idx="' + idx + '"]');
    if (!el) return;
    el.classList.remove('rch-evidence-flash');
    void el.offsetWidth;
    el.classList.add('rch-evidence-flash');
    el.addEventListener('animationend', function handler() {
        el.classList.remove('rch-evidence-flash');
        el.removeEventListener('animationend', handler);
    });
}

/** Update the toolbar signals badge with the current count. */
function updateSignalsBadge(count) {
    var badge = document.getElementById('toolbar-signals-count');
    if (badge) badge.textContent = count > 0 ? String(count) : '';
}

/** Show a brief toast inside the signals panel. */
function showRchToast(host, msg) {
    var existing = host.querySelector('.rch-toast');
    if (existing) existing.remove();
    var toast = document.createElement('span');
    toast.className = 'rch-toast';
    toast.textContent = msg;
    host.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 1500);
}

function renderRootCauseHypothesesIfNeeded() {
    var host = document.getElementById('root-cause-hypotheses');
    if (!host) return;
    if (typeof allLines === 'undefined' || !allLines.length) {
        updateSignalsBadge(0);
        host.innerHTML = '';
        if (typeof hideSignalsPanel === 'function') hideSignalsPanel();
        return;
    }
    var bundle = collectRootCauseHintBundleEmbedded();
    var hy = buildHypothesesEmbedded(bundle);
    var visible = [];
    var dismissedCount = 0;
    var vi;
    for (vi = 0; vi < hy.length; vi++) {
        if (rchDismissedKeys[hy[vi].hypothesisKey]) dismissedCount++;
        else visible.push(hy[vi]);
    }
    if (!visible.length && !dismissedCount) {
        updateSignalsBadge(0);
        host.innerHTML = '';
        if (typeof hideSignalsPanel === 'function') hideSignalsPanel();
        return;
    }
    updateSignalsBadge(visible.length);
    var parts = [];
    if (visible.length) {
        parts.push('<ul class="root-cause-hypotheses-list">');
        var hi, item, li, ev, ei, idx, validIdx, confNorm, confTip, confEmoji;
        for (hi = 0; hi < visible.length; hi++) {
            item = visible[hi];
            li = '<li>';
            li += '<span class="rch-hyp-text">' + escapeHtml(item.text) + '</span>';
            li += ' <button type="button" class="rch-copy-btn" data-rch-copy="' + escapeHtml(item.text) + '" aria-label="' + escapeHtml(rchStr('copyAria', 'Copy signal')) + '" title="' + escapeHtml(rchStr('copyAria', 'Copy signal')) + '"><span class="codicon codicon-copy"></span></button>';
            if (item.confidence) {
                confNorm = String(item.confidence).toLowerCase();
                if (confNorm === 'medium') {
                    confEmoji = '\\uD83D\\uDFE1';
                    confTip = rchStr('confTooltipMedium', 'Stronger hint: tied to a concrete log line or a higher-certainty DB pattern. Still a heuristic, not proof.');
                } else {
                    confEmoji = '\\u26AA';
                    confTip = rchStr('confTooltipLow', 'Weaker hint: from volume or patterns only; may be normal traffic or noise. Use as a lead.');
                }
                li += '<span class="root-cause-hyp-conf root-cause-hyp-conf--' + escapeHtml(confNorm) + '" role="img" aria-label="' + escapeHtml(confTip) + '" title="' + escapeHtml(confTip) + '">' + confEmoji + '</span>';
            }
            ev = item.evidenceLineIds || [];
            for (ei = 0; ei < ev.length; ei++) {
                idx = ev[ei];
                validIdx = typeof idx === 'number' && idx >= 0 && idx < allLines.length;
                if (validIdx) {
                    li += ' <button type="button" class="root-cause-hyp-evidence" data-line-idx="' + idx + '" title="Scroll to evidence">line ' + (idx + 1) + '</button>';
                }
            }
            li += ' <button type="button" class="rch-dismiss-btn" data-rch-dismiss="' + escapeHtml(item.hypothesisKey) + '" aria-label="Dismiss signal" title="Dismiss signal"><span class="codicon codicon-close"></span></button>';
            li += '</li>';
            parts.push(li);
        }
        parts.push('</ul>');
        parts.push('<button type="button" class="rch-copy-all-btn" data-rch-copy-all="1">Copy signals</button>');
    }
    if (dismissedCount > 0) {
        parts.push('<button type="button" class="rch-restore-btn" data-rch-restore="1">' + dismissedCount + ' dismissed \\u2014 restore all</button>');
    }
    host.innerHTML = parts.join('');
    if (visible.length && typeof showSignalsPanel === 'function') showSignalsPanel();
}

function scheduleRootCauseHypothesesRefresh() {
    if (rootCauseHypothesesRaf) return;
    rootCauseHypothesesRaf = requestAnimationFrame(function() {
        rootCauseHypothesesRaf = null;
        renderRootCauseHypothesesIfNeeded();
    });
}

function resetRootCauseHypothesesSession() {
    rchDismissedKeys = Object.create(null);
    if (typeof clearRootCauseHintHostFields === 'function') clearRootCauseHintHostFields();
    rootCauseHintSessionEpoch = (rootCauseHintSessionEpoch || 0) + 1;
    var host = document.getElementById('root-cause-hypotheses');
    if (host) {
        host.innerHTML = '';
        if (typeof hideSignalsPanel === 'function') hideSignalsPanel();
    }
    updateSignalsBadge(0);
}

function initRootCauseHypothesesUi() {
    var host = document.getElementById('root-cause-hypotheses');
    if (!host || host.dataset.rchInit === '1') return;
    host.dataset.rchInit = '1';
    host.addEventListener('click', function(ev) {
        var t = ev.target;
        var copyAllBtn = t && t.closest ? t.closest('.rch-copy-all-btn') : null;
        if (copyAllBtn) {
            ev.preventDefault();
            var b = collectRootCauseHintBundleEmbedded();
            var hList = buildHypothesesEmbedded(b);
            var hVisible = [];
            for (var ci = 0; ci < hList.length; ci++) {
                if (!rchDismissedKeys[hList[ci].hypothesisKey]) hVisible.push(hList[ci]);
            }
            if (!hVisible.length) return;
            var text = buildRootCauseHypothesesExplainText(b, hVisible);
            navigator.clipboard.writeText(text).then(function() {
                showRchToast(host, 'Copied!');
            }).catch(function() {});
            return;
        }
        var dismissBtn = t && t.closest ? t.closest('.rch-dismiss-btn') : null;
        if (dismissBtn && dismissBtn.dataset && dismissBtn.dataset.rchDismiss) {
            ev.preventDefault();
            rchDismissedKeys[dismissBtn.dataset.rchDismiss] = true;
            renderRootCauseHypothesesIfNeeded();
            showRchToast(host, 'Signal hidden for this session');
            return;
        }
        var restoreBtn = t && t.closest ? t.closest('.rch-restore-btn') : null;
        if (restoreBtn) {
            ev.preventDefault();
            rchDismissedKeys = Object.create(null);
            renderRootCauseHypothesesIfNeeded();
            return;
        }
        var copyBtn = t && t.closest ? t.closest('.rch-copy-btn') : null;
        if (copyBtn && copyBtn.dataset && copyBtn.dataset.rchCopy !== undefined) {
            ev.preventDefault();
            if (!copyBtn._rchOrigHtml) copyBtn._rchOrigHtml = copyBtn.innerHTML;
            navigator.clipboard.writeText(copyBtn.dataset.rchCopy).then(function() {
                copyBtn.textContent = rchStr('copied', 'Copied');
                copyBtn.classList.add('rch-copy-btn-done');
                clearTimeout(copyBtn._rchTimer);
                copyBtn._rchTimer = setTimeout(function() { copyBtn.innerHTML = copyBtn._rchOrigHtml; copyBtn.classList.remove('rch-copy-btn-done'); }, 1200);
            }).catch(function() {});
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
