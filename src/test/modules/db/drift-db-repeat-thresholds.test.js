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
const assert = __importStar(require("node:assert"));
const drift_db_repeat_thresholds_1 = require("../../../modules/db/drift-db-repeat-thresholds");
suite('drift-db-repeat-thresholds', () => {
    test('normalize applies defaults', () => {
        const n = (0, drift_db_repeat_thresholds_1.normalizeViewerRepeatThresholds)({});
        assert.deepStrictEqual(n, drift_db_repeat_thresholds_1.VIEWER_REPEAT_THRESHOLD_DEFAULTS);
    });
    test('clamp enforces minimum 2 and maximum 50', () => {
        assert.strictEqual((0, drift_db_repeat_thresholds_1.clampViewerRepeatMinCount)(1), 2);
        assert.strictEqual((0, drift_db_repeat_thresholds_1.clampViewerRepeatMinCount)(99), 50);
        assert.strictEqual((0, drift_db_repeat_thresholds_1.clampViewerRepeatMinCount)(3), 3);
    });
    test('read vs dml defaults preserve SELECT earlier-collapse ordering', () => {
        const n = (0, drift_db_repeat_thresholds_1.normalizeViewerRepeatThresholds)({});
        assert.ok(n.readMinCount <= n.dmlMinCount, 'reads should collapse at same or lower N than DML');
        assert.ok(n.transactionMinCount >= n.readMinCount);
        assert.ok(n.transactionMinCount <= n.dmlMinCount);
    });
    suite('driftSqlRepeatMinN (mirror of webview getDriftRepeatMinN)', () => {
        const wide = (0, drift_db_repeat_thresholds_1.normalizeViewerRepeatThresholds)({
            globalMinCount: 2,
            readMinCount: 2,
            transactionMinCount: 5,
            dmlMinCount: 9,
        });
        test('non-database source never uses read/dml buckets (false positive guard)', () => {
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('debug', 'SELECT', wide), wide.globalMinCount);
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('stderr', 'UPDATE', wide), wide.globalMinCount);
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)(null, 'SELECT', wide), wide.globalMinCount);
        });
        test('database + missing verb falls back to global', () => {
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', null, wide), wide.globalMinCount);
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', undefined, wide), wide.globalMinCount);
        });
        test('database + unknown verb falls back to global (before/after mapping extended)', () => {
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', 'EXPLAIN', wide), wide.globalMinCount);
        });
        test('database + classified verbs use correct tier', () => {
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', 'SELECT', wide), wide.readMinCount);
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', 'WITH', wide), wide.readMinCount);
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', 'PRAGMA', wide), wide.readMinCount);
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', 'BEGIN', wide), wide.transactionMinCount);
            assert.strictEqual((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', 'UPDATE', wide), wide.dmlMinCount);
        });
        test('SELECT vs UPDATE ordering under asymmetric settings', () => {
            assert.ok((0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', 'SELECT', wide) < (0, drift_db_repeat_thresholds_1.driftSqlRepeatMinN)('database', 'UPDATE', wide));
        });
        test('generated webview JS source keeps the same false-positive guards and buckets', () => {
            const js = (0, drift_db_repeat_thresholds_1.getDriftRepeatMinNJsSource)();
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
//# sourceMappingURL=drift-db-repeat-thresholds.test.js.map