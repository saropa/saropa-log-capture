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
const assert = __importStar(require("assert"));
const viewer_sql_query_history_core_1 = require("../../ui/viewer-stack-tags/viewer-sql-query-history-core");
suite('viewer-sql-query-history-core', () => {
    test('exports cap constant in documented range', () => {
        assert.ok(viewer_sql_query_history_core_1.SQL_QUERY_HISTORY_MAX_FP >= 100 && viewer_sql_query_history_core_1.SQL_QUERY_HISTORY_MAX_FP <= 5000);
    });
    test('core script wires lifecycle helpers and cap', () => {
        const s = (0, viewer_sql_query_history_core_1.getSqlQueryHistoryCoreScript)();
        assert.ok(s.includes('rebuildSqlQueryHistoryFromAllLines'));
        assert.ok(s.includes('recordSqlQueryHistoryForAppendedItem'));
        assert.ok(s.includes('resetSqlQueryHistory'));
        assert.ok(s.includes('finalizeSqlPatternState'));
        assert.ok(s.includes(`SQL_QUERY_HISTORY_MAX_FP = ${viewer_sql_query_history_core_1.SQL_QUERY_HISTORY_MAX_FP}`));
    });
    test('runtime script is embeddable without lifecycle wrap for tests', () => {
        const r = (0, viewer_sql_query_history_core_1.getSqlQueryHistoryRuntimeScript)();
        assert.ok(r.includes('function rebuildSqlQueryHistoryFromAllLines'));
        assert.ok(!r.includes('wrapSqlPatternLifecycleForQueryHistory'));
    });
    test('parameterized runtime injects alternate cap', () => {
        const r = (0, viewer_sql_query_history_core_1.getSqlQueryHistoryRuntimeScript)(7);
        assert.ok(r.includes('SQL_QUERY_HISTORY_MAX_FP = 7'));
    });
});
//# sourceMappingURL=viewer-sql-query-history-core.test.js.map