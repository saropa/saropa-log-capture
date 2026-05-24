/**
 * SQL query history panel: render, open/close, jump, and copy actions.
 * Returns a JS fragment concatenated inside the panel IIFE.
 */

/** Returns render, open/close, jump, and copy functions for the SQL history panel. */
export function getSqlQueryHistoryPanelRenderScript(): string {
    return /* javascript */ `
    function renderSqlQueryHistoryPanel() {
        if (!listEl || !tbodyEl || !emptyEl) return;
        /* DB_17: show/hide the Cumulative toggle wrap based on whether the host has supplied
           any cross-log fingerprint data. Hides cleanly when there are no other sidebar logs. */
        updateSqlHistoryCumulativeUi();
        var q = (searchEl && searchEl.value ? searchEl.value : '').toLowerCase().trim();
        var rows = getSqlQueryHistoryRowsForRender();
        /* Update icon bar badge with total distinct SQL query count (unfiltered). */
        if (typeof updateIconBadge === 'function') updateIconBadge('ib-sql-badge', 'ib-sql-count', rows.length);
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
            emptyEl.textContent = computeSqlHistoryEmptyText(rows.length);
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
            var durTxt = r.maxDur !== undefined ? String(r.maxDur) : '\u2014';
            var expandSrc = (r.sampleSql && r.sampleSql.length) ? r.sampleSql : r.fp;
            /* DB_17: cross-log rows have no live line index (firstIdx === -1) so the jump
               button posts a host message instead of calling scrollToLineNumber directly.
               Use data attributes so the click handler can route correctly without rescanning state. */
            var crossLogAttr = r.crossLog ? ' data-cross-log="1"' : '';
            var crossLogUriAttr = r.crossLog && r.crossLogUriString
                ? ' data-cross-log-uri="' + escapeHtml(r.crossLogUriString) + '"' : '';
            var crossLogLineAttr = r.crossLog && typeof r.crossLogLine === 'number'
                ? ' data-cross-log-line="' + r.crossLogLine + '"' : '';
            var jumpLabel = r.crossLog
                ? (r.crossLogLine >= 0 ? (vt('viewer.sqlHistory.openLogLine', (r.crossLogLine + 1)) + ' \\u2197') : (vt('viewer.sqlHistory.openLog') + ' \\u2197'))
                : (vt('viewer.sqlHistory.jumpLine', (r.firstIdx + 1)) + ' \\u2197');
            var jumpTitle = r.crossLog
                ? vt('viewer.sqlHistory.openLogTitle')
                : vt('viewer.sqlHistory.jumpTitle');
            parts.push('<tr>'
                + '<td class="sql-qh-cell-count"><span class="sql-query-history-count">' + r.count + '</span></td>'
                + '<td class="sql-qh-cell-preview"><div class="sql-query-history-row" role="button" tabindex="0" aria-expanded="false"'
                + ' data-first-idx="' + r.firstIdx + '" data-fingerprint="' + escapeHtml(r.fp) + '"' + crossLogAttr + crossLogUriAttr + crossLogLineAttr + '>'
                + '<div class="sql-query-history-preview">' + escapeHtml(r.preview || r.fp) + '</div>'
                + '<div class="sql-query-history-expanded u-hidden">'
                + '<pre class="sql-query-history-sql">' + escapeHtml(formatSqlForExpand(expandSrc)) + '</pre>'
                + '<div class="sql-query-history-row-actions">'
                + '<button type="button" class="sql-query-history-jump" title="' + jumpTitle + '">'
                + jumpLabel + '</button>'
                + '<button type="button" class="sql-qh-action-btn sql-query-history-drift" title="' + vt('viewer.sqlHistory.openInDrift') + '">'
                + '<span class="codicon codicon-link-external"></span></button>'
                + '<button type="button" class="sql-qh-action-btn" data-copy-fp title="' + vt('viewer.sqlHistory.copyFingerprint') + '">'
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
        /* DB_17: cross-log rows ask the host to switch logs first; the host posts scrollToLine
           after the load completes. We don't try to scroll locally because the line index
           refers to the OTHER log's physical line numbering, not allLines in the current view. */
        if (rowEl.getAttribute('data-cross-log') === '1') {
            jumpSqlHistoryCrossLog(rowEl);
            return;
        }
        var idx = parseInt(rowEl.getAttribute('data-first-idx') || '-1', 10);
        if (!isFinite(idx) || idx < 0) return;
        var hidden = typeof sqlHistoryTargetLineLikelyHidden === 'function' && sqlHistoryTargetLineLikelyHidden(idx);
        if (typeof scrollToLineNumber === 'function') scrollToLineNumber(idx + 1);
        if (hidden) {
            setSqlHistoryHint(vt('viewer.sqlHistory.jumpedHidden', (idx + 1)), true);
        } else {
            setSqlHistoryHint('', false);
        }
    }
    function jumpSqlHistoryCrossLog(rowEl) {
        var uri = rowEl.getAttribute('data-cross-log-uri') || '';
        if (!uri) {
            setSqlHistoryHint(vt('viewer.sqlHistory.noSourceLog'), true);
            return;
        }
        var line = parseInt(rowEl.getAttribute('data-cross-log-line') || '-1', 10);
        if (!isFinite(line) || line < 0) line = 0;
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            vscodeApi.postMessage({ type: 'sqlHistoryCrossLogJump', uriString: uri, line: line });
            setSqlHistoryHint(vt('viewer.sqlHistory.openingLog'), true);
        }
    }
    /** Show or hide the Cumulative toggle wrap based on whether the host has supplied any cross-log data. */
    function updateSqlHistoryCumulativeUi() {
        var wrap = document.getElementById('sql-query-history-cumulative-wrap');
        var checkbox = document.getElementById('sql-query-history-cumulative');
        if (!wrap) return;
        var has = (typeof hasSqlQueryHistoryCumulativeData === 'function') && hasSqlQueryHistoryCumulativeData();
        wrap.classList.toggle('u-hidden', !has);
        if (checkbox && checkbox.checked !== !!sqlQueryHistoryCumulativeEnabled) {
            checkbox.checked = !!sqlQueryHistoryCumulativeEnabled;
        }
    }
    /** Empty-state copy distinguishes "no SQL anywhere" from "filter rejected everything" and from "toggle off + cumulative available". */
    function computeSqlHistoryEmptyText(visibleRowCount) {
        if (visibleRowCount > 0) {
            return vt('viewer.sqlHistory.emptyFilter');
        }
        var hasCum = (typeof hasSqlQueryHistoryCumulativeData === 'function') && hasSqlQueryHistoryCumulativeData();
        if (hasCum && !sqlQueryHistoryCumulativeEnabled) {
            return vt('viewer.sqlHistory.emptyToggleCumulative');
        }
        return vt('viewer.sqlHistory.emptySession');
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
        setSqlHistoryHint(payload.length === 1 ? vt('viewer.sqlHistory.copiedRows.one', payload.length) : vt('viewer.sqlHistory.copiedRows.many', payload.length), true);
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
        setSqlHistoryHint(vt('viewer.sqlHistory.copiedFingerprint'), true);
        clearTimeout(sqlHistoryHintTimer);
        sqlHistoryHintTimer = setTimeout(function() { setSqlHistoryHint('', false); }, 2000);
    }
`;
}
