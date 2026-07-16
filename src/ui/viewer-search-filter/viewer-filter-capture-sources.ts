/**
 * Client-side rendering for the "Capture sources" block in the Filters panel Log Sources tab.
 *
 * The host pushes a `captureSources` message ({ sources: [{ id, label, on }] }) at viewer load
 * and on integration-settings changes. This is a READ-ONLY status list: it shows which
 * log-streaming integrations are feeding the log (adb logcat, terminal, browser, external logs,
 * database), NOT a second set of toggles — capture on/off stays in Options → Integrations so
 * there is one source of truth. Clicking a row opens that Options screen.
 *
 * Rows are built with textContent (not innerHTML) so a label can never inject markup, even though
 * today's labels are trusted English constants.
 */
export function getCaptureSourcesScript(): string {
    return /* javascript */ `
/** Render the read-only capture-source rows from a host 'captureSources' message. */
function renderCaptureSources(sources) {
    var block = document.getElementById('capture-sources-block');
    var list = document.getElementById('capture-sources-list');
    if (!block || !list) return;
    if (!Array.isArray(sources) || sources.length === 0) {
        block.style.display = 'none';
        return;
    }
    while (list.firstChild) list.removeChild(list.firstChild);
    for (var i = 0; i < sources.length; i++) {
        var s = sources[i];
        if (!s || typeof s.id !== 'string') continue;
        list.appendChild(buildCaptureSourceRow(s));
    }
    block.style.display = '';
}

/** Build one capture-source row: an on/off dot, the label, and a state word. */
function buildCaptureSourceRow(s) {
    var on = s.on === true;
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'capture-source-row' + (on ? ' capture-source-on' : ' capture-source-off');
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

    var state = document.createElement('span');
    state.className = 'capture-source-state';
    /* vt() falls back to the key if missing; keys resolve to 'On' / 'Off'. */
    state.textContent = (typeof vt === 'function')
        ? vt(on ? 'viewer.drawer.captureSources.on' : 'viewer.drawer.captureSources.off')
        : (on ? 'On' : 'Off');
    row.appendChild(state);
    return row;
}

/** Open Options -> Integrations so the user can toggle the source (single source of truth). */
function openCaptureSourceOptions() {
    if (typeof openOptionsPanel === 'function') openOptionsPanel();
    if (typeof openIntegrationsView === 'function') openIntegrationsView();
}
`;
}
