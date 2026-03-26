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
 * DB_11: empty-state copy and list mount points exist for the panel shell.
 */
const assert = __importStar(require("node:assert"));
const viewer_sql_query_history_panel_1 = require("../../ui/viewer-panels/viewer-sql-query-history-panel");
suite('viewer-sql-query-history panel HTML', () => {
    test('exposes empty state and list containers for no-SQL session', () => {
        const html = (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelHtml)();
        assert.ok(html.includes('id="sql-query-history-empty"'));
        assert.ok(html.includes('No parsed SQL fingerprints in this session yet'));
        assert.ok(html.includes('id="sql-query-history-list"'));
        assert.ok(html.includes('id="sql-query-history-search"'));
    });
});
//# sourceMappingURL=viewer-sql-query-history-panel-html.test.js.map