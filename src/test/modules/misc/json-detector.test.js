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
const json_detector_1 = require("../../../modules/misc/json-detector");
suite('JsonDetector', () => {
    suite('detectJson', () => {
        test('should detect simple JSON object', () => {
            const result = (0, json_detector_1.detectJson)('{"key": "value"}');
            assert.strictEqual(result.hasJson, true);
            assert.strictEqual(result.json, '{"key": "value"}');
            assert.deepStrictEqual(result.parsed, { key: 'value' });
        });
        test('should detect JSON with prefix text', () => {
            const result = (0, json_detector_1.detectJson)('[INFO] {"key": "value"}');
            assert.strictEqual(result.hasJson, true);
            assert.strictEqual(result.prefix, '[INFO] ');
            assert.strictEqual(result.json, '{"key": "value"}');
        });
        test('should detect JSON with suffix text', () => {
            const result = (0, json_detector_1.detectJson)('{"key": "value"} more text');
            assert.strictEqual(result.hasJson, true);
            assert.strictEqual(result.json, '{"key": "value"}');
            assert.strictEqual(result.suffix, ' more text');
        });
        test('should detect JSON array', () => {
            const result = (0, json_detector_1.detectJson)('[1, 2, 3]');
            assert.strictEqual(result.hasJson, true);
            assert.deepStrictEqual(result.parsed, [1, 2, 3]);
        });
        test('should detect nested JSON', () => {
            const result = (0, json_detector_1.detectJson)('{"outer": {"inner": "value"}}');
            assert.strictEqual(result.hasJson, true);
            assert.deepStrictEqual(result.parsed, { outer: { inner: 'value' } });
        });
        test('should return hasJson=false for plain text', () => {
            const result = (0, json_detector_1.detectJson)('This is plain text');
            assert.strictEqual(result.hasJson, false);
        });
        test('should return hasJson=false for empty string', () => {
            const result = (0, json_detector_1.detectJson)('');
            assert.strictEqual(result.hasJson, false);
        });
        test('should return hasJson=false for invalid JSON', () => {
            const result = (0, json_detector_1.detectJson)('{invalid json}');
            assert.strictEqual(result.hasJson, false);
        });
        test('should handle JSON with escaped quotes', () => {
            const result = (0, json_detector_1.detectJson)('{"msg": "He said \\"hello\\""}');
            assert.strictEqual(result.hasJson, true);
            assert.deepStrictEqual(result.parsed, { msg: 'He said "hello"' });
        });
        test('should not detect primitive values as JSON', () => {
            const result = (0, json_detector_1.detectJson)('The answer is 42');
            assert.strictEqual(result.hasJson, false);
        });
    });
    suite('formatJson', () => {
        test('should format object with indentation', () => {
            const result = (0, json_detector_1.formatJson)({ key: 'value' }, 2);
            assert.ok(result.includes('\n'));
            assert.ok(result.includes('  "key"'));
        });
        test('should handle arrays', () => {
            const result = (0, json_detector_1.formatJson)([1, 2, 3], 2);
            assert.ok(result.includes('1'));
        });
    });
    suite('jsonPreview', () => {
        test('should return full string if short', () => {
            const result = (0, json_detector_1.jsonPreview)('{"a":1}', 60);
            assert.strictEqual(result, '{"a":1}');
        });
        test('should truncate long strings', () => {
            const long = '{"key": "' + 'a'.repeat(100) + '"}';
            const result = (0, json_detector_1.jsonPreview)(long, 60);
            assert.ok(result.endsWith('...'));
            assert.strictEqual(result.length, 60);
        });
    });
    suite('mightContainJson', () => {
        test('should return true for text with brace', () => {
            assert.strictEqual((0, json_detector_1.mightContainJson)('has { brace'), true);
        });
        test('should return true for text with bracket', () => {
            assert.strictEqual((0, json_detector_1.mightContainJson)('has [ bracket'), true);
        });
        test('should return false for plain text', () => {
            assert.strictEqual((0, json_detector_1.mightContainJson)('plain text'), false);
        });
    });
});
//# sourceMappingURL=json-detector.test.js.map