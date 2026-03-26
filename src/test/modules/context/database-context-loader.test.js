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
const context_sidecar_parsers_1 = require("../../../modules/context/context-sidecar-parsers");
suite('loadDatabaseContext', () => {
    // Use realistic epoch-ms timestamps (extractTimestamp treats < 1e12 as seconds)
    const center = 1700000000000;
    const window = { centerTime: center, windowMs: 5000 };
    test('should parse queries from valid JSON', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT * FROM users', lineStart: 10, lineEnd: 10, timestamp: center },
                { queryText: 'INSERT INTO logs', lineStart: 20, lineEnd: 20, timestamp: center + 1000 },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database.length, 2);
        assert.strictEqual(result.database[0].queryText, 'SELECT * FROM users');
    });
    test('should filter queries by time window', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT 1', timestamp: center - 10000 },
                { queryText: 'SELECT 2', timestamp: center },
                { queryText: 'SELECT 3', timestamp: center + 100000 },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database.length, 1);
    });
    test('should include queries without timestamp (line-based)', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT * FROM users', lineStart: 5, lineEnd: 5 },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database.length, 1);
    });
    test('should return empty for no queries', () => {
        const content = JSON.stringify({ queries: [] });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, window);
        assert.strictEqual(result.database, undefined);
    });
    test('should handle malformed JSON', () => {
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)('not json', window);
        assert.strictEqual(result.database, undefined);
    });
    test('should handle empty string', () => {
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)('', window);
        assert.strictEqual(result.database, undefined);
    });
    test('should handle missing queries key', () => {
        const content = JSON.stringify({ other: 'data' });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, window);
        assert.strictEqual(result.database, undefined);
    });
    test('should skip entries without queryText', () => {
        const content = JSON.stringify({
            queries: [
                { lineStart: 5, lineEnd: 5, timestamp: center },
                { queryText: 'SELECT 1', lineStart: 10, lineEnd: 10, timestamp: center },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database.length, 1);
    });
    test('should cap at 50 entries', () => {
        const queries = Array.from({ length: 60 }, (_, i) => ({
            queryText: `SELECT ${i}`,
            lineStart: i,
            lineEnd: i,
            timestamp: center,
        }));
        const content = JSON.stringify({ queries });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database.length, 50);
    });
    test('should preserve requestId and durationMs', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT 1', timestamp: center, requestId: 'req-1', durationMs: 42 },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database[0].requestId, 'req-1');
        assert.strictEqual(result.database[0].durationMs, 42);
    });
});
//# sourceMappingURL=database-context-loader.test.js.map