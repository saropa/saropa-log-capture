import * as assert from 'assert';
import { normalizeDriftSqlFingerprintSql } from '../../../modules/db/drift-sql-fingerprint-normalize';
import { parseDriftSqlFingerprint } from '../../../modules/db/drift-n-plus-one-detector';

suite('DriftSqlFingerprintNormalize', () => {
    test('same query shape collapses to one fingerprint (literals and spacing)', () => {
        const a = normalizeDriftSqlFingerprintSql('SELECT * FROM "items" WHERE id = 1 LIMIT 1');
        const b = normalizeDriftSqlFingerprintSql('select  *  from  "items"  where  id  =  99  limit  1');
        assert.strictEqual(a, b);
        assert.ok(a.includes('SELECT'));
        assert.ok(a.includes('FROM'));
    });

    test('UUID-rich variations share one fingerprint (unquoted UUID token)', () => {
        const u1 = '550e8400-e29b-41d4-a716-446655440000';
        const u2 = '660e8400-e29b-41d4-a716-446655440999';
        const a = normalizeDriftSqlFingerprintSql(`SELECT * FROM t WHERE id = ${u1}`);
        const b = normalizeDriftSqlFingerprintSql(`SELECT * FROM t WHERE id = ${u2}`);
        assert.strictEqual(a, b);
    });

    test('parseDriftSqlFingerprint never merges argsKey into fingerprint', () => {
        const line = (n: number) =>
            `I/flutter: Drift: Sent SELECT * FROM u WHERE n = ${n} with args [${n}]`;
        const p1 = parseDriftSqlFingerprint(line(1));
        const p2 = parseDriftSqlFingerprint(line(2));
        assert.ok(p1 && p2);
        assert.strictEqual(p1.fingerprint, p2.fingerprint);
        assert.notStrictEqual(p1.argsKey, p2.argsKey);
    });

    test('false positive guard: different statement kinds stay distinct fingerprints', () => {
        const sel = normalizeDriftSqlFingerprintSql('SELECT * FROM t WHERE id = ?');
        const del = normalizeDriftSqlFingerprintSql('DELETE FROM t WHERE id = ?');
        assert.notStrictEqual(sel, del);
        assert.ok(sel.includes('SELECT'));
        assert.ok(del.includes('DELETE'));
    });

    test('false positive guard: DISTINCT vs non-distinct select shapes differ', () => {
        const a = normalizeDriftSqlFingerprintSql('SELECT DISTINCT a FROM t');
        const b = normalizeDriftSqlFingerprintSql('SELECT a FROM t');
        assert.notStrictEqual(a, b);
    });

    test('UUID inside a string literal is still one literal bucket (no per-UUID chip explosion)', () => {
        const id = '550e8400-e29b-41d4-a716-446655440000';
        const x = normalizeDriftSqlFingerprintSql(`SELECT * FROM t WHERE x = '${id}'`);
        const y = normalizeDriftSqlFingerprintSql(`SELECT * FROM t WHERE x = '660e8400-e29b-41d4-a716-446655440999'`);
        assert.strictEqual(x, y);
    });
});
