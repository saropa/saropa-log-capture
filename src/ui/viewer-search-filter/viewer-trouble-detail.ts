/**
 * Trouble Mode detail pane (plan Trouble Mode dashboard, Stage 4) — webview side.
 *
 * Owns three things in the page: turning a feed-row selection into an
 * `openTroubleDetail` request to the host (openTroubleDetailForItem, called from
 * the viewport click handler while Trouble Mode is active), rendering the host's
 * `troubleDetailReady` reply into the #trouble-detail overlay (renderTroubleDetail),
 * and closing it (close button + Escape). The pane overlays only the feed, so the
 * severity chart and toolbar stay visible while it is open.
 *
 * The host builds the HTML (trouble-detail-handler.ts) so the signal-report
 * builders can be reused there; this script never classifies or reads the log.
 */

/** Embedded webview JavaScript for the Trouble Mode detail pane. */
export function getTroubleDetailScript(): string {
    return /* javascript */ `
/* Ask the host to build the detail for a selected feed row. Sends the file line
   number (sourceLineNo — a hint the host verifies), the plain text, and the level
   so the host can locate the line and reuse the signal-report builders. */
/* The issue currently shown in the pane, so Copy Report (Stage 6) can rebuild the
   host payload for the same line without a re-selection. */
var troubleDetailLast = null;

function openTroubleDetailForItem(item) {
    if (!item || typeof vscodeApi === 'undefined') { return; }
    var plain = (typeof stripTags === 'function') ? stripTags(item.html || '') : (item.rawText || '');
    troubleDetailLast = { sourceLineNo: item.sourceLineNo || 0, plainText: plain, level: item.level || 'info' };
    vscodeApi.postMessage({ type: 'openTroubleDetail', sourceLineNo: troubleDetailLast.sourceLineNo, plainText: plain, level: troubleDetailLast.level });
}

/* Copy a Markdown report for the shown issue (host builds + writes the clipboard). */
function copyTroubleReport() {
    if (!troubleDetailLast || typeof vscodeApi === 'undefined') { return; }
    vscodeApi.postMessage({
        type: 'copyTroubleReport',
        sourceLineNo: troubleDetailLast.sourceLineNo,
        plainText: troubleDetailLast.plainText,
        level: troubleDetailLast.level,
    });
}

/* Render the host reply into the overlay and reveal it. Title is set as text (not
   HTML) so a fault line containing angle brackets can never inject markup. */
function renderTroubleDetail(msg) {
    if (typeof document === 'undefined') { return; }
    var el = document.getElementById('trouble-detail');
    if (!el) { return; }
    var titleEl = document.getElementById('trouble-detail-title');
    var bodyEl = document.getElementById('trouble-detail-body');
    if (titleEl) { titleEl.textContent = (msg && msg.title) || ''; }
    if (bodyEl) { bodyEl.innerHTML = (msg && msg.html) || ''; }
    el.classList.remove('u-hidden');
    /* Move focus into the pane (it carries tabindex="-1") so a fresh open + Escape
       closes it — the keydown listener below only fires when focus is inside. */
    if (typeof el.focus === 'function') { el.focus(); }
}

function closeTroubleDetail() {
    if (typeof document === 'undefined') { return; }
    var el = document.getElementById('trouble-detail');
    if (el) { el.classList.add('u-hidden'); }
}

(function() {
    if (typeof document === 'undefined') { return; }
    var closeBtn = document.getElementById('trouble-detail-close');
    if (closeBtn) { closeBtn.addEventListener('click', function() { closeTroubleDetail(); }); }
    var copyBtn = document.getElementById('trouble-detail-copy');
    if (copyBtn) { copyBtn.addEventListener('click', function() { copyTroubleReport(); }); }
    /* Escape closes the pane. renderTroubleDetail focuses the pane on open (it has
       tabindex="-1"), so this fires from a fresh open, not only after a manual tab-in. */
    var el = document.getElementById('trouble-detail');
    if (el) {
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { e.stopPropagation(); closeTroubleDetail(); }
        });
    }
})();
`;
}
