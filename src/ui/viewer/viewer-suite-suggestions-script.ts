/**
 * Webview side of the suite Integrations badge + suggested-integrations block.
 *
 * Asks the host for the project-detected integration suggestions (count + a pre-rendered block),
 * sets the icon-bar badge on the Integrations icon to the count, and fills the Integrations
 * screen's suggestions container. The host builds the HTML with every dynamic value escaped, so
 * injecting it via innerHTML is safe (same pattern as the other host-rendered panels).
 *
 * Companion-tool diagnostics are deliberately NOT surfaced here: the Options screen is a
 * configuration surface (toggles), not a diagnostics feed (owner ruling 2026-07-09).
 */
export function getSuiteSuggestionsScript(): string {
    return /* javascript */ `
/* Ask the host for the latest integration suggestions. Safe to call any time (best-effort). */
window.requestSuiteSuggestions = function() {
    if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
        vscodeApi.postMessage({ type: 'requestSuiteSuggestions' });
    }
};

/* Handle the host's suiteSuggestions reply: badge the Integrations icon and fill the
   suggestions container in the Integrations screen. */
function handleSuiteSuggestionsMessage(msg) {
    if (!msg || msg.type !== 'suiteSuggestions') return false;
    if (typeof updateIconBadge === 'function') {
        updateIconBadge('ib-integrations-badge', 'ib-integrations-count', msg.count || 0);
    }
    var suggestions = document.getElementById('integrations-suite-suggestions');
    if (suggestions) { suggestions.innerHTML = msg.suggestionsHtml || ''; }
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
    if (typeof window.requestSuiteSuggestions === 'function') window.requestSuiteSuggestions();
});

/* Initial fetch so the badge reflects pending suggestions before the user opens anything. */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.requestSuiteSuggestions(); });
} else {
    window.requestSuiteSuggestions();
}
`;
}
