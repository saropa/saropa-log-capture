/**
 * Signal panel script part A: state, storage, accordion, panel open/close/setTab.
 * Concatenated by viewer-signal-panel-script.ts to stay under max-lines.
 */

/** Returns the first fragment of the Signal panel IIFE (vars, storage, accordion, panel API). */
export function getSignalScriptPartA(storageKey: string, scriptStringsJson: string): string {
    const storageKeyJson = JSON.stringify(storageKey);
    return /* js */ `
    var SIGNAL_STRINGS = ${scriptStringsJson};
    window.__signalPerfIdPrefix = 'signal-';
    var signalPanel = document.getElementById('signal-panel');
    var heroBlock = document.getElementById('signal-hero-block');
    var sectionSessionDetails = document.getElementById('signal-section-session-details');
    var sectionThisLog = document.getElementById('signal-section-this-log');
    var signalPanelOpen = false;
    var hasLog = false;
    var heroLoading = false;
    var createInvestigationInProgress = false;
    var investigationsData = { investigations: [], activeId: '' };
    var signalDataCache = { errors: [], statuses: {}, hotFiles: [], recurringInThisLog: [], errorsInThisLog: [], errorsInThisLogTotal: undefined, platforms: [], sdkVersions: [], debugAdapters: [], regressionHints: {}, allSignals: [], signalsInThisLog: [], coOccurrences: [] };
    var sectionExpanded = { 'session-details': false, 'this-log': true, cases: true, 'across-logs': true, environment: false };
    var currentLogLabel = '';
    var heroErrorCount = undefined, heroWarningCount = undefined, heroSnapshotSummary = '';
    var heroSparklineData = undefined;

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
        if (sectionThisLog) {
            sectionThisLog.style.display = hasLog ? '' : 'none';
            sectionThisLog.setAttribute('aria-hidden', hasLog ? 'false' : 'true');
        }
        setSectionExpanded('cases', hasLog ? false : true);
        renderSectionAccordion('cases');
        renderSectionAccordion('session-details');
        renderSectionAccordion('this-log');
        if (hasLog) { renderRecurringInLog(); renderErrorsInLog(); renderThisLogEmptyState(); }
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
    function expandCasesAndScrollToNew() {
        setSectionExpanded('cases', true);
        renderSectionAccordion('cases');
        setStoredSectionState(sectionExpanded);
        var casesSection = document.getElementById('signal-section-cases');
        if (casesSection) casesSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    var sectionNames = ['session-details', 'this-log', 'cases', 'across-logs', 'environment'];
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
        signalPanelOpen = true;
        signalPanel.classList.add('visible');
        var stored = getStoredSectionState();
        if (stored && typeof stored === 'object') {
            if (stored['session-details'] === true) sectionExpanded['session-details'] = true;
            if (stored.performance === true) sectionExpanded['session-details'] = true;
            if (stored['this-log'] === true) sectionExpanded['this-log'] = true;
            if (stored['recurring-in-log'] === true || stored['errors-in-log'] === true) sectionExpanded['this-log'] = true;
            sectionExpanded.cases = stored.cases !== false;
            if (stored['across-logs'] === true) sectionExpanded['across-logs'] = true;
            if (stored.recurring === true || stored.hotfiles === true) sectionExpanded['across-logs'] = true;
            if (stored.environment === true) sectionExpanded.environment = true;
        }
        vscodeApi.postMessage({ type: 'requestInvestigations' });
        vscodeApi.postMessage({ type: 'requestSignalData' });
        vscodeApi.postMessage({ type: 'requestPerformanceData' });
        applyStateAB();
        renderSectionAccordion('cases');
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
        else if (tab === 'cases') { setSectionExpanded('cases', true); renderSectionAccordion('cases'); var el = document.getElementById('signal-section-cases'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
        else if (tab === 'recurring') { setSectionExpanded('across-logs', true); renderSectionAccordion('across-logs'); var el = document.getElementById('signal-section-across-logs'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
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
