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
const config_validation_1 = require("../../../modules/config/config-validation");
suite('Config validation', () => {
    suite('clamp', () => {
        test('returns value when within range', () => {
            assert.strictEqual((0, config_validation_1.clamp)(50, 0, 100, 10), 50);
        });
        test('returns min when value below range', () => {
            assert.strictEqual((0, config_validation_1.clamp)(-5, 0, 100, 10), 0);
        });
        test('returns max when value above range', () => {
            assert.strictEqual((0, config_validation_1.clamp)(150, 0, 100, 10), 100);
        });
        test('returns default for NaN', () => {
            assert.strictEqual((0, config_validation_1.clamp)(NaN, 0, 100, 10), 10);
        });
        test('returns default for non-number', () => {
            assert.strictEqual((0, config_validation_1.clamp)('50', 0, 100, 10), 10);
            assert.strictEqual((0, config_validation_1.clamp)(undefined, 0, 100, 10), 10);
            assert.strictEqual((0, config_validation_1.clamp)(null, 0, 100, 10), 10);
        });
        test('returns default for Infinity', () => {
            assert.strictEqual((0, config_validation_1.clamp)(Infinity, 0, 100, 10), 10);
        });
    });
    suite('ensureNonNegative', () => {
        test('returns value when >= 0', () => {
            assert.strictEqual((0, config_validation_1.ensureNonNegative)(0, 5), 0);
            assert.strictEqual((0, config_validation_1.ensureNonNegative)(100, 5), 100);
        });
        test('returns default for negative', () => {
            assert.strictEqual((0, config_validation_1.ensureNonNegative)(-1, 5), 5);
        });
        test('returns default for non-number', () => {
            assert.strictEqual((0, config_validation_1.ensureNonNegative)('0', 5), 5);
        });
    });
    suite('ensureStringArray', () => {
        test('returns array of strings filtering invalid elements', () => {
            const result = (0, config_validation_1.ensureStringArray)(['a', 1, 'b', null, 'c', undefined], []);
            assert.deepStrictEqual(result, ['a', 'b', 'c']);
        });
        test('returns fallback when not array', () => {
            const fallback = ['x'];
            assert.strictEqual((0, config_validation_1.ensureStringArray)(null, fallback), fallback);
            assert.strictEqual((0, config_validation_1.ensureStringArray)(undefined, fallback), fallback);
            assert.strictEqual((0, config_validation_1.ensureStringArray)('hello', fallback), fallback);
            assert.strictEqual((0, config_validation_1.ensureStringArray)(42, fallback), fallback);
        });
        test('returns empty array when array is empty', () => {
            assert.deepStrictEqual((0, config_validation_1.ensureStringArray)([], ['default']), []);
        });
    });
    suite('ensureEnum', () => {
        test('returns value when in allowed set', () => {
            assert.strictEqual((0, config_validation_1.ensureEnum)('a', ['a', 'b'], 'c'), 'a');
            assert.strictEqual((0, config_validation_1.ensureEnum)('b', ['a', 'b'], 'c'), 'b');
        });
        test('returns default when not in allowed set', () => {
            assert.strictEqual((0, config_validation_1.ensureEnum)('d', ['a', 'b'], 'c'), 'c');
        });
        test('returns default when not string', () => {
            assert.strictEqual((0, config_validation_1.ensureEnum)(1, ['a', 'b'], 'c'), 'c');
            assert.strictEqual((0, config_validation_1.ensureEnum)(null, ['a', 'b'], 'c'), 'c');
        });
    });
    suite('ensureBoolean', () => {
        test('returns value when boolean', () => {
            assert.strictEqual((0, config_validation_1.ensureBoolean)(true, false), true);
            assert.strictEqual((0, config_validation_1.ensureBoolean)(false, true), false);
        });
        test('returns default when not boolean', () => {
            assert.strictEqual((0, config_validation_1.ensureBoolean)(1, false), false);
            assert.strictEqual((0, config_validation_1.ensureBoolean)('true', true), true);
        });
    });
    suite('ensureNonEmptyString', () => {
        test('returns trimmed string when non-empty', () => {
            assert.strictEqual((0, config_validation_1.ensureNonEmptyString)('  foo  ', 'def'), 'foo');
        });
        test('returns default when empty or whitespace', () => {
            assert.strictEqual((0, config_validation_1.ensureNonEmptyString)('', 'def'), 'def');
            assert.strictEqual((0, config_validation_1.ensureNonEmptyString)('   ', 'def'), 'def');
        });
        test('returns default when not string', () => {
            assert.strictEqual((0, config_validation_1.ensureNonEmptyString)(123, 'def'), 'def');
        });
    });
    suite('constants', () => {
        test('MAX_SAFE_LINE is positive and reasonable', () => {
            assert.ok(config_validation_1.MAX_SAFE_LINE >= 1 && config_validation_1.MAX_SAFE_LINE <= 50_000_000);
        });
        test('MAX_SESSION_FILENAME_LENGTH is positive', () => {
            assert.ok(config_validation_1.MAX_SESSION_FILENAME_LENGTH >= 256);
        });
    });
});
//# sourceMappingURL=config-validation.test.js.map