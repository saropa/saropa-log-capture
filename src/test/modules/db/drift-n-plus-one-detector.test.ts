import * as assert from 'assert';
import {
    N_PLUS_ONE_EMBED_CONFIG,
    NPlusOneDetector,
    parseDriftSqlFingerprint,
} from '../../../modules/db/drift-n-plus-one-detector';

suite('DriftNPlusOneDetector', () => {
    const baseLine = (id: number) =>
        `I/flutter ( 5475): Drift: Sent SELECT * FROM "contacts" WHERE "id" = ? LIMIT 1; with args [${id}]`;

    test('parseDriftSqlFingerprint returns null for non-Drift text', () => {
        assert.strictEqual(parseDriftSqlFingerprint('plain log line'), null);
        assert.strictEqual(parseDriftSqlFingerprint(''), null);
    });

    test('parseDriftSqlFingerprint normalizes literals into one fingerprint', () => {
        const a = parseDriftSqlFingerprint(baseLine(1));
        const b = parseDriftSqlFingerprint(baseLine(2));
        assert.ok(a && b);
        assert.strictEqual(a.fingerprint, b.fingerprint);
        assert.notStrictEqual(a.argsKey, b.argsKey);
        assert.ok(a.sqlSnippet.includes('SELECT'));
        assert.strictEqual(a.sqlSnippet, b.sqlSnippet);
    });

    test('before: fewer than minRepeats does not emit insight', () => {
        const d = new NPlusOneDetector();
        const fp = parseDriftSqlFingerprint(baseLine(0));
        assert.ok(fp);
        let last = null;
        for (let i = 0; i < N_PLUS_ONE_EMBED_CONFIG.minRepeats - 1; i++) {
            last = d.feed(1000 + i * 10, fp.fingerprint, `[${i}]`);
        }
        assert.strictEqual(last, null);
    });

    test('after: minRepeats with distinct args emits insight', () => {
        const d = new NPlusOneDetector();
        const fp = parseDriftSqlFingerprint(baseLine(0));
        assert.ok(fp);
        let insight = null;
        for (let i = 0; i < N_PLUS_ONE_EMBED_CONFIG.minRepeats; i++) {
            insight = d.feed(2000 + i * 10, fp.fingerprint, `[row-${i}]`);
        }
        assert.ok(insight);
        assert.strictEqual(insight.repeats, N_PLUS_ONE_EMBED_CONFIG.minRepeats);
        assert.strictEqual(insight.distinctArgs, N_PLUS_ONE_EMBED_CONFIG.minRepeats);
    });

    test('false positive guard: same args repeated many times does not trigger', () => {
        const d = new NPlusOneDetector();
        const fp = parseDriftSqlFingerprint(baseLine(42));
        assert.ok(fp);
        const sameArgs = fp.argsKey;
        for (let i = 0; i < 20; i++) {
            assert.strictEqual(d.feed(3000 + i * 5, fp.fingerprint, sameArgs), null);
        }
    });

    test('false positive guard: low distinct-arg count despite high repeats', () => {
        const d = new NPlusOneDetector();
        const fp = parseDriftSqlFingerprint(baseLine(0));
        assert.ok(fp);
        for (let i = 0; i < 12; i++) {
            const argsKey = i % 2 === 0 ? '[a]' : '[b]';
            assert.strictEqual(d.feed(4000 + i * 10, fp.fingerprint, argsKey), null);
        }
    });

    test('cooldown suppresses a second insight for the same fingerprint', () => {
        const d = new NPlusOneDetector();
        const fp = parseDriftSqlFingerprint(baseLine(0));
        assert.ok(fp);
        const t0 = 5000;
        let first = null;
        for (let i = 0; i < N_PLUS_ONE_EMBED_CONFIG.minRepeats; i++) {
            first = d.feed(t0 + i * 10, fp.fingerprint, `[k${i}]`);
        }
        assert.ok(first);
        let second = null;
        for (let j = 0; j < N_PLUS_ONE_EMBED_CONFIG.minRepeats; j++) {
            second = d.feed(t0 + 100 + j * 10, fp.fingerprint, `[k${j + 100}]`);
        }
        assert.strictEqual(second, null);
    });

    test('prunes excess fingerprint keys (long-session safety)', () => {
        const d = new NPlusOneDetector({
            ...N_PLUS_ONE_EMBED_CONFIG,
            maxFingerprintsTracked: 4,
            pruneIdleMs: 0,
        });
        for (let f = 0; f < 10; f++) {
            const line = parseDriftSqlFingerprint(
                `I/flutter: Drift: Sent SELECT ${f}; with args [x]`,
            );
            assert.ok(line);
            d.feed(10_000 + f, line.fingerprint, '[1]');
        }
        assert.ok(d.fingerprintCount() <= 4);
    });
});
