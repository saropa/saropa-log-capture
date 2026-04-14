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
const drift_n_plus_one_detector_1 = require("../../../modules/db/drift-n-plus-one-detector");
suite('DriftNPlusOneDetector', () => {
    const baseLine = (id) => `I/flutter ( 5475): Drift: Sent SELECT * FROM "contacts" WHERE "id" = ? LIMIT 1; with args [${id}]`;
    test('parseDriftSqlFingerprint returns null for non-Drift text', () => {
        assert.strictEqual((0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)('plain log line'), null);
        assert.strictEqual((0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(''), null);
    });
    test('parseDriftSqlFingerprint normalizes literals into one fingerprint', () => {
        const a = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(baseLine(1));
        const b = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(baseLine(2));
        assert.ok(a && b);
        assert.strictEqual(a.fingerprint, b.fingerprint);
        assert.notStrictEqual(a.argsKey, b.argsKey);
        assert.ok(a.sqlSnippet.includes('SELECT'));
        assert.ok(a.fingerprint.includes('SELECT'), 'fingerprint uses uppercase SQL keyword shape');
        assert.strictEqual(a.sqlSnippet, b.sqlSnippet);
    });
    test('parseDriftSqlFingerprint handles DriftDebugInterceptor SELECT format', () => {
        const result = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)('Drift SELECT: SELECT * FROM "contacts" WHERE "data_source_name" = ?; | args: [StarTrek]');
        assert.ok(result, 'should parse DriftDebugInterceptor SELECT');
        assert.ok(result.fingerprint.includes('SELECT'));
        assert.strictEqual(result.argsKey, '[StarTrek]');
        /* Trailing semicolon should be stripped from sqlSnippet. */
        assert.ok(!result.sqlSnippet.endsWith(';'), 'trailing semicolon should be stripped');
    });
    test('parseDriftSqlFingerprint handles DriftDebugInterceptor UPDATE format', () => {
        const result = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)('Drift UPDATE: UPDATE "organizations" SET "version" = ? WHERE "id" = ?; | args: [null, 195]');
        assert.ok(result, 'should parse DriftDebugInterceptor UPDATE');
        assert.ok(result.fingerprint.includes('UPDATE'));
        assert.strictEqual(result.argsKey, '[null, 195]');
    });
    test('parseDriftSqlFingerprint produces same fingerprint for both formats', () => {
        const standard = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)('I/flutter (5475): Drift: Sent SELECT * FROM "contacts" WHERE "id" = ? LIMIT 1; with args [42]');
        const custom = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)('Drift SELECT: SELECT * FROM "contacts" WHERE "id" = ? LIMIT 1; | args: [42]');
        assert.ok(standard && custom);
        assert.strictEqual(standard.fingerprint, custom.fingerprint, 'same SQL should produce the same fingerprint regardless of format');
    });
    test('before: fewer than minRepeats does not emit insight', () => {
        const d = new drift_n_plus_one_detector_1.NPlusOneDetector();
        const fp = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(baseLine(0));
        assert.ok(fp);
        let last = null;
        for (let i = 0; i < drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG.minRepeats - 1; i++) {
            last = d.feed(1000 + i * 10, fp.fingerprint, `[${i}]`);
        }
        assert.strictEqual(last, null);
    });
    test('after: minRepeats with distinct args emits insight', () => {
        const d = new drift_n_plus_one_detector_1.NPlusOneDetector();
        const fp = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(baseLine(0));
        assert.ok(fp);
        let insight = null;
        for (let i = 0; i < drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG.minRepeats; i++) {
            insight = d.feed(2000 + i * 10, fp.fingerprint, `[row-${i}]`);
        }
        assert.ok(insight);
        assert.strictEqual(insight.repeats, drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG.minRepeats);
        assert.strictEqual(insight.distinctArgs, drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG.minRepeats);
    });
    test('false positive guard: same args repeated many times does not trigger', () => {
        const d = new drift_n_plus_one_detector_1.NPlusOneDetector();
        const fp = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(baseLine(42));
        assert.ok(fp);
        const sameArgs = fp.argsKey;
        for (let i = 0; i < 20; i++) {
            assert.strictEqual(d.feed(3000 + i * 5, fp.fingerprint, sameArgs), null);
        }
    });
    test('false positive guard: low distinct-arg count despite high repeats', () => {
        const d = new drift_n_plus_one_detector_1.NPlusOneDetector();
        const fp = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(baseLine(0));
        assert.ok(fp);
        for (let i = 0; i < 12; i++) {
            const argsKey = i % 2 === 0 ? '[a]' : '[b]';
            assert.strictEqual(d.feed(4000 + i * 10, fp.fingerprint, argsKey), null);
        }
    });
    test('cooldown suppresses a second insight for the same fingerprint', () => {
        const d = new drift_n_plus_one_detector_1.NPlusOneDetector();
        const fp = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(baseLine(0));
        assert.ok(fp);
        const t0 = 5000;
        let first = null;
        for (let i = 0; i < drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG.minRepeats; i++) {
            first = d.feed(t0 + i * 10, fp.fingerprint, `[k${i}]`);
        }
        assert.ok(first);
        let second = null;
        for (let j = 0; j < drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG.minRepeats; j++) {
            second = d.feed(t0 + 100 + j * 10, fp.fingerprint, `[k${j + 100}]`);
        }
        assert.strictEqual(second, null);
    });
    test('prunes excess fingerprint keys (long-session safety)', () => {
        const d = new drift_n_plus_one_detector_1.NPlusOneDetector({
            ...drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG,
            maxFingerprintsTracked: 4,
            pruneIdleMs: 0,
        });
        for (let f = 0; f < 10; f++) {
            const line = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(`I/flutter: Drift: Sent SELECT ${f}; with args [x]`);
            assert.ok(line);
            d.feed(10_000 + f, line.fingerprint, '[1]');
        }
        assert.ok(d.fingerprintCount() <= 4);
    });
});
//# sourceMappingURL=drift-n-plus-one-detector.test.js.map