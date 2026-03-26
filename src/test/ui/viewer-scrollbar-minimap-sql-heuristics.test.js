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
const assert = __importStar(require("node:assert"));
const viewer_scrollbar_minimap_1 = require("../../ui/viewer/viewer-scrollbar-minimap");
const viewer_scrollbar_minimap_sql_heuristics_1 = require("../../ui/viewer/viewer-scrollbar-minimap-sql-heuristics");
suite('viewer-scrollbar-minimap-sql-heuristics', () => {
    suite('isMinimapSqlDensityLine', () => {
        test('database sourceTag counts without keywords', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSqlDensityLine)('database', 'hello'), true);
        });
        test('empty plain and non-database tag does not count', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSqlDensityLine)(undefined, ''), false);
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSqlDensityLine)('terminal', ''), false);
        });
        test('keyword match counts', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSqlDensityLine)(undefined, 'SELECT * FROM t'), true);
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSqlDensityLine)(null, 'pragma journal_mode'), true);
        });
        test('false positive: substring "selection" must not match SELECT token', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSqlDensityLine)(undefined, 'User selection changed'), false);
        });
        test('false positive: unrelated "insert" as substring of longer token', () => {
            assert.strictEqual(viewer_scrollbar_minimap_sql_heuristics_1.MINIMAP_SQL_KEYWORD_RE.test('reinserted'), false);
        });
    });
    suite('isMinimapSlowSqlDensityLine', () => {
        test('performance level on SQL line counts as slow channel', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSlowSqlDensityLine)('performance', 'SELECT 1', 'database'), true);
        });
        test('slow query text after SQL classification counts', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSlowSqlDensityLine)('info', 'Slow query: SELECT 1'), true);
        });
        test('before: slow text alone without SQL must not count (false positive guard)', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSlowSqlDensityLine)('warning', 'Slow query timeout'), false);
        });
        test('after: slow text with keyword counts', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.isMinimapSlowSqlDensityLine)('warning', 'Slow query: SELECT 1'), true);
        });
    });
    suite('minimapSqlDensityBucketIndex', () => {
        test('py 0 maps to bucket 0', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.minimapSqlDensityBucketIndex)(0, 100, 10), 0);
        });
        test('top pixel maps to last bucket', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.minimapSqlDensityBucketIndex)(99, 100, 10), 9);
        });
        test('mmH zero uses minimum divisor 1 (no NaN / invalid bucket)', () => {
            assert.strictEqual((0, viewer_scrollbar_minimap_sql_heuristics_1.minimapSqlDensityBucketIndex)(0, 0, 5), 0);
        });
    });
    suite('injected script stays aligned with heuristics module', () => {
        test('minimap script embeds the same SQL keyword pattern source', () => {
            const script = (0, viewer_scrollbar_minimap_1.getScrollbarMinimapScript)();
            assert.ok(script.includes(viewer_scrollbar_minimap_sql_heuristics_1.MINIMAP_SQL_KEYWORD_RE.toString()), 'injected script should embed MINIMAP_SQL_KEYWORD_RE via .toString()');
        });
    });
});
//# sourceMappingURL=viewer-scrollbar-minimap-sql-heuristics.test.js.map