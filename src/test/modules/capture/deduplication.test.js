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
const deduplication_1 = require("../../../modules/capture/deduplication");
suite('Deduplicator', () => {
    suite('process', () => {
        test('should emit a new unique line immediately', () => {
            const dedup = new deduplication_1.Deduplicator();
            const result = dedup.process('hello');
            assert.deepStrictEqual(result, ['hello']);
        });
        test('should suppress duplicate within time window', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            const result = dedup.process('hello');
            assert.deepStrictEqual(result, []);
        });
        test('should emit grouped line when different line follows duplicates', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            dedup.process('hello');
            dedup.process('hello');
            const result = dedup.process('world');
            assert.deepStrictEqual(result, ['hello (x3)', 'world']);
        });
        test('should not group when count is 1', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            const result = dedup.process('world');
            assert.deepStrictEqual(result, ['world']);
        });
        test('should handle interspersed different lines', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            assert.deepStrictEqual(dedup.process('a'), ['a']);
            assert.deepStrictEqual(dedup.process('b'), ['b']);
            assert.deepStrictEqual(dedup.process('a'), ['a']);
        });
        test('should handle empty strings', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            assert.deepStrictEqual(dedup.process(''), ['']);
            assert.deepStrictEqual(dedup.process(''), []);
        });
        test('should treat lines differing by whitespace as different', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            const result = dedup.process('hello ');
            assert.deepStrictEqual(result, ['hello ']);
        });
    });
    suite('flush', () => {
        test('should emit grouped line when duplicates are pending', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('error');
            dedup.process('error');
            dedup.process('error');
            const result = dedup.flush();
            assert.deepStrictEqual(result, ['error (x3)']);
        });
        test('should return empty when last line has count 1', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            const result = dedup.flush();
            assert.deepStrictEqual(result, []);
        });
        test('should return empty when no lines processed', () => {
            const dedup = new deduplication_1.Deduplicator();
            assert.deepStrictEqual(dedup.flush(), []);
        });
        test('should reset state after flush', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('error');
            dedup.process('error');
            dedup.flush();
            // After flush, processing a new line should start fresh
            const result = dedup.process('error');
            assert.deepStrictEqual(result, ['error']);
        });
    });
    suite('reset', () => {
        test('should clear all state', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('error');
            dedup.process('error');
            dedup.reset();
            // After reset, same line should be treated as new
            const result = dedup.process('error');
            assert.deepStrictEqual(result, ['error']);
        });
    });
    suite('time window behavior', () => {
        test('should finalize group and start fresh after window expires', (done) => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 50 });
            dedup.process('hello');
            // Second call within window — suppressed (proves grouping works)
            assert.deepStrictEqual(dedup.process('hello'), []);
            setTimeout(() => {
                // After window expires: finalizes pending group, then emits new line
                const result = dedup.process('hello');
                assert.deepStrictEqual(result, ['hello (x2)', 'hello']);
                done();
            }, 80);
        });
    });
    suite('formatting', () => {
        test('should format count suffix correctly', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            dedup.process('msg');
            dedup.process('msg');
            const result = dedup.process('other');
            assert.strictEqual(result[0], 'msg (x2)');
        });
        test('should format large counts correctly', () => {
            const dedup = new deduplication_1.Deduplicator({ windowMs: 5000 });
            for (let i = 0; i < 100; i++) {
                dedup.process('flood');
            }
            const result = dedup.flush();
            assert.deepStrictEqual(result, ['flood (x100)']);
        });
    });
});
//# sourceMappingURL=deduplication.test.js.map