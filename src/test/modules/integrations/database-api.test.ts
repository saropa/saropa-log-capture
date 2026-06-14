import * as assert from 'assert';
import { queriesFromResponseBody } from '../../../modules/integrations/providers/database-api';

suite('database-api', () => {
    suite('queriesFromResponseBody', () => {
        test('should extract the queries array from a {queries:[...]} envelope', () => {
            const out = queriesFromResponseBody({ queries: [{ queryText: 'SELECT 1' }] });
            assert.strictEqual(out.length, 1);
        });

        test('should accept a bare array response', () => {
            const out = queriesFromResponseBody([{ queryText: 'A' }, { queryText: 'B' }]);
            assert.strictEqual(out.length, 2);
        });

        test('should return empty for an unexpected shape', () => {
            assert.deepStrictEqual(queriesFromResponseBody({ data: 'x' }), []);
            assert.deepStrictEqual(queriesFromResponseBody(null), []);
            assert.deepStrictEqual(queriesFromResponseBody('nope'), []);
        });
    });
});
