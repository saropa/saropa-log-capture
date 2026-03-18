/**
 * Insight panel script content (single-scroll, context-aware).
 * Exported for viewer-insight-panel.ts to stay under max-lines.
 *
 * UX enhancements (14 items): empty states (Cases, Recurring, Hot files); loading states;
 * "This log" single empty message when no errors/recurring; keyboard nav (arrows, Enter/Space)
 * on section headers; scroll/focus after add-to-case and create-case; Session details hint;
 * recurring/errors-in-log text truncation with full tooltip; "Top 3 of N" for errors-in-log;
 * cases list N sources · updated ago; hero 0/0 and no-data message; sparkline "Session trend"
 * label; export confirmation (handled in command). Section order State A: Cases → Across → Env.
 */
/* eslint-disable max-lines -- single script template literal */

const MAX_RECURRING_TEXT_LEN = 90;

export interface InsightScriptStrings {
    addToCase: string;
    heroSparklineTitle: string;
    heroLoading: string;
    heroNoSamplingHint: string;
    errorsInLogEmpty: string;
    emptyCases: string;
    emptyRecurring: string;
    emptyHotFiles: string;
    thisLogEmpty: string;
    sessionTrendLabel: string;
    topOfTotal: string;
    sourcesCount: string;
    updatedAgo: string;
    heroNoErrorsWarnings: string;
    sectionErrorsInLog: string;
}

const DEFAULT_INSIGHT_STRINGS: InsightScriptStrings = {
    addToCase: 'Add to case',
    heroSparklineTitle: 'Free memory over session',
    heroLoading: 'Loading…',
    heroNoSamplingHint: 'Enable session sampling for trend',
    errorsInLogEmpty: 'No error patterns in this session.',
    emptyCases: 'No cases yet. Create one to pin logs and files.',
    emptyRecurring: 'No recurring errors yet. They\'ll appear as you capture logs.',
    emptyHotFiles: 'No frequently modified files across sessions yet.',
    thisLogEmpty: 'No errors or recurring patterns in this log.',
    sessionTrendLabel: 'Session trend',
    topOfTotal: 'Top 3 of {0}',
    sourcesCount: '{0} source(s)',
    updatedAgo: 'Updated {0}',
    heroNoErrorsWarnings: 'No errors or warnings recorded',
    sectionErrorsInLog: 'Errors in this log',
};

