/**
 * Insight panel: unified slide-out for Cases (investigations), Recurring errors, and Performance.
 * Replaces the separate Recurring and Performance panels; Cases move here from Project Logs.
 * Plan: bugs/041_plan-unify-investigation-recurring-performance.md
 */
import { getPerformancePanelHtml } from './viewer-performance-panel';

const INSIGHT_STORAGE_KEY = 'insightLastTab';

/** Generate the Insight panel HTML (header, tabs, three panes). */
export function getInsightPanelHtml(): string {
    return /* html */ `
<div id="insight-panel" class="insight-panel">
    <div class="insight-panel-header">
        <span>Insight</span>
        <button id="insight-panel-close" class="insight-panel-close" title="Close">&times;</button>
    </div>
    <div class="insight-tabs">
        <button id="insight-tab-cases" class="insight-tab active" data-tab="cases">Cases</button>
        <button id="insight-tab-recurring" class="insight-tab" data-tab="recurring">Recurring</button>
        <button id="insight-tab-performance" class="insight-tab" data-tab="performance">Performance</button>
    </div>
    <div class="insight-panel-content">
        <div id="insight-cases-pane" class="insight-pane active">
            <div class="session-investigations">
                <div class="session-investigations-header">Cases</div>
                <p id="insight-cases-hint" class="session-investigations-hint">Pin sessions and files to search and export together.</p>
                <div id="insight-cases-loading" class="session-loading-label" style="display:none">Loading…</div>
                <div id="insight-cases-list" class="session-investigations-list"></div>
                <div id="insight-cases-create-row" class="session-investigations-create-row">
                    <button id="insight-cases-create" class="session-investigations-create">+ Create Investigation...</button>
                </div>
                <div id="insight-cases-create-form" class="session-investigations-create-form" style="display:none">
                    <input type="text" id="insight-cases-name-input" class="session-investigations-name-input" placeholder="e.g., Auth Timeout Bug #1234" maxlength="100" />
                    <div class="session-investigations-create-form-actions">
                        <button type="button" id="insight-cases-create-confirm" class="session-investigations-create-confirm">Create</button>
                        <button type="button" id="insight-cases-create-cancel" class="session-investigations-create-cancel">Cancel</button>
                    </div>
                    <div id="insight-cases-create-error" class="session-investigations-create-error" style="display:none"></div>
                </div>
            </div>
        </div>
        <div id="insight-recurring-pane" class="insight-pane">
            <div class="insight-recurring-inner">
                <div id="insight-recurring-list" class="recurring-list-inner"></div>
                <div id="insight-recurring-empty" class="recurring-empty">No recurring errors found</div>
                <div id="insight-recurring-loading" class="recurring-loading" style="display:none">Loading error data\u2026</div>
                <div id="insight-recurring-footer" class="insight-recurring-footer">
                    <span id="insight-export-summary" class="recurring-footer-action" title="Export recurring errors and hot files">Export summary</span>
                </div>
            </div>
        </div>
        <div id="insight-performance-pane" class="insight-pane">
            ${getPerformancePanelHtml('insight-')}
        </div>
    </div>
</div>`;
}

