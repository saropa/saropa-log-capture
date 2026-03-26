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
const browser_devtools_1 = require("../../../modules/integrations/providers/browser-devtools");
suite('browser-devtools', () => {
    suite('toBrowserEvent', () => {
        test('should return event with all fields from valid input', () => {
            const result = (0, browser_devtools_1.toBrowserEvent)({
                message: 'hello',
                timestamp: 1000,
                level: 'error',
                url: 'http://example.com',
                lineNumber: 42,
            });
            assert.deepStrictEqual(result, {
                message: 'hello',
                timestamp: 1000,
                level: 'error',
                url: 'http://example.com',
                lineNumber: 42,
            });
        });
        test('should accept text as alias for message', () => {
            const result = (0, browser_devtools_1.toBrowserEvent)({ text: 'from text field', timestamp: 500 });
            assert.strictEqual(result?.message, 'from text field');
        });
        test('should prefer message over text', () => {
            const result = (0, browser_devtools_1.toBrowserEvent)({ message: 'primary', text: 'fallback' });
            assert.strictEqual(result?.message, 'primary');
        });
        test('should accept type as alias for level', () => {
            const result = (0, browser_devtools_1.toBrowserEvent)({ message: 'x', type: 'warning' });
            assert.strictEqual(result?.level, 'warning');
        });
        test('should accept time as string timestamp', () => {
            const result = (0, browser_devtools_1.toBrowserEvent)({ message: 'x', time: '12:34:56.789' });
            assert.strictEqual(result?.time, '12:34:56.789');
            assert.strictEqual(result?.timestamp, undefined);
        });
        test('should return undefined for null', () => {
            assert.strictEqual((0, browser_devtools_1.toBrowserEvent)(null), undefined);
        });
        test('should return undefined for non-object', () => {
            assert.strictEqual((0, browser_devtools_1.toBrowserEvent)('string'), undefined);
            assert.strictEqual((0, browser_devtools_1.toBrowserEvent)(42), undefined);
            assert.strictEqual((0, browser_devtools_1.toBrowserEvent)(true), undefined);
        });
        test('should return undefined when no message or text', () => {
            assert.strictEqual((0, browser_devtools_1.toBrowserEvent)({ timestamp: 1000, level: 'info' }), undefined);
        });
        test('should return undefined for empty message', () => {
            assert.strictEqual((0, browser_devtools_1.toBrowserEvent)({ message: '' }), undefined);
        });
        test('should omit fields with wrong types', () => {
            const result = (0, browser_devtools_1.toBrowserEvent)({
                message: 'ok',
                timestamp: 'not-a-number',
                level: 123,
                url: false,
                lineNumber: 'nope',
            });
            assert.deepStrictEqual(result, { message: 'ok' });
        });
        test('should reject NaN and Infinity timestamps', () => {
            assert.strictEqual((0, browser_devtools_1.toBrowserEvent)({ message: 'x', timestamp: NaN })?.timestamp, undefined);
            assert.strictEqual((0, browser_devtools_1.toBrowserEvent)({ message: 'x', timestamp: Infinity })?.timestamp, undefined);
        });
        test('should return event with only message when no other fields', () => {
            const result = (0, browser_devtools_1.toBrowserEvent)({ message: 'minimal' });
            assert.deepStrictEqual(result, { message: 'minimal' });
        });
    });
});
//# sourceMappingURL=browser-devtools.test.js.map