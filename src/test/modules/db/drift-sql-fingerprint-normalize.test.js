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
const drift_sql_fingerprint_normalize_1 = require("../../../modules/db/drift-sql-fingerprint-normalize");
const drift_n_plus_one_detector_1 = require("../../../modules/db/drift-n-plus-one-detector");
suite('DriftSqlFingerprintNormalize', () => {
    test('same query shape collapses to one fingerprint (literals and spacing)', () => {
        const a = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)('SELECT * FROM "items" WHERE id = 1 LIMIT 1');
        const b = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)('select  *  from  "items"  where  id  =  99  limit  1');
        assert.strictEqual(a, b);
        assert.ok(a.includes('SELECT'));
        assert.ok(a.includes('FROM'));
    });
    test('UUID-rich variations share one fingerprint (unquoted UUID token)', () => {
        const u1 = '550e8400-e29b-41d4-a716-446655440000';
        const u2 = '660e8400-e29b-41d4-a716-446655440999';
        const a = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)(`SELECT * FROM t WHERE id = ${u1}`);
        const b = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)(`SELECT * FROM t WHERE id = ${u2}`);
        assert.strictEqual(a, b);
    });
    test('parseDriftSqlFingerprint never merges argsKey into fingerprint', () => {
        const line = (n) => `I/flutter: Drift: Sent SELECT * FROM u WHERE n = ${n} with args [${n}]`;
        const p1 = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(line(1));
        const p2 = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(line(2));
        assert.ok(p1 && p2);
        assert.strictEqual(p1.fingerprint, p2.fingerprint);
        assert.notStrictEqual(p1.argsKey, p2.argsKey);
    });
    test('false positive guard: different statement kinds stay distinct fingerprints', () => {
        const sel = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)('SELECT * FROM t WHERE id = ?');
        const del = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)('DELETE FROM t WHERE id = ?');
        assert.notStrictEqual(sel, del);
        assert.ok(sel.includes('SELECT'));
        assert.ok(del.includes('DELETE'));
    });
    test('false positive guard: DISTINCT vs non-distinct select shapes differ', () => {
        const a = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)('SELECT DISTINCT a FROM t');
        const b = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)('SELECT a FROM t');
        assert.notStrictEqual(a, b);
    });
    test('UUID inside a string literal is still one literal bucket (no per-UUID chip explosion)', () => {
        const id = '550e8400-e29b-41d4-a716-446655440000';
        const x = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)(`SELECT * FROM t WHERE x = '${id}'`);
        const y = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)(`SELECT * FROM t WHERE x = '660e8400-e29b-41d4-a716-446655440999'`);
        assert.strictEqual(x, y);
    });
});
//# sourceMappingURL=drift-sql-fingerprint-normalize.test.js.map