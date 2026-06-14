import * as assert from 'assert';
import {
    parseQueryBlocks,
    parseTextQueryLog,
    detectQueryLogFormat,
} from '../../../modules/integrations/providers/database-query-logs';

suite('database-query-logs', () => {
    suite('parseQueryBlocks', () => {
        test('should detect simple SELECT statement', () => {
            const lines = [
                'Starting request...',
                'SELECT * FROM users WHERE id = 1;',
                'Done.',
            ];
            const result = parseQueryBlocks(lines, '', '', 100);
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
            const result = parseQueryBlocks(lines, '', '', 100);
            assert.strictEqual(result.length, 3);
        });

        test('should handle multi-line queries with continuation', () => {
            const lines = [
                'SELECT u.id, u.name',
                '  FROM users u',
                '  JOIN orders o ON u.id = o.user_id',
                'Done processing.',
            ];
            const result = parseQueryBlocks(lines, '', '', 100);
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
            const result = parseQueryBlocks(lines, 'QUERY:', '', 100);
            assert.strictEqual(result.length, 2);
        });

        test('should extract requestId from nearby lines', () => {
            const lines = [
                'requestId=abc-123 Processing request',
                'SELECT * FROM users;',
            ];
            const result = parseQueryBlocks(lines, '', 'requestId=(\\S+)', 100);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].requestId, 'abc-123');
        });

        test('should respect maxQueries cap', () => {
            const lines = Array.from({ length: 20 }, (_, i) => `SELECT ${i} FROM t;`);
            const result = parseQueryBlocks(lines, '', '', 5);
            assert.strictEqual(result.length, 5);
        });

        test('should return empty for no SQL content', () => {
            const lines = [
                'Application started',
                'Listening on port 3000',
                'Request received',
            ];
            const result = parseQueryBlocks(lines, '', '', 100);
            assert.strictEqual(result.length, 0);
        });

        test('should handle empty lines array', () => {
            const result = parseQueryBlocks([], '', '', 100);
            assert.strictEqual(result.length, 0);
        });

        test('should extract duration from query line', () => {
            const lines = [
                'SELECT * FROM users; Duration: 42ms',
            ];
            const result = parseQueryBlocks(lines, '', '', 100);
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
            const result = parseQueryBlocks(lines, '', '', 100);
            assert.strictEqual(result.length, 4);
        });
    });

    suite('detectQueryLogFormat', () => {
        test('should detect JSON when first non-empty line opens with a brace', () => {
            const lines = ['', '   ', '{"query":"SELECT 1"}'];
            assert.strictEqual(detectQueryLogFormat(lines), 'json');
        });

        test('should detect text for a plain SQL / server-log line', () => {
            const lines = ['2026-06-14 10:00:00 UTC LOG:  statement: SELECT 1'];
            assert.strictEqual(detectQueryLogFormat(lines), 'text');
        });

        test('should default to json for an all-empty file', () => {
            assert.strictEqual(detectQueryLogFormat(['', '   ']), 'json');
        });
    });

    suite('parseTextQueryLog', () => {
        test('should parse a PostgreSQL log_min_duration_statement line', () => {
            const lines = [
                '2026-06-14 10:00:00.123 UTC [1234] LOG:  duration: 1.234 ms  statement: SELECT * FROM users WHERE id = 1;',
            ];
            const result = parseTextQueryLog(lines, '', 100);
            assert.strictEqual(result.length, 1);
            assert.ok(result[0].queryText.startsWith('SELECT * FROM users'));
            assert.strictEqual(result[0].durationMs, 1.234);
            assert.strictEqual(typeof result[0].timestamp, 'number');
        });

        test('should attach MySQL slow-log Query_time (seconds) to the following SQL', () => {
            const lines = [
                '# Time: 2026-06-14T10:00:00.000000Z',
                '# User@Host: app[app] @ localhost []',
                '# Query_time: 0.250000  Lock_time: 0.000100',
                'SET timestamp=1718359200;',
                'SELECT name FROM accounts WHERE active = 1;',
            ];
            const result = parseTextQueryLog(lines, '', 100);
            assert.strictEqual(result.length, 1);
            assert.ok(result[0].queryText.startsWith('SELECT name FROM accounts'));
            // 0.25 s carried from the Query_time header → 250 ms.
            assert.strictEqual(result[0].durationMs, 250);
        });

        test('should not bleed a Query_time header onto an unrelated later statement', () => {
            const lines = [
                '# Query_time: 0.100000',
                'SELECT 1;',
                'some unrelated log line',
                'SELECT 2;',
            ];
            const result = parseTextQueryLog(lines, '', 100);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].durationMs, 100);
            assert.strictEqual(result[1].durationMs, undefined);
        });

        test('should extract requestId from nearby lines', () => {
            const lines = [
                'requestId=req-42 incoming',
                'SELECT * FROM jobs;',
            ];
            const result = parseTextQueryLog(lines, 'requestId=(\\S+)', 100);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].requestId, 'req-42');
        });

        test('should respect the maxQueries cap', () => {
            const lines = Array.from({ length: 30 }, (_, i) => `SELECT ${i} FROM t;`);
            const result = parseTextQueryLog(lines, '', 5);
            assert.strictEqual(result.length, 5);
        });

        test('should return empty when no SQL is present', () => {
            const lines = ['2026-06-14 10:00:00 UTC LOG:  connection received'];
            assert.strictEqual(parseTextQueryLog(lines, '', 100).length, 0);
        });
    });
});
