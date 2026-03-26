"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerRootCauseHintsScript = getViewerRootCauseHintsScript;
/**
 * DB_14 — Root-cause hypotheses strip (webview embed).
 *
 * Bundles the deterministic hypothesis algorithm (`viewer-root-cause-hints-embed-algorithm.ts`) with UI:
 * collapse state, dismiss, evidence scroll targets, and **Explain with AI** / **Explain root-cause hypotheses**
 * (command + context menu post `triggerExplainRootCauseHypotheses` from the host; webview calls
 * `runTriggerExplainRootCauseHypothesesFromHost`, which mirrors the strip button and posts
 * `explainRootCauseHypotheses` or `explainRootCauseHypothesesEmpty`). No host round-trip for the explain
 * path beyond that single postMessage — avoids duplicate LLM entry points in script.
 *
 * **Signal strength:** Each hypothesis may show a compact emoji (stronger vs weaker heuristic); copy lives in
 * `viewer.rchConfTooltip*` and is applied via `title` / `aria-label` — not a statistical confidence score.
 */
const viewer_root_cause_hints_embed_algorithm_1 = require("./viewer-root-cause-hints-embed-algorithm");
function getViewerRootCauseHintsScript() {
    return ((0, viewer_root_cause_hints_embed_algorithm_1.getViewerRootCauseHintsEmbedAlgorithmChunk)() +
        /* javascript */ `
function rchStr(key, fallback) {
    var L = (typeof window !== 'undefined' && window.rchL10n) ? window.rchL10n : {};
    var v = L[key];
    return (typeof v === 'string' && v.length) ? v : fallback;
}

function rchCollapseStorageKey() {
    return 'saropa-rch-collapsed::' + String(rootCauseHintSessionEpoch || 0) + '|' + (typeof currentFilename !== 'undefined' ? currentFilename : '');
}

function isRchStripCollapsed() {
    try {
        return sessionStorage.getItem(rchCollapseStorageKey()) === '1';
    } catch (_e) {
        return false;
    }
}

function setRchStripCollapsed(v) {
    try {
        if (v) sessionStorage.setItem(rchCollapseStorageKey(), '1');
        else sessionStorage.removeItem(rchCollapseStorageKey());
    } catch (_e) { /* storage unavailable */ }
}

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

/** Command + context menu: same flow as the strip “Explain with AI” button; empty hypotheses → host info message. */
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
    var collapsed = isRchStripCollapsed();
    var parts = [];
    parts.push('<div class="root-cause-hypotheses-header">');
    parts.push('<button type="button" class="root-cause-hyp-toggle" data-rch-toggle="1" aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-label="' + escapeHtml(collapsed ? rchStr('expandAria', 'Expand signals') : rchStr('collapseAria', 'Collapse signals')) + '" title="' + escapeHtml(collapsed ? rchStr('expandTitle', 'Expand') : rchStr('collapseTitle', 'Collapse')) + '">' + (collapsed ? '\\u25b6' : '\\u25bc') + '</button>');
    parts.push('<span class="root-cause-hypotheses-title">' + escapeHtml(rchStr('title', 'Signals')) + '</span>');
    parts.push('<button type="button" class="root-cause-hyp-explain-ai" data-rch-explain="1" aria-label="' + escapeHtml(rchStr('explainAi', 'Explain with AI')) + '">' + escapeHtml(rchStr('explainAi', 'Explain with AI')) + '</button>');
    parts.push('<button type="button" class="root-cause-hypotheses-dismiss" aria-label="' + escapeHtml(rchStr('dismissAria', 'Dismiss signals')) + '" title="' + escapeHtml(rchStr('dismissTitle', 'Dismiss for this log')) + '">\\u00d7</button>');
    parts.push('</div>');
    parts.push('<div class="root-cause-hypotheses-body' + (collapsed ? ' u-hidden' : '') + '">');
    parts.push('<ul class="root-cause-hypotheses-list">');
    var hi, item, li, ev, ei, idx, validIdx, confNorm, confTip, confEmoji;
    for (hi = 0; hi < hy.length; hi++) {
        item = hy[hi];
        li = '<li>';
        li += '<span class="rch-hyp-text">' + escapeHtml(item.text) + '</span>';
        li += ' <button type="button" class="rch-copy-btn" data-rch-copy="' + escapeHtml(item.text) + '" aria-label="' + escapeHtml(rchStr('copyAria', 'Copy signal')) + '" title="' + escapeHtml(rchStr('copyAria', 'Copy signal')) + '"><span class="codicon codicon-copy"></span></button>';
        if (item.confidence) {
            confNorm = String(item.confidence).toLowerCase();
            if (confNorm === 'medium') {
                confEmoji = '\uD83D\uDFE1';
                confTip = rchStr('confTooltipMedium', 'Stronger hint: tied to a concrete log line or a higher-certainty DB pattern. Still a heuristic, not proof.');
            }
            else {
                confEmoji = '\u26AA';
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
        li += '</li>';
        parts.push(li);
    }
    parts.push('</ul>');
    parts.push('</div>');
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
    if (typeof clearRootCauseHintHostFields === 'function') clearRootCauseHintHostFields();
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
        if (t && t.dataset && t.dataset.rchToggle === '1') {
            ev.preventDefault();
            setRchStripCollapsed(!isRchStripCollapsed());
            renderRootCauseHypothesesIfNeeded();
            return;
        }
        if (t && t.dataset && t.dataset.rchExplain === '1') {
            ev.preventDefault();
            runTriggerExplainRootCauseHypothesesFromHost();
            return;
        }
        if (t && t.classList && t.classList.contains('root-cause-hypotheses-dismiss')) {
            ev.preventDefault();
            rootCauseHypothesesDismissed = true;
            host.classList.add('u-hidden');
            host.innerHTML = '';
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
`);
}
//# sourceMappingURL=viewer-root-cause-hints-script.js.map