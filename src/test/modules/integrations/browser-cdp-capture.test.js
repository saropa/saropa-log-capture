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
const browser_cdp_capture_1 = require("../../../modules/integrations/providers/browser-cdp-capture");
suite('CDP capture — mapConsoleEvent', () => {
    test('should map log event with string args', () => {
        const result = (0, browser_cdp_capture_1.mapConsoleEvent)({
            type: 'log',
            args: [{ value: 'hello' }, { value: 'world' }],
            timestamp: 1700000000.123,
        });
        assert.strictEqual(result?.message, 'hello world');
        assert.strictEqual(result?.level, 'log');
        assert.strictEqual(result?.timestamp, 1700000000123);
    });
    test('should map error event', () => {
        const result = (0, browser_cdp_capture_1.mapConsoleEvent)({
            type: 'error',
            args: [{ value: 'Something failed' }],
            timestamp: 1700000001.0,
        });
        assert.strictEqual(result?.level, 'error');
        assert.strictEqual(result?.message, 'Something failed');
    });
    test('should use description when value is undefined', () => {
        const result = (0, browser_cdp_capture_1.mapConsoleEvent)({
            type: 'log',
            args: [{ description: 'Object { x: 1 }' }],
            timestamp: 1700000000.0,
        });
        assert.strictEqual(result?.message, 'Object { x: 1 }');
    });
    test('should extract url and lineNumber from stackTrace', () => {
        const result = (0, browser_cdp_capture_1.mapConsoleEvent)({
            type: 'log',
            args: [{ value: 'test' }],
            timestamp: 1700000000.0,
            stackTrace: {
                callFrames: [{ url: 'http://localhost:3000/app.js', lineNumber: 42 }],
            },
        });
        assert.strictEqual(result?.url, 'http://localhost:3000/app.js');
        assert.strictEqual(result?.lineNumber, 42);
    });
    test('should return undefined for empty args', () => {
        assert.strictEqual((0, browser_cdp_capture_1.mapConsoleEvent)({ type: 'log', args: [] }), undefined);
    });
    test('should return undefined for missing args', () => {
        assert.strictEqual((0, browser_cdp_capture_1.mapConsoleEvent)({ type: 'log' }), undefined);
    });
    test('should use Date.now() when timestamp is missing', () => {
        const before = Date.now();
        const result = (0, browser_cdp_capture_1.mapConsoleEvent)({ type: 'log', args: [{ value: 'x' }] });
        const after = Date.now();
        assert.ok(result);
        assert.ok(result.timestamp >= before && result.timestamp <= after);
    });
    test('should default level to log when type is missing', () => {
        const result = (0, browser_cdp_capture_1.mapConsoleEvent)({ args: [{ value: 'test' }], timestamp: 1700000000.0 });
        assert.strictEqual(result?.level, 'log');
    });
    test('should preserve falsy-but-defined value like 0', () => {
        const result = (0, browser_cdp_capture_1.mapConsoleEvent)({
            type: 'log',
            args: [{ value: 0 }, { value: 'items' }],
            timestamp: 1700000000.0,
        });
        assert.strictEqual(result?.message, '0 items');
    });
    test('should skip arg with empty string value', () => {
        const result = (0, browser_cdp_capture_1.mapConsoleEvent)({
            type: 'log',
            args: [{ value: '' }, { value: 'ok' }],
            timestamp: 1700000000.0,
        });
        assert.strictEqual(result?.message, 'ok');
    });
});
suite('CDP capture — mapNetworkEvent', () => {
    test('should map 200 response as info', () => {
        const result = (0, browser_cdp_capture_1.mapNetworkEvent)({
            response: { url: 'http://localhost:3000/api/data', status: 200 },
            timestamp: 1700000000.5,
        });
        assert.strictEqual(result?.message, 'HTTP 200 http://localhost:3000/api/data');
        assert.strictEqual(result?.level, 'info');
        assert.strictEqual(result?.timestamp, 1700000000500);
    });
    test('should map 500 response as error', () => {
        const result = (0, browser_cdp_capture_1.mapNetworkEvent)({
            response: { url: 'http://localhost:3000/api/fail', status: 500 },
            timestamp: 1700000001.0,
        });
        assert.strictEqual(result?.level, 'error');
    });
    test('should map 404 response as error', () => {
        const result = (0, browser_cdp_capture_1.mapNetworkEvent)({
            response: { url: '/missing', status: 404 },
            timestamp: 1700000000.0,
        });
        assert.strictEqual(result?.level, 'error');
    });
    test('should return undefined when response has no url', () => {
        assert.strictEqual((0, browser_cdp_capture_1.mapNetworkEvent)({ response: { status: 200 } }), undefined);
    });
    test('should return undefined when response is missing', () => {
        assert.strictEqual((0, browser_cdp_capture_1.mapNetworkEvent)({ timestamp: 1700000000.0 }), undefined);
    });
    test('should default status to 0 when missing', () => {
        const result = (0, browser_cdp_capture_1.mapNetworkEvent)({
            response: { url: 'http://localhost/api' },
            timestamp: 1700000000.0,
        });
        assert.strictEqual(result?.message, 'HTTP 0 http://localhost/api');
        assert.strictEqual(result?.level, 'info');
    });
});
suite('CDP capture — isLocalhostUrl', () => {
    test('should accept localhost', () => {
        assert.strictEqual((0, browser_cdp_capture_1.isLocalhostUrl)('ws://localhost:9222'), true);
    });
    test('should accept 127.0.0.1', () => {
        assert.strictEqual((0, browser_cdp_capture_1.isLocalhostUrl)('ws://127.0.0.1:9222'), true);
    });
    test('should accept ::1', () => {
        assert.strictEqual((0, browser_cdp_capture_1.isLocalhostUrl)('ws://[::1]:9222'), true);
    });
    test('should reject external host', () => {
        assert.strictEqual((0, browser_cdp_capture_1.isLocalhostUrl)('ws://evil.com:9222'), false);
    });
    test('should reject 192.168 addresses', () => {
        assert.strictEqual((0, browser_cdp_capture_1.isLocalhostUrl)('ws://192.168.1.1:9222'), false);
    });
    test('should return false for invalid URL', () => {
        assert.strictEqual((0, browser_cdp_capture_1.isLocalhostUrl)('not-a-url'), false);
    });
});
//# sourceMappingURL=browser-cdp-capture.test.js.map