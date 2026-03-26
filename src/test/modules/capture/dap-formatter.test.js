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
const dap_formatter_1 = require("../../../modules/capture/dap-formatter");
const ts = new Date('2025-06-15T14:30:45.123Z');
suite('formatDapMessage', () => {
    test('should format outgoing request', () => {
        const msg = { type: 'request', command: 'initialize', arguments: { adapterID: 'node' } };
        const result = (0, dap_formatter_1.formatDapMessage)(msg, 'outgoing', ts);
        assert.ok(result.includes('[dap->]'));
        assert.ok(result.includes('initialize'));
        assert.ok(result.includes('"adapterID":"node"'));
    });
    test('should format incoming response', () => {
        const msg = { type: 'response', command: 'initialize', success: true, body: { supportsConfigurationDoneRequest: true } };
        const result = (0, dap_formatter_1.formatDapMessage)(msg, 'incoming', ts);
        assert.ok(result.includes('[dap<-]'));
        assert.ok(result.includes('initialize'));
    });
    test('should format event with dap:event prefix', () => {
        const msg = { type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 1 } };
        const result = (0, dap_formatter_1.formatDapMessage)(msg, 'incoming', ts);
        assert.ok(result.includes('[dap:event]'));
        assert.ok(result.includes('stopped'));
        assert.ok(result.includes('"reason":"breakpoint"'));
    });
    test('should handle message with no body or arguments', () => {
        const msg = { type: 'request', command: 'disconnect' };
        const result = (0, dap_formatter_1.formatDapMessage)(msg, 'outgoing', ts);
        assert.ok(result.includes('[dap->]'));
        assert.ok(result.includes('disconnect'));
        assert.ok(!result.includes('undefined'));
    });
    test('should fall back to "unknown" when no command or event', () => {
        const msg = { type: 'request' };
        const result = (0, dap_formatter_1.formatDapMessage)(msg, 'outgoing', ts);
        assert.ok(result.includes('unknown'));
    });
    test('should truncate large payloads', () => {
        const largeBody = { data: 'x'.repeat(600) };
        const msg = { type: 'response', command: 'variables', body: largeBody };
        const result = (0, dap_formatter_1.formatDapMessage)(msg, 'incoming', ts);
        assert.ok(result.includes('...'));
        assert.ok(result.length < 600);
    });
    test('should include timestamp in output', () => {
        const msg = { type: 'event', event: 'initialized' };
        const result = (0, dap_formatter_1.formatDapMessage)(msg, 'incoming', ts);
        assert.ok(result.includes('.123]'));
    });
});
//# sourceMappingURL=dap-formatter.test.js.map