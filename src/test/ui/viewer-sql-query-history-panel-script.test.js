"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * DB_11: panel script wires jump-to-line (documented filter hint), Escape to close,
 * and expand/collapse with formatted SQL.
 */
const assert = __importStar(require("node:assert"));
const vm = __importStar(require("node:vm"));
const viewer_sql_query_history_panel_1 = require("../../ui/viewer-panels/viewer-sql-query-history-panel");
suite('viewer-sql-query-history panel script', () => {
    test('row jump uses scrollToLineNumber and hidden-line hint text', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('scrollToLineNumber'));
        assert.ok(s.includes('sqlHistoryTargetLineLikelyHidden'));
        assert.ok(s.includes('Jumped to line'));
        assert.ok(s.includes('hidden until filters'));
    });
    test('Escape closes panel from search input and panel keydown', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes("e.key === 'Escape'"));
        assert.ok(s.includes('closeSqlQueryHistoryPanel'));
    });
    test('expand/collapse wiring: toggle, aria-expanded, hidden class', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('toggleSqlHistoryRow'));
        assert.ok(s.includes('aria-expanded'));
        assert.ok(s.includes('sql-query-history-expanded'));
        assert.ok(s.includes('sql-query-history-jump'));
    });
    test('rows render with preview and hidden expanded section', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('sql-query-history-preview'));
        assert.ok(s.includes('sql-query-history-expanded u-hidden'));
        assert.ok(s.includes('sql-query-history-sql'));
    });
    test('header copy shows row count feedback in hint bar', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('copyVisibleSqlHistoryJson'));
        assert.ok(s.includes('Copied '));
        assert.ok(s.includes('to clipboard.'));
        assert.ok(s.includes('clearTimeout(sqlHistoryHintTimer)'));
    });
    test('per-row copy button wiring: data-copy-fp and copySingleFingerprint', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('data-copy-fp'));
        assert.ok(s.includes('copySingleFingerprint'));
        assert.ok(s.includes('Copied fingerprint.'));
    });
    test('text selection suppresses row toggle on click', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('window.getSelection'));
        assert.ok(s.includes('.toString().length > 0'));
    });
    test('rows have role="button" for screen reader expand/collapse', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('role="button"'));
    });
    test('expanded state preserved across re-renders', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('expandedFps'), 'should track expanded fingerprints before re-render');
        assert.ok(s.includes('aria-expanded="true"'), 'should query open rows');
        assert.ok(s.includes('toggleSqlHistoryRow(newRows'), 'should re-expand matching rows');
    });
    test('uses escapeHtml instead of local escAttr for data attributes', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('escapeHtml(r.fp)'), 'data-fingerprint should use escapeHtml');
        assert.ok(!s.includes('escAttr'), 'local escAttr should be removed');
    });
    test('copy button has type="button" attribute', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes('type="button" class="sql-qh-action-btn"'));
    });
    test('empty state uses u-hidden class instead of inline display', () => {
        const s = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        assert.ok(s.includes("emptyEl.classList.add('u-hidden')"));
        assert.ok(s.includes("emptyEl.classList.remove('u-hidden')"));
        assert.ok(!s.includes("emptyEl.style.display"), 'should not use inline display');
    });
});
suite('formatSqlForExpand (VM)', () => {
    /** Extract and run formatSqlForExpand in a VM sandbox. */
    function loadFormatter() {
        const src = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)();
        const match = src.match(/function formatSqlForExpand\(sql\) \{[\s\S]*?\n    \}/);
        assert.ok(match, 'formatSqlForExpand not found in script');
        const ctx = vm.createContext({});
        vm.runInContext(match[0], ctx, { timeout: 5_000 });
        return ctx.formatSqlForExpand;
    }
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
        assert.strictEqual(fmt(undefined), '');
    });
    test('should normalize internal whitespace', () => {
        const fmt = loadFormatter();
        const result = fmt('SELECT  *   FROM    t');
        assert.ok(!result.includes('  *'));
        assert.ok(result.includes('\n  FROM'));
    });
});
//# sourceMappingURL=viewer-sql-query-history-panel-script.test.js.map