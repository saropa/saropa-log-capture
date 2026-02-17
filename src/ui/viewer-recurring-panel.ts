/**
 * Recurring Errors panel HTML and script for the webview.
 *
 * Displays top recurring error patterns across sessions in a
 * slide-out panel, following the icon-bar panel pattern.
 */

/** Generate the recurring errors panel HTML. */
export function getRecurringPanelHtml(): string {
    return /* html */ `
<div id="recurring-panel" class="recurring-panel">
    <div class="recurring-panel-header">
        <span>Recurring Errors</span>
        <div class="recurring-panel-actions">
            <button id="recurring-refresh" class="recurring-panel-action" title="Refresh">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="recurring-panel-close" class="recurring-panel-close" title="Close">&times;</button>
        </div>
    </div>
    <div class="recurring-panel-content">
        <div id="recurring-list"></div>
        <div id="recurring-empty" class="recurring-empty">No recurring errors found</div>
        <div id="recurring-loading" class="recurring-loading" style="display:none">Loading error data\u2026</div>
    </div>
    <div id="recurring-footer" class="recurring-footer">Open Full Insights</div>
</div>`;
}

/** Generate the recurring errors panel script. */
export function getRecurringPanelScript(): string {
    return /* js */ `
(function() {
    var recurPanelEl = document.getElementById('recurring-panel');
    var recurListEl = document.getElementById('recurring-list');
    var recurEmptyEl = document.getElementById('recurring-empty');
    var recurLoadingEl = document.getElementById('recurring-loading');
    var recurPanelOpen = false;

    window.openRecurringPanel = function() {
        if (!recurPanelEl) return;
        recurPanelOpen = true;
        recurPanelEl.classList.add('visible');
        showLoading();
        vscodeApi.postMessage({ type: 'requestRecurringErrors' });
    };

    window.closeRecurringPanel = function() {
        if (!recurPanelEl) return;
        recurPanelEl.classList.remove('visible');
        recurPanelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('recurring');
    };

    function showLoading() {
        if (recurListEl) recurListEl.innerHTML = '';
        if (recurEmptyEl) recurEmptyEl.style.display = 'none';
        if (recurLoadingEl) recurLoadingEl.style.display = '';
    }

    /* ---- Rendering ---- */

    function renderErrors(errors, statuses) {
        if (recurLoadingEl) recurLoadingEl.style.display = 'none';
        var visible = (errors || []).filter(function(e) { return (statuses || {})[e.hash] !== 'muted'; });
        if (visible.length === 0) {
            if (recurListEl) recurListEl.innerHTML = '';
            if (recurEmptyEl) recurEmptyEl.style.display = '';
            return;
        }
        if (recurEmptyEl) recurEmptyEl.style.display = 'none';
        if (recurListEl) recurListEl.innerHTML = visible.map(function(e) {
            return renderCard(e, (statuses || {})[e.hash] || 'open');
        }).join('');
    }

    function renderCard(e, status) {
        var dimCls = status === 'closed' ? ' re-closed' : '';
        var sessions = e.sessionCount === 1 ? '1 session' : e.sessionCount + ' sessions';
        var total = e.totalOccurrences + ' total';
        var actions = status === 'open'
            ? '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="closed">Close</span>'
              + '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="muted">Mute</span>'
            : '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="open">Re-open</span>';
        var cat = e.category
            ? '<span class="re-cat-badge re-cat-' + e.category + '">' + e.category.toUpperCase() + '</span> '
            : '';
        return '<div class="re-card' + dimCls + '">'
            + '<div class="re-text" title="' + esc(e.exampleLine || '') + '">' + cat + esc(e.normalizedText) + '</div>'
            + '<div class="re-meta">' + sessions + ' \\u00b7 ' + total + '</div>'
            + '<div class="re-actions">' + actions + '</div></div>';
    }

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    /* ---- Click handlers ---- */

    if (recurListEl) {
        recurListEl.addEventListener('click', function(e) {
            var act = e.target.closest('.re-action');
            if (!act) return;
            e.stopPropagation();
            vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: act.dataset.hash, status: act.dataset.status });
        });
    }

    var refreshBtn = document.getElementById('recurring-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function() {
        showLoading();
        vscodeApi.postMessage({ type: 'requestRecurringErrors' });
    });

    var footerBtn = document.getElementById('recurring-footer');
    if (footerBtn) footerBtn.addEventListener('click', function() {
        vscodeApi.postMessage({ type: 'openInsights' });
    });

    /* ---- Close / outside click ---- */

    var closeBtn = document.getElementById('recurring-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeRecurringPanel);

    document.addEventListener('click', function(e) {
        if (!recurPanelOpen) return;
        if (recurPanelEl && recurPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-recurring');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeRecurringPanel();
    });

    /* ---- Message listener ---- */

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'recurringErrorsData') {
            renderErrors(e.data.errors, e.data.statuses);
        }
    });
})();
`;
}
