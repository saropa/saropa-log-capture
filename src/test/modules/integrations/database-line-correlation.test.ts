import * as assert from 'assert';
import { databaseQueryLineCounts } from '../../../modules/integrations/providers/database-line-correlation';

suite('database-line-correlation', () => {
    suite('databaseQueryLineCounts', () => {
        const queries = [
            { queryText: 'SELECT 1', requestId: 'req-1' },
            { queryText: 'SELECT 2', requestId: 'req-1' },
            { queryText: 'SELECT 3', requestId: 'req-2' },
            { queryText: 'SELECT 4' }, // no requestId
        ];

        test('should flag matching lines with the count of queries for that request ID', () => {
            const lines = [
                '[10:00:00] requestId=req-1 starting',
                'unrelated line',
                '[10:00:01] requestId=req-2 doing',
                '[10:00:02] requestId=req-9 none',
            ];
            const r = databaseQueryLineCounts(lines, queries, 'requestId=(\\S+)');
            assert.strictEqual(r[0], 2);
            assert.strictEqual(r[2], 1);
            assert.strictEqual(r[1], undefined);
            assert.strictEqual(r[3], undefined);
        });

        test('should return empty when no requestIdPattern is configured', () => {
            assert.deepStrictEqual(databaseQueryLineCounts(['requestId=req-1'], queries, ''), {});
        });

        test('should return empty when no query carries a request ID', () => {
            const noId = [{ queryText: 'SELECT 1' }];
            assert.deepStrictEqual(databaseQueryLineCounts(['requestId=req-1'], noId, 'requestId=(\\S+)'), {});
        });

        test('should return empty for an invalid user regex rather than throwing', () => {
            assert.deepStrictEqual(databaseQueryLineCounts(['x'], queries, '('), {});
        });
    });
});
