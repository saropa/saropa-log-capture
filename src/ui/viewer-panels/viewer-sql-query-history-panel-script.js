"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSqlQueryHistoryPanelScript = getSqlQueryHistoryPanelScript;
/**
 * Injected SQL query history panel script (DB_11): sort, search, jump; uses globals from viewer-sql-query-history-core.
 * Behavior: open/close, render, filter, copy, Esc.
 */
function getSqlQueryHistoryPanelScript() {
    return /* javascript */ `
(function() {
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
    function renderSqlQueryHistoryPanel() {
        if (!listEl || !tbodyEl || !emptyEl) return;
        var q = (searchEl && searchEl.value ? searchEl.value : '').toLowerCase().trim();
        var rows = getSqlQueryHistoryRowsForRender();
        rows = sortSqlHistoryRows(rows);
        var filtered = [];
        var i, r;
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            if (!q) { filtered.push(r); continue; }
            if (r.fp.toLowerCase().indexOf(q) >= 0 || (r.preview && r.preview.toLowerCase().indexOf(q) >= 0)) {
                filtered.push(r);
            }
        }
        if (filtered.length === 0) {
            tbodyEl.innerHTML = '';
            emptyEl.classList.remove('u-hidden');
            emptyEl.textContent = rows.length === 0
                ? 'No parsed SQL fingerprints in this session yet.'
                : 'No rows match your filter.';
            return;
        }
        emptyEl.classList.add('u-hidden');
        var expandedFps = {};
        var openRows = tbodyEl.querySelectorAll('.sql-query-history-row[aria-expanded="true"]');
        for (var j = 0; j < openRows.length; j++) {
            var efp = openRows[j].getAttribute('data-fingerprint');
            if (efp) expandedFps[efp] = true;
        }
        var parts = [];
        for (i = 0; i < filtered.length; i++) {
            r = filtered[i];
            var durTxt = r.maxDur !== undefined ? String(r.maxDur) + ' ms' : '\u2014';
            var expandSrc = (r.sampleSql && r.sampleSql.length) ? r.sampleSql : r.fp;
            parts.push('<tr>'
                + '<td class="sql-qh-cell-count"><span class="sql-query-history-count">' + r.count + '</span></td>'
                + '<td class="sql-qh-cell-preview"><div class="sql-query-history-row" role="button" tabindex="0" aria-expanded="false"'
                + ' data-first-idx="' + r.firstIdx + '" data-fingerprint="' + escapeHtml(r.fp) + '">'
                + '<div class="sql-query-history-preview">' + escapeHtml(r.preview || r.fp) + '</div>'
                + '<div class="sql-query-history-expanded u-hidden">'
                + '<pre class="sql-query-history-sql">' + escapeHtml(formatSqlForExpand(expandSrc)) + '</pre>'
                + '<div class="sql-query-history-row-actions">'
                + '<button type="button" class="sql-query-history-jump" title="Jump to first occurrence">'
                + 'Line ' + (r.firstIdx + 1) + ' \\u2197</button>'
                + '<button type="button" class="sql-qh-action-btn sql-query-history-drift" title="Open in Drift viewer (Run SQL tab)">'
                + '<span class="codicon codicon-link-external"></span></button>'
                + '<button type="button" class="sql-qh-action-btn" data-copy-fp title="Copy fingerprint">'
                + '<span class="codicon codicon-copy"></span></button>'
                + '</div></div>'
                + '</div></td>'
                + '<td class="sql-qh-cell-dur"><span class="sql-query-history-dur">' + escapeHtml(durTxt) + '</span></td>'
                + '</tr>');
        }
        tbodyEl.innerHTML = parts.join('');
        var newRows = tbodyEl.querySelectorAll('.sql-query-history-row');
        for (var j = 0; j < newRows.length; j++) {
            var nfp = newRows[j].getAttribute('data-fingerprint');
            if (nfp && expandedFps[nfp]) toggleSqlHistoryRow(newRows[j]);
        }
        updateSqlHistorySortHeaders();
    }
    window.refreshSqlQueryHistoryPanelIfOpen = function() {
        if (sqlQueryHistoryPanelOpen) renderSqlQueryHistoryPanel();
    };

    window.openSqlQueryHistoryPanel = function() {
        if (!panelEl) return;
        sqlQueryHistoryPanelOpen = true;
        panelEl.classList.add('visible');
        setSqlHistoryHint('', false);
        renderSqlQueryHistoryPanel();
        if (typeof window !== 'undefined' && typeof window.updateSqlQueryHistoryDriftStatus === 'function') {
            window.updateSqlQueryHistoryDriftStatus();
        }
        if (searchEl) searchEl.focus();
    };
    window.closeSqlQueryHistoryPanel = function() {
        if (!panelEl) return;
        panelEl.classList.remove('visible');
        sqlQueryHistoryPanelOpen = false;
        setSqlHistoryHint('', false);
        if (typeof clearActivePanel === 'function') clearActivePanel('sqlHistory');
        if (typeof logEl !== 'undefined' && logEl) logEl.focus();
    };
    function jumpSqlHistoryRow(rowEl) {
        if (!rowEl) return;
        var idx = parseInt(rowEl.getAttribute('data-first-idx') || '-1', 10);
        if (!isFinite(idx) || idx < 0) return;
        var hidden = typeof sqlHistoryTargetLineLikelyHidden === 'function' && sqlHistoryTargetLineLikelyHidden(idx);
        if (typeof scrollToLineNumber === 'function') scrollToLineNumber(idx + 1);
        if (hidden) {
            setSqlHistoryHint('Jumped to line ' + (idx + 1) + '. That line may be hidden until filters or layout change.', true);
        } else {
            setSqlHistoryHint('', false);
        }
    }
    function copyVisibleSqlHistoryJson() {
        var q = (searchEl && searchEl.value ? searchEl.value : '').toLowerCase().trim();
        var rows = sortSqlHistoryRows(getSqlQueryHistoryRowsForRender());
        var payload = [];
        var i, r;
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            if (q && r.fp.toLowerCase().indexOf(q) < 0 && (!r.preview || r.preview.toLowerCase().indexOf(q) < 0)) continue;
            payload.push({
                fingerprint: r.fp,
                count: r.count,
                firstLineIndex: r.firstIdx,
                lastLineIndex: r.lastIdx,
                lastSeen: r.lastSeen,
                preview: r.preview,
                sampleSql: r.sampleSql,
                maxDurationMs: r.maxDur
            });
        }
        var text = JSON.stringify(payload, null, 2);
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        }
        setSqlHistoryHint('Copied ' + payload.length + (payload.length === 1 ? ' row' : ' rows') + ' to clipboard.', true);
        clearTimeout(sqlHistoryHintTimer);
        sqlHistoryHintTimer = setTimeout(function() { setSqlHistoryHint('', false); }, 2000);
    }
    function copySingleFingerprint(rowEl) {
        if (!rowEl) return;
        var fp = rowEl.getAttribute('data-fingerprint') || '';
        if (!fp) return;
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            vscodeApi.postMessage({ type: 'copyToClipboard', text: fp });
        }
        setSqlHistoryHint('Copied fingerprint.', true);
        clearTimeout(sqlHistoryHintTimer);
        sqlHistoryHintTimer = setTimeout(function() { setSqlHistoryHint('', false); }, 2000);
    }
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
        panelEl.addEventListener('click', function(e) { e.stopPropagation(); });
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
        if (d.version) parts.push('banner v' + d.version);
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
//# sourceMappingURL=viewer-sql-query-history-panel-script.js.map