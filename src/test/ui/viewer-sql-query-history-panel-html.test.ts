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
    });
});
