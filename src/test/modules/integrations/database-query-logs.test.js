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
const database_query_logs_1 = require("../../../modules/integrations/providers/database-query-logs");
suite('database-query-logs', () => {
    suite('parseQueryBlocks', () => {
        test('should detect simple SELECT statement', () => {
            const lines = [
                'Starting request...',
                'SELECT * FROM users WHERE id = 1;',
                'Done.',
            ];
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, '', '', 100);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].lineStart, 1);
            assert.strictEqual(result[0].lineEnd, 1);
            assert.ok(result[0].queryText.includes('SELECT'));
        });
        test('should detect multiple SQL statements', () => {
            const lines = [
                'SELECT id FROM users;',
                'some log line',
                'INSERT INTO orders (user_id) VALUES (1);',
                'UPDATE products SET stock = stock - 1;',
            ];
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, '', '', 100);
            assert.strictEqual(result.length, 3);
        });
        test('should handle multi-line queries with continuation', () => {
            const lines = [
                'SELECT u.id, u.name',
                '  FROM users u',
                '  JOIN orders o ON u.id = o.user_id',
                'Done processing.',
            ];
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, '', '', 100);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].lineStart, 0);
            assert.ok(result[0].lineEnd >= 2);
            assert.ok(result[0].queryText.includes('FROM users'));
        });
        test('should use custom queryBlockPattern', () => {
            const lines = [
                'QUERY: SELECT * FROM table1',
                'QUERY: SELECT * FROM table2',
                'Not a query line',
            ];
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, 'QUERY:', '', 100);
            assert.strictEqual(result.length, 2);
        });
        test('should extract requestId from nearby lines', () => {
            const lines = [
                'requestId=abc-123 Processing request',
                'SELECT * FROM users;',
            ];
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, '', 'requestId=(\\S+)', 100);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].requestId, 'abc-123');
        });
        test('should respect maxQueries cap', () => {
            const lines = Array.from({ length: 20 }, (_, i) => `SELECT ${i} FROM t;`);
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, '', '', 5);
            assert.strictEqual(result.length, 5);
        });
        test('should return empty for no SQL content', () => {
            const lines = [
                'Application started',
                'Listening on port 3000',
                'Request received',
            ];
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, '', '', 100);
            assert.strictEqual(result.length, 0);
        });
        test('should handle empty lines array', () => {
            const result = (0, database_query_logs_1.parseQueryBlocks)([], '', '', 100);
            assert.strictEqual(result.length, 0);
        });
        test('should extract duration from query line', () => {
            const lines = [
                'SELECT * FROM users; Duration: 42ms',
            ];
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, '', '', 100);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].durationMs, 42);
        });
        test('should detect DELETE, UPDATE, INSERT, CREATE statements', () => {
            const lines = [
                'DELETE FROM sessions WHERE expired = true;',
                'log line',
                'UPDATE users SET active = false;',
                'log line',
                'INSERT INTO logs (msg) VALUES ("test");',
                'log line',
                'CREATE TABLE temp (id INT);',
            ];
            const result = (0, database_query_logs_1.parseQueryBlocks)(lines, '', '', 100);
            assert.strictEqual(result.length, 4);
        });
    });
});
//# sourceMappingURL=database-query-logs.test.js.map