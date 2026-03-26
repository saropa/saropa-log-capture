/**
 * DB_11: empty-state copy and list mount points exist for the panel shell.
 */
import * as assert from 'node:assert';
import { getSqlQueryHistoryPanelHtml } from '../../ui/viewer-panels/viewer-sql-query-history-panel';

suite('viewer-sql-query-history panel HTML', () => {
    test('exposes empty state and list containers for no-SQL session', () => {
        const html = getSqlQueryHistoryPanelHtml();
        assert.ok(html.includes('id="sql-query-history-empty"'));
        assert.ok(html.includes('No parsed SQL fingerprints in this session yet'));
        assert.ok(html.includes('id="sql-query-history-list"'));
        assert.ok(html.includes('id="sql-query-history-search"'));
        assert.ok(html.includes('id="sql-query-history-tbody"'), 'table body mount should exist');
    });

    test('renders a table header with sortable columns', () => {
        const html = getSqlQueryHistoryPanelHtml();
        assert.ok(html.includes('class="sql-query-history-table"'));
        assert.ok(html.includes('data-sql-qh-sort="count"'));
        assert.ok(html.includes('data-sql-qh-sort="maxDur"'));
        assert.ok(html.includes('data-sql-qh-sort="preview"'));
        assert.ok(!html.includes('id="sql-query-history-sort"'), 'sort dropdown should be removed');
    });
});
