/**
 * Webview side of the suite Integrations badge + issues list.
 *
 * Asks the host for the companion tools' issues (count + a pre-rendered block), sets the icon-bar
 * badge on the Integrations icon to the count, and fills the Integrations screen's issues container.
 * The host builds the HTML with every dynamic value escaped, so injecting it via innerHTML is safe
 * (same pattern as the other host-rendered panels).
 */
export function getSuiteIssuesScript(): string {
    return /* javascript */ `
/* Ask the host for the latest companion-tool issues. Safe to call any time (best-effort). */
window.requestSuiteIssues = function() {
    if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
        vscodeApi.postMessage({ type: 'requestSuiteIssues' });
    }
};

/* Handle the host's suiteIssues reply: badge the Integrations icon and fill the issues container. */
function handleSuiteIssuesMessage(msg) {
    if (!msg || msg.type !== 'suiteIssues') return false;
    if (typeof updateIconBadge === 'function') {
        updateIconBadge('ib-integrations-badge', 'ib-integrations-count', msg.count || 0);
    }
    var container = document.getElementById('integrations-suite-issues');
    if (container) { container.innerHTML = msg.html || ''; }
    return true;
}

/* Initial fetch so the badge reflects companion issues before the user opens anything. */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.requestSuiteIssues(); });
} else {
    window.requestSuiteIssues();
}
`;
}
