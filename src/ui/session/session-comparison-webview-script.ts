/**
 * Session comparison webview — embedded script (string returned into `<script nonce=…>`)
 *
 * Runs inside the isolated webview context. Posts structured messages to the extension (`toggleSync`,
 * `openLogAtDriftFingerprint`, baseline A/B/clear, optional Drift Advisor). Scroll sync mirrors
 * relative scroll positions between panes with a short lock to avoid feedback loops.
 *
 * **Robustness:** Scroll handlers and `syncState` guard missing DOM nodes so a partial document or
 * host reload does not throw. Drift Advisor branch is gated by a boolean interpolated at compile time
 * so the button is inert when the extension is not installed.
 */

export function getSessionComparisonWebviewScript(
    syncScrolling: boolean,
    driftInstalled: boolean,
    syncLabels: { syncTemplate: string; on: string; off: string },
): string {
    const driftJs = driftInstalled ? 'true' : 'false';
    return /* javascript */ `
const vscodeApi = acquireVsCodeApi();
let syncEnabled = ${syncScrolling};
// Localized sync-toggle label parts, injected so the client re-localizes the button on toggle
// instead of concatenating English fragments. The {0} slot takes the ON/OFF state word, so word
// order stays translatable (e.g. a locale can render the state before the label).
const SYNC_TEMPLATE = ${JSON.stringify(syncLabels.syncTemplate)};
const SYNC_ON = ${JSON.stringify(syncLabels.on)};
const SYNC_OFF = ${JSON.stringify(syncLabels.off)};
let scrolling = false;

function toggleSync() {
    vscodeApi.postMessage({ type: 'toggleSync' });
}

function onScrollA() {
    if (!syncEnabled || scrolling) return;
    scrolling = true;
    const paneA = document.getElementById('pane-a');
    const paneB = document.getElementById('pane-b');
    if (!paneA || !paneB) {
        scrolling = false;
        return;
    }
    const ratio = paneA.scrollTop / (paneA.scrollHeight - paneA.clientHeight || 1);
    paneB.scrollTop = ratio * (paneB.scrollHeight - paneB.clientHeight);
    setTimeout(() => { scrolling = false; }, 50);
}

function onScrollB() {
    if (!syncEnabled || scrolling) return;
    scrolling = true;
    const paneA = document.getElementById('pane-a');
    const paneB = document.getElementById('pane-b');
    if (!paneA || !paneB) {
        scrolling = false;
        return;
    }
    const ratio = paneB.scrollTop / (paneB.scrollHeight - paneB.clientHeight || 1);
    paneA.scrollTop = ratio * (paneA.scrollHeight - paneA.clientHeight);
    setTimeout(() => { scrolling = false; }, 50);
}

const syncBtn = document.getElementById('sync-btn');
const paneA = document.getElementById('pane-a');
const paneB = document.getElementById('pane-b');

if (syncBtn) syncBtn.addEventListener('click', toggleSync);
if (paneA) paneA.addEventListener('scroll', onScrollA);
if (paneB) paneB.addEventListener('scroll', onScrollB);

document.body.addEventListener('click', function(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var jump = t.closest('.db-jump');
    if (jump) {
        var fp = jump.getAttribute('data-fp') || '';
        try { fp = decodeURIComponent(fp); } catch (e) { return; }
        vscodeApi.postMessage({ type: 'openLogAtDriftFingerprint', side: jump.getAttribute('data-side'), fingerprint: fp });
        return;
    }
    var btn = t.closest('button');
    if (!btn) return;
    if (btn.id === 'btn-db-baseline-a') {
        vscodeApi.postMessage({ type: 'useDbBaselineA' });
        return;
    }
    if (btn.id === 'btn-db-baseline-b') {
        vscodeApi.postMessage({ type: 'useDbBaselineB' });
        return;
    }
    if (btn.id === 'btn-db-baseline-clear') {
        vscodeApi.postMessage({ type: 'clearDbBaseline' });
        return;
    }
    if (btn.id === 'btn-drift-advisor' && ${driftJs}) {
        vscodeApi.postMessage({ type: 'openDriftAdvisorPanel' });
    }
});

window.addEventListener('message', function(event) {
    const msg = event.data;
    if (msg.type === 'syncState') {
        syncEnabled = msg.enabled;
        const btn = document.getElementById('sync-btn');
        if (btn) {
            btn.textContent = SYNC_TEMPLATE.split('{0}').join(syncEnabled ? SYNC_ON : SYNC_OFF);
            btn.classList.toggle('active', syncEnabled);
        }
    }
});
`;
}
