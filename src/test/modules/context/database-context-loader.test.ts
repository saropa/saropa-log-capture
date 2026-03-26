import * as assert from 'assert';
import { loadDatabaseContext } from '../../../modules/context/context-sidecar-parsers';
import type { ContextWindow } from '../../../modules/context/context-loader-types';

suite('loadDatabaseContext', () => {
    // Use realistic epoch-ms timestamps (extractTimestamp treats < 1e12 as seconds)
    const center = 1700000000000;
    const window: ContextWindow = { centerTime: center, windowMs: 5000 };

    test('should parse queries from valid JSON', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT * FROM users', lineStart: 10, lineEnd: 10, timestamp: center },
                { queryText: 'INSERT INTO logs', lineStart: 20, lineEnd: 20, timestamp: center + 1000 },
            ],
        });
        const result = loadDatabaseContext(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database!.length, 2);
        assert.strictEqual(result.database![0].queryText, 'SELECT * FROM users');
    });

    test('should filter queries by time window', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT 1', timestamp: center - 10000 },
                { queryText: 'SELECT 2', timestamp: center },
                { queryText: 'SELECT 3', timestamp: center + 100000 },
            ],
        });
        const result = loadDatabaseContext(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database!.length, 1);
    });

    test('should include queries without timestamp (line-based)', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT * FROM users', lineStart: 5, lineEnd: 5 },
            ],
        });
        const result = loadDatabaseContext(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database!.length, 1);
    });

    test('should return empty for no queries', () => {
        const content = JSON.stringify({ queries: [] });
        const result = loadDatabaseContext(content, window);
        assert.strictEqual(result.database, undefined);
    });

    test('should handle malformed JSON', () => {
        const result = loadDatabaseContext('not json', window);
        assert.strictEqual(result.database, undefined);
    });

    test('should handle empty string', () => {
        const result = loadDatabaseContext('', window);
        assert.strictEqual(result.database, undefined);
    });

    test('should handle missing queries key', () => {
        const content = JSON.stringify({ other: 'data' });
        const result = loadDatabaseContext(content, window);
        assert.strictEqual(result.database, undefined);
    });

    test('should skip entries without queryText', () => {
        const content = JSON.stringify({
            queries: [
                { lineStart: 5, lineEnd: 5, timestamp: center },
                { queryText: 'SELECT 1', lineStart: 10, lineEnd: 10, timestamp: center },
            ],
        });
        const result = loadDatabaseContext(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database!.length, 1);
    });

    test('should cap at 50 entries', () => {
        const queries = Array.from({ length: 60 }, (_, i) => ({
            queryText: `SELECT ${i}`,
            lineStart: i,
            lineEnd: i,
            timestamp: center,
        }));
        const content = JSON.stringify({ queries });
        const result = loadDatabaseContext(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database!.length, 50);
    });

    test('should preserve requestId and durationMs', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT 1', timestamp: center, requestId: 'req-1', durationMs: 42 },
            ],
        });
        const result = loadDatabaseContext(content, window);
        assert.ok(result.database);
        assert.strictEqual(result.database![0].requestId, 'req-1');
        assert.strictEqual(result.database![0].durationMs, 42);
    });
});
