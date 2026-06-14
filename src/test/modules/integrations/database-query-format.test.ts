import * as assert from 'assert';
import { jsonRecordToEntry, formatQueryEntry, parseNewQueryLines } from '../../../modules/integrations/providers/database-query-format';

suite('database-query-format', () => {
    suite('jsonRecordToEntry', () => {
        test('should map query/duration/requestId/timestamp fields', () => {
            const e = jsonRecordToEntry({ query: 'SELECT 1', durationMs: 12, requestId: 'r-1', timestamp: 1000 });
            assert.ok(e);
            assert.strictEqual(e?.queryText, 'SELECT 1');
            assert.strictEqual(e?.durationMs, 12);
            assert.strictEqual(e?.requestId, 'r-1');
            assert.strictEqual(e?.timestamp, 1000);
        });

        test('should accept queryText/sql/statement aliases', () => {
            assert.strictEqual(jsonRecordToEntry({ sql: 'DELETE FROM t' })?.queryText, 'DELETE FROM t');
            assert.strictEqual(jsonRecordToEntry({ statement: 'UPDATE t SET x=1' })?.queryText, 'UPDATE t SET x=1');
        });

        test('should parse an ISO-string timestamp', () => {
            const e = jsonRecordToEntry({ query: 'SELECT 1', time: '2026-06-14T10:00:00Z' });
            assert.strictEqual(typeof e?.timestamp, 'number');
        });

        test('should return undefined when no SQL field is present', () => {
            assert.strictEqual(jsonRecordToEntry({ level: 'info', msg: 'hello' }), undefined);
        });
    });

    suite('formatQueryEntry', () => {
        test('should render request id and duration when present', () => {
            const line = formatQueryEntry({ lineStart: 0, lineEnd: 0, queryText: 'SELECT 1', requestId: 'r-7', durationMs: 12 });
            assert.strictEqual(line, 'SQL: [r-7] SELECT 1 (12ms)');
        });

        test('should collapse multi-line whitespace into one line', () => {
            const line = formatQueryEntry({ lineStart: 0, lineEnd: 0, queryText: 'SELECT a,\n  b\n  FROM t' });
            assert.strictEqual(line, 'SQL: SELECT a, b FROM t');
        });
    });

    suite('parseNewQueryLines', () => {
        test('should parse JSON-format lines into entries', () => {
            const lines = ['{"query":"SELECT 1","durationMs":5}', 'not json', '{"msg":"no sql"}'];
            const out = parseNewQueryLines(lines, 'json', '');
            assert.strictEqual(out.length, 1);
            assert.strictEqual(out[0].queryText, 'SELECT 1');
        });

        test('should parse text-format lines via the shared text parser', () => {
            const lines = ['2026-06-14 10:00:00 UTC LOG:  duration: 2.5 ms  statement: SELECT * FROM t;'];
            const out = parseNewQueryLines(lines, 'text', '');
            assert.strictEqual(out.length, 1);
            assert.ok(out[0].queryText.startsWith('SELECT * FROM t'));
            assert.strictEqual(out[0].durationMs, 2.5);
        });
    });
});
