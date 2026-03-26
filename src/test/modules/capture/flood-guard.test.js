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
const flood_guard_1 = require("../../../modules/capture/flood-guard");
suite('FloodGuard', () => {
    suite('check', () => {
        test('should allow first message', () => {
            const guard = new flood_guard_1.FloodGuard();
            const result = guard.check('hello');
            assert.strictEqual(result.allow, true);
            assert.strictEqual(result.suppressedCount, undefined);
        });
        test('should allow different messages', () => {
            const guard = new flood_guard_1.FloodGuard();
            assert.strictEqual(guard.check('hello').allow, true);
            assert.strictEqual(guard.check('world').allow, true);
            assert.strictEqual(guard.check('foo').allow, true);
        });
        test('should allow repeated messages below threshold', () => {
            const guard = new flood_guard_1.FloodGuard();
            for (let i = 0; i < 50; i++) {
                const result = guard.check('hello');
                assert.strictEqual(result.allow, true);
            }
        });
        test('should start suppressing after threshold exceeded', () => {
            const guard = new flood_guard_1.FloodGuard();
            // Send 101 identical messages (threshold is 100)
            for (let i = 0; i < 101; i++) {
                guard.check('flood');
            }
            // The next one should be suppressed
            const result = guard.check('flood');
            assert.strictEqual(result.allow, false);
        });
        test('should reset when different message arrives', () => {
            const guard = new flood_guard_1.FloodGuard();
            // Build up repeat count
            for (let i = 0; i < 50; i++) {
                guard.check('flood');
            }
            // Different message should be allowed
            const result = guard.check('different');
            assert.strictEqual(result.allow, true);
        });
        test('should report suppressed count on different message after suppression', () => {
            const guard = new flood_guard_1.FloodGuard();
            // Trigger suppression (threshold is 100, so 105 activates it)
            for (let i = 0; i < 105; i++) {
                guard.check('flood');
            }
            // Different message exits suppression and reports dropped count
            const result = guard.check('other');
            assert.strictEqual(result.allow, true);
            assert.strictEqual(typeof result.suppressedCount, 'number');
            assert.ok(result.suppressedCount > 0);
        });
        test('should handle empty string messages', () => {
            const guard = new flood_guard_1.FloodGuard();
            const result = guard.check('');
            assert.strictEqual(result.allow, true);
        });
    });
    suite('reset', () => {
        test('should clear all state', () => {
            const guard = new flood_guard_1.FloodGuard();
            // Build up state
            for (let i = 0; i < 50; i++) {
                guard.check('message');
            }
            guard.reset();
            // After reset, first message should be allowed fresh
            const result = guard.check('message');
            assert.strictEqual(result.allow, true);
            assert.strictEqual(result.suppressedCount, undefined);
        });
        test('should stop suppression mode', () => {
            const guard = new flood_guard_1.FloodGuard();
            // Trigger suppression
            for (let i = 0; i < 105; i++) {
                guard.check('flood');
            }
            guard.reset();
            // After reset, messages should be allowed
            const result = guard.check('flood');
            assert.strictEqual(result.allow, true);
        });
    });
});
//# sourceMappingURL=flood-guard.test.js.map