/** Generate the Insight panel script. Sets window.__insightPerfIdPrefix so the performance script (loaded after) binds to insight-pp-* elements. */
export function getInsightPanelScript(): string {
    return /* js */ `
(function() {
    window.__insightPerfIdPrefix = 'insight-';
    var insightPanel = document.getElementById('insight-panel');
    var casesPane = document.getElementById('insight-cases-pane');
    var recurringPane = document.getElementById('insight-recurring-pane');
    var performancePane = document.getElementById('insight-performance-pane');
    var tabCases = document.getElementById('insight-tab-cases');
    var tabRecurring = document.getElementById('insight-tab-recurring');
    var tabPerformance = document.getElementById('insight-tab-performance');
    var activeTab = 'cases';
    var insightOpen = false;
    var createInvestigationInProgress = false;

    function getStoredTab() {
        try {
            var api = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);
            if (!api) return 'cases';
            var st = api.getState();
            return (st && st[${JSON.stringify(INSIGHT_STORAGE_KEY)}]) || 'cases';
        } catch (e) { return 'cases'; }
    }
    function setStoredTab(tab) {
        try {
            var api = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);
            if (!api) return;
            var st = api.getState() || {};
            st[${JSON.stringify(INSIGHT_STORAGE_KEY)}] = tab;
            api.setState(st);
        } catch (e) {}
    }

    window.openInsightPanel = function() {
        if (!insightPanel) return;
        insightOpen = true;
        insightPanel.classList.add('visible');
        activeTab = getStoredTab();
        setActiveTab(activeTab);
        requestActiveTab();
    };

    window.closeInsightPanel = function() {
        if (!insightPanel) return;
        insightPanel.classList.remove('visible');
        insightOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('insight');
    };

    window.setInsightTab = function(tab) {
        if (!insightOpen || !insightPanel || !insightPanel.classList.contains('visible')) return;
        setActiveTab(tab);
        requestActiveTab();
    };

    function setActiveTab(tab) {
        activeTab = tab;
        setStoredTab(tab);
        if (tabCases) tabCases.classList.toggle('active', tab === 'cases');
        if (tabRecurring) tabRecurring.classList.toggle('active', tab === 'recurring');
        if (tabPerformance) tabPerformance.classList.toggle('active', tab === 'performance');
        if (casesPane) casesPane.classList.toggle('active', tab === 'cases');
        if (recurringPane) recurringPane.classList.toggle('active', tab === 'recurring');
        if (performancePane) performancePane.classList.toggle('active', tab === 'performance');
        if (tab === 'performance' && typeof openPerformancePanel === 'function') openPerformancePanel();
    }

    function requestActiveTab() {
        if (activeTab === 'cases') {
            var casesLoad = document.getElementById('insight-cases-loading');
            if (casesLoad) casesLoad.style.display = '';
            vscodeApi.postMessage({ type: 'requestInvestigations' });
        } else if (activeTab === 'recurring') {
            if (document.getElementById('insight-recurring-loading')) document.getElementById('insight-recurring-loading').style.display = '';
            if (document.getElementById('insight-recurring-list')) document.getElementById('insight-recurring-list').innerHTML = '';
            if (document.getElementById('insight-recurring-empty')) document.getElementById('insight-recurring-empty').style.display = 'none';
            vscodeApi.postMessage({ type: 'requestRecurringErrors' });
        } else if (activeTab === 'performance' && typeof openPerformancePanel === 'function') {
            openPerformancePanel();
        }
    }

    if (tabCases) tabCases.addEventListener('click', function() { setActiveTab('cases'); requestActiveTab(); });
    if (tabRecurring) tabRecurring.addEventListener('click', function() { setActiveTab('recurring'); requestActiveTab(); });
    if (tabPerformance) tabPerformance.addEventListener('click', function() { setActiveTab('performance'); requestActiveTab(); });

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
    function renderInvestigationsList(data) {
        var listEl = document.getElementById('insight-cases-list');
        var createBtn = document.getElementById('insight-cases-create');
        if (!listEl) return;
        var invs = data.investigations || [];
        var activeId = data.activeId || '';
        if (invs.length === 0) listEl.innerHTML = '';
        else {
            listEl.innerHTML = invs.map(function(inv) {
                var active = inv.id === activeId ? ' session-investigation-active' : '';
                var label = inv.name + (inv.sourceCount ? ' (' + inv.sourceCount + ')' : '');
                var activeMark = inv.id === activeId ? ' <span class="session-investigation-check">&#10003;</span>' : '';
                return '<div class="session-investigation-item' + active + '" data-investigation-id="' + escapeAttr(inv.id) + '">' + esc(label) + activeMark + '</div>';
            }).join('');
        }
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
    bindCreateInvestigationForm();

    function renderRecurringErrors(errors, statuses) {
        var listEl = document.getElementById('insight-recurring-list');
        var emptyEl = document.getElementById('insight-recurring-empty');
        var loadingEl = document.getElementById('insight-recurring-loading');
        if (loadingEl) loadingEl.style.display = 'none';
        var visible = (errors || []).filter(function(e) { return (statuses || {})[e.hash] !== 'muted'; });
        if (visible.length === 0) {
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = '';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) listEl.innerHTML = visible.map(function(e) {
            var status = (statuses || {})[e.hash] || 'open';
            var dimCls = status === 'closed' ? ' re-closed' : '';
            var sessions = e.sessionCount === 1 ? '1 session' : e.sessionCount + ' sessions';
            var total = e.totalOccurrences + ' total';
            var actions = status === 'open'
                ? '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="closed">Close</span><span class="re-action" data-hash="' + esc(e.hash) + '" data-status="muted">Mute</span>'
                : '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="open">Re-open</span>';
            var cat = e.category ? '<span class="re-cat-badge re-cat-' + esc(e.category) + '">' + esc(e.category).toUpperCase() + '</span> ' : '';
            return '<div class="re-card' + dimCls + '"><div class="re-text" title="' + esc(e.exampleLine || '') + '">' + cat + esc(e.normalizedText) + '</div><div class="re-meta">' + sessions + ' \\u00b7 ' + total + '</div><div class="re-actions">' + actions + '</div></div>';
        }).join('');
    }
    var recurringListEl = document.getElementById('insight-recurring-list');
    if (recurringListEl) recurringListEl.addEventListener('click', function(e) {
        var act = e.target.closest('.re-action');
        if (!act) return;
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: act.dataset.hash, status: act.dataset.status });
    });

    var exportSummaryEl = document.getElementById('insight-export-summary');
    if (exportSummaryEl) exportSummaryEl.addEventListener('click', function() {
        vscodeApi.postMessage({ type: 'exportInsightsSummary' });
    });

    /** Handle messages from extension (openInsight, insightRefreshRecurring) and from message-handler (investigationsList, createInvestigationError, recurringErrorsData). */
    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'openInsight') {
            openInsightPanel();
            if (e.data.tab) setInsightTab(e.data.tab);
            return;
        }
        if (e.data.type === 'insightRefreshRecurring' && activeTab === 'recurring') {
            var loadEl = document.getElementById('insight-recurring-loading');
            var listEl = document.getElementById('insight-recurring-list');
            var emptyEl = document.getElementById('insight-recurring-empty');
            if (loadEl) loadEl.style.display = '';
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'none';
            vscodeApi.postMessage({ type: 'requestRecurringErrors' });
            return;
        }
        if (e.data.type === 'investigationsList') {
            setCreateInvestigationLoading(false);
            var casesLoad = document.getElementById('insight-cases-loading');
            if (casesLoad) casesLoad.style.display = 'none';
            renderInvestigationsList(e.data);
        }
        if (e.data.type === 'createInvestigationError') {
            setCreateInvestigationLoading(false);
            var casesLoad = document.getElementById('insight-cases-loading');
            if (casesLoad) casesLoad.style.display = 'none';
            var errEl = document.getElementById('insight-cases-create-error');
            if (errEl) { errEl.textContent = e.data.message || 'Failed to create'; errEl.style.display = ''; }
        }
        if (e.data.type === 'recurringErrorsData') {
            renderRecurringErrors(e.data.errors, e.data.statuses);
        }
    });
})();
`;
}
