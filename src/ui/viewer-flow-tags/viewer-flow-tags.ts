/**
 * Flow-tag chips for the log viewer (plan 109).
 *
 * An instrumented app emits one `[flowmap] …` line per surface entered, action
 * taken, and failure (see plans/guides/flowmap-tag-navigation.md). Raw, those
 * lines are long and repetitive and drown the feed. This module strips the raw
 * tag text and renders each `[flowmap]` line as a compact, verb-colored chip at
 * its own timestamp, so the flow moments stand out instead of hiding.
 *
 * Three display modes, cycled by the toolbar button (`#toolbar-flowtags-btn`):
 *   - 'chips'  (default): tag lines render as chips.
 *   - 'raw':             tag lines render as ordinary text (today's behavior).
 *   - 'hidden':          tag lines are filtered out (a real height filter).
 *
 * `classifyFlowTag(plain)` mirrors the host-side parser in
 * flow-map-breadcrumbs.ts / flow-map-issues.ts. It is called at line birth
 * (viewer-data-add.ts) to stamp `item.flowTag`, and `calcFlowFiltered(flowTag)`
 * is called both here (applyFlowFilter over allLines) AND at line birth
 * (computeLineBirthHeight) so a line arriving while mode='hidden' is born hidden
 * instead of flashing visible — the same birth-height contract every filter honors.
 *
 * The mode is persisted per-webview via `setState`, like Trouble Mode, so it
 * survives a reload. All names are prefixed `flow…` because the ~89 viewer
 * scripts share ONE page scope with no module system (last definition wins).
 */

