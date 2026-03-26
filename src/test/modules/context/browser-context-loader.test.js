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
const context_sidecar_parsers_1 = require("../../../modules/context/context-sidecar-parsers");
const WINDOW = { centerTime: 10000, windowMs: 5000 };
suite('loadBrowserContext', () => {
    test('should return events within time window', () => {
        const content = JSON.stringify([
            { timestamp: 8000, level: 'error', message: 'fail' },
            { timestamp: 12000, level: 'log', message: 'ok' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.length, 2);
        assert.strictEqual(result.browser?.[0].message, 'fail');
        assert.strictEqual(result.browser?.[0].level, 'error');
    });
    test('should filter out events outside time window', () => {
        const content = JSON.stringify([
            { timestamp: 1000, level: 'log', message: 'too early' },
            { timestamp: 10000, level: 'log', message: 'in window' },
            { timestamp: 99000, level: 'log', message: 'too late' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.length, 1);
        assert.strictEqual(result.browser?.[0].message, 'in window');
    });
    test('should accept { events: [...] } format', () => {
        const content = JSON.stringify({
            events: [{ timestamp: 10000, level: 'warn', message: 'wrapped' }],
        });
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.length, 1);
        assert.strictEqual(result.browser?.[0].message, 'wrapped');
    });
    test('should use text field as fallback for message', () => {
        const content = JSON.stringify([
            { timestamp: 10000, text: 'from text' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.[0].message, 'from text');
    });
    test('should use type field as fallback for level', () => {
        const content = JSON.stringify([
            { timestamp: 10000, message: 'x', type: 'warning' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.[0].level, 'warning');
    });
    test('should include url when present', () => {
        const content = JSON.stringify([
            { timestamp: 10000, message: 'x', url: 'http://test.com' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.[0].url, 'http://test.com');
    });
    test('should skip events with no message or text', () => {
        const content = JSON.stringify([
            { timestamp: 10000, level: 'info' },
            { timestamp: 10000, message: 'has text' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.length, 1);
    });
    test('should skip events with no timestamp', () => {
        const content = JSON.stringify([
            { message: 'no time' },
            { timestamp: 10000, message: 'has time' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.length, 1);
    });
    test('should return empty for malformed JSON', () => {
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)('not json{{{', WINDOW);
        assert.deepStrictEqual(result, {});
    });
    test('should return empty for empty array', () => {
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)('[]', WINDOW);
        assert.deepStrictEqual(result, {});
    });
    test('should cap at 30 events', () => {
        const events = Array.from({ length: 50 }, (_, i) => ({
            timestamp: 10000,
            message: `event ${i}`,
        }));
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(JSON.stringify(events), WINDOW);
        assert.strictEqual(result.browser?.length, 30);
    });
    test('should sort events by timestamp', () => {
        const content = JSON.stringify([
            { timestamp: 14000, message: 'later' },
            { timestamp: 8000, message: 'earlier' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW);
        assert.strictEqual(result.browser?.[0].message, 'earlier');
        assert.strictEqual(result.browser?.[1].message, 'later');
    });
});
//# sourceMappingURL=browser-context-loader.test.js.map