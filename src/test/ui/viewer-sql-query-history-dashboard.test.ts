/**
 * DB_18 Phase 2 — SQL history dashboard stat math + wiring.
 *
 * The render functions touch the DOM, but the aggregation helpers (computeSqlHistoryStats,
 * computeSqlHistoryLogCount) are pure over the merged rows + cumulative globals, so they run in a
 * bare VM with just those globals defined. Also guards that the dashboard is wired into the panel.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getSqlQueryHistoryDashboardScript } from '../../ui/viewer-panels/viewer-sql-query-history-dashboard';
import { getSqlQueryHistoryPanelScript } from '../../ui/viewer-panels/viewer-sql-query-history-panel-script';
import { getSqlQueryHistoryPanelHtml } from '../../ui/viewer-panels/viewer-sql-query-history-panel-html';

interface DashboardSandbox {
    sqlQueryHistoryByFp: Record<string, unknown>;
    sqlQueryHistoryCumulative: unknown;
    sqlQueryHistoryCurrentSessionOnly: boolean;
    computeSqlHistoryStats: (rows: Array<{ count?: number; maxDur?: number }>) => {
        distinct: number; executions: number; slowest: number; logs: number;
    };
    computeSqlHistoryLogCount: () => number;
}

function loadDashboard(): DashboardSandbox {
    const context = vm.createContext({
        sqlQueryHistoryByFp: {},
        sqlQueryHistoryCumulative: null,
        sqlQueryHistoryCurrentSessionOnly: false,
    });
    vm.runInContext(getSqlQueryHistoryDashboardScript(), context, { timeout: 5_000 });
    return context as unknown as DashboardSandbox;
}

suite('viewer SQL history dashboard (DB_18 Phase 2)', () => {
    test('computeSqlHistoryStats sums executions and takes the max duration', () => {
        const ctx = loadDashboard();
        const stats = ctx.computeSqlHistoryStats([{ count: 5, maxDur: 100 }, { count: 2 }, { count: 3, maxDur: 250 }]);
        assert.strictEqual(stats.distinct, 3);
        assert.strictEqual(stats.executions, 10);
        assert.strictEqual(stats.slowest, 250);
    });

    test('slowest is -1 (rendered as a dash) when no row carries a duration', () => {
        const ctx = loadDashboard();
        const stats = ctx.computeSqlHistoryStats([{ count: 1 }, { count: 4 }]);
        assert.strictEqual(stats.slowest, -1);
        assert.strictEqual(stats.executions, 5);
    });

    test('log count = cross-log contributors + the active log when it has live rows', () => {
        const ctx = loadDashboard();
        ctx.sqlQueryHistoryCumulative = { contributingLogCount: 3, missingSummaryLogCount: 0, fingerprints: {} };
        ctx.sqlQueryHistoryByFp = { fpA: { count: 1 } };
        assert.strictEqual(ctx.computeSqlHistoryLogCount(), 4);
    });

    test('current-session-only scopes the log count to just the active log', () => {
        const ctx = loadDashboard();
        ctx.sqlQueryHistoryCumulative = { contributingLogCount: 9, missingSummaryLogCount: 0, fingerprints: {} };
        ctx.sqlQueryHistoryByFp = { fpA: { count: 1 } };
        ctx.sqlQueryHistoryCurrentSessionOnly = true;
        assert.strictEqual(ctx.computeSqlHistoryLogCount(), 1);
    });

    test('dashboard is wired into the panel script and has an HTML mount', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('renderSqlHistoryDashboard'), 'render calls the dashboard');
        assert.ok(s.includes('computeSqlHistoryStats'), 'stat helper is concatenated into the IIFE');
        const html = getSqlQueryHistoryPanelHtml();
        assert.ok(html.includes('id="sql-query-history-dashboard"'), 'dashboard mount exists');
        assert.ok(html.includes('id="sql-query-history-stats"') && html.includes('id="sql-query-history-chart"'),
            'stat + chart sub-mounts exist');
    });

    test('Drift Advisor issues section is wired: fetch trigger, host-apply hook, and HTML mount', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("type: 'fetchDriftDbIssues'"), 'panel posts the issues fetch request');
        assert.ok(s.includes('window.applyDriftDbIssuesFromHost'), 'host reply handler is exposed globally');
        assert.ok(s.includes('renderSqlHistoryIssuesSection'), 'issues section renders from the stored result');
        assert.ok(s.includes('data-issue-sql'), 'index-suggestion rows carry the SQL for Open-in-Drift');
        const html = getSqlQueryHistoryPanelHtml();
        assert.ok(html.includes('id="sql-query-history-issues"'), 'issues mount exists');
    });

    test('issues fetch shows a loading state and surfaces failures instead of hiding silently', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('setSqlHistoryAsyncState'), 'async loading/error state helper is present');
        assert.ok(s.includes('viewer.sqlHistory.issues.loading'), 'a loading line shows while the issues fetch is in flight');
        assert.ok(s.includes('msg.ok === false'), 'an ok=false reply renders the error state rather than hiding the section');
        assert.ok(s.includes('viewer.sqlHistory.issues.error'), 'the issues error state has its own message');
    });

    test('Saropa Lints section is wired: fetch trigger, host-apply hook, enable action, and HTML mount', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("type: 'fetchDriftLintViolations'"), 'panel requests Drift lint findings');
        assert.ok(s.includes('window.applyDriftLintViolationsFromHost'), 'host reply handler is exposed globally');
        assert.ok(s.includes('renderSqlHistoryLintSection'), 'lint section renders from the stored result');
        assert.ok(s.includes("type: 'enableDriftLintPack'"), 'enable button posts the enable-pack action');
        const html = getSqlQueryHistoryPanelHtml();
        assert.ok(html.includes('id="sql-query-history-lint"'), 'lint mount exists');
    });

    test('lint fetch shows a loading state and surfaces failures', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('viewer.sqlHistory.lint.loading'), 'a loading line shows while the lint fetch is in flight');
        assert.ok(s.includes('msg.error'), 'a host { error } reply renders the lint error state');
        assert.ok(s.includes('viewer.sqlHistory.lint.error'), 'the lint error state has its own message');
    });
});