/** Embedded webview JavaScript for the flow-tag chips + display-mode toggle. */
export function getFlowTagsScript(): string {
    return /* javascript */ `
/* Current display mode. 'chips' is the default — the whole point is readability;
   a user debugging the instrumentation itself flips to 'raw'. */
var flowTagMode = 'chips';
var FLOW_MODE_CYCLE = { chips: 'raw', raw: 'hidden', hidden: 'chips' };

/* Per-verb chip presentation. --flow-c (the CSS custom property) carries the
   verb color so the chip CSS stays DRY (one .flow-chip rule reads the variable).
   Glyphs are literal characters, not images, so they scale with the log font. */
var FLOW_CHIP_META = {
    enter:   { glyph: '\\u2192' },  /* → forward */
    back:    { glyph: '\\u21A9' },  /* ↩ return */
    exit:    { glyph: '\\u2715' },  /* ✕ dismissed */
    action:  { glyph: '\\uFF0B' },  /* ＋ activity */
    handoff: { glyph: '\\u2197' },  /* ↗ off-app */
    error:   { glyph: '\\uD83D\\uDCA5' },  /* 💥 failure */
};

/* Verb parsers, mirroring the host regexes (flow-map-breadcrumbs.ts / -issues.ts).
   Same linear, non-backtracking shape (no nested quantifiers) so they are ReDoS-safe. */
var FLOW_ENTER_RE = /\\[flowmap\\]\\s+enter\\s+(screen|tab|dialog|sheet|inline)\\s+"([^"]+)"(?:\\s+(back))?(?:\\s+(\\S+\\.dart):(\\d+))?/i;
var FLOW_BACK_RE = /\\[flowmap\\]\\s+back\\s+(screen|tab|dialog|sheet|inline)\\s+"([^"]+)"(?:\\s+(\\S+\\.dart):(\\d+))?/i;
var FLOW_EXIT_RE = /\\[flowmap\\]\\s+exit\\s+(screen|tab|dialog|sheet|inline)\\s+"([^"]+)"/i;
var FLOW_HANDOFF_RE = /\\[flowmap\\]\\s+handoff\\s+(api|app)\\s+"([^"]+)"(?:\\s+(\\S+\\.dart):(\\d+))?/i;
var FLOW_ACTION_RE = /\\[flowmap\\]\\s+action\\s+"([^"]+)"(?:\\s+(\\S+\\.dart):(\\d+))?/i;
var FLOW_ERROR_RE = /\\[flowmap\\]\\s+error\\s+"([^"]+)"(?:\\s+(\\S+\\.dart):(\\d+))?/i;

/* Build the optional source anchor { file, line } a chip tooltip shows. */
function flowSrc(file, line) {
    return file ? { file: String(file).replace(/^\\.\\//, ''), line: parseInt(line || '', 10) } : null;
}

/* Classify a plain log line into a flow tag, or null. Returns { verb, kind, name,
   source }. An enter carrying the trailing 'back' keyword is reported as verb
   'back' so the chip reads as a return (the host does the same for the edge). */
function classifyFlowTag(text) {
    if (!text || text.indexOf('[flowmap]') === -1) return null;
    var m;
    if ((m = FLOW_ENTER_RE.exec(text))) {
        return { verb: m[3] ? 'back' : 'enter', kind: m[1].toLowerCase(), name: m[2], source: flowSrc(m[4], m[5]) };
    }
    if ((m = FLOW_BACK_RE.exec(text))) return { verb: 'back', kind: m[1].toLowerCase(), name: m[2], source: flowSrc(m[3], m[4]) };
    if ((m = FLOW_EXIT_RE.exec(text))) return { verb: 'exit', kind: m[1].toLowerCase(), name: m[2], source: null };
    if ((m = FLOW_HANDOFF_RE.exec(text))) return { verb: 'handoff', kind: m[1].toLowerCase(), name: m[2], source: flowSrc(m[3], m[4]) };
    if ((m = FLOW_ACTION_RE.exec(text))) return { verb: 'action', kind: 'action', name: m[1], source: flowSrc(m[2], m[3]) };
    if ((m = FLOW_ERROR_RE.exec(text))) return { verb: 'error', kind: 'error', name: m[1], source: flowSrc(m[2], m[3]) };
    return null;
}

/* Minimal HTML escaper — chip text + tooltip are attacker-controlled log content. */
function flowEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Render one flow tag as a chip. The tooltip carries the plain-language meaning
   (localized), the surface kind, and the source anchor — everything the stripped
   raw line held, reachable on hover. */
function renderFlowChip(flow) {
    if (!flow) return '';
    var meta = FLOW_CHIP_META[flow.verb] || FLOW_CHIP_META.enter;
    var meaningKey = 'viewer.flow.chip.' + flow.verb;
    var meaning = (typeof vt === 'function') ? vt(meaningKey) : flow.verb;
    var kindTip = (flow.kind && flow.kind !== 'action' && flow.kind !== 'error') ? (' (' + flow.kind + ')') : '';
    var srcTip = (flow.source && flow.source.file) ? (' \\u00b7 ' + flow.source.file + ':' + flow.source.line) : '';
    var tip = flowEsc(meaning + kindTip + srcTip);
    var body = meta.glyph + ' ' + flowEsc(flow.name);
    return '<span class="flow-chip flow-chip-' + flow.verb + '" title="' + tip + '">' + body + '</span>';
}

/* Render-time swap called from renderItem: in 'chips' mode a classified [flowmap]
   line's raw html is replaced by its chip; 'raw' returns html untouched ('hidden'
   never renders — calcItemHeight zeroes it). Kept here so renderItem gains one line. */
function flowChipSwap(item, html) {
    return (item.flowTag && flowTagMode === 'chips') ? renderFlowChip(item.flowTag) : html;
}

/* Read-only classifier shared with computeLineBirthHeight. Only the 'hidden' mode
   filters; falsy for chips/raw so the flag never suppresses a line outside hidden. */
function calcFlowFiltered(flowTag) {
    return flowTagMode === 'hidden' && !!flowTag;
}

/* Re-mark every existing line for the current mode. Markers are never filtered
   (architecture contract). recalcAndRender preserves the scroll anchor; the raw
   pair is only a fallback when it is unavailable. Called for every mode change:
   chips↔raw leaves heights unchanged (the render swaps chip vs text), to/from
   hidden changes visibility — recalcAndRender covers both correctly. */
function applyFlowFilter() {
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') { item.flowFiltered = false; continue; }
        item.flowFiltered = flowTagMode === 'hidden' && !!item.flowTag;
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else if (typeof recalcHeights === 'function') { recalcHeights(); renderViewport(true); }
}

/* Reflect the mode on the toolbar button: data-flow-mode drives any state styling,
   the title/aria-label name the current mode + next action, and the active class
   marks 'hidden' (the only state that actually filters). Guarded for the DOM-less
   VM test harness so the classifier logic stays unit-testable without a document. */
function applyFlowModeIndicator() {
    if (typeof document === 'undefined') return;
    var btn = document.getElementById('toolbar-flowtags-btn');
    if (!btn) return;
    btn.setAttribute('data-flow-mode', flowTagMode);
    var modeTipKey = 'viewer.flow.mode.' + flowTagMode;
    var tip = (typeof vt === 'function') ? vt(modeTipKey) : flowTagMode;
    btn.setAttribute('title', tip);
    btn.setAttribute('aria-label', tip);
    btn.classList.toggle('toolbar-icon-btn-active', flowTagMode === 'hidden');
}

/* Persist across webview reload the same way Trouble Mode and the icon bar do. */
function saveFlowTagState() {
    if (typeof vscodeApi === 'undefined') return;
    var st = vscodeApi.getState() || {};
    st.flowTagMode = flowTagMode;
    vscodeApi.setState(st);
}

function setFlowTagMode(mode) {
    if (flowTagMode === mode || !FLOW_MODE_CYCLE[mode]) return;
    flowTagMode = mode;
    applyFlowModeIndicator();
    applyFlowFilter();
    saveFlowTagState();
}

/* Toolbar click: chips → raw → hidden → chips. */
function cycleFlowTagMode() {
    setFlowTagMode(FLOW_MODE_CYCLE[flowTagMode] || 'chips');
}

/* Restore the persisted mode at load. Do NOT call applyFlowFilter here: at
   script-load time allLines is empty (content arrives later) and recalcAndRender
   may be undefined. Streaming/loaded lines are born correctly because flowTagMode
   is already restored and computeLineBirthHeight reads calcFlowFiltered. */
function restoreFlowTagState() {
    if (typeof vscodeApi === 'undefined') return;
    var st = vscodeApi.getState();
    if (st && st.flowTagMode && FLOW_MODE_CYCLE[st.flowTagMode]) {
        flowTagMode = st.flowTagMode;
        applyFlowModeIndicator();
    }
}

(function() {
    if (typeof document === 'undefined') return;
    var btn = document.getElementById('toolbar-flowtags-btn');
    if (btn) btn.addEventListener('click', function(e) { e.stopPropagation(); cycleFlowTagMode(); });
    restoreFlowTagState();
})();
`;
}
