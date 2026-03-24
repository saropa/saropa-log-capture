/**
 * DB_11: panel script wires jump-to-line (documented filter hint) and Escape to close.
 */
import * as assert from 'node:assert';
import { getSqlQueryHistoryPanelScript } from '../../ui/viewer-panels/viewer-sql-query-history-panel';

suite('viewer-sql-query-history panel script', () => {
    test('row jump uses scrollToLineNumber and hidden-line hint text', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('scrollToLineNumber'));
        assert.ok(s.includes('sqlHistoryTargetLineLikelyHidden'));
        assert.ok(s.includes('Jumped to line'));
        assert.ok(s.includes('hidden until filters'));
    });

    test('Escape closes panel from search input and panel keydown', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("e.key === 'Escape'"));
        assert.ok(s.includes('closeSqlQueryHistoryPanel'));
    });
});
