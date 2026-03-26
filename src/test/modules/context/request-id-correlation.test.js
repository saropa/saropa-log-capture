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
const T = 1700000000000;
const WINDOW = { centerTime: T, windowMs: 5000 };
const WINDOW_WITH_ID = { centerTime: T, windowMs: 5000, requestId: 'req-abc123' };
suite('Request ID correlation — loadHttpContext', () => {
    test('should include entry matching requestId even outside time window', () => {
        const content = JSON.stringify({
            requests: [
                { timestamp: T - 90000, method: 'GET', url: '/api/users', status: 200, durationMs: 50, requestId: 'req-abc123' },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadHttpContext)(content, WINDOW_WITH_ID);
        assert.strictEqual(result.http?.length, 1);
        assert.strictEqual(result.http?.[0].requestId, 'req-abc123');
    });
    test('should still include time-window entries without requestId', () => {
        const content = JSON.stringify({
            requests: [
                { timestamp: T + 1000, method: 'POST', url: '/api/items', status: 201, durationMs: 100 },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadHttpContext)(content, WINDOW_WITH_ID);
        assert.strictEqual(result.http?.length, 1);
        assert.strictEqual(result.http?.[0].url, '/api/items');
    });
    test('should exclude entry outside window with non-matching requestId', () => {
        const content = JSON.stringify({
            requests: [
                { timestamp: T - 90000, method: 'GET', url: '/other', status: 200, durationMs: 30, requestId: 'req-other' },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadHttpContext)(content, WINDOW_WITH_ID);
        assert.deepStrictEqual(result, {});
    });
    test('should behave as time-window-only when no requestId on window', () => {
        const content = JSON.stringify({
            requests: [
                { timestamp: T - 90000, method: 'GET', url: '/far', status: 200, durationMs: 10, requestId: 'req-abc123' },
                { timestamp: T, method: 'GET', url: '/near', status: 200, durationMs: 20 },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadHttpContext)(content, WINDOW);
        assert.strictEqual(result.http?.length, 1);
        assert.strictEqual(result.http?.[0].url, '/near');
    });
});
suite('Request ID correlation — loadDatabaseContext', () => {
    test('should include query matching requestId even outside time window', () => {
        const content = JSON.stringify({
            queries: [
                { timestamp: T - 90000, queryText: 'SELECT 1', requestId: 'req-abc123', durationMs: 5 },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, WINDOW_WITH_ID);
        assert.strictEqual(result.database?.length, 1);
        assert.strictEqual(result.database?.[0].requestId, 'req-abc123');
    });
    test('should exclude query outside window with non-matching requestId', () => {
        const content = JSON.stringify({
            queries: [
                { timestamp: T - 90000, queryText: 'SELECT 2', requestId: 'req-other' },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, WINDOW_WITH_ID);
        assert.deepStrictEqual(result, {});
    });
    test('should behave as time-window-only when no requestId on window', () => {
        const content = JSON.stringify({
            queries: [
                { timestamp: T - 90000, queryText: 'SELECT far', requestId: 'req-abc123' },
                { timestamp: T, queryText: 'SELECT near' },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, WINDOW);
        assert.strictEqual(result.database?.length, 1);
        assert.strictEqual(result.database?.[0].queryText, 'SELECT near');
    });
    test('should include query with no timestamp (timestamp zero treated as in-window)', () => {
        const content = JSON.stringify({
            queries: [
                { queryText: 'SELECT 1', lineStart: 10, lineEnd: 10 },
            ],
        });
        const result = (0, context_sidecar_parsers_1.loadDatabaseContext)(content, WINDOW);
        assert.strictEqual(result.database?.length, 1);
        assert.strictEqual(result.database?.[0].timestamp, T);
    });
});
suite('Request ID correlation — loadBrowserContext', () => {
    test('should include event with matching requestId field', () => {
        const content = JSON.stringify([
            { timestamp: T - 90000, message: 'XHR complete', level: 'log', requestId: 'req-abc123' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW_WITH_ID);
        assert.strictEqual(result.browser?.length, 1);
        assert.strictEqual(result.browser?.[0].requestId, 'req-abc123');
    });
    test('should include event where message contains the requestId', () => {
        const content = JSON.stringify([
            { timestamp: T - 90000, message: 'Failed request req-abc123 timed out', level: 'error' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW_WITH_ID);
        assert.strictEqual(result.browser?.length, 1);
        assert.strictEqual(result.browser?.[0].message, 'Failed request req-abc123 timed out');
    });
    test('should exclude event outside window with no ID match', () => {
        const content = JSON.stringify([
            { timestamp: T - 90000, message: 'Unrelated log', level: 'log' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW_WITH_ID);
        assert.deepStrictEqual(result, {});
    });
    test('should include both time-window and ID-matched events', () => {
        const content = JSON.stringify([
            { timestamp: T, message: 'in window', level: 'log' },
            { timestamp: T - 90000, message: 'has req-abc123', level: 'warn' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW_WITH_ID);
        assert.strictEqual(result.browser?.length, 2);
    });
    test('should not duplicate entry matching both time and ID', () => {
        const content = JSON.stringify([
            { timestamp: T, message: 'req-abc123 in window', level: 'log', requestId: 'req-abc123' },
        ]);
        const result = (0, context_sidecar_parsers_1.loadBrowserContext)(content, WINDOW_WITH_ID);
        assert.strictEqual(result.browser?.length, 1);
    });
});
//# sourceMappingURL=request-id-correlation.test.js.map