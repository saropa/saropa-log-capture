"use strict";
/**
 * SQL query history panel: render, open/close, jump, and copy actions.
 * Returns a JS fragment concatenated inside the panel IIFE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSqlQueryHistoryPanelRenderScript = getSqlQueryHistoryPanelRenderScript;
/** Returns render, open/close, jump, and copy functions for the SQL history panel. */
function getSqlQueryHistoryPanelRenderScript() {
    return /* javascript */ `
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
`;
}
//# sourceMappingURL=viewer-sql-query-history-panel-render.js.map