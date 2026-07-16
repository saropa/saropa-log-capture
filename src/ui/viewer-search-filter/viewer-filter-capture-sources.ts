/**
 * Client-side rendering for the "Capture sources" block in the Filters panel Log Sources tab.
 *
 * The host pushes a `captureSources` message ({ sources: [{ id, label, state, detail? }] }) at
 * viewer load, on integration-settings changes, and on debug-session start/stop. This is a
 * READ-ONLY status list: it shows which log-streaming integrations are feeding the log (adb logcat,
 * terminal, browser, external logs, database), NOT a second set of toggles — capture on/off stays
 * in Options → Integrations so there is one source of truth. Clicking a row opens that Options screen.
 *
 * `state` is one of: 'streaming' (active session, producing — adb has a device), 'idle' (enabled but
 * nothing to stream — adb enabled, no device), 'on' (configured on, no active session), 'off'. The
 * dot is green for streaming/on, amber for idle, gray for off.
 *
 * Rows are built with textContent (not innerHTML) so a label or device serial can never inject
 * markup, even though today's labels are trusted constants.
 */
export function getCaptureSourcesScript(): string {
    return /* javascript */ `
/* Last payload rendered, as JSON — skip a re-render when an unrelated integrations.* change
   produces an identical source list (the host pushes on any integration setting change). */
var _lastCaptureSourcesJson = null;

/** Render the read-only capture-source rows from a host 'captureSources' message. */
function renderCaptureSources(sources) {
    var block = document.getElementById('capture-sources-block');
    var list = document.getElementById('capture-sources-list');
    if (!block || !list) return;
    if (!Array.isArray(sources) || sources.length === 0) {
        block.style.display = 'none';
        _lastCaptureSourcesJson = null;
        return;
    }
    var json = JSON.stringify(sources);
    if (json === _lastCaptureSourcesJson) return;
    _lastCaptureSourcesJson = json;
    while (list.firstChild) list.removeChild(list.firstChild);
    for (var i = 0; i < sources.length; i++) {
        var s = sources[i];
        if (!s || typeof s.id !== 'string') continue;
        list.appendChild(buildCaptureSourceRow(s));
    }
    block.style.display = '';
}

/** Map a source state to its dot CSS class (green / amber / gray). */
function captureSourceDotClass(state) {
    if (state === 'streaming' || state === 'on') return 'capture-source-on';
    if (state === 'idle') return 'capture-source-idle';
    return 'capture-source-off';
}

/** Localized state word for a source; vt() falls back to the key, then to plain English. */
function captureSourceStateWord(state) {
    var key = 'viewer.drawer.captureSources.' + state;
    if (typeof vt === 'function') {
        var w = vt(key);
        if (w && w !== key) return w;
    }
    return state.charAt(0).toUpperCase() + state.slice(1);
}

/** Build one capture-source row: an on/off/idle dot, the label, and the state word (+ detail). */
function buildCaptureSourceRow(s) {
    var state = typeof s.state === 'string' ? s.state : (s.on ? 'on' : 'off');
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'capture-source-row ' + captureSourceDotClass(state);
    row.setAttribute('data-source-id', s.id);
    /* Clicking any row opens Options -> Integrations, where capture is actually toggled. */
    row.addEventListener('click', openCaptureSourceOptions);

    var dot = document.createElement('span');
    dot.className = 'capture-source-dot';
    row.appendChild(dot);

    var label = document.createElement('span');
    label.className = 'capture-source-label';
    label.textContent = typeof s.label === 'string' ? s.label : s.id;
    row.appendChild(label);

    var stateEl = document.createElement('span');
    stateEl.className = 'capture-source-state';
    /* Detail (e.g. an attached device serial) rides after the state word: "Streaming · Pixel_7". */
    var word = captureSourceStateWord(state);
    stateEl.textContent = (typeof s.detail === 'string' && s.detail) ? (word + ' · ' + s.detail) : word;
    row.appendChild(stateEl);
    return row;
}

/** Open Options -> Integrations so the user can toggle the source (single source of truth). */
function openCaptureSourceOptions() {
    if (typeof openOptionsPanel === 'function') openOptionsPanel();
    if (typeof openIntegrationsView === 'function') openIntegrationsView();
}
`;
}
