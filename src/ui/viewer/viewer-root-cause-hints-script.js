"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerRootCauseHintsScript = getViewerRootCauseHintsScript;
/**
 * DB_14 — Root-cause hypotheses strip (webview embed).
 *
 * Collects raw signal data from `allLines` via `collectRootCauseHintBundleEmbedded`
 * and posts the bundle to the extension host. The host runs `buildHypotheses()`
 * (single TypeScript source of truth) and posts the result back as
 * `rootCauseHypothesesResult`. This eliminates the duplicated embedded algorithm.
 *
 * Visibility is controlled by the toolbar signals icon (`#toolbar-signals-btn`).
 * The toolbar badge (`#toolbar-signals-count`) shows the number of detected signals.
 *
 * **Signal strength:** Each hypothesis may show a compact emoji (stronger vs weaker heuristic); copy lives in
 * `viewer.rchConfTooltip*` and is applied via `title` / `aria-label` — not a statistical confidence score.
 */
const root_cause_hint_eligibility_1 = require("../../modules/root-cause-hints/root-cause-hint-eligibility");
const viewer_root_cause_hints_embed_collect_1 = require("./viewer-root-cause-hints-embed-collect");
function getViewerRootCauseHintsScript(slowOpThresholdMs) {
    return ((0, viewer_root_cause_hints_embed_collect_1.getViewerRootCauseHintsEmbedCollectChunk)(slowOpThresholdMs ?? root_cause_hint_eligibility_1.ROOT_CAUSE_SLOW_OP_MIN_MS_DEFAULT) +
        /* javascript */ `
var rchCachedHypotheses = [];
var rchCachedBundle = null;
var rchDismissedKeys = Object.create(null);

function rchStr(key, fallback) {
    var L = (typeof window !== 'undefined' && window.rchL10n) ? window.rchL10n : {};
    var v = L[key];
    return (typeof v === 'string' && v.length) ? v : fallback;
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

/** Command + context menu: posts explainRootCauseHypotheses to extension host. */
function runTriggerExplainRootCauseHypothesesFromHost() {
    if (typeof vscodeApi === 'undefined' || !vscodeApi) return;
    var hList = rchCachedHypotheses;
    if (!hList || !hList.length) {
        vscodeApi.postMessage({ type: 'explainRootCauseHypothesesEmpty' });
        return;
    }
    var narr = buildRootCauseHypothesesExplainText(rchCachedBundle, hList);
    var explainLine = 0;
    var b = rchCachedBundle;
    if (b && b.errors && b.errors.length) explainLine = b.errors[0].lineIndex;
    vscodeApi.postMessage({ type: 'explainRootCauseHypotheses', text: narr, lineIndex: explainLine });
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

/** Post collected bundle to host for hypothesis building. */
function postBundleToHost() {
    if (typeof vscodeApi === 'undefined' || !vscodeApi) return;
    if (typeof allLines === 'undefined' || !allLines.length) {
        updateSignalsBadge(0);
        var host = document.getElementById('root-cause-hypotheses');
        if (host) host.innerHTML = '';
        if (typeof hideSignalsPanel === 'function') hideSignalsPanel();
        return;
    }
    var bundle = collectRootCauseHintBundleEmbedded();
    rchCachedBundle = bundle;
    vscodeApi.postMessage({ type: 'rootCauseBundle', bundle: bundle });
}

/** Called when the host responds with hypothesis results. */
function handleRootCauseHypothesesResult(hypotheses) {
    rchCachedHypotheses = Array.isArray(hypotheses) ? hypotheses : [];
    renderRootCauseHypothesesFromCache();
}

function renderRootCauseHypothesesFromCache() {
    var host = document.getElementById('root-cause-hypotheses');
    if (!host) return;
    var hy = rchCachedHypotheses;
    if (!hy || !hy.length) {
        updateSignalsBadge(0);
        host.innerHTML = '';
        if (typeof hideSignalsPanel === 'function') hideSignalsPanel();
        return;
    }
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
        var hi, item, li, confNorm, confTip, confEmoji;
        for (hi = 0; hi < visible.length; hi++) {
            item = visible[hi];
            li = '<li>';
            if (item.confidence) {
                confNorm = String(item.confidence).toLowerCase();
                if (confNorm === 'high') {
                    confEmoji = '\\uD83D\\uDD34';
                    confTip = rchStr('confTooltipHigh', 'Strong signal: crash, fatal error, or confirmed critical issue.');
                } else if (confNorm === 'medium') {
                    confEmoji = '\\uD83D\\uDFE1';
                    confTip = rchStr('confTooltipMedium', 'Stronger hint: tied to a concrete log line or a higher-certainty DB pattern. Still a heuristic, not proof.');
                } else {
                    confEmoji = '\\u26AA';
                    confTip = rchStr('confTooltipLow', 'Weaker hint: from volume or patterns only; may be normal traffic or noise. Use as a lead.');
                }
                /* No trailing space — flex gap handles spacing between children */
                li += '<span class="root-cause-hyp-conf root-cause-hyp-conf--' + escapeHtml(confNorm) + '" role="img" aria-label="' + escapeHtml(confTip) + '" title="' + escapeHtml(confTip) + '">' + confEmoji + '</span>';
            }
            li += '<button type="button" class="rch-hyp-text rch-report-btn" data-rch-key="' + escapeHtml(item.hypothesisKey) + '" title="Open signal report">' + escapeHtml(item.text) + '</button>';
            li += '<button type="button" class="rch-dismiss-btn" data-rch-dismiss="' + escapeHtml(item.hypothesisKey) + '" aria-label="Dismiss signal" title="Dismiss signal"><span class="codicon codicon-close"></span></button>';
            li += '</li>';
            parts.push(li);
        }
        parts.push('</ul>');
    }
    if (dismissedCount > 0) {
        parts.push('<button type="button" class="rch-restore-btn" data-rch-restore="1">' + dismissedCount + ' dismissed \\u2014 restore all</button>');
    }
    host.innerHTML = parts.join('');
}

function scheduleRootCauseHypothesesRefresh() {
    if (rootCauseHypothesesRaf) return;
    rootCauseHypothesesRaf = requestAnimationFrame(function() {
        rootCauseHypothesesRaf = null;
        postBundleToHost();
    });
}

function resetRootCauseHypothesesSession() {
    rchDismissedKeys = Object.create(null);
    rchCachedHypotheses = [];
    rchCachedBundle = null;
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
        var reportBtn = t && t.closest ? t.closest('.rch-report-btn') : null;
        if (reportBtn && reportBtn.dataset && reportBtn.dataset.rchKey) {
            ev.preventDefault();
            if (typeof vscodeApi !== 'undefined' && vscodeApi) {
                vscodeApi.postMessage({ type: 'openSignalReport', hypothesisKey: reportBtn.dataset.rchKey });
            }
            return;
        }
        var dismissBtn = t && t.closest ? t.closest('.rch-dismiss-btn') : null;
        if (dismissBtn && dismissBtn.dataset && dismissBtn.dataset.rchDismiss) {
            ev.preventDefault();
            rchDismissedKeys[dismissBtn.dataset.rchDismiss] = true;
            renderRootCauseHypothesesFromCache();
            showRchToast(host, 'Signal hidden for this session');
            return;
        }
        var restoreBtn = t && t.closest ? t.closest('.rch-restore-btn') : null;
        if (restoreBtn) {
            ev.preventDefault();
            rchDismissedKeys = Object.create(null);
            renderRootCauseHypothesesFromCache();
            return;
        }
    });
}

initRootCauseHypothesesUi();
`);
}
//# sourceMappingURL=viewer-root-cause-hints-script.js.map