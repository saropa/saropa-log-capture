/**
 * Signal panel script part A: state, storage, accordion, panel open/close/setTab.
 * Concatenated by viewer-signal-panel-script.ts to stay under max-lines.
 */

/** Returns the first fragment of the Signal panel IIFE (vars, storage, accordion, panel API). */
export function getSignalScriptPartA(storageKey: string, scriptStringsJson: string): string {
    const storageKeyJson = JSON.stringify(storageKey);
    return /* js */ `
    var SIGNAL_STRINGS = ${scriptStringsJson};
    /* Fill {0}/{1}/{2} placeholders in a SIGNAL_STRINGS template. SIGNAL_STRINGS holds plain strings
       (the panel-standalone alternative to the global vt() map), so this is the panel's own positional
       substitution — keeps the row scripts on one localization mechanism instead of mixing in vt(). */
    function fillSignalString(tpl, a0, a1, a2) {
        var s = tpl;
        if (a0 !== undefined) { s = s.split('{0}').join(a0); }
        if (a1 !== undefined) { s = s.split('{1}').join(a1); }
        if (a2 !== undefined) { s = s.split('{2}').join(a2); }
        return s;
    }
    window.__signalPerfIdPrefix = 'signal-';
    var signalPanel = document.getElementById('signal-panel');
    var heroBlock = document.getElementById('signal-hero-block');
    var sectionSessionDetails = document.getElementById('signal-section-session-details');
    var sectionThisLog = document.getElementById('signal-section-this-log');
    var signalPanelOpen = false;
    var hasLog = false;
    /* logOpen = "a log file is being viewed", set from performanceData.currentLogLabel. Distinct from
       hasLog, which means "performance-sampling data exists" (meta.integrations.performance). The
       "This log" section must show whenever a log is open — a plain capture with errors but no perf
       integration still has signals to display. Gating that section on hasLog hid it for every log
       without perf sampling, so on-screen errors never reached the panel. */
    var logOpen = false;
    var heroLoading = false;
    var signalDataCache = { statuses: {}, hotFiles: [], platforms: [], sdkVersions: [], debugAdapters: [], allSignals: [], signalsInThisLog: [], coOccurrences: [], pulse: null };
    var sectionExpanded = { 'session-details': false, 'this-log': true, 'across-logs': true, environment: false };
    var currentLogLabel = '';
    var heroErrorCount = undefined, heroWarningCount = undefined, heroSnapshotSummary = '';
    var heroSparklineData = undefined;
    /* Fu7 time-window filter state. null = "All" (no filter); otherwise ms window from session-latest-ts.
       Lives in part-a so it survives across panel renders without resetting on signalData refresh. */
    var signalsInLogWindowMs = null;
    /* Fu5 sort toggle state for "Signals in this log": 'severity' (default, the producer's order)
       or 'time' (chronological by representative timestamp). Lives in part-a so it survives renders. */
    var signalsInLogSortMode = 'severity';
    /* Last-resolved "Signals in this log" list (host metadata signals, or the on-screen-line fallback
       when the host sent none). Cached here so the per-row copy handler in part D can re-find a
       clicked fallback entry by fingerprint — those entries are synthesized at render time and are
       not present in signalDataCache.signalsInThisLog. */
    var liveSignalsInThisLog = [];
    /* Plan 053-A: pending noise-learning suggestions cached from the extension host.
       Refreshed when the panel opens (sent in the signalData payload). Each entry has
       { id, pattern, description, confidence, impact: { linesAffected, percentageReduction },
         sampleLines: string[] }. */
    var signalSuggestionsCache = [];
    /* Slow-open feedback timer. Opening a cross-session signal loads that session's log on the host;
       until the host echoes scrollToSignal we shimmer the clicked row + show the loading bar. The
       timer is the safety net so an unresolved open (host finds no matching session, posts nothing)
       cannot leave the shimmer spinning forever. */
    var signalOpeningTimer = null;

    /* Clear all open-in-progress affordances: hide the loading bar, strip the shimmer class off any
       row still carrying it, and cancel the safety timer. Called on scrollToSignal / panel refresh. */
    function signalClearOpening() {
        var bar = document.getElementById('signal-loading-bar');
        if (bar) { bar.style.display = 'none'; }
        if (signalPanel) {
            var loadingRows = signalPanel.querySelectorAll('.signal-row-loading');
            for (var i = 0; i < loadingRows.length; i++) { loadingRows[i].classList.remove('signal-row-loading'); }
        }
        if (signalOpeningTimer) { clearTimeout(signalOpeningTimer); signalOpeningTimer = null; }
    }

    /* Mark a signal row as opening: shimmer the row, show the loading bar, and arm the safety clear. */
    function signalSetOpening(row) {
        signalClearOpening();
        var bar = document.getElementById('signal-loading-bar');
        if (bar) { bar.style.display = ''; }
        if (row) { row.classList.add('signal-row-loading'); }
        signalOpeningTimer = setTimeout(signalClearOpening, 6000);
    }
    window.signalClearOpening = signalClearOpening;

    function getStoredSectionState() {
        try {
            var api = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);
            if (!api) return null;
            var st = api.getState();
            return (st && st[${storageKeyJson}]) || null;
        } catch (e) { return null; }
    }
    function setStoredSectionState(state) {
        try {
            var api = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);
            if (!api) return;
            var st = api.getState() || {};
            st[${storageKeyJson}] = state;
            api.setState(st);
        } catch (e) {}
    }

    function applyStateAB() {
        if (heroBlock) {
            heroBlock.style.display = hasLog ? '' : 'none';
            heroBlock.setAttribute('aria-hidden', hasLog ? 'false' : 'true');
        }
        if (sectionSessionDetails) {
            sectionSessionDetails.style.display = hasLog ? '' : 'none';
            sectionSessionDetails.setAttribute('aria-hidden', hasLog ? 'false' : 'true');
        }
        /* This-log section gates on logOpen, NOT hasLog: it holds the current report's own signals,
           which exist whenever a log is open regardless of performance sampling. */
        if (sectionThisLog) {
            sectionThisLog.style.display = logOpen ? '' : 'none';
            sectionThisLog.setAttribute('aria-hidden', logOpen ? 'false' : 'true');
        }
        renderSectionAccordion('session-details');
        renderSectionAccordion('this-log');
    }

    function setSectionExpanded(name, expanded) {
        sectionExpanded[name] = !!expanded;
    }
    function isSectionExpanded(name) {
        return !!sectionExpanded[name];
    }
    function renderSectionAccordion(name) {
        var header = document.getElementById('signal-header-' + name);
        var body = document.getElementById('signal-body-' + name);
        if (!header || !body) return;
        var exp = isSectionExpanded(name);
        header.setAttribute('aria-expanded', exp ? 'true' : 'false');
        header.classList.toggle('expanded', exp);
        body.style.display = exp ? '' : 'none';
    }
    function toggleSection(name) {
        setSectionExpanded(name, !isSectionExpanded(name));
        renderSectionAccordion(name);
        setStoredSectionState(sectionExpanded);
    }
    function focusSectionHeader(name) {
        var el = document.getElementById('signal-header-' + name);
        if (el) el.focus();
    }
    var sectionNames = ['session-details', 'this-log', 'across-logs', 'environment'];
    sectionNames.forEach(function(name) {
        var header = document.getElementById('signal-header-' + name);
        if (header) {
            header.setAttribute('tabindex', '0');
            header.addEventListener('click', function() { toggleSection(name); });
            header.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(name); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); var i = sectionNames.indexOf(name); if (i < sectionNames.length - 1) focusSectionHeader(sectionNames[i + 1]); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); var i = sectionNames.indexOf(name); if (i > 0) focusSectionHeader(sectionNames[i - 1]); return; }
            });
        }
    });

    window.openSignalPanel = function() {
        if (!signalPanel) return;
        /* Hide any peer panel that's still .visible — otherwise both render in the same
           #panel-slot grid cell and the earlier one bleeds through (e.g. Logs/Sessions when this
           open is triggered by the host message path that bypasses setActivePanel). */
        if (typeof hideOtherPanelsInSlot === 'function') { hideOtherPanelsInSlot(signalPanel); }
        signalPanelOpen = true;
        signalPanel.classList.add('visible');
        var stored = getStoredSectionState();
        if (stored && typeof stored === 'object') {
            if (stored['session-details'] === true) sectionExpanded['session-details'] = true;
            if (stored.performance === true) sectionExpanded['session-details'] = true;
            if (stored['this-log'] === true) sectionExpanded['this-log'] = true;
            if (stored['recurring-in-log'] === true || stored['errors-in-log'] === true) sectionExpanded['this-log'] = true;
            if (stored['across-logs'] === true) sectionExpanded['across-logs'] = true;
            if (stored.recurring === true || stored.hotfiles === true) sectionExpanded['across-logs'] = true;
            if (stored.environment === true) sectionExpanded.environment = true;
        }
        vscodeApi.postMessage({ type: 'requestSignalData' });
        vscodeApi.postMessage({ type: 'requestPerformanceData' });
        applyStateAB();
        renderSectionAccordion('this-log');
        renderSectionAccordion('across-logs');
        renderSectionAccordion('environment');
        renderSectionAccordion('session-details');
        if (typeof openPerformancePanel === 'function') openPerformancePanel();
    };

    window.closeSignalPanel = function() {
        if (!signalPanel) return;
        signalPanel.classList.remove('visible');
        signalPanelOpen = false;
        setStoredSectionState(sectionExpanded);
        if (typeof clearActivePanel === 'function') clearActivePanel('signal');
    };

    window.setSignalTab = function(tab) {
        if (!signalPanelOpen || !signalPanel || !signalPanel.classList.contains('visible')) return;
        if (tab === 'performance') { setSectionExpanded('session-details', true); renderSectionAccordion('session-details'); var el = document.getElementById('signal-section-session-details'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
        else if (tab === 'recurring') { setSectionExpanded('across-logs', true); renderSectionAccordion('across-logs'); var el = document.getElementById('signal-section-across-logs'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
    };

    /* Deep-link target for saropaLogCapture.openSignal: after the recurring section is
       expanded, scroll to the row carrying this fingerprint and flash it. Deferred a frame
       so the freshly-rendered rows exist before we query. Compares the attribute directly
       (no querySelector) so SQL fingerprints with quotes/spaces need no CSS escaping. */
    window.focusSignalFingerprint = function(fp) {
        if (!fp || !signalPanel) return;
        setTimeout(function() {
            var rows = signalPanel.querySelectorAll('.signal-trend-row, .signal-in-log-row');
            for (var i = 0; i < rows.length; i++) {
                if (rows[i].getAttribute('data-fingerprint') === fp) {
                    rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    rows[i].classList.add('signal-focus-flash');
                    (function(r) { setTimeout(function() { r.classList.remove('signal-focus-flash'); }, 2000); })(rows[i]);
                    return;
                }
            }
        }, 60);
    };

    var closeBtn = document.getElementById('signal-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSignalPanel);

    document.addEventListener('click', function(e) {
        if (!signalPanelOpen) return;
        if (signalPanel && signalPanel.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-signal');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeSignalPanel();
    });
`;
}
