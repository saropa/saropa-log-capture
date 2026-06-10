/**
 * DB_11: panel script wires jump-to-line (documented filter hint), Escape to close,
 * and expand/collapse with formatted SQL.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getSqlQueryHistoryPanelScript } from '../../ui/viewer-panels/viewer-sql-query-history-panel';

/** Extract and run formatSqlForExpand in a VM sandbox. */
function loadFormatter(): (sql: string) => string {
    const src = getSqlQueryHistoryPanelScript();
    const re = /function formatSqlForExpand\(sql\) \{[\s\S]*?\n {4}\}/;
    const match = re.exec(src);
    assert.ok(match, 'formatSqlForExpand not found in script');
    const ctx = vm.createContext({});
    vm.runInContext(match[0], ctx, { timeout: 5_000 });
    return (ctx as unknown as { formatSqlForExpand: (s: string) => string }).formatSqlForExpand;
}

suite('viewer-sql-query-history panel script', () => {
    test('row jump uses scrollToLineNumber and hidden-line hint text', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('scrollToLineNumber'));
        assert.ok(s.includes('sqlHistoryTargetLineLikelyHidden'));
        assert.ok(s.includes('viewer.sqlHistory.jumpedHidden'), 'hidden-line hint wired via l10n key');
    });

    test('DB_18: current-session-only filter wires checkbox change → setSqlQueryHistoryCurrentSessionOnly', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("getElementById('sql-query-history-current-session-only')"),
            'panel script must look up the current-session-only checkbox');
        assert.ok(s.includes('setSqlQueryHistoryCurrentSessionOnly'),
            'change listener must update the persisted preference flag');
        assert.ok(s.includes('updateSqlHistoryCumulativeUi'),
            'render must show/hide the filter wrap based on host-supplied data');
    });

    test('DB_17: cross-log row jump posts sqlHistoryCrossLogJump instead of scrolling locally', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('jumpSqlHistoryCrossLog'), 'cross-log jump helper must exist');
        assert.ok(s.includes("type: 'sqlHistoryCrossLogJump'"),
            'cross-log jump must post the host message that loads the source log first');
        assert.ok(s.includes("data-cross-log"), 'rows tag cross-log status via data attribute');
        assert.ok(s.includes('data-cross-log-uri'), 'rows carry the source log uri for the host to load');
    });

    test('DB_18: empty-state copy distinguishes filter mismatch vs current-session-only vs nothing captured', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('computeSqlHistoryEmptyText'),
            'empty-state helper centralizes the three messages');
        assert.ok(s.includes('viewer.sqlHistory.emptyCurrentSessionOnly'),
            'hint suggests unchecking the filter when other sidebar logs have data');
    });

    test('Escape closes panel from search input and panel keydown', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("e.key === 'Escape'"));
        assert.ok(s.includes('closeSqlQueryHistoryPanel'));
    });

    test('expand/collapse wiring: toggle, aria-expanded, hidden class', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('toggleSqlHistoryRow'));
        assert.ok(s.includes('aria-expanded'));
        assert.ok(s.includes('sql-query-history-expanded'));
        assert.ok(s.includes('sql-query-history-jump'));
    });

    test('rows render with preview and hidden expanded section', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('sql-query-history-preview'));
        assert.ok(s.includes('sql-query-history-expanded u-hidden'));
        assert.ok(s.includes('sql-query-history-sql'));
        assert.ok(s.includes('sql-qh-cell-count'), 'rows should include count cell');
        assert.ok(s.includes('sql-qh-cell-dur'), 'rows should include duration cell');
        assert.ok(s.includes('sql-qh-cell-preview'), 'rows should include preview cell');
    });

    test('duration cell shows raw number without ms suffix', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("String(r.maxDur)"), 'should render numeric maxDur value');
        assert.ok(!s.includes("+ ' ms'"), 'should not append ms suffix to cell text');
    });

    test('header copy shows row count feedback in hint bar', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('copyVisibleSqlHistoryJson'));
        assert.ok(s.includes('viewer.sqlHistory.copiedRows'));
        assert.ok(s.includes('clearTimeout(sqlHistoryHintTimer)'));
    });

    test('per-row copy button wiring: data-copy-fp and copySingleFingerprint', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('data-copy-fp'));
        assert.ok(s.includes('copySingleFingerprint'));
        assert.ok(s.includes('viewer.sqlHistory.copiedFingerprint'));
    });

    test('text selection suppresses row toggle on click', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('window.getSelection'));
        assert.ok(s.includes('.toString().length > 0'));
    });

    test('supports header-click sorting without a dropdown', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("querySelectorAll('[data-sql-qh-sort]')"));
        assert.ok(s.includes('updateSqlHistorySortHeaders'));
        assert.ok(!s.includes('sql-query-history-sort'), 'should not reference removed sort select');
    });

    test('sort headers disable with explanatory tooltip when no SQL captured', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('sql-qh-header-disabled'), 'toggles disabled class on headers');
        assert.ok(s.includes('viewer.sqlHistory.sortDisabled'), 'disabled tooltip wired via l10n key');
        assert.ok(s.includes("getAttribute('aria-disabled') === 'true'"), 'sort handler ignores disabled header');
    });

    test('drift status banner version carries its own separator', () => {
        const s = getSqlQueryHistoryPanelScript();
        // Parts join on '' so banner must prefix ' · ' or it abuts the base URL (…8642banner v…).
        assert.ok(s.includes("' · banner v'"), 'banner part prefixes a separator');
        assert.ok(!s.includes("'banner v'"), 'no separator-less banner part remains');
    });

    test('clicking count/duration cells still toggles the row', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("e.target.closest('#sql-query-history-tbody tr')"));
        assert.ok(s.includes("tr.querySelector('.sql-query-history-row')"));
    });

    test('rows have role="button" for screen reader expand/collapse', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('role="button"'));
    });

    test('expanded state preserved across re-renders', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('expandedFps'), 'should track expanded fingerprints before re-render');
        assert.ok(s.includes('aria-expanded="true"'), 'should query open rows');
        assert.ok(s.includes('toggleSqlHistoryRow(newRows'), 'should re-expand matching rows');
    });

    test('uses escapeHtml instead of local escAttr for data attributes', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('escapeHtml(r.fp)'), 'data-fingerprint should use escapeHtml');
        assert.ok(!s.includes('escAttr'), 'local escAttr should be removed');
    });

    test('copy button has type="button" attribute', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes('type="button" class="sql-qh-action-btn"'));
    });

    test('empty state uses u-hidden class instead of inline display', () => {
        const s = getSqlQueryHistoryPanelScript();
        assert.ok(s.includes("emptyEl.classList.add('u-hidden')"));
        assert.ok(s.includes("emptyEl.classList.remove('u-hidden')"));
        assert.ok(!s.includes("emptyEl.style.display"), 'should not use inline display');
    });
});

