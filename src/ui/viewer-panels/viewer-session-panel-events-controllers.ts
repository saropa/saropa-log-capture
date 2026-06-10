/**
 * Event handlers for the Controller-rooted tree: controller-block collapse and the "+N older"
 * Latest-only expand badge. Returns a JS fragment that runs inside the session panel IIFE so it
 * shares `sessionListEl`, `sessionDisplayOptions`, `collapsedControllers`, `expandedOlderNames`,
 * `cachedSessions`, `renderSessionList`, and `vscodeApi`.
 *
 * A separate capture-phase listener from the session-group chevron handler so each resolves its
 * own target independently; both return early when the click is elsewhere, so registration order
 * does not matter. Extracted to keep viewer-session-panel-events.ts under the 300-line limit.
 * See [plans/history/2026.06/2026.06.09/controller-rooted-session-tree.md].
 */

export function getControllerEventsScript(): string {
    return /* javascript */ `
    if (sessionListEl) {
        sessionListEl.addEventListener('click', function(e) {
            /* "+N older" badge: reveal/hide the older same-name logs Latest-only would otherwise
               hide entirely. Checked before the controller chevron because the badge can sit on a
               controller header row, and a chevron-first match would swallow the click. */
            var olderTog = e.target.closest('.session-older-toggle');
            if (olderTog) {
                var nm = olderTog.getAttribute('data-older-name') || '';
                if (!nm) return;
                e.preventDefault();
                e.stopPropagation();
                expandedOlderNames[nm] = !expandedOlderNames[nm];
                if (!expandedOlderNames[nm]) delete expandedOlderNames[nm];
                if (cachedSessions) renderSessionList(cachedSessions);
                return;
            }
            /* Controller block collapse. Distinct class + map from .session-group so a peripheral
               that is itself a real session-group nested in the children container keeps its own
               independent chevron. Persisted through setSessionDisplayOptions like collapsedGroups. */
            var cCtl = e.target.closest('.session-controller-chevron');
            if (!cCtl) return;
            var ctlBlock = cCtl.closest('.session-controller-group');
            if (!ctlBlock) return;
            var ckey = ctlBlock.getAttribute('data-controller-key');
            if (!ckey) return;
            e.preventDefault();
            e.stopPropagation();
            collapsedControllers[ckey] = !collapsedControllers[ckey];
            if (!collapsedControllers[ckey]) delete collapsedControllers[ckey];
            var ctlOpts = {};
            for (var cck in sessionDisplayOptions) ctlOpts[cck] = sessionDisplayOptions[cck];
            ctlOpts.collapsedControllers = collapsedControllers;
            sessionDisplayOptions = ctlOpts;
            vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
            if (cachedSessions) renderSessionList(cachedSessions);
        }, true);
    }
    `;
}
