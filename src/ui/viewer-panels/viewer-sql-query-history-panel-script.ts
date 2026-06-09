/**
 * Injected SQL query history panel script (DB_11): event listeners and drift status.
 * Helpers and render logic live in sibling modules concatenated inside the IIFE.
 */
import { getSqlQueryHistoryPanelHelpersScript } from './viewer-sql-query-history-panel-helpers';
import { getSqlQueryHistoryPanelRenderScript } from './viewer-sql-query-history-panel-render';
import { getSqlQueryHistoryDashboardScript } from './viewer-sql-query-history-dashboard';

/** Returns the full SQL query history panel JavaScript (IIFE). */
export function getSqlQueryHistoryPanelScript(): string {
    return /* javascript */ `
(function() {
` + getSqlQueryHistoryPanelHelpersScript() + getSqlQueryHistoryDashboardScript() + getSqlQueryHistoryPanelRenderScript() + /* javascript */ `
    if (listEl) {
        listEl.addEventListener('click', function(e) {
            var driftBtn = e.target.closest('.sql-query-history-drift');
            if (driftBtn) {
                e.stopPropagation();
                var rowEl = driftBtn.closest('.sql-query-history-row');
                var fp = rowEl && rowEl.getAttribute('data-fingerprint');
                var ent = fp && sqlQueryHistoryByFp[fp];
                var sql = (ent && ent.sampleSql) ? ent.sampleSql : (fp || '');
                if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage && sql) {
                    var u = driftViewerBaseUrl() + '/?sql=' + encodeURIComponent(sql);
                    vscodeApi.postMessage({ type: 'openUrl', url: u });
                }
                return;
            }
            var jumpBtn = e.target.closest('.sql-query-history-jump');
            if (jumpBtn) {
                e.stopPropagation();
                jumpSqlHistoryRow(jumpBtn.closest('.sql-query-history-row'));
                return;
            }
            var copyBtn = e.target.closest('[data-copy-fp]');
            if (copyBtn) {
                e.stopPropagation();
                copySingleFingerprint(copyBtn.closest('.sql-query-history-row'));
                return;
            }
            var sel = window.getSelection();
            if (sel && sel.toString().length > 0) return;
            var row = e.target.closest('.sql-query-history-row');
            if (!row) {
                var tr = e.target.closest('#sql-query-history-tbody tr');
                if (tr) row = tr.querySelector('.sql-query-history-row');
            }
            if (row) toggleSqlHistoryRow(row);
        });
        listEl.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var row = e.target.closest('.sql-query-history-row');
            if (row) { e.preventDefault(); toggleSqlHistoryRow(row); }
        });
    }
    if (sortHeaderEls && sortHeaderEls.length) {
        for (var i = 0; i < sortHeaderEls.length; i++) {
            (function(el) {
                function handleSortActivate(e) {
                    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
                    /* Disabled when there's no captured SQL — ignore so the header can't silently no-op. */
                    if (el.getAttribute('aria-disabled') === 'true') return;
                    e.preventDefault();
                    var key = el.getAttribute('data-sql-qh-sort');
                    if (!key) return;
                    if (sortKey === key) {
                        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortKey = key;
                        sortDir = 'asc';
                    }
                    renderSqlQueryHistoryPanel();
                }
                el.addEventListener('click', handleSortActivate);
                el.addEventListener('keydown', handleSortActivate);
            })(sortHeaderEls[i]);
        }
        updateSqlHistorySortHeaders();
    }
    if (searchEl) {
        searchEl.addEventListener('input', function() { renderSqlQueryHistoryPanel(); });
        searchEl.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { e.preventDefault(); closeSqlQueryHistoryPanel(); }
        });
    }
    /* DB_18: "Current session only" filter (inverts DB_17's cumulative toggle — cumulative is now the
       default). Initial checked state mirrors the persisted preference loaded in
       viewer-sql-query-history-core.ts. The wrap is shown/hidden by updateSqlHistoryCumulativeUi
       depending on whether the host has supplied any cross-log data. */
    var currentSessionOnlyEl = document.getElementById('sql-query-history-current-session-only');
    if (currentSessionOnlyEl) {
        currentSessionOnlyEl.checked = !!sqlQueryHistoryCurrentSessionOnly;
        currentSessionOnlyEl.addEventListener('change', function() {
            setSqlQueryHistoryCurrentSessionOnly(!!currentSessionOnlyEl.checked);
            renderSqlQueryHistoryPanel();
        });
    }
    var closeBtn = document.getElementById('sql-query-history-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSqlQueryHistoryPanel);
    var copyBtn = document.getElementById('sql-query-history-copy');
    if (copyBtn) copyBtn.addEventListener('click', function() { copyVisibleSqlHistoryJson(); });
    var openViewerBtn = document.getElementById('sql-query-history-open-viewer');
    if (openViewerBtn) {
        openViewerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
                vscodeApi.postMessage({ type: 'openUrl', url: driftViewerBaseUrl() + '/' });
            }
        });
    }

    if (panelEl) {
        panelEl.addEventListener('click', function(e) {
            e.stopPropagation();
            /* Phase 2: "Open fix in Drift" on a dashboard issue row opens the suggested SQL in the
               Drift viewer's Run SQL tab (same openUrl path the per-row Drift button uses). */
            var fixBtn = e.target.closest('.sql-qh-issue-fix');
            if (fixBtn) {
                var sql = fixBtn.getAttribute('data-issue-sql') || '';
                if (sql && typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
                    vscodeApi.postMessage({ type: 'openUrl', url: driftViewerBaseUrl() + '/?sql=' + encodeURIComponent(sql) });
                }
                return;
            }
            /* Phase 3: "Enable Drift linters" opens a terminal pre-filled with the saropa_lints CLI. */
            if (e.target.closest('.sql-qh-lint-enable') && typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
                vscodeApi.postMessage({ type: 'enableDriftLintPack' });
            }
        });
        panelEl.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { e.preventDefault(); closeSqlQueryHistoryPanel(); }
        });
    }
    document.addEventListener('click', function(e) {
        if (!sqlQueryHistoryPanelOpen) return;
        if (panelEl && panelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-sql-query-history');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeSqlQueryHistoryPanel();
    });

    var driftStatusEl = document.getElementById('sql-query-history-drift-status');
    function updateSqlQueryHistoryDriftStatusImpl() {
        if (!driftStatusEl) return;
        var d = typeof window !== 'undefined' ? window.driftDebugServerFromLog : null;
        if (!d || !d.baseUrl) {
            driftStatusEl.textContent = '';
            driftStatusEl.classList.add('u-hidden');
            return;
        }
        driftStatusEl.classList.remove('u-hidden');
        var parts = ['Drift viewer (from log): ' + d.baseUrl];
        /* Join is '' below, so every part after the base URL must carry its own ' · ' separator.
           Without it the banner version abutted the URL ("…8642banner v3.5.1"). */
        if (d.version) parts.push(' · banner v' + d.version);
        if (d.health) {
            if (d.health.ok) {
                parts.push(d.health.version ? (' · server ' + d.health.version + ' · reachable') : ' · reachable');
            } else {
                parts.push(' · unreachable' + (d.health.error ? (' (' + d.health.error + ')') : ''));
            }
        } else {
            parts.push(' · checking reachability\u2026');
        }
        driftStatusEl.textContent = parts.join('');
    }
    if (typeof window !== 'undefined') window.updateSqlQueryHistoryDriftStatus = updateSqlQueryHistoryDriftStatusImpl;
    updateSqlQueryHistoryDriftStatusImpl();
})();
`;
}