suite('formatSqlForExpand (VM)', () => {
    test('should break before FROM, WHERE, SET clauses', () => {
        const fmt = loadFormatter();
        const result = fmt('SELECT * FROM users WHERE id = ?');
        assert.ok(result.includes('\n  FROM'));
        assert.ok(result.includes('\n  WHERE'));
        assert.ok(result.startsWith('SELECT'));
    });

    test('should indent AND/OR under WHERE', () => {
        const fmt = loadFormatter();
        const result = fmt('SELECT * FROM t WHERE a = 1 AND b = 2 OR c = 3');
        assert.ok(result.includes('\n    AND'));
        assert.ok(result.includes('\n    OR'));
    });

    test('should break before JOIN variants', () => {
        const fmt = loadFormatter();
        const result = fmt('SELECT * FROM a LEFT JOIN b ON a.id = b.id');
        assert.ok(result.includes('\n  LEFT JOIN'));
        assert.ok(result.includes('\n  ON'));
    });

    test('should keep INSERT INTO on one line', () => {
        const fmt = loadFormatter();
        const result = fmt('INSERT INTO users VALUES (1, 2)');
        assert.ok(result.startsWith('INSERT INTO'));
    });

    test('should return empty string for empty input', () => {
        const fmt = loadFormatter();
        assert.strictEqual(fmt(''), '');
        assert.strictEqual(fmt(undefined as unknown as string), '');
    });

    test('should normalize internal whitespace', () => {
        const fmt = loadFormatter();
        const result = fmt('SELECT  *   FROM    t');
        assert.ok(!result.includes('  *'));
        assert.ok(result.includes('\n  FROM'));
    });
});
