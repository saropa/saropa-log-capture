"use strict";
/**
 * Unit tests for correlation detection: confidence ordering and deduplication.
 */
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
const correlation_detector_1 = require("../../../modules/correlation/correlation-detector");
suite('CorrelationDetector', () => {
    suite('meetsMinConfidence', () => {
        test('high meets high', () => { assert.strictEqual((0, correlation_detector_1.meetsMinConfidence)('high', 'high'), true); });
        test('high meets medium', () => { assert.strictEqual((0, correlation_detector_1.meetsMinConfidence)('high', 'medium'), true); });
        test('high meets low', () => { assert.strictEqual((0, correlation_detector_1.meetsMinConfidence)('high', 'low'), true); });
        test('medium does not meet high', () => { assert.strictEqual((0, correlation_detector_1.meetsMinConfidence)('medium', 'high'), false); });
        test('medium meets medium', () => { assert.strictEqual((0, correlation_detector_1.meetsMinConfidence)('medium', 'medium'), true); });
        test('low does not meet high', () => { assert.strictEqual((0, correlation_detector_1.meetsMinConfidence)('low', 'high'), false); });
        test('low meets low', () => { assert.strictEqual((0, correlation_detector_1.meetsMinConfidence)('low', 'low'), true); });
    });
    suite('deduplicateCorrelations', () => {
        function ev(file, ts) {
            return { source: 'debug', timestamp: ts, summary: '', location: { file } };
        }
        function corr(id, confidence, events, timestamp) {
            return { id, type: 'error-http', confidence, events, description: id, timestamp };
        }
        test('empty returns empty', () => {
            assert.deepStrictEqual((0, correlation_detector_1.deduplicateCorrelations)([]), []);
        });
        test('single correlation is kept', () => {
            const c = corr('a', 'high', [ev('f', 1), ev('f', 2)], 1.5);
            assert.strictEqual((0, correlation_detector_1.deduplicateCorrelations)([c]).length, 1);
        });
        test('non-overlapping are both kept', () => {
            const c1 = corr('a', 'high', [ev('f1', 1), ev('f1', 2)], 1.5);
            const c2 = corr('b', 'high', [ev('f2', 100), ev('f2', 101)], 100.5);
            const out = (0, correlation_detector_1.deduplicateCorrelations)([c1, c2]);
            assert.strictEqual(out.length, 2);
        });
        test('overlapping same anchor keeps higher confidence', () => {
            const c1 = corr('a', 'low', [ev('f', 1), ev('f', 2)], 1.5);
            const c2 = corr('b', 'high', [ev('f', 1), ev('f', 3)], 2);
            const out = (0, correlation_detector_1.deduplicateCorrelations)([c1, c2]);
            assert.strictEqual(out.length, 1);
            assert.strictEqual(out[0].confidence, 'high');
        });
    });
    suite('detectCorrelations', () => {
        test('empty events returns empty', async () => {
            const out = await (0, correlation_detector_1.detectCorrelations)([], {
                windowMs: 2000,
                minConfidence: 'medium',
                enabledTypes: ['error-http'],
            });
            assert.deepStrictEqual(out, []);
        });
        test('single event returns empty', async () => {
            const out = await (0, correlation_detector_1.detectCorrelations)([
                { timestamp: 1, source: 'debug', level: 'error', summary: 'err', location: { file: 'f', line: 1 } },
            ], {
                windowMs: 2000,
                minConfidence: 'low',
                enabledTypes: ['error-http'],
            });
            assert.strictEqual(out.length, 0);
        });
    });
});
//# sourceMappingURL=correlation-detector.test.js.map