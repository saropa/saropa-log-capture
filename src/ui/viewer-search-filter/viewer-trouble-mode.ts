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
 * Toggled by the `saropaLogCapture.troubleMode.toggle` command (host posts
 * `triggerToggleTroubleMode`) or by clicking the footer chip, and persisted
 * per-webview via `setState` so the mode survives a webview reload.
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

/* Body class + footer chip so the user always knows why most lines vanished —
   silent filtering that hides 90% of the log reads as "the viewer broke". */
function applyTroubleModeIndicator() {
    document.body.classList.toggle('slc-trouble-active', troubleModeActive);
    var chip = document.getElementById('trouble-mode-indicator');
    if (chip) chip.classList.toggle('u-hidden', !troubleModeActive);
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
    var chip = document.getElementById('trouble-mode-indicator');
    if (chip) chip.addEventListener('click', function() { toggleTroubleMode(); });
    restoreTroubleModeState();
})();
`;
}
