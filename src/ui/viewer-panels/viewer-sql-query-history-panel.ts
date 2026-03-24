/**
 * Slide-out SQL query history panel (plan DB_11): session fingerprints, sort, search, jump-to-line.
 *
 * Depends on globals from `viewer-sql-query-history-core.ts` (record/rebuild/reset).
 */

/** Panel HTML in `#panel-slot` (same slide-out pattern as bookmarks). */
export function getSqlQueryHistoryPanelHtml(): string {
    return /* html */ `
<div id="sql-query-history-panel" class="sql-query-history-panel">
    <div class="sql-query-history-header">
        <span>SQL query history</span>
        <div class="sql-query-history-actions">
            <button type="button" id="sql-query-history-copy" class="sql-query-history-action" title="Copy visible rows as JSON">
                <span class="codicon codicon-copy"></span>
            </button>
            <button type="button" id="sql-query-history-close" class="sql-query-history-close" title="Close">
                <span class="codicon codicon-close"></span>
            </button>
        </div>
    </div>
    <div class="sql-query-history-toolbar">
        <label class="sql-query-history-sort-label" for="sql-query-history-sort">Sort</label>
        <select id="sql-query-history-sort" title="Sort order">
            <option value="count">Count</option>
            <option value="recency">Recency</option>
            <option value="maxDur">Slowest (max ms)</option>
        </select>
        <input id="sql-query-history-search" type="search" placeholder="Filter by fingerprint or preview\u2026" />
    </div>
    <div id="sql-query-history-hint" class="sql-query-history-hint u-hidden" role="status" aria-live="polite"></div>
    <div id="sql-query-history-list" class="sql-query-history-list"></div>
    <div id="sql-query-history-empty" class="sql-query-history-empty">No parsed SQL fingerprints in this session yet.</div>
</div>`;
}

/** Panel behavior: open/close, render, sort, filter, copy, jump, Esc. */
export function getSqlQueryHistoryPanelScript(): string {
    return /* javascript */ `
(function() {
    function escAttr(str) { return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    var panelEl = document.getElementById('sql-query-history-panel');
    var listEl = document.getElementById('sql-query-history-list');
    var emptyEl = document.getElementById('sql-query-history-empty');
    var sortEl = document.getElementById('sql-query-history-sort');
    var searchEl = document.getElementById('sql-query-history-search');
    var hintEl = document.getElementById('sql-query-history-hint');
    var sqlQueryHistoryPanelOpen = false;

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

    function getSqlQueryHistoryRowsForRender() {
        var fp, row, rows = [];
        for (fp in sqlQueryHistoryByFp) {
            if (!Object.prototype.hasOwnProperty.call(sqlQueryHistoryByFp, fp)) continue;
            row = sqlQueryHistoryByFp[fp];
            rows.push({ fp: fp, count: row.count, firstIdx: row.firstIdx, lastIdx: row.lastIdx,
                lastSeen: row.lastSeen, preview: row.preview || '', maxDur: row.maxDur });
        }
        return rows;
    }

    function sortSqlHistoryRows(rows, mode) {
        var out = rows.slice();
        if (mode === 'recency') {
            out.sort(function(a, b) { return (b.lastSeen || 0) - (a.lastSeen || 0); });
        } else if (mode === 'maxDur') {
            out.sort(function(a, b) {
                var ad = a.maxDur !== undefined ? a.maxDur : -1;
                var bd = b.maxDur !== undefined ? b.maxDur : -1;
                if (bd !== ad) return bd - ad;
                return b.count - a.count;
            });
        } else {
            out.sort(function(a, b) { return b.count - a.count; });
        }
        return out;
    }

    function renderSqlQueryHistoryPanel() {
        if (!listEl || !emptyEl) return;
        var q = (searchEl && searchEl.value ? searchEl.value : '').toLowerCase().trim();
        var mode = sortEl && sortEl.value ? sortEl.value : 'count';
        var rows = getSqlQueryHistoryRowsForRender();
        rows = sortSqlHistoryRows(rows, mode);
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
            listEl.innerHTML = '';
            emptyEl.style.display = '';
            emptyEl.textContent = rows.length === 0
                ? 'No parsed SQL fingerprints in this session yet.'
                : 'No rows match your filter.';
            return;
        }
        emptyEl.style.display = 'none';
        var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        var parts = [];
        for (i = 0; i < filtered.length; i++) {
            r = filtered[i];
            var durTxt = r.maxDur !== undefined ? String(r.maxDur) + ' ms' : '\u2014';
            parts.push('<div class="sql-query-history-row" role="button" tabindex="0" data-first-idx="' + r.firstIdx
                + '" data-fingerprint="' + escAttr(r.fp) + '">'
                + '<div class="sql-query-history-row-main">'
                + '<span class="sql-query-history-count">' + r.count + '</span>'
                + '<span class="sql-query-history-dur">' + esc(durTxt) + '</span>'
                + '</div>'
                + '<div class="sql-query-history-preview">' + esc(r.preview || r.fp) + '</div>'
                + '<div class="sql-query-history-fp" title="' + escAttr(r.fp) + '">' + esc(r.fp) + '</div>'
                + '</div>');
        }
        listEl.innerHTML = parts.join('');
    }

    window.refreshSqlQueryHistoryPanelIfOpen = function() {
        if (sqlQueryHistoryPanelOpen) renderSqlQueryHistoryPanel();
    };

    window.openSqlQueryHistoryPanel = function() {
        if (!panelEl) return;
        if (typeof rebuildSqlQueryHistoryFromAllLines === 'function') rebuildSqlQueryHistoryFromAllLines();
        sqlQueryHistoryPanelOpen = true;
        panelEl.classList.add('visible');
        setSqlHistoryHint('', false);
        renderSqlQueryHistoryPanel();
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
        var mode = sortEl && sortEl.value ? sortEl.value : 'count';
        var rows = sortSqlHistoryRows(getSqlQueryHistoryRowsForRender(), mode);
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
                maxDurationMs: r.maxDur
            });
        }
        var text = JSON.stringify(payload, null, 2);
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        }
    }

    if (listEl) {
        listEl.addEventListener('click', function(e) {
            var row = e.target.closest('.sql-query-history-row');
            if (row) jumpSqlHistoryRow(row);
        });
        listEl.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var row = e.target.closest('.sql-query-history-row');
            if (row) { e.preventDefault(); jumpSqlHistoryRow(row); }
        });
    }

    if (sortEl) sortEl.addEventListener('change', function() { renderSqlQueryHistoryPanel(); });
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
})();
`;
}