/** Generate the Insight panel script. Single scroll; State A vs B. */
export function getInsightPanelScriptContent(storageKey: string, strings?: InsightScriptStrings): string {
    const s = strings ?? DEFAULT_INSIGHT_STRINGS;
    const scriptStringsJson = JSON.stringify(s);
    return /* js */ `
(function() {
    var INSIGHT_STRINGS = ${scriptStringsJson};
    window.__insightPerfIdPrefix = 'insight-';
    var insightPanel = document.getElementById('insight-panel');
    var heroBlock = document.getElementById('insight-hero-block');
    var sectionSessionDetails = document.getElementById('insight-section-session-details');
    var sectionThisLog = document.getElementById('insight-section-this-log');
    var insightOpen = false;
    var hasLog = false;
    var heroLoading = false;
    var createInvestigationInProgress = false;
    var investigationsData = { investigations: [], activeId: '' };
    var insightDataCache = { errors: [], statuses: {}, hotFiles: [], recurringInThisLog: [], errorsInThisLog: [], errorsInThisLogTotal: undefined, platforms: [], sdkVersions: [], debugAdapters: [] };
    var sectionExpanded = { 'session-details': false, 'this-log': true, cases: true, 'across-logs': true, environment: false };
    var currentLogLabel = '';
    var heroErrorCount = undefined, heroWarningCount = undefined, heroSnapshotSummary = '';
    var heroSparklineData = undefined;

    function getStoredSectionState() {
        try {
            var api = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);
            if (!api) return null;
            var st = api.getState();
            return (st && st[${JSON.stringify(storageKey)}]) || null;
        } catch (e) { return null; }
    }
    function setStoredSectionState(state) {
        try {
            var api = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);
            if (!api) return;
            var st = api.getState() || {};
            st[${JSON.stringify(storageKey)}] = state;
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
        var header = document.getElementById('insight-header-' + name);
        var body = document.getElementById('insight-body-' + name);
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
        var el = document.getElementById('insight-header-' + name);
        if (el) el.focus();
    }
    /** After add-to-case or create-case: expand Cases section and scroll it into view. */
    function expandCasesAndScrollToNew() {
        setSectionExpanded('cases', true);
        renderSectionAccordion('cases');
        setStoredSectionState(sectionExpanded);
        var casesSection = document.getElementById('insight-section-cases');
        if (casesSection) casesSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    var sectionNames = ['session-details', 'this-log', 'cases', 'across-logs', 'environment'];
    sectionNames.forEach(function(name) {
        var header = document.getElementById('insight-header-' + name);
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

    window.openInsightPanel = function() {
        if (!insightPanel) return;
        insightOpen = true;
        insightPanel.classList.add('visible');
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
        vscodeApi.postMessage({ type: 'requestInsightData' });
        vscodeApi.postMessage({ type: 'requestPerformanceData' });
        applyStateAB();
        renderSectionAccordion('cases');
        renderSectionAccordion('this-log');
        renderSectionAccordion('across-logs');
        renderSectionAccordion('environment');
        renderSectionAccordion('session-details');
        if (typeof openPerformancePanel === 'function') openPerformancePanel();
    };

    window.closeInsightPanel = function() {
        if (!insightPanel) return;
        insightPanel.classList.remove('visible');
        insightOpen = false;
        setStoredSectionState(sectionExpanded);
        if (typeof clearActivePanel === 'function') clearActivePanel('insight');
    };

    window.setInsightTab = function(tab) {
        if (!insightOpen || !insightPanel || !insightPanel.classList.contains('visible')) return;
        if (tab === 'performance') { setSectionExpanded('session-details', true); renderSectionAccordion('session-details'); var el = document.getElementById('insight-section-session-details'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
        else if (tab === 'cases') { setSectionExpanded('cases', true); renderSectionAccordion('cases'); var el = document.getElementById('insight-section-cases'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
        else if (tab === 'recurring') { setSectionExpanded('across-logs', true); renderSectionAccordion('across-logs'); var el = document.getElementById('insight-section-across-logs'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
    };

    var closeBtn = document.getElementById('insight-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeInsightPanel);

    document.addEventListener('click', function(e) {
        if (!insightOpen) return;
        if (insightPanel && insightPanel.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-insight');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeInsightPanel();
    });

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function escapeAttr(str) { return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    var maxRecurringTextLen = ${MAX_RECURRING_TEXT_LEN};
    function truncateForDisplay(text) { var t = (text || '').trim(); return t.length <= maxRecurringTextLen ? t : t.slice(0, maxRecurringTextLen) + '\\u2026'; }
    function formatUpdatedAgo(ms) {
        if (ms == null || !Number.isFinite(ms)) return '';
        var d = Date.now() - ms;
        if (d < 60000) return 'just now';
        if (d < 3600000) return Math.floor(d / 60000) + ' min ago';
        if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
        if (d < 604800000) return Math.floor(d / 86400000) + ' days ago';
        return Math.floor(d / 604800000) + 'w ago';
    }

    function setCreateInvestigationLoading(loading) {
        createInvestigationInProgress = loading;
        var input = document.getElementById('insight-cases-name-input');
        var confirmBtn = document.getElementById('insight-cases-create-confirm');
        if (input) input.disabled = loading;
        if (confirmBtn) { confirmBtn.disabled = loading; confirmBtn.textContent = loading ? 'Creating…' : 'Create'; }
    }
    function showCreateInvestigationForm(show) {
        var row = document.getElementById('insight-cases-create-row');
        var form = document.getElementById('insight-cases-create-form');
        var input = document.getElementById('insight-cases-name-input');
        var errEl = document.getElementById('insight-cases-create-error');
        if (row) row.style.display = show ? 'none' : '';
        if (form) form.style.display = show ? 'flex' : 'none';
        if (input) { input.value = ''; input.disabled = createInvestigationInProgress; if (show) input.focus(); }
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        var confirmBtn = document.getElementById('insight-cases-create-confirm');
        if (confirmBtn) { confirmBtn.disabled = createInvestigationInProgress; confirmBtn.textContent = createInvestigationInProgress ? 'Creating…' : 'Create'; }
    }
    function renderCasesList() {
        var listEl = document.getElementById('insight-cases-list');
        var emptyEl = document.getElementById('insight-cases-empty');
        var viewAllRow = document.getElementById('insight-cases-view-all');
        var viewAllLink = document.getElementById('insight-cases-view-all-link');
        var createBtn = document.getElementById('insight-cases-create');
        if (!listEl) return;
        var invs = (investigationsData.investigations || []);
        var activeId = investigationsData.activeId || '';
        var showCount = Math.min(3, invs.length);
        var toShow = invs.slice(0, showCount);
        if (emptyEl) emptyEl.style.display = invs.length === 0 ? '' : 'none';
        if (toShow.length === 0) listEl.innerHTML = '';
        else listEl.innerHTML = toShow.map(function(inv) { return buildCaseItemHtml(inv, activeId); }).join('');
        if (viewAllRow) viewAllRow.style.display = invs.length > 3 ? '' : 'none';
        if (viewAllLink) viewAllLink.textContent = 'View All (' + invs.length + ')';
        if (createBtn) createBtn.onclick = function() { showCreateInvestigationForm(true); };
        listEl.querySelectorAll('.session-investigation-item').forEach(function(el) {
            el.addEventListener('click', function() {
                var id = el.getAttribute('data-investigation-id');
                if (id) vscodeApi.postMessage({ type: 'openInvestigationById', id: id });
            });
        });
        showCreateInvestigationForm(false);
    }
    function bindCreateInvestigationForm() {
        var form = document.getElementById('insight-cases-create-form');
        var input = document.getElementById('insight-cases-name-input');
        var confirmBtn = document.getElementById('insight-cases-create-confirm');
        var cancelBtn = document.getElementById('insight-cases-create-cancel');
        var errEl = document.getElementById('insight-cases-create-error');
        if (!form || !input || !confirmBtn || !cancelBtn || !errEl) return;
        function hideError() { errEl.style.display = 'none'; errEl.textContent = ''; }
        function showError(msg) { errEl.textContent = msg; errEl.style.display = ''; }
        function submit() {
            if (createInvestigationInProgress) return;
            var name = (input.value || '').trim();
            if (!name) { showError('Name is required'); return; }
            if (name.length > 100) { showError('Name must be 100 characters or less'); return; }
            hideError();
            setCreateInvestigationLoading(true);
            vscodeApi.postMessage({ type: 'createInvestigationWithName', name: name });
        }
        confirmBtn.addEventListener('click', submit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { e.preventDefault(); showCreateInvestigationForm(false); }
        });
        cancelBtn.addEventListener('click', function() { showCreateInvestigationForm(false); });
    }
    function buildCaseItemHtml(inv, activeId) {
        var active = inv.id === (activeId || '') ? ' session-investigation-active' : '';
        var srcStr = (inv.sourceCount != null) ? (INSIGHT_STRINGS.sourcesCount || '{0} source(s)').replace('{0}', String(inv.sourceCount)) : '';
        var upStr = (inv.updatedAt != null) ? (INSIGHT_STRINGS.updatedAgo || 'Updated {0}').replace('{0}', formatUpdatedAgo(inv.updatedAt)) : '';
        var meta = [srcStr, upStr].filter(Boolean).join(' \\u00b7 ');
        var label = inv.name + (meta ? ' \\u00b7 ' + meta : '');
        var activeMark = inv.id === (activeId || '') ? ' <span class="session-investigation-check">&#10003;</span>' : '';
        return '<div class="session-investigation-item' + active + '" data-investigation-id="' + escapeAttr(inv.id) + '">' + esc(label) + activeMark + '</div>';
    }
    var viewAllLinkEl = document.getElementById('insight-cases-view-all-link');
    if (viewAllLinkEl) viewAllLinkEl.addEventListener('click', function() {
        setSectionExpanded('cases', true);
        renderSectionAccordion('cases');
        var listEl = document.getElementById('insight-cases-list');
        if (listEl) {
            var invs = (investigationsData.investigations || []);
            var activeId = investigationsData.activeId || '';
            listEl.innerHTML = invs.map(function(inv) { return buildCaseItemHtml(inv, activeId); }).join('');
            listEl.querySelectorAll('.session-investigation-item').forEach(function(el) {
                el.addEventListener('click', function() {
                    var id = el.getAttribute('data-investigation-id');
                    if (id) vscodeApi.postMessage({ type: 'openInvestigationById', id: id });
                });
            });
        }
        var vw = document.getElementById('insight-cases-view-all');
        if (vw) vw.style.display = 'none';
    });
    bindCreateInvestigationForm();

    function renderRecurringList() {
        var listEl = document.getElementById('insight-recurring-list');
        var emptyEl = document.getElementById('insight-recurring-empty');
        var visible = (insightDataCache.errors || []).filter(function(e) { return (insightDataCache.statuses || {})[e.hash] !== 'muted'; });
        var toShow = visible.slice(0, 5);
        if (toShow.length === 0) {
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = '';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) listEl.innerHTML = toShow.map(function(e) {
            var status = (insightDataCache.statuses || {})[e.hash] || 'open';
            var dimCls = status === 'closed' ? ' re-closed' : '';
            var sessions = e.sessionCount === 1 ? '1 session' : e.sessionCount + ' sessions';
            var total = e.totalOccurrences + ' total';
            var actions = status === 'open'
                ? '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="closed">Close</span><span class="re-action" data-hash="' + esc(e.hash) + '" data-status="muted">Mute</span>'
                : '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="open">Re-open</span>';
            var cat = e.category ? '<span class="re-cat-badge re-cat-' + esc(e.category) + '">' + esc(e.category).toUpperCase() + '</span> ' : '';
            var fullText = e.normalizedText || '';
            var displayText = truncateForDisplay(fullText);
            var titleAttr = esc((e.exampleLine || fullText).trim() || '');
            var addBtn = '<span class="re-action re-add-to-case" role="button" title="' + esc(INSIGHT_STRINGS.addToCase) + '" aria-label="' + esc(INSIGHT_STRINGS.addToCase) + '" data-hash="' + esc(e.hash) + '" data-normalized="' + esc(e.normalizedText || '') + '" data-example="' + esc(e.exampleLine || '') + '">+</span>';
            return '<div class="re-card' + dimCls + '"><div class="re-text" title="' + titleAttr + '">' + cat + esc(displayText) + '</div><div class="re-meta">' + sessions + ' \\u00b7 ' + total + '</div><div class="re-actions">' + addBtn + ' ' + actions + '</div></div>';
        }).join('');
    }
    function renderHotFiles() {
        var summaryEl = document.getElementById('insight-hotfiles-summary');
        var emptyEl = document.getElementById('insight-hotfiles-empty');
        var listEl = document.getElementById('insight-hotfiles-list');
        var files = insightDataCache.hotFiles || [];
        if (summaryEl) summaryEl.textContent = files.length === 0 ? 'Frequently modified files' : (files.length + ' file' + (files.length === 1 ? '' : 's') + ' frequently modified');
        var toShow = files.slice(0, 5);
        if (emptyEl) emptyEl.style.display = toShow.length === 0 ? '' : 'none';
        if (listEl) {
            listEl.innerHTML = toShow.length === 0 ? '' : toShow.map(function(f) {
                return '<div class="insight-hotfile-item"><span class="re-action re-add-to-case insight-hotfile-add" role="button" title="' + esc(INSIGHT_STRINGS.addToCase) + '" aria-label="' + esc(INSIGHT_STRINGS.addToCase) + '" data-filename="' + esc(f.filename || '') + '">+</span><span class="insight-hotfile-name">' + esc(f.filename) + '</span><span class="insight-hotfile-meta">' + (f.sessionCount || 0) + ' session' + (f.sessionCount === 1 ? '' : 's') + '</span></div>';
            }).join('');
        }
    }
    function renderRecurringInLog() {
        var summaryEl = document.getElementById('insight-recurring-in-log-summary');
        var listEl = document.getElementById('insight-recurring-in-log-list');
        var inLog = (insightDataCache.recurringInThisLog || []).filter(function(e) { return (insightDataCache.statuses || {})[e.hash] !== 'muted'; });
        if (summaryEl) summaryEl.textContent = inLog.length === 0 ? 'Recurring in this log' : (inLog.length + ' of your recurring error' + (inLog.length === 1 ? '' : 's') + ' appear in this log');
        if (listEl) {
            if (inLog.length === 0) listEl.innerHTML = '<p class="insight-hotfiles-empty">None of your recurring errors appear in this log.</p>';
            else listEl.innerHTML = inLog.map(function(e) {
                var status = (insightDataCache.statuses || {})[e.hash] || 'open';
                var dimCls = status === 'closed' ? ' re-closed' : '';
                var sessions = e.sessionCount === 1 ? '1 session' : e.sessionCount + ' sessions';
                var total = e.totalOccurrences + ' total';
                var actions = status === 'open' ? '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="closed">Close</span><span class="re-action" data-hash="' + esc(e.hash) + '" data-status="muted">Mute</span>' : '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="open">Re-open</span>';
                var cat = e.category ? '<span class="re-cat-badge re-cat-' + esc(e.category) + '">' + esc(e.category).toUpperCase() + '</span> ' : '';
                var fullText = e.normalizedText || '';
                var displayText = truncateForDisplay(fullText);
                var titleAttr = esc((e.exampleLine || fullText).trim() || '');
                var addBtn = '<span class="re-action re-add-to-case" role="button" title="' + esc(INSIGHT_STRINGS.addToCase) + '" aria-label="' + esc(INSIGHT_STRINGS.addToCase) + '" data-hash="' + esc(e.hash) + '" data-normalized="' + esc(e.normalizedText || '') + '" data-example="' + esc(e.exampleLine || '') + '">+</span>';
                return '<div class="re-card' + dimCls + '"><div class="re-text" title="' + titleAttr + '">' + cat + esc(displayText) + '</div><div class="re-meta">' + sessions + ' \\u00b7 ' + total + '</div><div class="re-actions">' + addBtn + ' ' + actions + '</div></div>';
            }).join('');
        }
    }
    function renderErrorsInLog() {
        var subtitleEl = document.getElementById('insight-errors-in-log-subtitle');
        var listEl = document.getElementById('insight-errors-in-log-list');
        var emptyEl = document.getElementById('insight-errors-in-log-empty');
        var items = (insightDataCache.errorsInThisLog || []).slice(0, 3);
        var total = insightDataCache.errorsInThisLogTotal;
        var showTopOfN = items.length === 3 && (total != null && total > 3);
        if (subtitleEl) subtitleEl.textContent = showTopOfN && INSIGHT_STRINGS.topOfTotal
            ? (INSIGHT_STRINGS.topOfTotal.replace('{0}', String(total))) : (INSIGHT_STRINGS.sectionErrorsInLog || 'Errors in this log');
        if (emptyEl) { emptyEl.style.display = items.length === 0 ? '' : 'none'; if (items.length === 0) emptyEl.innerHTML = '<span class="insight-margin-emoji" aria-hidden="true">\\u2139\\uFE0F</span>' + esc(INSIGHT_STRINGS.errorsInLogEmpty); }
        if (listEl) {
            if (items.length === 0) listEl.innerHTML = '';
            else listEl.innerHTML = items.map(function(it) {
                var text = (it.normalizedText || it.exampleLine || '').trim() || 'Error';
                var displayText = truncateForDisplay(text);
                var count = (it.count != null) ? it.count : 0;
                var addBtn = '<span class="re-action re-add-to-case insight-errors-in-log-add" role="button" title="' + esc(INSIGHT_STRINGS.addToCase) + '" aria-label="' + esc(INSIGHT_STRINGS.addToCase) + '" data-normalized="' + esc(it.normalizedText || '') + '" data-example="' + esc(it.exampleLine || '') + '">+</span>';
                return '<div class="re-card insight-errors-in-log-item"><div class="re-text" title="' + esc(it.exampleLine || text) + '">' + esc(displayText) + '</div><div class="re-meta">' + count + ' occurrence' + (count === 1 ? '' : 's') + '</div><div class="re-actions">' + addBtn + '</div></div>';
            }).join('');
        }
    }
    function renderThisLogEmptyState() {
        var emptyBlock = document.getElementById('insight-this-log-empty');
        var contentBlock = document.getElementById('insight-this-log-content');
        var errorsEmpty = (insightDataCache.errorsInThisLog || []).length === 0;
        var inLog = (insightDataCache.recurringInThisLog || []).filter(function(e) { return (insightDataCache.statuses || {})[e.hash] !== 'muted'; });
        var recurringEmpty = inLog.length === 0;
        var bothEmpty = errorsEmpty && recurringEmpty;
        if (emptyBlock) emptyBlock.style.display = bothEmpty ? '' : 'none';
        if (contentBlock) contentBlock.style.display = bothEmpty ? 'none' : '';
    }
    function renderEnvironment() {
        var summaryEl = document.getElementById('insight-environment-summary');
        var listEl = document.getElementById('insight-environment-list');
        var platforms = insightDataCache.platforms || [];
        var sdks = insightDataCache.sdkVersions || [];
        var adapters = insightDataCache.debugAdapters || [];
        var total = platforms.length + sdks.length + adapters.length;
        if (summaryEl) summaryEl.textContent = total === 0 ? 'Environment' : ('Environment (' + total + ' entries)');
        if (listEl) {
            var parts = [];
            if (platforms.length) parts.push('<div class="insight-env-group"><div class="insight-env-title">Platforms</div>' + platforms.slice(0, 5).map(function(p) { return '<div class="insight-env-row"><span>' + esc(p.value) + '</span><span class="insight-hotfile-meta">' + p.sessionCount + ' session' + (p.sessionCount === 1 ? '' : 's') + '</span></div>'; }).join('') + '</div>');
            if (sdks.length) parts.push('<div class="insight-env-group"><div class="insight-env-title">SDK / runtime</div>' + sdks.slice(0, 5).map(function(p) { return '<div class="insight-env-row"><span>' + esc(p.value) + '</span><span class="insight-hotfile-meta">' + p.sessionCount + '</span></div>'; }).join('') + '</div>');
            if (adapters.length) parts.push('<div class="insight-env-group"><div class="insight-env-title">Debug adapters</div>' + adapters.slice(0, 5).map(function(p) { return '<div class="insight-env-row"><span>' + esc(p.value) + '</span><span class="insight-hotfile-meta">' + p.sessionCount + '</span></div>'; }).join('') + '</div>');
            listEl.innerHTML = parts.length === 0 ? '<p class="insight-hotfiles-empty">No environment data across sessions.</p>' : parts.join('');
        }
    }
    function renderPerformanceHero() {
        var heroEl = document.getElementById('insight-performance-hero');
        if (!heroEl) return;
        if (!hasLog) { heroEl.style.display = 'none'; heroEl.innerHTML = ''; return; }
        if (heroLoading) {
            heroEl.innerHTML = '<span class="insight-hero-metrics">' + esc(INSIGHT_STRINGS.heroLoading) + '</span>';
            heroEl.style.display = '';
            return;
        }
        var parts = [];
        if (typeof heroErrorCount === 'number') parts.push('\\uD83D\\uDD34 Errors: ' + heroErrorCount);
        if (typeof heroWarningCount === 'number') parts.push('\\uD83D\\uDFE1 Warnings: ' + heroWarningCount);
        if (parts.length === 0 && hasLog && typeof heroErrorCount !== 'number' && typeof heroWarningCount !== 'number') parts.push(esc(INSIGHT_STRINGS.heroNoErrorsWarnings || 'No errors or warnings recorded'));
        if (heroSnapshotSummary) parts.push(heroSnapshotSummary);
        var hasSparkline = heroSparklineData && Array.isArray(heroSparklineData.freememMb) && heroSparklineData.freememMb.length >= 2;
        var sparklineHtml = '';
        if (hasSparkline) {
            var arr = heroSparklineData.freememMb;
            var min = Math.min.apply(null, arr);
            var max = Math.max.apply(null, arr);
            var range = max > min ? max - min : 1;
            var w = 120, h = 24;
            var pts = [];
            for (var i = 0; i < arr.length; i++) {
                var x = (i / (arr.length - 1)) * w;
                var norm = (arr[i] - min) / range;
                var y = h - norm * h;
                pts.push(x.toFixed(1) + ',' + y.toFixed(1));
            }
            var sparkTitle = esc(INSIGHT_STRINGS.heroSparklineTitle);
            var trendLabel = esc(INSIGHT_STRINGS.sessionTrendLabel || 'Session trend');
            sparklineHtml = '<span class="insight-hero-sparkline-wrap"><span class="insight-hero-sparkline-label">' + trendLabel + '</span><svg class="insight-hero-sparkline" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><title>' + sparkTitle + '</title><path fill="none" stroke="currentColor" stroke-width="1.5" d="M' + pts.join(' L') + '"/></svg></span>';
        }
        var hintHtml = '';
        if (!hasSparkline && parts.length === 0) hintHtml = '<span class="insight-hero-hint">' + esc(INSIGHT_STRINGS.heroNoSamplingHint) + '</span>';
        if (parts.length === 0 && !sparklineHtml && !hintHtml) { heroEl.style.display = 'none'; heroEl.innerHTML = ''; heroEl.parentElement && heroEl.parentElement.classList.remove('insight-hero-has-errors', 'insight-hero-has-warnings'); return; }
        heroEl.innerHTML = sparklineHtml + (parts.length > 0 ? '<span class="insight-hero-metrics">' + parts.join(' \\u00b7 ') + '</span>' : '') + hintHtml;
        heroEl.style.display = '';
        var heroBlock = document.getElementById('insight-hero-block');
        if (heroBlock) {
            heroBlock.classList.toggle('insight-hero-has-errors', typeof heroErrorCount === 'number' && heroErrorCount > 0);
            heroBlock.classList.toggle('insight-hero-has-warnings', typeof heroWarningCount === 'number' && heroWarningCount > 0);
        }
    }
    var recurringListEl = document.getElementById('insight-recurring-list');
    if (recurringListEl) recurringListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addInsightItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); return; }
        var act = e.target.closest('.re-action');
        if (!act) return;
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: act.dataset.hash, status: act.dataset.status });
    });
    var hotfilesListEl = document.getElementById('insight-hotfiles-list');
    if (hotfilesListEl) hotfilesListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.preventDefault(); vscodeApi.postMessage({ type: 'addInsightItemToCase', payload: { type: 'hotfile', filename: addBtn.dataset.filename || '' } }); }
    });
    var recurringInLogListEl = document.getElementById('insight-recurring-in-log-list');
    if (recurringInLogListEl) recurringInLogListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addInsightItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); return; }
        var act = e.target.closest('.re-action');
        if (!act) return;
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: act.dataset.hash, status: act.dataset.status });
    });
    var errorsInLogListEl = document.getElementById('insight-errors-in-log-list');
    if (errorsInLogListEl) errorsInLogListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addInsightItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); }
    });

    var exportSummaryEl = document.getElementById('insight-export-summary');
    if (exportSummaryEl) exportSummaryEl.addEventListener('click', function() {
        vscodeApi.postMessage({ type: 'exportInsightsSummary' });
    });

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'openInsight') {
            openInsightPanel();
            if (e.data.tab) setInsightTab(e.data.tab);
            return;
        }
        if (e.data.type === 'currentLogChanged') {
            if (hasLog) { heroLoading = true; renderPerformanceHero(); }
            vscodeApi.postMessage({ type: 'requestPerformanceData' });
            vscodeApi.postMessage({ type: 'requestInsightData' });
            return;
        }
        if (e.data.type === 'insightRefreshRecurring') {
            var loadEl = document.getElementById('insight-recurring-loading');
            var listEl = document.getElementById('insight-recurring-list');
            var emptyEl = document.getElementById('insight-recurring-empty');
            if (loadEl) loadEl.style.display = '';
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'none';
            vscodeApi.postMessage({ type: 'requestInsightData' });
            return;
        }
        if (e.data.type === 'investigationsList') {
            setCreateInvestigationLoading(false);
            var casesLoad = document.getElementById('insight-cases-loading');
            if (casesLoad) casesLoad.style.display = 'none';
            investigationsData = { investigations: e.data.investigations || [], activeId: e.data.activeId || '' };
            renderCasesList();
        }
        if (e.data.type === 'addToCaseCompleted') {
            expandCasesAndScrollToNew();
        }
        if (e.data.type === 'createInvestigationSucceeded') {
            expandCasesAndScrollToNew();
            var listEl = document.getElementById('insight-cases-list');
            var lastItem = listEl && listEl.lastElementChild;
            if (lastItem) lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (e.data.type === 'createInvestigationError') {
            setCreateInvestigationLoading(false);
            var casesLoad = document.getElementById('insight-cases-loading');
            if (casesLoad) casesLoad.style.display = 'none';
            var errEl = document.getElementById('insight-cases-create-error');
            if (errEl) { errEl.textContent = e.data.message || 'Failed to create'; errEl.style.display = ''; }
        }
        if (e.data.type === 'insightData') {
            insightDataCache = {
                errors: e.data.errors || [], statuses: e.data.statuses || {}, hotFiles: e.data.hotFiles || [],
                recurringInThisLog: e.data.recurringInThisLog || [], errorsInThisLog: e.data.errorsInThisLog || [],
                errorsInThisLogTotal: e.data.errorsInThisLogTotal,
                platforms: e.data.platforms || [], sdkVersions: e.data.sdkVersions || [], debugAdapters: e.data.debugAdapters || []
            };
            var loadEl = document.getElementById('insight-recurring-loading');
            if (loadEl) loadEl.style.display = 'none';
            renderRecurringList();
            renderHotFiles();
            renderRecurringInLog();
            renderErrorsInLog();
            renderThisLogEmptyState();
            renderEnvironment();
        }
        if (e.data.type === 'recurringErrorsData') {
            insightDataCache.errors = e.data.errors || [];
            insightDataCache.statuses = e.data.statuses || {};
            var loadEl = document.getElementById('insight-recurring-loading');
            if (loadEl) loadEl.style.display = 'none';
            renderRecurringList();
            renderRecurringInLog();
            renderThisLogEmptyState();
        }
        if (e.data.type === 'performanceData') {
            heroLoading = false;
            hasLog = !!(e.data.sessionData);
            currentLogLabel = e.data.currentLogLabel || '';
            heroErrorCount = e.data.heroErrorCount;
            heroWarningCount = e.data.heroWarningCount;
            heroSnapshotSummary = (e.data.heroSnapshotSummary != null && e.data.heroSnapshotSummary !== '') ? String(e.data.heroSnapshotSummary) : '';
            heroSparklineData = e.data.heroSparklineData || undefined;
            var scopeEl = document.getElementById('insight-performance-scope');
            var labelEl = document.getElementById('insight-current-log-label');
            if (scopeEl && labelEl) {
                if (hasLog && currentLogLabel) { labelEl.textContent = currentLogLabel; scopeEl.style.display = ''; }
                else if (hasLog) { labelEl.textContent = 'No log open'; scopeEl.style.display = ''; }
                else { scopeEl.style.display = 'none'; }
            }
            renderPerformanceHero();
            applyStateAB();
        }
    });
})();
`;
}
