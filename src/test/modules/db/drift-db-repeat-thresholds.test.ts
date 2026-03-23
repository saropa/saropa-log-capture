import * as assert from 'node:assert';
import {
    clampViewerRepeatMinCount,
    driftSqlRepeatMinN,
    getDriftRepeatMinNJsSource,
    normalizeViewerRepeatThresholds,
    VIEWER_REPEAT_THRESHOLD_DEFAULTS,
} from '../../../modules/db/drift-db-repeat-thresholds';

suite('drift-db-repeat-thresholds', () => {
    test('normalize applies defaults', () => {
        const n = normalizeViewerRepeatThresholds({});
        assert.deepStrictEqual(n, VIEWER_REPEAT_THRESHOLD_DEFAULTS);
    });

    test('clamp enforces minimum 2 and maximum 50', () => {
        assert.strictEqual(clampViewerRepeatMinCount(1), 2);
        assert.strictEqual(clampViewerRepeatMinCount(99), 50);
        assert.strictEqual(clampViewerRepeatMinCount(3), 3);
    });

    test('read vs dml defaults preserve SELECT earlier-collapse ordering', () => {
        const n = normalizeViewerRepeatThresholds({});
        assert.ok(n.readMinCount <= n.dmlMinCount, 'reads should collapse at same or lower N than DML');
        assert.ok(n.transactionMinCount >= n.readMinCount);
        assert.ok(n.transactionMinCount <= n.dmlMinCount);
    });

    suite('driftSqlRepeatMinN (mirror of webview getDriftRepeatMinN)', () => {
        const wide: ReturnType<typeof normalizeViewerRepeatThresholds> = normalizeViewerRepeatThresholds({
            globalMinCount: 2,
            readMinCount: 2,
            transactionMinCount: 5,
            dmlMinCount: 9,
        });

        test('non-database source never uses read/dml buckets (false positive guard)', () => {
            assert.strictEqual(driftSqlRepeatMinN('debug', 'SELECT', wide), wide.globalMinCount);
            assert.strictEqual(driftSqlRepeatMinN('stderr', 'UPDATE', wide), wide.globalMinCount);
            assert.strictEqual(driftSqlRepeatMinN(null, 'SELECT', wide), wide.globalMinCount);
        });

        test('database + missing verb falls back to global', () => {
            assert.strictEqual(driftSqlRepeatMinN('database', null, wide), wide.globalMinCount);
            assert.strictEqual(driftSqlRepeatMinN('database', undefined, wide), wide.globalMinCount);
        });

        test('database + unknown verb falls back to global (before/after mapping extended)', () => {
            assert.strictEqual(driftSqlRepeatMinN('database', 'EXPLAIN', wide), wide.globalMinCount);
        });

        test('database + classified verbs use correct tier', () => {
            assert.strictEqual(driftSqlRepeatMinN('database', 'SELECT', wide), wide.readMinCount);
            assert.strictEqual(driftSqlRepeatMinN('database', 'WITH', wide), wide.readMinCount);
            assert.strictEqual(driftSqlRepeatMinN('database', 'PRAGMA', wide), wide.readMinCount);
            assert.strictEqual(driftSqlRepeatMinN('database', 'BEGIN', wide), wide.transactionMinCount);
            assert.strictEqual(driftSqlRepeatMinN('database', 'UPDATE', wide), wide.dmlMinCount);
        });

        test('SELECT vs UPDATE ordering under asymmetric settings', () => {
            assert.ok(
                driftSqlRepeatMinN('database', 'SELECT', wide) < driftSqlRepeatMinN('database', 'UPDATE', wide),
            );
        });

        test('generated webview JS source keeps the same false-positive guards and buckets', () => {
            const js = getDriftRepeatMinNJsSource();
            // Guard: non-database or missing parsed verb falls back to global threshold.
            assert.ok(js.includes("sourceTag !== 'database' || !sqlMeta || !sqlMeta.verb"));
            assert.ok(js.includes("return dbRepeatThresholds.global"));

            // Buckets: keep read / transaction / dml mappings explicit in embedded source.
            assert.ok(js.includes("['SELECT','WITH','PRAGMA']"));
            assert.ok(js.includes("['BEGIN','COMMIT','ROLLBACK']"));
            assert.ok(js.includes("['INSERT','UPDATE','DELETE']"));
        });
    });
});
