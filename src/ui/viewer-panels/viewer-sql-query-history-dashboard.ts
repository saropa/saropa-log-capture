/**
 * SQL query history dashboard (plan **DB_18 Phase 2**): stat cards + a top-queries bar chart.
 *
 * Pure webview render computed from data the panel ALREADY holds client-side — the merged rows from
 * `getSqlQueryHistoryRowsForRender()` and the cumulative payload. No host round-trip, no fetch, so it
 * costs nothing beyond the rows already in memory. Concatenated inside the panel IIFE, so it shares
 * scope with the helpers/render (escapeHtml, vt, sqlQueryHistoryByFp, sqlQueryHistoryCumulative).
 */

/** How many bars the top-queries chart shows. Kept small so the strip stays compact above the table. */
const SQL_HISTORY_CHART_TOP_N = 8;

/** Returns the dashboard render functions for the SQL history panel (stat cards + bar chart). */
export function getSqlQueryHistoryDashboardScript(): string {
    return /* javascript */ `
    /* DB_18 Phase 2: last Drift Advisor /api/issues result (index suggestions + anomalies), or null
       when no server is reachable. Stored at panel scope so it survives table re-renders. */
    var sqlHistoryDriftDbIssues = null;
    /* DB_18 Phase 3: last Saropa Lints Drift-rule result { violations, suggestEnablePack, tier }. */
    var sqlHistoryDriftLint = null;
    /* R5 (suite deep-link OUT): which sibling commands the host says are live. Defaults all-off so
       no button renders until the host confirms the target command exists — never a dead action. */
    var suiteDeepLink = { explainSql: false, openTable: false, explainRule: false, enableRule: false };
    /* Ask the host which sibling deep-link buttons are safe to show. Called on each panel open. */
    function maybeRequestSuiteDeepLinks() {
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            vscodeApi.postMessage({ type: 'requestSuiteDeepLinkAvailability' });
        }
    }
    if (typeof window !== 'undefined') {
        window.applySuiteDeepLinkAvailability = function(msg) {
            suiteDeepLink = {
                explainSql: !!(msg && msg.explainSql), openTable: !!(msg && msg.openTable),
                explainRule: !!(msg && msg.explainRule), enableRule: !!(msg && msg.enableRule),
            };
            /* Re-render the enrichment sections so newly-available buttons appear without a reopen. */
            renderSqlHistoryIssuesSection();
            renderSqlHistoryLintSection();
            if (typeof renderSqlQueryHistoryPanel === 'function') renderSqlQueryHistoryPanel();
        };
        /* Own message listener, kept out of the over-budget central message switch. */
        window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'suiteDeepLinkAvailability') window.applySuiteDeepLinkAvailability(e.data);
        });
    }
    /* Source attribution chip so a row reads as the sibling tool's finding, not a Log Capture one. */
    function sqlHistorySourceBadge(labelKey) {
        return '<span class="sql-qh-src-badge">' + escapeHtml(vt(labelKey)) + '</span>';
    }
    /* Number of distinct logs feeding the panel: cross-log contributors plus the active log when it
       has live rows. Scoped to just the active log when the "Current session only" filter is on. */
    function computeSqlHistoryLogCount() {
        var cum = (sqlQueryHistoryCumulative && typeof sqlQueryHistoryCumulative.contributingLogCount === 'number')
            ? sqlQueryHistoryCumulative.contributingLogCount : 0;
        var live = (typeof sqlQueryHistoryByFp === 'object' && Object.keys(sqlQueryHistoryByFp).length > 0) ? 1 : 0;
        return sqlQueryHistoryCurrentSessionOnly ? live : (cum + live);
    }
    /* Aggregate the merged rows into the four headline numbers. Executions sums occurrence counts;
       slowest takes the max recorded duration (rows without a duration contribute nothing). */
    function computeSqlHistoryStats(rows) {
        var executions = 0, slowest = -1, i, r;
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            executions += (typeof r.count === 'number' ? r.count : 0);
            if (typeof r.maxDur === 'number' && r.maxDur > slowest) slowest = r.maxDur;
        }
        return { distinct: rows.length, executions: executions, slowest: slowest, logs: computeSqlHistoryLogCount() };
    }
    function sqlHistoryStatCard(value, labelKey) {
        return '<div class="sql-qh-stat"><span class="sql-qh-stat-val">' + escapeHtml(value)
            + '</span><span class="sql-qh-stat-label">' + escapeHtml(vt(labelKey)) + '</span></div>';
    }
    function renderSqlHistoryStatCards(stats) {
        var slow = stats.slowest >= 0 ? stats.slowest.toLocaleString() : '\\u2014';
        return sqlHistoryStatCard(stats.distinct.toLocaleString(), 'viewer.sqlHistory.stat.queries')
            + sqlHistoryStatCard(stats.executions.toLocaleString(), 'viewer.sqlHistory.stat.executions')
            + sqlHistoryStatCard(slow, 'viewer.sqlHistory.stat.slowest')
            + sqlHistoryStatCard(stats.logs.toLocaleString(), 'viewer.sqlHistory.stat.logs');
    }
    /* Top-N rows by execution count as horizontal bars. Bar width is relative to the busiest query so
       the chart reads as "which shapes dominate" rather than absolute scale. */
    function renderSqlHistoryChartRows(rows) {
        var top = rows.slice().sort(function(a, b) { return (b.count || 0) - (a.count || 0); }).slice(0, ${SQL_HISTORY_CHART_TOP_N});
        if (top.length === 0) return '';
        var max = top[0].count || 1, parts = ['<div class="sql-qh-chart-title">' + escapeHtml(vt('viewer.sqlHistory.chart.title')) + '</div>'], i, r, pct, label;
        for (i = 0; i < top.length; i++) {
            r = top[i];
            pct = Math.max(2, Math.round(((r.count || 0) / max) * 100));
            label = r.preview || r.fp || '';
            parts.push('<div class="sql-qh-chart-row"><span class="sql-qh-chart-label" title="' + escapeHtml(label) + '">'
                + escapeHtml(label) + '</span><span class="sql-qh-chart-track"><span class="sql-qh-chart-bar" style="width:' + pct + '%"></span></span>'
                + '<span class="sql-qh-chart-num">' + escapeHtml((r.count || 0).toLocaleString()) + '</span></div>');
        }
        return parts.join('');
    }
    /* Fill the dashboard strip and show it only when there is data. Called from renderSqlQueryHistoryPanel
       with the SAME merged rows the table uses, so stats and table never disagree. */
    function renderSqlHistoryDashboard(rows) {
        var wrap = document.getElementById('sql-query-history-dashboard');
        var statsEl = document.getElementById('sql-query-history-stats');
        var chartEl = document.getElementById('sql-query-history-chart');
        if (!wrap || !statsEl || !chartEl) return;
        if (!rows || rows.length === 0) { wrap.classList.add('u-hidden'); return; }
        wrap.classList.remove('u-hidden');
        statsEl.innerHTML = renderSqlHistoryStatCards(computeSqlHistoryStats(rows));
        chartEl.innerHTML = renderSqlHistoryChartRows(rows);
        renderSqlHistoryIssuesSection();
        renderSqlHistoryLintSection();
    }
    /* Loading / error states for the two async Drift enrichment fetches. Without these, an in-flight
       fetch showed nothing and a failed one was silently hidden (violates "no silent async") — so a
       reachable Drift server whose issues request errored looked identical to "no issues found". The
       status line above reports server reachability; these report the enrichment requests themselves. */
    function setSqlHistoryAsyncState(elId, cls, text, detail) {
        var el = document.getElementById(elId);
        if (!el) return;
        el.classList.remove('u-hidden');
        el.innerHTML = '<div class="sql-qh-async ' + cls + '">' + escapeHtml(text)
            + (detail ? ' <span class="sql-qh-async-detail">(' + escapeHtml(detail) + ')</span>' : '') + '</div>';
    }
    /* Ask the host for the Drift server's issues, but only when we already know a server is reachable
       (its health check passed) — avoids firing a fetch at a dead default port on every panel open. */
    function maybeFetchDriftDbIssues() {
        var d = (typeof window !== 'undefined') ? window.driftDebugServerFromLog : null;
        if (!d || !d.baseUrl || !d.health || !d.health.ok) return;
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            setSqlHistoryAsyncState('sql-query-history-issues', 'sql-qh-async-loading', vt('viewer.sqlHistory.issues.loading'), '');
            vscodeApi.postMessage({ type: 'fetchDriftDbIssues', baseUrl: d.baseUrl });
        }
    }
    /* Host reply handler, exposed globally so the message dispatcher outside this IIFE can call it.
       Guarded so the script still loads in the bare VM used by unit tests (no window there). */
    if (typeof window !== 'undefined') {
        window.applyDriftDbIssuesFromHost = function(msg) {
            /* ok===false is an explicit fetch failure (unreachable mid-request, bad response). Surface it
               instead of hiding, so the user knows suggestions are missing because of an error, not absence. */
            if (msg && msg.ok === false) {
                sqlHistoryDriftDbIssues = null;
                setSqlHistoryAsyncState('sql-query-history-issues', 'sql-qh-async-error', vt('viewer.sqlHistory.issues.error'), msg.error || '');
                return;
            }
            sqlHistoryDriftDbIssues = (msg && msg.ok && msg.issues && msg.issues.length) ? msg.issues : null;
            renderSqlHistoryIssuesSection();
        };
    }
    function sqlHistoryIssueRow(issue) {
        var sevClass = 'sql-qh-issue-' + (issue.severity === 'warning' ? 'warning' : 'info');
        var loc = issue.table ? (issue.column ? (issue.table + '.' + issue.column) : issue.table) : '';
        var fixBtn = issue.suggestedSql
            ? '<button type="button" class="sql-qh-issue-fix" data-issue-sql="' + escapeHtml(issue.suggestedSql)
                + '" title="' + escapeHtml(vt('viewer.sqlHistory.issues.openFix')) + '"><span class="codicon codicon-link-external"></span></button>'
            : '';
        return '<div class="sql-qh-issue ' + sevClass + '">'
            + sqlHistorySourceBadge('viewer.sqlHistory.source.advisor')
            + (loc ? '<span class="sql-qh-issue-loc">' + escapeHtml(loc) + '</span>' : '')
            + '<span class="sql-qh-issue-msg">' + escapeHtml(issue.message) + '</span>' + fixBtn + '</div>';
    }
    /* Render the issues sub-section from the stored result; hide it entirely when there are none. */
    function renderSqlHistoryIssuesSection() {
        var el = document.getElementById('sql-query-history-issues');
        if (!el) return;
        if (!sqlHistoryDriftDbIssues || sqlHistoryDriftDbIssues.length === 0) {
            el.classList.add('u-hidden');
            el.innerHTML = '';
            return;
        }
        el.classList.remove('u-hidden');
        var parts = ['<div class="sql-qh-issues-title">' + escapeHtml(vt('viewer.sqlHistory.issues.title')) + '</div>'];
        for (var i = 0; i < sqlHistoryDriftDbIssues.length; i++) parts.push(sqlHistoryIssueRow(sqlHistoryDriftDbIssues[i]));
        el.innerHTML = parts.join('');
    }
    /* Phase 3: ask the host for Saropa Lints Drift-rule findings. usesDrift = the panel has captured
       Drift SQL, which is a strong signal the project uses Drift (drives the enable-pack advice). */
    function maybeFetchDriftLintViolations() {
        var usesDrift = (typeof getSqlQueryHistoryRowsForRender === 'function') && getSqlQueryHistoryRowsForRender().length > 0;
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            setSqlHistoryAsyncState('sql-query-history-lint', 'sql-qh-async-loading', vt('viewer.sqlHistory.lint.loading'), '');
            vscodeApi.postMessage({ type: 'fetchDriftLintViolations', usesDrift: usesDrift });
        }
    }
    if (typeof window !== 'undefined') {
        window.applyDriftLintViolationsFromHost = function(msg) {
            /* The host posts { error } when the lint scan throws (e.g. project read failed). Surface it
               rather than leaving the loading line spinning or the section silently empty. */
            if (msg && msg.error) {
                sqlHistoryDriftLint = null;
                setSqlHistoryAsyncState('sql-query-history-lint', 'sql-qh-async-error', vt('viewer.sqlHistory.lint.error'), msg.error);
                return;
            }
            sqlHistoryDriftLint = msg || null;
            renderSqlHistoryLintSection();
        };
    }
    function sqlHistoryLintRow(v) {
        var sev = 'sql-qh-issue-' + (v.severity === 'error' || v.severity === 'warning' ? 'warning' : 'info');
        var loc = v.file ? (v.line ? (v.file + ':' + v.line) : v.file) : '';
        /* R5: "Show rule" jumps into Saropa Lints' rule explanation. Shown only when that command is
           live (suiteDeepLink.explainRule) AND the row names a rule — otherwise it would be a dead action. */
        var ruleBtn = (suiteDeepLink.explainRule && v.rule)
            ? '<button type="button" class="sql-qh-action-btn sql-qh-rule-explain" data-rule="' + escapeHtml(v.rule)
                + '" title="' + escapeHtml(vt('viewer.sqlHistory.lint.showRuleTitle')) + '"><span class="codicon codicon-link-external"></span></button>'
            : '';
        return '<div class="sql-qh-issue ' + sev + '">'
            + sqlHistorySourceBadge('viewer.sqlHistory.source.lints')
            + '<span class="sql-qh-issue-loc">' + escapeHtml(v.rule)
            + '</span><span class="sql-qh-issue-msg" title="' + escapeHtml(loc) + '">' + escapeHtml(v.message) + '</span>' + ruleBtn + '</div>';
    }
    /* Render the static-code (Saropa Lints) section: Drift-rule violations and/or the "enable the Drift
       pack" advice. Hidden when there is neither. The enable button posts enableDriftLintPack. */
    function renderSqlHistoryLintSection() {
        var el = document.getElementById('sql-query-history-lint');
        if (!el) return;
        var data = sqlHistoryDriftLint;
        var hasViol = !!(data && data.violations && data.violations.length);
        var suggest = !!(data && data.suggestEnablePack);
        if (!hasViol && !suggest) { el.classList.add('u-hidden'); el.innerHTML = ''; return; }
        el.classList.remove('u-hidden');
        var parts = ['<div class="sql-qh-lint-title">' + escapeHtml(vt('viewer.sqlHistory.lint.title')) + '</div>'];
        if (suggest) {
            parts.push('<div class="sql-qh-lint-advice"><span class="sql-qh-lint-advice-msg">' + escapeHtml(vt('viewer.sqlHistory.lint.advice'))
                + '</span><button type="button" class="sql-qh-lint-enable" title="' + escapeHtml(vt('viewer.sqlHistory.lint.enableTitle')) + '">'
                + escapeHtml(vt('viewer.sqlHistory.lint.enableBtn')) + '</button></div>');
        }
        if (hasViol) for (var i = 0; i < data.violations.length; i++) parts.push(sqlHistoryLintRow(data.violations[i]));
        el.innerHTML = parts.join('');
    }
`;
}
