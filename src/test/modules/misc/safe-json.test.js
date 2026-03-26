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
const safe_json_1 = require("../../../modules/misc/safe-json");
suite('safe-json', () => {
    suite('safeParseJSON', () => {
        test('parses valid JSON string', () => {
            const result = (0, safe_json_1.safeParseJSON)('{"a":1}');
            assert.strictEqual(result?.a, 1);
        });
        test('parses valid JSON Buffer', () => {
            const result = (0, safe_json_1.safeParseJSON)(Buffer.from('{"x":"y"}', 'utf-8'));
            assert.strictEqual(result?.x, 'y');
        });
        test('returns undefined for invalid JSON', () => {
            assert.strictEqual((0, safe_json_1.safeParseJSON)('{ invalid'), undefined);
            assert.strictEqual((0, safe_json_1.safeParseJSON)(''), undefined);
        });
        test('returns fallback when parse fails', () => {
            const fallback = { default: true };
            assert.strictEqual((0, safe_json_1.safeParseJSON)('{', fallback), fallback);
        });
        test('returns undefined for empty string when no fallback', () => {
            const result = (0, safe_json_1.safeParseJSON)('   ');
            assert.strictEqual(result, undefined);
        });
        test('returns fallback for empty string when fallback provided', () => {
            const fallback = {};
            assert.strictEqual((0, safe_json_1.safeParseJSON)('   ', fallback), fallback);
        });
    });
    suite('parseJSONOrDefault', () => {
        test('returns parsed object when valid', () => {
            const def = { k: 'default' };
            const result = (0, safe_json_1.parseJSONOrDefault)('{"k":"v"}', def);
            assert.strictEqual(result.k, 'v');
        });
        test('returns default when parse fails', () => {
            const def = { k: 'default' };
            assert.strictEqual((0, safe_json_1.parseJSONOrDefault)('not json', def), def);
        });
        test('returns default when result is null', () => {
            const def = { k: 'default' };
            assert.strictEqual((0, safe_json_1.parseJSONOrDefault)('null', def), def);
        });
    });
});
//# sourceMappingURL=safe-json.test.js.map