/**
 * Trouble Mode — zero-context triage filter for the log viewer.
 *
 * Trouble Mode strips every nominal line and shows only what is wrong: error,
 * warning, and performance lines (plus markers, which are never filtered). It is
 * an ORTHOGONAL filter with its own `troubleFiltered` flag rather than a
 * level-filter preset, so it composes with — and never destroys — the user's
 * existing level selection, and it enforces true zero-context (no +/-N context
 * lines, unlike the level filter's context window).
 *
 * Toggled by the toolbar button (`#toolbar-trouble-btn`, next to the filter icon)
 * or the `saropaLogCapture.troubleMode.toggle` command (host posts
 * `triggerToggleTroubleMode`), and persisted per-webview via `setState` so the
 * mode survives a webview reload. The button's active style + the dimmed level
 * dots (body class `slc-trouble-active`) show the state.
 *
 * `calcTroubleFiltered(level)` is the single classification helper. It is called
 * both here (applyTroubleFilter over allLines) AND at line birth
 * (computeLineBirthHeight in viewer-data-add-line-birth.ts) so a line arriving
 * while Trouble Mode is active is born hidden instead of flashing visible until
 * the next recalc — the same birth-height contract every other filter honors.
 */

/** Embedded webview JavaScript for the Trouble Mode zero-context filter. */
export function getTroubleModeScript(): string {
    return /* javascript */ `
/* Levels that survive Trouble Mode. 'database' and 'todo' are deliberately
   excluded: Drift SQL volume in particular would drown the feed the mode exists
   to clean. Signals/Crashlytics rows arrive as markers, which are never filtered. */
var TROUBLE_LEVELS = { error: 1, warning: 1, performance: 1 };
var troubleModeActive = false;

/* Read-only classifier shared with computeLineBirthHeight. Returns true when a
   line of this level must hide under Trouble Mode; falsy whenever the mode is off
   so the flag never suppresses a line outside the mode. */
function calcTroubleFiltered(level) {
    return troubleModeActive && !TROUBLE_LEVELS[level];
}

/* Re-mark every existing line for the current mode state. Markers are never
   filtered (architecture contract): db-signal / run-separator markers are
   themselves trouble indicators and must stay visible. recalcAndRender preserves
   the scroll anchor; the raw pair is only a fallback if it is unavailable. */
function applyTroubleFilter() {
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') { item.troubleFiltered = false; continue; }
        item.troubleFiltered = troubleModeActive && !TROUBLE_LEVELS[item.level];
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else if (typeof recalcHeights === 'function') { recalcHeights(); renderViewport(true); }
}

/* Persist across webview reload the same way the icon bar and search history do. */
function saveTroubleModeState() {
    if (typeof vscodeApi === 'undefined') return;
    var st = vscodeApi.getState() || {};
    st.troubleModeActive = troubleModeActive;
    vscodeApi.setState(st);
}

/* Reflect the mode everywhere the user reads state: the toolbar button's active
   style + aria-pressed (on/off), and a body class the level dots key off to dim
   the levels being hidden — so silent filtering never reads as "the viewer broke".
   Guarded for DOM-less contexts (the VM test harness) so the classifier logic
   stays unit-testable without a document. */
function applyTroubleModeIndicator() {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('slc-trouble-active', troubleModeActive);
    var btn = document.getElementById('toolbar-trouble-btn');
    if (btn) {
        btn.classList.toggle('toolbar-icon-btn-active', troubleModeActive);
        btn.setAttribute('aria-pressed', troubleModeActive ? 'true' : 'false');
    }
}

function toggleTroubleMode() {
    troubleModeActive = !troubleModeActive;
    applyTroubleModeIndicator();
    applyTroubleFilter();
    saveTroubleModeState();
}

/* Restore the persisted flag at load. Do NOT call applyTroubleFilter here: at
   script-load time allLines is empty (content arrives later via addLines) and
   recalcAndRender may not be defined yet. Streaming/loaded lines are born hidden
   through computeLineBirthHeight because troubleModeActive is already true. */
function restoreTroubleModeState() {
    if (typeof vscodeApi === 'undefined') return;
    var st = vscodeApi.getState();
    if (st && st.troubleModeActive === true) {
        troubleModeActive = true;
        applyTroubleModeIndicator();
    }
}

(function() {
    if (typeof document === 'undefined') return;
    var btn = document.getElementById('toolbar-trouble-btn');
    if (btn) btn.addEventListener('click', function(e) { e.stopPropagation(); toggleTroubleMode(); });
    restoreTroubleModeState();
})();
`;
}
