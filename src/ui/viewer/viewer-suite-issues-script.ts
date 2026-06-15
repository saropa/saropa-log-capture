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

/* Handle the host's suiteIssues reply: badge the Integrations icon (issues + suggestions) and fill
   both the suggestions and issues containers in the Integrations screen. */
function handleSuiteIssuesMessage(msg) {
    if (!msg || msg.type !== 'suiteIssues') return false;
    if (typeof updateIconBadge === 'function') {
        updateIconBadge('ib-integrations-badge', 'ib-integrations-count', msg.count || 0);
    }
    var suggestions = document.getElementById('integrations-suite-suggestions');
    if (suggestions) { suggestions.innerHTML = msg.suggestionsHtml || ''; }
    var issues = document.getElementById('integrations-suite-issues');
    if (issues) { issues.innerHTML = msg.issuesHtml || ''; }
    return true;
}

/* Enable a suggested integration in place: check its existing integration checkbox and fire the
   change event so the established setIntegrationsAdapters flow persists it, then refresh so the
   now-enabled suggestion drops off the list. Delegated so it works on host-injected rows. */
document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest ? e.target.closest('.suite-suggest-enable') : null;
    if (!btn) return;
    var adapterId = btn.getAttribute('data-adapter-id');
    if (!adapterId) return;
    var checkbox = document.getElementById('int-' + adapterId);
    if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof window.requestSuiteIssues === 'function') window.requestSuiteIssues();
});

/* Initial fetch so the badge reflects companion issues before the user opens anything. */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.requestSuiteIssues(); });
} else {
    window.requestSuiteIssues();
}
`;
}
