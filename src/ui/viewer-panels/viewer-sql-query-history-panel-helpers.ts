/**
 * SQL query history panel: DOM refs, state, and utility functions.
 * Returns a JS fragment concatenated inside the panel IIFE.
 */

/** Returns DOM element refs, state vars, and helper functions for the SQL history panel. */
export function getSqlQueryHistoryPanelHelpersScript(): string {
    return /* javascript */ `
    var panelEl = document.getElementById('sql-query-history-panel');
    var listEl = document.getElementById('sql-query-history-list');
    var tbodyEl = document.getElementById('sql-query-history-tbody');
    var emptyEl = document.getElementById('sql-query-history-empty');
    var searchEl = document.getElementById('sql-query-history-search');
    var hintEl = document.getElementById('sql-query-history-hint');
    var sortHeaderEls = document.querySelectorAll('[data-sql-qh-sort]');
    var sqlQueryHistoryPanelOpen = false;
    var sqlHistoryHintTimer = 0;
    var sortKey = 'count';
    var sortDir = 'desc';

    function setSqlHistoryHint(text, show) {
        if (!hintEl) return;
        if (show) {
            hintEl.textContent = text;
            hintEl.classList.remove('u-hidden');
        } else {
            hintEl.textContent = '';
            hintEl.classList.add('u-hidden');
        }
    }
    function driftViewerBaseUrl() {
        var fromLog = typeof window !== 'undefined' && window.driftDebugServerFromLog && window.driftDebugServerFromLog.baseUrl;
        if (fromLog) return String(fromLog);
        var dm = typeof window !== 'undefined' ? window.driftAdvisorDbPanelMeta : null;
        if (dm && dm.baseUrl && typeof dm.baseUrl === 'string') {
            var u = String(dm.baseUrl);
            while (u.length > 1 && u.charAt(u.length - 1) === '/') {
                u = u.slice(0, -1);
            }
            return u;
        }
        return 'http://127.0.0.1:8642';
    }
    function getSqlQueryHistoryRowsForRender() {
        var fp, row, rows = [];
        for (fp in sqlQueryHistoryByFp) {
            if (!Object.prototype.hasOwnProperty.call(sqlQueryHistoryByFp, fp)) continue;
            row = sqlQueryHistoryByFp[fp];
            rows.push({ fp: fp, count: row.count, firstIdx: row.firstIdx, lastIdx: row.lastIdx,
                lastSeen: row.lastSeen, preview: row.preview || '', sampleSql: row.sampleSql || '',
                maxDur: row.maxDur });
        }
        return rows;
    }
    function sortSqlHistoryRows(rows) {
        var out = rows.slice();
        var dir = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'maxDur') {
            out.sort(function(a, b) {
                var ad = a.maxDur !== undefined ? a.maxDur : -1;
                var bd = b.maxDur !== undefined ? b.maxDur : -1;
                if (ad !== bd) return (ad - bd) * dir;
                return (a.count - b.count) * dir;
            });
        } else if (sortKey === 'preview') {
            out.sort(function(a, b) {
                var ap = (a.preview || a.fp || '').toLowerCase();
                var bp = (b.preview || b.fp || '').toLowerCase();
                if (ap < bp) return -1 * dir;
                if (ap > bp) return 1 * dir;
                return (a.count - b.count) * dir;
            });
        } else {
            out.sort(function(a, b) {
                if (a.count !== b.count) return (a.count - b.count) * dir;
                return (a.lastSeen - b.lastSeen) * dir;
            });
        }
        return out;
    }
    function updateSqlHistorySortHeaders() {
        if (!sortHeaderEls) return;
        for (var i = 0; i < sortHeaderEls.length; i++) {
            var el = sortHeaderEls[i];
            var key = el.getAttribute('data-sql-qh-sort');
            el.classList.remove('sql-qh-header-sorted-asc', 'sql-qh-header-sorted-desc');
            if (key === sortKey) {
                el.classList.add(sortDir === 'asc' ? 'sql-qh-header-sorted-asc' : 'sql-qh-header-sorted-desc');
            }
        }
    }
    function formatSqlForExpand(sql) {
        if (!sql) return '';
        var s = sql.replace(/\\s+/g, ' ').trim();
        s = s.replace(/ (FROM|WHERE|SET|VALUES|ORDER BY|GROUP BY|HAVING|LIMIT|RETURNING)\\b/gi, '\\n  $1');
        s = s.replace(/ ((?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL) (?:OUTER )?JOIN|JOIN|ON)\\b/gi, '\\n  $1');
        s = s.replace(/ (AND|OR)\\b/gi, '\\n    $1');
        return s;
    }
    function toggleSqlHistoryRow(rowEl) {
        if (!rowEl) return;
        var isOpen = rowEl.getAttribute('aria-expanded') === 'true';
        var previewEl = rowEl.querySelector('.sql-query-history-preview');
        var expandedEl = rowEl.querySelector('.sql-query-history-expanded');
        if (!previewEl || !expandedEl) return;
        previewEl.classList.toggle('u-hidden', !isOpen);
        expandedEl.classList.toggle('u-hidden', isOpen);
        rowEl.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    }
`;
}
